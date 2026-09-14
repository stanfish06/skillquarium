import { afterAll, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { DISPATCHER, EXPERT_DOMAIN, loadTables } from "../../src/build/tables";
import {
  ExpertTaxonomy,
  loadCatalogProfiles,
  loadTaxonomy,
  type ProfileAssignment,
  SCHEMA_VERSION,
  TaxonomyValidationError,
} from "../../src/build/taxonomy";
import { discoverSkills, isScientificAgentsProfile } from "../../src/catalog";
import { cleanupTempRoots, REPO_ROOT, tempRoot, write } from "./helpers";

afterAll(cleanupTempRoots);

function writeJson(name: string, data: unknown): string {
  return write(join(tempRoot(), name), JSON.stringify(data));
}

interface ManifestProfile {
  primary: string;
  secondary?: string[];
  bridge_domains?: unknown;
}
interface Manifest {
  schema_version: unknown;
  disciplines: { id: string; title: string; description: string }[];
  profiles: Record<string, ManifestProfile>;
}

function validData(): Manifest {
  return {
    schema_version: 1,
    disciplines: [
      { id: "biology-life-sciences", title: "Biology & Life Sciences", description: "Biological systems." },
      { id: "physics-astronomy", title: "Physics & Astronomy", description: "Physical systems." },
    ],
    profiles: {
      astrobiologist: { primary: "biology-life-sciences", bridge_domains: ["data-science-compute"] },
      biophysicist: {
        primary: "biology-life-sciences",
        secondary: ["physics-astronomy"],
        bridge_domains: ["imaging-signals", "data-science-compute"],
      },
    },
  };
}

const BOTH = new Set(["astrobiologist", "biophysicist"]);
const DOMAINS = ["imaging-signals", "data-science-compute"];

function loadInvalid(data: Manifest, validBridgeDomains = DOMAINS): TaxonomyValidationError {
  try {
    loadTaxonomy(writeJson("taxonomy.json", data), {
      catalogProfiles: BOTH,
      discoveredProfiles: BOTH,
      validBridgeDomains,
    });
  } catch (e) {
    if (e instanceof TaxonomyValidationError) return e;
    throw e;
  }
  throw new Error("expected a TaxonomyValidationError");
}

test("loads a valid catalog and taxonomy and builds the lookup indexes", () => {
  const catalogPath = writeJson("catalog.json", {
    agents: [{ slug: "biophysicist" }, { slug: "astrobiologist" }],
  });
  const catalogProfiles = loadCatalogProfiles(catalogPath);
  const taxonomy = loadTaxonomy(writeJson("taxonomy.json", validData()), {
    catalogProfiles,
    discoveredProfiles: BOTH,
    validBridgeDomains: DOMAINS,
  });

  expect(SCHEMA_VERSION).toBe(1);
  expect(DISPATCHER).toBe("scientific-agents");
  expect(EXPERT_DOMAIN).toBe("scientific-expert-profiles");
  expect([...catalogProfiles].sort()).toEqual(["astrobiologist", "biophysicist"]);
  expect(taxonomy.disciplines[0]?.id).toBe("biology-life-sciences");
  expect(taxonomy.disciplines.map((d) => d.id)).toEqual(["biology-life-sciences", "physics-astronomy"]);
  expect(taxonomy.disciplineById("physics-astronomy")?.title).toBe("Physics & Astronomy");
  expect(taxonomy.profiles.get("biophysicist")?.secondary).toEqual(["physics-astronomy"]);
  expect(taxonomy.profiles.get("astrobiologist")?.secondary).toEqual([]);
  expect(taxonomy.primaryProfiles("biology-life-sciences")).toEqual(["astrobiologist", "biophysicist"]);
  expect(taxonomy.secondaryProfiles("physics-astronomy")).toEqual(["biophysicist"]);
  expect(
    taxonomy.bridgeDomainsForDiscipline("physics-astronomy", ["data-science-compute", "imaging-signals"]),
  ).toEqual(["data-science-compute", "imaging-signals"]);
  expect(Object.isFrozen(taxonomy.disciplines)).toBe(true);
});

test("profiles is a frozen ReadonlyMap snapshot of its source", () => {
  const assignment: ProfileAssignment = {
    primary: "biology-life-sciences",
    secondary: [],
    bridgeDomains: ["data-science-compute"],
  };
  const source = new Map<string, ProfileAssignment>([["biophysicist", assignment]]);
  const taxonomy = new ExpertTaxonomy([], source);

  source.clear();

  expect([...taxonomy.profiles.keys()]).toEqual(["biophysicist"]);
  const mutable = taxonomy.profiles as Map<string, ProfileAssignment>;
  expect(() => mutable.set("astrobiologist", assignment)).toThrow(TypeError);
  expect(() => mutable.delete("biophysicist")).toThrow(TypeError);
});

// JSON.parse cannot distinguish 1.0 from 1, so the float case uses a value that survives parsing.
test.each([true, 1.5, "1", null])("rejects non-integer schema_version %p", (schemaVersion) => {
  const data = validData();
  data.schema_version = schemaVersion;
  expect(loadInvalid(data).message).toContain("unsupported schema_version");
});

test("wraps malformed utf-8 as a validation error", () => {
  const path = join(tempRoot(), "taxonomy.json");
  writeFileSync(path, Buffer.from([0xff]));

  const error = (() => {
    try {
      loadTaxonomy(path, {
        catalogProfiles: new Set(),
        discoveredProfiles: new Set(),
        validBridgeDomains: [],
      });
    } catch (e) {
      return e as Error;
    }
    throw new Error("expected a TaxonomyValidationError");
  })();
  expect(error).toBeInstanceOf(TaxonomyValidationError);
  expect(error.message).toContain("cannot read taxonomy");
});

test("rejects unsorted profile keys", () => {
  const data = validData();
  const { astrobiologist, biophysicist } = data.profiles as Record<string, ManifestProfile>;
  data.profiles = {
    biophysicist: biophysicist as ManifestProfile,
    astrobiologist: astrobiologist as ManifestProfile,
  };
  expect(loadInvalid(data).message).toContain("profiles: keys must be lexicographically ordered");
});

test("rejects more than three secondary disciplines", () => {
  const data = validData();
  for (const id of ["chemistry", "medicine", "engineering"]) {
    data.disciplines.push({ id, title: id, description: "Additional discipline." });
  }
  const biophysicist = data.profiles.biophysicist as ManifestProfile;
  biophysicist.secondary = ["physics-astronomy", "chemistry", "medicine", "engineering"];
  expect(loadInvalid(data).message).toContain("biophysicist.secondary: at most 3 disciplines are allowed");
});

test("rejects more than four bridge domains", () => {
  const data = validData();
  const domains = [0, 1, 2, 3, 4].map((index) => `domain-${index}`);
  (data.profiles.astrobiologist as ManifestProfile).bridge_domains = domains;
  expect(loadInvalid(data, [...domains, ...DOMAINS]).message).toContain(
    "astrobiologist.bridge_domains: at most 4 domains are allowed",
  );
});

test("rejects bridge domains outside canonical order", () => {
  const data = validData();
  (data.profiles.biophysicist as ManifestProfile).bridge_domains = [
    "data-science-compute",
    "imaging-signals",
  ];
  expect(loadInvalid(data).message).toContain(
    "biophysicist.bridge_domains: must follow canonical domain order",
  );
});

test("reports all validation errors together", () => {
  const data = validData();
  data.schema_version = 2;
  data.disciplines.push(data.disciplines[0] as Manifest["disciplines"][number]);
  data.disciplines.push({ id: "", title: "Incomplete", description: "" });
  data.profiles = {
    biophysicist: {
      primary: "missing",
      secondary: ["missing", "missing"],
      bridge_domains: ["scientific-expert-profiles", "unknown", "unknown"],
    },
    "scientific-agents": { primary: "", secondary: [1] as unknown as string[], bridge_domains: [] },
  };

  let message = "";
  try {
    loadTaxonomy(writeJson("taxonomy.json", data), {
      catalogProfiles: new Set(["biophysicist", "missing-from-manifest"]),
      discoveredProfiles: new Set(["biophysicist", "disk-only"]),
      validBridgeDomains: DOMAINS,
    });
  } catch (e) {
    message = (e as Error).message;
  }

  expect(message.startsWith("Invalid scientific expert taxonomy:\n- ")).toBe(true);
  for (const fragment of [
    "unsupported schema_version: 2",
    "duplicate discipline id: biology-life-sciences",
    "disciplines[3]: id, title, and description are required",
    "catalog/discovered mismatch",
    "missing taxonomy profiles: missing-from-manifest",
    "unexpected taxonomy profiles: scientific-agents",
    "biophysicist.primary: unknown discipline missing",
    "biophysicist.secondary: duplicate discipline missing",
    "biophysicist.secondary: repeats primary discipline missing",
    "biophysicist.bridge_domains: duplicate domain unknown",
    "biophysicist.bridge_domains: unknown domain unknown",
    "biophysicist.bridge_domains: forbidden expert domain",
    "scientific-agents.primary: expected a non-empty string",
    "scientific-agents.secondary: expected a list of non-empty strings",
    "scientific-agents.bridge_domains: at least one domain is required",
  ]) {
    expect(message).toContain(fragment);
  }
});

test("the repository manifest covers every imported profile", () => {
  const tables = loadTables();
  const catalog = loadCatalogProfiles(join(REPO_ROOT, "skills/scientific-agents/references/catalog.json"));
  const discovered = new Set(
    discoverSkills(REPO_ROOT, { bundles: false, excludeTransient: false })
      .filter((entry) => entry.id !== DISPATCHER && isScientificAgentsProfile(entry.file))
      .map((entry) => entry.id),
  );
  const validDomains = tables.categories.map((c) => c.key).filter((key) => key !== EXPERT_DOMAIN);
  const taxonomy = loadTaxonomy(join(REPO_ROOT, ".skill-vault/data/scientific-expert-taxonomy.json"), {
    catalogProfiles: catalog,
    discoveredProfiles: discovered,
    validBridgeDomains: validDomains,
  });

  expect(taxonomy.profiles.size).toBe(503);
  expect(taxonomy.disciplines.length).toBe(10);
  for (const discipline of taxonomy.disciplines) {
    expect(taxonomy.primaryProfiles(discipline.id).length).toBeGreaterThan(0);
  }
  expect([...taxonomy.profiles.values()].every((p) => p.bridgeDomains.length > 0)).toBe(true);
  expect(taxonomy.profiles.get("psychophysicist")?.secondary).toEqual([]);
  expect(taxonomy.profiles.get("veterinary-epidemiologist")?.primary).toBe(
    "agriculture-food-animal-sciences",
  );
  expect(taxonomy.profiles.get("veterinary-epidemiologist")?.secondary).toEqual(["mathematics-statistics"]);
  const expectedBridges: Record<string, string[]> = {
    "materials-scientist": ["data-science-compute", "quantum-physics"],
    "photovoltaics-solar-cell-scientist": ["data-science-compute", "quantum-physics"],
    "urban-infrastructure-planner": ["data-science-compute"],
    "animal-scientist": ["data-science-compute"],
    glycobiologist: ["proteomics-metabolomics"],
    logician: ["data-science-compute"],
    "pure-mathematician": ["data-science-compute"],
    "computer-architecture-researcher": ["data-science-compute", "software-dev"],
    "animal-geneticist-breeder": ["genomics-variants", "data-science-compute"],
    "digital-pathology-scientist": ["clinical-medical", "imaging-signals", "ml-ai"],
    "environmental-health-scientist": ["clinical-medical", "data-science-compute"],
    "protein-engineer": ["proteomics-metabolomics", "drug-discovery-chem", "sequence-phylogenetics", "ml-ai"],
    "quantum-chemist": ["drug-discovery-chem", "data-science-compute", "quantum-physics"],
    "robotics-scientist": ["imaging-signals", "data-science-compute"],
  };
  for (const [slug, bridges] of Object.entries(expectedBridges)) {
    expect(taxonomy.profiles.get(slug)?.bridgeDomains).toEqual(bridges);
  }
});
