// The hybrid query: BM25 and fff path fuzz fused by rank, then expanded through the knowledge
// graph and through cosine similarity between the stored skill vectors. Both signals are
// model-free and the query text is never embedded, so a dead endpoint costs the query nothing.
import { join } from "node:path";
import { EMBED_DIR } from "../embed/store";
import { indexFor, type Tokenizer } from "./bm25";
import { TOKENIZER_PATH } from "./bpe";
import type { FuzzyRanker } from "./fff";
import { rrf, type Signal, type SignalName } from "./fusion";
import type { VaultGraph } from "./graph";
import { DIRECT_WHY, type Expanded, expand, SIMILAR_WHY, similarityBudget } from "./graphExpand";
import { retrieve, shapeResults } from "./retrieve";
import type { Completion, QueryResult, Ranked } from "./types";
import { nearestTo, type VectorIndex } from "./vectors";

/** A signal a result can carry a rank from: the fused ones, plus BPE, which appends and never fuses. */
export type ResultSignal = SignalName | "bpe";

/** The order signal names are listed in, everywhere they are listed. */
export const SIGNAL_ORDER: readonly ResultSignal[] = ["lexical", "fuzzy", "bpe"];

/** The `why` of a skill BPE appended: the list lacked it and BPE ranked it in its own top k. */
export const BPE_WHY = "matched word pieces of the query (bpe)";

/**
 * Cosine a neighbour has to clear to be worth a result slot. Measured over the committed index,
 * 0.80 admits a median of 4 skills out of 2,133 for a seed that has relatives at all and nothing
 * whatsoever for 27% of seeds, which is the behaviour wanted: an isolated skill expands to nothing
 * rather than to the least distant thing in the vault.
 */
const SIMILARITY_FLOOR = 0.8;

export interface QueryOptions {
  k: number;
  semantic: boolean;
  fuzzy: boolean;
  explain: boolean;
  /** Append skills BPE finds that the result list lacks; absent means off. */
  bpe?: boolean;
}

/** Everything the query reads from outside itself; the loaders run only for enabled signals. */
export interface QueryDeps {
  graph: VaultGraph;
  vectors: () => VectorIndex | null;
  fuzzy: () => FuzzyRanker;
  rrfK: number;
  weights: Record<SignalName, number>;
  /** The trained BPE model (null when untrained) and how many skills it may append. */
  bpe?: { tokenizer: () => Tokenizer | null; extra: number };
}

export interface HybridResult extends QueryResult {
  /** Signal name -> the rank this skill took in that signal's own list. */
  signals: Partial<Record<ResultSignal, number>>;
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
  /** The vector index if one was loaded and semantic expansion is on; null skips the expansion. */
  index: VectorIndex | null;
}

/**
 * Runs every enabled signal over the same query text, each returning 2k candidates, and loads the
 * vector index the expansion will need. A signal that cannot run becomes a notice and drops out of
 * the fusion; the query never fails because of one.
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
        `semantic expansion unavailable: no vector index at ${join(root, EMBED_DIR)}; ` +
          "run 'skillquarium embed' to build it",
      );
    }
  }

  return { signals, notices, index };
}

/**
 * One neighbour per seed, taken in seed order until the budget is full. The seeds are the best
 * answer the model-free signals have, so the skill closest to the best of them is the expansion
 * worth a slot; a seed with nothing above the floor contributes nothing and the next seed gets
 * the slot instead. One per seed rather than several keeps a single dense cluster — scanpy's
 * nearest six are all single-cell skills — from spending the whole budget on restatements.
 *
 * Scores are the raw cosine. Seeds were remapped onto (1, 2] and a cosine cannot reach 1, so a
 * skill that is already a direct hit keeps its direct score and its `why` when its own expansion
 * offers it back.
 */
export function similarToSeeds(index: VectorIndex, seeds: readonly Ranked[], budget: number): Expanded[] {
  const offers: Expanded[] = [];
  if (budget <= 0) return offers;
  const skip = new Set(seeds.map((s) => s.id));
  for (const seed of seeds) {
    const near = nearestTo(index, seed.id, SIMILARITY_FLOOR, skip);
    if (near === null) continue;
    skip.add(near.id);
    // The cosine rides in the why rather than in --explain: it is the only thing that says how
    // close "close" was, and the CLI prints a derived pick's why as its label either way.
    offers.push({
      id: near.id,
      score: near.score,
      why: `${SIMILAR_WHY} ${seed.id} (cosine ${near.score.toFixed(2)})`,
    });
    if (offers.length === budget) break;
  }
  return offers;
}

export interface Augmented {
  /** Skills BPE ranked in its top k that `results` lacks, best first, at most `extra` of them. */
  extras: QueryResult[];
  /** id -> rank in BPE's top k, for every skill it ranked, including ones already in `results`. */
  ranks: Map<string, number>;
  notice: string | null;
}

