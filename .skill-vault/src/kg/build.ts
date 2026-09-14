import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { collapseWhitespace, discoverSkills, MetadataError, universalNewlines } from "../catalog";
import {
  highPrecisionMentions,
  ngramHits,
  ngramIndex,
  PY_WS,
  pyCompare,
  pySorted,
  sliceCodePoints,
} from "./ngram";
import { loadNotesLayer } from "./notesLayer";
import { loadObservations } from "./observations";
import { parseRecipes } from "./recipes";
import {
  AssertionFileSchema,
  type Graph,
  type GraphEdge,
  type GraphNode,
  LexiconSchema,
  type Metrics,
  OntologySchema,
  type Provenance,
  type RecipeRecord,
  TaxonomySchema,
} from "./types";

const OBSERVED_WEIGHT = 0.05; // start below the 1.0 cap so repeats can accumulate
const DISPATCHER = "scientific-agents";

// build_kg.py read_frontmatter_description: its own reader, laxer than build.py's.
const FM_BLOCK = new RegExp(`^---[${PY_WS}]*\\n([\\s\\S]*?)\\n---[${PY_WS}]*\\n`);
const DESCRIPTION_RE = new RegExp(
  `(?:^|\\n)description:[${PY_WS}]*([\\s\\S]*?)(?=\\n[A-Za-z0-9_-]+:|(?![\\s\\S]))`,
);

/** Python round(): half-to-even on the exact binary value, where JS toFixed rounds half away. */
export function pyRound(value: number, digits: number): number {
  const scale = 10 ** digits;
  const twice = value * scale * 2;
  if (Number.isInteger(twice) && Math.abs(twice % 2) === 1) {
    const down = Math.floor(value * scale);
    return (down % 2 === 0 ? down : down + 1) / scale;
  }
  return Number(value.toFixed(digits));
}

