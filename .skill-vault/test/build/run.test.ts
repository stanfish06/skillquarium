import { afterAll, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { updateGraph } from "../../src/build/obsidianGraph";
import { buildVault } from "../../src/build/run";
import { type Category, EXPERT_DOMAIN, loadTables, type Tables } from "../../src/build/tables";
import { type Discipline, ExpertTaxonomy, TaxonomyValidationError } from "../../src/build/taxonomy";
import { cleanupTempRoots, tempRoot, write } from "./helpers";

afterAll(cleanupTempRoots);

const SOFTWARE_DEV: Category = {
  key: "software-dev",
  title: "Software Development & Engineering",
  scope: "Writing, testing and shipping code.",
  related: [],
  skills: ["alpha"],
};

const EXPERT_CATEGORY: Category = {
  key: EXPERT_DOMAIN,
  title: "Scientific Expert Profiles",
  scope: "Discipline-specific profiles.",
  related: [],
  skills: [],
};

function tablesWith(categories: Category[]): Tables {
  return { ...loadTables(), categories };
}

/** A root holding exactly what buildVault reads: one skill, the catalog, the taxonomy. */
function vaultFixture(options: { taxonomy?: unknown } = {}): string {
  const root = tempRoot("skillquarium-run-");
  write(
    join(root, "skills/alpha/SKILL.md"),
    "---\nname: alpha\ndescription: Alpha description.\n---\n\n# alpha\n",
  );
  write(join(root, "skills/scientific-agents/references/catalog.json"), JSON.stringify({ agents: [] }));
  write(
    join(root, ".skill-vault/data/scientific-expert-taxonomy.json"),
    JSON.stringify(options.taxonomy ?? { schema_version: 1, disciplines: [], profiles: {} }),
  );
  return root;
}

function filesUnder(directory: string, base = directory): string[] {
  const found: string[] = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) found.push(...filesUnder(path, base));
    else found.push(relative(base, path));
  }
  return found.sort();
}

function graphFixture(data: unknown): { root: string; path: string } {
  const root = tempRoot("skillquarium-graph-");
  const path = write(join(root, ".obsidian/graph.json"), JSON.stringify(data));
  return { root, path };
}

function expertGraphTaxonomy(): ExpertTaxonomy {
  const ids = [
    "biology-life-sciences",
    "medicine-health",
    "chemistry-materials",
    "physics-astronomy",
    "earth-environmental-sciences",
    "agriculture-food-animal-sciences",
    "mathematics-statistics",
    "computing-data-science",
    "engineering-technology",
    "social-behavioral-sciences",
  ];
  const disciplines: Discipline[] = ids.map((id) => ({ id, title: id, description: "Test" }));
  return new ExpertTaxonomy(disciplines, []);
}

test("an invalid taxonomy is reported before any file is written", async () => {
  const root = vaultFixture({ taxonomy: { schema_version: 2, disciplines: [], profiles: {} } });
  const before = filesUnder(root);
  const errors: string[] = [];

  const code = await buildVault(
    root,
    { prune: false, graph: true },
    { out: () => {}, err: (line) => errors.push(line), today: "2025-01-02", tables: tablesWith([]) },
  );

  expect(code).toBe(1);
  expect(errors.join("\n")).toContain("Invalid scientific expert taxonomy");
  expect(errors.join("\n")).toContain("unsupported schema_version: 2");
  expect(filesUnder(root)).toEqual(before);
  expect(existsSync(join(root, "vault"))).toBe(false);
  expect(existsSync(join(root, ".obsidian/graph.json"))).toBe(false);
});

test("a discovery error is reported before any file is written", async () => {
  const root = tempRoot("skillquarium-broken-");
  // A root that otherwise looks real, with skills/ unusable: discovery fails, --graph included.
  write(join(root, "skills"), "not a directory");
  write(
    join(root, ".skill-vault/data/scientific-expert-taxonomy.json"),
    JSON.stringify({ schema_version: 1, disciplines: [], profiles: {} }),
  );
  const before = filesUnder(root);
  const errors: string[] = [];

  const code = await buildVault(
    root,
    { prune: false, graph: true },
    { out: () => {}, err: (line) => errors.push(line), today: "2025-01-02", tables: tablesWith([]) },
  );

  expect(code).toBe(1);
  expect(errors.join("\n")).toContain("cannot discover skills");
  expect(errors.join("\n")).toContain(join(root, "skills"));
  expect(filesUnder(root)).toEqual(before);
  expect(existsSync(join(root, "vault"))).toBe(false);
  expect(existsSync(join(root, ".obsidian/graph.json"))).toBe(false);
});

test("a successful build returns zero and rewrites the graph when asked", async () => {
  const root = vaultFixture();
  const graph = write(join(root, ".obsidian/graph.json"), JSON.stringify({ close: true, keep: "me" }));
  const lines: string[] = [];

  const code = await buildVault(
    root,
    { prune: false, graph: true },
    {
      out: (line) => lines.push(line),
      err: (line) => lines.push(line),
      today: "2025-01-02",
      tables: tablesWith([SOFTWARE_DEV, EXPERT_CATEGORY]),
      // --graph needs a discipline per palette entry, so the graph groups cover the whole palette.
      taxonomy: expertGraphTaxonomy(),
    },
  );

  expect(code).toBe(0);
  expect(lines.join("\n")).toContain("OK: 1 wrappers (1 indexed skills), 2 maps");
  const written: { keep: string; colorGroups: unknown[] } = JSON.parse(readFileSync(graph, "utf8"));
  expect(written.keep).toBe("me");
  expect(written.colorGroups.length).toBeGreaterThan(0);
  expect(lines.join("\n")).toContain("graph.json: wrote");
});

