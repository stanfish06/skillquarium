import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { HASH_VERSION } from "../../src/embed/hash";
import type { EmbedIndex } from "../../src/embed/store";
import type { Tokenizer } from "../../src/search/bm25";
import { Bpe } from "../../src/search/bpe";
import type { FuzzyRanker } from "../../src/search/fff";
import { buildGraph, loadGraph } from "../../src/search/graph";
import { DIRECT_WHY, SIMILAR_WHY, similarityBudget } from "../../src/search/graphExpand";
import {
  augment,
  BPE_WHY,
  type HybridResult,
  type QueryDeps,
  type QueryOptions,
  runQuery,
} from "../../src/search/query";
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
/** The fused seeds for PROBE, in order: harmonypy is the BM25 top hit and pymc is nowhere. */
const TOP_SEED = "harmonypy";
const THIRD_SEED = "scvi-tools";

function opts(over: Partial<QueryOptions> = {}): QueryOptions {
  return { k: 8, semantic: false, fuzzy: false, explain: false, ...over };
}

function deps(over: Partial<QueryDeps> = {}): QueryDeps {
  return {
    graph,
    vectors: () => null,
    fuzzy: () => {
      throw new Error("the file index must not be started");
    },
    rrfK: 60,
    weights: { lexical: 1, fuzzy: 1 },
    ...over,
  };
}

/**
 * A two-dimensional index placing each id at its own angle in degrees, so the cosine between two
 * ids is the cosine of the angle between them and the 0.8 similarity floor sits at 36.9 degrees.
 */
