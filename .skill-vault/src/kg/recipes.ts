import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pyStrip, universalNewlines } from "../catalog";
import { PY_WS, pyCompare, pySorted } from "./ngram";
import type { RecipeRecord } from "./types";

const LINK_RE = /\[([^\]]+)\]\((?:\.\.\/)*notes\/[^/]+\/([a-z0-9.-]+)\.md\)/g;
const STEP_LINE = new RegExp(`^[${PY_WS}]*\\d+\\.[${PY_WS}]`);
const TITLE_RE = new RegExp(`(?:^|\\n)title:[${PY_WS}]*([^\\n]+)(?=\\n|$)`);

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Recipes are the vault's hyperedges — and its only cheap, trustworthy source of direction,
 * because the numbered steps are human-authored. Only the first resolvable link on a numbered
 * line is a step; later links are alternatives and stay in `members`, so they form no false
 * chains_to edge (pydeseq2 -> rnaseq-de).
 */
export function parseRecipes(recipesDir: string, nameset: ReadonlySet<string>): Map<string, RecipeRecord> {
  const recipes = new Map<string, RecipeRecord>();
  if (!isDir(recipesDir)) return recipes;

  const files = readdirSync(recipesDir)
    .filter((name) => !name.startsWith(".") && name.endsWith(".md") && name !== "index.md")
    .sort(pyCompare);
  for (const name of files) {
    const text = universalNewlines(readFileSync(join(recipesDir, name), "utf8"));
    const steps: string[] = [];
    const seen = new Set<string>();
    for (const line of text.split("\n")) {
      if (!STEP_LINE.test(line)) continue;
      let primary = true;
      for (const m of line.matchAll(LINK_RE)) {
        const sid = m[2] ?? "";
        if (!nameset.has(sid)) continue;
        if (primary && !seen.has(sid)) {
          seen.add(sid);
          steps.push(sid);
        }
        primary = false;
      }
    }
    // Non-step members (Related / alternatives) still co-occur.
    const members = new Set(steps);
    for (const m of text.matchAll(LINK_RE)) {
      const sid = m[2] ?? "";
      if (nameset.has(sid)) members.add(sid);
    }
    const stem = name.slice(0, -3);
    const title = TITLE_RE.exec(text);
    recipes.set(`recipe:${stem}`, {
      id: `recipe:${stem}`,
      label: title ? pyStrip(title[1] ?? "") : stem,
      source: `vault/recipes/${name}`,
      steps,
      members: pySorted(members),
    });
  }
  return recipes;
}
