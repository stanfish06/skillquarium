// The hybrid query: BM25, fff path fuzz and semantic vectors fused by rank, then graph-expanded.
import { join } from "node:path";
import type { EmbedClient } from "../embed/client";
import { EMBED_DIR } from "../embed/store";
import { indexFor } from "./bm25";
import type { FuzzyRanker } from "./fff";
import { rrf, type Signal, type SignalName } from "./fusion";
import type { VaultGraph } from "./graph";
import { DIRECT_WHY, expand } from "./graphExpand";
import { retrieve, shapeResults } from "./retrieve";
import type { Completion, QueryResult, Ranked } from "./types";
import { semanticRank, type VectorIndex } from "./vectors";

/** The order signal names are listed in, everywhere they are listed. */
const SIGNAL_ORDER: readonly SignalName[] = ["lexical", "fuzzy", "semantic"];

export interface QueryOptions {
  k: number;
  semantic: boolean;
  fuzzy: boolean;
  explain: boolean;
}

/** Everything the query reads from outside itself; the loaders run only for enabled signals. */
export interface QueryDeps {
  graph: VaultGraph;
  vectors: () => VectorIndex | null;
  embed: () => EmbedClient;
  fuzzy: () => FuzzyRanker;
  rrfK: number;
  weights: Record<SignalName, number>;
}

export interface HybridResult extends QueryResult {
  /** Signal name -> the rank this skill took in that signal's own list. */
  signals: Partial<Record<SignalName, number>>;
  stale?: true;
}

export interface QueryRun {
  results: HybridResult[];
  completions: Completion[];
  /** Signals that were asked for but could not run; the command prints them to stderr. */
  notices: string[];
}

export interface Gathered {
  signals: Signal[];
  notices: string[];
  /** The vector index if one was loaded, for the stale tag. */
  index: VectorIndex | null;
}

/**
 * Runs every enabled signal over the same query text, each returning 2k candidates. A signal that
 * cannot run becomes a notice and drops out of the fusion; the query never fails because of one.
 */
export async function gatherSignals(
  root: string,
  text: string,
  opts: QueryOptions,
  deps: QueryDeps,
): Promise<Gathered> {
  const width = opts.k * 2;
  const signals: Signal[] = [{ name: "lexical", results: indexFor(deps.graph).topK(text, width) }];
  const notices: string[] = [];

  if (opts.fuzzy) {
    const ranker = deps.fuzzy();
    const results = await ranker.fuzzyRank(text, width);
    const problem = ranker.problem();
    if (problem !== null) notices.push(`fuzzy path search unavailable: ${problem}`);
    else signals.push({ name: "fuzzy", results });
  }

  let index: VectorIndex | null = null;
  if (opts.semantic) {
    index = deps.vectors();
    if (index === null) {
      notices.push(
        `semantic search unavailable: no vector index at ${join(root, EMBED_DIR)}; ` +
          "run 'skillquarium embed' to build it",
      );
    } else {
      // An unreachable or erroring endpoint drops the signal the way a missing index does: a fresh
      // clone has never pointed at one, and a query must still answer from the other signals. The
      // client names the endpoint in its error, so the notice says which host failed.
      let vector: Float32Array | undefined;
      let failure: string | null = null;
      try {
        [vector] = await deps.embed().embed([text]);
      } catch (e) {
        failure = e instanceof Error ? e.message : String(e);
      }
      if (failure !== null) notices.push(`semantic search unavailable: ${failure}`);
      else if (vector === undefined)
        notices.push("semantic search unavailable: the endpoint returned no vector");
      else signals.push({ name: "semantic", results: semanticRank(index, vector, width) });
    }
  }

  return { signals, notices, index };
}

/**
 * Fused seeds through Task 7's graph expansion. Graph-derived picks carry fixed scores in
 * [0.4, 0.6] while a fused score is about 1/rrfK, so seeds are remapped onto (1, 2] in fused
 * order: any rrfK and any weights then still leave every direct hit above every derived one.
 */
export function expandFused(
  deps: QueryDeps,
  signals: Signal[],
  k: number,
): { results: QueryResult[]; completions: Completion[]; fused: Ranked[] } {
  const fused = rrf(signals, deps.rrfK, deps.weights);
  const top = fused[0]?.score ?? 1;
  const seeds: Ranked[] = fused.slice(0, k * 2).map((r) => ({ ...r, score: 1 + r.score / top }));
  const { ranked, completions } = expand(deps.graph, seeds, k);
  return { results: shapeResults(deps.graph, ranked), completions, fused };
}

/** id -> the rank it took in each signal it appeared in. */
function ranksById(signals: Signal[]): Map<string, Partial<Record<SignalName, number>>> {
  const ranks = new Map<string, Partial<Record<SignalName, number>>>();
  for (const signal of signals) {
    for (const r of signal.results) {
      const entry = ranks.get(r.id) ?? {};
      entry[signal.name] = r.rank;
      ranks.set(r.id, entry);
    }
  }
  return ranks;
}

interface Decoration {
  ranks: Map<string, Partial<Record<SignalName, number>>>;
  index: VectorIndex | null;
  fused: Map<string, number> | null;
  deps: QueryDeps;
  explain: boolean;
}

function decorate(result: QueryResult, d: Decoration): HybridResult {
  const signals = d.ranks.get(result.skill) ?? {};
  const hit = SIGNAL_ORDER.filter((name) => signals[name] !== undefined);
  let why = result.why;
  if (why === DIRECT_WHY && hit.length > 0) why = `${DIRECT_WHY} (${hit.join(", ")})`;
  if (d.explain && hit.length > 0) {
    const parts = hit.map((name) => {
      const rank = signals[name] ?? 0;
      // No fused map means no fusion ran (lexical only), so there is no contribution to report.
      if (d.fused === null) return `${name} #${rank}`;
      return `${name} #${rank} +${(d.deps.weights[name] / (d.deps.rrfK + rank)).toFixed(4)}`;
    });
    const total = d.fused?.get(result.skill);
    const sum = total === undefined ? "" : `, fused ${total.toFixed(4)}`;
    why = `${why} [${parts.join(", ")}${sum}]`;
  }
  const out: HybridResult = { ...result, why, signals };
  if (d.index?.stale.has(result.skill)) out.stale = true;
  return out;
}

export async function runQuery(
  root: string,
  text: string,
  opts: QueryOptions,
  deps: QueryDeps,
): Promise<QueryRun> {
  // Both extra signals off is Task 7's retrieve verbatim, delegation and all: the Python parity
  // golden only keeps meaning something as long as nothing in the fused path can touch it.
  if (!opts.semantic && !opts.fuzzy) {
    const { results, completions } = retrieve(deps.graph, text, opts.k);
    const lexical: Signal[] = [{ name: "lexical", results: indexFor(deps.graph).topK(text, opts.k) }];
    const d: Decoration = {
      ranks: ranksById(lexical),
      index: null,
      fused: null,
      deps,
      explain: opts.explain,
    };
    return { results: results.map((r) => decorate(r, d)), completions, notices: [] };
  }

  const { signals, notices, index } = await gatherSignals(root, text, opts, deps);
  const { results, completions, fused } = expandFused(deps, signals, opts.k);
  const d: Decoration = {
    ranks: ranksById(signals),
    index,
    fused: new Map(fused.map((r) => [r.id, r.score])),
    deps,
    explain: opts.explain,
  };
  return { results: results.map((r) => decorate(r, d)), completions, notices };
}
