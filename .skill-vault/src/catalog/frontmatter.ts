import { closeSync, openSync, readSync } from "node:fs";
import { MetadataError } from "./errors";
import { collapseWhitespace, escapeRegExp, PY_WS, pyStrip, universalNewlines } from "./pytext";
import { decodeScalar } from "./scalar";
import type { Frontmatter } from "./types";

// build.py: re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
const FM_BLOCK = new RegExp(`^---[${PY_WS}]*\\n([\\s\\S]*?)\\n---[${PY_WS}]*\\n`);
const DESCRIPTION_KEY = new RegExp(`^description:[${PY_WS}]*([^\\n]*)$`);
const NEXT_KEY = new RegExp(`^[A-Za-z0-9_-]+:([${PY_WS}]|$)`);
const SCI_PROFILE = new RegExp(`(?:^|\\n)[${PY_WS}]*scientific-agents-profile:[${PY_WS}]*true\\b`);
const SCI_SOURCE = new RegExp(`(?:^|\\n)[${PY_WS}]*source-repo:[${PY_WS}]*K-Dense-AI/scientific-agents\\b`);
const BLOCK_INDICATORS = new Set([">", ">-", ">+", "|", "|-", "|+"]);

// skill_toggle.py _frontmatter_lines. No newline translation here, unlike Python's read_text:
// Python's toggle rewrites CRLF files as LF, this port keeps each line's ending so rewrites preserve CRLF.
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

/** splitFrontmatter with skill_toggle.py's MetadataError messages (minus the path prefix). */
export function frontmatterOrThrow(text: string): Frontmatter {
  const fm = splitFrontmatter(text);
  if (fm) return fm;
  const first = text.match(/^[^\n]*\n?/)?.[0] ?? "";
  if (first === "" || pyStrip(first) !== "---") throw new MetadataError("SKILL.md has no YAML frontmatter");
  throw new MetadataError("SKILL.md frontmatter is not closed");
}

/** Lines between the fences, endings kept: load_skill's `"".join(lines[1:closing_index])`. */
export function frontmatterBody(fm: Frontmatter): string {
  return fm.lines.slice(1, fm.closingIndex).join("");
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
      // build.py omits `>+` / `|+` from its indicator set, so those stay as description text.
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

/** First `bytes` of a file decoded as UTF-8; null when it cannot be read. */
export function readHead(file: string, bytes: number): string | null {
  try {
    const fd = openSync(file, "r");
    try {
      const buf = Buffer.alloc(bytes);
      const n = readSync(fd, buf, 0, bytes, 0);
      return buf.subarray(0, n).toString("utf8");
    } finally {
      closeSync(fd);
    }
  } catch {
    return null;
  }
}

// build.py is_scientific_agents_profile over the text Python's f.read(4096) returns:
// 4096 code points after newline translation, and the frontmatter must close inside them.
export function isScientificAgentsHead(head: string): boolean {
  const text = Array.from(universalNewlines(head)).slice(0, 4096).join("");
  const m = FM_BLOCK.exec(text);
  if (!m) return false;
  const fm = m[1] ?? "";
  return SCI_PROFILE.test(fm) || SCI_SOURCE.test(fm);
}

// 16 KiB covers 4096 code points at 4 bytes each.
export function isScientificAgentsProfile(file: string): boolean {
  const head = readHead(file, 16384);
  return head === null ? false : isScientificAgentsHead(head);
}
