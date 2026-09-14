import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import { discoverSkills, type SkillEntry } from "../catalog";
import { packF16, unpackF16 } from "./f16";

/** Index location under the vault root; committed, so both files are deterministic. */
export const EMBED_DIR = "vault/embeddings";
const MANIFEST = "manifest.json";

export interface ManifestEntry {
  /** sha256 of SKILL.md as embedded; a mismatch marks the skill stale. */
  sha256: string;
  updated: string;
  truncated?: true;
}

export interface Manifest {
  model: string;
  dim: number;
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
  const text = `${JSON.stringify({ dim: m.dim, model: m.model, skills }, null, 2)}\n`;
  writeAtomic(embedPath(root, MANIFEST), text);
}

export function writeSkill(root: string, id: string, rows: { desc: Float32Array; body: Float32Array }): void {
  writeAtomic(embedPath(root, `${id}.f16`), packF16([rows.desc, rows.body]));
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

export function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** Manifest ids whose SKILL.md hash differs, plus ids on disk the manifest never saw. Sorted. */
export function staleSkills(manifest: Manifest | null, entries: SkillEntry[]): string[] {
  const stale: string[] = [];
  for (const e of entries) {
    const recorded = manifest?.skills[e.id];
    if (!recorded || recorded.sha256 !== sha256File(e.file)) stale.push(e.id);
  }
  return stale.sort();
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
  const stale = new Set([...staleSkills(manifest, entries), ...removedSkills(manifest, entries)]);
  return { dim: manifest.dim, ids, desc, body, stale, manifest };
}
