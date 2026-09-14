import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { EmbedIndex } from "../../src/embed/store";
import { readEvalSet, runEval } from "../../src/search/evalSet";
import { loadGraph } from "../../src/search/graph";
import type { QueryDeps, QueryOptions } from "../../src/search/query";

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
