import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, renameSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { frontmatterOrThrow, MetadataError, pyStrip } from "../catalog";
import {
  atPath,
  CLAUDE_FIELD,
  CODEX_FIELD,
  fileMode,
  loadSkill,
  pyJsonDumps,
  readUtf8,
  type Skill,
} from "./state";

/** Python `str.splitlines(keepends=True)` restricted to "\n" boundaries, as the catalog reader does. */
export function splitLinesKeepEnds(text: string): string[] {
  return text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const POLICY_LINE = /^policy:[ \t]*(?:#[^\n]*)?(?:\r?\n)?$/;
const CODEX_LINE = new RegExp(`^[ \\t]+${escapeRegExp(CODEX_FIELD)}:`);

// Swap the boolean in place, keeping indentation, trailing comment and line ending; null if the
// line is not `<field>: true|false`.
function replaceBooleanLine(line: string, field: string, value: boolean, topLevel: boolean): string | null {
  const indent = topLevel ? "" : "[ \\t]+";
  const pattern = new RegExp(
    `^(${indent}${escapeRegExp(field)}:[ \\t]*)(?:true|false)([ \\t]*(?:#[^\\n]*)?)(\\r?\\n)?$`,
  );
  const m = pattern.exec(line);
  if (!m) return null;
  return `${m[1]}${value ? "true" : "false"}${m[2]}${m[3] ?? ""}`;
}

/** Set (`true`/`false`) or drop (`null`) `disable-model-invocation` in the SKILL.md frontmatter. */
export function transformSkillMdField(text: string, path: string, disabled: boolean | null): string {
  const { lines, closingIndex, newline } = atPath(path, () => frontmatterOrThrow(text));
  const matches: number[] = [];
  for (let i = 1; i < closingIndex; i++) {
    if ((lines[i] ?? "").startsWith(`${CLAUDE_FIELD}:`)) matches.push(i);
  }
  if (matches.length > 1) throw new MetadataError(`${path}: duplicate ${CLAUDE_FIELD} fields`);
  const index = matches[0];
  if (index !== undefined) {
    if (disabled === null) {
      lines.splice(index, 1);
      return lines.join("");
    }
    const replacement = replaceBooleanLine(lines[index] ?? "", CLAUDE_FIELD, disabled, true);
    if (replacement === null) throw new MetadataError(`${path}: ${CLAUDE_FIELD} must be true or false`);
    lines[index] = replacement;
  } else if (disabled !== null) {
    lines.splice(closingIndex, 0, `${CLAUDE_FIELD}: ${disabled ? "true" : "false"}${newline}`);
  }
  return lines.join("");
}

/** Python `str.title()`: uppercase a letter after any uncased character, lowercase the rest. */
export function pyTitle(s: string): string {
  let out = "";
  let previousCased = false;
  for (const ch of s) {
    const lower = ch.toLowerCase();
    const upper = ch.toUpperCase();
    out += previousCased ? lower : upper;
    previousCased = lower !== upper;
  }
  return out;
}

/** The agents/openai.yaml this tool generates for a skill that has none (skill_toggle.py _default_openai_yaml). */
export function defaultOpenaiYaml(key: string, enabled: boolean): string {
  const displayName = pyTitle(key.replaceAll("-", " "));
  return (
    "interface:\n" +
    `  display_name: ${pyJsonDumps(displayName)}\n` +
    '  short_description: "Invoke this skill explicitly when needed."\n' +
    `  default_prompt: ${pyJsonDumps(`Use $${key} for this task.`)}\n` +
    "\n" +
    "policy:\n" +
    `  ${CODEX_FIELD}: ${enabled ? "true" : "false"}\n`
  );
}

function isIndented(line: string): boolean {
  return line.startsWith(" ") || line.startsWith("\t");
}

/** Set (`true`/`false`) or drop (`null`) `policy.allow_implicit_invocation` in an openai.yaml text. */
export function transformOpenaiYamlField(text: string, path: string, enabled: boolean | null): string {
  const lines = splitLinesKeepEnds(text);
  const fieldMatches: number[] = [];
  lines.forEach((line, i) => {
    if (CODEX_LINE.test(line)) fieldMatches.push(i);
  });
  if (fieldMatches.length > 1) throw new MetadataError(`${path}: duplicate ${CODEX_FIELD} fields`);
  const index = fieldMatches[0];
  if (index !== undefined) {
    if (enabled === null) {
      lines.splice(index, 1);
      const policyMatches: number[] = [];
      lines.forEach((line, i) => {
        if (POLICY_LINE.test(line)) policyMatches.push(i);
      });
      const policyIndex = policyMatches[0];
      if (policyMatches.length === 1 && policyIndex !== undefined) {
        // The block ends at the next unindented non-blank line.
        let blockEnd = lines.length;
        for (let i = policyIndex + 1; i < lines.length; i++) {
          const line = lines[i] ?? "";
          if (pyStrip(line) && !isIndented(line)) {
            blockEnd = i;
            break;
          }
        }
        const meaningful = lines
          .slice(policyIndex + 1, blockEnd)
          .filter((line) => pyStrip(line) && !line.trimStart().startsWith("#"));
        if (meaningful.length === 0) {
          lines.splice(policyIndex, 1);
          // A generated policy block came with one blank separator; drop exactly that one.
          if (policyIndex > 0 && !pyStrip(lines[policyIndex - 1] ?? "")) lines.splice(policyIndex - 1, 1);
        }
      }
      return lines.join("");
    }
    const replacement = replaceBooleanLine(lines[index] ?? "", CODEX_FIELD, enabled, false);
    if (replacement === null) throw new MetadataError(`${path}: ${CODEX_FIELD} must be true or false`);
    lines[index] = replacement;
    return lines.join("");
  }

  if (enabled === null) return text;

  const value = enabled ? "true" : "false";
  const policyMatches: number[] = [];
  lines.forEach((line, i) => {
    if (POLICY_LINE.test(line)) policyMatches.push(i);
  });
  if (policyMatches.length > 1) throw new MetadataError(`${path}: duplicate policy blocks`);
  const policyIndex = policyMatches[0];
  if (policyIndex !== undefined) {
    const newline = (lines[policyIndex] ?? "").endsWith("\r\n") ? "\r\n" : "\n";
    lines.splice(policyIndex + 1, 0, `  ${CODEX_FIELD}: ${value}${newline}`);
    return lines.join("");
  }
  if (/^policy:[^\n]+$/m.test(text))
    throw new MetadataError(`${path}: inline policy mappings are not supported`);
  const suffix = !text || text.endsWith("\n") || text.endsWith("\r") ? "" : "\n";
  const separator = pyStrip(text) ? "\n" : "";
  return `${text}${suffix}${separator}policy:\n  ${CODEX_FIELD}: ${value}\n`;
}

/** Write via a sibling temp file and rename, keeping `mode` when given; bytes are written verbatim. */
export function atomicWrite(path: string, text: string, mode: number | null): void {
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true });
  const temporary = join(dir, `.${basename(path)}.${randomBytes(6).toString("hex")}`);
  // Only ever unlink a temp file this call created and has not yet renamed away.
  let created = false;
  try {
    writeFileSync(temporary, text, { flag: "wx", mode: 0o600 });
    created = true;
    if (mode !== null) chmodSync(temporary, mode & 0o7777);
    renameSync(temporary, path);
    created = false;
  } finally {
    if (created) rmSync(temporary, { force: true });
  }
}

