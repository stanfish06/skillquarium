// Stages C, D and E of query.py retrieve(): traversal, set-completion, order and budget.
import { pySorted } from "../kg/ngram";
import { isSkill, neighbours, targets, type VaultGraph } from "./graph";
import type { Ranked } from "./types";

export const DIRECT_WHY = "matched the query directly";

/** Neighbours a co_occurs_with hub would otherwise flood the result set with. */
const CO_OCCURS_CAP = 4;

export interface Expanded {
  id: string;
  score: number;
  why: string;
}

/**
 * Every traversal is sorted. The adjacency is sets and derived picks share a handful of
 * constant scores, so an unsorted traversal leaks set iteration order into the answer.
 */
export function expand(
  graph: VaultGraph,
  seeds: readonly Ranked[],
  k: number,
): { ranked: Expanded[]; completions: string[] } {
  const picks = new Map<string, { score: number; why: string }>();

  // Re-setting an existing key keeps its insertion position, which is the tie-break in stage E.
  function offer(id: string, score: number, why: string): void {
    if (!isSkill(graph, id)) return;
    if (graph.nodes.get(id)?.deprecated) return;
    const current = picks.get(id);
    if (current === undefined || score > current.score) picks.set(id, { score, why });
  }

  for (const seed of seeds) offer(seed.id, seed.score, DIRECT_WHY);

  // --- C expand ---------------------------------------------------------
  for (const { id: s } of seeds) {
    const upstream = new Set<string>([
      ...targets(graph.inn, "chains_to", s),
      ...targets(graph.inn, "prerequisite_of", s),
    ]);
    for (const p of pySorted(upstream)) offer(p, 0.6, `produces input for ${s}`);
    for (const next of pySorted(targets(graph.out, "chains_to", s))) {
      offer(next, 0.6, `consumes what ${s} produces`);
    }
    for (const alt of neighbours(graph, s, ["alternative_to"])) offer(alt, 0.4, `alternative to ${s}`);
    for (const co of neighbours(graph, s, ["co_occurs_with"]).slice(0, CO_OCCURS_CAP)) {
      offer(co, 0.5, `usually used together with ${s}`);
    }
  }

  // --- D set-complete: the COMP fix -------------------------------------
  const chosen = new Set(picks.keys());
  const completions: string[] = [];
  for (const recipe of graph.recipes) {
    const members = new Set(recipe.members);
    let hits = 0;
    for (const member of members) if (chosen.has(member)) hits += 1;
    if (hits < 2) continue;
    for (const member of recipe.steps.length ? recipe.steps : pySorted(members)) {
      if (!picks.has(member)) completions.push(member);
      offer(member, 0.55, `completes the '${recipe.label}' workflow`);
    }
  }

  // --- E order + budget -------------------------------------------------
  // Direct matches get at most ceil(0.7k); the rest of the budget is the graph's, or BM25
  // fills every slot whenever the query has strong lexical hits and stage D adds nothing.
  const entries: Expanded[] = [...picks].map(([id, pick]) => ({ id, ...pick }));
  const direct = entries.filter((e) => e.why === DIRECT_WHY).sort(byScoreDesc);
  const derived = entries.filter((e) => e.why !== DIRECT_WHY).sort(byScoreDesc);
  const ranked = direct.slice(0, Math.ceil(k * 0.7));
  ranked.push(...derived.slice(0, k - ranked.length));
  if (ranked.length < k) {
    const taken = new Set(ranked.map((e) => e.id));
    ranked.push(...direct.filter((e) => !taken.has(e.id)).slice(0, k - ranked.length));
  }

  const order = new Map<string, number>();
  for (const [i, entry] of ranked.entries()) order.set(entry.id, i);
  // Topological nudge: a skill that feeds another in the set comes first.
  for (let pass = 0; pass < 3; pass++) {
    for (const { id } of ranked) {
      for (const next of pySorted(targets(graph.out, "chains_to", id))) {
        const nextOrder = order.get(next);
        const ownOrder = order.get(id);
        if (nextOrder === undefined || ownOrder === undefined) continue;
        if (nextOrder < ownOrder) {
          order.set(id, nextOrder);
          order.set(next, ownOrder);
        }
      }
    }
  }
  ranked.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  return { ranked, completions };
}

/** Stable descending sort: ties keep the order they were offered in. */
function byScoreDesc(a: Expanded, b: Expanded): number {
  if (a.score === b.score) return 0;
  return a.score < b.score ? 1 : -1;
}
