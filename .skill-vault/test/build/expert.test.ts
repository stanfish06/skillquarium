import { afterAll, beforeAll, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  atomicWriteText,
  pruneStaleExpertMaps,
  renderDisciplineMap,
  renderExpertMasterMap,
} from "../../src/build/expert";
import { buildVault } from "../../src/build/run";
import { type Category, EXPERT_DOMAIN, loadTables, type Tables } from "../../src/build/tables";
import {
  type Discipline,
  ExpertTaxonomy,
  loadCatalogProfiles,
  loadTaxonomy,
  type ProfileAssignment,
  TaxonomyValidationError,
} from "../../src/build/taxonomy";
import { discoverSkills, isScientificAgentsProfile } from "../../src/catalog";
import {
  cleanupTempRoots,
  type Link,
  REPO_ROOT,
  tempRoot,
  validateDisciplineProfileSections,
  validateExpertWrapperFrontmatter,
  validateGeneratedMapLinks,
  write,
} from "./helpers";

afterAll(cleanupTempRoots);

const DOMAIN_BY_SKILL = new Map<string, string>(
  [
    "scientific-agents",
    "alpha-physicist",
    "beta-physicist",
    "zeta-physicist",
    "omega-biologist",
    "algebraist",
  ].map((slug) => [slug, EXPERT_DOMAIN]),
);

function assignment(primary: string, secondary: string[], bridgeDomains: string[]): ProfileAssignment {
  return { primary, secondary, bridgeDomains };
}

function sampleTaxonomy(): ExpertTaxonomy {
  const disciplines: Discipline[] = [
    {
      id: "physics-astronomy",
      title: "Physics & Astronomy",
      description: "Physical systems from particles to the cosmos.",
    },
    {
      id: "biology-life-sciences",
      title: "Biology & Life Sciences",
      description: "Living systems across scales.",
    },
  ];
  return new ExpertTaxonomy(disciplines, [
    ["alpha-physicist", assignment("physics-astronomy", [], ["imaging-signals"])],
    ["beta-physicist", assignment("physics-astronomy", [], ["research-writing"])],
    ["omega-biologist", assignment("biology-life-sciences", ["physics-astronomy"], ["data-science-compute"])],
    ["zeta-physicist", assignment("physics-astronomy", [], ["research-writing"])],
  ]);
}

/** A root holding only what buildVault reads before it writes anything. */
function vaultFixture(options: { taxonomy?: unknown; catalog?: unknown } = {}): string {
  const root = tempRoot();
  mkdirSync(join(root, "skills"), { recursive: true });
  write(
    join(root, "skills/scientific-agents/references/catalog.json"),
    JSON.stringify(options.catalog ?? { agents: [] }),
  );
  write(
    join(root, ".skill-vault/data/scientific-expert-taxonomy.json"),
    JSON.stringify(options.taxonomy ?? { schema_version: 1, disciplines: [], profiles: {} }),
  );
  mkdirSync(join(root, "vault/maps", EXPERT_DOMAIN), { recursive: true });
  return root;
}

function tablesWith(categories: Category[]): Tables {
  return { ...loadTables(), categories };
}

const EXPERT_CATEGORY: Category = {
  key: EXPERT_DOMAIN,
  title: "Scientific Expert Profiles",
  scope: "Discipline-specific profiles.",
  related: [],
  skills: [],
};

test("atomic write replaces the target through a temporary sibling", () => {
  const target = write(join(tempRoot(), "map.md"), "old");

  atomicWriteText(target, "new");

  expect(readFileSync(target, "utf8")).toBe("new");
  const siblings = Bun.spawnSync(["ls", "-a", join(target, "..")]);
  expect(new TextDecoder().decode(siblings.stdout)).not.toContain(".tmp");
});

