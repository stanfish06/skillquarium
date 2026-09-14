import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadObservations } from "../../src/kg/observations";
import { buildFixtureGraph, write } from "./fixtureVault";

// tests/test_kg.py::TestObservationAndAssertionGuards
describe("observation and assertion guards", () => {
  test("malformed observation records are skipped", () => {
    const root = mkdtempSync(join(tmpdir(), "kg-obs-"));
    try {
      write(
        join(root, ".skill-vault/observations/episodes.jsonl"),
        'null\n[]\n"text"\n' +
          '{"used": ["alpha"], "outcome": "success", "ts": "2026-01-01"}\n' +
          '{"used": "alpha", "outcome": "success"}\n',
      );
      const episodes = loadObservations(join(root, ".skill-vault", "observations"));
      expect(episodes).toHaveLength(1);
      expect(episodes[0]?.used).toEqual(["alpha"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("last_used keeps the latest timestamp, and OBSERVED weight stays under 1.0", () => {
    const fixture = buildFixtureGraph((root) => {
      write(
        join(root, ".skill-vault/observations/episodes.jsonl"),
        '{"used": ["alpha"], "outcome": "success", "ts": "2026-01-01"}\n' +
          '{"used": ["alpha"], "outcome": "success", "ts": "2026-08-01"}\n' +
          '{"used": ["alpha"], "outcome": "success", "ts": "2026-03-01"}\n',
      );
    });
    try {
      const node = fixture.graph.nodes.find((n) => n.id === "alpha");
      expect(node?.last_used).toBe("2026-08-01");
      expect(node?.uses).toBe(3);
      expect(node?.success_rate).toBe(1);
      for (const e of fixture.graph.edges) {
        if (e.provenance === "OBSERVED") expect(e.weight).toBeLessThan(1.0);
      }
    } finally {
      fixture.cleanup();
    }
  });

  test("unknown assertion endpoints create neither edge nor node", () => {
    const fixture = buildFixtureGraph((root) => {
      write(
        join(root, ".skill-vault/ontology/assertions/bad.json"),
        JSON.stringify({
          edges: [
            {
              src: "scanppy",
              rel: "alternative_to",
              dst: "alpha",
              justification: "typo should not create an asserted edge",
            },
          ],
        }),
      );
    });
    try {
      const rels = new Set(fixture.graph.edges.map((e) => `${e.src}|${e.rel}|${e.dst}`));
      expect(rels.has("scanppy|alternative_to|alpha")).toBe(false);
      expect(fixture.graph.nodes.some((n) => n.id === "scanppy")).toBe(false);
      expect(fixture.graph.metrics.asserted_edges).toBe(0);
    } finally {
      fixture.cleanup();
    }
  });
});
