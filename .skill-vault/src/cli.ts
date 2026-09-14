import { resolve } from "node:path";

export type Command = (args: string[], ctx: Context) => Promise<number>;
export interface Context {
  root: string;
  json: boolean;
}

const commands: Record<string, () => Promise<{ run: Command; help: string }>> = {
  doctor: () => import("./doctor"),
  tui: () => import("./tui/command"),
  // later tasks add: query, grep, embed, build, validate, list, catalog, preview,
  // enable, disable, toggle, save, load, "pre-commit-reset", install, update, overrides,
  // drift, soften, import, eval
};

export function parseGlobal(argv: string[]): { ctx: Context; rest: string[] } {
  let root = process.env.SKILLQUARIUM_ROOT ?? resolve(import.meta.dir, "../..");
  let json = false;
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === undefined) continue;
    if (a === "--root") root = argv[++i] ?? root;
    else if (a.startsWith("--root=")) root = a.slice(7);
    else if (a === "--json") json = true;
    else rest.push(a);
  }
  return { ctx: { root: resolve(root), json }, rest };
}

export async function main(argv: string[]): Promise<number> {
  const { ctx, rest } = parseGlobal(argv);
  const name = rest[0] ?? "tui";
  if (name === "-h" || name === "--help") {
    printUsage();
    return 0;
  }
  const loader = commands[name];
  if (!loader) {
    console.error(`skillquarium: unknown command '${name}'`);
    printUsage();
    return 2;
  }
  const mod = await loader();
  if (rest[1] === "-h" || rest[1] === "--help") {
    console.log(mod.help);
    return 0;
  }
  try {
    return await mod.run(rest.slice(1), ctx);
  } catch (err) {
    console.error(`skillquarium ${name}: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
}

function printUsage(): void {
  console.log(
    `usage: skillquarium [--root DIR] [--json] <command> [args]\ncommands: ${Object.keys(commands).sort().join(", ")}`,
  );
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