test("the master map uses manifest order, counts and the dispatcher without a flat list", () => {
  const taxonomy = sampleTaxonomy();
  const rendered = renderExpertMasterMap({
    taxonomy,
    title: "Scientific Expert Profiles",
    scope: "Discipline-specific scientific and engineering profiles.",
    created: "2025-01-02",
    domainBySkill: DOMAIN_BY_SKILL,
  });

  expect(rendered).toContain(
    "tags:\n  - skill-map\ngenerated: scientific-expert-taxonomy\ncreated: 2025-01-02",
  );
  expect(rendered).toContain("[Back to Skill Index](../index.md)");
  expect(rendered).toContain("## Profile Dispatcher");
  expect(rendered).toContain(`[scientific-agents](../notes/${EXPERT_DOMAIN}/scientific-agents.md)`);
  expect(rendered).toContain("## Browse By Discipline");
  const physics =
    "[Physics & Astronomy](scientific-expert-profiles/physics-astronomy.md) - 3 primary, 1 cross-disciplinary";
  const biology =
    "[Biology & Life Sciences](scientific-expert-profiles/biology-life-sciences.md) - 1 primary, 0 cross-disciplinary";
  expect(rendered).toContain(physics);
  expect(rendered).toContain(biology);
  expect(rendered.indexOf(physics)).toBeLessThan(rendered.indexOf(biology));
  for (const slug of taxonomy.profiles.keys()) expect(rendered).not.toContain(`../${slug}.md`);
});

test("a nested map orders links and unions bridges for every shown profile", () => {
  const taxonomy = sampleTaxonomy();
  const rendered = renderDisciplineMap({
    discipline: taxonomy.disciplines[0] as Discipline,
    taxonomy,
    domainBySkill: DOMAIN_BY_SKILL,
    shortDescriptions: new Map([
      ["alpha-physicist", "Alpha summary."],
      ["beta-physicist", "Beta summary."],
      ["omega-biologist", "Omega summary."],
      ["zeta-physicist", "Zeta summary."],
    ]),
    categoryTitles: new Map([
      ["research-writing", "Scientific Writing, Figures & Publishing"],
      ["data-science-compute", "Data Science, Stats & Scientific Computing"],
      ["imaging-signals", "Imaging, Microscopy & Biosignals"],
    ]),
    bridgeDomainOrder: ["research-writing", "data-science-compute", "imaging-signals"],
    created: "2025-01-02",
  });

  expect(rendered).toContain("# Physics & Astronomy");
  expect(rendered).toContain("generated: scientific-expert-taxonomy");
  expect(rendered).toContain("Physical systems from particles to the cosmos.");
  expect(rendered).toContain("[Back to Scientific Expert Profiles](../scientific-expert-profiles.md)");
  const bridges = [
    "[Scientific Writing, Figures & Publishing](../research-writing.md)",
    "[Data Science, Stats & Scientific Computing](../data-science-compute.md)",
    "[Imaging, Microscopy & Biosignals](../imaging-signals.md)",
  ];
  expect(rendered.indexOf(bridges[0] as string)).toBeLessThan(rendered.indexOf(bridges[1] as string));
  expect(rendered.indexOf(bridges[1] as string)).toBeLessThan(rendered.indexOf(bridges[2] as string));
  expect(rendered.indexOf("## Primary experts")).toBeLessThan(
    rendered.indexOf("## Cross-disciplinary experts"),
  );
  const primary = [
    `[alpha-physicist](../../notes/${EXPERT_DOMAIN}/alpha-physicist.md) - Alpha summary.`,
    `[beta-physicist](../../notes/${EXPERT_DOMAIN}/beta-physicist.md) - Beta summary.`,
    `[zeta-physicist](../../notes/${EXPERT_DOMAIN}/zeta-physicist.md) - Zeta summary.`,
  ];
  expect(rendered.indexOf(primary[0] as string)).toBeLessThan(rendered.indexOf(primary[1] as string));
  expect(rendered.indexOf(primary[1] as string)).toBeLessThan(rendered.indexOf(primary[2] as string));
  expect(rendered).toContain(
    `[omega-biologist](../../notes/${EXPERT_DOMAIN}/omega-biologist.md) - Omega summary.`,
  );
  expect(rendered).not.toContain("Profile Dispatcher");
  expect(rendered).not.toContain("scientific-agents");
});