test("the root argument defines every vault path", async () => {
  const root = vaultFixture();

  const code = await buildVault(
    root,
    { prune: false, graph: false },
    {
      out: () => {},
      err: () => {},
      today: "2025-01-02",
      tables: tablesWith([SOFTWARE_DEV, EXPERT_CATEGORY]),
    },
  );

  expect(code).toBe(0);
  expect(filesUnder(root)).toEqual([
    ".skill-vault/data/scientific-expert-taxonomy.json",
    "skills/alpha/SKILL.md",
    "skills/scientific-agents/references/catalog.json",
    "vault/index.md",
    `vault/maps/${EXPERT_DOMAIN}.md`,
    "vault/maps/software-dev.md",
    "vault/notes/software-dev/alpha.md",
  ]);
  expect(statSync(join(root, "vault/maps", EXPERT_DOMAIN)).isDirectory()).toBe(true);
  expect(readFileSync(join(root, "vault/notes/software-dev/alpha.md"), "utf8")).toContain(
    "source: skills/alpha/SKILL.md",
  );
});

test("a nonexistent root exits nonzero without writing anything", async () => {
  const parent = tempRoot("skillquarium-missing-");
  const missing = join(parent, "missing-vault");
  const sentinel = write(join(parent, "sentinel.txt"), "untouched");
  const errors: string[] = [];

  const code = await buildVault(
    missing,
    { prune: true, graph: true },
    { out: () => {}, err: (line) => errors.push(line), today: "2025-01-02" },
  );

  expect(code).not.toBe(0);
  expect(errors.join("\n")).toContain("cannot discover skills");
  expect(errors.join("\n")).toContain(missing);
  expect(readFileSync(sentinel, "utf8")).toBe("untouched");
  expect(readdirSync(parent)).toEqual(["sentinel.txt"]);
});

test("the graph gets expert groups first and keeps every other setting", () => {
  const taxonomy = expertGraphTaxonomy();
  const expectedExpertColors = [
    0x2ca02c, 0xd62728, 0xff7f0e, 0x1f77b4, 0x17becf, 0xbcbd22, 0x9467bd, 0x7f7f7f, 0x8c564b, 0xe377c2,
  ];
  const { root, path } = graphFixture({
    close: true,
    unrelated: { nested: "preserved" },
    colorGroups: [{ query: "old", color: { rgb: 1 } }],
  });
  const tables = loadTables();

  updateGraph(root, taxonomy, { out: () => {}, err: () => {} }, tables);

  const graph: {
    colorGroups: { query: string; color: { a: number; rgb: number } }[];
    unrelated: unknown;
    close: boolean;
  } = JSON.parse(readFileSync(path, "utf8"));
  const expertQueries = taxonomy.disciplines.map((d) => `[expert_primary:${d.id}]`);
  const genericQueries = tables.categories
    .filter((category) => tables.palette.has(category.key))
    .map((category) => `tag:#domain/${category.key}`);
  const queries = graph.colorGroups.map((group) => group.query);

  expect(queries).toEqual([...expertQueries, ...genericQueries]);
  expect(graph.colorGroups.slice(0, 10).map((group) => group.color)).toEqual(
    expectedExpertColors.map((rgb) => ({ a: 1, rgb })),
  );
  expect(queries.indexOf("[expert_primary:biology-life-sciences]")).toBeLessThan(
    queries.indexOf(`tag:#domain/${EXPERT_DOMAIN}`),
  );
  expect(graph.unrelated).toEqual({ nested: "preserved" });
  expect(graph.close).toBe(true);
});

test("the graph rejects expert palette domain mismatches without touching the file", () => {
  const taxonomy = expertGraphTaxonomy();
  const palette = loadTables().expertPalette;
  const cases: [string, Map<string, number>, string][] = [
    [
      "missing",
      new Map([...palette].filter(([key]) => key !== "biology-life-sciences")),
      "missing=biology-life-sciences; unexpected=none",
    ],
    [
      "unexpected",
      new Map([...palette, ["unexpected-domain", 0]]),
      "missing=none; unexpected=unexpected-domain",
    ],
  ];

  for (const [, expertPalette, expectedError] of cases) {
    const { root, path } = graphFixture({ unrelated: "preserved" });
    const before = readFileSync(path);

    const failed = (() => {
      try {
        updateGraph(root, taxonomy, { out: () => {}, err: () => {} }, { ...loadTables(), expertPalette });
        return null;
      } catch (e) {
        return e;
      }
    })();

    expect(failed).toBeInstanceOf(TaxonomyValidationError);
    expect((failed as Error).message).toContain(expectedError);
    expect(readFileSync(path)).toEqual(before);
  }
});
