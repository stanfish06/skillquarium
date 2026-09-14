import { closeSync, openSync, readSync } from "node:fs";
import type { Frontmatter } from "./types";

// Python's str.isspace() set, which its re `\s`, str.split() and str.strip() all use.
// Differs from JS `\s` by \x1c-\x1f and \x85 (included) and \ufeff (excluded).
const PY_WS =
  "\\t\\n\\v\\f\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const WS_RUN = new RegExp(`[${PY_WS}]+`);
const WS_EDGES = new RegExp(`^[${PY_WS}]+|[${PY_WS}]+$`, "g");
// build.py: re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
const FM_BLOCK = new RegExp(`^---[${PY_WS}]*\\n([\\s\\S]*?)\\n---[${PY_WS}]*\\n`);
const DESCRIPTION_KEY = new RegExp(`^description:[${PY_WS}]*([^\\n]*)$`);
const NEXT_KEY = new RegExp(`^[A-Za-z0-9_-]+:([${PY_WS}]|$)`);
const SCI_PROFILE = new RegExp(`(?:^|\\n)[${PY_WS}]*scientific-agents-profile:[${PY_WS}]*true\\b`);
const SCI_SOURCE = new RegExp(`(?:^|\\n)[${PY_WS}]*source-repo:[${PY_WS}]*K-Dense-AI/scientific-agents\\b`);
const BLOCK_INDICATORS = new Set([">", ">-", ">+", "|", "|-", "|+"]);

/** Python str.strip() with no arguments. */
export function pyStrip(s: string): string {
  return s.replace(WS_EDGES, "");
}

/** Python `" ".join(s.split())`. */
export function collapseWhitespace(s: string): string {
  return s.split(WS_RUN).filter(Boolean).join(" ");
}

