import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeContext } from "../../src/cli";
import type { Graph, GraphEdge } from "../../src/kg/types";
import type { Report, Row, ValidateDeps } from "../../src/kg/validate";
import { failed, renderReport, validateGraph } from "../../src/kg/validate";
import { loadDeps, run } from "../../src/kg/validateCommand";
import { writeGraph } from "../../src/kg/write";
import { buildFixtureGraph, REPO, write } from "./fixtureVault";

const COMMITTED = join(REPO, "vault", "graph", "graph.json");
const GOLDEN = join(import.meta.dir, "..", "fixtures", "validate.golden.json");

function rowOf(report: Report, id: string): Row {
  const row = report.rows.find((r) => r.id === id);
  if (!row) throw new Error(`no row ${id} in ${report.rows.map((r) => r.id).join(", ")}`);
  return row;
}

describe.skipIf(!existsSync(COMMITTED))("the committed graph against validate.py's output", () => {
  const graph = JSON.parse(readFileSync(COMMITTED, "utf8")) as Graph;
  const golden = JSON.parse(readFileSync(GOLDEN, "utf8")) as Row[];
  // Golden embeddings are pinned off: whether vault/embeddings exists is not a property of the graph.
  const report = validateGraph(graph, { ...loadDeps(REPO), embeddings: null });

  // `python3 .skill-vault/kg/validate.py --json` still reproduces validate.golden.json byte for byte
  // on the regenerated graph (re-run 2026-09-14, 2206 nodes / 15777 edges), so every detail string
  // is compared too, not only the status.
  for (const want of golden) {
    test(want.id, () => {
      expect(rowOf(report, want.id)).toEqual(want);
    });
  }

  test("no check is dropped and the SHACL rows are gone", () => {
    expect(report.rows.map((r) => r.id)).toEqual([
      ...golden.map((r) => r.id),
      "CQ8 cross-domain",
      "stale vectors",
    ]);
    expect(report.rows.some((r) => r.kind === "SHACL")).toBe(false);
  });

  test("CQ8 is answerable: chains_to crosses domains", () => {
    const row = rowOf(report, "CQ8 cross-domain");
    expect(row.status).toBe("PASS");
    expect(row.detail).toStartWith("5 chains_to edges join skills with disjoint domains");
  });

  test("the EMBED row reads the real vault/embeddings state", () => {
    const row = rowOf(validateGraph(graph, loadDeps(REPO)), "stale vectors");
    expect(["PASS", "WARN", "NOT_YET"]).toContain(row.status); // never FAIL
  });
});

