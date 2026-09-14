// Semantic signal: cosine similarity against the committed float16 index.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { EMBED_DIR, type EmbedIndex, readIndex } from "../embed/store";
import type { Ranked } from "./types";

export type VectorIndex = EmbedIndex;

/** null when vault/embeddings/ has not been built; `stale` carries the ids whose SKILL.md moved on. */
export function loadVectorIndex(root: string): VectorIndex | null {
  if (!existsSync(join(root, EMBED_DIR))) return null;
  return readIndex(root);
}

function dot(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += (a[i] ?? 0) * (b[i] ?? 0);
  return sum;
}

/**
 * Each skill scores as its better half: the description row answers a query that names the
 * skill's subject, the body row one that names something only the instructions mention. Rows are
 * L2-normalized on write, so a dot product is the cosine.
 */
export function semanticRank(index: VectorIndex, queryVec: Float32Array, n: number): Ranked[] {
  const scored = index.ids.map((id, i) => {
    const desc = index.desc[i];
    const body = index.body[i];
    return {
      id,
      score: Math.max(desc ? dot(desc, queryVec) : -1, body ? dot(body, queryVec) : -1),
    };
  });
  scored.sort((a, b) => (a.score === b.score ? (a.id < b.id ? -1 : 1) : b.score - a.score));
  return scored.slice(0, n).map(({ id, score }, i) => ({ id, score, rank: i + 1 }));
}
