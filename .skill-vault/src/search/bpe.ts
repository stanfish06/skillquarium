// BPE encoder for the tokenizer.json skill-tokenizer writes. Reproduces its pipeline:
// Strip -> StripAccents -> Lowercase -> NFC, WhitespaceSplit, then rank-ordered BPE merges.
// Training is the Rust binary's job (`skillquarium tokenizer`); encoding runs here so a query
// never spawns a process.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { Tokenizer } from "./bm25";

/** Trained model location under the vault root; committed, like vault/embeddings. */
export const TOKENIZER_PATH = "vault/tokenizer/tokenizer.json";

const TokenizerJson = z.object({
  normalizer: z.unknown(),
  pre_tokenizer: z.object({ type: z.literal("WhitespaceSplit") }),
  model: z.object({
    type: z.literal("BPE"),
    unk_token: z.string().nullable(),
    continuing_subword_prefix: z.string().nullable().optional(),
    end_of_word_suffix: z.string().nullable().optional(),
    ignore_merges: z.boolean().optional(),
    vocab: z.record(z.string(), z.number()),
    // Older tokenizers serialize merges as "a b", newer as ["a", "b"].
    merges: z.array(z.union([z.string(), z.tuple([z.string(), z.string()])])),
  }),
});

export class Bpe {
  private readonly vocab: Map<string, number>;
  private readonly tokens: string[] = [];
  /** left id * width + right id -> [rank, merged id]. */
  private readonly merges = new Map<number, [number, number]>();
  private readonly width: number;
  private readonly unk: number | null;
  private readonly ignoreMerges: boolean;
  private readonly cache = new Map<string, string[]>();

  constructor(json: unknown) {
    const t = TokenizerJson.parse(json);
    if (t.model.continuing_subword_prefix || t.model.end_of_word_suffix) {
      throw new Error("bpe: subword prefix/suffix is not supported");
    }
    // Read the vocab off the raw parse, not zod's output: zod rebuilds records as plain objects,
    // where assigning a "__proto__" key sets the prototype and drops the token.
    this.vocab = new Map(Object.entries((json as { model: { vocab: Record<string, number> } }).model.vocab));
    for (const [token, id] of this.vocab) this.tokens[id] = token;
    this.width = this.tokens.length;
    this.unk = t.model.unk_token === null ? null : (this.vocab.get(t.model.unk_token) ?? null);
    this.ignoreMerges = t.model.ignore_merges ?? false;
    for (const [rank, m] of t.model.merges.entries()) {
      const [a, b] = typeof m === "string" ? splitMerge(m) : m;
      const left = this.vocab.get(a);
      const right = this.vocab.get(b);
      const merged = this.vocab.get(a + b);
      if (left === undefined || right === undefined || merged === undefined) {
        throw new Error(`bpe: merge "${a} ${b}" names a token outside the vocab`);
      }
      this.merges.set(left * this.width + right, [rank, merged]);
    }
  }

  static load(path: string): Bpe {
    return new Bpe(JSON.parse(readFileSync(path, "utf8")));
  }

  /** Tokens for `text`, no special tokens: the same pieces `skill-tokenizer encode` prints between [CLS] and [SEP]. */
  encode(text: string): string[] {
    const out: string[] = [];
    for (const word of normalize(text).split(/\s+/u)) {
      if (word !== "") out.push(...this.word(word));
    }
    return out;
  }

  private word(word: string): string[] {
    const hit = this.cache.get(word);
    if (hit !== undefined) return hit;
    let pieces: string[];
    if (this.ignoreMerges && this.vocab.has(word)) pieces = [word];
    else pieces = this.merge(this.chars(word)).map((id) => this.tokens[id] ?? "");
    this.cache.set(word, pieces);
    return pieces;
  }

  // Characters outside the vocab become the unk id; consecutive ones are not fused.
  private chars(word: string): number[] {
    const out: number[] = [];
    for (const ch of word) {
      const id = this.vocab.get(ch) ?? this.unk;
      if (id !== null) out.push(id);
    }
    return out;
  }

  // Repeatedly merge the lowest-ranked adjacent pair, leftmost first, as HF's BPE does.
  private merge(parts: number[]): number[] {
    while (parts.length > 1) {
      let best = Number.POSITIVE_INFINITY;
      let at = -1;
      let into = -1;
      for (let i = 0; i < parts.length - 1; i++) {
        const m = this.merges.get((parts[i] ?? 0) * this.width + (parts[i + 1] ?? 0));
        if (m !== undefined && m[0] < best) {
          best = m[0];
          at = i;
          into = m[1];
        }
      }
      if (at < 0) break;
      parts.splice(at, 2, into);
    }
    return parts;
  }
}

function splitMerge(m: string): [string, string] {
  const i = m.indexOf(" ");
  return [m.slice(0, i), m.slice(i + 1)];
}

/** Strip, StripAccents (drops combining marks already present), Lowercase, NFC — in that order. */
export function normalize(text: string): string {
  return text
    .trim()
    .replace(/\p{Mn}/gu, "")
    .toLowerCase()
    .normalize("NFC");
}

/** The committed BPE model as a BM25 tokenizer, or null when it has not been trained yet. */
export function loadBpeTokenizer(root: string): Tokenizer | null {
  const path = join(root, TOKENIZER_PATH);
  if (!existsSync(path)) return null;
  const bpe = Bpe.load(path);
  return { name: "bpe", encode: (text) => bpe.encode(text ?? "") };
}
