import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { escapeRegExp, readScalar, splitFrontmatter } from "../catalog";

/**
 * Upstream skills installed under a name other than their upstream `name:`. The skills CLI
 * reinstalls by `--skill <lock key>` and matches that against upstream `name:` only (#827), so
 * these live here instead of .skill-lock.json and `skillquarium renamed` syncs them.
 * Fields mirror a lock entry, plus the upstream name and whether to rewrite sibling references.
 */
const RenamedEntrySchema = z.looseObject({
  upstreamName: z.string().min(1),
  source: z.string().min(1),
  sourceType: z.string().min(1),
  sourceUrl: z.string().min(1),
  ref: z.string().optional(),
  skillPath: z.string().min(1),
  skillFolderHash: z.string(),
  rewriteRefs: z.boolean().optional(),
  installedAt: z.string(),
  updatedAt: z.string(),
});
export type RenamedEntry = z.infer<typeof RenamedEntrySchema>;

const RenamedFileSchema = z.object({ skills: z.record(z.string(), RenamedEntrySchema) });

/** Local skill name -> entry. */
export type Renamed = Record<string, RenamedEntry>;

export function renamedPath(root: string): string {
  return join(root, ".skill-vault/data/renamed-skills.json");
}

/** A missing file is an empty set. */
export function loadRenamed(path: string): Renamed {
  if (!existsSync(path)) return {};
  return parseRenamed(readFileSync(path, "utf8"), path);
}

export function parseRenamed(text: string, label: string): Renamed {
  const parsed = RenamedFileSchema.safeParse(JSON.parse(text));
  if (!parsed.success) throw new Error(`${label}: ${parsed.error.issues[0]?.message ?? "invalid"}`);
  return parsed.data.skills;
}

