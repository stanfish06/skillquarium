import { appendFileSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { pyStrip, universalNewlines } from "../catalog";

export const API = "https://api.github.com";
export const TIMEOUT_MS = 30_000;

export interface TreeEntry {
  path: string;
  sha: string;
  type: string;
}

export interface RepoTree {
  tree: TreeEntry[];
  truncated?: boolean;
}

export interface Buckets {
  current: string[];
  behind: string[];
  unreachable: string[];
}

/** Sources in report order: most lock entries first. */
export type DriftReport = Map<string, Buckets>;

export interface ProfileRow {
  repo: string;
  /** [commit, how many skills pin it], sorted by commit. */
  commits: [string, number][];
  head: string | null;
}

/** Seams the tests replace: no network, no ambient env. */
export interface DriftDeps {
  fetch?: typeof fetch;
  env?: Record<string, string | undefined>;
  repoTree?: (source: string) => Promise<RepoTree | null>;
}

const TreeSchema = z.looseObject({
  truncated: z.boolean().optional(),
  tree: z.array(z.looseObject({ path: z.string(), sha: z.string(), type: z.string() })).optional(),
});

const CommitsSchema = z.array(z.looseObject({ sha: z.string() }));

const LockEntrySchema = z.looseObject({
  source: z.string().optional(),
  skillPath: z.string().optional(),
  skillFolderHash: z.string().optional(),
});
type LockEntry = z.infer<typeof LockEntrySchema>;

const LockSchema = z.looseObject({ skills: z.record(z.string(), LockEntrySchema).optional() });

/**
 * GET https://api.github.com{path}. Every failure -- transport, non-2xx, timeout, unparseable
 * body -- returns null, which check_lock turns into an explicit "could not read" error line.
 */
export async function apiGet(path: string, deps: DriftDeps = {}): Promise<unknown> {
  const doFetch = deps.fetch ?? fetch;
  const env = deps.env ?? process.env;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "skillquarium-drift",
  };
  const token = env.GITHUB_TOKEN || env.GH_TOKEN;
  // Public API; the token only raises the rate limit.
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const response = await doFetch(`${API}${path}`, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/** Recursive git tree, trying the refs the skills CLI tries. First non-empty tree wins. */
export async function repoTree(source: string, deps: DriftDeps = {}): Promise<RepoTree | null> {
  for (const ref of ["HEAD", "main", "master"]) {
    const parsed = TreeSchema.safeParse(await apiGet(`/repos/${source}/git/trees/${ref}?recursive=1`, deps));
    if (parsed.success && parsed.data.tree?.length) {
      return { tree: parsed.data.tree, truncated: parsed.data.truncated };
    }
  }
  return null;
}

/** The folder a lock entry's skillPath names, with any SKILL.md and trailing slashes removed. */
export function folderOf(skillPath: string): string {
  const normalized = skillPath.replace(/\\/g, "/").replace(/\/+$/, "");
  if (normalized.toLowerCase().endsWith("/skill.md")) return normalized.slice(0, -"/SKILL.md".length);
  return normalized;
}

function byName(a: [string, LockEntry], b: [string, LockEntry]): number {
  return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
}

/**
 * Compare every lock entry's `skillFolderHash` against the git tree-object sha of its folder
 * upstream: absent folder -> unreachable, different sha -> behind, equal -> current.
 */
export async function checkLock(
  lockPath: string,
  deps: DriftDeps = {},
): Promise<{ report: DriftReport; errors: string[] }> {
  const lock = LockSchema.parse(JSON.parse(readFileSync(lockPath, "utf8")));
  const bySource = new Map<string, [string, LockEntry][]>();
  for (const [name, entry] of Object.entries(lock.skills ?? {})) {
    const source = entry.source ?? "";
    const items = bySource.get(source);
    if (items) items.push([name, entry]);
    else bySource.set(source, [[name, entry]]);
  }

  const tree = deps.repoTree ?? ((source: string) => repoTree(source, deps));
  const report: DriftReport = new Map();
  const errors: string[] = [];
  // Most entries first; ties keep lock order, as Python's stable sort does.
  const sources = [...bySource.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [source, items] of sources) {
    if (!source) continue;
    const data = await tree(source);
    if (data === null) {
      errors.push(`${source}: could not read the upstream git tree`);
      continue;
    }
    if (data.truncated) errors.push(`${source}: upstream git tree was truncated; counts are partial`);
    const shas = new Map<string, string>();
    for (const entry of data.tree) if (entry.type === "tree") shas.set(entry.path, entry.sha);
    const buckets: Buckets = { current: [], behind: [], unreachable: [] };
    for (const [name, entry] of [...items].sort(byName)) {
      const path = entry.skillPath;
      if (!path) continue;
      const sha = shas.get(folderOf(path));
      if (sha === undefined) buckets.unreachable.push(name);
      else if (sha !== entry.skillFolderHash) buckets.behind.push(name);
      else buckets.current.push(name);
    }
    report.set(source, buckets);
  }
  return { report, errors };
}

function skillFiles(root: string): string[] {
  const skills = join(root, "skills");
  let names: string[];
  try {
    names = readdirSync(skills);
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const name of names) {
    const file = join(skills, name, "SKILL.md");
    try {
      if (statSync(file).isFile()) files.push(file);
    } catch {
      // no SKILL.md in that folder
    }
  }
  return files.sort();
}

/** Imported profiles pin their provenance in frontmatter instead of the lock: repo -> commit -> count. */
export function pinnedProfiles(root: string): Map<string, Map<string, number>> {
  const byRepo = new Map<string, Map<string, number>>();
  for (const file of skillFiles(root)) {
    let repo = "";
    let commit = "";
    // Only the head of the file: the frontmatter, never the body.
    for (const line of universalNewlines(readFileSync(file, "utf8")).split("\n").slice(0, 41)) {
      const stripped = pyStrip(line);
      if (stripped.startsWith("source-repo:")) repo = pyStrip(stripped.slice("source-repo:".length));
      else if (stripped.startsWith("source-commit:"))
        commit = pyStrip(stripped.slice("source-commit:".length));
    }
    if (!repo || !commit) continue;
    const commits = byRepo.get(repo) ?? new Map<string, number>();
    commits.set(commit, (commits.get(commit) ?? 0) + 1);
    byRepo.set(repo, commits);
  }
  return byRepo;
}

export async function checkProfiles(root: string, deps: DriftDeps = {}): Promise<ProfileRow[]> {
  const rows: ProfileRow[] = [];
  const pinned = pinnedProfiles(root);
  for (const repo of [...pinned.keys()].sort()) {
    const commits = pinned.get(repo) ?? new Map<string, number>();
    const head = CommitsSchema.safeParse(await apiGet(`/repos/${repo}/commits?per_page=1`, deps));
    const first = head.success ? head.data[0] : undefined;
    rows.push({
      repo,
      commits: [...commits.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)),
      head: first?.sha ?? null,
    });
  }
  return rows;
}

/** The markdown report and the drift count that drives the exit code. */
export function render(report: DriftReport, errors: string[], profiles: ProfileRow[]): [string, number] {
  const lines = ["| source | tracked | current | behind | unreachable |", "| --- | --- | --- | --- | --- |"];
  let behind = 0;
  let unreachable = 0;
  for (const [source, buckets] of report) {
    const total = buckets.current.length + buckets.behind.length + buckets.unreachable.length;
    behind += buckets.behind.length;
    unreachable += buckets.unreachable.length;
    lines.push(
      `| \`${source}\` | ${total} | ${buckets.current.length} | ` +
        `${buckets.behind.length} | ${buckets.unreachable.length} |`,
    );
  }
  lines.push("");
  lines.push(
    `**${behind} behind upstream, ${unreachable} unreachable** ` +
      "(recorded `skillPath` no longer exists upstream, so " +
      "`skills update` skips them permanently).",
  );

  let staleProfiles = 0;
  if (profiles.length) {
    lines.push("", "Imported profiles pinned in frontmatter (outside the lock):", "");
    for (const row of profiles) {
      for (const [commit, count] of row.commits) {
        const current = commit === row.head;
        if (!current) staleProfiles += count;
        const state = current ? "current" : `behind HEAD \`${(row.head ?? "?").slice(0, 12)}\``;
        lines.push(`- \`${row.repo}\` — ${count} skills pinned at \`${commit.slice(0, 12)}\`, ${state}`);
      }
    }
  }

  if (errors.length) lines.push("", "Errors:", "", ...errors.map((error) => `- ${error}`));

  return [lines.join("\n"), behind + unreachable + staleProfiles];
}

export interface DriftOptions {
  lock?: string;
  skipProfiles?: boolean;
  failOnDrift?: boolean;
}

export interface DriftIo {
  out: (line: string) => void;
}

/** check-upstream-drift.py main(): print the table, append it to the job summary, set the code. */
export async function runDrift(
  root: string,
  options: DriftOptions,
  io: DriftIo,
  deps: DriftDeps = {},
): Promise<number> {
  const { report, errors } = await checkLock(options.lock ?? join(root, ".skill-lock.json"), deps);
  const profiles = options.skipProfiles ? [] : await checkProfiles(root, deps);
  const [text, drift] = render(report, errors, profiles);
  io.out(text);

  const summary = (deps.env ?? process.env).GITHUB_STEP_SUMMARY;
  if (summary) appendFileSync(summary, `## Upstream drift\n\n${text}\n`, "utf8");

  if (errors.length && options.failOnDrift) return 1;
  return drift && options.failOnDrift ? 1 : 0;
}
