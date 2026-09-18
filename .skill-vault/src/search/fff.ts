// Fuzzy path signal: the fff native index over skills/, ranked by how well a path matches the query.
import { join } from "node:path";
import { FileFinder, type FileFinderApi } from "@ff-labs/fff-bun";
import { isUiUxProMaxSkill } from "../catalog";
import type { Ranked } from "./types";

const SCAN_TIMEOUT_MS = 10_000;

/**
 * Lowest fff score per query character a hit has to reach. A path that really is the query's
 * name scores 10-16 per character; a sentence scores under 3, because its letters are found
 * scattered over unrelated paths, and without the floor those fill the whole signal with noise.
 * What is left is what path search is for: a query that names a skill, spelled approximately.
 */
const MIN_SCORE_PER_CHAR = 10;

/** Skill folders are dash-joined, so a dashed query can match one contiguously. */
function pathQuery(query: string): string {
  return query.trim().replace(/\s+/g, "-");
}

export interface Finder {
  api: FileFinderApi | null;
  /** Why the index is unusable (missing native binary, scan timeout), or null. */
  problem: string | null;
}

const started = new Map<string, Promise<Finder>>();

async function start(root: string): Promise<Finder> {
  const created = FileFinder.create({
    basePath: join(root, "skills"),
    disableWatch: true,
    disableMmapCache: true,
  });
  if (!created.ok) return { api: null, problem: created.error };
  const scanned = await created.value.waitForScan(SCAN_TIMEOUT_MS);
  if (!scanned.ok) {
    created.value.destroy();
    return { api: null, problem: scanned.error };
  }
  return { api: created.value, problem: null };
}

/** One finder per root for the life of the process: the initial scan is paid once. */
export function finderFor(root: string): Promise<Finder> {
  let pending = started.get(root);
  if (pending === undefined) {
    pending = start(root);
    started.set(root, pending);
  }
  return pending;
}

/** Frees the native index; the scan threads keep the process alive until this runs. */
export async function destroyFinder(root: string): Promise<void> {
  const pending = started.get(root);
  if (pending === undefined) return;
  started.delete(root);
  const { api } = await pending;
  if (api && !api.isDestroyed) api.destroy();
}

export interface FuzzyRanker {
  fuzzyRank(query: string, n: number): Promise<Ranked[]>;
  /** Set by a call that could not search; the caller turns it into a notice instead of failing. */
  problem(): string | null;
  destroy(): Promise<void>;
}

/** Folders the catalog hides: the optional UI/UX extra and the gstack scratch copies. */
function transient(id: string): boolean {
  return id.startsWith("gstack-") || id.startsWith("_gstack") || isUiUxProMaxSkill(id);
}

export function fffRanker(root: string): FuzzyRanker {
  let problem: string | null = null;
  return {
    problem: () => problem,
    destroy: () => destroyFinder(root),
    async fuzzyRank(query, n) {
      const finder = await finderFor(root);
      problem = finder.problem;
      if (finder.api === null) return [];
      const text = pathQuery(query);
      if (text === "") return [];
      // Hits are per file and a skill folder holds many, so one page has to be far wider than n.
      const found = finder.api.fileSearch(text, { pageSize: Math.max(200, n * 25) });
      if (!found.ok) {
        problem = found.error;
        return [];
      }
      const floor = MIN_SCORE_PER_CHAR * text.length;
      const best = new Map<string, number>();
      for (const [i, item] of found.value.items.entries()) {
        const score = found.value.scores[i]?.total ?? 0;
        // Items arrive best first, so the first one under the floor ends the page.
        if (score < floor) break;
        // First path segment only, so a hit inside a bundle scores the bundle and the
        // `<bundle>/<child>` ids the catalog registers never appear here.
        const id = item.relativePath.split("/")[0];
        if (id === undefined || id === "" || transient(id)) continue;
        // The first sighting of an id carries its best rank.
        if (!best.has(id)) best.set(id, score);
        if (best.size >= n) break;
      }
      return [...best].map(([id, score], i) => ({ id, score, rank: i + 1 }));
    },
  };
}