/** Sorted keys, two-space indent, trailing newline, so a sync only diffs what changed. */
export function writeRenamed(path: string, skills: Renamed): void {
  const sorted = Object.fromEntries(
    Object.keys(skills)
      .sort()
      .map((name) => [name, skills[name]]),
  );
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ skills: sorted }, null, 2)}\n`, "utf8");
}

function git(argv: string[], cwd?: string): { code: number; stdout: string; stderr: string } {
  const proc = Bun.spawnSync(["git", ...(cwd ? ["-C", cwd] : []), ...argv], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  return {
    code: proc.exitCode,
    stdout: proc.stdout.toString("utf8").trim(),
    stderr: proc.stderr.toString("utf8").trim(),
  };
}

/** Upstream folder of a skillPath (drift.ts folderOf), "" for a SKILL.md at the repo root. */
function upstreamFolder(skillPath: string): string {
  const normalized = skillPath.replace(/\\/g, "/").replace(/\/+$/, "");
  if (normalized.toLowerCase() === "skill.md") return "";
  return normalized.toLowerCase().endsWith("/skill.md")
    ? normalized.slice(0, -"/SKILL.md".length)
    : normalized;
}

/** A blobless, depth-1 clone: commits and trees only, so tree shas cost no file downloads. */
export class UpstreamCheckout {
  readonly dir: string;

  constructor(url: string, ref?: string) {
    this.dir = mkdtempSync(join(tmpdir(), "skillquarium-renamed-"));
    const branch = ref ? ["--branch", ref] : [];
    const clone = git([
      "clone",
      "--quiet",
      "--depth",
      "1",
      "--filter=blob:none",
      "--no-checkout",
      ...branch,
      url,
      this.dir,
    ]);
    if (clone.code !== 0) {
      this.dispose();
      throw new Error(`git clone ${url}: ${clone.stderr}`);
    }
  }

  /** Tree sha of a folder at HEAD, the value the lock records as skillFolderHash; null when absent. */
  treeSha(folder: string): string | null {
    if (folder === "") {
      const root = git(["rev-parse", "HEAD^{tree}"], this.dir);
      return root.code === 0 ? root.stdout : null;
    }
    // "040000 tree <sha>\t<path>", or nothing when the path is absent or not a folder
    const listed = git(["ls-tree", "-d", "HEAD", "--", folder], this.dir);
    const match = /^\d+ tree ([0-9a-f]+)\t/.exec(listed.stdout);
    return listed.code === 0 && match ? (match[1] as string) : null;
  }

  /** Every SKILL.md path at HEAD. */
  skillFiles(): string[] {
    const result = git(["ls-tree", "-r", "--name-only", "HEAD"], this.dir);
    if (result.code !== 0) throw new Error(`git ls-tree: ${result.stderr}`);
    return result.stdout.split("\n").filter((path) => /(^|\/)SKILL\.md$/i.test(path));
  }

  /** One file's text at HEAD; fetches just that blob. */
  show(path: string): string {
    const result = git(["show", `HEAD:${path}`], this.dir);
    if (result.code !== 0) throw new Error(`git show HEAD:${path}: ${result.stderr}`);
    return result.stdout;
  }

  /** Check out only these folders, fetching their blobs in one batch. */
  materialize(folders: string[]): void {
    const sparse = folders.includes("")
      ? git(["sparse-checkout", "disable"], this.dir)
      : git(["sparse-checkout", "set", "--no-cone", "--", ...folders.map((f) => `/${f}/`)], this.dir);
    if (sparse.code !== 0) throw new Error(`git sparse-checkout: ${sparse.stderr}`);
    const checkout = git(["checkout", "--quiet"], this.dir);
    if (checkout.code !== 0) throw new Error(`git checkout: ${checkout.stderr}`);
  }

  dispose(): void {
    rmSync(this.dir, { recursive: true, force: true });
  }
}

// The skills CLI's installer exclusions (installer.ts isExcluded, skills@1.5.23).
const EXCLUDE_FILES = new Set(["metadata.json"]);
const EXCLUDE_DIRS = new Set([".git", "__pycache__", "__pypackages__"]);

/** Copy like the skills CLI: dereference symlinks, skip broken ones, keep permission bits. */
function copyTree(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    let stats: ReturnType<typeof statSync>;
    try {
      stats = statSync(from);
    } catch {
      continue; // broken symlink
    }
    if (stats.isDirectory()) {
      if (!EXCLUDE_DIRS.has(entry.name)) copyTree(from, to);
    } else if (!EXCLUDE_FILES.has(entry.name)) {
      copyFileSync(from, to);
      chmodSync(to, stats.mode & 0o777);
    }
  }
}

function markdownFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...markdownFiles(path));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) files.push(path);
  }
  return files;
}

/** Set the frontmatter `name:` to the local name, keeping the line ending. */
export function setName(text: string, name: string): string {
  const fm = splitFrontmatter(text);
  if (!fm) throw new Error("SKILL.md has no YAML frontmatter");
  const lines = [...fm.lines];
  const index = lines.findIndex((line, i) => i > 0 && i < fm.closingIndex && /^name:/.test(line));
  const line = `name: ${name}${fm.newline}`;
  if (index === -1) lines.splice(1, 0, line);
  else lines[index] = line;
  return lines.join("");
}

/**
 * Point references at sibling skills to their local names, in the two forms that cannot be
 * anything else: a `/name` slash command (not a URL or path segment) and a `../name/` path.
 */
export function rewriteRefs(text: string, names: Map<string, string>): string {
  let out = text;
  for (const [upstream, local] of names) {
    if (upstream === local) continue;
    const name = escapeRegExp(upstream);
    out = out
      .replace(new RegExp(`(?<![\\w./:-])/${name}(?![\\w-])`, "g"), `/${local}`)
      .replace(new RegExp(`\\.\\./${name}/`, "g"), `../${local}/`);
  }
  return out;
}

/** Upstream name -> local name for every rewriteRefs entry from this source. */
function siblingNames(skills: Renamed, source: string): Map<string, string> {
  const names = new Map<string, string>();
  for (const [local, entry] of Object.entries(skills)) {
    if (entry.source === source && entry.rewriteRefs) names.set(entry.upstreamName, local);
  }
  return names;
}

/** Replace skills/<local> with the checked-out upstream folder, renamed. */
function install(
  root: string,
  local: string,
  entry: RenamedEntry,
  checkout: UpstreamCheckout,
  skills: Renamed,
): void {
  const src = join(checkout.dir, upstreamFolder(entry.skillPath));
  const skillMd = join(src, "SKILL.md");
  if (!existsSync(skillMd)) throw new Error(`${entry.skillPath} is not in the checkout`);
  const dest = join(root, "skills", local);
  rmSync(dest, { recursive: true, force: true });
  copyTree(src, dest);
  const target = join(dest, "SKILL.md");
  writeFileSync(target, setName(readFileSync(target, "utf8"), local), "utf8");
  if (!entry.rewriteRefs) return;
  const names = siblingNames(skills, entry.source);
  for (const file of markdownFiles(dest)) {
    const text = readFileSync(file, "utf8");
    const rewritten = rewriteRefs(text, names);
    if (rewritten !== text) writeFileSync(file, rewritten, "utf8");
  }
}

export interface RenamedResult {
  /** Upstream changed: reinstalled, or with check, would be. */
  updated: string[];
  current: string[];
  /** skillPath no longer exists upstream; the folder is left as it is. */
  unreachable: string[];
  failed: { skill: string; reason: string }[];
}

export interface RenamedDeps {
  now?: () => Date;
}

/**
 * Compare each renamed skill's recorded hash with its upstream folder and reinstall the ones that
 * changed, one clone per source. Without write, report only.
 */
export function syncRenamed(root: string, write = true, deps: RenamedDeps = {}): RenamedResult {
  const path = renamedPath(root);
  const skills = loadRenamed(path);
  const result: RenamedResult = { updated: [], current: [], unreachable: [], failed: [] };
  const groups = new Map<string, string[]>();
  for (const local of Object.keys(skills).sort()) {
    const entry = skills[local] as RenamedEntry;
    const key = `${entry.sourceUrl}#${entry.ref ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), local]);
  }

  const now = (deps.now ?? (() => new Date()))().toISOString();
  for (const locals of groups.values()) {
    const first = skills[locals[0] as string] as RenamedEntry;
    let checkout: UpstreamCheckout;
    try {
      checkout = new UpstreamCheckout(first.sourceUrl, first.ref);
    } catch (e) {
      for (const skill of locals)
        result.failed.push({ skill, reason: e instanceof Error ? e.message : String(e) });
      continue;
    }
    try {
      const changed: [string, string][] = [];
      for (const local of locals) {
        const entry = skills[local] as RenamedEntry;
        const sha = checkout.treeSha(upstreamFolder(entry.skillPath));
        if (sha === null) result.unreachable.push(local);
        else if (sha === entry.skillFolderHash) result.current.push(local);
        else changed.push([local, sha]);
      }
      if (!write) {
        result.updated.push(...changed.map(([local]) => local));
        continue;
      }
      if (changed.length === 0) continue;
      try {
        checkout.materialize(
          changed.map(([local]) => upstreamFolder((skills[local] as RenamedEntry).skillPath)),
        );
      } catch (e) {
        for (const [skill] of changed)
          result.failed.push({ skill, reason: e instanceof Error ? e.message : String(e) });
        continue;
      }
      for (const [local, sha] of changed) {
        const entry = skills[local] as RenamedEntry;
        try {
          install(root, local, entry, checkout, skills);
        } catch (e) {
          result.failed.push({ skill: local, reason: e instanceof Error ? e.message : String(e) });
          continue;
        }
        skills[local] = { ...entry, skillFolderHash: sha, updatedAt: now };
        result.updated.push(local);
      }
    } finally {
      checkout.dispose();
    }
  }
  if (write && result.updated.length) writeRenamed(path, skills);
  return result;
}

