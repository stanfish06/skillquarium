import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { EmbedIndex } from "../../src/embed/store";
import type { FuzzyRanker } from "../../src/search/fff";
import { loadGraph } from "../../src/search/graph";
import { DIRECT_WHY } from "../../src/search/graphExpand";
import { type QueryDeps, type QueryOptions, runQuery } from "../../src/search/query";
import { retrieve } from "../../src/search/retrieve";
import type { QueryResult, Ranked } from "../../src/search/types";

const FIXTURE = resolve(import.meta.dir, "../fixtures/graph.python.json");
const GOLDEN = resolve(import.meta.dir, "../fixtures/query-lexical.golden.json");
/** No vault on disk is needed: every dependency is injected, root only names the index path. */
const ROOT = "/nonexistent-vault";

const graph = loadGraph(FIXTURE);
const golden = JSON.parse(readFileSync(GOLDEN, "utf8")) as Record<string, string[]>;
const queries = Object.keys(golden);
const PROBE = "batch correct single cell data and find markers";

function opts(over: Partial<QueryOptions> = {}): QueryOptions {
  return { k: 8, semantic: false, fuzzy: false, explain: false, ...over };
}

function deps(over: Partial<QueryDeps> = {}): QueryDeps {
  return {
    graph,
    vectors: () => null,
    embed: () => {
      throw new Error("the embedding endpoint must not be reached");
    },
    fuzzy: () => {
      throw new Error("the file index must not be started");
    },
    rrfK: 60,
    weights: { lexical: 1, fuzzy: 1, semantic: 1 },
    ...over,
  };
}

/**
 * A two-dimensional index: `lifted` points along the query vector and everything else is
 * orthogonal to it, so the semantic list is `lifted` first and the rest in id order.
 */
function fakeIndex(lifted: string, others: string[], stale: string[] = []): EmbedIndex {
  const ids = [lifted, ...others];
  const rows = ids.map((id) => Float32Array.from(id === lifted ? [1, 0] : [0, 1]));
  return {
    dim: 2,
    ids,
    desc: rows,
    body: rows,
    stale: new Set(stale),
    manifest: { model: "fake", dim: 2, skills: {} },
  };
}

const QUERY_VECTOR = Float32Array.from([1, 0]);

function fakeEmbed(): QueryDeps["embed"] {
  return () => ({
    embed: async () => [QUERY_VECTOR],
    modelName: async () => "fake",
  });
}

function fakeFuzzy(results: Ranked[], problem: string | null = null): QueryDeps["fuzzy"] {
  const ranker: FuzzyRanker = {
    fuzzyRank: async () => results,
    problem: () => problem,
    destroy: async () => {},
  };
  return () => ranker;
}

/** The query.py fields only: `why` carries the signal suffix and is compared separately. */
function shape(r: QueryResult): Omit<QueryResult, "why"> {
  return {
    skill: r.skill,
    score: r.score,
    description: r.description,
    source: r.source,
    domains: r.domains,
  };
}

test("lexical only returns exactly what query.py returned, for all 40 queries", async () => {
  expect(queries.length).toBe(40);
  for (const query of queries) {
    const run = await runQuery(ROOT, query, opts(), deps());
    expect({ query, ids: run.results.map((r) => r.skill) }).toEqual({ query, ids: golden[query] ?? [] });
  }
});

test("lexical only is Task 7 retrieve itself: same scores, same order, same completions", async () => {
  for (const query of queries) {
    const run = await runQuery(ROOT, query, opts(), deps());
    const base = retrieve(graph, query, 8);
    expect(run.results.map(shape)).toEqual(base.results.map(shape));
    expect(run.completions).toEqual(base.completions);
    expect(run.notices).toEqual([]);
    // The only difference is the signal names appended to a direct hit's why.
    for (const [i, r] of run.results.entries()) {
      const original = base.results[i]?.why ?? "";
      expect(r.why).toBe(original === DIRECT_WHY ? `${DIRECT_WHY} (lexical)` : original);
    }
  }
});