// Python opens files in universal-newline mode: "\r\n" and lone "\r" both read as "\n".
function universalNewlines(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// skill_toggle.py _frontmatter_lines; line endings are kept so a rewrite can preserve them.
export function splitFrontmatter(text: string): Frontmatter | null {
  const lines = text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const first = lines[0];
  if (first === undefined || pyStrip(first) !== "---") return null;
  for (let i = 1; i < lines.length; i++) {
    if (pyStrip(lines[i] ?? "") === "---") {
      return { lines, closingIndex: i, newline: first.endsWith("\r\n") ? "\r\n" : "\n" };
    }
  }
  return null;
}

// build.py read_description: only the description key, folded and quote-stripped for the vault notes.
export function readDescriptionForBuild(text: string): string | null {
  const m = FM_BLOCK.exec(universalNewlines(text));
  if (!m) return null;
  const parts: string[] = [];
  let capturing = false;
  for (const line of (m[1] ?? "").split("\n")) {
    if (!capturing) {
      const km = DESCRIPTION_KEY.exec(line);
      if (!km) continue;
      capturing = true;
      const rest = pyStrip(km[1] ?? "");
      if (rest && ![">", "|", ">-", "|-"].includes(rest)) parts.push(rest);
    } else {
      // Only an unindented `key:` line or a `---` ends the block; indented `key:` lines are kept as text.
      if (NEXT_KEY.test(line) || pyStrip(line) === "---") break;
      parts.push(pyStrip(line));
    }
  }
  let raw = pyStrip(parts.filter(Boolean).join(" "));
  if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
    // Double-quoted scalars carry \" and \\ escapes; unescape in one pass.
    raw = raw.slice(1, -1).replace(/\\(["\\])/g, "$1");
  } else {
    raw = raw.replace(/^['"]+|['"]+$/g, "");
  }
  return collapseWhitespace(pyStrip(raw)) || null;
}

const SIMPLE_ESCAPES: Record<string, string> = {
  "\\": "\\",
  "'": "'",
  '"': '"',
  a: "\x07",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
  v: "\v",
};

// Python string-literal escapes; null for \N{...}, which needs the Unicode name table.
function decodePyEscapes(body: string): string | null {
  let out = "";
  for (let i = 0; i < body.length; i++) {
    const ch = body[i] as string;
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = body[i + 1];
    if (next === undefined) return null;
    const s = SIMPLE_ESCAPES[next];
    if (s !== undefined) {
      out += s;
      i += 1;
      continue;
    }
    if (next === "N") return null;
    const oct = /^[0-7]{1,3}/.exec(body.slice(i + 1));
    if (oct) {
      out += String.fromCodePoint(Number.parseInt(oct[0], 8));
      i += oct[0].length;
      continue;
    }
    const hexLen = next === "x" ? 2 : next === "u" ? 4 : next === "U" ? 8 : 0;
    if (hexLen > 0) {
      const hex = body.slice(i + 2, i + 2 + hexLen);
      const code = new RegExp(`^[0-9A-Fa-f]{${hexLen}}$`).test(hex) ? Number.parseInt(hex, 16) : Number.NaN;
      if (Number.isNaN(code) || code > 0x10ffff) return null;
      out += String.fromCodePoint(code);
      i += 1 + hexLen;
      continue;
    }
    // Unknown escapes keep the backslash, as Python does.
    out += ch;
  }
  return out;
}

// ast.literal_eval on a value that starts and ends with `'`: adjacent literals concatenate
// (so YAML's `''` collapses to nothing), escapes decode; null where Python raises.
function pyLiteralEval(value: string): string | null {
  let out = "";
  let i = 0;
  while (i < value.length) {
    const ch = value[i];
    if (ch === " " || ch === "\t") {
      i += 1;
      continue;
    }
    if (ch !== "'") return null;
    let j = i + 1;
    let body = "";
    while (j < value.length && value[j] !== "'") {
      if (value[j] === "\\") {
        if (j + 1 >= value.length) return null;
        body += value.slice(j, j + 2);
        j += 2;
      } else {
        body += value[j];
        j += 1;
      }
    }
    if (j >= value.length) return null;
    const decoded = decodePyEscapes(body);
    if (decoded === null) return null;
    out += decoded;
    i = j + 1;
  }
  return out;
}

// skill_toggle.py _decode_scalar
function decodeScalar(raw: string): string {
  const value = pyStrip(raw);
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    try {
      return String(JSON.parse(value));
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return pyLiteralEval(value) ?? value.slice(1, -1).replaceAll("''", "'");
  }
  return value;
}

// skill_toggle.py _frontmatter_scalar; null when the key is absent, "" when present but empty.
export function readScalar(fm: Frontmatter, key: string): string | null {
  const pattern = new RegExp(`^${escapeRegExp(key)}:[ \\t]*([^\\n]*?)[ \\t]*(?:\\r?\\n)?$`);
  for (let i = 1; i < fm.closingIndex; i++) {
    const m = pattern.exec(fm.lines[i] ?? "");
    if (!m) continue;
    const value = pyStrip(m[1] ?? "");
    if (!BLOCK_INDICATORS.has(value)) return decodeScalar(value);
    // Block scalars: indented continuation lines, stripped and space-joined (`|` does not keep newlines).
    const parts: string[] = [];
    for (let j = i + 1; j < fm.closingIndex; j++) {
      const line = fm.lines[j] ?? "";
      if (!(line.startsWith(" ") || line.startsWith("\t"))) break;
      parts.push(pyStrip(line));
    }
    return parts.filter(Boolean).join(" ");
  }
  return null;
}

// build.py is_scientific_agents_profile: Python's f.read(4096) yields 4096 code points after
// newline translation, so decode a 16 KiB prefix (4 bytes per code point at most) and slice.
export function isScientificAgentsProfile(file: string): boolean {
  let text: string;
  try {
    const fd = openSync(file, "r");
    try {
      const buf = Buffer.alloc(16384);
      const n = readSync(fd, buf, 0, buf.length, 0);
      text = buf.subarray(0, n).toString("utf8");
    } finally {
      closeSync(fd);
    }
  } catch {
    return false;
  }
  const head = Array.from(universalNewlines(text)).slice(0, 4096).join("");
  const m = FM_BLOCK.exec(head);
  if (!m) return false;
  const fm = m[1] ?? "";
  return SCI_PROFILE.test(fm) || SCI_SOURCE.test(fm);
}
