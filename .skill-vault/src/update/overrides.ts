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