test("a nested map marks disciplines with no cross-disciplinary profiles", () => {
  const discipline: Discipline = {
    id: "mathematics-statistics",
    title: "Mathematics & Statistics",
    description: "Mathematical and statistical sciences.",
  };
  const taxonomy = new ExpertTaxonomy(
    [discipline],
    [["algebraist", assignment("mathematics-statistics", [], ["data-science-compute"])]],
  );

  const rendered = renderDisciplineMap({
    discipline,
    taxonomy,
    domainBySkill: DOMAIN_BY_SKILL,
    shortDescriptions: new Map([["algebraist", "Studies algebraic structures."]]),
    categoryTitles: new Map([["data-science-compute", "Data Science, Stats & Scientific Computing"]]),
    bridgeDomainOrder: ["data-science-compute"],
    created: "2025-01-02",
  });

  expect(rendered).toContain("## Cross-disciplinary experts\n\n_No cross-disciplinary experts._");
});

test("pruning removes only owned stale direct-child markdown", () => {
  const directory = tempRoot();
  const owned = "---\ngenerated: scientific-expert-taxonomy\n---\n";
  write(join(directory, "current.md"), "current");
  write(join(directory, "stale-owned.md"), owned);
  write(join(directory, "manual.md"), "manual");
  write(join(directory, "keep.txt"), "keep");
  write(join(directory, "nested/stale-owned.md"), owned);

  expect(pruneStaleExpertMaps(directory, ["current"])).toEqual(["stale-owned.md"]);
  expect(existsSync(join(directory, "current.md"))).toBe(true);
  expect(existsSync(join(directory, "stale-owned.md"))).toBe(false);
  expect(existsSync(join(directory, "manual.md"))).toBe(true);
  expect(existsSync(join(directory, "keep.txt"))).toBe(true);
  expect(existsSync(join(directory, "nested/stale-owned.md"))).toBe(true);
});

test("the taxonomy rejects non-slug discipline ids", () => {
  const path = write(
    join(tempRoot(), "taxonomy.json"),
    JSON.stringify({
      schema_version: 1,
      disciplines: [
        {
          id: "../software-dev",
          title: "Escaped",
          description: "Must not escape the map directory.",
        },
      ],
      profiles: {},
    }),
  );

  expect(() =>
    loadTaxonomy(path, {
      catalogProfiles: new Set(),
      discoveredProfiles: new Set(),
      validBridgeDomains: [],
    }),
  ).toThrow("invalid discipline id: ../software-dev");
});

test("a renderer failure happens before any expert write or prune", async () => {
  const root = vaultFixture({
    taxonomy: {
      schema_version: 1,
      disciplines: [
        {
          id: "biology-life-sciences",
          title: "Biology & Life Sciences",
          description: "Living systems across scales.",
        },
      ],
      profiles: {},
    },
  });
  const master = write(join(root, "vault/maps", `${EXPERT_DOMAIN}.md`), "manual master");
  const stale = write(
    join(root, "vault/maps", EXPERT_DOMAIN, "stale-owned.md"),
    "---\ngenerated: scientific-expert-taxonomy\n---\n",
  );

  const failed = await buildVault(
    root,
    { prune: false, graph: false },
    {
      out: () => {},
      err: () => {},
      today: "2025-01-02",
      tables: tablesWith([EXPERT_CATEGORY]),
      renderDisciplineMap: () => {
        throw new Error("render failed");
      },
    },
  ).then(
    () => null,
    (e: unknown) => e as Error,
  );

  expect(failed?.message).toBe("render failed");
  expect(readFileSync(master, "utf8")).toBe("manual master");
  expect(existsSync(stale)).toBe(true);
});

test("the build does not prune without validated discipline ids", async () => {
  const root = vaultFixture();
  const existing = write(join(root, "vault/maps", EXPERT_DOMAIN, "existing.md"), "keep");

  const code = await buildVault(
    root,
    { prune: false, graph: false },
    { out: () => {}, err: () => {}, today: "2025-01-02", tables: tablesWith([]) },
  );

  expect(code).toBe(0);
  expect(existsSync(existing)).toBe(true);
});

