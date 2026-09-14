// Retrieval eval over data/retrieval-eval.jsonl: what each signal finds alone and fused.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { EmbedClient } from "../embed/client";
import { EMBED_DIR, type Manifest, readManifest } from "../embed/store";
import { expandFused, gatherSignals, type QueryDeps, type QueryOptions } from "./query";

export const EVAL_SET = ".skill-vault/data/retrieval-eval.jsonl";

/** Committed embeddings of every EVAL_SET query, so the eval scores without an endpoint. */
export const QUERY_VECTORS = ".skill-vault/test/fixtures/eval-query-vectors.json";

export interface EvalRow {
  query: string;
  expect: string[];
}

export interface EvalScore {
  name: string;
  /** Mean over queries of |expect ∩ top k| / |expect|. */
  recall: number;
  /** Mean over queries of 1 / (position of the first expected id), 0 when none is in the top k. */
  mrr: number;
}

export interface EvalReport {
  k: number;
  queries: number;
  /** Each signal alone, then the fusion, then the fused list after graph expansion. */
  scores: EvalScore[];
  rows: { query: string; expect: string[]; final: string[]; recall: number }[];
  notices: string[];
}

export function readEvalSet(root: string): EvalRow[] {
  return readFileSync(join(root, EVAL_SET), "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as EvalRow);
}

const QueryVectorsSchema = z.strictObject({
  model: z.string(),
  dim: z.number().int().positive(),
  vectors: z.record(z.string(), z.array(z.number())),
});

export type QueryVectors = z.infer<typeof QueryVectorsSchema>;

export function readQueryVectors(root: string, path = join(root, QUERY_VECTORS)): QueryVectors {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(`cached query vectors ${path}: ${(e as Error).message}`);
  }
  const parsed = QueryVectorsSchema.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.map(String).join(".")}: ${i.message}`);
    throw new Error(`cached query vectors ${path}: ${issues.join("; ")}`);
  }
  for (const [query, row] of Object.entries(parsed.data.vectors)) {
    if (row.length !== parsed.data.dim) {
      throw new Error(
        `cached query vectors ${path}: "${query}" has ${row.length} values, expected dim ${parsed.data.dim}`,
      );
    }
  }
  return parsed.data;
}

/**
 * Why the cache cannot stand in for the endpoint against this index, or null. A cache built from
 * a different model or width still produces a full set of numbers, just meaningless ones, so the
 * eval refuses it rather than reporting them.
 */
export function staleQueryVectors(cache: QueryVectors, manifest: Manifest | null): string | null {
  if (manifest === null) {
    return `cached query vectors are unusable: no index manifest at ${join(EMBED_DIR, "manifest.json")}`;
  }
  const wrong: string[] = [];
  if (cache.model !== manifest.model)
    wrong.push(`model '${cache.model}' but the index is '${manifest.model}'`);
  if (cache.dim !== manifest.dim) wrong.push(`dim ${cache.dim} but the index is ${manifest.dim}`);
  if (wrong.length === 0) return null;
  return `cached query vectors are stale: ${wrong.join(", ")}; re-embed the eval queries`;
}

/**
 * An EmbedClient reading the committed cache instead of the network. Throws on a cache that does
 * not match the index, and on a query it has no row for, so a missing row cannot score as a miss.
 */
export function cachedEmbed(cache: QueryVectors, manifest: Manifest | null): EmbedClient {
  const stale = staleQueryVectors(cache, manifest);
  if (stale !== null) throw new Error(stale);
  return {
    embed: async (inputs) =>
      inputs.map((text) => {
        const row = cache.vectors[text];
        if (row === undefined) throw new Error(`cached query vectors have no row for "${text}"`);
        return Float32Array.from(row);
      }),
    modelName: async () => cache.model,
  };
}

/** The committed cache, checked against the index it is about to be scored against. */
export function offlineEmbed(root: string, path = join(root, QUERY_VECTORS)): EmbedClient {
  return cachedEmbed(readQueryVectors(root, path), readManifest(root));
}

function recallAt(got: readonly string[], expect: readonly string[]): number {
  if (expect.length === 0) return 0;
  return expect.filter((id) => got.includes(id)).length / expect.length;
}

function reciprocalRank(got: readonly string[], expect: readonly string[]): number {
  const first = got.findIndex((id) => expect.includes(id));
  return first < 0 ? 0 : 1 / (first + 1);
}

/**
 * One pass per query: the signals are gathered once and every list is scored off that pass, so
 * the semantic signal costs exactly one embedding request per query and not one per list.
 *
 * `embed` overrides where query vectors come from; pass `offlineEmbed(root)` to score against the
 * committed cache with no network. Omitted, the eval embeds live through `deps`.
 */
export async function runEval(
  root: string,
  deps: QueryDeps,
  opts: QueryOptions,
  embed?: EmbedClient,
): Promise<EvalReport> {
  const source: QueryDeps = embed === undefined ? deps : { ...deps, embed: () => embed };
  const rows = readEvalSet(root);
  const totals = new Map<string, { recall: number; mrr: number }>();
  const notices = new Set<string>();
  const detail: EvalReport["rows"] = [];

  function record(name: string, got: string[], expect: string[]): void {
    const total = totals.get(name) ?? { recall: 0, mrr: 0 };
    total.recall += recallAt(got, expect);
    total.mrr += reciprocalRank(got, expect);
    totals.set(name, total);
  }

  for (const row of rows) {
    const gathered = await gatherSignals(root, row.query, opts, source);
    for (const notice of gathered.notices) notices.add(notice);
    for (const signal of gathered.signals) {
      record(
        signal.name,
        signal.results.slice(0, opts.k).map((r) => r.id),
        row.expect,
      );
    }
    const { results, fused } = expandFused(source, gathered.signals, opts.k);
    record(
      "fused",
      fused.slice(0, opts.k).map((r) => r.id),
      row.expect,
    );
    const final = results.map((r) => r.skill);
    record("final", final, row.expect);
    detail.push({ query: row.query, expect: row.expect, final, recall: recallAt(final, row.expect) });
  }

  const n = Math.max(1, rows.length);
  return {
    k: opts.k,
    queries: rows.length,
    scores: [...totals].map(([name, t]) => ({ name, recall: t.recall / n, mrr: t.mrr / n })),
    rows: detail,
    notices: [...notices],
  };
}
