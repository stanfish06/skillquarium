import { afterAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadConfig } from "../../src/config";
import { HASH_VERSION } from "../../src/embed/hash";
import type { EmbedIndex } from "../../src/embed/store";
import { graphPath } from "../../src/kg/write";
import type { Tokenizer } from "../../src/search/bm25";
import { Bpe } from "../../src/search/bpe";
import { readEvalSet, runEval } from "../../src/search/evalSet";
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
 * two skills the same query expects sit on top of each other and each is the other's nearest
 * neighbour; `blind` points every skill the same way, so every skill is equally close to every
 * other and the expansion picks whichever id sorts first.
 */
function index(aligned: boolean): EmbedIndex {
  const ids = [...new Set(rows.flatMap((r) => r.expect))].sort();
  const vectors = ids.map((id) => {
    const v = new Float32Array(rows.length);
    if (!aligned) {
      v[0] = 1;
      return v;
    }
    let hits = 0;
    for (const [i, row] of rows.entries()) {
      if (!row.expect.includes(id)) continue;
      v[i] = 1;
      hits += 1;
    }
    // L2-normalized the way the committed rows are, so a dot product is the cosine.
    if (hits > 1) for (let i = 0; i < v.length; i++) v[i] = (v[i] ?? 0) / Math.sqrt(hits);
    return v;
  });
  return {
    dim: rows.length,
    ids,
    desc: vectors,
    body: vectors,
    stale: new Set<string>(),
    manifest: { model: "fake", dim: rows.length, hashVersion: HASH_VERSION, skills: {} },
  };
}