const NOT_AUGMENTED: Augmented = { extras: [], ranks: new Map(), notice: null };

/**
 * BPE as an addon to the ASCII list, never a replacement: BM25 over the trained model's word
 * pieces, whose top-k hits are appended after `results` only where `results` lacks them. Nothing
 * already in the list moves, so a query with BPE on returns its ASCII answer unchanged as a prefix.
 */
export function augment(
  root: string,
  text: string,
  results: readonly QueryResult[],
  opts: QueryOptions,
  deps: QueryDeps,
): Augmented {
  if (!opts.bpe || deps.bpe === undefined || deps.bpe.extra <= 0) return NOT_AUGMENTED;
  const tokenizer = deps.bpe.tokenizer();
  if (tokenizer === null) {
    return {
      ...NOT_AUGMENTED,
      notice:
        `bpe augmentation unavailable: no model at ${join(root, TOKENIZER_PATH)}; ` +
        "run 'skillquarium tokenizer' to train it",
    };
  }
  const hits = indexFor(deps.graph, tokenizer).topK(text, opts.k);
  const ranks = new Map(hits.map((r) => [r.id, r.rank]));
  const taken = new Set(results.map((r) => r.skill));
  const picks: Expanded[] = [];
  for (const hit of hits) {
    if (picks.length >= deps.bpe.extra) break;
    // Deprecated skills never surface through expansion either; BM25 itself does not filter them.
    if (taken.has(hit.id) || deps.graph.nodes.get(hit.id)?.deprecated) continue;
    picks.push({ id: hit.id, score: hit.score, why: BPE_WHY });
  }
  return { extras: shapeResults(deps.graph, picks), ranks, notice: null };
}

/**
 * Fused seeds through Task 7's graph expansion, plus the vector expansion off the same seeds.
 * Derived picks carry scores in [0.4, 0.6] from the graph and in [0.8, 1) from cosine, while a
 * fused score is about 1/rrfK, so seeds are remapped onto (1, 2] in fused order: any rrfK and any
 * weights then still leave every direct hit above every derived one.
 */
export function expandFused(
  deps: QueryDeps,
  signals: Signal[],
  k: number,
  index: VectorIndex | null,
): { results: QueryResult[]; completions: Completion[]; fused: Ranked[] } {
  const fused = rrf(signals, deps.rrfK, deps.weights);
  const top = fused[0]?.score ?? 1;
  const seeds: Ranked[] = fused.slice(0, k * 2).map((r) => ({ ...r, score: 1 + r.score / top }));
  const similar = index === null ? [] : similarToSeeds(index, seeds, similarityBudget(k));
  const { ranked, completions } = expand(deps.graph, seeds, k, similar);
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
  bpeRanks: Map<string, number>;
  index: VectorIndex | null;
  fused: Map<string, number> | null;
  deps: QueryDeps;
  explain: boolean;
}

function decorate(result: QueryResult, d: Decoration): HybridResult {
  const signals: Partial<Record<ResultSignal, number>> = { ...d.ranks.get(result.skill) };
  const bpeRank = d.bpeRanks.get(result.skill);
  if (bpeRank !== undefined) signals.bpe = bpeRank;
  const hit = SIGNAL_ORDER.filter((name) => signals[name] !== undefined);
  // The why names only the fused signals, which ranked the skill; BPE's rank rides in `signals`.
  const fusedHit = hit.filter((name) => name !== "bpe");
  let why = result.why;
  if (why === DIRECT_WHY && fusedHit.length > 0) why = `${DIRECT_WHY} (${fusedHit.join(", ")})`;
  if (d.explain && hit.length > 0) {
    const parts = hit.map((name) => {
      const rank = signals[name] ?? 0;
      // No fused map means no fusion ran (lexical only), so there is no contribution to report;
      // BPE never enters the fusion, so it has none either.
      if (d.fused === null || name === "bpe") return `${name} #${rank}`;
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
    const { extras, ranks: bpeRanks, notice } = augment(root, text, results, opts, deps);
    const d: Decoration = {
      ranks: ranksById(lexical),
      bpeRanks,
      index: null,
      fused: null,
      deps,
      explain: opts.explain,
    };
    return {
      results: [...results, ...extras].map((r) => decorate(r, d)),
      completions,
      notices: notice === null ? [] : [notice],
    };
  }

  const { signals, notices, index } = await gatherSignals(root, text, opts, deps);
  const { results, completions, fused } = expandFused(deps, signals, opts.k, index);
  const { extras, ranks: bpeRanks, notice } = augment(root, text, results, opts, deps);
  if (notice !== null) notices.push(notice);
  const d: Decoration = {
    ranks: ranksById(signals),
    bpeRanks,
    index,
    fused: new Map(fused.map((r) => [r.id, r.score])),
    deps,
    explain: opts.explain,
  };
  return { results: [...results, ...extras].map((r) => decorate(r, d)), completions, notices };
}