/** A file's content and mode before an edit; `text: null` means it did not exist. */
export interface Original {
  path: string;
  text: string | null;
  mode: number | null;
}

export function captureOriginal(path: string): Original {
  const present = existsSync(path);
  return { path, text: present ? readUtf8(path) : null, mode: present ? fileMode(path) : null };
}

/**
 * Undo edits newest-first: rewrite captured text, or remove a created file and its now-empty
 * parent. Returns the paths it could not restore. Each entry is attempted on its own, because
 * whatever broke the forward write (an unwritable directory, say) breaks its own rollback too,
 * and one such entry must not strand the files that were rewritten before it.
 */
export function restoreOriginalFiles(originals: Original[]): string[] {
  const failed: string[] = [];
  for (const { path, text, mode } of [...originals].reverse()) {
    try {
      if (text === null) {
        rmSync(path, { force: true });
        try {
          rmdirSync(dirname(path));
        } catch {
          // parent still holds other files
        }
      } else {
        atomicWrite(path, text, mode);
      }
    } catch {
      failed.push(path);
    }
  }
  return failed;
}

/**
 * Roll `completed` back and rethrow `cause`. A rollback that could not put every file back changes
 * the error, so a half-reset vault is never reported as a plain write failure.
 */
export function rollback(completed: Original[], cause: unknown): never {
  const failed = restoreOriginalFiles(completed);
  if (failed.length === 0) throw cause;
  const message = cause instanceof Error ? cause.message : String(cause);
  throw new MetadataError(`${message}; could not restore ${failed.join(", ")}`);
}

export interface ProductStates {
  claude?: boolean | null;
  codex?: boolean | null;
}

/** Stage both edits, write them, roll everything back if any write fails; returns the reloaded skill. */
export function setSkillProductStates(skill: Skill, states: ProductStates): Skill {
  const claude = states.claude ?? null;
  const codex = states.codex ?? null;
  if (skill.error) throw new MetadataError(skill.error);
  if (claude === null && codex === null) return skill;

  const skillPath = join(skill.directory, "SKILL.md");
  const openaiPath = join(skill.directory, "agents", "openai.yaml");
  const skillOriginal = claude !== null ? readUtf8(skillPath) : null;
  const openaiOriginal = codex !== null && existsSync(openaiPath) ? readUtf8(openaiPath) : null;
  const operations: Array<Original & { updated: string }> = [];
  if (claude !== null && skillOriginal !== null) {
    const updated = transformSkillMdField(skillOriginal, skillPath, !claude);
    if (updated !== skillOriginal) {
      operations.push({ path: skillPath, text: skillOriginal, updated, mode: fileMode(skillPath) });
    }
  }
  if (codex !== null) {
    const updated =
      openaiOriginal !== null
        ? transformOpenaiYamlField(openaiOriginal, openaiPath, codex)
        : defaultOpenaiYaml(skill.key, codex);
    if (updated !== openaiOriginal) {
      const mode = existsSync(openaiPath) ? fileMode(openaiPath) : null;
      operations.push({ path: openaiPath, text: openaiOriginal, updated, mode });
    }
  }

  const completed: Original[] = [];
  try {
    for (const op of operations) {
      atomicWrite(op.path, op.updated, op.mode);
      completed.push(op);
    }
  } catch (e) {
    rollback(completed, e);
  }
  return loadSkill(skill.directory, skill.category);
}

export function setSkillEnabled(skill: Skill, enabled: boolean): Skill {
  return setSkillProductStates(skill, { claude: enabled, codex: enabled });
}

/** Anything but fully enabled (including mixed) toggles to enabled. */
export function toggleSkill(skill: Skill): Skill {
  return setSkillEnabled(skill, skill.state !== "enabled");
}