function deps(store: EmbedIndex | null): QueryDeps {
  return {
    graph,
    vectors: () => store,
    fuzzy: () => {
      throw new Error("the file index must not be started");
    },
    rrfK: 60,
    weights: { lexical: 1, fuzzy: 1 },
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

test("bpe adds a +bpe row and a same-length ascii control, both past the k-length rows", async () => {
  const bpe = Bpe.load(resolve(import.meta.dir, "../fixtures/tokenizer/tokenizer.json"));
  const tokenizer: Tokenizer = { name: "bpe", encode: (t) => bpe.encode(t ?? "") };
  const on = { ...OPTS, bpe: true };
  const report = await runEval(
    ROOT,
    { ...deps(index(true)), bpe: { tokenizer: () => tokenizer, extra: 3 } },
    on,
  );
  expect(report.augmented).toBe(11);
  expect(report.scores.map((s) => s.name)).toEqual([
    "lexical",
    "fused",
    "modelfree",
    "semantic",
    "+bpe",
    "ascii@11",
  ]);
  // +bpe only appends to the semantic list, so it can only gain recall over it.
  expect(scoreOf(report.scores, "+bpe").recall).toBeGreaterThanOrEqual(
    scoreOf(report.scores, "semantic").recall,
  );
  expect(scoreOf(report.scores, "+bpe").mrr).toBeGreaterThanOrEqual(scoreOf(report.scores, "semantic").mrr);

  const untrained = await runEval(
    ROOT,
    { ...deps(index(true)), bpe: { tokenizer: () => null, extra: 3 } },
    on,
  );
  expect(untrained.augmented).toBeNull();
  expect(untrained.scores.map((s) => s.name)).toEqual(["lexical", "fused", "modelfree", "semantic"]);
  expect(untrained.notices.some((n) => n.includes("bpe augmentation unavailable"))).toBe(true);
});

test("an index that groups the expected skills beats the model-free baseline, a blind one does not", async () => {
  const good = await runEval(ROOT, deps(index(true)), OPTS);
  const bad = await runEval(ROOT, deps(index(false)), OPTS);
  expect(good.queries).toBe(40);
  expect(good.scores.map((s) => s.name)).toEqual(["lexical", "fused", "modelfree", "semantic"]);
  // The baseline never opens the index, so it is the same list both times.
  expect(scoreOf(good.scores, "modelfree")).toEqual(scoreOf(bad.scores, "modelfree"));
  expect(scoreOf(good.scores, "lexical")).toEqual(scoreOf(bad.scores, "lexical"));
  expect(scoreOf(good.scores, "semantic").recall).toBeGreaterThan(scoreOf(good.scores, "modelfree").recall);
  expect(scoreOf(bad.scores, "semantic").recall).toBeLessThan(scoreOf(good.scores, "semantic").recall);
});

test("no index at all is one notice and the model-free numbers, not a failure", async () => {
  const report = await runEval(ROOT, deps(null), OPTS);
  expect(report.notices.length).toBe(1);
  expect(report.notices[0]).toContain("vault/embeddings");
  const bare = scoreOf(report.scores, "modelfree");
  const expanded = scoreOf(report.scores, "semantic");
  expect([expanded.recall, expanded.mrr]).toEqual([bare.recall, bare.mrr]);
});

test("the per-query rows report what the pipeline actually returned", async () => {
  const report = await runEval(ROOT, deps(index(true)), OPTS);
  expect(report.rows.length).toBe(40);
  for (const row of report.rows) {
    expect(row.final.length).toBeLessThanOrEqual(OPTS.k);
    expect(row.recall).toBe(row.expect.filter((id) => row.final.includes(id)).length / row.expect.length);
  }
  expect(report.notices).toEqual([]);
});

// --- the offline path: the committed index, no endpoint anywhere ----------------------------

/**
 * Pinned from the offline sweep over the real graph and the committed index. `modelfree` is
 * lexical + fuzzy fused and graph-expanded; `semantic` is that plus the similarity expansion, so
 * the pair is the measured value of the expansion: +0.038 recall for +0.003 MRR. The
 * query-embedding pipeline this replaced scored 0.871 / 0.808 here and this design does not reach
 * it — the eval set is all prose, which is exactly what embedding the query text was good at.
 */
const PINNED = {
  lexical: { recall: 0.804, mrr: 0.7348 },
  withFuzzy: {
    fused: { recall: 0.804, mrr: 0.7036 },
    modelfree: { recall: 0.8083, mrr: 0.6905 },
    semantic: { recall: 0.8458, mrr: 0.6932 },
  },
  withoutFuzzy: {
    fused: { recall: 0.804, mrr: 0.7348 },
    modelfree: { recall: 0.8083, mrr: 0.7217 },
    semantic: { recall: 0.8458, mrr: 0.7244 },
  },
};

let ranker: FuzzyRanker | undefined;
// Module scope, not inside the gated block: a hook registered in a skipped describe is reported as
// an extra skipped test. destroyFinder is a no-op when no finder was started.
afterAll(() => destroyFinder(ROOT));

/**
 * Not assertable on an arbitrary checkout. `lexical`, `modelfree` and `semantic` with fuzzy off
 * read committed artifacts only and reproduce exactly anywhere. The fuzzy signal does not: it
 * indexes every file under skills/, so an installed extra (gstack, ui-ux-pro-max) adds paths and
 * so does local toggle state, since disabling a skill writes an agents/openai.yaml. Worse, the fff
 * scan keeps warming after waitForScan returns — "structural code search" matches nothing on a
 * cold index and matches foldseek-structural-search on a warm one, which is worth 0.013 MRR — so
 * the withFuzzy trio is only stable for a process that queries it the way the CLI does. The pins
 * were taken on the 2,133-skill corpus with 1,411 skills disabled.
 *
 * Run as SKILLQUARIUM_PARITY=1 bun test test/search/evalset on that corpus when touching the
 * weights, the index, the eval set, the similarity floor or any signal. Re-pinning to a machine's
 * own numbers verifies nothing, so the drift stays visible here instead.
 */
describe.skipIf(!process.env.SKILLQUARIUM_PARITY)("the pinned offline eval", () => {
  test("the offline eval reproduces the committed scores for the configured weights", async () => {
    const cfg = await loadConfig(ROOT);
    expect(cfg.query.weights).toEqual({ lexical: 1, fuzzy: 1 });
    const store = loadVectorIndex(ROOT);
    expect(store).not.toBeNull();
    if (store === null) return;

    const vaultDeps: QueryDeps = {
      graph: loadGraph(graphPath(ROOT)),
      vectors: () => store,
      fuzzy: () => {
        ranker ??= fffRanker(ROOT);
        return ranker;
      },
      rrfK: cfg.query.rrfK,
      weights: cfg.query.weights,
    };
    const opts: QueryOptions = { k: cfg.query.k, semantic: true, fuzzy: true, explain: false };
    const report = await runEval(ROOT, vaultDeps, opts);

    expect(report.queries).toBe(40);
    expect(scoreOf(report.scores, "lexical").recall).toBeCloseTo(PINNED.lexical.recall, 3);
    expect(scoreOf(report.scores, "lexical").mrr).toBeCloseTo(PINNED.lexical.mrr, 3);

    // The fff index is a native binary. Where it cannot run the signal drops out with a notice and
    // the fusion is lexical only, which is pinned separately rather than skipped.
    const ran = report.notices.length === 0;
    const want = ran ? PINNED.withFuzzy : PINNED.withoutFuzzy;
    for (const name of ["fused", "modelfree", "semantic"] as const) {
      expect(scoreOf(report.scores, name).recall).toBeCloseTo(want[name].recall, 3);
      expect(scoreOf(report.scores, name).mrr).toBeCloseTo(want[name].mrr, 3);
    }

    // The expansion has to earn its slot: it may cost MRR, but not recall.
    expect(scoreOf(report.scores, "semantic").recall).toBeGreaterThan(
      scoreOf(report.scores, "modelfree").recall,
    );
  });
});