function fakeIndex(angles: Record<string, number>, stale: string[] = []): EmbedIndex {
  const ids = Object.keys(angles).sort();
  const rows = ids.map((id) => {
    const rad = ((angles[id] ?? 0) * Math.PI) / 180;
    return Float32Array.from([Math.cos(rad), Math.sin(rad)]);
  });
  return {
    dim: 2,
    ids,
    desc: rows,
    body: rows,
    stale: new Set(stale),
    manifest: { model: "fake", dim: 2, hashVersion: HASH_VERSION, skills: {} },
  };
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

test("the top seed's nearest skill is added, named after the seed, and tagged when stale", async () => {
  const lexicalOnly = await runQuery(ROOT, PROBE, opts(), deps());
  expect(lexicalOnly.results.map((r) => r.skill)).not.toContain("pymc");

  const run = await runQuery(
    ROOT,
    PROBE,
    opts({ semantic: true }),
    // anndata is nearer than pymc but is itself a fused seed, so the expansion skips it.
    deps({
      vectors: () => fakeIndex({ harmonypy: 0, anndata: 5, pymc: 20, scanpy: 70 }, ["pymc"]),
    }),
  );
  const pymc = run.results.find((r) => r.skill === "pymc");
  expect(pymc?.why).toBe(`${SIMILAR_WHY} ${TOP_SEED} (cosine 0.94)`);
  // No signal produced it: it came out of the expansion, the way a graph pick does.
  expect(pymc?.signals).toEqual({});
  expect(pymc?.stale).toBe(true);
  expect(run.notices).toEqual([]);
  // The lexical signal is still there: its top hit keeps a seat.
  expect(run.results.map((r) => r.skill)).toContain("harmonypy");
});

test("a direct hit outranks every skill its own expansion pulled in", async () => {
  const run = await runQuery(
    ROOT,
    PROBE,
    opts({ semantic: true }),
    deps({ vectors: () => fakeIndex({ harmonypy: 0, pymc: 10, polars: 20 }) }),
  );
  const direct = run.results.filter((r) => r.why.startsWith(DIRECT_WHY));
  const similar = run.results.filter((r) => r.why.startsWith(SIMILAR_WHY));
  expect(direct.length).toBeGreaterThan(0);
  expect(Math.min(...direct.map((r) => r.score))).toBeGreaterThan(Math.max(...similar.map((r) => r.score)));
});

test("the expansion spends at most half the derived slots, however many skills are close", async () => {
  expect(similarityBudget(8)).toBe(1);
  const run = await runQuery(
    ROOT,
    PROBE,
    opts({ semantic: true }),
    deps({ vectors: () => fakeIndex({ harmonypy: 0, pymc: 10, polars: 15, matplotlib: 20 }) }),
  );
  expect(run.results.filter((r) => r.why.startsWith(SIMILAR_WHY))).toHaveLength(1);
});

test("a seed with nothing above the floor passes the slot to the next seed", async () => {
  const run = await runQuery(
    ROOT,
    PROBE,
    opts({ semantic: true }),
    // Everything is 100 degrees from harmonypy, well under the floor; pymc is 10 from scvi-tools.
    deps({ vectors: () => fakeIndex({ harmonypy: 0, "scvi-tools": 90, pymc: 100 }) }),
  );
  const pymc = run.results.find((r) => r.skill === "pymc");
  expect(pymc?.why).toBe(`${SIMILAR_WHY} ${THIRD_SEED} (cosine 0.98)`);
});

test("nothing close enough expands to nothing, with no notice", async () => {
  const run = await runQuery(
    ROOT,
    PROBE,
    opts({ semantic: true }),
    deps({ vectors: () => fakeIndex({ harmonypy: 0, pymc: 60, polars: 120 }) }),
  );
  expect(run.results.filter((r) => r.why.startsWith(SIMILAR_WHY))).toEqual([]);
  expect(run.notices).toEqual([]);
  expect(run.results.length).toBe(8);
});

test("a missing vault/embeddings is one notice, not a failure", async () => {
  const run = await runQuery(ROOT, PROBE, opts({ semantic: true }), deps());
  expect(run.notices.length).toBe(1);
  expect(run.notices[0]).toContain("vault/embeddings");
  expect(run.notices[0]).toContain("skillquarium embed");
  expect(run.results.length).toBe(8);
  expect(run.results.map((r) => r.skill)).toContain("harmonypy");
});

test("--no-semantic never reads the index", async () => {
  const run = await runQuery(
    ROOT,
    PROBE,
    opts({ fuzzy: true }),
    deps({
      fuzzy: fakeFuzzy([]),
      vectors: () => {
        throw new Error("the vector index must not be read");
      },
    }),
  );
  expect(run.results.filter((r) => r.why.startsWith(SIMILAR_WHY))).toEqual([]);
  expect(run.notices).toEqual([]);
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
    deps({ vectors: () => fakeIndex({ harmonypy: 0, pymc: 20 }) }),
  );
  const harmony = run.results.find((r) => r.skill === "harmonypy");
  // One signal at rank 1: 1 / (60 + 1) both as the contribution and as the fused total.
  expect(harmony?.why).toBe(`${DIRECT_WHY} (lexical) [lexical #1 +0.0164, fused 0.0164]`);
  // An expansion pick was in no signal, so explain has nothing to add to what its why already says.
  const pymc = run.results.find((r) => r.skill === "pymc");
  expect(pymc?.why).toBe(`${SIMILAR_WHY} ${TOP_SEED} (cosine 0.94)`);
});

// --- BPE augmentation ---------------------------------------------------------

const BPE_FIXTURE = resolve(import.meta.dir, "../fixtures/tokenizer/tokenizer.json");
const fixtureBpe = Bpe.load(BPE_FIXTURE);
const BPE: Tokenizer = { name: "bpe", encode: (t) => fixtureBpe.encode(t ?? "") };

function withBpe(extra = 3, tokenizer: Tokenizer | null = BPE): Partial<QueryDeps> {
  return { bpe: { tokenizer: () => tokenizer, extra } };
}

/** What ranking decided: signals are left out, since BPE adds its own rank there. */
function ranking(r: HybridResult): Omit<HybridResult, "signals"> {
  const { signals: _, ...rest } = r;
  return rest;
}

