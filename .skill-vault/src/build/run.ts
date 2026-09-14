import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  discoverSkills,
  isScientificAgentsProfile,
  isUiUxProMaxSkill,
  readDescriptionForBuild,
} from "../catalog";
import { oneLiner } from "./aliases";
import {
  atomicWriteText,
  type DisciplineMapOptions,
  expertMapPath,
  pruneStaleExpertMaps,
  renderDisciplineMap,
  renderExpertMasterMap,
} from "./expert";
import { existingCreated, renderCategoryMap } from "./maps";
import { updateGraph } from "./obsidianGraph";
import { pruneOrphans } from "./prune";
import { buildRelatedExcluding } from "./related";
import {
  byCodeUnit,
  titleByKey as categoryTitles,
  DISPATCHER,
  EXPERT_DOMAIN,
  keyBySkill as flattenCategories,
  HUMAN_SUBDIR,
  isGstackSubskill,
  loadTables,
  SKILLS_SUBDIR,
  type Tables,
} from "./tables";
import { type ExpertTaxonomy, loadCatalogProfiles, loadTaxonomy, TaxonomyValidationError } from "./taxonomy";
import { renderIndex } from "./vaultIndex";
import { findExistingNote, notePath, notesRoot, parseExisting, renderWrapper } from "./wrapper";

export interface BuildOptions {
  prune: boolean;
  graph: boolean;
  forceAliases?: boolean;
}

/** Output sinks, the build date, and the seams build.py's tests reach with mock.patch. */
export interface BuildIo {
  out?: (line: string) => void;
  err?: (line: string) => void;
  today?: string;
  tables?: Tables;
  taxonomy?: ExpertTaxonomy;
  renderDisciplineMap?: (options: DisciplineMapOptions) => string;
}

function isoToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

// Path(root).resolve(): realpath when it exists, else just absolute.
function resolveRoot(root: string): string {
  try {
    return realpathSync(root);
  } catch {
    return resolve(root);
  }
}

