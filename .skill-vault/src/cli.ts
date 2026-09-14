import { resolve } from "node:path";
import { type Config, loadConfig } from "./config";

export type Command = (args: string[], ctx: Context) => Promise<number>;
export interface Context {
  root: string;
  json: boolean;
  out: (line: string) => void;
  err: (line: string) => void;
  config: () => Promise<Config>;
}
export type ContextOverrides = Partial<Pick<Context, "out" | "err" | "config">>;

const commands: Record<string, () => Promise<{ run: Command; help: string }>> = {
  doctor: () => import("./doctor"),
  tui: () => import("./tui/command"),
  // later tasks add: query, grep, embed, build, validate, list, catalog, preview,
  // enable, disable, toggle, save, load, "pre-commit-reset", install, update, overrides,
  // drift, soften, import, eval
};

// Build a Context; `config` memoizes loadConfig(root) so commands share one parse.
export function makeContext(root: string, json: boolean, overrides: ContextOverrides = {}): Context {
  let loaded: Promise<Config> | undefined;
  return {
    root: resolve(root),
    json,
    out: overrides.out ?? ((line) => console.log(line)),
    err: overrides.err ?? ((line) => console.error(line)),
    config:
      overrides.config ??
      (() => {
        loaded ??= loadConfig(resolve(root));
        return loaded;
      }),
  };
}

// Split global flags (--root, --json) from the command and its arguments.
export function parseGlobal(argv: string[]): { root: string; json: boolean; rest: string[] } {
  let root = process.env.SKILLQUARIUM_ROOT ?? resolve(import.meta.dir, "../..");
  let json = false;
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === undefined) continue;
    if (a === "--root") {
      const value = argv[++i];
      if (value === undefined) throw new Error("--root requires a path");
      root = value;
    } else if (a.startsWith("--root=")) {
      const value = a.slice("--root=".length);
      if (value === "") throw new Error("--root requires a path");
      root = value;
    } else if (a === "--json") json = true;
    else rest.push(a);
  }
  return { root: resolve(root), json, rest };
}

export async function main(argv: string[], overrides: ContextOverrides = {}): Promise<number> {
  const err = overrides.err ?? ((line: string) => console.error(line));
  let parsed: ReturnType<typeof parseGlobal>;
  try {
    parsed = parseGlobal(argv);
  } catch (e) {
    err(`skillquarium: ${e instanceof Error ? e.message : String(e)}`);
    return 2;
  }
  const ctx = makeContext(parsed.root, parsed.json, overrides);
  const { rest } = parsed;
  const name = rest[0] ?? "tui";
  if (name === "-h" || name === "--help") {
    ctx.out(usage());
    return 0;
  }
  const loader = commands[name];
  if (!loader) {
    ctx.err(`skillquarium: unknown command '${name}'`);
    ctx.err(usage());
    return 2;
  }
  const mod = await loader();
  if (rest[1] === "-h" || rest[1] === "--help") {
    ctx.out(mod.help);
    return 0;
  }
  try {
    return await mod.run(rest.slice(1), ctx);
  } catch (e) {
    ctx.err(`skillquarium ${name}: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
}

export function usage(): string {
  return `usage: skillquarium [--root DIR] [--json] <command> [args]\ncommands: ${Object.keys(commands).sort().join(", ")}`;
}

// exitCode instead of exit() so pending stdout writes flush before the process ends.
if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
