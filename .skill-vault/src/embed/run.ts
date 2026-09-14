import { readFileSync } from "node:fs";
import { discoverSkills, isInstallableExtra, readDescriptionForBuild, type SkillEntry } from "../catalog";
import type { EmbedClient } from "./client";
import { embeddedText, HASH_VERSION, hashSkillText } from "./hash";
import {
  clearStaging,
  commitStaged,
  type Manifest,
  type ManifestEntry,
  migrateHashes,
  pruneOrphans,
  readManifest,
  removedSkills,
  removeSkill,
  staleSkills,
  writeManifest,
  writeSkill,
} from "./store";

/**
 * Longest body sent to the endpoint, tracking the server's batch limit rather than its context:
 * n_ctx is 8192 tokens but ubatch is capped below that, and a 22,000-char document comes back as
 * HTTP 502 with an empty body. At ~3.5 chars per token for this corpus this is ~2,300 tokens.
 */
export const MAX_CHARS = 8_000;

/**
 * Characters per request, over and above the batchSize input cap. Two full-length bodies, sized
 * to the same server batch limit; a batch closes on whichever limit it reaches first.
 */
export const MAX_BATCH_CHARS = 16_000;

export interface EmbedOptions {
  force?: boolean;
  check?: boolean;
  batchSize: number;
  log?: (line: string) => void;
  today?: () => string;
}

export interface EmbedResult {
  embedded: number;
  removed: number;
  /** Ids embedded this run; under `check`, the ids that differ from the index (removals included). */
  stale: string[];
  /** Manifest entries an older hash scheme left behind that were rehashed in place, not re-embedded. */
  migrated: number;
  /** Entries the migration could not prove unchanged; they stay stale and are re-embedded. */
  unproven: number;
  model: string;
  dim: number;
}

interface Pending {
  id: string;
  desc: string;
  body: string;
  entry: ManifestEntry;
}

// Local calendar day, matching build.py's date.today(); toISOString would report the UTC day.
function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Groups of skills for one request: at most floor(batchSize / 2) skills, so a skill's description
 * and body always travel together, and at most MAX_BATCH_CHARS of text. One oversized skill still
 * goes out alone — its body is already capped at MAX_CHARS.
 */
function* batches(pending: Pending[], batchSize: number): Generator<Pending[]> {
  const maxSkills = Math.max(1, Math.floor(batchSize / 2));
  let batch: Pending[] = [];
  let chars = 0;
  for (const p of pending) {
    const size = p.desc.length + p.body.length;
    if (batch.length > 0 && (batch.length >= maxSkills || chars + size > MAX_BATCH_CHARS)) {
      yield batch;
      batch = [];
      chars = 0;
    }
    batch.push(p);
    chars += size;
  }
  if (batch.length > 0) yield batch;
}

/** Fresh entries for what was just embedded, carried-over entries for everything else on disk. */
function manifestSkills(
  entries: SkillEntry[],
  fresh: Map<string, ManifestEntry>,
  previous: Manifest | null,
): Record<string, ManifestEntry> {
  const skills: Record<string, ManifestEntry> = {};
  for (const e of entries) {
    const entry = fresh.get(e.id) ?? previous?.skills[e.id];
    if (entry) skills[e.id] = entry;
  }
  return skills;
}

