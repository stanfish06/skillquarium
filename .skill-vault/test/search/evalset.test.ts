import { afterAll, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadConfig } from "../../src/config";
import { type EmbedIndex, type Manifest, readManifest } from "../../src/embed/store";
import { graphPath } from "../../src/kg/write";
import {
  cachedEmbed,
  offlineEmbed,
  type QueryVectors,
  readEvalSet,
  readQueryVectors,
  runEval,
  staleQueryVectors,
} from "../../src/search/evalSet";
import { destroyFinder, type FuzzyRanker, fffRanker } from "../../src/search/fff";
import { loadGraph } from "../../src/search/graph";
import type { QueryDeps, QueryOptions } from "../../src/search/query";
import { loadVectorIndex } from "../../src/search/vectors";

const ROOT = resolve(import.meta.dir, "../../..");
const FIXTURE = resolve(import.meta.dir, "../fixtures/graph.python.json");

const graph = loadGraph(FIXTURE);
const rows = readEvalSet(ROOT);
const OPTS: QueryOptions = { k: 8, semantic: true, fuzzy: false, explain: false };

/**
 * One dimension per eval query. `aligned` puts a 1 at query i on every skill query i expects, so
 * the semantic list for query i is exactly its expected ids; `blind` leaves every row at zero, so
 * the same ids come back in id order no matter what was asked.
 */
function index(aligned: boolean): EmbedIndex {
  const ids = [...new Set(rows.flatMap((r) => r.expect))].sort();
  const vectors = ids.map((id) => {
    const v = new Float32Array(rows.length);
    if (aligned) for (const [i, row] of rows.entries()) if (row.expect.includes(id)) v[i] = 1;
    return v;
  });
  return {
    dim: rows.length,
    ids,
    desc: vectors,
    body: vectors,
    stale: new Set<string>(),
    manifest: { model: "fake", dim: rows.length, skills: {} },
  };
}

function deps(aligned: boolean): QueryDeps {
  const store = index(aligned);
  return {
    graph,
    vectors: () => store,
    embed: () => ({
      embed: async (inputs) =>
        inputs.map((text) => {
          const v = new Float32Array(rows.length);
          const at = rows.findIndex((r) => r.query === text);
          if (at >= 0) v[at] = 1;
          return v;
        }),
      modelName: async () => "fake",
    }),
    fuzzy: () => {
      throw new Error("the file index must not be started");
    },
    rrfK: 60,
    weights: { lexical: 1, fuzzy: 1, semantic: 1 },
  };
}

function scoreOf(scores: { name: string; recall: number; mrr: number }[], name: string) {
  const found = scores.find((s) => s.name === name);
  if (!found) throw new Error(`no ${name} row in the report`);
  return found;
}

test("every skill the eval set expects exists under skills/", () => {
  expect(rows.length).toBe(40);
  const missing = [...new Set(rows.flatMap((r) => r.expect))]
    .sort()
    .filter((id) => !existsSync(join(ROOT, "skills", id, "SKILL.md")));
  expect(missing).toEqual([]);
});

test("every eval query is unique and non-empty", () => {
  expect(new Set(rows.map((r) => r.query)).size).toBe(rows.length);
  for (const row of rows) {
    expect(row.query.length).toBeGreaterThan(0);
    expect(row.expect.length).toBeGreaterThan(0);
  }
});

test("a signal that returns the expected ids scores 1.0, a blind one scores far less", async () => {
  const good = await runEval(ROOT, deps(true), OPTS);
  const bad = await runEval(ROOT, deps(false), OPTS);
  expect(good.queries).toBe(40);
  expect(good.scores.map((s) => s.name)).toEqual(["lexical", "semantic", "fused", "final"]);
  expect(scoreOf(good.scores, "semantic").recall).toBe(1);
  expect(scoreOf(good.scores, "semantic").mrr).toBe(1);
  expect(scoreOf(bad.scores, "semantic").recall).toBeLessThan(0.2);
  // Lexical is the same BM25 both times; only the semantic half of the fusion changed.
  expect(scoreOf(good.scores, "lexical")).toEqual(scoreOf(bad.scores, "lexical"));
  expect(scoreOf(good.scores, "fused").recall).toBeGreaterThan(scoreOf(bad.scores, "fused").recall);
  expect(scoreOf(good.scores, "final").recall).toBeGreaterThan(scoreOf(bad.scores, "final").recall);
});

test("the per-query rows report what the fused pipeline actually returned", async () => {
  const report = await runEval(ROOT, deps(true), OPTS);
  expect(report.rows.length).toBe(40);
  for (const row of report.rows) {
    expect(row.final.length).toBeLessThanOrEqual(OPTS.k);
    expect(row.recall).toBe(row.expect.filter((id) => row.final.includes(id)).length / row.expect.length);
  }
  expect(report.notices).toEqual([]);
});

