// Retrieval eval over data/retrieval-eval.jsonl: what each model-free signal finds alone, what the
// pipeline returns without the vector index, and what the semantic expansion adds on top.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expandFused, gatherSignals, type QueryDeps, type QueryOptions } from "./query";

export const EVAL_SET = ".skill-vault/data/retrieval-eval.jsonl";

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
  /** Each signal alone, their fusion, the model-free pipeline, then the same plus similarity. */
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

function recallAt(got: readonly string[], expect: readonly string[]): number {
  if (expect.length === 0) return 0;
  return expect.filter((id) => got.includes(id)).length / expect.length;
}

function reciprocalRank(got: readonly string[], expect: readonly string[]): number {
  const first = got.findIndex((id) => expect.includes(id));
  return first < 0 ? 0 : 1 / (first + 1);
}

/**
 * One pass per query: the signals are gathered once and every list is scored off that pass. The
 * pipeline is expanded twice, once with the vector index and once without, so `semantic` reads as
 * the delta the similarity expansion is worth over a run that never opens the index at all.
 * Nothing here embeds anything, so the eval scores the same with or without an endpoint.
 */
export async function runEval(root: string, deps: QueryDeps, opts: QueryOptions): Promise<EvalReport> {
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
    const gathered = await gatherSignals(root, row.query, opts, deps);
    for (const notice of gathered.notices) notices.add(notice);
    for (const signal of gathered.signals) {
      record(
        signal.name,
        signal.results.slice(0, opts.k).map((r) => r.id),
        row.expect,
      );
    }
    const bare = expandFused(deps, gathered.signals, opts.k, null);
    record(
      "fused",
      bare.fused.slice(0, opts.k).map((r) => r.id),
      row.expect,
    );
    record(
      "modelfree",
      bare.results.map((r) => r.skill),
      row.expect,
    );
    const expanded =
      gathered.index === null ? bare : expandFused(deps, gathered.signals, opts.k, gathered.index);
    const final = expanded.results.map((r) => r.skill);
    record("semantic", final, row.expect);
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
