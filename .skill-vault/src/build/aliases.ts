import { collapseWhitespace, pyStrip } from "../catalog";
import { loadTables, PY_WS, type Tables } from "./tables";

const SENTENCE_SPLIT = new RegExp(`(?<=[.;])[${PY_WS}]+`);
const PARENTHETICAL = /\(([^)]{1,40})\)/g;
const TOKEN_SPLIT = /[,/]| or | and /;
const ACRONYM = /^[A-Za-z][A-Za-z0-9.+-]{1,14}$/;
const TRAILING = /[ .;,]+$/;

// Python len()/slicing count code points, so measure and cut by code point.
function codePoints(text: string): string[] {
  return Array.from(text);
}

/** build.py one_liner: the first sentences that reach 40 chars, capped at `limit`. */
export function oneLiner(description: string | null | undefined, limit = 185): string {
  if (!description) return "(no description)";
  let out = "";
  for (const part of description.split(SENTENCE_SPLIT)) {
    out = out ? pyStrip(`${out} ${part}`) : part;
    if (codePoints(out).length >= 40) break;
  }
  out = collapseWhitespace(out).replace(TRAILING, "");
  const chars = codePoints(out);
  if (chars.length > limit) {
    const head = chars.slice(0, limit).join("");
    const lastSpace = head.lastIndexOf(" ");
    const cut = lastSpace === -1 ? head : head.slice(0, lastSpace);
    out = `${cut.replace(TRAILING, "")}...`;
  }
  return out;
}

/** build.py gen_aliases: curated terms + spaced id + tool acronyms in the FIRST sentence. */
export function genAliases(
  skill: string,
  description: string | null,
  tables: Tables = loadTables(),
): string[] {
  const candidates = [...(tables.synonyms.get(skill) ?? [])];
  if (skill.includes("-")) candidates.push(skill.replace(/-/g, " "));
  const first = description ? (description.split(SENTENCE_SPLIT)[0] ?? "") : "";
  for (const match of first.matchAll(PARENTHETICAL)) {
    for (const raw of (match[1] ?? "").split(TOKEN_SPLIT)) {
      const token = pyStrip(raw);
      if (
        ACRONYM.test(token) &&
        /[A-Z]/.test(token) &&
        !tables.stop.has(token.toUpperCase()) &&
        token.toLowerCase() !== skill.toLowerCase()
      ) {
        candidates.push(token);
      }
    }
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const alias of candidates) {
    const key = alias.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(alias);
  }
  return out.slice(0, 5);
}
