import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { byCodeUnit, loadTables, type Tables } from "./tables";
import { type ExpertTaxonomy, TaxonomyValidationError } from "./taxonomy";

interface ColorGroup {
  query: string;
  color: { a: number; rgb: number };
}

/** build.py expert_graph_groups: one group per discipline, after checking palette coverage. */
export function expertGraphGroups(taxonomy: ExpertTaxonomy, tables: Tables): ColorGroup[] {
  const disciplineIds = taxonomy.disciplines.map((discipline) => discipline.id);
  const taxonomyDomains = new Set(disciplineIds);
  const missing = disciplineIds.filter((id) => !tables.expertPalette.has(id)).sort(byCodeUnit);
  const unexpected = [...tables.expertPalette.keys()]
    .filter((key) => !taxonomyDomains.has(key))
    .sort(byCodeUnit);
  if (missing.length || unexpected.length) {
    throw new TaxonomyValidationError([
      "expert graph palette domains mismatch: " +
        `missing=${missing.join(", ") || "none"}; ` +
        `unexpected=${unexpected.join(", ") || "none"}`,
    ]);
  }
  return disciplineIds.map((id) => ({
    query: `[expert_primary:${id}]`,
    color: { a: 1, rgb: tables.expertPalette.get(id) ?? 0 },
  }));
}

export interface GraphIo {
  out: (line: string) => void;
  err: (line: string) => void;
}

/** build.py update_graph: rewrite the color groups and filter, preserving every other setting. */
export function updateGraph(
  root: string,
  taxonomy: ExpertTaxonomy,
  io: GraphIo,
  tables: Tables = loadTables(),
): void {
  const expertGroups = expertGraphGroups(taxonomy, tables);
  const path = join(root, ".obsidian", "graph.json");
  let cfg: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      cfg = parsed as Record<string, unknown>;
    }
  } catch {
    cfg = {};
  }
  if (cfg.close === false) {
    io.err(
      "WARNING: graph.json says the Graph view is OPEN; close it first or " +
        "Obsidian may overwrite these colors.",
    );
  }
  cfg.search = tables.graphSearch;
  cfg.showOrphans = false;
  const domainGroups = tables.categories
    .filter((category) => tables.palette.has(category.key))
    .map((category) => ({
      query: `tag:#domain/${category.key}`,
      color: { a: 1, rgb: tables.palette.get(category.key) ?? 0 },
    }));
  const colorGroups = [...expertGroups, ...domainGroups];
  cfg.colorGroups = colorGroups;
  writeFileSync(path, JSON.stringify(cfg, null, 2), "utf8");
  io.out(`graph.json: wrote ${colorGroups.length} color groups + filter`);
}
