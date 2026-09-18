// Semantic expansion: cosine between two skills' stored vectors. Nothing here embeds text, so the
// endpoint is a build-time dependency of `skillquarium embed` and never a query-time one.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { EMBED_DIR, type EmbedIndex, readIndex } from "../embed/store";

export type VectorIndex = EmbedIndex;

/** null when vault/embeddings/ has not been built; `stale` carries the ids whose SKILL.md moved on. */
export function loadVectorIndex(root: string): VectorIndex | null {
  if (!existsSync(join(root, EMBED_DIR))) return null;
  return readIndex(root);
}

function dot(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] ?? 0) * (b[i] ?? 0);
  return sum;
}

export interface Neighbour {
  id: string;
  /** Cosine against the seed, at or above the floor it was found with. */
  score: number;
}

/**
 * The closest skill to `seed` that `skip` does not already hold, or null when nothing clears
 * `floor` — which is the common case for a skill with no near relatives, and the point of the
 * floor. Two skills are compared row for row, description against description and body against
 * body, and score as their better half: the descriptions agree on what a pair of skills is for,
 * the bodies on what they actually do, and 13% of seeds get a different nearest neighbour from
 * the body rows than from the descriptions. Rows are L2-normalized on write, so a dot is a cosine.
 *
 * Ties break on id, so re-embedding a skill cannot reorder an answer by moving rows around.
 */
export function nearestTo(
  index: VectorIndex,
  seed: string,
  floor: number,
  skip: ReadonlySet<string>,
): Neighbour | null {
  const at = index.ids.indexOf(seed);
  if (at < 0) return null;
  const seedDesc = index.desc[at];
  const seedBody = index.body[at];
  if (!seedDesc || !seedBody) return null;
  let best: Neighbour | null = null;
  for (const [i, id] of index.ids.entries()) {
    if (i === at || skip.has(id)) continue;
    const desc = index.desc[i];
    const body = index.body[i];
    const score = Math.max(desc ? dot(seedDesc, desc) : -1, body ? dot(seedBody, body) : -1);
    if (score < floor) continue;
    if (best === null || score > best.score || (score === best.score && id < best.id)) {
      best = { id, score };
    }
  }
  return best;
}