export async function embedVault(
  root: string,
  client: EmbedClient,
  opts: EmbedOptions,
): Promise<EmbedResult> {
  // The index is committed, so an optional extra installed locally must never enter it.
  const entries = discoverSkills(root, { bundles: false, excludeTransient: true }).filter(
    (e) => !isInstallableExtra(e.id),
  );
  // Hashes recorded under an older scheme are recomputed here, before anything is called stale.
  const { manifest, migrated, unproven } = migrateHashes(readManifest(root), entries);
  if (migrated.length > 0 || unproven.length > 0) {
    opts.log?.(
      `hash scheme ${HASH_VERSION}: migrated ${migrated.length} manifest entries, ` +
        `${unproven.length} left stale`,
    );
  }
  const removed = removedSkills(manifest, entries);

  if (opts.check) {
    const differing = [...new Set([...staleSkills(root, manifest, entries), ...removed])].sort();
    return {
      embedded: 0,
      removed: removed.length,
      stale: differing,
      migrated: migrated.length,
      unproven: unproven.length,
      model: manifest?.model ?? "",
      dim: manifest?.dim ?? 0,
    };
  }

  const model = await client.modelName();
  // A different model invalidates every stored vector, as does an explicit --force.
  const forceAll = opts.force === true || (manifest !== null && manifest.model !== model);
  const stale = forceAll ? entries.map((e) => e.id) : staleSkills(root, manifest, entries);

  const day = opts.today ?? today;
  const staleSet = new Set(stale);
  const pending: Pending[] = [];
  for (const e of entries) {
    if (!staleSet.has(e.id)) continue;
    // The toggle line is stripped before embedding as well as before hashing, so the index a
    // rebuild produces does not depend on which skills happen to be enabled locally.
    const text = embeddedText(readFileSync(e.file, "utf8"));
    const truncated = text.length > MAX_CHARS;
    pending.push({
      id: e.id,
      desc: `${e.id}: ${readDescriptionForBuild(text) ?? ""}`,
      body: truncated ? text.slice(0, MAX_CHARS) : text,
      entry: {
        sha256: hashSkillText(text),
        updated: day(),
        ...(truncated ? { truncated: true as const } : {}),
      },
    });
  }

  const fresh = new Map<string, ManifestEntry>();
  let dim = manifest?.dim ?? 0;
  let dimFromRun = 0;
  let done = 0;
  // A forced refresh rewrites rows the manifest hashes still match, so writing them in place would
  // leave a half-new-model index that the next --check calls current. They go to staging and move
  // in together. Rows staged by an earlier run that died there were never part of the index.
  clearStaging(root);
  try {
    for (const batch of batches(pending, opts.batchSize)) {
      const inputs = batch.flatMap((p) => [p.desc, p.body]);
      let vectors: Float32Array[];
      try {
        vectors = await client.embed(inputs);
      } catch (e) {
        throw new Error(`embedding ${batch.map((p) => p.id).join(", ")}: ${(e as Error).message}`);
      }
      if (vectors.length !== inputs.length) {
        throw new Error(
          `embedding ${batch.map((p) => p.id).join(", ")}: got ${vectors.length} of ${inputs.length} vectors`,
        );
      }
      if (dimFromRun === 0) {
        dimFromRun = vectors[0]?.length ?? 0;
        if (manifest && manifest.dim !== dimFromRun && !opts.force) {
          throw new Error(`dim changed from ${manifest.dim} to ${dimFromRun}; rerun with --force`);
        }
        dim = dimFromRun;
      }
      for (let j = 0; j < batch.length; j++) {
        const p = batch[j];
        const desc = vectors[j * 2];
        const body = vectors[j * 2 + 1];
        if (!p || !desc || !body) continue;
        writeSkill(root, p.id, { desc, body }, forceAll);
        fresh.set(p.id, p.entry);
      }
      done += batch.length;
      opts.log?.(`embedded ${done}/${pending.length}`);
    }
    if (forceAll) commitStaged(root);
  } catch (e) {
    clearStaging(root);
    throw e;
  }

  for (const id of removed) removeSkill(root, id);

  // Manifest last and only here: it is the record of what is on disk, so a run that dies partway
  // leaves the previous manifest in place and the next --check recomputes from the file hashes.
  const next: Manifest = {
    model,
    dim,
    hashVersion: HASH_VERSION,
    skills: manifestSkills(entries, fresh, manifest),
  };
  writeManifest(root, next);
  // Rows the manifest does not list cannot be read back; drop them rather than commit them.
  const orphans = pruneOrphans(root, new Set(Object.keys(next.skills)));
  if (orphans.length > 0) opts.log?.(`dropped unreferenced rows: ${orphans.join(", ")}`);

  return {
    embedded: fresh.size,
    removed: removed.length,
    stale,
    migrated: migrated.length,
    unproven: unproven.length,
    model,
    dim,
  };
}