test("the build rejects an escaped discipline path without overwriting it", async () => {
  const root = vaultFixture();
  const outside = write(join(root, "vault/maps/software-dev.md"), "manual map");
  const escaped = new ExpertTaxonomy(
    [{ id: "../software-dev", title: "Escaped", description: "Must not escape the map directory." }],
    [],
  );
  const errors: string[] = [];

  const code = await buildVault(
    root,
    { prune: false, graph: false },
    {
      out: () => {},
      err: (line) => errors.push(line),
      today: "2025-01-02",
      tables: tablesWith([EXPERT_CATEGORY]),
      taxonomy: escaped,
    },
  );

  expect(code).not.toBe(0);
  expect(errors.join("\n")).toContain("discipline path escapes expert map directory");
  expect(readFileSync(outside, "utf8")).toBe("manual map");
});

test("the build preserves expert map dates and keeps non-expert map bytes", async () => {
  const root = vaultFixture({
    taxonomy: {
      schema_version: 1,
      disciplines: [
        {
          id: "biology-life-sciences",
          title: "Biology & Life Sciences",
          description: "Living systems across scales.",
        },
      ],
      profiles: {},
    },
  });
  const standard = write(join(root, "vault/maps/software-dev.md"), "---\ncreated: 2020-01-01\n---\n");
  const master = write(join(root, "vault/maps", `${EXPERT_DOMAIN}.md`), "---\ncreated: 2020-02-02\n---\n");
  const nested = write(
    join(root, "vault/maps", EXPERT_DOMAIN, "biology-life-sciences.md"),
    "---\ncreated: 2020-03-03\n---\n",
  );
  const categories: Category[] = [
    {
      key: "software-dev",
      title: "Software Development",
      scope: "Build and maintain software.",
      related: [],
      skills: [],
    },
    { ...EXPERT_CATEGORY, related: ["software-dev"] },
  ];

  const code = await buildVault(
    root,
    { prune: false, graph: false },
    { out: () => {}, err: () => {}, today: "2099-12-31", tables: tablesWith(categories) },
  );

  expect(code).toBe(0);
  expect(readFileSync(master, "utf8")).toContain("created: 2020-02-02");
  expect(readFileSync(master, "utf8")).toContain("## Profile Dispatcher");
  expect(readFileSync(nested, "utf8")).toContain("created: 2020-03-03");
  expect(readFileSync(nested, "utf8")).toContain("# Biology & Life Sciences");
  expect(readFileSync(nested, "utf8")).toContain("Living systems across scales.");
  expect(readFileSync(standard, "utf8")).toBe(
    "---\n" +
      "title: Software Development\n" +
      "tags:\n" +
      "  - skill-map\n" +
      "created: 2020-01-01\n" +
      "---\n\n" +
      "# Software Development\n\n" +
      "> [!abstract] Scope\n" +
      "> Build and maintain software.\n\n" +
      "[Back to Skill Index](../index.md)\n\n" +
      "## Skills (0)\n\n",
  );
});

// --- audits of the committed navigation tree -------------------------------

let repoTaxonomy: ExpertTaxonomy;
let bridgeDomainOrder: string[];
let categoryTitles: Map<string, string>;

beforeAll(() => {
  const tables = loadTables();
  bridgeDomainOrder = tables.categories.map((c) => c.key).filter((key) => key !== EXPERT_DOMAIN);
  categoryTitles = new Map(tables.categories.map((c) => [c.key, c.title]));
  repoTaxonomy = loadTaxonomy(join(REPO_ROOT, ".skill-vault/data/scientific-expert-taxonomy.json"), {
    catalogProfiles: loadCatalogProfiles(join(REPO_ROOT, "skills/scientific-agents/references/catalog.json")),
    discoveredProfiles: new Set(
      discoverSkills(REPO_ROOT, { bundles: false, excludeTransient: false })
        .filter((entry) => entry.id !== "scientific-agents" && isScientificAgentsProfile(entry.file))
        .map((entry) => entry.id),
    ),
    validBridgeDomains: bridgeDomainOrder,
  });
});

function wrapperPath(slug: string): string {
  return join(REPO_ROOT, "vault/notes", EXPERT_DOMAIN, `${slug}.md`);
}

function masterMapPath(): string {
  return join(REPO_ROOT, "vault/maps", `${EXPERT_DOMAIN}.md`);
}

function disciplineMapPath(id: string): string {
  return join(REPO_ROOT, "vault/maps", EXPERT_DOMAIN, `${id}.md`);
}

