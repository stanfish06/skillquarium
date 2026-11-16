import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

/** Committed per-skill Tier 1 results, one JSON object per line, sorted by skill. */
export const RESULTS_PATH = "eval/tier1/results.jsonl";

const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;
export type Severity = (typeof SEVERITIES)[number];
export const severityRank = (s: string): number => {
  const i = (SEVERITIES as readonly string[]).indexOf(s);
  return i < 0 ? SEVERITIES.length : i;
};

/** Issues kept per skill; the full list stays in the uploaded report. */
const MAX_ISSUES = 5;

const IssueSchema = z.object({
  severity: z.string(),
  category: z.string(),
  message: z.string(),
});

export const Tier1EntrySchema = z.object({
  skill: z.string(),
  /** Git tree hash of skills/<skill> when scanned; null when the folder is untracked. */
  tree: z.string().nullable(),
  scannedAt: z.string(),
  evaluator: z.string(),
  /** "error" means the evaluator produced no usable report. */
  status: z.enum(["passed", "failed", "incomplete", "error"]),
  score: z.number().nullable(),
  grade: z.string().nullable(),
  failedChecks: z.array(z.string()),
  incompleteChecks: z.array(z.string()),
  severity: z.record(z.string(), z.number()),
  issues: z.array(IssueSchema),
  error: z.string().optional(),
});
export type Tier1Entry = z.infer<typeof Tier1EntrySchema>;
export type Tier1Issue = z.infer<typeof IssueSchema>;

// Only the fields read below; skillevaluator's report carries many more.
const ReportSchema = z.object({
  version: z.string(),
  generated_at: z.string(),
  overall_status: z.string(),
  severity_counts: z.record(z.string(), z.number()).default({}),
  quality_summary: z
    .array(
      z.object({ overall_score: z.number().nullable().optional(), grade: z.string().nullable().optional() }),
    )
    .default([]),
  results: z.array(z.object({ validator: z.string(), status: z.string() })).default([]),
  top_issues: z.array(IssueSchema).default([]),
});

/** Reduce a skillevaluator-tier1.json report to the committed entry. */
export function entryFromReport(skill: string, tree: string | null, report: unknown): Tier1Entry {
  const r = ReportSchema.parse(report);
  const status =
    r.overall_status === "passed" || r.overall_status === "incomplete" ? r.overall_status : "failed";
  const quality = r.quality_summary[0];
  const issues = r.top_issues
    .map(({ severity, category, message }) => ({ severity, category, message }))
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
    .slice(0, MAX_ISSUES);
  return {
    skill,
    tree,
    scannedAt: r.generated_at,
    evaluator: r.version,
    status,
    score: quality?.overall_score ?? null,
    grade: quality?.grade ?? null,
    failedChecks: r.results.filter((c) => c.status === "failed").map((c) => c.validator),
    incompleteChecks: r.results.filter((c) => c.status === "incomplete").map((c) => c.validator),
    severity: Object.fromEntries(SEVERITIES.map((s) => [s, r.severity_counts[s] ?? 0])),
    issues,
  };
}

export function errorEntry(skill: string, tree: string | null, evaluator: string, error: string): Tier1Entry {
  return {
    skill,
    tree,
    scannedAt: new Date().toISOString(),
    evaluator,
    status: "error",
    score: null,
    grade: null,
    failedChecks: [],
    incompleteChecks: [],
    severity: {},
    issues: [],
    error,
  };
}

export function parseResults(text: string): Map<string, Tier1Entry> {
  const out = new Map<string, Tier1Entry>();
  for (const [i, line] of text.split("\n").entries()) {
    if (line.trim() === "") continue;
    try {
      const entry = Tier1EntrySchema.parse(JSON.parse(line));
      out.set(entry.skill, entry);
    } catch (e) {
      throw new Error(`line ${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return out;
}

export function readResults(file: string): Map<string, Tier1Entry> {
  if (!existsSync(file)) return new Map();
  try {
    return parseResults(readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(`${file}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export function formatResults(entries: Iterable<Tier1Entry>): string {
  const sorted = [...entries].sort((a, b) => (a.skill < b.skill ? -1 : a.skill > b.skill ? 1 : 0));
  return sorted.map((e) => `${JSON.stringify(e)}\n`).join("");
}

/**
 * Merge `updates` into `file`; entries for skills not in `keep` are dropped so deleted
 * skills leave the file. Returns the merged map.
 */
export function writeResults(
  file: string,
  updates: Iterable<Tier1Entry>,
  keep: ReadonlySet<string>,
): Map<string, Tier1Entry> {
  const merged = readResults(file);
  for (const e of updates) merged.set(e.skill, e);
  for (const skill of merged.keys()) if (!keep.has(skill)) merged.delete(skill);
  writeFileSync(file, formatResults(merged.values()));
  return merged;
}

/**
 * Git tree hash of every tracked or unignored skills/<name> folder in the working tree.
 * Stages into a copy of the index so the real index is untouched; empty when git fails.
 */
export function skillTrees(root: string): Map<string, string> {
  const git = (args: string[], env?: Record<string, string>) =>
    Bun.spawnSync(["git", ...args], { cwd: root, env: { ...process.env, ...env }, stderr: "ignore" });
  const trees = new Map<string, string>();
  const indexPath = git(["rev-parse", "--path-format=absolute", "--git-path", "index"])
    .stdout.toString()
    .trim();
  if (indexPath === "" || !existsSync(indexPath)) return trees;
  const tmp = mkdtempSync(join(tmpdir(), "skillquarium-tier1-"));
  try {
    const env = { GIT_INDEX_FILE: join(tmp, "index") };
    copyFileSync(indexPath, env.GIT_INDEX_FILE);
    if (git(["add", "-A", "--", "skills"], env).exitCode !== 0) return trees;
    const tree = git(["write-tree", "--prefix=skills/"], env);
    if (tree.exitCode !== 0) return trees;
    const listing = git(["ls-tree", tree.stdout.toString().trim()]).stdout.toString();
    for (const line of listing.split("\n")) {
      // "<mode> tree <sha>\t<name>"
      const m = /^\d+ tree ([0-9a-f]+)\t(.+)$/.exec(line);
      if (m) trees.set(m[2] as string, m[1] as string);
    }
    return trees;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

export interface Tier1View extends Tier1Entry {
  /** The skill folder changed since the scan. */
  stale: boolean;
}

/** Results joined with current tree hashes, keyed by skill; the TUI's source. */
export function loadTier1Views(root: string): Map<string, Tier1View> {
  const entries = readResults(join(root, RESULTS_PATH));
  const trees = entries.size > 0 ? skillTrees(root) : new Map<string, string>();
  const views = new Map<string, Tier1View>();
  for (const [skill, e] of entries) {
    const current = trees.get(skill);
    // unknown current tree (git unavailable) is not reported as stale
    views.set(skill, { ...e, stale: current !== undefined && current !== e.tree });
  }
  return views;
}
