import { readFileSync } from "node:fs";
import { byCodeUnit, DISPATCHER, EXPERT_DOMAIN } from "./tables";

export const SCHEMA_VERSION = 1;
const DISCIPLINE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** expert_taxonomy.py TaxonomyValidationError: every independent failure in one message. */
export class TaxonomyValidationError extends Error {
  readonly errors: string[];
  constructor(errors: Iterable<string>) {
    const list = [...errors];
    super(`Invalid scientific expert taxonomy:\n- ${list.join("\n- ")}`);
    this.name = "TaxonomyValidationError";
    this.errors = list;
  }
}

export interface Discipline {
  id: string;
  title: string;
  description: string;
}

export interface ProfileAssignment {
  primary: string;
  secondary: string[];
  bridgeDomains: string[];
}

// MappingProxyType: a snapshot of the source entries whose mutators throw.
function frozenMap<V>(entries: Iterable<[string, V]>): ReadonlyMap<string, V> {
  const map = new Map(entries);
  const reject = (): never => {
    throw new TypeError("ExpertTaxonomy.profiles does not support item assignment");
  };
  return Object.freeze(Object.assign(map, { set: reject, delete: reject, clear: reject }));
}

function sameSequence(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export class ExpertTaxonomy {
  readonly disciplines: readonly Discipline[];
  readonly profiles: ReadonlyMap<string, ProfileAssignment>;

  constructor(disciplines: readonly Discipline[], profiles: Iterable<[string, ProfileAssignment]>) {
    this.disciplines = Object.freeze([...disciplines]);
    this.profiles = frozenMap(profiles);
  }

  disciplineById(id: string): Discipline | undefined {
    return this.disciplines.find((discipline) => discipline.id === id);
  }

  primaryProfiles(disciplineId: string): string[] {
    return [...this.profiles]
      .filter(([, profile]) => profile.primary === disciplineId)
      .map(([slug]) => slug)
      .sort(byCodeUnit);
  }

  secondaryProfiles(disciplineId: string): string[] {
    return [...this.profiles]
      .filter(([, profile]) => profile.secondary.includes(disciplineId))
      .map(([slug]) => slug)
      .sort(byCodeUnit);
  }

  /** Bridge domains of every profile shown on a discipline map, in canonical order. */
  bridgeDomainsForDiscipline(disciplineId: string, domainOrder: readonly string[]): string[] {
    const shown = new Set([...this.primaryProfiles(disciplineId), ...this.secondaryProfiles(disciplineId)]);
    const used = new Set<string>();
    for (const slug of shown) {
      for (const domain of this.profiles.get(slug)?.bridgeDomains ?? []) used.add(domain);
    }
    return domainOrder.filter((domain) => used.has(domain));
  }
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function readJson(path: string, source: string): unknown {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    throw new TaxonomyValidationError([`cannot read ${source} ${path}: ${message(e)}`]);
  }
  // Python decodes strictly; Node substitutes U+FFFD, so reject undecodable bytes here.
  if (text.includes("�")) {
    throw new TaxonomyValidationError([`cannot read ${source} ${path}: invalid utf-8`]);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (e) {
    throw new TaxonomyValidationError([`cannot read ${source} ${path}: ${message(e)}`]);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/** Profile slugs declared by the upstream scientific-agents catalog. */
export function loadCatalogProfiles(path: string): Set<string> {
  const data = readJson(path, "catalog");
  if (!isObject(data)) throw new TaxonomyValidationError(["catalog root: expected an object"]);
  const agents = data.agents;
  if (!Array.isArray(agents)) throw new TaxonomyValidationError(["catalog agents: expected a list"]);

  const errors: string[] = [];
  const profiles = new Set<string>();
  agents.forEach((agent: unknown, index: number) => {
    if (!isObject(agent)) {
      errors.push(`catalog agents[${index}]: expected an object`);
      return;
    }
    const slug = agent.slug;
    if (!nonEmptyString(slug)) {
      errors.push(`catalog agents[${index}].slug: expected a non-empty string`);
      return;
    }
    if (profiles.has(slug)) {
      errors.push(`duplicate catalog profile slug: ${slug}`);
      return;
    }
    profiles.add(slug);
  });
  if (errors.length) throw new TaxonomyValidationError(errors);
  return profiles;
}

function stringList(value: unknown, field: string, errors: string[]): string[] {
  if (!Array.isArray(value) || !value.every(nonEmptyString)) {
    errors.push(`${field}: expected a list of non-empty strings`);
    return [];
  }
  return [...(value as string[])];
}

function duplicates(values: readonly string[]): string[] {
  const seen = values.filter((value) => values.filter((other) => other === value).length > 1);
  return [...new Set(seen)].sort(byCodeUnit);
}

function joinSorted(values: Iterable<string>): string {
  return [...values].sort(byCodeUnit).join(", ") || "none";
}

export interface TaxonomyInputs {
  catalogProfiles: ReadonlySet<string>;
  discoveredProfiles: ReadonlySet<string>;
  validBridgeDomains: readonly string[];
}

/** Load a taxonomy manifest, reporting all independent errors at once. */
export function loadTaxonomy(path: string, inputs: TaxonomyInputs): ExpertTaxonomy {
  const raw = readJson(path, "taxonomy");
  if (!isObject(raw)) throw new TaxonomyValidationError(["manifest root: expected an object"]);

  const errors: string[] = [];
  const schemaVersion = raw.schema_version;
  // JSON.parse cannot tell 1.0 from 1, so only booleans and real non-integers are rejected here.
  if (
    typeof schemaVersion !== "number" ||
    !Number.isInteger(schemaVersion) ||
    schemaVersion !== SCHEMA_VERSION
  ) {
    errors.push(`unsupported schema_version: ${JSON.stringify(schemaVersion) ?? "undefined"}`);
  }

  const rawDisciplines = raw.disciplines;
  const disciplineItems: unknown[] = Array.isArray(rawDisciplines) ? rawDisciplines : [];
  if (!Array.isArray(rawDisciplines)) errors.push("disciplines: expected a list");

  const disciplines: Discipline[] = [];
  const seenDisciplineIds = new Set<string>();
  disciplineItems.forEach((item, index) => {
    if (!isObject(item)) {
      errors.push(`disciplines[${index}]: expected an object`);
      return;
    }
    const { id, title, description } = item;
    if (!nonEmptyString(id) || !nonEmptyString(title) || !nonEmptyString(description)) {
      errors.push(`disciplines[${index}]: id, title, and description are required`);
      return;
    }
    if (!DISCIPLINE_ID.test(id)) {
      errors.push(`invalid discipline id: ${id}`);
      return;
    }
    if (seenDisciplineIds.has(id)) {
      errors.push(`duplicate discipline id: ${id}`);
      return;
    }
    seenDisciplineIds.add(id);
    disciplines.push({ id, title, description });
  });

  const rawProfiles = raw.profiles;
  if (!isObject(rawProfiles)) errors.push("profiles: expected an object");
  const profileEntries = isObject(rawProfiles) ? Object.entries(rawProfiles) : [];

  const profileKeys = profileEntries.map(([slug]) => slug);
  if (!sameSequence(profileKeys, [...profileKeys].sort(byCodeUnit))) {
    errors.push("profiles: keys must be lexicographically ordered");
  }

  const taxonomySlugs = new Set(profileKeys);
  const { catalogProfiles, discoveredProfiles, validBridgeDomains } = inputs;
  const catalogOnly = [...catalogProfiles].filter((slug) => !discoveredProfiles.has(slug));
  const diskOnly = [...discoveredProfiles].filter((slug) => !catalogProfiles.has(slug));
  if (catalogOnly.length || diskOnly.length) {
    errors.push(
      `catalog/discovered mismatch: catalog-only=${joinSorted(catalogOnly)}; disk-only=${joinSorted(diskOnly)}`,
    );
  }

  const missing = [...catalogProfiles].filter((slug) => !taxonomySlugs.has(slug));
  const unexpected = new Set([...taxonomySlugs].filter((slug) => !catalogProfiles.has(slug)));
  if (missing.length) errors.push(`missing taxonomy profiles: ${joinSorted(missing)}`);
  if (taxonomySlugs.has(DISPATCHER)) {
    errors.push(`unexpected taxonomy profiles: ${DISPATCHER}`);
    unexpected.delete(DISPATCHER);
  }
  if (unexpected.size) errors.push(`unexpected taxonomy profiles: ${joinSorted(unexpected)}`);

  const validDomains = new Set(validBridgeDomains);
  const validOrder = new Map(validBridgeDomains.map((domain, index) => [domain, index]));
  const profiles: [string, ProfileAssignment][] = [];
  for (const [slug, item] of profileEntries) {
    if (!isObject(item)) {
      errors.push(`profiles.${slug}: expected an object`);
      continue;
    }

    const rawPrimary = item.primary;
    let primary = "";
    if (!nonEmptyString(rawPrimary)) {
      errors.push(`${slug}.primary: expected a non-empty string`);
    } else {
      primary = rawPrimary;
      if (!seenDisciplineIds.has(primary)) errors.push(`${slug}.primary: unknown discipline ${primary}`);
    }

    // Python's item.get("secondary", []) defaults only on a missing key, so an
    // explicit null must reach stringList and be rejected there.
    const secondary = stringList(
      "secondary" in item ? item.secondary : [],
      `${slug}.secondary`,
      errors,
    );
    if (secondary.length > 3) errors.push(`${slug}.secondary: at most 3 disciplines are allowed`);
    for (const value of duplicates(secondary)) {
      errors.push(`${slug}.secondary: duplicate discipline ${value}`);
    }
    if (primary && secondary.includes(primary)) {
      errors.push(`${slug}.secondary: repeats primary discipline ${primary}`);
    }
    for (const value of new Set(secondary)) {
      if (!seenDisciplineIds.has(value)) errors.push(`${slug}.secondary: unknown discipline ${value}`);
    }

    const bridges = stringList(item.bridge_domains, `${slug}.bridge_domains`, errors);
    if (!bridges.length) errors.push(`${slug}.bridge_domains: at least one domain is required`);
    if (bridges.length > 4) errors.push(`${slug}.bridge_domains: at most 4 domains are allowed`);
    for (const value of duplicates(bridges)) {
      errors.push(`${slug}.bridge_domains: duplicate domain ${value}`);
    }
    for (const value of new Set(bridges)) {
      if (value === EXPERT_DOMAIN) errors.push(`${slug}.bridge_domains: forbidden expert domain`);
      else if (!validDomains.has(value)) errors.push(`${slug}.bridge_domains: unknown domain ${value}`);
    }
    if (bridges.every((value) => validOrder.has(value))) {
      const canonical = [...bridges].sort((a, b) => (validOrder.get(a) ?? 0) - (validOrder.get(b) ?? 0));
      if (!sameSequence(bridges, canonical)) {
        errors.push(`${slug}.bridge_domains: must follow canonical domain order`);
      }
    }

    profiles.push([slug, { primary, secondary, bridgeDomains: bridges }]);
  }

  if (errors.length) throw new TaxonomyValidationError(errors);
  return new ExpertTaxonomy(disciplines, profiles);
}
