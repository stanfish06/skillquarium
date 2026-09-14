import type { Command } from "../cli";
import { buildGraph } from "../kg/build";
import { writeGraph } from "../kg/write";
import { buildVault } from "./run";

// The graph reads domain assignments from the notes layer, so notes are rebuilt first.
function buildKnowledgeGraph(root: string, out: (line: string) => void): void {
  const graph = buildGraph(root);
  const path = writeGraph(root, graph);
  out(`wrote ${path} (${graph.nodes.length} nodes, ${graph.edges.length} edges)`);
}

export const help = `usage: skillquarium build [--prune] [--graph] [--force-aliases] [--notes-only|--kg-only]

Regenerate vault/notes, vault/maps and vault/index.md from skills/*/SKILL.md.

  --prune          delete wrapper notes whose skill folder is gone
  --graph          rewrite .obsidian/graph.json color groups and filter
  --force-aliases  regenerate aliases even where a note already has them
  --notes-only     build the navigation layer only
  --kg-only        build the knowledge graph only

Without --notes-only or --kg-only, both run: the navigation layer first, then the
knowledge graph, which reads the domain assignments the notes layer writes.`;

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
    buildKnowledgeGraph(ctx.root, ctx.out);
    return 0;
  }
  const code = await buildVault(
    ctx.root,
    {
      prune: flags.has("--prune"),
      graph: flags.has("--graph"),
      forceAliases: flags.has("--force-aliases"),
    },
    { out: ctx.out, err: ctx.err },
  );
  if (code !== 0 || flags.has("--notes-only")) return code;
  buildKnowledgeGraph(ctx.root, ctx.out);
  return 0;
};
