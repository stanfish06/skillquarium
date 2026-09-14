import { statSync } from "node:fs";
import { join, relative } from "node:path";
import { buildVault } from "../build/run";
import type { Command, Context } from "../cli";
import { run as embedRun } from "../embed/command";
import { buildGraph } from "../kg/build";
import { writeGraph } from "../kg/write";
import { runDrift } from "./drift";
import { applyOverrides, loadOverrides, overridesPath, reportOverrides } from "./overrides";
import { softenVault } from "./soften";

export interface UpdateOptions {
  skipFetch?: boolean;
  skipEmbed?: boolean;
  failOnDrift?: boolean;
}

function exists(path: string, kind: "file" | "dir"): boolean {
  try {
    const stats = statSync(path);
    return kind === "dir" ? stats.isDirectory() : stats.isFile();
  } catch {
    return false;
  }
}

/**
 * `npx skills update -g -y` against this root. The CLI writes into $HOME/.agents, which is this
 * vault: update-skills.yml symlinks the two together, so the layout check is the same one the
 * workflow does before it spawns the CLI.
 */
async function fetchUpstream(root: string, version: string, ctx: Context): Promise<number | null> {
  const skills = join(root, "skills");
  const lock = join(root, ".skill-lock.json");
  if (!exists(skills, "dir") || !exists(lock, "file")) {
    ctx.err(`update: ${skills} and ${lock} are required before fetching upstream`);
    return null;
  }
  const child = Bun.spawn(["npx", "-y", `skills@${version}`, "update", "-g", "-y"], {
    cwd: root,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  return await child.exited;
}

function overridesStep(ctx: Context): number {
  const recorded = loadOverrides(overridesPath(ctx.root));
  return reportOverrides(applyOverrides(recorded, ctx.root, true), false, ctx);
}

function kgStep(ctx: Context): number {
  const written = writeGraph(ctx.root, buildGraph(ctx.root));
  ctx.out(`wrote ${relative(ctx.root, written)} (${(statSync(written).size / 1e6).toFixed(1)} MB)`);
  return 0;
}

interface OptionalModule {
  run?: Command;
}

/**
 * `validate` lives in src/kg and is registered by cli.ts; import it through a variable so the
 * chain still runs while that module is landing.
 */
async function optionalStep(specifier: string, ctx: Context): Promise<number> {
  let module: OptionalModule;
  try {
    module = (await import(specifier)) as OptionalModule;
  } catch {
    ctx.err(`update: ${specifier} is not available; step skipped`);
    return 0;
  }
  if (typeof module.run !== "function") {
    ctx.err(`update: ${specifier} exports no command; step skipped`);
    return 0;
  }
  return module.run([], ctx);
}

/** The update-skills.yml step chain: fetch, re-apply, rebuild, validate, embed, report. */
export async function update(options: UpdateOptions, ctx: Context): Promise<number> {
  const config = await ctx.config();
  let fetchExit = 0;
  if (!options.skipFetch) {
    ctx.err("update: fetch");
    const code = await fetchUpstream(ctx.root, config.skillsCliVersion, ctx);
    if (code === null) return 2;
    fetchExit = code;
    // The CLI exits 1 after updating every other skill when one fails (#827), so the rest of the
    // chain still runs and the partial sync gets built and committed.
    if (fetchExit !== 0) ctx.err(`update: skills update exited ${fetchExit}; continuing`);
  }

  const steps: [string, () => number | Promise<number>][] = [
    ["overrides", () => overridesStep(ctx)],
    ["soften", () => softenVault(ctx.root, {}, ctx)],
    ["build", () => buildVault(ctx.root, { prune: true, graph: false }, { out: ctx.out, err: ctx.err })],
    ["kg", () => kgStep(ctx)],
    ["validate", () => optionalStep("../kg/validate", ctx)],
  ];
  if (!options.skipEmbed) steps.push(["embed", () => embedRun([], ctx)]);

  for (const [name, step] of steps) {
    ctx.err(`update: ${name}`);
    const code = await step();
    if (code !== 0) {
      ctx.err(`update: ${name} failed with ${code}`);
      return code;
    }
  }

  ctx.err("update: drift");
  const drift = await runDrift(ctx.root, { failOnDrift: options.failOnDrift }, ctx);
  if (drift !== 0) return drift;
  // Last, so a partially failed upstream sync never discards the work that did succeed.
  return fetchExit !== 0 ? 1 : 0;
}
