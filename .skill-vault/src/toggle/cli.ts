import { collapseWhitespace } from "../catalog";
import type { Command, Context } from "../cli";
import { type Product, ToggleService } from "./service";
import { pyJsonDumps, type Skill } from "./state";

interface CommandModule {
  run: Command;
  help: string;
}

// Toggle commands report failures as `skill-toggle: <message>` with status 2 (skill_toggle.py main).
function guarded(
  help: string,
  body: (args: string[], ctx: Context, service: ToggleService) => void,
): CommandModule {
  return {
    help,
    run: async (args, ctx) => {
      try {
        body(args, ctx, new ToggleService(ctx.root));
        return 0;
      } catch (e) {
        ctx.err(`skill-toggle: ${e instanceof Error ? e.message : String(e)}`);
        return 2;
      }
    },
  };
}

class UsageError extends Error {}

const PRODUCTS: readonly Product[] = ["both", "claude", "codex"];

// `--product X` / `--product=X` anywhere among the skill names, as argparse accepts.
function parseProduct(args: string[], help: string): { product: Product; skills: string[] } {
  let product: Product = "both";
  const skills: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i] ?? "";
    let value: string | undefined;
    if (a === "--product") value = args[++i];
    else if (a.startsWith("--product=")) value = a.slice("--product=".length);
    else {
      skills.push(a);
      continue;
    }
    if (value === undefined || !PRODUCTS.includes(value as Product)) {
      throw new UsageError(`usage: skillquarium ${help}\n--product must be one of: ${PRODUCTS.join(", ")}`);
    }
    product = value as Product;
  }
  if (skills.length === 0)
    throw new UsageError(`usage: skillquarium ${help}\nat least one skill is required`);
  return { product, skills };
}

function printStates(ctx: Context, skills: Skill[]): void {
  for (const skill of skills) ctx.out(`${skill.state}\t${skill.key}`);
}

// Same key order as skill_toggle.py _skill_json; a Skill already carries it, so serialize directly.
function skillJson(skill: Skill): Skill {
  return {
    key: skill.key,
    name: skill.name,
    description: skill.description,
    directory: skill.directory,
    category: skill.category,
    claude_enabled: skill.claude_enabled,
    codex_enabled: skill.codex_enabled,
    state: skill.state,
    error: skill.error,
  };
}

export const list = guarded("list: list skills and invocation states", (_args, ctx, service) => {
  for (const skill of service.discover()) {
    ctx.out(`${skill.state}\t${skill.key}\t${skill.category}\t${collapseWhitespace(skill.description)}`);
  }
});

export const catalog = guarded("catalog: print the skill catalog as JSON", (_args, ctx, service) => {
  const { skills, categories } = service.catalog();
  ctx.out(pyJsonDumps({ skills: skills.map(skillJson), categories }));
});

const PREVIEW_HELP = "preview <skill>: show one skill's invocation state";
export const preview = guarded(PREVIEW_HELP, (args, ctx, service) => {
  const name = args[0];
  if (name === undefined || args.length !== 1) {
    throw new UsageError(`usage: skillquarium ${PREVIEW_HELP}\nexactly one skill is required`);
  }
  const skill = service.resolveSkills([name])[0];
  if (!skill) throw new Error(`unknown skill: ${name}`);
  ctx.out(`${skill.name}  [${skill.state}]`);
  ctx.out(`Directory: ${skill.directory}`);
  ctx.out(`Category: ${skill.category}`);
  ctx.out(
    skill.claude_enabled !== null
      ? `Claude Code: ${skill.claude_enabled ? "enabled" : "disabled"}`
      : "Claude Code: metadata error",
  );
  ctx.out(
    skill.codex_enabled !== null
      ? `Codex: ${skill.codex_enabled ? "enabled" : "disabled"}`
      : "Codex: metadata error",
  );
  if (skill.description) ctx.out(`\n${skill.description}`);
  if (skill.error) ctx.out(`\nError: ${skill.error}`);
});

function productCommand(
  name: string,
  apply: (service: ToggleService, p: Product, keys: string[]) => Skill[],
) {
  const help = `${name} [--product both|claude|codex] <skills...>: ${name} named skills`;
  return guarded(help, (args, ctx, service) => {
    const { product, skills } = parseProduct(args, help);
    printStates(ctx, apply(service, product, skills));
  });
}

export const enable = productCommand("enable", (service, product, keys) =>
  service.setProducts(keys, product, true),
);
export const disable = productCommand("disable", (service, product, keys) =>
  service.setProducts(keys, product, false),
);
export const toggle = productCommand("toggle", (service, product, keys) => service.toggle(keys, product));

export const save = guarded("save [path]: save all invocation states", (args, ctx, service) => {
  ctx.out(`saved\t${service.saveSnapshot(args[0])}`);
});

export const load = guarded("load [path]: reload saved invocation states", (args, ctx, service) => {
  const { source, changed } = service.loadSnapshot(args[0]);
  ctx.out(`loaded\t${changed}\t${source}`);
});

const RESET_HELP =
  "pre-commit-reset [--snapshot PATH]: save current states and activate every skill for both products";
export const preCommitReset = guarded(RESET_HELP, (args, ctx, service) => {
  let snapshot: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i] ?? "";
    if (a === "--snapshot") snapshot = args[++i];
    else if (a.startsWith("--snapshot=")) snapshot = a.slice("--snapshot=".length);
    else throw new UsageError(`usage: skillquarium ${RESET_HELP}\nunknown argument: ${a}`);
    if (snapshot === undefined || snapshot === "") {
      throw new UsageError(`usage: skillquarium ${RESET_HELP}\n--snapshot requires a path`);
    }
  }
  const result = service.preCommitReset(snapshot);
  ctx.out(`reset\t${result.changed}\t${result.snapshot}`);
});
