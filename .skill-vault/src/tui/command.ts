import type { Command } from "../cli";
import { runTui } from "./index";

export const help = "tui [--query TEXT]: open the interactive skill browser";

// Parse `--query X` / `--query=X`; any other argument is an error.
export function parseQuery(args: string[]): string {
  let query = "";
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--query") {
      const value = args[++i];
      if (value === undefined) throw new Error("--query requires text");
      query = value;
    } else if (a?.startsWith("--query=")) {
      query = a.slice("--query=".length);
    } else {
      throw new Error(`unknown TUI option: ${a}`);
    }
  }
  return query;
}

export const run: Command = async (args, ctx) => runTui(ctx.root, parseQuery(args));
