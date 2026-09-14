import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pyStrip, universalNewlines } from "../catalog";
import { genAliases } from "./aliases";
import {
  EXPERT_DOMAIN,
  HUMAN_SUBDIR,
  loadTables,
  noteLink,
  PY_WS,
  SKILLS_SUBDIR,
  type Tables,
  wrapperFilename,
} from "./tables";
import type { ProfileAssignment } from "./taxonomy";

const FM_BLOCK = new RegExp(`^---[${PY_WS}]*\\n([\\s\\S]*?)\\n---[${PY_WS}]*\\n`);
const ALIAS_BLOCK = new RegExp(`^aliases:[${PY_WS}]*\\n((?:[ \\t]*-[ \\t][^\\n]*\\n?)+)`, "m");
const ALIAS_INLINE = new RegExp(`^aliases:[${PY_WS}]*\\[([^\\n]*)\\][${PY_WS}]*$`, "m");
const ALIAS_EMPTY = new RegExp(`^aliases:[${PY_WS}]*(?:\\[[${PY_WS}]*\\])?[${PY_WS}]*$`, "m");
const ALIAS_ITEM = /^[ \t]*-[ \t]+([^\n]*)$/;
const QUOTES = /^['"]+|['"]+$/g;
// YAML characters that make a bare scalar ambiguous, so the alias is quoted (build.py emit_alias_block).
const NEEDS_QUOTES = /[:#[\],&*?{}|<>=!%@`"]/;

export function notesRoot(root: string): string {
  return join(root, HUMAN_SUBDIR, "notes");
}

export function notePath(root: string, skill: string, key: string): string {
  return join(notesRoot(root), key, wrapperFilename(skill));
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** User-editable wrapper state that survives a rebuild. */
export interface ExistingWrapper {
  created?: string;
  status?: string;
  rating?: string;
  /** null means the note has no `aliases:` key at all, so they are regenerated. */
  aliases: string[] | null;
  personal: string | null;
}

/**
 * build.py find_existing_note: the note's current location, wherever it sits.
 * A recategorised skill keeps its state because every domain folder is scanned.
 */
export function findExistingNote(root: string, skill: string, key: string): string | null {
  const direct = notePath(root, skill, key);
  if (isFile(direct)) return direct;
  const filename = wrapperFilename(skill);
  let domains: string[];
  try {
    domains = readdirSync(notesRoot(root)).sort();
  } catch {
    return null;
  }
  for (const domain of domains) {
    const candidate = join(notesRoot(root), domain, filename);
    if (isFile(candidate)) return candidate;
  }
  return null;
}

function scalarField(frontmatter: string, key: string): string | undefined {
  const match = new RegExp(`^${key}:[${PY_WS}]*([^\\n]+)$`, "m").exec(frontmatter);
  return match ? pyStrip(match[1] ?? "") : undefined;
}

/** build.py parse_existing: the hand-editable bits of a wrapper note. */
export function parseExisting(path: string, tables: Tables = loadTables()): ExistingWrapper {
  const text = universalNewlines(readFileSync(path, "utf8"));
  const frontmatter = FM_BLOCK.exec(text)?.[1] ?? "";
  const data: ExistingWrapper = { aliases: null, personal: null };
  const created = scalarField(frontmatter, "created");
  const status = scalarField(frontmatter, "status");
  const rating = scalarField(frontmatter, "rating");
  if (created !== undefined) data.created = created;
  if (status !== undefined) data.status = status;
  if (rating !== undefined) data.rating = rating;

  const block = ALIAS_BLOCK.exec(frontmatter);
  const inline = ALIAS_INLINE.exec(frontmatter);
  if (block) {
    data.aliases = [];
    for (const line of (block[1] ?? "").split("\n")) {
      const item = ALIAS_ITEM.exec(line);
      if (item) data.aliases.push(pyStrip(item[1] ?? "").replace(QUOTES, ""));
    }
  } else if (inline) {
    data.aliases = (inline[1] ?? "")
      .split(",")
      .filter((alias) => pyStrip(alias) !== "")
      .map((alias) => pyStrip(alias).replace(QUOTES, ""));
  } else if (ALIAS_EMPTY.test(frontmatter)) {
    data.aliases = [];
  }

  const index = text.indexOf(tables.personalMarker);
  data.personal = index === -1 ? null : text.slice(index);
  return data;
}

function emitAliasBlock(aliases: readonly string[]): string[] {
  if (!aliases.length) return [];
  const out = ["aliases:"];
  for (const alias of aliases) {
    out.push(NEEDS_QUOTES.test(alias) ? `  - "${alias}"` : `  - ${alias}`);
  }
  return out;
}

export interface RenderWrapperOptions {
  key: string;
  domainTitle: string;
  description: string | null;
  shortDescriptions: ReadonlyMap<string, string>;
  related: ReadonlySet<string>;
  existing: ExistingWrapper | null;
  today: string;
  forceAliases: boolean;
  domainBySkill?: ReadonlyMap<string, string>;
  expertAssignment?: ProfileAssignment | null;
  disciplineTitles?: ReadonlyMap<string, string>;
  categoryTitles?: ReadonlyMap<string, string>;
  bridgeDomainOrder?: readonly string[];
  tables?: Tables;
}

/** build.py render_wrapper: one wrapper note, reading nothing and writing nothing. */
export function renderWrapper(skill: string, options: RenderWrapperOptions): string {
  const {
    key,
    domainTitle,
    description,
    shortDescriptions,
    related,
    existing,
    today,
    forceAliases,
    expertAssignment = null,
    bridgeDomainOrder = [],
    tables = loadTables(),
  } = options;
  const domainBySkill = options.domainBySkill ?? new Map<string, string>();
  const disciplineTitles = options.disciplineTitles ?? new Map<string, string>();
  const categoryTitles = options.categoryTitles ?? new Map<string, string>();

  const created = existing?.created ?? today;
  const status = existing?.status ?? "untried";
  const rating = existing?.rating;
  let aliases = existing ? existing.aliases : null;
  if (aliases === null || forceAliases) aliases = genAliases(skill, description, tables);
  const personal = existing?.personal ?? null;

  const lines = ["---", `title: ${skill}`, ...emitAliasBlock(aliases), "tags:", "  - skill"];
  if (key !== "uncategorized") {
    lines.push(`  - domain/${key}`);
    lines.push(`domain: ${key}`);
  }
  if (expertAssignment !== null) {
    lines.push(`expert_primary: ${expertAssignment.primary}`);
    if (expertAssignment.secondary.length) {
      lines.push("expert_secondary:");
      lines.push(...expertAssignment.secondary.map((value) => `  - ${value}`));
    }
    lines.push("bridge_domains:");
    lines.push(...expertAssignment.bridgeDomains.map((value) => `  - ${value}`));
  }
  lines.push(`status: ${status}`);
  if (rating !== undefined && rating !== null) lines.push(`rating: ${rating}`);
  lines.push(`source: ${SKILLS_SUBDIR}/${skill}/SKILL.md`);
  lines.push(`created: ${created}`);
  lines.push(
    "---",
    "",
    `# ${skill}`,
    "",
    "> [!info] What it does",
    `> ${description || "(no description)"}`,
    "",
  );

  // A note sits at vault/notes/<key>/<skill>.md: ../.. reaches vault/, ../../.. the repo root.
  const sourceRel = `${SKILLS_SUBDIR}/${skill}/SKILL.md`;
  const nav = [`**Source:** [${sourceRel}](../../../${sourceRel})`];
  if (key !== "uncategorized") nav.push(`**Domain:** [${domainTitle}](../../maps/${key}.md)`);
  if (expertAssignment !== null) {
    const primary = expertAssignment.primary;
    nav.push(`**Primary:** [${disciplineTitles.get(primary)}](../../maps/${EXPERT_DOMAIN}/${primary}.md)`);
    if (expertAssignment.secondary.length) {
      const links = expertAssignment.secondary
        .map((value) => `[${disciplineTitles.get(value)}](../../maps/${EXPERT_DOMAIN}/${value}.md)`)
        .join(", ");
      nav.push(`**Secondary:** ${links}`);
    }
  }
  nav.push("**Table:** [skills.base](../../skills.base)", "**Index:** [Skills Index](../../index.md)");
  lines.push(nav.join("  ·  "), "");

  if (expertAssignment !== null) {
    lines.push("## Relevant capability domains", "");
    const bridges = new Set(expertAssignment.bridgeDomains);
    for (const domain of bridgeDomainOrder) {
      if (bridges.has(domain)) lines.push(`- [${categoryTitles.get(domain)}](../../maps/${domain}.md)`);
    }
  } else {
    lines.push("## Related skills", "");
    const sorted = [...related].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    if (sorted.length) {
      for (const other of sorted) {
        lines.push(
          `- [${other}](${noteLink(other, domainBySkill, "../../")}) — ${shortDescriptions.get(other)}`,
        );
      }
    } else {
      lines.push("_None auto-detected. Add your own links here, e.g. `[[scanpy]]`._");
    }
  }
  lines.push("");
  if (personal) lines.push(personal);
  else lines.push(tables.personalMarker, "", "## Notes", "");
  return lines.join("\n");
}