function readDescription(file: string): string | null {
  try {
    return readDescriptionForBuild(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** build.py main(): regenerate wrapper notes, domain maps and the index. */
export async function buildVault(root: string, options: BuildOptions, io: BuildIo = {}): Promise<number> {
  const out = io.out ?? ((line: string) => console.log(line));
  const err = io.err ?? ((line: string) => console.error(line));
  const today = io.today ?? isoToday();
  const tables = io.tables ?? loadTables();
  const renderDiscipline = io.renderDisciplineMap ?? renderDisciplineMap;
  const vaultDir = resolveRoot(root);
  const humanRoot = join(vaultDir, HUMAN_SUBDIR);
  const mapsDir = join(humanRoot, "maps");
  const expertMapsDir = join(mapsDir, EXPERT_DOMAIN);
  const taxonomyPath = join(vaultDir, ".skill-vault/data/scientific-expert-taxonomy.json");
  const catalogPath = join(vaultDir, SKILLS_SUBDIR, "scientific-agents/references/catalog.json");

  const titleByKey = categoryTitles(tables);
  const keyBySkill = flattenCategories(tables, err);
  const assigned = new Set(keyBySkill.keys());

  let onDisk: { id: string; file: string }[];
  try {
    onDisk = discoverSkills(vaultDir, { bundles: true, excludeTransient: false });
  } catch (e) {
    err(`ERROR: cannot discover skills in ${vaultDir}: ${message(e)}`);
    return 1;
  }
  const onDiskIds = onDisk.map((entry) => entry.id);
  const onDiskSet = new Set(onDiskIds);

  const importedProfiles = new Set(
    onDisk.filter((e) => e.id !== DISPATCHER && isScientificAgentsProfile(e.file)).map((e) => e.id),
  );
  const validBridgeDomains = tables.categories
    .map((category) => category.key)
    .filter((key) => key !== EXPERT_DOMAIN);

  let taxonomy: ExpertTaxonomy;
  try {
    taxonomy =
      io.taxonomy ??
      loadTaxonomy(taxonomyPath, {
        catalogProfiles: loadCatalogProfiles(catalogPath),
        discoveredProfiles: importedProfiles,
        validBridgeDomains,
      });
  } catch (e) {
    if (!(e instanceof TaxonomyValidationError)) throw e;
    err(e.message);
    return 1;
  }

  const disciplinePaths = new Map<string, string>();
  try {
    for (const discipline of taxonomy.disciplines) {
      disciplinePaths.set(discipline.id, expertMapPath(expertMapsDir, discipline.id));
    }
  } catch (e) {
    if (!(e instanceof TaxonomyValidationError)) throw e;
    err(e.message);
    return 1;
  }
  const disciplineIds = taxonomy.disciplines.map((discipline) => discipline.id);

  if (options.graph) {
    try {
      updateGraph(vaultDir, taxonomy, { out, err }, tables);
    } catch (e) {
      if (!(e instanceof TaxonomyValidationError)) throw e;
      err(e.message);
      return 1;
    }
  }

  mkdirSync(humanRoot, { recursive: true });
  mkdirSync(notesRoot(vaultDir), { recursive: true });
  mkdirSync(mapsDir, { recursive: true });
  mkdirSync(expertMapsDir, { recursive: true });

  const expertSkills = new Set(importedProfiles);
  if (onDiskSet.has(DISPATCHER)) expertSkills.add(DISPATCHER);
  for (const skill of expertSkills) {
    assigned.add(skill);
    keyBySkill.set(skill, EXPERT_DOMAIN);
  }
  // Bundled sub-skills (gstack/<child>) inherit their parent bundle's domain.
  for (const skill of onDiskIds) {
    if (!skill.includes("/") || assigned.has(skill)) continue;
    const parentKey = keyBySkill.get(skill.split("/")[0] ?? "");
    if (parentKey && parentKey !== "uncategorized") {
      assigned.add(skill);
      keyBySkill.set(skill, parentKey);
    }
  }
  for (const [skill, key] of tables.extraAssignments) {
    if (onDiskSet.has(skill) && !assigned.has(skill) && titleByKey.has(key)) {
      assigned.add(skill);
      keyBySkill.set(skill, key);
    }
  }
  const unsorted = onDiskIds.filter((skill) => !assigned.has(skill)).sort(byCodeUnit);
  if (unsorted.length) err(`WARNING: not categorized: [${unsorted.map((s) => `'${s}'`).join(", ")}]`);
  for (const skill of unsorted) keyBySkill.set(skill, "uncategorized");

  const skillsByKey = new Map<string, string[]>(tables.categories.map((c) => [c.key, []]));
  for (const skill of onDiskIds) {
    if (isGstackSubskill(skill) || isUiUxProMaxSkill(skill)) continue;
    const key = keyBySkill.get(skill) ?? "uncategorized";
    const bucket = skillsByKey.get(key);
    if (bucket) bucket.push(skill);
    else skillsByKey.set(key, [skill]);
  }

  const fullDesc = new Map<string, string | null>(
    onDisk.map((entry) => [entry.id, readDescription(entry.file)]),
  );
  const short = new Map(onDiskIds.map((id) => [id, oneLiner(fullDesc.get(id) ?? null)]));
  // Transient extras stay out of related links too, or committed wrappers churn with install state.
  const excluded = new Set([
    ...expertSkills,
    ...onDiskIds.filter((id) => isGstackSubskill(id) || isUiUxProMaxSkill(id)),
  ]);
  const related = buildRelatedExcluding(onDiskIds, fullDesc, excluded, tables);
  const disciplineTitles = new Map(taxonomy.disciplines.map((d) => [d.id, d.title]));

  // ---- wrapper notes ----
  for (const skill of onDiskIds) {
    if (isUiUxProMaxSkill(skill)) continue;
    const key = keyBySkill.get(skill) ?? "uncategorized";
    const existingPath = findExistingNote(vaultDir, skill, key);
    const rendered = renderWrapper(skill, {
      key,
      domainTitle: titleByKey.get(key) ?? "Uncategorized",
      description: fullDesc.get(skill) ?? null,
      shortDescriptions: short,
      related: related.get(skill) ?? new Set<string>(),
      existing: existingPath ? parseExisting(existingPath, tables) : null,
      today,
      forceAliases: options.forceAliases ?? false,
      domainBySkill: keyBySkill,
      expertAssignment: taxonomy.profiles.get(skill) ?? null,
      disciplineTitles,
      categoryTitles: titleByKey,
      bridgeDomainOrder: validBridgeDomains,
      tables,
    });
    const destination = notePath(vaultDir, skill, key);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, rendered, "utf8");
  }

  // ---- map notes ----
  for (const category of tables.categories) {
    const path = join(mapsDir, `${category.key}.md`);
    const created = existingCreated(path, today);
    if (category.key === EXPERT_DOMAIN) {
      // Render every expert map before writing any, so a failure leaves the tree untouched.
      const outputs: [string, string][] = [
        [
          path,
          renderExpertMasterMap({
            taxonomy,
            title: category.title,
            scope: category.scope,
            created,
            domainBySkill: keyBySkill,
            tables,
          }),
        ],
      ];
      for (const discipline of taxonomy.disciplines) {
        const disciplinePath = disciplinePaths.get(discipline.id) ?? "";
        outputs.push([
          disciplinePath,
          renderDiscipline({
            discipline,
            taxonomy,
            shortDescriptions: short,
            categoryTitles: titleByKey,
            bridgeDomainOrder: validBridgeDomains,
            created: existingCreated(disciplinePath, today),
            domainBySkill: keyBySkill,
            tables,
          }),
        ]);
      }
      for (const [outputPath, rendered] of outputs) atomicWriteText(outputPath, rendered);
      if (disciplineIds.length) pruneStaleExpertMaps(expertMapsDir, disciplineIds, tables);
      continue;
    }
    const live = [...(skillsByKey.get(category.key) ?? [])].sort(byCodeUnit);
    writeFileSync(
      path,
      renderCategoryMap({
        category,
        created,
        live,
        shortDescriptions: short,
        titleByKey,
        domainBySkill: keyBySkill,
      }),
      "utf8",
    );
  }

  // ---- index ----
  const total = onDiskIds.filter((s) => !isGstackSubskill(s) && !isUiUxProMaxSkill(s)).length;
  const indexPath = join(humanRoot, "index.md");
  const azSkills = onDiskIds.filter(
    (s) =>
      keyBySkill.get(s) !== EXPERT_DOMAIN &&
      !s.includes("/") &&
      !isGstackSubskill(s) &&
      !isUiUxProMaxSkill(s),
  );
  const unsortedDisplay = unsorted.filter((s) => !isGstackSubskill(s) && !isUiUxProMaxSkill(s));
  writeFileSync(
    indexPath,
    renderIndex({
      categories: tables.categories,
      created: existingCreated(indexPath, today),
      total,
      skillsByKey: new Map([...skillsByKey].map(([k, v]) => [k, [...v].sort(byCodeUnit)])),
      azSkills,
      unsortedDisplay,
      shortDescriptions: short,
      domainBySkill: keyBySkill,
    }),
    "utf8",
  );

  // ---- prune orphaned wrappers ----
  let pruned: string[] = [];
  if (options.prune) {
    const liveNotes = new Set(
      onDiskIds.map((s) => notePath(vaultDir, s, keyBySkill.get(s) ?? "uncategorized")),
    );
    pruned = pruneOrphans(vaultDir, liveNotes, tables);
    if (pruned.length) {
      err(`PRUNED ${pruned.length} orphan wrapper(s): ${[...pruned].sort(byCodeUnit).join(", ")}`);
    }
  }

  let edgeCount = 0;
  for (const targets of related.values()) edgeCount += targets.size;
  edgeCount = Math.floor(edgeCount / 2);
  const wrapperCount = onDiskIds.filter((s) => !isUiUxProMaxSkill(s)).length;
  out(
    `OK: ${wrapperCount} wrappers (${total} indexed skills), ${tables.categories.length} maps, ` +
      `${edgeCount} related-links, unsorted=${unsortedDisplay.length} ` +
      `(+${unsorted.length - unsortedDisplay.length} gstack), pruned=${pruned.length}`,
  );
  return 0;
}
