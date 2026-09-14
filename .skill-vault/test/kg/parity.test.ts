import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { buildGraph } from "../../src/kg/build";
import type { Graph, GraphEdge, GraphNode } from "../../src/kg/types";

// The oracle: vault/graph/graph.json as kg/build_kg.py produced it on this tree, committed (5.4 MB)
// because that Python is deleted and this is the only way left to re-verify the port.
const FIXTURE = join(import.meta.dir, "..", "fixtures", "graph.python.json");
const ROOT = resolve(dirname(import.meta.dir), "..", "..");

/** First differences between two JSON values, as `path: expected -> actual` lines. */
function diffs(expected: unknown, actual: unknown, path: string, out: string[], limit: number): void {
  if (out.length >= limit) return;
  if (expected === actual) return;
  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) {
      out.push(`${path}: ${JSON.stringify(expected)} -> ${JSON.stringify(actual)}`);
      return;
    }
    if (expected.length !== actual.length) {
      out.push(`${path}.length: ${expected.length} -> ${actual.length}`);
    }
    for (let i = 0; i < Math.max(expected.length, actual.length); i++) {
      diffs(expected[i], actual[i], `${path}[${i}]`, out, limit);
    }
    return;
  }
  const bothObjects =
    typeof expected === "object" && expected !== null && typeof actual === "object" && actual !== null;
  if (bothObjects) {
    const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])];
    for (const k of keys) {
      diffs(
        (expected as Record<string, unknown>)[k],
        (actual as Record<string, unknown>)[k],
        `${path}.${k}`,
        out,
        limit,
      );
    }
    return;
  }
  out.push(`${path}: ${JSON.stringify(expected)} -> ${JSON.stringify(actual)}`);
}

/** Assert deep equality, reporting at most `limit` differences with their paths. */
function expectSame(expected: unknown, actual: unknown, label: string, limit = 5): void {
  const out: string[] = [];
  diffs(expected, actual, label, out, limit);
  if (out.length > 0) throw new Error(`${out.length} difference(s):\n${out.slice(0, limit).join("\n")}`);
}

/** Keyed comparison: missing / extra keys first, then the first `limit` differing records. */
function expectSameKeyed<T>(
  expected: Map<string, T>,
  actual: Map<string, T>,
  label: string,
  limit = 5,
): void {
  const missing = [...expected.keys()].filter((k) => !actual.has(k));
  const extra = [...actual.keys()].filter((k) => !expected.has(k));
  const out: string[] = [];
  for (const k of missing.slice(0, limit))
    out.push(`${label} missing ${k}: ${JSON.stringify(expected.get(k))}`);
  for (const k of extra.slice(0, limit))
    out.push(`${label} unexpected ${k}: ${JSON.stringify(actual.get(k))}`);
  if (out.length === 0) {
    for (const [k, want] of expected) {
      if (out.length >= limit) break;
      diffs(want, actual.get(k), `${label}[${k}]`, out, limit);
    }
  }
  if (out.length > 0) {
    throw new Error(
      `${label}: ${missing.length} missing, ${extra.length} unexpected; first differences:\n${out.slice(0, limit).join("\n")}`,
    );
  }
}

describe("build_kg parity with the Python oracle", () => {
  const expected = JSON.parse(readFileSync(FIXTURE, "utf8")) as Graph;
  const actual = buildGraph(ROOT);

  test("schema_version", () => {
    expect(actual.schema_version).toBe(expected.schema_version);
  });

  test("every metrics field", () => {
    for (const key of Object.keys(expected.metrics) as Array<keyof Graph["metrics"]>) {
      expectSame(expected.metrics[key], actual.metrics[key], `metrics.${String(key)}`);
    }
    expect(Object.keys(actual.metrics)).toEqual(Object.keys(expected.metrics));
  });

  test("nodes", () => {
    const want = new Map(expected.nodes.map((n: GraphNode) => [n.id, n]));
    const got = new Map(actual.nodes.map((n) => [n.id, n]));
    expect(got.size).toBe(want.size);
    expectSameKeyed(want, got, "node");
  });

  test("node order and key order", () => {
    expect(actual.nodes.map((n) => n.id)).toEqual(expected.nodes.map((n: GraphNode) => n.id));
    for (let i = 0; i < expected.nodes.length; i++) {
      const wantKeys = Object.keys(expected.nodes[i] as object);
      const gotKeys = Object.keys(actual.nodes[i] as object);
      if (wantKeys.join(",") !== gotKeys.join(",")) {
        throw new Error(`node ${expected.nodes[i]?.id} key order: ${wantKeys} -> ${gotKeys}`);
      }
    }
  });

  test("edges", () => {
    const key = (e: GraphEdge): string => `${e.src}|${e.rel}|${e.dst}`;
    const want = new Map(expected.edges.map((e: GraphEdge) => [key(e), e]));
    const got = new Map(actual.edges.map((e) => [key(e), e]));
    expect(got.size).toBe(want.size);
    expectSameKeyed(want, got, "edge");
  });

  test("edge order", () => {
    const key = (e: GraphEdge): string => `${e.src}|${e.rel}|${e.dst}`;
    expect(actual.edges.map(key)).toEqual(expected.edges.map(key));
  });

  test("recipes", () => {
    expectSame(expected.recipes, actual.recipes, "recipes");
  });

  test("orphans", () => {
    expectSame(expected.orphans, actual.orphans, "orphans");
  });

  test("ambiguous_aliases", () => {
    expectSame(expected.ambiguous_aliases, actual.ambiguous_aliases, "ambiguous_aliases");
    expect(Object.keys(actual.ambiguous_aliases)).toEqual(Object.keys(expected.ambiguous_aliases));
  });

  test("top-level key order", () => {
    expect(Object.keys(actual)).toEqual(Object.keys(expected));
  });
});
