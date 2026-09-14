import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Graph } from "./types";

/** Where build_kg.py writes: <root>/vault/graph/graph.json. */
export function graphPath(root: string): string {
  return join(root, "vault", "graph", "graph.json");
}

/**
 * Write the graph to vault/graph/graph.json, via a sibling .json.tmp so a reader never sees a
 * half-written file. Layout is json.dumps(indent=1) except that floats print as `1` where
 * Python printed `1.0` and non-ASCII stays raw instead of \uXXXX escaped.
 */
export function writeGraph(root: string, graph: Graph): string {
  const out = graphPath(root);
  mkdirSync(join(root, "vault", "graph"), { recursive: true });
  const tmp = `${out}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(graph, null, 1)}\n`, "utf8");
  renameSync(tmp, out);
  return out;
}
