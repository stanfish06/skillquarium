import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { discoverSkills } from "../catalog";
import type { Command } from "../cli";
import { EMBED_DIR, readManifest, staleSkills } from "../embed/store";
import type { Graph } from "./types";
import type { EmbedState, LexiconTerms, ValidateDeps } from "./validate";
import { failed, renderReport, validateGraph } from "./validate";
import { graphPath } from "./write";

export const help = `usage: skillquarium [--json] validate

Check vault/graph/graph.json against the shape constraints (P1-P8), the competency
questions (CQ1-CQ8) and the embedding manifest.

Exit 1 only on a FAIL row; WARN and NOT_YET are reported and pass. Exit 2 when there
is no graph to check.`;

/** Only the parts of ontology/schema.json and lexicon.json the checks read. */
const ProvenanceSchema = z.object({
  provenance_levels: z.record(z.string(), z.object({ retrievable: z.boolean().optional() })),
});
const LexiconSchema = z.object({
  artifacts: z.record(z.string(), z.object({ label: z.string().optional() })),
  ambiguous_terms: z.record(z.string(), z.unknown()).default({}),
});

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Manifest hashes against SKILL.md on disk; null when nothing is embedded yet. */
function loadEmbedState(root: string): EmbedState | null {
  if (!existsSync(join(root, EMBED_DIR))) return null;
  const manifest = readManifest(root);
  if (!manifest) return null;
  const entries = discoverSkills(root, { bundles: false, excludeTransient: true });
  return { stale: staleSkills(root, manifest, entries), total: entries.length };
}

/** schema.json, lexicon.json and vault/embeddings: the inputs the checks need beside the graph. */
export function loadDeps(root: string): ValidateDeps {
  const ontology = join(root, ".skill-vault", "ontology");
  const levels = ProvenanceSchema.parse(readJson(join(ontology, "schema.json"))).provenance_levels;
  const lexiconPath = join(ontology, "lexicon.json");
  const lexicon: LexiconTerms | null = existsSync(lexiconPath)
    ? LexiconSchema.parse(readJson(lexiconPath))
    : null;
  return {
    provenance: new Set(Object.keys(levels)),
    retrievable: new Set(Object.entries(levels).flatMap(([k, v]) => (v.retrievable ? [k] : []))),
    lexicon,
    embeddings: loadEmbedState(root),
  };
}

export const run: Command = async (args, ctx) => {
  if (args.length > 0) {
    ctx.err(`skillquarium validate: unexpected argument ${args[0]}`);
    ctx.err(help);
    return 2;
  }
  const path = graphPath(ctx.root);
  if (!existsSync(path)) {
    ctx.err(`no graph at ${path} — run build first`);
    return 2;
  }
  const graph = readJson(path) as Graph;
  const report = validateGraph(graph, loadDeps(ctx.root));
  if (ctx.json) ctx.out(JSON.stringify(report.rows, null, 1));
  else for (const line of renderReport(report, graph.metrics)) ctx.out(line);
  return failed(report).length > 0 ? 1 : 0;
};
