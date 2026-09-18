import { existsSync } from "node:fs";
import type { Command, Context } from "../cli";
import { graphPath } from "../kg/write";
import type { Tokenizer } from "./bm25";
import { loadBpeTokenizer } from "./bpe";
import type { EvalReport } from "./evalSet";
import { runEval } from "./evalSet";
import { destroyFinder, type FuzzyRanker, fffRanker } from "./fff";
import { loadGraph } from "./graph";
import { grepSkills } from "./grep";
import { type HybridResult, type QueryDeps, type QueryOptions, runQuery, SIGNAL_ORDER } from "./query";
import { loadVectorIndex, type VectorIndex } from "./vectors";

interface CommandModule {
  run: Command;
  help: string;
}

const queryHelp = `usage: skillquarium [--json] query <text...> [--k N] [--no-semantic] [--no-fuzzy] [--no-bpe] [--explain] [--eval]

Retrieve skills by fusing BM25 over the graph with fuzzy path search, then expanding those
seeds through the knowledge graph and through the nearest skills in the committed vectors.
The query text is never embedded, so no embedding endpoint is contacted.

After that list, up to config query.bpeExtra more skills are appended from BM25 over the word
pieces of the model 'skillquarium tokenizer' trains, where the list lacks them. They are tagged
[bpe #N]; nothing before them moves.

  --k N           results to return (default: config query.k)
  --no-semantic   skip the similarity expansion; the vector index is not read
  --no-fuzzy      skip the fff path signal
  --no-bpe        append nothing from the BPE model; the list is exactly the ASCII one
  --explain       add each result's per-signal rank, fused contribution and cosine
  --eval          score the pipeline over data/retrieval-eval.jsonl instead of querying`;

const grepHelp = `usage: skillquarium [--json] grep <pattern> [-- rg flags]

Search the text of skills/ with ripgrep, or with the fff index when rg is not installed.
Results are grouped by skill.`;

interface QueryArgs extends QueryOptions {
  text: string;
  eval: boolean;
}

class UsageError extends Error {}

function parseQueryArgs(args: string[], defaultK: number): QueryArgs {
  const words: string[] = [];
  const parsed: QueryArgs = {
    text: "",
    k: defaultK,
    semantic: true,
    fuzzy: true,
    explain: false,
    bpe: true,
    eval: false,
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? "";
    let k: string | undefined;
    if (arg === "--k") k = args[++i];
    else if (arg.startsWith("--k=")) k = arg.slice("--k=".length);
    else if (arg === "--no-semantic") parsed.semantic = false;
    else if (arg === "--no-fuzzy") parsed.fuzzy = false;
    else if (arg === "--no-bpe") parsed.bpe = false;
    else if (arg === "--explain") parsed.explain = true;
    else if (arg === "--eval") parsed.eval = true;
    else if (arg.startsWith("--")) throw new UsageError(`unknown option ${arg}`);
    else {
      words.push(arg);
      continue;
    }
    if (k === undefined) continue;
    const value = Number(k);
    if (!Number.isInteger(value) || value <= 0) throw new UsageError("--k must be a positive integer");
    parsed.k = value;
  }
  parsed.text = words.join(" ");
  if (parsed.text === "" && !parsed.eval) throw new UsageError("a query is required");
  return parsed;
}

/** Loaders run only for the signals that are on, so --no-semantic never reads the index. */
async function queryDeps(ctx: Context): Promise<QueryDeps> {
  const path = graphPath(ctx.root);
  if (!existsSync(path)) throw new UsageError(`no graph at ${path} — run build first`);
  const cfg = await ctx.config();
  let ranker: FuzzyRanker | undefined;
  let vectors: VectorIndex | null | undefined;
  let bpe: Tokenizer | null | undefined;
  return {
    graph: loadGraph(path),
    bpe: {
      tokenizer: () => {
        if (bpe === undefined) bpe = loadBpeTokenizer(ctx.root);
        return bpe;
      },
      extra: cfg.query.bpeExtra,
    },
    // Read once per process: --eval asks 40 times and the index is one file per skill.
    vectors: () => {
      if (vectors === undefined) vectors = loadVectorIndex(ctx.root);
      return vectors;
    },
    fuzzy: () => {
      ranker ??= fffRanker(ctx.root);
      return ranker;
    },
    rrfK: cfg.query.rrfK,
    weights: cfg.query.weights,
  };
}

