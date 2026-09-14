import { isAbsolute, join, resolve } from "node:path";
import { MetadataError } from "../catalog";
import {
  atomicWrite,
  captureOriginal,
  type Original,
  restoreOriginalFiles,
  setSkillProductStates,
} from "./edit";
import { discover, pyJsonDumps, readUtf8, resolveRoot, type Skill } from "./state";

export const SNAPSHOT_SCHEMA_VERSION = 1;

/** Default `<root>/.skill-vault/data/skill-toggle-state.json`; an explicit relative path resolves against cwd. */
export function snapshotPath(root: string, explicit?: string): string {
  if (explicit === undefined) return join(root, ".skill-vault", "data", "skill-toggle-state.json");
  return isAbsolute(explicit) ? explicit : resolve(explicit);
}

/** `datetime.now(UTC).isoformat()`: microsecond field (padded from milliseconds), omitted when zero. */
export function pyIsoNow(now = new Date()): string {
  const base = now.toISOString().slice(0, 19);
  const ms = now.getUTCMilliseconds();
  return `${base}${ms === 0 ? "" : `.${String(ms * 1000).padStart(6, "0")}`}+00:00`;
}

export interface SnapshotPayload {
  schema_version: number;
  saved_at: string;
  root: string;
  skills: Record<string, { claude_enabled: boolean | null; codex_enabled: boolean | null }>;
}

/**
 * Skills with a metadata error are left out so `load` never writes guessed flags. Keys keep
 * discover order (name, then key), which is the insertion order Python's dict serializes.
 */
export function snapshotPayload(root: string, skills: Skill[]): SnapshotPayload {
  const states: SnapshotPayload["skills"] = {};
  for (const skill of skills) {
    if (skill.error === null) {
      states[skill.key] = { claude_enabled: skill.claude_enabled, codex_enabled: skill.codex_enabled };
    }
  }
  return { schema_version: SNAPSHOT_SCHEMA_VERSION, saved_at: pyIsoNow(), root, skills: states };
}

export function saveSnapshot(root: string, path?: string): string {
  const resolved = resolveRoot(root);
  const destination = snapshotPath(resolved, path);
  atomicWrite(destination, `${pyJsonDumps(snapshotPayload(resolved, discover(resolved)), 2)}\n`, null);
  return destination;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reapply saved flags where they differ; restores every touched file if any skill fails. */
export function loadSnapshot(root: string, path?: string): { source: string; changed: number } {
  const resolved = resolveRoot(root);
  const source = snapshotPath(resolved, path);
  let payload: unknown;
  try {
    payload = JSON.parse(readUtf8(source));
  } catch (e) {
    throw new MetadataError(`cannot read snapshot ${source}: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!isRecord(payload) || payload.schema_version !== SNAPSHOT_SCHEMA_VERSION) {
    throw new MetadataError(`${source}: unsupported snapshot schema`);
  }
  const states = payload.skills;
  if (!isRecord(states)) throw new MetadataError(`${source}: skills must be an object`);

  const skills = new Map(discover(resolved).map((skill) => [skill.key, skill]));
  const originals: Original[] = [];
  const captured = new Set<string>();
  let changed = 0;
  try {
    for (const [key, state] of Object.entries(states)) {
      const skill = skills.get(key);
      if (skill === undefined || !isRecord(state)) continue;
      const claude = state.claude_enabled;
      const codex = state.codex_enabled;
      if (typeof claude !== "boolean" || typeof codex !== "boolean") {
        throw new MetadataError(`${source}: invalid state for ${key}`);
      }
      for (const candidate of [
        join(skill.directory, "SKILL.md"),
        join(skill.directory, "agents", "openai.yaml"),
      ]) {
        if (!captured.has(candidate)) {
          captured.add(candidate);
          originals.push(captureOriginal(candidate));
        }
      }
      if (skill.claude_enabled !== claude || skill.codex_enabled !== codex) {
        setSkillProductStates(skill, { claude, codex });
        changed += 1;
      }
    }
  } catch (e) {
    restoreOriginalFiles(originals);
    throw e;
  }
  return { source, changed };
}
