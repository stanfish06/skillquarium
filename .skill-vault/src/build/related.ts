import { escapeRegExp } from "../catalog";
import { loadTables, type Tables } from "./tables";

// build.py: r"(?<![\w-])" + re.escape(s) + r"(?![\w-])" with re.IGNORECASE.
// Python's `\w` is Unicode-aware, so the guards use \p{L}\p{N} and the `u` flag.
function namePattern(skill: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}_-])${escapeRegExp(skill)}(?![\\p{L}\\p{N}_-])`, "iu");
}

/** build.py build_related: an edge whenever one skill's id appears whole-word in another's description. */
export function buildRelated(
  skills: readonly string[],
  fullDesc: ReadonlyMap<string, string | null>,
  tables: Tables = loadTables(),
): Map<string, Set<string>> {
  const patterns = new Map(skills.map((skill) => [skill, namePattern(skill)]));
  const edges = new Map(skills.map((skill) => [skill, new Set<string>()]));
  for (const source of skills) {
    const description = fullDesc.get(source) ?? "";
    if (!description) continue;
    for (const target of skills) {
      if (target === source || tables.genericNames.has(target)) continue;
      if (!patterns.get(target)?.test(description)) continue;
      edges.get(source)?.add(target);
      edges.get(target)?.add(source);
    }
  }
  return edges;
}

/** build.py build_related_excluding: excluded skills neither match nor gain edges. */
export function buildRelatedExcluding(
  skills: readonly string[],
  fullDesc: ReadonlyMap<string, string | null>,
  excluded: ReadonlySet<string>,
  tables: Tables = loadTables(),
): Map<string, Set<string>> {
  const candidates = skills.filter((skill) => !excluded.has(skill));
  const related = buildRelated(candidates, fullDesc, tables);
  for (const skill of skills) {
    if (!related.has(skill)) related.set(skill, new Set<string>());
  }
  return related;
}
