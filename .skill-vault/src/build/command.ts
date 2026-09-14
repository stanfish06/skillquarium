import type { Command } from "../cli";
import { buildVault } from "./run";

export const help = `usage: skillquarium build [--prune] [--graph] [--force-aliases] [--notes-only|--kg-only]

Regenerate vault/notes, vault/maps and vault/index.md from skills/*/SKILL.md.

  --prune          delete wrapper notes whose skill folder is gone
  --graph          rewrite .obsidian/graph.json color groups and filter
  --force-aliases  regenerate aliases even where a note already has them
  --notes-only     build the navigation layer only (the default)
  --kg-only        build the knowledge graph only`;

export const run: Command = async (args, ctx) => {
  const flags = new Set(args);
  const unknown = args.filter(
    (arg) => !["--prune", "--graph", "--force-aliases", "--notes-only", "--kg-only"].includes(arg),
  );
  if (unknown.length) {
    ctx.err(`skillquarium build: unknown option ${unknown[0]}`);
    ctx.err(help);
    return 2;
  }
  if (flags.has("--notes-only") && flags.has("--kg-only")) {
    ctx.err("skillquarium build: --notes-only and --kg-only are mutually exclusive");
    return 2;
  }
  if (flags.has("--kg-only")) {
    ctx.err("knowledge graph build lands in Task 5");
    return 1;
  }
  return buildVault(
    ctx.root,
    {
      prune: flags.has("--prune"),
      graph: flags.has("--graph"),
      forceAliases: flags.has("--force-aliases"),
    },
    { out: ctx.out, err: ctx.err },
  );
};
