import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import { discoverSkills, type SkillEntry } from "../catalog";
import { packF16, unpackF16 } from "./f16";
import { FULL_FILE_HASH_VERSION, HASH_VERSION, hashSkillText, matchesRecorded } from "./hash";

/** Index location under the vault root; committed, so both files are deterministic. */
export const EMBED_DIR = "vault/embeddings";
const MANIFEST = "manifest.json";

export interface ManifestEntry {
  /** Digest of the embedded text under the manifest's hashVersion; a mismatch marks the skill stale. */
  sha256: string;
  updated: string;
  truncated?: true;
}

export interface Manifest {
  model: string;
  dim: number;
  /** Hash scheme every entry's sha256 was written under. See HASH_VERSION. */
  hashVersion: number;
  skills: Record<string, ManifestEntry>;
}

export interface EmbedIndex {
  dim: number;
  ids: string[];
  desc: Float32Array[];
  body: Float32Array[];
  /** Ids whose SKILL.md changed, is missing from the manifest, or is gone from disk. */
  stale: Set<string>;
  manifest: Manifest;
}

const ManifestSchema = z.strictObject({
  model: z.string(),
  dim: z.number().int().nonnegative(),
  // Manifests written before the scheme was named carry no field and are full-file digests.
  hashVersion: z.number().int().positive().default(FULL_FILE_HASH_VERSION),
  skills: z.record(
    z.string(),
    z.strictObject({
      sha256: z.string(),
      updated: z.string(),
      truncated: z.literal(true).optional(),
    }),
  ),
});

function embedPath(root: string, name: string): string {
  return join(root, EMBED_DIR, name);
}

// Temp sibling plus rename: a killed run leaves either the old file or the new one, never half of one.
function writeAtomic(path: string, data: string | Uint8Array): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, data);
  renameSync(tmp, path);
}

