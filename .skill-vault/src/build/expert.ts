import {
  chmodSync,
  closeSync,
  fsyncSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { universalNewlines } from "../catalog";
import { byCodeUnit, EXPERT_DOMAIN, loadTables, noteLink, PY_WS, type Tables } from "./tables";
import { type Discipline, type ExpertTaxonomy, TaxonomyValidationError } from "./taxonomy";

const FM_BLOCK = new RegExp(`^---[${PY_WS}]*\\n([\\s\\S]*?)\\n---(?:[${PY_WS}]*\\n|$)`);

/** build.py expert_map_path: resolve one nested map path, rejecting anything outside `directory`. */
export function expertMapPath(directory: string, disciplineId: string): string {
  const root = resolve(directory);
  const candidate = resolve(root, `${disciplineId}.md`);
  if (!candidate.startsWith(root + sep)) {
    throw new TaxonomyValidationError([`discipline path escapes expert map directory: ${disciplineId}`]);
  }
  return candidate;
}

/** build.py atomic_write_text: write a temporary sibling, fsync it, then rename over the target. */
export function atomicWriteText(path: string, content: string): void {
  let mode = 0o644;
  try {
    mode = statSync(path).mode & 0o7777;
  } catch {
    // absent target: Python's default NamedTemporaryFile mode for a new file
  }
  const temporary = join(dirname(path), `.${basename(path)}.${Math.random().toString(36).slice(2, 10)}.tmp`);
  let fd: number | undefined;
  try {
    fd = openSync(temporary, "wx", 0o600);
    writeSync(fd, content, null, "utf8");
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    chmodSync(temporary, mode);
    renameSync(temporary, path);
  } catch (e) {
    if (fd !== undefined) closeSync(fd);
    try {
      unlinkSync(temporary);
    } catch {
      // the temporary was never created
    }
    throw e;
  }
}

export interface MasterMapOptions {
  taxonomy: ExpertTaxonomy;
  title: string;
  scope: string;
  created: string;
  domainBySkill?: ReadonlyMap<string, string>;
  tables?: Tables;
}

/** build.py render_expert_master_map. */
export function renderExpertMasterMap(options: MasterMapOptions): string {
  const { taxonomy, title, scope, created, tables = loadTables() } = options;
  const domainBySkill = options.domainBySkill ?? new Map<string, string>();
  const lines = [
    "---",
    `title: ${title}`,
    "tags:",
    "  - skill-map",
    tables.generatedExpertMarker,
    `created: ${created}`,
    "---",
    "",
    `# ${title}`,
    "",
    "> [!abstract] Scope",
    `> ${scope}`,
    "",
    "[Back to Skill Index](../index.md)",
    "",
    "## Profile Dispatcher",
    "",
    `- [scientific-agents](${noteLink("scientific-agents", domainBySkill, "../")}) - ` +
      "Route a question to the most relevant scientific expert profile.",
    "",
    "## Browse By Discipline",
    "",
  ];
  for (const discipline of taxonomy.disciplines) {
    const primaryCount = taxonomy.primaryProfiles(discipline.id).length;
    const crossCount = taxonomy.secondaryProfiles(discipline.id).length;
    lines.push(
      `- [${discipline.title}](${EXPERT_DOMAIN}/${discipline.id}.md) - ` +
        `${primaryCount} primary, ${crossCount} cross-disciplinary`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

export interface DisciplineMapOptions {
  discipline: Discipline;
  taxonomy: ExpertTaxonomy;
  shortDescriptions: ReadonlyMap<string, string>;
  categoryTitles: ReadonlyMap<string, string>;
  bridgeDomainOrder: readonly string[];
  created: string;
  domainBySkill?: ReadonlyMap<string, string>;
  tables?: Tables;
}

/** build.py render_expert_discipline_map. */
export function renderDisciplineMap(options: DisciplineMapOptions): string {
  const {
    discipline,
    taxonomy,
    shortDescriptions,
    categoryTitles,
    bridgeDomainOrder,
    created,
    tables = loadTables(),
  } = options;
  const domainBySkill = options.domainBySkill ?? new Map<string, string>();
  const primary = taxonomy.primaryProfiles(discipline.id);
  const secondary = taxonomy.secondaryProfiles(discipline.id);
  const bridges = taxonomy.bridgeDomainsForDiscipline(discipline.id, bridgeDomainOrder);
  const lines = [
    "---",
    `title: ${discipline.title}`,
    "tags:",
    "  - skill-map",
    tables.generatedExpertMarker,
    `created: ${created}`,
    "---",
    "",
    `# ${discipline.title}`,
    "",
    "> [!abstract] Scope",
    `> ${discipline.description}`,
    "",
    "[Back to Scientific Expert Profiles](../scientific-expert-profiles.md)",
    "",
    "## Relevant capability maps",
    "",
  ];
  if (bridges.length) {
    lines.push(...bridges.map((domain) => `- [${categoryTitles.get(domain)}](../${domain}.md)`));
  } else {
    lines.push("_No capability maps assigned._");
  }
  lines.push("", "## Primary experts", "");
  if (primary.length) {
    lines.push(...primary.map((slug) => profileBullet(slug, shortDescriptions, domainBySkill)));
  } else {
    lines.push("_No primary experts._");
  }
  lines.push("", "## Cross-disciplinary experts", "");
  if (secondary.length) {
    lines.push(...secondary.map((slug) => profileBullet(slug, shortDescriptions, domainBySkill)));
  } else {
    lines.push("_No cross-disciplinary experts._");
  }
  lines.push("");
  return lines.join("\n");
}

function profileBullet(
  slug: string,
  shortDescriptions: ReadonlyMap<string, string>,
  domainBySkill: ReadonlyMap<string, string>,
): string {
  return `- [${slug}](${noteLink(slug, domainBySkill, "../../")}) - ${shortDescriptions.get(slug)}`;
}

/** build.py prune_stale_expert_maps: drop generated direct children that no discipline claims. */
export function pruneStaleExpertMaps(
  directory: string,
  disciplineIds: readonly string[],
  tables: Tables = loadTables(),
): string[] {
  const current = new Set(disciplineIds);
  const pruned: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(directory);
  } catch {
    return pruned;
  }
  for (const name of entries) {
    if (!name.endsWith(".md")) continue;
    const path = join(directory, name);
    try {
      if (!statSync(path).isFile()) continue;
    } catch {
      continue;
    }
    if (current.has(name.slice(0, -3))) continue;
    let text: string;
    try {
      text = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    const frontmatter = FM_BLOCK.exec(universalNewlines(text))?.[1];
    if (frontmatter?.split("\n").includes(tables.generatedExpertMarker)) {
      unlinkSync(path);
      pruned.push(name);
    }
  }
  return pruned.sort(byCodeUnit);
}