/** The description as build_kg.py reads it: the first `description:` run in the frontmatter. */
export function readFrontmatterDescription(text: string): string {
  const block = FM_BLOCK.exec(text);
  if (!block) return "";
  const found = DESCRIPTION_RE.exec(block[1] ?? "");
  return collapseWhitespace(found?.[1] ?? "").replace(/^['"]+|['"]+$/g, "");
}

class GraphBuilder {
  readonly nodes = new Map<string, GraphNode>();
  private readonly edgeMap = new Map<string, GraphEdge>();

  constructor(private readonly rank: Map<string, number>) {}

  /** dict.setdefault(...).update(attrs): a re-declared node keeps the key order it was created with. */
  node(node: GraphNode): void {
    const prior = this.nodes.get(node.id);
    if (prior === undefined) this.nodes.set(node.id, node);
    else Object.assign(prior, node);
  }

  edge(
    src: string,
    rel: string,
    dst: string,
    provenance: Provenance,
    justification: string,
    weight = 1.0,
    symmetric = false,
  ): void {
    if (src === dst) return;
    const key = `${src}\u0000${rel}\u0000${dst}`;
    const prior = this.edgeMap.get(key);
    if (prior) {
      // Keep the strongest provenance; accumulate weight.
      if ((this.rank.get(provenance) ?? 0) > (this.rank.get(prior.provenance) ?? 0)) {
        prior.provenance = provenance;
        prior.justification = justification;
      }
      prior.weight = pyRound(Math.min(1.0, prior.weight + 0.05), 4);
    } else {
      this.edgeMap.set(key, {
        src,
        rel,
        dst,
        weight: pyRound(weight, 4),
        provenance,
        justification,
        status: provenance !== "PROPOSED" ? "accepted" : "proposed",
      });
    }
    if (symmetric) this.edge(dst, rel, src, provenance, justification, weight, false);
  }

  /** Edges in insertion order, which is what the by_provenance / by_relation counters see. */
  get edges(): GraphEdge[] {
    return [...this.edgeMap.values()];
  }
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Discipline assignment for the expert profiles. The taxonomy moved into .skill-vault/data/;
 * the old top-level path is a fallback that Task 13 removes.
 */
function loadDisciplines(root: string): {
  profiles: Map<string, { primary?: string | null; secondary: string[] }>;
  titles: Map<string, string>;
} {
  const moved = join(root, ".skill-vault", "data", "scientific-expert-taxonomy.json");
  const legacy = join(root, ".skill-vault", "scientific-expert-taxonomy.json");
  const path = existsSync(moved) ? moved : legacy;
  if (!existsSync(path)) return { profiles: new Map(), titles: new Map() };
  const tax = TaxonomySchema.parse(readJson(path));
  const titles = new Map(tax.disciplines.map((d) => [d.id, d.title ?? d.id] as const));
  return { profiles: new Map(Object.entries(tax.profiles)), titles };
}

/** Build the vault knowledge graph from skills/, vault/ and .skill-vault/. */
export function buildGraph(root: string): Graph {
  const ontologyDir = join(root, ".skill-vault", "ontology");
  const schema = OntologySchema.parse(readJson(join(ontologyDir, "schema.json")));
  const lexicon = LexiconSchema.parse(readJson(join(ontologyDir, "lexicon.json")));
  const window = schema.extraction_policy.body_window_bytes;
  const dfMax = schema.extraction_policy.distinctive_df_max;

  const entries = discoverSkills(root, { bundles: true, excludeTransient: false });
  const skillIds = entries.map((e) => e.id);
  const nameset = new Set(skillIds);
  const total = skillIds.length;
  if (total === 0) throw new MetadataError(`${root}: no skills found — is the root correct?`);

  const { profiles, titles: discTitles } = loadDisciplines(root);
  const bodies = new Map<string, string>();
  const descs = new Map<string, string>();
  const isProfile = new Map<string, boolean>();
  for (const entry of entries) {
    const text = universalNewlines(readFileSync(entry.file, "utf8"));
    bodies.set(entry.id, sliceCodePoints(text, window));
    descs.set(entry.id, readFrontmatterDescription(text));
    isProfile.set(entry.id, profiles.has(entry.id) && entry.id !== DISPATCHER);
  }
  const bodyOf = (sid: string): string => bodies.get(sid) ?? "";

  // Pass 1 — who names whom, plus document frequency for the IDF split.
  const nameIndex = ngramIndex(
    skillIds.map((sid) => [sid, sid] as const),
    true,
  );
  const rawMentions = new Map<string, Set<string>>();
  const df = new Map<string, number>();
  for (const sid of skillIds) {
    const hits = ngramHits(bodyOf(sid), nameIndex);
    rawMentions.set(sid, hits);
    for (const t of hits) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const threshold = total * dfMax;
  const generic = new Set(skillIds.filter((sid) => (df.get(sid) ?? 0) > threshold));

  const g = new GraphBuilder(new Map(Object.entries(schema.provenance_levels).map(([k, v]) => [k, v.rank])));
  const { domains, aliasMap, ambiguous } = loadNotesLayer(join(root, "vault", "notes"));
  const aliasesBySid = new Map<string, string[]>();
  for (const [alias, sid] of aliasMap) {
    const list = aliasesBySid.get(sid);
    if (list) list.push(alias);
    else aliasesBySid.set(sid, [alias]);
  }

  for (const sid of skillIds) {
    g.node({
      id: sid,
      type: isProfile.get(sid) ? "ExpertProfile" : "Skill",
      label: sid,
      description: descs.get(sid) ?? "",
      source: `skills/${sid}/SKILL.md`,
      aliases: pySorted(aliasesBySid.get(sid) ?? []),
      uses: 0,
      successes: 0,
      success_rate: null,
      last_used: null,
      deprecated: false,
    });
    for (const d of pySorted(domains.get(sid) ?? [])) {
      g.node({ id: d, type: "Domain", label: d.slice(d.indexOf(":") + 1) });
      g.edge(sid, "in_domain", d, "EXTRACTED", "domain from vault/notes layout");
    }
  }

  // references — two-tier, per the measured precision/recall trade-off
  let tier1 = 0;
  let tier2 = 0;
  for (const sid of skillIds) {
    for (const target of rawMentions.get(sid) ?? []) {
      if (target === sid || generic.has(target)) continue;
      g.edge(sid, "references", target, "EXTRACTED", `${target} named in ${sid}/SKILL.md body`, 1.0, true);
      tier1 += 1;
    }
    for (const target of highPrecisionMentions(bodyOf(sid), nameset)) {
      if (target === sid || !generic.has(target)) continue;
      g.edge(
        sid,
        "references",
        target,
        "EXTRACTED",
        `${target} referenced in code/link context in ${sid}/SKILL.md`,
        1.0,
        true,
      );
      tier2 += 1;
    }
  }

  // references via curated aliases — the vault's own controlled vocabulary
  const aliasIndex = ngramIndex(aliasMap);
  const aliasDf = new Map<string, number>();
  const aliasHits = new Map<string, Set<string>>();
  for (const sid of skillIds) {
    const found = ngramHits(bodyOf(sid), aliasIndex);
    found.delete(sid);
    aliasHits.set(sid, found);
    for (const t of found) aliasDf.set(t, (aliasDf.get(t) ?? 0) + 1);
  }
  let aliasEdges = 0;
  for (const sid of skillIds) {
    for (const target of aliasHits.get(sid) ?? []) {
      if ((aliasDf.get(target) ?? 0) > threshold) continue; // same IDF discipline as skill ids
      g.edge(
        sid,
        "references",
        target,
        "EXTRACTED",
        `curated alias of ${target} appears in ${sid}/SKILL.md`,
        1.0,
        true,
      );
      aliasEdges += 1;
    }
  }

  // in_discipline — expert profiles, from the taxonomy already in this repo
  let discEdges = 0;
  for (const [sid, spec] of profiles) {
    if (!g.nodes.has(sid)) continue;
    for (const did of [spec.primary, ...spec.secondary]) {
      if (!did) continue;
      g.node({ id: `discipline:${did}`, type: "Discipline", label: discTitles.get(did) ?? did });
      g.edge(sid, "in_discipline", `discipline:${did}`, "ASSERTED", "scientific-expert-taxonomy.json");
      discEdges += 1;
    }
  }

  // touches — artifact vocabulary, identified rather than string-matched
  const excluded = new Set(lexicon.excluded_terms.terms);
  const artPats: Array<{ aid: string; label: string; pattern: RegExp }> = [];
  for (const [aid, spec] of Object.entries(lexicon.artifacts)) {
    g.node({ id: aid, type: "Artifact", label: spec.label });
    if (!excluded.has(aid.slice(aid.indexOf(":") + 1))) {
      artPats.push({ aid, label: spec.label, pattern: new RegExp(spec.pattern, "i") });
    }
  }
  let touchCount = 0;
  for (const sid of skillIds) {
    if (isProfile.get(sid)) continue; // profiles wrap no tool and exchange no data
    for (const { aid, label, pattern } of artPats) {
      if (pattern.test(bodyOf(sid))) {
        g.edge(sid, "touches", aid, "EXTRACTED", `${label} named in ${sid}/SKILL.md`);
        touchCount += 1;
      }
    }
  }

  // recipes — hyperedges (ASSERTED) and step order (INFERRED direction, rules R2/R3)
  const recipes = parseRecipes(join(root, "vault", "recipes"), nameset);
  for (const [rid, r] of recipes) {
    g.node({ id: rid, type: "Recipe", label: r.label, source: r.source, steps: r.steps });
    for (const sid of r.members) g.edge(rid, "has_step", sid, "ASSERTED", `listed in ${r.source}`);
    for (let i = 0; i < r.steps.length; i++) {
      const a = r.steps[i] ?? "";
      for (const b of r.steps.slice(i + 1)) {
        // INFERRED, not ASSERTED: what the human authored is the step list (has_step); rule R2
        // deriving the pairwise co-occurrence from it is machinery on top of that.
        g.edge(a, "co_occurs_with", b, "INFERRED", `co-listed in ${r.label} (rule R2)`, 1.0, true);
      }
      const next = r.steps[i + 1];
      if (next !== undefined) {
        g.edge(
          a,
          "chains_to",
          next,
          "INFERRED",
          `consecutive steps ${i + 1}->${i + 2} in ${r.label} (rule R3)`,
        );
      }
    }
  }

  // curated assertions
  const assertDir = join(ontologyDir, "assertions");
  let asserted = 0;
  if (isDir(assertDir)) {
    const files = readdirSync(assertDir)
      .filter((name) => !name.startsWith(".") && name.endsWith(".json"))
      .sort(pyCompare);
    for (const name of files) {
      for (const e of AssertionFileSchema.parse(readJson(join(assertDir, name))).edges) {
        if (!g.nodes.has(e.src) || !g.nodes.has(e.dst)) {
          process.stderr.write(`skip assertion ${e.src} -${e.rel}-> ${e.dst} in ${name}: unknown endpoint\n`);
          continue;
        }
        g.edge(
          e.src,
          e.rel,
          e.dst,
          "ASSERTED",
          e.justification ?? `curated in ${name}`,
          e.weight ?? 1.0,
          e.symmetric ?? false,
        );
        asserted += 1;
      }
    }
  }

  // observations — node statistics and OBSERVED co-occurrence
  const episodes = loadObservations(join(root, ".skill-vault", "observations"));
  for (const ep of episodes) {
    const used = ep.used.filter((s): s is string => typeof s === "string" && g.nodes.has(s));
    const ok = ep.outcome === "success";
    for (const sid of used) {
      // Only skill nodes carry usage counters; anything else in `used` is not a usable episode.
      const n = g.nodes.get(sid);
      if (n?.uses === undefined || n.successes === undefined) continue;
      n.uses += 1;
      n.successes += ok ? 1 : 0;
      n.success_rate = pyRound(n.successes / n.uses, 4);
      const ts = ep.ts;
      if (typeof ts === "string" && ts && (n.last_used == null || ts > n.last_used)) n.last_used = ts;
    }
    if (!ok) continue;
    for (let i = 0; i < used.length; i++) {
      const a = used[i] ?? "";
      for (const b of used.slice(i + 1)) {
        g.edge(a, "co_occurs_with", b, "OBSERVED", "co-used in a successful episode", OBSERVED_WEIGHT, true);
      }
    }
  }
  // SkillGraph deprecation rule: >=20 uses at <15% success
  for (const n of g.nodes.values()) {
    if ((n.uses ?? 0) >= 20 && (n.success_rate ?? 0) < 0.15) n.deprecated = true;
  }

  // --- metrics
  // "Orphan" means no skill-to-skill relation. `touches` is deliberately not one: the artifact
  // a skill mentions does not connect it to anything usable.
  const edges = g.edges;
  const adjacency = new Map<string, Set<string>>();
  const link = (a: string, b: string): void => {
    const seen = adjacency.get(a);
    if (seen) seen.add(b);
    else adjacency.set(a, new Set([b]));
  };
  for (const e of edges) {
    if (
      (e.rel === "references" || e.rel === "co_occurs_with" || e.rel === "chains_to") &&
      e.provenance !== "PROPOSED"
    ) {
      link(e.src, e.dst);
      link(e.dst, e.src);
    }
  }
  const degrees = skillIds.map((sid) => {
    let n = 0;
    for (const d of adjacency.get(sid) ?? []) if (nameset.has(d)) n += 1;
    return n;
  });
  const orphans = skillIds.filter((_, i) => degrees[i] === 0);
  const byProvenance: Record<string, number> = {};
  const byRelation: Record<string, number> = {};
  for (const e of edges) {
    byProvenance[e.provenance] = (byProvenance[e.provenance] ?? 0) + 1;
    byRelation[e.rel] = (byRelation[e.rel] ?? 0) + 1;
  }

  const metrics: Metrics = {
    skills: total,
    expert_profiles: [...isProfile.values()].filter(Boolean).length,
    nodes: g.nodes.size,
    edges: edges.length,
    generic_names_blocked: generic.size,
    tier1_edges: tier1,
    tier2_edges: tier2,
    alias_edges: aliasEdges,
    discipline_edges: discEdges,
    ambiguous_aliases: ambiguous.size,
    artifact_edges: touchCount,
    asserted_edges: asserted,
    recipes: recipes.size,
    observations: episodes.length,
    mean_skill_degree: pyRound(degrees.reduce((a, b) => a + b, 0) / total, 2),
    median_skill_degree: [...degrees].sort((a, b) => a - b)[Math.floor(total / 2)] ?? 0,
    orphan_count: orphans.length,
    orphan_rate: pyRound(orphans.length / total, 4),
    by_provenance: byProvenance,
    by_relation: byRelation,
    // Stamped from the TBox so readers need no second copy of the vocabulary.
    retrievable_provenance: pySorted(
      Object.entries(schema.provenance_levels)
        .filter(([, v]) => v.retrievable)
        .map(([k]) => k),
    ),
  };

  return {
    schema_version: schema.schema_version,
    metrics,
    nodes: pySorted(g.nodes.keys()).map((k) => g.nodes.get(k) as GraphNode),
    edges: edges.sort(
      (a, b) => pyCompare(a.src, b.src) || pyCompare(a.rel, b.rel) || pyCompare(a.dst, b.dst),
    ),
    recipes: pySorted(recipes.keys()).map((k) => recipes.get(k) as RecipeRecord),
    orphans: pySorted(orphans),
    ambiguous_aliases: Object.fromEntries(pySorted(ambiguous.keys()).map((a) => [a, ambiguous.get(a) ?? []])),
  };
}