export function readManifest(root: string): Manifest | null {
  const path = embedPath(root, MANIFEST);
  if (!existsSync(path)) return null;
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(`embed manifest ${path}: ${(e as Error).message}`);
  }
  const parsed = ManifestSchema.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.map(String).join(".")}: ${i.message}`);
    throw new Error(`embed manifest ${path}: ${issues.join("; ")}`);
  }
  return parsed.data;
}

/** Keys sorted at every level so the committed manifest diffs by content, not by write order. */
export function writeManifest(root: string, m: Manifest): void {
  const skills: Record<string, ManifestEntry> = {};
  for (const id of Object.keys(m.skills).sort()) {
    const e = m.skills[id];
    if (!e) continue;
    skills[id] = e.truncated
      ? { sha256: e.sha256, truncated: true, updated: e.updated }
      : { sha256: e.sha256, updated: e.updated };
  }
  const text = `${JSON.stringify({ dim: m.dim, hashVersion: m.hashVersion, model: m.model, skills }, null, 2)}\n`;
  writeAtomic(embedPath(root, MANIFEST), text);
}

/** Holds a forced refresh's rows until every batch has landed; never part of the index itself. */
const STAGING = ".staging";

export function writeSkill(
  root: string,
  id: string,
  rows: { desc: Float32Array; body: Float32Array },
  staged = false,
): void {
  const name = staged ? join(STAGING, `${id}.f16`) : `${id}.f16`;
  writeAtomic(embedPath(root, name), packF16([rows.desc, rows.body]));
}

/** Moves the staged rows into the index and drops the staging dir. Returns the ids moved. */
export function commitStaged(root: string): string[] {
  const dir = embedPath(root, STAGING);
  if (!existsSync(dir)) return [];
  const moved: string[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".f16")) continue;
    renameSync(join(dir, name), embedPath(root, name));
    moved.push(name.slice(0, -".f16".length));
  }
  rmSync(dir, { recursive: true, force: true });
  return moved.sort();
}

/** Rows staged by a refresh that died partway: they never entered the index, so drop them. */
export function clearStaging(root: string): void {
  rmSync(embedPath(root, STAGING), { recursive: true, force: true });
}

export function removeSkill(root: string, id: string): void {
  rmSync(embedPath(root, `${id}.f16`), { force: true });
}

/** Row files with no manifest entry, left by an interrupted run. Deletes them; returns the ids. */
export function pruneOrphans(root: string, keep: Set<string>): string[] {
  const dir = join(root, EMBED_DIR);
  if (!existsSync(dir)) return [];
  const dropped: string[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".f16")) continue;
    const id = name.slice(0, -".f16".length);
    if (keep.has(id)) continue;
    rmSync(join(dir, name), { force: true });
    dropped.push(id);
  }
  return dropped.sort();
}

/**
 * Manifest ids whose SKILL.md hash differs, ids on disk the manifest never saw, and ids the
 * manifest lists whose `<id>.f16` is gone. Sorted. The row-file check is what makes a lost or
 * hand-deleted row visible: readIndex silently skips it, so hash-only staleness reported the
 * index clean while the skill had dropped out of semantic search.
 */
export function staleSkills(root: string, manifest: Manifest | null, entries: SkillEntry[]): string[] {
  const version = manifest?.hashVersion ?? HASH_VERSION;
  const stale: string[] = [];
  for (const e of entries) {
    const recorded = manifest?.skills[e.id];
    if (!recorded) {
      stale.push(e.id);
      continue;
    }
    let text: string;
    try {
      text = readFileSync(e.file, "utf8");
    } catch {
      // Unreadable now but listed as embedded: report it rather than silently keeping the vector.
      stale.push(e.id);
      continue;
    }
    if (!matchesRecorded(text, e.file, recorded.sha256, version)) {
      stale.push(e.id);
      continue;
    }
    if (!existsSync(embedPath(root, `${e.id}.f16`))) stale.push(e.id);
  }
  return stale.sort();
}

/** What migrateHashes did: the rewritten manifest plus the ids on each side of the proof. */
export interface HashMigration {
  manifest: Manifest | null;
  /** Ids proved unchanged under the old scheme and rehashed in place, no re-embedding. */
  migrated: string[];
  /** Ids whose recorded digest could not be reproduced; left for staleSkills to report. */
  unproven: string[];
}

/**
 * Brings a manifest written under an older hash scheme up to HASH_VERSION without touching a
 * vector. An entry is rehashed only when matchesRecorded can reproduce its stored digest from the
 * file on disk, which proves the embedded text is still what SKILL.md says today; entries that
 * fail keep their old digest, so the very next staleSkills reports them and they are re-embedded.
 * Manifest ids with no skill on disk are left alone — that is a removal, not a migration.
 */
export function migrateHashes(manifest: Manifest | null, entries: SkillEntry[]): HashMigration {
  if (!manifest || manifest.hashVersion === HASH_VERSION) {
    return { manifest, migrated: [], unproven: [] };
  }
  const byId = new Map(entries.map((e) => [e.id, e]));
  const skills: Record<string, ManifestEntry> = {};
  const migrated: string[] = [];
  const unproven: string[] = [];
  for (const [id, recorded] of Object.entries(manifest.skills)) {
    skills[id] = recorded;
    const entry = byId.get(id);
    if (!entry) continue;
    let text: string;
    try {
      text = readFileSync(entry.file, "utf8");
    } catch {
      unproven.push(id);
      continue;
    }
    if (matchesRecorded(text, entry.file, recorded.sha256, manifest.hashVersion)) {
      skills[id] = { ...recorded, sha256: hashSkillText(text) };
      migrated.push(id);
    } else {
      unproven.push(id);
    }
  }
  return {
    manifest: { ...manifest, hashVersion: HASH_VERSION, skills },
    migrated: migrated.sort(),
    unproven: unproven.sort(),
  };
}

/** Manifest ids with no skill on disk any more. Sorted. */
export function removedSkills(manifest: Manifest | null, entries: SkillEntry[]): string[] {
  if (!manifest) return [];
  const live = new Set(entries.map((e) => e.id));
  return Object.keys(manifest.skills)
    .filter((id) => !live.has(id))
    .sort();
}

/** Whole index in memory: two rows (description, body) per manifest id that still has a .f16 file. */
export function readIndex(root: string): EmbedIndex | null {
  const manifest = readManifest(root);
  if (!manifest) return null;
  const ids: string[] = [];
  const desc: Float32Array[] = [];
  const body: Float32Array[] = [];
  for (const id of Object.keys(manifest.skills).sort()) {
    const path = embedPath(root, `${id}.f16`);
    if (!existsSync(path)) continue;
    const rows = unpackF16(readFileSync(path), manifest.dim);
    const d = rows[0];
    const b = rows[1];
    if (!d || !b) continue;
    ids.push(id);
    desc.push(d);
    body.push(b);
  }
  const entries = discoverSkills(root, { bundles: false, excludeTransient: true });
  const stale = new Set([...staleSkills(root, manifest, entries), ...removedSkills(manifest, entries)]);
  return { dim: manifest.dim, ids, desc, body, stale, manifest };
}