test("signals record the rank each signal gave the skill", async () => {
  const run = await runQuery(
    ROOT,
    PROBE,
    opts({ fuzzy: true }),
    deps({ fuzzy: fakeFuzzy([{ id: "scanpy", score: 9, rank: 1 }]) }),
  );
  const byId = new Map(run.results.map((r) => [r.skill, r.signals]));
  // harmonypy is the BM25 top hit for this query and no fuzzy hit at all.
  expect(byId.get("harmonypy")).toEqual({ lexical: 1 });
  expect(byId.get("scanpy")).toEqual({ lexical: 12, fuzzy: 1 });
  const scanpy = run.results.find((r) => r.skill === "scanpy");
  expect(scanpy?.why).toBe(`${DIRECT_WHY} (lexical, fuzzy)`);
});

test("a semantic hit lifts a skill lexical ranks nowhere, and stale vectors are tagged", async () => {
  const lexicalOnly = await runQuery(ROOT, PROBE, opts(), deps());
  expect(lexicalOnly.results.map((r) => r.skill)).not.toContain("pymc");

  const run = await runQuery(
    ROOT,
    PROBE,
    opts({ semantic: true }),
    deps({
      vectors: () => fakeIndex("pymc", ["anndata", "scanpy"], ["pymc"]),
      embed: fakeEmbed(),
    }),
  );
  const pymc = run.results.find((r) => r.skill === "pymc");
  expect(pymc?.signals).toEqual({ semantic: 1 });
  expect(pymc?.stale).toBe(true);
  expect(pymc?.why).toBe(`${DIRECT_WHY} (semantic)`);
  expect(run.notices).toEqual([]);
  // The lexical signal is still there: its top hit keeps a seat.
  expect(run.results.map((r) => r.skill)).toContain("harmonypy");
});

test("a missing vault/embeddings is one notice, not a failure", async () => {
  const run = await runQuery(ROOT, PROBE, opts({ semantic: true }), deps());
  expect(run.notices.length).toBe(1);
  expect(run.notices[0]).toContain("vault/embeddings");
  expect(run.notices[0]).toContain("skillquarium embed");
  expect(run.results.length).toBe(8);
  expect(run.results.map((r) => r.skill)).toContain("harmonypy");
});

test("an endpoint that throws is one notice naming it, not a failure", async () => {
  const run = await runQuery(
    ROOT,
    PROBE,
    opts({ semantic: true }),
    deps({
      vectors: () => fakeIndex("pymc", ["anndata", "scanpy"]),
      embed: () => ({
        embed: async () => {
          throw new Error("http://127.0.0.1:1/v1/embeddings: Unable to connect");
        },
        modelName: async () => "fake",
      }),
    }),
  );
  expect(run.notices).toEqual([
    "semantic search unavailable: http://127.0.0.1:1/v1/embeddings: Unable to connect",
  ]);
  // The remaining signals still fuse and expand: a full page of results, none of them semantic.
  expect(run.results.length).toBe(8);
  expect(run.results.map((r) => r.skill)).toContain("harmonypy");
  for (const r of run.results) expect(r.signals.semantic).toBeUndefined();
});

test("an unusable file index is one notice, not a failure", async () => {
  const run = await runQuery(
    ROOT,
    PROBE,
    opts({ fuzzy: true }),
    deps({ fuzzy: fakeFuzzy([], "libfff.so not found") }),
  );
  expect(run.notices).toEqual(["fuzzy path search unavailable: libfff.so not found"]);
  expect(run.results.length).toBe(8);
  for (const r of run.results) expect(r.signals.fuzzy).toBeUndefined();
});

test("explain adds the per-signal rank and the fused contribution", async () => {
  const run = await runQuery(
    ROOT,
    PROBE,
    opts({ semantic: true, explain: true }),
    deps({ vectors: () => fakeIndex("pymc", ["anndata"]), embed: fakeEmbed() }),
  );
  const pymc = run.results.find((r) => r.skill === "pymc");
  // One signal at rank 1: 1 / (60 + 1) both as the contribution and as the fused total.
  expect(pymc?.why).toBe(`${DIRECT_WHY} (semantic) [semantic #1 +0.0164, fused 0.0164]`);
  const harmony = run.results.find((r) => r.skill === "harmonypy");
  expect(harmony?.why).toContain("lexical #1 +0.0164");
});
