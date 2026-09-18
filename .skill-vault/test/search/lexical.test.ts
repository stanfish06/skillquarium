import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadGraph, neighbours, type VaultGraph } from "../../src/search/graph";
import { DIRECT_WHY } from "../../src/search/graphExpand";
import { retrieve } from "../../src/search/retrieve";

// The graph the Python built for this tree, not vault/graph/graph.json, so the golden
// stays comparable no matter what the build is writing today.
const FIXTURE = resolve(import.meta.dir, "../fixtures/graph.python.json");
const GOLDEN = resolve(import.meta.dir, "../fixtures/query-lexical.golden.json");
const EVAL_SET = resolve(import.meta.dir, "../../data/retrieval-eval.jsonl");

const graph = loadGraph(FIXTURE);
const golden = JSON.parse(readFileSync(GOLDEN, "utf8")) as Record<string, string[]>;
const evalSet = readFileSync(EVAL_SET, "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line) as { query: string; expect: string[] });

function ids(g: VaultGraph, query: string, k = 8): string[] {
  return retrieve(g, query, k).results.map((r) => r.skill);
}

test("every eval query returns what query.py returned", () => {
  expect(evalSet.length).toBe(40);
  expect(Object.keys(golden).length).toBe(evalSet.length);
  for (const { query } of evalSet) {
    expect({ query, ids: ids(graph, query) }).toEqual({ query, ids: golden[query] ?? [] });
  }
});

// --- ported from tests/test_kg.py -----------------------------------------

const PINNED_QUERY = "batch correct single cell data and find marker genes";

test("retrieval knobs are pinned", () => {
  const { results } = retrieve(graph, PINNED_QUERY, 8);
  expect(results.length).toBe(8);
  const derived = results.filter((r) => r.why !== DIRECT_WHY);
  // Scores, quota, nudge passes and neighbour cap are unmeasured magic numbers; what is
  // pinned is the contract they produce — a mixed set that is not pure lexical ranking.
  expect(derived.length).toBeGreaterThanOrEqual(1);
  expect(derived.length).toBeLessThanOrEqual(4);
  expect(results.every((r) => r.why.length > 0)).toBe(true);
  const names = new Set(results.map((r) => r.skill));
  const core = ["scrna-orchestrator", "scvi-tools", "harmonypy", "scanpy"];
  expect(core.some((id) => names.has(id))).toBe(true);
});

test("retrieval reserves slots for graph-derived skills", () => {
  const { results } = retrieve(graph, PINNED_QUERY, 8);
  expect(results.filter((r) => r.why !== DIRECT_WHY).length).toBeGreaterThan(0);
});

test("a curated alias reaches the skill it names", () => {
  expect(ids(graph, "calorie counter")).toContain("fitness-nutrition");
});

test("cq1: fastq reaches pathway analysis", () => {
  const names = ids(graph, "raw fastq reads to enriched pathways");
  expect(names.length).toBeGreaterThan(0);
  expect(names.some((n) => n.includes("rnaseq") || n.includes("fastq") || n.includes("pathway"))).toBe(true);
});

test("cq5: every multi-step recipe is recoverable from its first step", () => {
  let checked = 0;
  for (const recipe of graph.recipes) {
    const [first, ...rest] = recipe.steps;
    if (first === undefined || rest.length === 0) continue;
    checked += 1;
    // Walk it the way set-completion does: co_occurs_with and chains_to, either direction.
    const reachable = new Set(neighbours(graph, first, ["co_occurs_with", "chains_to"]));
    const recovered = rest.filter((step) => reachable.has(step));
    expect({ recipe: recipe.id, recovered: recovered.length > 0 }).toEqual({
      recipe: recipe.id,
      recovered: true,
    });
  }
  expect(checked).toBeGreaterThan(0);
});

test("retrieval does not depend on set iteration order", () => {
  const query = "raw fastq to enriched pathways";
  const runs = [loadGraph(FIXTURE), loadGraph(FIXTURE), loadGraph(FIXTURE)].map((g) =>
    JSON.stringify(retrieve(g, query, 8)),
  );
  expect(new Set(runs).size).toBe(1);
});
