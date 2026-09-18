import { readdirSync, readFileSync, rmdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { universalNewlines } from "../catalog";
import { byCodeUnit, loadTables, PY_WS, type Tables } from "./tables";
import { notesRoot } from "./wrapper";

const GENERATED_SOURCE = new RegExp(`^source:[${PY_WS}]*[^\\n]+/SKILL\\.md[${PY_WS}]*$`, "m");

function walkDirs(directory: string): string[] {
  const found = [directory];
  let entries: string[];
  try {
    entries = readdirSync(directory);
  } catch {
    return found;
  }
  for (const name of entries) {
    const path = join(directory, name);
    try {
      if (statSync(path).isDirectory()) found.push(...walkDirs(path));
    } catch {
      // vanished between listing and stat
    }
  }
  return found;
}

/**
 * build.py main() --prune: delete wrapper notes no live skill would write.
 * Only clearly generated files go: a `source: .../SKILL.md` key or the personal marker.
 */
export function pruneOrphans(
  root: string,
  liveNotes: ReadonlySet<string>,
  tables: Tables = loadTables(),
): string[] {
  const notes = notesRoot(root);
  const pruned: string[] = [];
  for (const directory of walkDirs(notes)) {
    let entries: string[];
    try {
      entries = readdirSync(directory);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (!name.endsWith(".md") || name.startsWith(".")) continue;
      const path = join(directory, name);
      try {
        if (!statSync(path).isFile()) continue;
      } catch {
        continue;
      }
      if (liveNotes.has(path)) continue;
      let text: string;
      try {
        text = universalNewlines(readFileSync(path, "utf8"));
      } catch {
        continue;
      }
      if (GENERATED_SOURCE.test(text) || text.includes(tables.personalMarker)) {
        unlinkSync(path);
        pruned.push(name.slice(0, -3));
      }
    }
  }
  // Drop domain folders emptied by the sweep, deepest first.
  for (const directory of walkDirs(notes).sort(byCodeUnit).reverse()) {
    if (directory === notes) continue;
    try {
      if (readdirSync(directory).length === 0) rmdirSync(directory);
    } catch {
      // already gone
    }
  }
  return pruned;
}
