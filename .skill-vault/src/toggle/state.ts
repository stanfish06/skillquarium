import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import {
  collapseWhitespace,
  discoverSkills,
  frontmatterBody,
  frontmatterOrThrow,
  MetadataError,
  readBooleanField,
  readScalar,
} from "../catalog";

export const CLAUDE_FIELD = "disable-model-invocation";
export const CODEX_FIELD = "allow_implicit_invocation";
export const NOTES_SUBDIR = "vault/notes";

export type InvocationState = "enabled" | "disabled" | "mixed" | "error";

/** Key order is the JSON order of skill_toggle.py `_skill_json`. */
export interface Skill {
  key: string;
  name: string;
  description: string;
  directory: string;
  category: string;
  claude_enabled: boolean | null;
  codex_enabled: boolean | null;
  state: InvocationState;
  error: string | null;
}

export function invocationState(
  claude: boolean | null,
  codex: boolean | null,
  error: string | null,
): InvocationState {
  if (error || claude === null || codex === null) return "error";
  if (claude && codex) return "enabled";
  if (!claude && !codex) return "disabled";
  return "mixed";
}

// Python's Path.resolve(): realpath when the path exists, else just absolute.
export function resolveRoot(root: string): string {
  try {
    return realpathSync(root);
  } catch {
    return resolve(root);
  }
}

const UTF8 = new TextDecoder("utf-8", { fatal: true });

/** Read a file as strict UTF-8; invalid bytes throw like Python's read_text(encoding="utf-8"). */
export function readUtf8(path: string): string {
  return UTF8.decode(readFileSync(path));
}

export function fileMode(path: string): number {
  return statSync(path).mode;
}

/** Run a catalog reader; a MetadataError comes back prefixed with `<path>: ` as Python's messages are. */
export function atPath<T>(path: string, read: () => T): T {
  try {
    return read();
  } catch (e) {
    if (e instanceof MetadataError) throw new MetadataError(`${path}: ${e.message}`);
    throw e;
  }
}

/** Never throws: any metadata or I/O error lands in `error` with both flags null (skill_toggle.py load_skill). */
export function loadSkill(directory: string, category = "uncategorized"): Skill {
  const key = basename(directory);
  const skillPath = join(directory, "SKILL.md");
  try {
    const skillText = readUtf8(skillPath);
    const fm = atPath(skillPath, () => frontmatterOrThrow(skillText));
    const name = readScalar(fm, "name") || key;
    const description = readScalar(fm, "description") ?? "";
    // The Claude flag is top-level frontmatter only; the Codex flag is nested anywhere in the yaml.
    const claudeDisabled =
      atPath(skillPath, () => readBooleanField(frontmatterBody(fm), CLAUDE_FIELD, true)) ?? false;
    const openaiPath = join(directory, "agents", "openai.yaml");
    const codexEnabled = existsSync(openaiPath)
      ? (atPath(openaiPath, () => readBooleanField(readUtf8(openaiPath), CODEX_FIELD, false)) ?? true)
      : true;
    return {
      key,
      name,
      description: collapseWhitespace(description),
      directory,
      category,
      claude_enabled: !claudeDisabled,
      codex_enabled: codexEnabled,
      state: invocationState(!claudeDisabled, codexEnabled, null),
      error: null,
    };
  } catch (e) {
    // Python catches (MetadataError, OSError, UnicodeError); anything else is a bug and propagates.
    if (!(e instanceof MetadataError || isCodedError(e))) throw e;
    return {
      key,
      name: key,
      description: "",
      directory,
      category,
      claude_enabled: null,
      codex_enabled: null,
      state: "error",
      error: e.message,
    };
  }
}

/**
 * Errors carrying a Node `code`: fs failures (Python's OSError) and the fatal TextDecoder's
 * ERR_ENCODING_INVALID_ENCODED_DATA, a TypeError that stands in for Python's UnicodeError.
 */
export function isCodedError(e: unknown): e is Error & { code: string } {
  return e instanceof Error && typeof (e as { code?: unknown }).code === "string";
}

/** Skill key -> domain, from the wrapper note location vault/notes/<domain>/<key>.md. */
export function wrapperCategories(root: string): Map<string, string> {
  const categories = new Map<string, string>();
  const notes = join(root, NOTES_SUBDIR);
  if (!existsSync(notes) || !statSync(notes).isDirectory()) return categories;
  for (const domain of readdirSync(notes)) {
    const domainDir = join(notes, domain);
    if (!statSync(domainDir).isDirectory()) continue;
    for (const note of readdirSync(domainDir)) {
      if (note.endsWith(".md")) categories.set(note.slice(0, -3), domain);
    }
  }
  return categories;
}

/** All toggleable skills sorted by (name, key) case-insensitively (skill_toggle.py discover_skills). */
export function discover(root: string): Skill[] {
  const resolved = resolveRoot(root);
  const entries = discoverSkills(resolved, { bundles: false, excludeTransient: true });
  const categories = wrapperCategories(resolved);
  const skills = entries.map((entry) => loadSkill(entry.dir, categories.get(entry.id) ?? "uncategorized"));
  // toLowerCase stands in for Python's casefold, which agrees with it on this vault's ASCII ids.
  return skills.sort((a, b) => {
    const an = a.name.toLowerCase();
    const bn = b.name.toLowerCase();
    if (an !== bn) return an < bn ? -1 : 1;
    const ak = a.key.toLowerCase();
    const bk = b.key.toLowerCase();
    return ak < bk ? -1 : ak > bk ? 1 : 0;
  });
}

/** Python `json.dumps` output: ensure_ascii escapes, `, `/`: ` separators, or `indent` spaces per level. */
export function pyJsonDumps(value: unknown, indent?: number, level = 0): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : JSON.stringify(value);
  if (typeof value === "string") return pyJsonString(value);
  const pad = indent === undefined ? "" : `\n${" ".repeat(indent * (level + 1))}`;
  const close = indent === undefined ? "" : `\n${" ".repeat(indent * level)}`;
  const sep = indent === undefined ? ", " : ",";
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `[${pad}${value.map((v) => pyJsonDumps(v, indent, level + 1)).join(sep + pad)}${close}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return "{}";
  const body = entries.map(([k, v]) => `${pyJsonString(k)}: ${pyJsonDumps(v, indent, level + 1)}`);
  return `{${pad}${body.join(sep + pad)}${close}}`;
}

const JSON_SHORT: Record<string, string> = {
  '"': '\\"',
  "\\": "\\\\",
  "\n": "\\n",
  "\r": "\\r",
  "\t": "\\t",
  "\b": "\\b",
  "\f": "\\f",
};

// Everything outside printable ASCII becomes a lowercase \uXXXX escape per UTF-16 code unit.
function pyJsonString(s: string): string {
  let out = '"';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i] as string;
    const short = JSON_SHORT[ch];
    if (short !== undefined) out += short;
    else if (ch >= " " && ch <= "~") out += ch;
    else out += `\\u${s.charCodeAt(i).toString(16).padStart(4, "0")}`;
  }
  return `${out}"`;
}
