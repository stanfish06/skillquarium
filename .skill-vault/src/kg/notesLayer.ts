import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { pyStrip, universalNewlines } from "../catalog";
import { PY_WS, pyCompare, pySorted, sliceCodePoints } from "./ngram";

// build_kg.py SOURCE_RE / ALIASES_RE, with `^`/`$` spelled out because JS `m` also breaks
// lines on U+2028 and U+2029 while Python's re.MULTILINE does not.
const SOURCE_RE = new RegExp(`(?:^|\\n)source:[${PY_WS}]*skills/([^\\n]+?)/SKILL\\.md[${PY_WS}]*(?=\\n|$)`);
const ALIASES_RE = new RegExp(`(?:^|\\n)aliases:[${PY_WS}]*\\n((?:[${PY_WS}]*-[${PY_WS}]*[^\\n]+\\n)+)`);
const NOTE_WINDOW = 2000;

export interface NotesLayer {
  /** skill id -> its `domain:<name>` node ids. */
  domains: Map<string, Set<string>>;
  /** alias -> the single skill claiming it, in first-seen order (the n-gram index order). */
  aliasMap: Map<string, string>;
  /** alias -> the skills claiming it, when more than one does. */
  ambiguous: Map<string, string[]>;
}

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

// Path.glob("*/*.md") sorted: sorted() over Path objects orders by the whole path string,
// so "a-x/z.md" sorts before "a/z.md" ('-' < '/').
function noteFiles(notesDir: string): string[] {
  const found: string[] = [];
  for (const domain of readdirSync(notesDir)) {
    if (domain.startsWith(".")) continue; // glob "*" never matches a leading dot
    const dir = join(notesDir, domain);
    if (!isDir(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!name.startsWith(".") && name.endsWith(".md")) found.push(join(dir, name));
    }
  }
  return found.sort(pyCompare);
}

/**
 * One pass over vault/notes/<domain>/<id>.md for both things that layer carries: the domain
 * assignment, and the curated human synonyms. An alias claimed by more than one skill is
 * ambiguous and is parked rather than arbitrarily resolved.
 */
export function loadNotesLayer(notesDir: string): NotesLayer {
  const domains = new Map<string, Set<string>>();
  const byAlias = new Map<string, Set<string>>();
  if (!isDir(notesDir)) return { domains, aliasMap: new Map(), ambiguous: new Map() };

  for (const note of noteFiles(notesDir)) {
    const text = sliceCodePoints(universalNewlines(readFileSync(note, "utf8")), NOTE_WINDOW);
    const sm = SOURCE_RE.exec(text);
    if (!sm) continue;
    const sid = sm[1] ?? "";
    const domain = `domain:${basename(dirname(note))}`;
    const seen = domains.get(sid);
    if (seen) seen.add(domain);
    else domains.set(sid, new Set([domain]));

    const am = ALIASES_RE.exec(text);
    if (!am) continue;
    for (const line of (am[1] ?? "").split("\n")) {
      // line.strip().lstrip("-").strip().strip("'\"").lower()
      const alias = pyStrip(pyStrip(line).replace(/^-+/, ""))
        .replace(/^['"]+|['"]+$/g, "")
        .toLowerCase();
      if (alias.length < 4) continue; // 3-char aliases are almost all ambiguous acronyms
      const claims = byAlias.get(alias);
      if (claims) claims.add(sid);
      else byAlias.set(alias, new Set([sid]));
    }
  }

  const aliasMap = new Map<string, string>();
  const ambiguous = new Map<string, string[]>();
  for (const [alias, claims] of byAlias) {
    const only = [...claims][0];
    if (claims.size === 1 && only !== undefined) aliasMap.set(alias, only);
    else if (claims.size > 1) ambiguous.set(alias, pySorted(claims));
  }
  return { domains, aliasMap, ambiguous };
}
