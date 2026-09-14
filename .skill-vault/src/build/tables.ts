import { z } from "zod";
import raw from "./categories.json";

const CategorySchema = z.object({
  key: z.string(),
  title: z.string(),
  scope: z.string(),
  related: z.array(z.string()),
  skills: z.array(z.string()),
});

const TablesSchema = z.object({
  categories: z.array(CategorySchema),
  extraAssignments: z.record(z.string(), z.string()),
  synonyms: z.record(z.string(), z.array(z.string())),
  stop: z.array(z.string()),
  genericNames: z.array(z.string()),
  uiUxProMaxSkills: z.array(z.string()),
  palette: z.record(z.string(), z.number()),
  expertPalette: z.record(z.string(), z.number()),
  graphSearch: z.string(),
  personalMarker: z.string(),
  generatedExpertMarker: z.string(),
});

/** One CATEGORIES entry: build.py's (key, title, scope, related_keys, skills) tuple. */
export type Category = z.infer<typeof CategorySchema>;

/** build.py's module-level tables, dumped to categories.json. */
export interface Tables {
  categories: readonly Category[];
  extraAssignments: ReadonlyMap<string, string>;
  synonyms: ReadonlyMap<string, readonly string[]>;
  stop: ReadonlySet<string>;
  genericNames: ReadonlySet<string>;
  uiUxProMaxSkills: ReadonlySet<string>;
  palette: ReadonlyMap<string, number>;
  expertPalette: ReadonlyMap<string, number>;
  graphSearch: string;
  personalMarker: string;
  generatedExpertMarker: string;
}

// Python's `\s` for str patterns, mirroring the catalog module's private copy.
export const PY_WS =
  "\\t\\n\\v\\f\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";

export const DISPATCHER = "scientific-agents";
export const EXPERT_DOMAIN = "scientific-expert-profiles";
export const SKILLS_SUBDIR = "skills";
export const HUMAN_SUBDIR = "vault";

let cached: Tables | undefined;

/** Parse categories.json once; every later call reuses the same tables. */
export function loadTables(): Tables {
  if (cached) return cached;
  const parsed = TablesSchema.parse(raw);
  cached = {
    categories: parsed.categories,
    extraAssignments: new Map(Object.entries(parsed.extraAssignments)),
    synonyms: new Map(Object.entries(parsed.synonyms)),
    stop: new Set(parsed.stop),
    genericNames: new Set(parsed.genericNames),
    uiUxProMaxSkills: new Set(parsed.uiUxProMaxSkills),
    palette: new Map(Object.entries(parsed.palette)),
    expertPalette: new Map(Object.entries(parsed.expertPalette)),
    graphSearch: parsed.graphSearch,
    personalMarker: parsed.personalMarker,
    generatedExpertMarker: parsed.generatedExpertMarker,
  };
  return cached;
}

/** build.py main(): {k: t for k, t, _, _, _ in CATEGORIES}. */
export function titleByKey(tables: Tables): Map<string, string> {
  return new Map(tables.categories.map((c) => [c.key, c.title]));
}

/** Flatten the CATEGORIES skill lists; a skill listed twice warns and keeps the last key. */
export function keyBySkill(tables: Tables, err: (line: string) => void): Map<string, string> {
  const assigned = new Map<string, string>();
  for (const category of tables.categories) {
    for (const skill of category.skills) {
      const previous = assigned.get(skill);
      if (previous !== undefined) err(`WARNING: ${skill} in both ${previous} and ${category.key}`);
      assigned.set(skill, category.key);
    }
  }
  return assigned;
}

/** Python `sorted()` on strings: UTF-16 code-unit order, not locale collation. */
export function byCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** build.py wrapper_filename: "gstack/office-hours" -> "gstack-office-hours.md". */
export function wrapperFilename(skill: string): string {
  return `${skill.replace(/\//g, "-")}.md`;
}

/** build.py note_link: path to a wrapper note from an emitter `prefix` above vault/. */
export function noteLink(skill: string, domainBySkill: ReadonlyMap<string, string>, prefix = ""): string {
  const key = domainBySkill.get(skill) ?? "uncategorized";
  return `${prefix}notes/${key}/${wrapperFilename(skill)}`;
}

/** build.py is_gstack_subskill: transient bundle sub-skills and install artifacts. */
export function isGstackSubskill(skill: string): boolean {
  return (
    skill === "gstack" ||
    skill.startsWith("gstack/") ||
    skill.startsWith("gstack-") ||
    skill.startsWith("_gstack")
  );
}
