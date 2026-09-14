// Reciprocal rank fusion of the retrieval signals. Only rank positions cross the boundary, so
// BM25 scores, fff path scores and cosine similarities never have to be made commensurate.
import type { Ranked } from "./types";

export type SignalName = "lexical" | "fuzzy" | "semantic";

export interface Signal {
  name: SignalName;
  results: Ranked[];
}

/**
 * score(id) = sum over signals of weight / (k + rank), sorted descending, ties by id ascending.
 * A zero-weighted signal is dropped before scoring rather than contributing 0, so its ids never
 * reach the output at all.
 */
export function rrf(signals: Signal[], k: number, weights: Record<SignalName, number>): Ranked[] {
  const fused = new Map<string, number>();
  for (const signal of signals) {
    const weight = weights[signal.name];
    if (weight === 0) continue;
    for (const r of signal.results) fused.set(r.id, (fused.get(r.id) ?? 0) + weight / (k + r.rank));
  }
  return [...fused]
    .sort((a, b) => (a[1] === b[1] ? (a[0] < b[0] ? -1 : 1) : b[1] - a[1]))
    .map(([id, score], i) => ({ id, score, rank: i + 1 }));
}
