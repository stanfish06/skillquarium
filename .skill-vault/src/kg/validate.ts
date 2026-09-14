import type { Graph, GraphEdge, GraphNode, Metrics } from "./types";

/**
 * Two independent catalogues, kept apart because a structural violation and a missing capability
 * have different repair paths:
 *
 *   SHAPES  P-prefixed structural constraints over the JSON graph.
 *   CQ      competency questions. A question the graph cannot yet answer reports NOT_YET rather
 *           than FAIL, so the roadmap stays visible instead of hiding behind a red build.
 *   EMBED   whether vault/embeddings still matches the skills on disk.
 *
 * Only FAIL fails the build.
 */

export type Status = "PASS" | "FAIL" | "WARN" | "NOT_YET";

export interface Row {
  kind: string;
  id: string;
  status: Status;
  detail: string;
}

export interface Report {
  rows: Row[];
}

/** ExpertProfile is a subclass of Skill. */
const SKILL_TYPES = new Set(["Skill", "ExpertProfile"]);
/** Measured on the description-only graph this replaces. */
const ORPHAN_BASELINE = 0.481;
/** Design target. */
const ORPHAN_GATE = 0.05;

/** ontology/lexicon.json, the two fields P7 reads. */
export interface LexiconTerms {
  artifacts: Record<string, { label?: string }>;
  ambiguous_terms: Record<string, unknown>;
}

/** vault/embeddings against the skills on disk; null when there is no manifest to compare to. */
export interface EmbedState {
  /** Skill ids whose SKILL.md hash differs from the manifest, or that the manifest never saw. */
  stale: string[];
  total: number;
}

/** What the checks need beside the graph itself; loadDeps in validateCommand.ts reads it. */
export interface ValidateDeps {
  /** schema.json provenance_levels: the names P3 accepts. */
  provenance: Set<string>;
  /** provenance names schema.json marks retrievable, for the P4 gate. */
  retrievable: Set<string>;
  lexicon: LexiconTerms | null;
  embeddings: EmbedState | null;
}

type RelMap = Map<string, Map<string, Set<string>>>;

interface Index {
  nodes: Map<string, GraphNode>;
  out: RelMap;
  inn: RelMap;
}

function index(graph: Graph): Index {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const out: RelMap = new Map();
  const inn: RelMap = new Map();
  const put = (m: RelMap, key: string, rel: string, value: string): void => {
    let rels = m.get(key);
    if (!rels) {
      rels = new Map();
      m.set(key, rels);
    }
    let set = rels.get(rel);
    if (!set) {
      set = new Set();
      rels.set(rel, set);
    }
    set.add(value);
  };
  for (const e of graph.edges) {
    put(out, e.src, e.rel, e.dst);
    put(inn, e.dst, e.rel, e.src);
  }
  return { nodes, out, inn };
}

const EMPTY: ReadonlySet<string> = new Set();

function rel(m: RelMap, id: string, name: string): ReadonlySet<string> {
  return m.get(id)?.get(name) ?? EMPTY;
}

/** Python `{x:.N%}`. */
function pct(x: number, digits: number): string {
  return `${(x * 100).toFixed(digits)}%`;
}

/** Python repr of a list of strings: ['a', 'b']. */
function pyList(items: readonly string[]): string {
  return `[${items.map((s) => `'${s}'`).join(", ")}]`;
}

/** Python repr of a list of 2-tuples: [('a', 'b')]. */
function pyPairs(pairs: readonly (readonly [string, string])[]): string {
  return `[${pairs.map(([a, b]) => `('${a}', '${b}')`).join(", ")}]`;
}

