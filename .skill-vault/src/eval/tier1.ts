import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join, relative, resolve } from "node:path";
import { discoverSkills } from "../catalog/discover";
import type { Command, Context } from "../cli";
import {
  entryFromReport,
  errorEntry,
  formatResults,
  parseResults,
  RESULTS_PATH,
  skillTrees,
  type Tier1Entry,
  writeResults,
} from "./tier1Results";

// Pinned so local and CI runs score the same; bump both together after reviewing the changelog.
// main past 0.9.0 for the PII-scan hang fix (NVIDIA/SkillEvaluator#684); move back to a PyPI pin once released
const EVALUATOR_COMMIT = "c6e2d02062044133705a5edcb810438434366337";
export const EVALUATOR = `git+https://github.com/NVIDIA/SkillEvaluator@${EVALUATOR_COMMIT}`;
// the commit still reports 0.9.0, so results record the commit too
export const EVALUATOR_VERSION = `0.9.0+${EVALUATOR_COMMIT.slice(0, 8)}`;
const BANDIT = "bandit==1.9.4";
const REPORT_FILE = "skillevaluator-tier1.json";
/** Rows in the summary table; the rest stay in results.jsonl. */
const SUMMARY_ROWS = 200;

export const help = `usage: skillquarium eval tier1 [SKILL...] [--changed REF | --all] [options]
       skillquarium eval tier1 --merge FILE...

Run SkillEvaluator Tier 1 static checks (skillevaluator ${EVALUATOR_VERSION} tier1 --no-llm) on skills.
Advisory: failing skills exit 0; only an evaluator that produces no report exits 1.

  SKILL           skill folder name or skills/<name> path
  --changed REF   skills changed between the merge base with REF and the working tree
  --all           every skill under skills/
  --shard K/N     keep the K-th of N interleaved slices of the selection (1-based)
  --jobs N        parallel evaluator processes (default min(4, CPUs))
  --timeout SEC   per-skill limit (default 600)
  --out DIR       report folder (default eval/tier1/reports/<timestamp>)
  --no-record     do not merge results into ${RESULTS_PATH}
  --merge FILE... merge results.jsonl files from sharded runs into ${RESULTS_PATH}

Writes <out>/<skill>/${REPORT_FILE} (+ .html, log.txt), <out>/results.jsonl and
<out>/summary.md; appends the summary to $GITHUB_STEP_SUMMARY when set.
Needs uv (uvx); the evaluator fetches its pinned SkillSpector and Gitleaks on first use.`;

export interface Tier1Options {
  skills: string[];
  changed: string | null;
  all: boolean;
  shard: { k: number; n: number } | null;
  jobs: number;
  timeoutSec: number;
  out: string | null;
  record: boolean;
  merge: string[] | null;
}

function intFlag(name: string, value: string | undefined, min: number): number {
  const n = Number(value);
  if (value === undefined || !Number.isInteger(n) || n < min)
    throw new Error(`${name} needs an integer >= ${min}`);
  return n;
}

