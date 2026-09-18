import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { Graph } from "../../src/kg/types";
import { writeGraph } from "../../src/kg/write";
import { buildFixtureGraph, REPO } from "./fixtureVault";

// tests/test_kg.py::TestCommittedGraph — the graph-property half. The retrieval questions
// belong to query.py and the RDF layer is gone.
const COMMITTED = join(REPO, "vault", "graph", "graph.json");

describe.skipIf(!existsSync(COMMITTED))("the committed graph", () => {
  const graph = JSON.parse(readFileSync(COMMITTED, "utf8")) as Graph;

  test("orphan rate beats the description-only baseline", () => {
    // The gate that decides whether this design was worth building at all; baseline 48.1%.
    expect(graph.metrics.orphan_rate).toBeLessThan(0.15);
  });

  test("the graph is substantially denser than build.py's related links", () => {
    // 1277 edges was the string-match graph this replaced.
    expect(graph.metrics.edges).toBeGreaterThan(5000);
  });

  test("every recipe step resolves to a node", () => {
    const ids = new Set(graph.nodes.map((n) => n.id));
    for (const r of graph.recipes) {
      for (const step of r.steps) expect(ids.has(step)).toBe(true);
    }
  });

  test("recipe steps use only the primary link of a numbered line", () => {
    const bulk = graph.recipes.find((r) => r.id === "recipe:bulk-rnaseq-to-pathways");
    if (!bulk) return; // recipe not present in this vault
    const rels = new Set(graph.edges.map((e) => `${e.src}|${e.rel}|${e.dst}`));
    expect(rels.has("pydeseq2|chains_to|rnaseq-de")).toBe(false);
    expect(bulk.members).toContain("rnaseq-de");
    expect(bulk.steps).not.toContain("rnaseq-de");
  });

  test("the dispatcher is not an expert profile", () => {
    const node = graph.nodes.find((n) => n.id === "scientific-agents");
    if (!node) return;
    expect(node.type).not.toBe("ExpertProfile");
  });

  test("metrics omit a wall-clock date", () => {
    expect(graph.metrics).not.toHaveProperty("built");
  });
});

describe("writeGraph", () => {
  test("writes graph.json that parses back to the in-memory graph", () => {
    const fixture = buildFixtureGraph();
    try {
      const out = writeGraph(fixture.root, fixture.graph);
      expect(out).toBe(join(fixture.root, "vault", "graph", "graph.json"));
      expect(existsSync(`${out}.tmp`)).toBe(false); // the tmp sibling is renamed, not left behind
      const text = readFileSync(out, "utf8");
      expect(text.endsWith("\n")).toBe(true);
      expect(JSON.parse(text)).toEqual(fixture.graph);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
      fixture.cleanup();
    }
  });
});
