// Retrieval-side view of vault/graph/graph.json: the port of query.py VaultGraph.__init__.
import { readFileSync } from "node:fs";
import { pySorted } from "../kg/ngram";
import type { GraphEdge, GraphNode, RecipeRecord } from "../kg/types";

/** query.py SKILL_TYPES: the only node types retrieval may return. */
const SKILL_TYPES = new Set<string>(["Skill", "ExpertProfile"]);

/** query.py RETRIEVABLE_FALLBACK, for graphs built before metrics carried the field. */
const RETRIEVABLE_FALLBACK = ["ASSERTED", "OBSERVED", "EXTRACTED", "INFERRED"];

const NO_TARGETS: ReadonlySet<string> = new Set<string>();

/** relation -> source id -> target ids. */
export type Adjacency = Map<string, Map<string, Set<string>>>;

export interface VaultGraph {
  nodes: Map<string, GraphNode>;
  /** Skill and ExpertProfile ids in node file order. */
  skills: string[];
  recipes: RecipeRecord[];
  out: Adjacency;
  inn: Adjacency;
  /** Every edge, retrievable or not — what the CLI header prints. */
  edgeCount: number;
}

function link(adjacency: Adjacency, rel: string, from: string, to: string): void {
  let bySource = adjacency.get(rel);
  if (bySource === undefined) {
    bySource = new Map<string, Set<string>>();
    adjacency.set(rel, bySource);
  }
  const targets = bySource.get(from);
  if (targets === undefined) bySource.set(from, new Set([to]));
  else targets.add(to);
}

/** The parts of graph.json retrieval reads; a full Graph satisfies it. */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  recipes?: RecipeRecord[];
  metrics?: { retrievable_provenance?: string[] };
}

/** Build the retrieval view from an already-parsed graph. */
export function buildGraph(data: GraphData): VaultGraph {
  const nodes = new Map<string, GraphNode>();
  for (const node of data.nodes) nodes.set(node.id, node);

  // PROPOSED edges are excluded either way (shape P4/S4); the vocabulary itself lives in the TBox.
  const retrievable = new Set<string>(
    data.metrics?.retrievable_provenance?.length ? data.metrics.retrievable_provenance : RETRIEVABLE_FALLBACK,
  );
  const out: Adjacency = new Map();
  const inn: Adjacency = new Map();
  for (const edge of data.edges) {
    if (!retrievable.has(edge.provenance)) continue;
    link(out, edge.rel, edge.src, edge.dst);
    link(inn, edge.rel, edge.dst, edge.src);
  }

  return {
    nodes,
    skills: data.nodes.filter((n) => SKILL_TYPES.has(n.type)).map((n) => n.id),
    recipes: data.recipes ?? [],
    out,
    inn,
    edgeCount: data.edges.length,
  };
}

export function loadGraph(path: string): VaultGraph {
  return buildGraph(JSON.parse(readFileSync(path, "utf8")) as GraphData);
}

export function targets(adjacency: Adjacency, rel: string, id: string): ReadonlySet<string> {
  return adjacency.get(rel)?.get(id) ?? NO_TARGETS;
}

export function isSkill(graph: VaultGraph, id: string): boolean {
  const node = graph.nodes.get(id);
  return node !== undefined && SKILL_TYPES.has(node.type);
}

/**
 * query.py neighbours(): skill-typed nodes reachable over `rels` in either direction.
 * Sorted here rather than at the call sites, which is where query.py sorts it.
 */
export function neighbours(graph: VaultGraph, id: string, rels: readonly string[]): string[] {
  const found = new Set<string>();
  for (const rel of rels) {
    for (const target of targets(graph.out, rel, id)) found.add(target);
    for (const source of targets(graph.inn, rel, id)) found.add(source);
  }
  return pySorted([...found].filter((x) => isSkill(graph, x)));
}

/** `domain:analytics-engineering` -> `analytics-engineering`, sorted. */
export function domainsOf(graph: VaultGraph, id: string): string[] {
  return pySorted([...targets(graph.out, "in_domain", id)].map(stripPrefix));
}

export function stripPrefix(qualified: string): string {
  return qualified.slice(qualified.indexOf(":") + 1);
}