export function parseTier1Args(args: string[]): Tier1Options {
  const opts: Tier1Options = {
    skills: [],
    changed: null,
    all: false,
    shard: null,
    jobs: Math.min(4, availableParallelism()),
    timeoutSec: 600,
    out: null,
    record: true,
    merge: null,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i] as string;
    const value = () => {
      const v = args[++i];
      if (v === undefined) throw new Error(`${a} requires a value`);
      return v;
    };
    if (a === "--changed") opts.changed = value();
    else if (a === "--all") opts.all = true;
    else if (a === "--shard") {
      const m = /^(\d+)\/(\d+)$/.exec(value());
      const k = Number(m?.[1]);
      const n = Number(m?.[2]);
      if (!m || n < 1 || k < 1 || k > n) throw new Error("--shard takes K/N with 1 <= K <= N");
      opts.shard = { k, n };
    } else if (a === "--jobs") opts.jobs = intFlag(a, value(), 1);
    else if (a === "--timeout") opts.timeoutSec = intFlag(a, value(), 1);
    else if (a === "--out") opts.out = value();
    else if (a === "--no-record") opts.record = false;
    else if (a === "--merge") {
      opts.merge = args.slice(i + 1);
      if (opts.merge.length === 0) throw new Error("--merge needs at least one results file");
      break;
    } else if (a.startsWith("-")) throw new Error(`unknown option ${a}`);
    else opts.skills.push(a.replace(/^\.?\/?skills\//, "").replace(/\/+$/, ""));
  }
  const modes = [opts.skills.length > 0, opts.changed !== null, opts.all, opts.merge !== null].filter(
    Boolean,
  );
  if (modes.length !== 1)
    throw new Error("pass exactly one of: SKILL..., --changed REF, --all, --merge FILE...");
  return opts;
}

/** Skill names touched between the merge base with `ref` and the working tree. */
export function changedSkills(root: string, ref: string): string[] {
  // --no-renames lists both ends of a move, so a file moved between skills selects both
  const proc = Bun.spawnSync(
    ["git", "diff", "--name-only", "--no-renames", "--merge-base", ref, "--", "skills"],
    { cwd: root },
  );
  if (proc.exitCode !== 0)
    throw new Error(`git diff against ${ref} failed: ${proc.stderr.toString().trim()}`);
  const names = new Set<string>();
  for (const path of proc.stdout.toString().split("\n")) {
    const m = /^skills\/([^/]+)\//.exec(path);
    if (m) names.add(m[1] as string);
  }
  return [...names].sort();
}

export function selectSkills(root: string, opts: Tier1Options, known: ReadonlySet<string>): string[] {
  let names: string[];
  if (opts.all) names = [...known].sort();
  else if (opts.changed !== null) names = changedSkills(root, opts.changed).filter((s) => known.has(s));
  else {
    const unknown = opts.skills.filter((s) => !known.has(s));
    if (unknown.length > 0) throw new Error(`unknown skill: ${unknown.join(", ")}`);
    names = [...new Set(opts.skills)];
  }
  const shard = opts.shard;
  return shard ? names.filter((_, i) => i % shard.n === shard.k - 1) : names;
}

export type EvaluatorArgv = (skill: string, outDir: string) => string[];

export const defaultEvaluator: EvaluatorArgv = (skill, outDir) => [
  "uvx",
  "--python",
  "3.13",
  "--from",
  EVALUATOR,
  "--with",
  BANDIT,
  "skillevaluator",
  "tier1",
  `skills/${skill}`,
  "--no-llm",
  "-r",
  "json",
  "-r",
  "html",
  "-o",
  outDir,
];

/** Run the evaluator on each skill, `jobs` at a time; `onDone` sees entries in completion order. */
export async function runSkills(
  root: string,
  skills: string[],
  outRoot: string,
  opts: { jobs: number; timeoutSec: number; evaluator?: EvaluatorArgv; onDone?: (e: Tier1Entry) => void },
): Promise<Tier1Entry[]> {
  const evaluator = opts.evaluator ?? defaultEvaluator;
  const trees = skillTrees(root);
  const version = EVALUATOR_VERSION;
  const entries: Tier1Entry[] = [];
  let next = 0;
  const worker = async () => {
    while (next < skills.length) {
      const skill = skills[next++] as string;
      const dir = join(outRoot, skill);
      // a report left in a reused --out would pass for this run's when the evaluator fails
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
      const tree = trees.get(skill) ?? null;
      const proc = Bun.spawn(evaluator(skill, dir), {
        cwd: root,
        stdout: "pipe",
        stderr: "pipe",
        timeout: opts.timeoutSec * 1000,
      });
      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);
      const code = await proc.exited;
      writeFileSync(join(dir, "log.txt"), stdout + stderr);
      // skillevaluator exits 1 on any failed check, so the report, not the exit code, decides
      let entry: Tier1Entry;
      const report = join(dir, REPORT_FILE);
      if (existsSync(report)) {
        try {
          entry = {
            ...entryFromReport(skill, tree, JSON.parse(readFileSync(report, "utf8"))),
            evaluator: version,
          };
        } catch (e) {
          entry = errorEntry(
            skill,
            tree,
            version,
            `unreadable report: ${e instanceof Error ? e.message : e}`,
          );
        }
      } else {
        const reason = proc.signalCode
          ? `killed by ${proc.signalCode} (timeout ${opts.timeoutSec}s?)`
          : `exit ${code}`;
        const tail = (stderr || stdout).trim().split("\n").slice(-3).join(" | ");
        entry = errorEntry(skill, tree, version, `no report, ${reason}: ${tail}`.slice(0, 500));
      }
      entries.push(entry);
      opts.onDone?.(entry);
    }
  };
  await Promise.all(Array.from({ length: Math.min(opts.jobs, skills.length) }, worker));
  return entries.sort((a, b) => (a.skill < b.skill ? -1 : 1));
}

const STATUS_ORDER = { error: 0, failed: 1, incomplete: 2, passed: 3 } as const;

const scoreText = (e: Tier1Entry) =>
  e.score === null ? "-" : `${e.score.toFixed(1)} ${e.grade ?? ""}`.trim();

// Keep table cells on one line and stop `|` from splitting them.
const cell = (s: string) => s.replace(/\s+/g, " ").replace(/\|/g, "\\|").slice(0, 160);