describe("shape violations on a fixture graph", () => {
  const fixture = buildFixtureGraph();
  afterAll(() => {
    fixture.cleanup();
  });
  const deps: ValidateDeps = {
    provenance: new Set(["ASSERTED", "OBSERVED", "EXTRACTED", "INFERRED", "PROPOSED"]),
    retrievable: new Set(["ASSERTED", "OBSERVED", "EXTRACTED", "INFERRED"]),
    lexicon: null,
    embeddings: null,
  };

  /** A copy of the fixture graph. The 4-skill vault is 50% orphans by construction, which P2 is
   * entitled to fail on; these tests are about the other checks, so the rate is pinned under the gate. */
  function clone(edit?: (g: Graph) => void): Graph {
    const g = structuredClone(fixture.graph);
    g.metrics.orphan_rate = 0.01;
    edit?.(g);
    return g;
  }

  const edge = (src: string, rel: string, dst: string, extra: Partial<GraphEdge> = {}): GraphEdge => ({
    src,
    rel,
    dst,
    weight: 1,
    provenance: "INFERRED",
    justification: "test fixture",
    status: "accepted",
    ...extra,
  });

  test("the unmodified fixture has no violation", () => {
    expect(failed(validateGraph(clone(), deps))).toEqual([]);
  });

  test("a chains_to cycle warns instead of failing", () => {
    const report = validateGraph(
      clone((g) => {
        g.edges.push(edge("beta", "chains_to", "alpha"));
      }),
      deps,
    );
    const row = rowOf(report, "P5 chains acyclic");
    expect(row.status).toBe("WARN");
    expect(row.detail).toBe("1 back-edges e.g. [('beta', 'alpha')]");
    expect(failed(report)).toEqual([]);
  });

  test("a skill with no in_domain fails P1", () => {
    const report = validateGraph(
      clone((g) => {
        g.edges = g.edges.filter((e) => !(e.rel === "in_domain" && e.src === "gamma"));
      }),
      deps,
    );
    expect(rowOf(report, "P1 in_domain>=1")).toMatchObject({
      status: "FAIL",
      detail: "1 skills without a domain e.g. ['gamma']",
    });
  });

  test("a PROPOSED edge that is not marked proposed fails P4", () => {
    const report = validateGraph(
      clone((g) => {
        g.edges.push(edge("alpha", "references", "gamma", { provenance: "PROPOSED" }));
      }),
      deps,
    );
    expect(rowOf(report, "P4 PROPOSED gate")).toMatchObject({
      status: "FAIL",
      detail: "1 unreviewed edges marked retrievable",
    });
  });

  test("a PROPOSED edge still marked proposed passes P4", () => {
    const report = validateGraph(
      clone((g) => {
        g.edges.push(edge("alpha", "references", "gamma", { provenance: "PROPOSED", status: "proposed" }));
      }),
      deps,
    );
    expect(rowOf(report, "P4 PROPOSED gate").status).toBe("PASS");
  });

  test("an alternative_to edge without its reverse fails P6", () => {
    const report = validateGraph(
      clone((g) => {
        g.edges.push(edge("alpha", "alternative_to", "gamma"));
      }),
      deps,
    );
    expect(rowOf(report, "P6 alt symmetric")).toMatchObject({
      status: "FAIL",
      detail: "1 asymmetric alternative_to edges",
    });
    const symmetric = validateGraph(
      clone((g) => {
        g.edges.push(edge("alpha", "alternative_to", "gamma"), edge("gamma", "alternative_to", "alpha"));
      }),
      deps,
    );
    expect(rowOf(symmetric, "P6 alt symmetric").status).toBe("PASS");
  });

  test("an edge with an unknown provenance fails P3", () => {
    const report = validateGraph(
      clone((g) => {
        g.edges.push(edge("alpha", "references", "gamma", { justification: "" }));
      }),
      deps,
    );
    expect(rowOf(report, "P3 provenance")).toMatchObject({
      status: "FAIL",
      detail: "1 edges missing provenance or justification",
    });
  });

  test("the text layout keeps the Python's icons, padding and summary", () => {
    const lines = renderReport(validateGraph(clone(), deps), fixture.graph.metrics);
    expect(lines[0]).toBe("vault knowledge graph — 4 skills, 30 nodes, 15 edges");
    expect(lines).toContain("SHAPES");
    expect(lines).toContain("  [ok  ] P1 in_domain>=1     0 skills without a domain");
    expect(lines.at(-1)).toBe("OK: 0 violation(s), 0 warning(s), 7 not-yet-answerable");
  });
});

/** A vault root with the fixture graph written to vault/graph/graph.json, for the command tests. */
function fixtureRoot(edit?: (g: Graph) => void): { root: string; cleanup: () => void } {
  const fixture = buildFixtureGraph();
  const graph = fixture.graph;
  graph.metrics.orphan_rate = 0.01;
  edit?.(graph);
  writeGraph(fixture.root, graph);
  return { root: fixture.root, cleanup: fixture.cleanup };
}

function capture(
  root: string,
  json: boolean,
  args: string[] = [],
): Promise<{ code: number; out: string[]; err: string[] }> {
  const out: string[] = [];
  const err: string[] = [];
  const ctx = makeContext(root, json, { out: (l) => out.push(l), err: (l) => err.push(l) });
  return run(args, ctx).then((code) => ({ code, out, err }));
}

