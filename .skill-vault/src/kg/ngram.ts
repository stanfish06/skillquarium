// Name matching for build_kg.py, plus the Python ordering primitives the extraction layer shares.
import { PY_WS } from "../catalog/pytext";

// Re-exported so the kg modules take their `\s` class from one place; catalog/index.ts does not
// carry it yet.
export { PY_WS };

/** Longest skill id is 7 words; 5 covers all but a long tail cheaply. */
export const MAX_NGRAM = 5;

// build_kg.py WORD. Deliberately lower-case only: ids and curated aliases are already folded.
const WORD = /[a-z0-9]+/g;

/** Python `str[:n]`: n code points, not UTF-16 units, so astral chars count once. */
export function sliceCodePoints(text: string, n: number): string {
  let i = 0;
  for (let count = 0; i < text.length && count < n; count++) {
    const high = text.charCodeAt(i);
    const low = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
    i += high >= 0xd800 && high <= 0xdbff && low >= 0xdc00 && low <= 0xdfff ? 2 : 1;
  }
  return text.slice(0, i);
}

const SURROGATE = /[\uD800-\uDFFF]/;

/** Python `sorted()` on str: code point order, which differs from JS `<` only for astral chars. */
export function pyCompare(a: string, b: string): number {
  if (SURROGATE.test(a) || SURROGATE.test(b)) {
    const x = [...a];
    const y = [...b];
    for (let i = 0; i < x.length && i < y.length; i++) {
      const ca = x[i]?.codePointAt(0) ?? 0;
      const cb = y[i]?.codePointAt(0) ?? 0;
      if (ca !== cb) return ca - cb;
    }
    return x.length - y.length;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Python `sorted(iterable)` over strings. */
export function pySorted(values: Iterable<string>): string[] {
  return [...values].sort(pyCompare);
}

/**
 * Word-tuple -> target index from (term, target) pairs; terms over MAX_NGRAM words are
 * unreachable and dropped. `exact` also drops any term that is not its own words joined by
 * '-', which is how a skill id must be spelled to count as a hit.
 */
export function ngramIndex(pairs: Iterable<readonly [string, string]>, exact = false): Map<string, string> {
  const index = new Map<string, string>();
  for (const [term, target] of pairs) {
    const toks = term.match(WORD);
    if (!toks || toks.length > MAX_NGRAM) continue;
    if (exact && toks.join("-") !== term) continue;
    index.set(toks.join(" "), target);
  }
  return index;
}

/**
 * Targets named anywhere in `text`, by sweeping its word n-grams against `index`.
 * Inverted so this is O(len(text)) per document rather than one regex scan per term.
 */
export function ngramHits(text: string, index: Map<string, string>): Set<string> {
  const toks = text.toLowerCase().match(WORD) ?? [];
  const hits = new Set<string>();
  for (let i = 0; i < toks.length; i++) {
    let key = "";
    for (let k = 0; k < MAX_NGRAM && i + k < toks.length; k++) {
      key = k === 0 ? (toks[i] ?? "") : `${key} ${toks[i + k] ?? ""}`;
      const target = index.get(key);
      if (target !== undefined) hits.add(target);
    }
  }
  return hits;
}

// Contexts a generic id cannot reach by being ordinary English: backticked, canonical path,
// markdown link text, slash-command form.
const MENTION_PATTERNS = [
  /`([a-z0-9][a-z0-9./-]*)`/gi,
  /skills\/([a-z0-9][a-z0-9./-]*)\/SKILL\.md/gi,
  /\[([a-z0-9][a-z0-9./-]*)\]\(/gi,
  new RegExp(`/([a-z0-9][a-z0-9./-]*)\\b(?=[${PY_WS}]|$)`, "gi"),
];

/** Skill ids named in a context that cannot be incidental prose. */
export function highPrecisionMentions(text: string, nameset: ReadonlySet<string>): Set<string> {
  const hits = new Set<string>();
  for (const pattern of MENTION_PATTERNS) {
    for (const m of text.matchAll(pattern)) {
      const cand = (m[1] ?? "").toLowerCase().replace(/\/+$/, "");
      if (nameset.has(cand)) hits.add(cand);
    }
  }
  return hits;
}