export function summarize(entries: Tier1Entry[], title: string): string {
  const count = (s: Tier1Entry["status"]) => entries.filter((e) => e.status === s).length;
  const scores = entries.flatMap((e) => (e.score === null ? [] : [e.score])).sort((a, b) => a - b);
  const median = scores.length ? (scores[Math.floor((scores.length - 1) / 2)] as number).toFixed(1) : "-";
  const lines = [
    `## ${title}`,
    "",
    `${entries.length} skills · ${count("passed")} passed · ${count("failed")} failed · ` +
      `${count("incomplete")} incomplete · ${count("error")} errors · median score ${median}`,
    "",
    "Advisory: SkillEvaluator Tier 1 static checks (no LLM). Findings do not fail the job.",
  ];
  if (entries.length === 0) return `${lines.join("\n")}\n`;

  const checkCounts = new Map<string, number>();
  for (const e of entries) for (const c of e.failedChecks) checkCounts.set(c, (checkCounts.get(c) ?? 0) + 1);
  if (checkCounts.size > 0 && entries.length > 1) {
    lines.push("", "| Failed check | Skills |", "| --- | --- |");
    for (const [c, n] of [...checkCounts].sort((a, b) => b[1] - a[1])) lines.push(`| ${cell(c)} | ${n} |`);
  }

  const rows = [...entries].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      (a.score ?? -1) - (b.score ?? -1) ||
      (a.skill < b.skill ? -1 : 1),
  );
  lines.push("", "| Skill | Status | Score | Failed checks | Top issue |", "| --- | --- | --- | --- | --- |");
  for (const e of rows.slice(0, SUMMARY_ROWS)) {
    const top =
      e.error ?? (e.issues[0] ? `${e.issues[0].severity.toUpperCase()} ${e.issues[0].message}` : "");
    lines.push(
      `| \`${e.skill}\` | ${e.status} | ${scoreText(e)} | ${cell(e.failedChecks.join(", "))} | ${cell(top)} |`,
    );
  }
  if (rows.length > SUMMARY_ROWS) lines.push("", `${rows.length - SUMMARY_ROWS} more rows in results.jsonl.`);
  return `${lines.join("\n")}\n`;
}

function publishSummary(markdown: string, out: string | null): void {
  if (out) writeFileSync(join(out, "summary.md"), markdown);
  const stepSummary = process.env.GITHUB_STEP_SUMMARY;
  if (stepSummary) appendFileSync(stepSummary, markdown);
}

function knownSkills(root: string): Set<string> {
  return new Set(discoverSkills(root, { bundles: false, excludeTransient: true }).map((s) => s.id));
}

export async function runTier1(
  opts: Tier1Options,
  ctx: Context,
  evaluator?: EvaluatorArgv,
): Promise<{ code: number; entries: Tier1Entry[] }> {
  const known = knownSkills(ctx.root);
  const resultsFile = join(ctx.root, RESULTS_PATH);
  const title = `Tier 1 (skillevaluator ${EVALUATOR_VERSION})`;

  if (opts.merge !== null) {
    const parts = opts.merge.flatMap((f) => [...parseResults(readFileSync(resolve(f), "utf8")).values()]);
    mkdirSync(join(ctx.root, "eval/tier1"), { recursive: true });
    writeResults(resultsFile, parts, known);
    ctx.out(`merged ${parts.length} results into ${RESULTS_PATH}`);
    publishSummary(summarize(parts, title), null);
    return { code: 0, entries: parts };
  }

  const skills = selectSkills(ctx.root, opts, known);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const out = resolve(ctx.root, opts.out ?? join("eval/tier1/reports", stamp));
  mkdirSync(out, { recursive: true });
  if (skills.length === 0) {
    ctx.out("no skills to scan");
    writeFileSync(join(out, "results.jsonl"), "");
    publishSummary(`## ${title}\n\nNo skills changed.\n`, out);
    return { code: 0, entries: [] };
  }

  ctx.err(
    `scanning ${skills.length} skill${skills.length === 1 ? "" : "s"} with ${opts.jobs} jobs → ${relative(ctx.root, out)}`,
  );
  let done = 0;
  const entries = await runSkills(ctx.root, skills, out, {
    jobs: opts.jobs,
    timeoutSec: opts.timeoutSec,
    evaluator,
    onDone: (e) => {
      done++;
      if (!ctx.json)
        ctx.out(`[${done}/${skills.length}] ${e.status.padEnd(10)} ${scoreText(e).padEnd(7)} ${e.skill}`);
    },
  });

  writeFileSync(join(out, "results.jsonl"), formatResults(entries));
  if (opts.record) {
    mkdirSync(join(ctx.root, "eval/tier1"), { recursive: true });
    writeResults(resultsFile, entries, known);
  }
  const markdown = summarize(entries, title);
  publishSummary(markdown, out);
  if (ctx.json) ctx.out(JSON.stringify(entries));
  else
    ctx.out(
      `\n${markdown}\nreports: ${relative(ctx.root, out)}${opts.record ? `   recorded: ${RESULTS_PATH}` : ""}`,
    );

  const errors = entries.filter((e) => e.status === "error");
  for (const e of errors) ctx.err(`error: ${e.skill}: ${e.error}`);
  return { code: errors.length > 0 ? 1 : 0, entries };
}

export const run: Command = async (args, ctx) => {
  let opts: Tier1Options;
  try {
    opts = parseTier1Args(args);
  } catch (e) {
    ctx.err(`skillquarium eval tier1: ${e instanceof Error ? e.message : e}`);
    ctx.err(help.split("\n")[0] as string);
    return 2;
  }
  if (opts.merge === null && Bun.which("uvx") === null) {
    ctx.err("skillquarium eval tier1: uv is required (https://docs.astral.sh/uv/)");
    return 2;
  }
  return (await runTier1(opts, ctx)).code;
};
