import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Graph, GraphEdge } from "../../src/kg/types";
import { buildFixtureGraph } from "./fixtureVault";

// tests/test_kg.py::TestExtraction — extraction behaviour on a synthetic vault, so the
// assertions stay independent of what upstream ships today.
describe("extraction on the fixture vault", () => {
  let fixture: ReturnType<typeof buildFixtureGraph>;
  let graph: Graph;
  let edges: GraphEdge[];
  let rels: Set<string>;
  const rel = (src: string, r: string, dst: string): string => `${src}|${r}|${dst}`;

  beforeAll(() => {
    fixture = buildFixtureGraph();
    graph = fixture.graph;
    edges = graph.edges;
    rels = new Set(edges.map((e) => rel(e.src, e.rel, e.dst)));
  });
  afterAll(() => fixture.cleanup());

  test("skill nodes are discovered", () => {
    const ids = graph.nodes.filter((n) => n.type === "Skill").map((n) => n.id);
    expect(new Set(ids)).toEqual(new Set(["alpha", "beta", "gamma", "workflow"]));
  });

  test("a name mention creates a symmetric reference", () => {
    expect(rels.has(rel("beta", "references", "alpha"))).toBe(true);
    expect(rels.has(rel("alpha", "references", "beta"))).toBe(true);
  });

  test("a generic name does not link everything", () => {
    // `workflow` appears in every body as prose. It must not become a hub — this is the
    // contamination that gave the real vault a 745-edge `workflow`.
    const hub = edges.filter((e) => e.rel === "references" && (e.src === "workflow" || e.dst === "workflow"));
    expect(hub.length).toBeLessThanOrEqual(2);
  });

  test("unrelated skills are not linked", () => {
    expect(rels.has(rel("alpha", "references", "gamma"))).toBe(false);
  });

  test("artifact touches are extracted", () => {
    expect(rels.has(rel("alpha", "touches", "artifact:fastq"))).toBe(true);
    expect(rels.has(rel("beta", "touches", "artifact:bam"))).toBe(true);
  });

  test("recipe order yields direction", () => {
    expect(rels.has(rel("alpha", "chains_to", "beta"))).toBe(true);
    expect(rels.has(rel("beta", "chains_to", "alpha"))).toBe(false);
  });

  test("every edge carries provenance and justification", () => {
    const levels = new Set(["ASSERTED", "OBSERVED", "EXTRACTED", "INFERRED", "PROPOSED"]);
    for (const e of edges) {
      expect(levels.has(e.provenance)).toBe(true);
      expect(e.justification).toBeTruthy();
    }
  });

  test("PROPOSED edges are never retrievable", () => {
    for (const e of edges) {
      if (e.provenance === "PROPOSED") expect(e.status).toBe("proposed");
    }
  });

  test("recipe auxiliary links are members, not steps", () => {
    const recipe = graph.recipes.find((r) => r.id === "recipe:demo");
    expect(recipe?.steps).toEqual(["alpha", "beta"]);
    expect(recipe?.members).toContain("gamma");
    expect(rels.has(rel("alpha", "chains_to", "gamma"))).toBe(false);
  });

  test("aliases are stored on nodes", () => {
    const node = graph.nodes.find((n) => n.id === "alpha");
    expect(node?.aliases).toContain("calorie counter");
  });
});