function byCodePoint(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function checkShapes(graph: Graph, deps: ValidateDeps, idx: Index, add: AddRow): void {
  const { nodes, out } = idx;
  const skills = graph.nodes.filter((n) => SKILL_TYPES.has(n.type));

  const missingDomain = skills.filter((n) => rel(out, n.id, "in_domain").size === 0).map((n) => n.id);
  add(
    "SHAPES",
    "P1 in_domain>=1",
    missingDomain.length ? "FAIL" : "PASS",
    `${missingDomain.length} skills without a domain` +
      (missingDomain.length ? ` e.g. ${pyList(missingDomain.slice(0, 3))}` : ""),
  );

  const rate = graph.metrics.orphan_rate;
  add(
    "SHAPES",
    "P2 orphan rate",
    rate < ORPHAN_GATE ? "PASS" : rate < ORPHAN_BASELINE ? "WARN" : "FAIL",
    `${pct(rate, 1)} vs baseline ${pct(ORPHAN_BASELINE, 1)}, gate ${pct(ORPHAN_GATE, 0)} ` +
      `(${graph.metrics.orphan_count} skills)`,
  );

  const bad = graph.edges.filter((e) => !deps.provenance.has(e.provenance) || !e.justification);
  add(
    "SHAPES",
    "P3 provenance",
    bad.length ? "FAIL" : "PASS",
    `${bad.length} edges missing provenance or justification`,
  );

  // P4: PROPOSED must never be retrievable; if it is, every PROPOSED edge has leaked, and the
  // declaration itself counts as one leak when no such edge exists yet.
  const retrievable = new Set(graph.metrics.retrievable_provenance ?? []);
  const proposed = graph.edges.filter((e) => e.provenance === "PROPOSED");
  const gateOpen = retrievable.has("PROPOSED") || deps.retrievable.has("PROPOSED");
  const leaked = gateOpen
    ? Math.max(proposed.length, 1)
    : proposed.filter((e) => e.status !== "proposed").length;
  add(
    "SHAPES",
    "P4 PROPOSED gate",
    leaked ? "FAIL" : "PASS",
    `${leaked} unreviewed edges marked retrievable`,
  );

  // P5: DFS colouring over chains_to. Start order follows the Python, where P1 appends every
  // skill id to the edge sources it already walked. A cycle is a WARN: recipes may legitimately
  // loop, and a loop degrades ordering rather than corrupting the graph.
  const starts = [...out.keys(), ...skills.map((n) => n.id).filter((id) => !out.has(id))];
  const colour = new Map<string, number>();
  const cycles: [string, string][] = [];
  const walk = (u: string): void => {
    colour.set(u, 1);
    for (const v of rel(out, u, "chains_to")) {
      if (colour.get(v) === 1) cycles.push([u, v]);
      else if (!colour.get(v)) walk(v);
    }
    colour.set(u, 2);
  };
  for (const s of starts) if (!colour.get(s)) walk(s);
  add(
    "SHAPES",
    "P5 chains acyclic",
    cycles.length ? "WARN" : "PASS",
    `${cycles.length} back-edges${cycles.length ? ` e.g. ${pyPairs(cycles.slice(0, 2))}` : ""}`,
  );

  // Reverse lookup through the index: `out` already de-duplicates the pairs.
  const altPairs: [string, string][] = [];
  for (const [src, rels] of out) {
    for (const dst of rels.get("alternative_to") ?? []) altPairs.push([src, dst]);
  }
  const asym = altPairs.filter(([src, dst]) => !rel(out, dst, "alternative_to").has(src));
  add(
    "SHAPES",
    "P6 alt symmetric",
    asym.length ? "FAIL" : "PASS",
    `${asym.length} asymmetric alternative_to edges`,
  );

  // P7: two artifacts claiming the same surface term make extraction a coin flip, unless the
  // lexicon declares the term ambiguous (which stops extraction from the bare token).
  const ambiguousAliases = Object.keys(graph.ambiguous_aliases ?? {}).length;
  const lexicon = deps.lexicon;
  const collisions = new Map<string, string[]>();
  let flagged = 0;
  if (lexicon) {
    flagged = Object.keys(lexicon.ambiguous_terms).length;
    const byTerm = new Map<string, Set<string>>();
    for (const [aid, spec] of Object.entries(lexicon.artifacts)) {
      // The label and the id's local part are both surface terms extraction can match on.
      const local = aid.slice(aid.indexOf(":") + 1).replaceAll("-", " ");
      for (const raw of [spec.label ?? "", local]) {
        const term = raw.trim().toLowerCase();
        if (!term) continue;
        let ids = byTerm.get(term);
        if (!ids) {
          ids = new Set();
          byTerm.set(term, ids);
        }
        ids.add(aid);
      }
    }
    const declared = new Set(Object.keys(lexicon.ambiguous_terms).map((t) => t.toLowerCase()));
    for (const [term, ids] of byTerm) {
      if (ids.size > 1 && !declared.has(term)) collisions.set(term, [...ids].sort(byCodePoint));
    }
  }
  add(
    "SHAPES",
    "P7 term ambiguity",
    collisions.size ? "FAIL" : "PASS",
    `${ambiguousAliases} ambiguous aliases parked; ` +
      (collisions.size
        ? `${collisions.size} unflagged artifact-term collisions ${pyList([...collisions.keys()].slice(0, 3))}`
        : `${flagged} flagged artifact terms, no unflagged collisions`),
  );

  const dangling = (graph.recipes ?? []).flatMap((r) => r.members.filter((s) => !nodes.has(s)));
  add(
    "SHAPES",
    "P8 recipe steps",
    dangling.length ? "FAIL" : "PASS",
    `${dangling.length} recipe steps do not resolve to a skill`,
  );
}

function checkCqs(graph: Graph, deps: ValidateDeps, idx: Index, add: AddRow): void {
  const { nodes, out, inn } = idx;
  const isSkill = (id: string): boolean => SKILL_TYPES.has(nodes.get(id)?.type ?? "");
  /** Skill neighbours over `rels`, in either direction. */
  const neigh = (sid: string, rels: string[]): Set<string> => {
    const found = new Set<string>();
    for (const r of rels) {
      for (const x of rel(out, sid, r)) if (isSkill(x)) found.add(x);
      for (const x of rel(inn, sid, r)) if (isSkill(x)) found.add(x);
    }
    return found;
  };

  // CQ1 — can we walk a chain from FASTQ-touching skills toward pathway analysis?
  const fastq = new Set(
    graph.edges.filter((e) => e.rel === "touches" && e.dst === "artifact:fastq").map((e) => e.src),
  );
  const seen = new Set(fastq);
  let frontier = new Set(fastq);
  for (let hop = 0; hop < 4; hop++) {
    const next = new Set<string>();
    for (const s of frontier) {
      for (const x of rel(out, s, "chains_to")) next.add(x);
      for (const x of rel(out, s, "co_occurs_with")) next.add(x);
    }
    frontier = new Set([...next].filter((x) => !seen.has(x)));
    for (const x of next) seen.add(x);
  }
  const reached = ["pathway-enrichment", "pathway-enricher"].filter((x) => seen.has(x)).sort(byCodePoint);
  add(
    "CQ",
    "CQ1 fastq->pathway",
    reached.length ? "PASS" : "NOT_YET",
    `${fastq.size} FASTQ skills reach ${seen.size} skills in 4 hops; pathway endpoint ` +
      (reached.length ? `reached: ${reached.join(", ")}` : "not reached"),
  );

  // CQ2 — alternative_to requires Capability+Tool, which Phase 1 does not populate.
  const alts = graph.edges.filter((e) => e.rel === "alternative_to");
  add(
    "CQ",
    "CQ2 alternatives",
    alts.length ? "PASS" : "NOT_YET",
    `${alts.length} alternative_to edges — rule R4 is disabled until Capability and Tool are ` +
      "populated (Phase 4); firing it now would assert near-equivalence on no evidence",
  );

  // CQ3 — foundations of a skill
  const probe = "scvi-tools";
  const found = nodes.has(probe) ? neigh(probe, ["references", "co_occurs_with"]) : new Set<string>();
  const sample = [...found].sort(byCodePoint).slice(0, 5);
  add(
    "CQ",
    "CQ3 prerequisites",
    found.size >= 3 ? "PASS" : "NOT_YET",
    `${probe} -> ${found.size} related (${sample.join(", ")}${found.size > 5 ? "..." : ""})`,
  );

  // CQ4 — capability lookup
  const caps = graph.nodes.filter((n) => (n.type as string) === "Capability");
  add(
    "CQ",
    "CQ4 by capability",
    caps.length ? "PASS" : "NOT_YET",
    `${caps.length} Capability nodes — population needs curation or the gated LLM pass ` +
      "(measured: n-gram mining returns template boilerplate)",
  );

  // CQ5 — set completion: the HYSET failure this design exists to fix
  const recipes = (graph.recipes ?? []).filter((r) => r.steps.length >= 2);
  let ok = 0;
  for (const r of recipes) {
    const seed = r.steps[0];
    if (seed === undefined) continue;
    const recovered = neigh(seed, ["co_occurs_with", "chains_to"]);
    if (r.steps.slice(1).some((s) => recovered.has(s))) ok++;
  }
  add(
    "CQ",
    "CQ5 set completion",
    recipes.length && ok === recipes.length ? "PASS" : ok ? "WARN" : "NOT_YET",
    `${ok}/${recipes.length} recipes recoverable from their first step alone`,
  );

  // CQ6 — gap mining: this is the query that makes the vault grow
  const usedArt = new Set(graph.edges.filter((e) => e.rel === "touches").map((e) => e.dst));
  const unusedArt = graph.nodes.filter((n) => n.type === "Artifact" && !usedArt.has(n.id));
  add(
    "CQ",
    "CQ6 gaps",
    "PASS",
    `${(graph.orphans ?? []).length} unconnected skills, ${unusedArt.length} artifacts with ` +
      "no skill — this is the growth queue, not a failure",
  );

  // CQ7 — staleness / failing skills
  const used = graph.nodes.filter((n) => (n.uses ?? 0) > 0);
  const deprecated = graph.nodes.filter((n) => n.deprecated);
  add(
    "CQ",
    "CQ7 staleness",
    used.length ? "PASS" : "NOT_YET",
    `${used.length} skills have usage data, ${deprecated.length} deprecated — needs observation ` +
      "ingestion (Phase 3)",
  );

  // CQ8 — ontology/cq/cq8-cross-domain.rq asks which domains are most cross-linked: it counts
  // `references` edges whose two endpoints sit in different domains, grouped by domain, ordered
  // by count. Over the JSON graph the question is answerable once a chains_to edge joins two
  // skills with no domain in common; the ranking rides along in the detail.
  const domains = (id: string): ReadonlySet<string> => rel(out, id, "in_domain");
  const crossChains = graph.edges.filter((e: GraphEdge) => {
    if (e.rel !== "chains_to" || !isSkill(e.src) || !isSkill(e.dst)) return false;
    const a = domains(e.src);
    const b = domains(e.dst);
    return a.size > 0 && b.size > 0 && ![...a].some((d) => b.has(d));
  });
  const crossings = new Map<string, number>();
  for (const e of graph.edges) {
    if (e.rel !== "references") continue;
    for (const d of domains(e.src)) {
      for (const o of domains(e.dst)) {
        if (d !== o) crossings.set(d, (crossings.get(d) ?? 0) + 1);
      }
    }
  }
  const top = [...crossings]
    .sort((a, b) => b[1] - a[1] || byCodePoint(a[0], b[0]))
    .slice(0, 3)
    .map(([d, c]) => `${d} (${c})`);
  add(
    "CQ",
    "CQ8 cross-domain",
    crossChains.length ? "PASS" : "NOT_YET",
    `${crossChains.length} chains_to edges join skills with disjoint domains; top domains by ` +
      `references crossings: ${top.length ? top.join(", ") : "none"}`,
  );

  // EMBED — never FAIL: CI updates skills daily without endpoint access, so stale vectors are a
  // reminder to re-run embed, not a broken build.
  const em = deps.embeddings;
  if (!em) {
    add("EMBED", "stale vectors", "NOT_YET", "no embedding manifest — run embed first");
  } else if (em.stale.length === 0) {
    add("EMBED", "stale vectors", "PASS", `${em.total} skills match the manifest`);
  } else {
    add(
      "EMBED",
      "stale vectors",
      "WARN",
      `${em.stale.length}/${em.total} skills changed since embedding — run embed`,
    );
  }
}

type AddRow = (kind: string, id: string, status: Status, detail: string) => void;

export function validateGraph(graph: Graph, deps: ValidateDeps): Report {
  const rows: Row[] = [];
  const add: AddRow = (kind, id, status, detail) => {
    rows.push({ kind, id, status, detail });
  };
  const idx = index(graph);
  checkShapes(graph, deps, idx, add);
  checkCqs(graph, deps, idx, add);
  return { rows };
}

export function failed(report: Report): Row[] {
  return report.rows.filter((r) => r.status === "FAIL");
}

const ICON: Record<Status, string> = { PASS: "ok  ", FAIL: "FAIL", WARN: "warn", NOT_YET: "todo" };

/** The Python's grouped layout: a blank line and the kind, then one padded row per check. */
export function renderReport(report: Report, metrics: Pick<Metrics, "skills" | "nodes" | "edges">): string[] {
  const lines = [
    `vault knowledge graph — ${metrics.skills} skills, ${metrics.nodes} nodes, ${metrics.edges} edges`,
  ];
  const width = report.rows.length ? Math.max(...report.rows.map((r) => r.id.length)) : 4;
  let last: string | undefined;
  for (const r of report.rows) {
    if (r.kind !== last) {
      lines.push("", r.kind);
      last = r.kind;
    }
    lines.push(`  [${ICON[r.status]}] ${r.id.padEnd(width)}  ${r.detail}`);
  }
  const bad = failed(report).length;
  const warn = report.rows.filter((r) => r.status === "WARN").length;
  const notYet = report.rows.filter((r) => r.status === "NOT_YET").length;
  lines.push(
    "",
    `${bad ? "FAILED" : "OK"}: ${bad} violation(s), ${warn} warning(s), ${notYet} not-yet-answerable`,
  );
  return lines;
}