test("bpe leaves every ASCII list intact as a prefix, lexical-only and hybrid, all 40 queries", async () => {
  const index = fakeIndex({ harmonypy: 0, pymc: 20 });
  let appended = 0;
  for (const query of queries) {
    for (const o of [opts(), opts({ semantic: true, fuzzy: true })]) {
      const d = { vectors: () => index, fuzzy: fakeFuzzy([]) };
      const ascii = await runQuery(ROOT, query, o, deps(d));
      const both = await runQuery(ROOT, query, { ...o, bpe: true }, deps({ ...d, ...withBpe() }));
      expect(both.results.slice(0, ascii.results.length).map(ranking)).toEqual(ascii.results.map(ranking));
      expect(both.completions).toEqual(ascii.completions);
      const extras = both.results.slice(ascii.results.length);
      expect(extras.length).toBeLessThanOrEqual(3);
      const seen = new Set(ascii.results.map((r) => r.skill));
      for (const e of extras) {
        expect(seen.has(e.skill)).toBe(false);
        seen.add(e.skill);
        expect(e.why).toBe(BPE_WHY);
        // It may carry a lexical rank too: ASCII ranked it, just below the cut.
        expect(e.signals.bpe).toBeDefined();
      }
      appended += extras.length;
    }
  }
  // The property is vacuous if BPE never appends anything.
  expect(appended).toBeGreaterThan(0);
});

test("bpe off, absent, or given no slots appends nothing and says nothing", async () => {
  const base = await runQuery(ROOT, PROBE, opts(), deps());
  for (const [o, d] of [
    [opts({ bpe: false }), deps(withBpe())],
    [opts({ bpe: true }), deps()],
    [opts({ bpe: true }), deps(withBpe(0))],
  ] as const) {
    const run = await runQuery(ROOT, PROBE, o, d);
    expect(run.results).toEqual(base.results);
    expect(run.notices).toEqual([]);
  }
});

test("an untrained model is one notice and the ASCII list alone", async () => {
  const base = await runQuery(ROOT, PROBE, opts(), deps());
  const run = await runQuery(ROOT, PROBE, opts({ bpe: true }), deps(withBpe(3, null)));
  expect(run.results).toEqual(base.results);
  expect(run.notices).toHaveLength(1);
  expect(run.notices[0]).toContain("bpe augmentation unavailable");
});

test("bpe appends at most the configured count, best BPE rank first", async () => {
  const one = await runQuery(ROOT, PROBE, opts({ bpe: true }), deps(withBpe(1)));
  const three = await runQuery(ROOT, PROBE, opts({ bpe: true }), deps(withBpe(3)));
  const tail = (r: typeof one) => r.results.filter((x) => x.why === BPE_WHY);
  expect(tail(one).length).toBe(1);
  expect(tail(three)[0]?.skill).toBe(tail(one)[0]?.skill);
  const ranks = tail(three).map((r) => r.signals.bpe ?? 0);
  expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
});

test("a deprecated skill is never appended", () => {
  const tiny = buildGraph({
    nodes: [
      {
        id: "old-parser",
        type: "Skill",
        label: "old-parser",
        description: "parse binaries",
        deprecated: true,
      },
      { id: "new-parser", type: "Skill", label: "new-parser", description: "parse binaries" },
      { id: "plotter", type: "Skill", label: "plotter", description: "draw charts" },
    ],
    edges: [],
  });
  const { extras } = augment(ROOT, "binaries", [], opts({ bpe: true }), deps({ graph: tiny, ...withBpe() }));
  expect(extras.map((r) => r.skill)).toEqual(["new-parser"]);
});

test("explain shows a BPE rank on an ASCII hit without a fused contribution", async () => {
  let checked = 0;
  for (const query of queries) {
    const run = await runQuery(ROOT, query, opts({ bpe: true, explain: true }), deps(withBpe()));
    for (const r of run.results) {
      if (!r.why.startsWith(DIRECT_WHY) || r.signals.bpe === undefined) continue;
      checked += 1;
      expect(r.why).toBe(`${DIRECT_WHY} (lexical) [lexical #${r.signals.lexical}, bpe #${r.signals.bpe}]`);
    }
  }
  expect(checked).toBeGreaterThan(0);
});
