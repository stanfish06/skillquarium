import { expect, test } from "bun:test";
import type { GraphEdge, GraphNode } from "../../src/kg/types";
import { Bm25Index, tok } from "../../src/search/bm25";
import { buildGraph, type GraphData, type VaultGraph } from "../../src/search/graph";

function skill(id: string, fields: Partial<GraphNode> = {}): GraphNode {
  return { id, type: "Skill", label: id, description: "", ...fields };
}

function edge(src: string, rel: string, dst: string): GraphEdge {
  return { src, rel, dst, weight: 1, provenance: "ASSERTED", justification: "test", status: "accepted" };
}

function tiny(nodes: GraphNode[], edges: GraphEdge[] = []): VaultGraph {
  const data: GraphData = { nodes, edges };
  return buildGraph(data);
}

test("the tokenizer keeps ascii alphanumerics and folds case", () => {
  expect(tok("Batch-Correct scRNA_seq v2!")).toEqual(["batch", "correct", "scrna", "seq", "v2"]);
  expect(tok("")).toEqual([]);
  expect(tok(undefined)).toEqual([]);
  // Non-ascii is a separator, not a token, so accents and CJK drop out entirely.
  expect(tok("café 日本")).toEqual(["caf"]);
});

test("idf falls as document frequency rises", () => {
  const common = Array.from({ length: 20 }, (_, i) => skill(`common-${i}`, { description: "shared word" }));
  const index = new Bm25Index(tiny([...common, skill("rare-one", { description: "unicorn" })]));
  expect(index.n).toBe(21);
  // log(1 + (N - df + 0.5) / (df + 0.5)) with df 1 vs df 20.
  const rare = index.score(["unicorn"], "rare-one");
  const shared = index.score(["shared"], "common-0");
  expect(rare).toBeGreaterThan(shared);
  expect(Math.log(1 + (21 - 1 + 0.5) / (1 + 0.5))).toBeCloseTo(2.6855773, 6);
});

test("id tokens count three times, so a name hit outranks a prose hit", () => {
  const graph = tiny([
    skill("harmony-batch", { description: "unrelated filler text about pipelines and files" }),
    skill("other-skill", { description: "harmony batch filler text about pipelines and files" }),
  ]);
  const index = new Bm25Index(graph);
  expect(index.score(tok("harmony batch"), "harmony-batch")).toBeGreaterThan(
    index.score(tok("harmony batch"), "other-skill"),
  );
  expect(index.topK("harmony batch", 2).map((r) => r.id)).toEqual(["harmony-batch", "other-skill"]);
});

test("domain labels and aliases are part of the document", () => {
  const graph = tiny(
    [
      skill("fitness-nutrition", { description: "tracks meals", aliases: ["calorie counter"] }),
      { id: "domain:health-fitness", type: "Domain", label: "health fitness" },
    ],
    [edge("fitness-nutrition", "in_domain", "domain:health-fitness")],
  );
  const index = new Bm25Index(graph);
  expect(index.score(tok("calorie counter"), "fitness-nutrition")).toBeGreaterThan(0);
  expect(index.score(tok("fitness"), "fitness-nutrition")).toBeGreaterThan(0);
  // Only Skill and ExpertProfile nodes are indexed at all.
  expect(index.n).toBe(1);
});

test("topK applies the success-rate prior after the cut", () => {
  const graph = tiny([
    skill("alpha-tool", { success_rate: 1 }),
    skill("beta-tool", { success_rate: null }),
    skill("gamma-tool"),
  ]);
  const index = new Bm25Index(graph);
  const raw = index.score(tok("alpha tool"), "alpha-tool");
  const [top] = index.topK("alpha tool", 3);
  expect(top?.id).toBe("alpha-tool");
  expect(top?.score).toBe(raw * 1.5);
  expect(top?.rank).toBe(1);
  // The prior never reorders: beta and gamma tie on "tool" and fall back to id descending.
  expect(index.topK("alpha tool", 3).map((r) => r.id)).toEqual(["alpha-tool", "gamma-tool", "beta-tool"]);
  // Skills with no query term score 0 and are dropped, however large k is.
  expect(index.topK("nothing matches here", 3)).toEqual([]);
});

test("ties break on id descending, as Python's sorted(reverse=True) does", () => {
  const graph = tiny([skill("aaa-tool"), skill("zzz-tool"), skill("mmm-tool")]);
  const index = new Bm25Index(graph);
  // Every skill scores identically on "tool", so only the id tie-break orders them.
  expect(index.topK("tool", 3).map((r) => r.id)).toEqual(["zzz-tool", "mmm-tool", "aaa-tool"]);
});
