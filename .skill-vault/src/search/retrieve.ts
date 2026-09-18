// query.py retrieve(): BM25 seeds, graph expansion, and the result shape the CLI prints.
import { sliceCodePoints } from "../kg/ngram";
import { indexFor } from "./bm25";
import { domainsOf, type VaultGraph } from "./graph";
import { type Expanded, expand } from "./graphExpand";
import type { Completion, QueryResult } from "./types";

/** Longest description the result carries; query.py slices code points, not UTF-16 units. */
const DESCRIPTION_CHARS = 160;

export function retrieve(
  graph: VaultGraph,
  query: string,
  k = 8,
): { results: QueryResult[]; completions: Completion[] } {
  const { ranked, completions } = expand(graph, indexFor(graph).topK(query, k), k);
  return { results: shapeResults(graph, ranked), completions };
}

/** query.py L190-205: the printed record for each expanded pick. Shared with the hybrid query. */
export function shapeResults(graph: VaultGraph, ranked: readonly Expanded[]): QueryResult[] {
  return ranked.map(({ id, score, why }) => {
    const node = graph.nodes.get(id);
    return {
      skill: id,
      score: round3(score),
      why,
      description: sliceCodePoints(node?.description ?? "", DESCRIPTION_CHARS),
      source: node?.source || `skills/${id}/SKILL.md`,
      domains: domainsOf(graph, id),
    };
  });
}

/**
 * Python round(x, 3) breaks ties to even; toFixed breaks them upward. A double is an exact
 * 3-decimal tie only when 16x is an odd integer, so handle that case and defer otherwise.
 */
function round3(value: number): number {
  const halves = value * 16;
  if (Number.isInteger(halves) && halves % 2 !== 0) {
    const lower = Math.floor(value * 1000);
    return (lower % 2 === 0 ? lower : lower + 1) / 1000;
  }
  return Number(value.toFixed(3));
}
