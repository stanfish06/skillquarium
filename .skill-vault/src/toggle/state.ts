import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import {
  collapseWhitespace,
  discoverSkills,
  type Frontmatter,
  pyStrip,
  readBooleanField,
  readScalar,
  splitFrontmatter,
} from "../catalog";

export const CLAUDE_FIELD = "disable-model-invocation";
export const CODEX_FIELD = "allow_implicit_invocation";
export const NOTES_SUBDIR = "vault/notes";

/** Invocation metadata cannot be read or changed without guessing (skill_toggle.py MetadataError). */
export class MetadataError extends Error {
  override name = "MetadataError";
}

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

// skill_toggle.py _frontmatter_lines, with its two error messages.
export function frontmatterLines(text: string, path: string): Frontmatter {
  const fm = splitFrontmatter(text);
  if (fm) return fm;
  const first = /^[^\n]*/.exec(text)?.[0] ?? "";
  if (pyStrip(first) !== "---") throw new MetadataError(`${path}: SKILL.md has no YAML frontmatter`);
  throw new MetadataError(`${path}: SKILL.md frontmatter is not closed`);
}

// Boolean field read with the file path prefixed to the catalog reader's messages.
function readFlag(text: string, field: string, fallback: boolean, path: string, topLevel: boolean): boolean {
  try {
    return readBooleanField(text, field, topLevel) ?? fallback;
  } catch (e) {
    throw new MetadataError(`${path}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Never throws: any metadata or I/O error lands in `error` with both flags null (skill_toggle.py load_skill). */
export function loadSkill(directory: string, category = "uncategorized"): Skill {
  const key = basename(directory);
  const skillPath = join(directory, "SKILL.md");
  try {
    const skillText = readUtf8(skillPath);
    const fm = frontmatterLines(skillText, skillPath);
    const name = readScalar(fm, "name") || key;
    const description = readScalar(fm, "description") ?? "";
    // The Claude flag is top-level frontmatter only; the Codex flag is nested anywhere in the yaml.
    const body = fm.lines.slice(1, fm.closingIndex).join("");
    const claudeDisabled = readFlag(body, CLAUDE_FIELD, false, skillPath, true);
    const openaiPath = join(directory, "agents", "openai.yaml");
    const codexEnabled = existsSync(openaiPath)
      ? readFlag(readUtf8(openaiPath), CODEX_FIELD, true, openaiPath, false)
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
    // Python catches (MetadataError, OSError, UnicodeError): metadata, fs (`code`-bearing) and
    // TextDecoder errors land in `error`; anything else is a bug and propagates.
    if (!(e instanceof MetadataError || isFsError(e) || e instanceof TypeError)) throw e;
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

function isFsError(e: unknown): e is Error & { code: string } {
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
  let entries: ReturnType<typeof discoverSkills>;
  try {
    entries = discoverSkills(resolved, { bundles: false, excludeTransient: true });
  } catch (e) {
    throw new MetadataError(e instanceof Error ? e.message : String(e));
  }
  const categories = wrapperCategories(resolved);
  const skills = entries.map((entry) => loadSkill(entry.dir, categories.get(entry.id) ?? "uncategorized"));
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
