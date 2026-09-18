// Stage B of query.py: BM25 over id + description + domain labels + aliases.
import { pyCompare } from "../kg/ngram";
import { stripPrefix, targets, type VaultGraph } from "./graph";
import type { Ranked } from "./types";

const WORD = /[a-z0-9]+/g;

/** query.py tok(): ASCII word tokens of the lowercased text. */
export function tok(text: string | null | undefined): string[] {
  return (text ?? "").toLowerCase().match(WORD) ?? [];
}

/** Text to BM25 terms. Documents and queries go through the same one, or nothing matches. */
export interface Tokenizer {
  readonly name: string;
  encode(text: string | null | undefined): string[];
}

/** query.py's tokenizer; the lexical golden is pinned to it. */
export const ASCII: Tokenizer = { name: "ascii", encode: tok };

/**
 * Term frequencies are counted once at construction, not per query: score() runs for every
 * skill on every query, and recounting each document there was the whole cost.
 */
export class Bm25Index {
  private readonly graph: VaultGraph;
  private readonly tokenizer: Tokenizer;
  private readonly tf = new Map<string, Map<string, number>>();
  private readonly dl = new Map<string, number>();
  private readonly df = new Map<string, number>();
  readonly n: number;
  readonly avglen: number;

  constructor(graph: VaultGraph, tokenizer: Tokenizer = ASCII) {
    this.graph = graph;
    this.tokenizer = tokenizer;
    const t = (text: string | null | undefined) => tokenizer.encode(text);
    let totalLength = 0;
    for (const sid of graph.skills) {
      const node = graph.nodes.get(sid);
      if (node === undefined) continue;
      const domains = [...targets(graph.out, "in_domain", sid)]
        .map((d) => stripPrefix(d).replaceAll("-", " "))
        .join(" ");
      // The id tokens repeated 3x are the field weighting: a name hit outweighs a prose hit.
      const idWords = t(sid.replaceAll("-", " "));
      const words = [
        ...idWords,
        ...idWords,
        ...idWords,
        ...t(node.description),
        ...t(domains),
        ...t((node.aliases ?? []).join(" ")),
      ];
      const counts = new Map<string, number>();
      for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
      this.tf.set(sid, counts);
      this.dl.set(sid, words.length);
      totalLength += words.length;
      for (const word of counts.keys()) this.df.set(word, (this.df.get(word) ?? 0) + 1);
    }
    this.n = graph.skills.length;
    this.avglen = totalLength / Math.max(1, this.n);
  }

  /** Query terms are scored in order, duplicates included, to match the Python summation. */
  score(qwords: readonly string[], sid: string, k1 = 1.5, b = 0.75): number {
    const tf = this.tf.get(sid);
    const dl = this.dl.get(sid) ?? 0;
    if (tf === undefined || dl === 0) return 0;
    let score = 0;
    for (const word of qwords) {
      const f = tf.get(word);
      if (f === undefined || f === 0) continue;
      const df = this.df.get(word) ?? 0;
      const idf = Math.log(1 + (this.n - df + 0.5) / (df + 0.5));
      score += (idf * (f * (k1 + 1))) / (f + k1 * (1 - b + (b * dl) / this.avglen));
    }
    return score;
  }

  /**
   * The k best-scoring skills, positives only. The success-rate prior is applied after the
   * cut, exactly as in query.py, so it reweights seeds without changing which ones are seeds.
   */
  topK(query: string, k: number): Ranked[] {
    const qwords = this.tokenizer.encode(query);
    const scored = this.graph.skills.map((id) => ({ id, score: this.score(qwords, id) }));
    // Python sorts (score, id) tuples with reverse=True: score descending, then id descending.
    scored.sort((a, b) => (a.score === b.score ? -pyCompare(a.id, b.id) : a.score < b.score ? 1 : -1));
    const top: Ranked[] = [];
    for (const { id, score } of scored.slice(0, k)) {
      if (score <= 0) continue;
      const prior = 1 + (this.graph.nodes.get(id)?.success_rate ?? 0) * 0.5;
      top.push({ id, score: score * prior, rank: top.length + 1 });
    }
    return top;
  }
}

const indexes = new WeakMap<VaultGraph, Map<Tokenizer, Bm25Index>>();

/** One index per graph and tokenizer: query.py builds it inside VaultGraph.__init__. */
export function indexFor(graph: VaultGraph, tokenizer: Tokenizer = ASCII): Bm25Index {
  let byTokenizer = indexes.get(graph);
  if (byTokenizer === undefined) {
    byTokenizer = new Map();
    indexes.set(graph, byTokenizer);
  }
  let index = byTokenizer.get(tokenizer);
  if (index === undefined) {
    index = new Bm25Index(graph, tokenizer);
    byTokenizer.set(tokenizer, index);
  }
  return index;
}