export interface RenamedIo {
  out: (line: string) => void;
  err: (line: string) => void;
}

/** Exit 1 on a failed source or skill, and under check when anything is behind. */
export function reportRenamed(result: RenamedResult, check: boolean, io: RenamedIo): number {
  const total =
    result.updated.length + result.current.length + result.unreachable.length + result.failed.length;
  io.out(
    `renamed skills: ${total} tracked, ${result.current.length} current, ` +
      `${result.updated.length} ${check ? "behind" : "updated"}, ${result.unreachable.length} unreachable`,
  );
  for (const skill of result.updated) io.out(`  ${check ? "behind" : "updated"}: ${skill}`);
  for (const skill of result.unreachable)
    io.err(`  UNREACHABLE: ${skill} — its skillPath no longer exists upstream`);
  for (const { skill, reason } of result.failed) io.err(`  FAILED: ${skill} — ${reason}`);
  if (result.failed.length) return 1;
  return check && result.updated.length ? 1 : 0;
}

export interface AddOptions {
  source: string;
  /** Upstream `name:` values to add; empty with all. */
  skills: string[];
  all: boolean;
  as?: string;
  prefix?: string;
  rewriteRefs: boolean;
}

/** owner/repo or a GitHub URL -> github; any other git URL is recorded as-is. */
export function parseSource(source: string): { source: string; sourceType: string; sourceUrl: string } {
  const shorthand = /^([\w.-]+)\/([\w.-]+)$/.exec(source);
  const github = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(source);
  const match = shorthand ?? github;
  if (match) {
    const repo = `${match[1]}/${match[2]}`;
    return { source: repo, sourceType: "github", sourceUrl: `https://github.com/${repo}.git` };
  }
  return { source, sourceType: "git", sourceUrl: source };
}

