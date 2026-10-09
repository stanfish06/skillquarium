import { readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { universalNewlines } from "../catalog";

/**
 * One recorded local fix: `find` is the upstream defect, `replace` the vault's version.
 * `file` defaults to SKILL.md; `source` and `issue` are provenance the tool never reads.
 */
export interface OverrideEntry {
  id: string;
  find: string;
  replace: string;
  file?: string;
}

/** Skill folder name -> its recorded fixes, in file order. */
export type Overrides = Map<string, OverrideEntry[]>;

export interface OverrideResult {
  pending: string[];
  applied: string[];
  stale: string[];
  missing: string[];
}

export type OverrideState = "pending" | "applied" | "stale";

/** A malformed overrides file: the ValueErrors apply-local-overrides.py raises. */
export class OverridesError extends Error {}

export function overridesPath(root: string): string {
  return join(root, ".skill-vault/data/local-overrides.json");
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Python's repr of a list of strings, for the "override missing [...]" message. */
function pyList(items: string[]): string {
  return `[${items.map((item) => `'${item}'`).join(", ")}]`;
}

/** A missing file is an empty set of overrides, as in load_overrides. */
export function loadOverrides(path: string): Overrides {
  const overrides: Overrides = new Map();
  if (!isFile(path)) return overrides;
  const data: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!isPlainObject(data)) {
    throw new OverridesError("local overrides file must be an object keyed by skill name");
  }
  for (const [skill, entries] of Object.entries(data)) {
    if (!Array.isArray(entries)) throw new OverridesError(`${skill}: overrides must be a list`);
    const list: OverrideEntry[] = [];
    for (const raw of entries) {
      // A non-object entry has none of the required keys, so it fails the same way.
      const fields: Record<string, unknown> = isPlainObject(raw) ? raw : {};
      const missing = ["id", "find", "replace"].filter((key) => !(key in fields)).sort();
      if (missing.length) throw new OverridesError(`${skill}: override missing ${pyList(missing)}`);
      const { id, find, replace, file } = fields;
      if (typeof id !== "string" || typeof find !== "string" || typeof replace !== "string") {
        throw new OverridesError(`${skill}: override id, find and replace must be strings`);
      }
      if (find === replace) throw new OverridesError(`${skill}/${id}: find and replace are identical`);
      if (file !== undefined && typeof file !== "string") {
        throw new OverridesError(`${skill}/${id}: file must be a string`);
      }
      list.push(file === undefined ? { id, find, replace } : { id, find, replace, file });
    }
    overrides.set(skill, list);
  }
  return overrides;
}

/** "pending" (defect present), "applied", or "stale" (upstream rewrote the region). */
export function overrideState(text: string, entry: OverrideEntry): OverrideState {
  if (text.includes(entry.find)) return "pending";
  if (text.includes(entry.replace)) return "applied";
  return "stale";
}

/**
 * Classify every recorded override against the tree, writing the pending ones back.
 * Skills are visited in sorted order, entries in the order they are recorded.
 */
export function applyOverrides(overrides: Overrides, root: string, write = true): OverrideResult {
  const result: OverrideResult = { pending: [], applied: [], stale: [], missing: [] };
  for (const skill of [...overrides.keys()].sort()) {
    for (const entry of overrides.get(skill) ?? []) {
      const relative = `skills/${skill}/${entry.file ?? "SKILL.md"}`;
      const path = join(root, relative);
      const label = `${skill}/${entry.id}`;
      if (!isFile(path)) {
        result.missing.push(`${label} (${relative})`);
        continue;
      }
      const text = universalNewlines(readFileSync(path, "utf8"));
      const state = overrideState(text, entry);
      if (state === "pending") {
        // str.replace: every occurrence of the defect, not just the first.
        if (write) writeFileSync(path, text.replaceAll(entry.find, entry.replace), "utf8");
        result.pending.push(label);
      } else {
        result[state].push(label);
      }
    }
  }
  return result;
}

export interface OverridesIo {
  out: (line: string) => void;
  err: (line: string) => void;
}

/** apply-local-overrides.py main(): the report lines and the exit code. */
export function reportOverrides(result: OverrideResult, check: boolean, io: OverridesIo): number {
  const total = result.pending.length + result.applied.length + result.stale.length + result.missing.length;
  const verb = check ? "would re-apply" : "re-applied";
  io.out(
    `local overrides: ${total} recorded, ${result.applied.length} already applied, ` +
      `${result.pending.length} ${verb}`,
  );
  // "stale in tree" is what the Python prints under --check for a pending override; the label
  // reads oddly (these are not the stale ones) but the wording is kept for parity.
  for (const label of result.pending) io.out(`  ${check ? "stale in tree" : "re-applied"}: ${label}`);
  for (const label of result.stale) {
    io.err(`  STALE: ${label} — upstream rewrote this region; re-derive the fix`);
  }
  for (const label of result.missing) io.err(`  MISSING: ${label}`);

  if (result.stale.length || result.missing.length) return 1;
  return check && result.pending.length ? 1 : 0;
}

/** Folder names of the skills with a stale or missing override, sorted and unique. */
export function unappliedSkills(result: OverrideResult): string[] {
  const labels = [...result.stale, ...result.missing];
  return [...new Set(labels.map((label) => label.slice(0, label.indexOf("/"))))].sort();
}

function git(root: string, argv: string[]): { code: number; stdout: string; stderr: string } {
  const proc = Bun.spawnSync(["git", "-C", root, ...argv], { stdout: "pipe", stderr: "pipe" });
  return {
    code: proc.exitCode,
    stdout: proc.stdout.toString("utf8"),
    stderr: proc.stderr.toString("utf8").trim(),
  };
}

type Lock = { skills: Record<string, unknown> };

/** Parse lock JSON; throws with `label` when it is not an object with a `skills` object. */
function parseLock(text: string, label: string): Lock {
  const lock = JSON.parse(text) as unknown;
  const skills = (lock as { skills?: unknown } | null)?.skills;
  if (typeof skills !== "object" || skills === null || Array.isArray(skills)) {
    throw new Error(`${label} has no "skills" object`);
  }
  return lock as Lock;
}

/** A skill quarantine could not restore, and why. */
export interface QuarantineFailure {
  skill: string;
  reason: string;
}

/**
 * Hold each skill at its committed version: the folder from HEAD, minus any file upstream added,
 * and the .skill-lock.json entry from HEAD. Restoring the lock entry makes the next sync fetch the
 * skill again; leaving upstream's hash would mark it current while it still holds the old text.
 * Both locks are read before any folder is touched, so an unreadable lock fails every skill.
 * Returns the skills that could not be restored.
 */
export function quarantineSkills(root: string, skills: string[]): QuarantineFailure[] {
  if (!skills.length) return [];
  const failAll = (reason: string) => skills.map((skill) => ({ skill, reason }));
  const head = git(root, ["show", "HEAD:.skill-lock.json"]);
  if (head.code !== 0) return failAll(`git show HEAD:.skill-lock.json: ${head.stderr}`);
  const lockPath = join(root, ".skill-lock.json");
  let headLock: Lock;
  let lock: Lock;
  let lockText: string;
  try {
    headLock = parseLock(head.stdout, "HEAD:.skill-lock.json");
    lockText = readFileSync(lockPath, "utf8");
    lock = parseLock(lockText, ".skill-lock.json");
  } catch (e) {
    return failAll(`lock unreadable: ${e instanceof Error ? e.message : String(e)}`);
  }

  const failed: QuarantineFailure[] = [];
  for (const skill of skills) {
    const dir = `skills/${skill}`;
    // A folder HEAD never had is all untracked, so `clean` alone removes it.
    const tracked = git(root, ["cat-file", "-e", `HEAD:${dir}`]).code === 0;
    const checkout = tracked ? git(root, ["checkout", "HEAD", "--", dir]) : null;
    if (checkout && checkout.code !== 0) {
      failed.push({ skill, reason: `git checkout: ${checkout.stderr}` });
      continue;
    }
    const clean = git(root, ["clean", "-fdq", "--", dir]);
    if (clean.code !== 0) {
      failed.push({ skill, reason: `git clean: ${clean.stderr}` });
      continue;
    }
    const entry = headLock.skills[skill];
    if (entry === undefined) delete lock.skills[skill];
    else lock.skills[skill] = entry;
  }
  try {
    // The skills CLI writes JSON.stringify(lock, null, 2); keep whatever trailing newline it left.
    writeFileSync(lockPath, JSON.stringify(lock, null, 2) + (lockText.endsWith("\n") ? "\n" : ""), "utf8");
  } catch (e) {
    // folders are back at HEAD but their lock entries still carry upstream's hash
    return failAll(`lock not written: ${e instanceof Error ? e.message : String(e)}`);
  }
  return failed;
}

/**
 * `overrides --quarantine`: re-apply every override, then quarantine each skill left stale or
 * missing so one upstream rewrite holds back that skill instead of the whole sync. For
 * update-skills.yml's clean checkout only: on a working tree it discards uncommitted edits and
 * toggle state in those skills.
 * Exit 0 when everything applied, 1 when a skill was quarantined, 2 when one could not be restored.
 */
export function applyOrQuarantine(root: string, io: OverridesIo): number {
  const result = applyOverrides(loadOverrides(overridesPath(root)), root, true);
  const code = reportOverrides(result, false, io);
  const skills = unappliedSkills(result);
  const failed = quarantineSkills(root, skills);
  for (const skill of skills) {
    const failure = failed.find((f) => f.skill === skill);
    if (failure) {
      io.err(`  QUARANTINE FAILED: ${skill} — it still holds upstream's text`);
      io.err(`    ${failure.reason}`);
    } else io.err(`  QUARANTINED: ${skill} — held at HEAD until its overrides are re-derived`);
  }
  if (failed.length) return 2;
  return skills.length ? 1 : code;
}