describe("the validate command", () => {
  test("exits 0 when only WARN and NOT_YET rows are present", async () => {
    const vault = fixtureRoot();
    try {
      const { code, out } = await capture(vault.root, false);
      expect(code).toBe(0);
      expect(out.at(-1)).toStartWith("OK: 0 violation(s)");
    } finally {
      vault.cleanup();
    }
  });

  test("exits 1 on a FAIL row", async () => {
    const vault = fixtureRoot((g) => {
      g.edges = g.edges.filter((e) => !(e.rel === "in_domain" && e.src === "gamma"));
    });
    try {
      const { code, out } = await capture(vault.root, true);
      expect(code).toBe(1);
      const rows = JSON.parse(out.join("\n")) as Row[];
      expect(rows.find((r) => r.id === "P1 in_domain>=1")?.status).toBe("FAIL");
    } finally {
      vault.cleanup();
    }
  });

  test("--json prints every row with the four report fields", async () => {
    const vault = fixtureRoot();
    try {
      const { out } = await capture(vault.root, true);
      const rows = JSON.parse(out.join("\n")) as Row[];
      expect(rows.map((r) => r.id)).toEqual([
        "P1 in_domain>=1",
        "P2 orphan rate",
        "P3 provenance",
        "P4 PROPOSED gate",
        "P5 chains acyclic",
        "P6 alt symmetric",
        "P7 term ambiguity",
        "P8 recipe steps",
        "CQ1 fastq->pathway",
        "CQ2 alternatives",
        "CQ3 prerequisites",
        "CQ4 by capability",
        "CQ5 set completion",
        "CQ6 gaps",
        "CQ7 staleness",
        "CQ8 cross-domain",
        "stale vectors",
      ]);
      for (const row of rows) expect(Object.keys(row)).toEqual(["kind", "id", "status", "detail"]);
      expect(out.join("\n")).toStartWith('[\n {\n  "kind": "SHAPES",');
    } finally {
      vault.cleanup();
    }
  });

  test("a missing graph exits 2 without a report", async () => {
    const root = mkdtempSync(join(tmpdir(), "kg-nograph-"));
    try {
      const { code, out, err } = await capture(root, false);
      expect(code).toBe(2);
      expect(out).toEqual([]);
      expect(err[0]).toBe(`no graph at ${join(root, "vault", "graph", "graph.json")} — run build first`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("an unexpected argument exits 2", async () => {
    const root = mkdtempSync(join(tmpdir(), "kg-args-"));
    try {
      const { code, err } = await capture(root, false, ["--shacl"]);
      expect(code).toBe(2);
      expect(err[0]).toContain("unexpected argument --shacl");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("the EMBED row", () => {
  test("is NOT_YET while nothing is embedded", () => {
    const vault = fixtureRoot();
    try {
      expect(loadDeps(vault.root).embeddings).toBeNull();
      const report = validateGraph(
        JSON.parse(readFileSync(join(vault.root, "vault/graph/graph.json"), "utf8")) as Graph,
        loadDeps(vault.root),
      );
      expect(rowOf(report, "stale vectors")).toEqual({
        kind: "EMBED",
        id: "stale vectors",
        status: "NOT_YET",
        detail: "no embedding manifest — run embed first",
      });
    } finally {
      vault.cleanup();
    }
  });

  test("warns, never fails, when a manifest hash no longer matches SKILL.md", () => {
    const vault = fixtureRoot();
    try {
      write(
        join(vault.root, "vault/embeddings/manifest.json"),
        JSON.stringify({
          dim: 4,
          model: "test",
          skills: Object.fromEntries(
            ["alpha", "beta", "gamma", "workflow"].map((id) => [
              id,
              { sha256: id === "alpha" ? "0".repeat(64) : sha256Of(vault.root, id), updated: "2026-01-01" },
            ]),
          ),
        }),
      );
      const graph = JSON.parse(readFileSync(join(vault.root, "vault/graph/graph.json"), "utf8")) as Graph;
      const report = validateGraph(graph, loadDeps(vault.root));
      expect(rowOf(report, "stale vectors")).toEqual({
        kind: "EMBED",
        id: "stale vectors",
        status: "WARN",
        detail: "1/4 skills changed since embedding — run embed",
      });
      expect(failed(report)).toEqual([]);
    } finally {
      vault.cleanup();
    }
  });
});

function sha256Of(root: string, id: string): string {
  return new Bun.CryptoHasher("sha256")
    .update(readFileSync(join(root, "skills", id, "SKILL.md")))
    .digest("hex");
}