function signalLabel(r: HybridResult): string {
  const hit = SIGNAL_ORDER.filter((name) => r.signals[name] !== undefined);
  // A result no signal produced came out of the graph, so its `why` says where from.
  if (hit.length === 0) return r.why;
  return hit.map((name) => `${name} #${r.signals[name]}`).join(", ");
}

function printResults(ctx: Context, run: Awaited<ReturnType<typeof runQuery>>, args: QueryArgs): void {
  for (const [i, r] of run.results.entries()) {
    const stale = r.stale ? " (stale)" : "";
    ctx.out(`${String(i + 1).padStart(2)}. ${r.skill}${stale}  [${signalLabel(r)}]  ${r.description}`);
    if (args.explain) ctx.out(`      why: ${r.why}`);
  }
  if (run.completions.length === 0) return;
  const unique = new Set(run.completions.map((c) => c.skill));
  ctx.out(`\nset-completion pulled in ${unique.size} skill(s) the query text alone would have missed:`);
  for (const c of [...run.completions].sort((a, b) => (a.skill < b.skill ? -1 : 1))) {
    ctx.out(`   ${c.skill}  (from '${c.recipe}')`);
  }
}

function printEval(ctx: Context, report: EvalReport): void {
  ctx.out(`retrieval eval: ${report.queries} queries, k=${report.k}\n`);
  ctx.out(`  ${"stage".padEnd(10)}${`recall@${report.k}`.padStart(10)}${"MRR".padStart(8)}`);
  for (const s of report.scores) {
    ctx.out(`  ${s.name.padEnd(10)}${s.recall.toFixed(3).padStart(10)}${s.mrr.toFixed(3).padStart(8)}`);
  }
  if (report.augmented !== null) {
    ctx.out(
      `\n  +bpe and ascii@${report.augmented} score lists of up to ${report.augmented}; the rest score ${report.k}.`,
    );
  }
}

const queryRun: Command = async (args, ctx) => {
  let parsed: QueryArgs;
  let deps: QueryDeps;
  try {
    const cfg = await ctx.config();
    parsed = parseQueryArgs(args, cfg.query.k);
    deps = await queryDeps(ctx);
  } catch (e) {
    if (!(e instanceof UsageError)) throw e;
    ctx.err(`skillquarium query: ${e.message}`);
    ctx.err(queryHelp);
    return 2;
  }
  try {
    if (parsed.eval) {
      const report = await runEval(ctx.root, deps, parsed);
      for (const notice of report.notices) ctx.err(notice);
      if (ctx.json) ctx.out(JSON.stringify(report, null, 1));
      else printEval(ctx, report);
      return 0;
    }
    const run = await runQuery(ctx.root, parsed.text, parsed, deps);
    for (const notice of run.notices) ctx.err(notice);
    if (ctx.json) {
      ctx.out(JSON.stringify({ query: parsed.text, k: parsed.k, ...run }, null, 1));
      return 0;
    }
    ctx.out(
      `query: "${parsed.text}"   (${deps.graph.skills.length} skills, ${deps.graph.edgeCount} edges)\n`,
    );
    printResults(ctx, run, parsed);
    return 0;
  } finally {
    // The fff index holds scan threads; without this the process stays alive after printing.
    await destroyFinder(ctx.root);
  }
};

const grepRun: Command = async (args, ctx) => {
  const split = args.indexOf("--");
  const head = split < 0 ? args : args.slice(0, split);
  const rgArgs = split < 0 ? [] : args.slice(split + 1);
  const pattern = head[0];
  if (pattern === undefined || head.length > 1) {
    ctx.err("skillquarium grep: exactly one pattern is required");
    ctx.err(grepHelp);
    return 2;
  }
  try {
    const hits = await grepSkills(ctx.root, pattern, { rgArgs });
    if (ctx.json) {
      ctx.out(JSON.stringify(hits, null, 1));
      return 0;
    }
    let current = "";
    for (const hit of hits) {
      if (hit.skill !== current) {
        current = hit.skill;
        ctx.out(hit.skill);
      }
      ctx.out(`  ${hit.file}:${hit.line}: ${hit.text.trim()}`);
    }
    if (hits.length === 0) ctx.err(`no matches for ${pattern}`);
    return 0;
  } catch (e) {
    ctx.err(`skillquarium grep: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  } finally {
    await destroyFinder(ctx.root);
  }
};

export const query: CommandModule = { run: queryRun, help: queryHelp };
export const grep: CommandModule = { run: grepRun, help: grepHelp };
