import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { splitFrontmatter } from "../catalog";
import { transformSkillMdField } from "../toggle/edit";
import { CLAUDE_FIELD } from "../toggle/state";

/**
 * Hash scheme the manifest records under. Scheme 1 was sha256 of the whole SKILL.md, so
 * `skillquarium enable`/`disable` read as a content change and marked the vector stale; scheme 2
 * drops the invocation toggle before hashing.
 */
export const HASH_VERSION = 2;

/** Scheme 1: sha256 over the file exactly as it sits on disk, toggle line included. */
export const FULL_FILE_HASH_VERSION = 1;

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * The text an embedding is computed over, and the text the hash covers: SKILL.md with every
 * `disable-model-invocation` frontmatter line removed. The toggle says whether the model may pick
 * the skill up on its own, never what the skill covers, so it belongs in neither. Never throws: a
 * file whose frontmatter does not parse is used as it stands.
 */
export function embeddedText(text: string): string {
  // One substring scan rejects the untoggled majority before any line splitting.
  if (!text.includes(`\n${CLAUDE_FIELD}:`)) return text;
  const fm = splitFrontmatter(text);
  if (!fm) return text;
  const kept = fm.lines.filter(
    (line, i) => i === 0 || i >= fm.closingIndex || !line.startsWith(`${CLAUDE_FIELD}:`),
  );
  return kept.join("");
}

/** hashSkillText over the file at `path`. */
export function skillContentHash(path: string): string {
  return hashSkillText(readFileSync(path, "utf8"));
}

/**
 * sha256 over embeddedText, so the digest covers exactly the bytes that produced the vector.
 * `agents/openai.yaml` is left out: nothing in it reaches the embedder, so hashing it would cost
 * 2,133 extra reads per `--check` and could only ever report staleness a vector cannot have.
 */
export function hashSkillText(text: string): string {
  return sha256(embeddedText(text));
}

/**
 * Whether `recorded`, written under hash scheme `version`, still describes `text`.
 *
 * Under the current scheme that is one comparison. Under scheme 1 the digest covered the whole
 * file, so the skill is proved unchanged when the digest matches any text the toggle writer could
 * have produced from what is on disk now: the file itself, the file with the toggle dropped, and
 * the file with the toggle set either way (added before the closing fence when it is absent now,
 * replaced in place when it is present). Anything else — a body edit, a reworded description — is
 * a real change and reports a mismatch. An unrecognised newer scheme also reports a mismatch, so
 * an index written by a later build is re-embedded rather than silently trusted.
 */
export function matchesRecorded(text: string, path: string, recorded: string, version: number): boolean {
  if (version === HASH_VERSION) return hashSkillText(text) === recorded;
  if (version !== FULL_FILE_HASH_VERSION) return false;
  if (sha256(text) === recorded) return true;
  for (const value of [null, true, false] as const) {
    let variant: string;
    try {
      variant = transformSkillMdField(text, path, value);
    } catch {
      // Frontmatter the toggle writer itself rejects: it cannot have produced this file, so the
      // file as it stands was the only candidate and it has already been tried.
      return false;
    }
    if (sha256(variant) === recorded) return true;
  }
  return false;
}
