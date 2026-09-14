import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readdirSync,
  readlinkSync,
  renameSync,
  rmdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Context } from "../cli";
import { installCareerOps } from "./careerOps";
import { installGstack } from "./gstack";
import { linkClaude } from "./linkClaude";
import { installUiUxProMax } from "./uiUxProMax";

export type Io = Pick<Context, "out" | "err">;

export interface ExecResult {
  code: number;
  stdout: string;
}
export interface ExecOptions {
  cwd?: string;
  /** Pipe stdout into the result instead of inheriting it. */
  capture?: boolean;
}
export interface Runner {
  /** true: print each command instead of running it. */
  dryRun: boolean;
  exec(argv: string[], opts?: ExecOptions): Promise<ExecResult>;
}

/** Spawn commands by name so PATH resolution applies, or print them under --dry-run. */
export function makeRunner(io: Io, dryRun = false): Runner {
  return {
    dryRun,
    async exec(argv, opts = {}) {
      if (dryRun) {
        io.out(`+ ${argv.join(" ")}${opts.cwd === undefined ? "" : `   (in ${opts.cwd})`}`);
        return { code: 0, stdout: "" };
      }
      // env is passed explicitly: Bun resolves argv[0] against the spawn env's PATH, not
      // against later mutations of process.env.
      const env = { ...process.env };
      try {
        if (opts.capture) {
          const proc = Bun.spawn(argv, {
            cwd: opts.cwd,
            env,
            stdin: "inherit",
            stdout: "pipe",
            stderr: "inherit",
          });
          const stdout = await new Response(proc.stdout).text();
          return { code: await proc.exited, stdout };
        }
        const proc = Bun.spawn(argv, {
          cwd: opts.cwd,
          env,
          stdin: "inherit",
          stdout: "inherit",
          stderr: "inherit",
        });
        return { code: await proc.exited, stdout: "" };
      } catch (e) {
        // A missing binary is the shell's 127, not a crash.
        io.err(`ERROR: cannot run ${argv[0]}: ${e instanceof Error ? e.message : String(e)}`);
        return { code: 127, stdout: "" };
      }
    },
  };
}

export interface Extras {
  gstack: boolean;
  career: boolean;
  uiUx: boolean;
}
export interface InstallArgs {
  extras: Extras;
  dryRun: boolean;
  help: boolean;
  error?: string;
}

const EXTRA_NAMES = "gstack, career, ui-ux, all";

// Accept comma- and/or space-separated lists; empty parts are ignored.
function enableExtras(csv: string, extras: Extras): string | undefined {
  for (const raw of csv.split(/[\s,]+/)) {
    const name = raw.trim();
    if (name === "") continue;
    switch (name) {
      case "gstack":
        extras.gstack = true;
        break;
      case "career":
      case "career-ops":
        extras.career = true;
        break;
      case "ui-ux":
      case "ui-ux-pro-max":
      case "uipro":
        extras.uiUx = true;
        break;
      case "all":
        extras.gstack = true;
        extras.career = true;
        extras.uiUx = true;
        break;
      default:
        return `ERROR: unknown extra '${name}' (expected: ${EXTRA_NAMES})`;
    }
  }
  return undefined;
}

export function parseInstallArgs(args: string[]): InstallArgs {
  const extras: Extras = { gstack: false, career: false, uiUx: false };
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === undefined) continue;
    if (arg === "-h" || arg === "--help") return { extras, dryRun, help: true };
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--extras") {
      const next = args[i + 1];
      if (next === undefined || next.startsWith("-")) {
        return {
          extras,
          dryRun,
          help: false,
          error: `ERROR: --extras requires at least one name (${EXTRA_NAMES})`,
        };
      }
      // Consume every following word until the next flag.
      while (i + 1 < args.length) {
        const word = args[i + 1];
        if (word === undefined || word.startsWith("-")) break;
        const error = enableExtras(word, extras);
        if (error !== undefined) return { extras, dryRun, help: false, error };
        i++;
      }
    } else if (arg.startsWith("--extras=")) {
      const value = arg.slice("--extras=".length);
      if (value === "") {
        return {
          extras,
          dryRun,
          help: false,
          error: `ERROR: --extras= requires at least one name (${EXTRA_NAMES})`,
        };
      }
      const error = enableExtras(value, extras);
      if (error !== undefined) return { extras, dryRun, help: false, error };
    } else {
      return { extras, dryRun, help: false, error: `ERROR: unknown option: ${arg}` };
    }
  }
  return { extras, dryRun, help: false };
}

/** Path → two-letter status code from `git status --porcelain -z -uall`. */
export function gitStatus(root: string): Map<string, string> {
  const proc = Bun.spawnSync(["git", "-C", root, "status", "--porcelain", "-z", "-uall"], {
    env: { ...process.env },
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    throw new Error(`git status failed: ${proc.stderr.toString("utf8").trim()}`);
  }
  const status = new Map<string, string>();
  const records = proc.stdout.toString("utf8").split("\0");
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    // "XY path"; the shortest possible record is four characters.
    if (record === undefined || record.length < 4) continue;
    const code = record.slice(0, 2);
    status.set(record.slice(3), code);
    // A rename or copy record is followed by its source path.
    if (code.startsWith("R") || code.startsWith("C")) i++;
  }
  return status;
}

function chunked(paths: string[], size: number): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < paths.length; i += size) out.push(paths.slice(i, i + size));
  return out;
}

/**
 * Undo only what the skills CLI touched: paths dirty before it ran keep their edits.
 * `before` is the status map captured ahead of the CLI.
 */