/** Local name for an upstream name; a prefix is not doubled. */
function localName(upstream: string, options: AddOptions): string {
  if (options.as !== undefined) return options.as;
  if (options.prefix !== undefined && !upstream.startsWith(options.prefix))
    return `${options.prefix}${upstream}`;
  return upstream;
}

/**
 * Install upstream skills under new names and record them. Every name is checked against
 * skills/, the lock, and this file before anything is written.
 * Returns [local, upstream] pairs in install order.
 */
export function addRenamed(root: string, options: AddOptions, deps: RenamedDeps = {}): [string, string][] {
  if (options.as !== undefined && (options.all || options.skills.length !== 1)) {
    throw new Error("--as names exactly one --skill");
  }
  const { source, sourceType, sourceUrl } = parseSource(options.source);
  const path = renamedPath(root);
  const skills = loadRenamed(path);
  const lockFile = join(root, ".skill-lock.json");
  const lock = existsSync(lockFile)
    ? ((JSON.parse(readFileSync(lockFile, "utf8")) as { skills?: Record<string, unknown> }).skills ?? {})
    : {};

  const checkout = new UpstreamCheckout(sourceUrl);
  try {
    // upstream name (lower-cased, as the skills CLI matches) -> [name, skillPath]
    const available = new Map<string, [string, string]>();
    for (const file of checkout.skillFiles()) {
      const fm = splitFrontmatter(checkout.show(file));
      const name = fm ? readScalar(fm, "name") : null;
      if (name) available.set(name.toLowerCase(), [name, file]);
    }
    const wanted = options.all ? [...available.keys()].sort() : options.skills.map((s) => s.toLowerCase());
    if (wanted.length === 0) throw new Error("no skills selected; pass --skill NAME or --all");
    const missing = wanted.filter((name) => !available.has(name));
    if (missing.length) {
      const names = [...available.values()].map(([name]) => name).sort();
      throw new Error(`not in ${source}: ${missing.join(", ")}\navailable: ${names.join(", ")}`);
    }

    const plan: [string, string, string][] = [];
    const taken = new Set<string>();
    for (const key of wanted) {
      const [upstream, skillPath] = available.get(key) as [string, string];
      const local = localName(upstream, options);
      if (!/^[a-z0-9][a-z0-9._-]*$/.test(local)) throw new Error(`${local}: not a valid skill folder name`);
      if (taken.has(local)) throw new Error(`${local}: selected twice`);
      if (existsSync(join(root, "skills", local)))
        throw new Error(`${local}: skills/${local} already exists`);
      if (local in lock) throw new Error(`${local}: already in .skill-lock.json`);
      if (local in skills) throw new Error(`${local}: already in ${path}`);
      taken.add(local);
      plan.push([local, upstream, skillPath]);
    }

    const now = (deps.now ?? (() => new Date()))().toISOString();
    for (const [local, upstream, skillPath] of plan) {
      const sha = checkout.treeSha(upstreamFolder(skillPath));
      if (sha === null) throw new Error(`${skillPath}: no tree at HEAD`);
      skills[local] = {
        upstreamName: upstream,
        source,
        sourceType,
        sourceUrl,
        skillPath,
        skillFolderHash: sha,
        ...(options.rewriteRefs ? { rewriteRefs: true } : {}),
        installedAt: now,
        updatedAt: now,
      };
    }
    checkout.materialize(plan.map(([, , skillPath]) => upstreamFolder(skillPath)));
    try {
      for (const [local] of plan) install(root, local, skills[local] as RenamedEntry, checkout, skills);
    } catch (e) {
      // every folder in the plan was new, so removing them all undoes this call
      for (const [local] of plan) rmSync(join(root, "skills", local), { recursive: true, force: true });
      throw e;
    }
    writeRenamed(path, skills);
    return plan.map(([local, upstream]) => [local, upstream]);
  } finally {
    checkout.dispose();
  }
}