// --- the offline path: committed query vectors against the committed index ------------------

const manifest = readManifest(ROOT);
const cache = readQueryVectors(ROOT);

test("the cached query vectors cover every eval query and match the committed index", () => {
  expect(manifest).not.toBeNull();
  expect(cache.model).toBe(manifest?.model ?? "");
  expect(cache.dim).toBe(manifest?.dim ?? 0);
  expect(Object.keys(cache.vectors).length).toBe(rows.length);
  for (const row of rows) {
    const vector = cache.vectors[row.query];
    expect(vector?.length).toBe(cache.dim);
  }
});

test("a cache built from another model or width is refused, and says which", () => {
  const index: Manifest = { model: "qwen3-embed-0.6b", dim: 1024, skills: {} };
  const ok: QueryVectors = { model: "qwen3-embed-0.6b", dim: 1024, vectors: { a: [1] } };
  expect(staleQueryVectors(ok, index)).toBeNull();

  expect(staleQueryVectors({ ...ok, model: "other-model" }, index)).toMatch(
    /stale: model 'other-model' but the index is 'qwen3-embed-0.6b'/,
  );
  expect(staleQueryVectors({ ...ok, dim: 768 }, index)).toMatch(/stale: dim 768 but the index is 1024/);
  expect(staleQueryVectors(ok, null)).toMatch(/no index manifest/);

  expect(() => cachedEmbed({ ...ok, model: "other-model" }, index)).toThrow(/stale: model/);
  expect(() => cachedEmbed({ ...ok, dim: 768 }, index)).toThrow(/stale: dim/);
  expect(() => cachedEmbed(ok, null)).toThrow(/no index manifest/);
});

test("the cache refuses a query it has no row for rather than scoring it as a miss", async () => {
  const client = cachedEmbed(cache, manifest);
  await expect(client.embed(["a query nobody embedded"])).rejects.toThrow(
    /no row for "a query nobody embedded"/,
  );
});

/**
 * Pinned from the offline sweep over the real graph and the committed index. These are the numbers
 * `query --eval` prints for config.json's weights, so a change to the weights, the index, the eval
 * set or any signal has to restate them here deliberately.
 */
const PINNED = {
  lexical: { recall: 0.804, mrr: 0.735 },
  semantic: { recall: 0.904, mrr: 0.774 },
  withFuzzy: { fused: { recall: 0.892, mrr: 0.815 }, final: { recall: 0.871, mrr: 0.81 } },
  withoutFuzzy: { fused: { recall: 0.879, mrr: 0.806 }, final: { recall: 0.858, mrr: 0.801 } },
};

let ranker: FuzzyRanker | undefined;
afterAll(() => destroyFinder(ROOT));

test("the offline eval reproduces the committed scores for the configured weights", async () => {
  const cfg = await loadConfig(ROOT);
  expect(cfg.query.weights).toEqual({ lexical: 1, fuzzy: 1, semantic: 2.5 });
  const index = loadVectorIndex(ROOT);
  expect(index).not.toBeNull();
  if (index === null) return;

  const vaultDeps: QueryDeps = {
    graph: loadGraph(graphPath(ROOT)),
    vectors: () => index,
    embed: () => {
      throw new Error("the offline eval must not reach the endpoint");
    },
    fuzzy: () => {
      ranker ??= fffRanker(ROOT);
      return ranker;
    },
    rrfK: cfg.query.rrfK,
    weights: cfg.query.weights,
  };
  const opts: QueryOptions = { k: cfg.query.k, semantic: true, fuzzy: true, explain: false };
  const report = await runEval(ROOT, vaultDeps, opts, offlineEmbed(ROOT));

  expect(report.queries).toBe(40);
  for (const [name, want] of [
    ["lexical", PINNED.lexical],
    ["semantic", PINNED.semantic],
  ] as const) {
    expect(scoreOf(report.scores, name).recall).toBeCloseTo(want.recall, 3);
    expect(scoreOf(report.scores, name).mrr).toBeCloseTo(want.mrr, 3);
  }

  // The fff index is a native binary. Where it cannot run the signal drops out with a notice and
  // the fusion is lexical + semantic only, which is pinned separately rather than skipped.
  const ran = report.notices.length === 0;
  const want = ran ? PINNED.withFuzzy : PINNED.withoutFuzzy;
  for (const name of ["fused", "final"] as const) {
    expect(scoreOf(report.scores, name).recall).toBeCloseTo(want[name].recall, 3);
    expect(scoreOf(report.scores, name).mrr).toBeCloseTo(want[name].mrr, 3);
  }

  // The tuned weights have to stay ahead of the {1,1,1} default they replaced: final MRR 0.723.
  expect(scoreOf(report.scores, "final").mrr).toBeGreaterThan(0.78);
});