export async function restoreCliChanges(
  root: string,
  runner: Runner,
  before: Map<string, string>,
): Promise<{ reverted: string[]; cleaned: string[] }> {
  const reverted: string[] = [];
  const cleaned: string[] = [];
  for (const [path, code] of gitStatus(root)) {
    if (before.has(path)) continue;
    if (code === "??") cleaned.push(path);
    else reverted.push(path);
  }
  // Chunked so a vault-wide rewrite cannot overflow the argument list.
  for (const chunk of chunked(reverted, 200)) {
    await runner.exec(["git", "-C", root, "checkout", "--", ...chunk]);
  }
  for (const chunk of chunked(cleaned, 200)) {
    await runner.exec(["git", "-C", root, "clean", "-f", "--", ...chunk]);
  }
  return { reverted, cleaned };
}

// Link roots some skills-cli hosts create inside the vault even for a global install.
const LINK_ROOTS = [".agents", ".pi", "agent"];

export async function installVault(ctx: Context, opts: { extras: Extras; dryRun: boolean }): Promise<number> {
  const cfg = await ctx.config();
  const runner = makeRunner(ctx, opts.dryRun);
  const skillsDir = join(ctx.root, "skills");
  const gstackDir = join(skillsDir, "gstack");

  const remove = (path: string) => {
    if (lstatSync(path, { throwIfNoEntry: false }) === undefined) return;
    if (opts.dryRun) ctx.out(`+ rm -rf ${path}`);
    else rmSync(path, { recursive: true, force: true });
  };

  // gstack is a 250MB bundle with its own .git; moving it aside keeps `skills add`
  // from scanning it and leaking per-skill symlinks into the vault root.
  let stash: string | undefined;
  const restoreGstack = () => {
    if (stash === undefined) return;
    const stashed = join(stash, "gstack");
    if (existsSync(stashed) && lstatSync(gstackDir, { throwIfNoEntry: false }) === undefined) {
      renameSync(stashed, gstackDir);
    }
    try {
      rmdirSync(stash);
    } catch {
      // A non-empty stash dir means the move failed; leave it for inspection.
    }
    stash = undefined;
  };
  // An interrupted run must not strand gstack in the temp dir with the vault missing it.
  const onInterrupt = () => {
    restoreGstack();
    process.exit(130);
  };
  const onTerminate = () => {
    restoreGstack();
    process.exit(143);
  };
  process.on("SIGINT", onInterrupt);
  process.on("SIGTERM", onTerminate);

  try {
    if (statSync(join(gstackDir, ".git"), { throwIfNoEntry: false })?.isDirectory()) {
      if (opts.dryRun) ctx.out(`+ mv ${gstackDir} <tmp>/gstack   (restored after the skills CLI)`);
      else {
        stash = mkdtempSync(join(tmpdir(), "gstack-stash."));
        renameSync(gstackDir, join(stash, "gstack"));
      }
    }

    if (opts.extras.uiUx) {
      const code = await installUiUxProMax(ctx.root, ctx, runner);
      if (code !== 0) return code;
    } else {
      ctx.out("ui-ux-pro-max: skipped (pass --extras ui-ux to install)");
    }

    // skills-cli >= 1.5.19 skips any skill already inside the global store, and this
    // vault is that store, so `add` prints ✓ without linking; linkClaude does the work.
    const before = opts.dryRun ? new Map<string, string>() : gitStatus(ctx.root);
    const add = await runner.exec(
      ["npx", "-y", `skills@${cfg.skillsCliVersion}`, "add", ".", "-s", "*", "-g"],
      { cwd: ctx.root },
    );
    if (opts.dryRun) {
      ctx.out("+ git checkout / git clean the paths the skills CLI changed (dirty paths kept)");
    } else {
      const { reverted, cleaned } = await restoreCliChanges(ctx.root, runner, before);
      ctx.out(`vault: ${reverted.length} file(s) reverted, ${cleaned.length} generated file(s) removed`);
    }
    if (add.code !== 0) {
      ctx.err(`ERROR: skills CLI failed with exit code ${add.code}.`);
      return add.code;
    }

    // Generated link roots, not source: Pi would rediscover them as project skills, and
    // `skills/` is scanned three levels deep, so a stale root inside it becomes skills.
    for (const name of LINK_ROOTS) {
      remove(join(ctx.root, name));
      remove(join(skillsDir, name));
    }

    restoreGstack();

    // Stray artifacts gstack's own ./setup leaks into the vault on later runs.
    if (existsSync(skillsDir)) {
      for (const name of readdirSync(skillsDir)) {
        const dir = join(skillsDir, name);
        // Directories from gstack's ./setup --prefix; gstack-*.md files are real skills.
        if (name.startsWith("gstack-") && !name.endsWith(".md")) {
          remove(dir);
          continue;
        }
        if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) continue;
        const md = join(dir, "SKILL.md");
        if (lstatSync(md, { throwIfNoEntry: false })?.isSymbolicLink() === true) {
          if (readlinkSync(md).includes("gstack")) remove(dir);
        }
      }
    }

    const counts = linkClaude(ctx.root, cfg.claudeSkillsDir, { dryRun: opts.dryRun });
    ctx.out(
      `claude-code: ${counts.linked} linked, ${counts.current} already current, ` +
        `${counts.kept} left as directories, ${counts.pruned} stale links pruned`,
    );

    if (opts.extras.career) {
      const code = await installCareerOps(ctx, runner);
      if (code !== 0) return code;
    } else {
      ctx.out("career-ops: skipped (pass --extras career to install)");
    }

    if (opts.extras.gstack) {
      const code = await installGstack(gstackDir, cfg.claudeSkillsDir, ctx, runner);
      if (code !== 0) return code;
    } else {
      ctx.out("gstack: skipped (pass --extras gstack to install)");
    }
    return 0;
  } finally {
    process.off("SIGINT", onInterrupt);
    process.off("SIGTERM", onTerminate);
    restoreGstack();
  }
}