test("all 503 wrappers match the manifest metadata and navigation", () => {
  expect(repoTaxonomy.profiles.size).toBe(503);
  for (const [slug, profile] of repoTaxonomy.profiles) {
    const text = readFileSync(wrapperPath(slug), "utf8");
    validateExpertWrapperFrontmatter(text, slug, profile, EXPERT_DOMAIN);
    expect(profile.bridgeDomains.length).toBeGreaterThan(0);
    const primary = repoTaxonomy.disciplineById(profile.primary) as Discipline;
    const primaryLink = `[${primary.title}](../../maps/${EXPERT_DOMAIN}/${primary.id}.md)`;
    expect(text.split(primaryLink).length - 1).toBe(1);
    for (const id of profile.secondary) {
      const secondary = repoTaxonomy.disciplineById(id) as Discipline;
      const link = `[${secondary.title}](../../maps/${EXPERT_DOMAIN}/${secondary.id}.md)`;
      expect(text.split(link).length - 1).toBe(1);
    }
    for (const domain of profile.bridgeDomains) {
      expect(text).toContain(`(../../maps/${domain}.md)`);
    }
  }
});

test("discipline maps place profiles in their declared sections", () => {
  for (const discipline of repoTaxonomy.disciplines) {
    validateDisciplineProfileSections(readFileSync(disciplineMapPath(discipline.id), "utf8"), {
      primary: repoTaxonomy.primaryProfiles(discipline.id),
      cross: repoTaxonomy.secondaryProfiles(discipline.id),
      expertDomain: EXPERT_DOMAIN,
    });
  }
});

test("the dispatcher appears only in the master map", () => {
  const master = readFileSync(masterMapPath(), "utf8");
  const link = `[scientific-agents](../notes/${EXPERT_DOMAIN}/scientific-agents.md)`;
  expect(master.split(link).length - 1).toBe(1);
  for (const discipline of repoTaxonomy.disciplines) {
    expect(readFileSync(disciplineMapPath(discipline.id), "utf8")).not.toContain("scientific-agents");
  }
});

test("generated map links match the taxonomy and resolve on disk", () => {
  const expectedMaster: Link[] = [
    ["Back to Skill Index", "../index.md"],
    ["scientific-agents", `../notes/${EXPERT_DOMAIN}/scientific-agents.md`],
    ...repoTaxonomy.disciplines.map((d): Link => [d.title, `${EXPERT_DOMAIN}/${d.id}.md`]),
  ];
  const contracts: [string, Link[]][] = [[masterMapPath(), expectedMaster]];

  for (const discipline of repoTaxonomy.disciplines) {
    const expected: Link[] = [
      ["Back to Scientific Expert Profiles", `../${EXPERT_DOMAIN}.md`],
      ...repoTaxonomy
        .bridgeDomainsForDiscipline(discipline.id, bridgeDomainOrder)
        .map((domain): Link => [categoryTitles.get(domain) as string, `../${domain}.md`]),
      ...repoTaxonomy
        .primaryProfiles(discipline.id)
        .map((slug): Link => [slug, `../../notes/${EXPERT_DOMAIN}/${slug}.md`]),
      ...repoTaxonomy
        .secondaryProfiles(discipline.id)
        .map((slug): Link => [slug, `../../notes/${EXPERT_DOMAIN}/${slug}.md`]),
    ];
    contracts.push([disciplineMapPath(discipline.id), expected]);
  }

  for (const [path, expected] of contracts) {
    const links = validateGeneratedMapLinks(readFileSync(path, "utf8"), expected);
    for (const [, target] of links) {
      expect(existsSync(join(path, "..", target.split("#")[0] ?? ""))).toBe(true);
    }
  }
});

test("representative wrappers omit incidental related-skill links", () => {
  for (const slug of ["inorganic-chemist", "environmental-engineer", "health-informatician"]) {
    const text = readFileSync(wrapperPath(slug), "utf8");
    expect(text).toContain("## Relevant capability domains");
    expect(text).not.toContain("## Related skills");
    for (const target of ["electron.md", "qa.md", "review.md"]) {
      expect(text).not.toContain(`](${target})`);
    }
  }
});

test("an unused import guard keeps TaxonomyValidationError reachable", () => {
  expect(new TaxonomyValidationError(["x"]).errors).toEqual(["x"]);
});
