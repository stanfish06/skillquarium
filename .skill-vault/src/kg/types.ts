import { z } from "zod";

/** provenance_levels in ontology/schema.json. */
export type Provenance = "ASSERTED" | "OBSERVED" | "EXTRACTED" | "INFERRED" | "PROPOSED";

export type NodeType = "Skill" | "ExpertProfile" | "Domain" | "Artifact" | "Discipline" | "Recipe";

/**
 * Key order is the emitted JSON key order, so build them as literals in this order:
 * skills carry every field, Recipe carries source + steps, the rest only id/type/label.
 */
export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  description?: string;
  source?: string;
  aliases?: string[];
  uses?: number;
  successes?: number;
  success_rate?: number | null;
  last_used?: string | null;
  deprecated?: boolean;
  steps?: string[];
}

export interface GraphEdge {
  src: string;
  rel: string;
  dst: string;
  weight: number;
  provenance: Provenance;
  justification: string;
  status: "accepted" | "proposed";
}

export interface RecipeRecord {
  id: string;
  label: string;
  source: string;
  /** Ordered steps: the first resolvable link of each numbered line. */
  steps: string[];
  /** Every link in the file, steps included. */
  members: string[];
}

export interface Metrics {
  skills: number;
  expert_profiles: number;
  nodes: number;
  edges: number;
  generic_names_blocked: number;
  tier1_edges: number;
  tier2_edges: number;
  alias_edges: number;
  discipline_edges: number;
  ambiguous_aliases: number;
  artifact_edges: number;
  asserted_edges: number;
  recipes: number;
  observations: number;
  mean_skill_degree: number;
  median_skill_degree: number;
  orphan_count: number;
  orphan_rate: number;
  by_provenance: Record<string, number>;
  by_relation: Record<string, number>;
  retrievable_provenance: string[];
}

export interface Graph {
  schema_version: number;
  metrics: Metrics;
  nodes: GraphNode[];
  edges: GraphEdge[];
  recipes: RecipeRecord[];
  orphans: string[];
  ambiguous_aliases: Record<string, string[]>;
}

/** ontology/schema.json, the TBox: only the parts build_kg.py reads. */
export const OntologySchema = z.object({
  schema_version: z.number(),
  provenance_levels: z.record(
    z.string(),
    z.object({ rank: z.number(), retrievable: z.boolean().optional() }),
  ),
  extraction_policy: z.object({
    body_window_bytes: z.number(),
    distinctive_df_max: z.number(),
  }),
});
export type Ontology = z.infer<typeof OntologySchema>;

/** ontology/lexicon.json, the artifact vocabulary. */
export const LexiconSchema = z.object({
  artifacts: z.record(z.string(), z.object({ label: z.string(), pattern: z.string() })),
  excluded_terms: z.object({ terms: z.array(z.string()) }),
});
export type Lexicon = z.infer<typeof LexiconSchema>;

/** data/scientific-expert-taxonomy.json: discipline assignment for the expert profiles. */
export const TaxonomySchema = z.object({
  disciplines: z.array(z.object({ id: z.string(), title: z.string().optional() })).default([]),
  profiles: z
    .record(
      z.string(),
      z.object({
        primary: z.string().nullish(),
        secondary: z.array(z.string()).default([]),
      }),
    )
    .default({}),
});

/** ontology/assertions/*.json: curated ASSERTED edges. */
export const AssertionFileSchema = z.object({
  edges: z
    .array(
      z.object({
        src: z.string(),
        rel: z.string(),
        dst: z.string(),
        justification: z.string().optional(),
        weight: z.number().optional(),
        symmetric: z.boolean().optional(),
      }),
    )
    .default([]),
});
