import { afterAll, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { buildRelatedExcluding } from "../../src/build/related";
import { EXPERT_DOMAIN, loadTables } from "../../src/build/tables";
import type { ProfileAssignment } from "../../src/build/taxonomy";
import {
  findExistingNote,
  notePath,
  parseExisting,
  type RenderWrapperOptions,
  renderWrapper,
} from "../../src/build/wrapper";
import { cleanupTempRoots, tempRoot, write } from "./helpers";

afterAll(cleanupTempRoots);

const PERSONAL_MARKER = loadTables().personalMarker;

const NON_EXPERT: RenderWrapperOptions = {
  key: "software-dev",
  domainTitle: "Software Development & Engineering",
  description: "Alpha description.",
  shortDescriptions: new Map(),
  related: new Set(),
  existing: null,
  today: "2025-01-02",
  forceAliases: false,
  categoryTitles: new Map(),
  bridgeDomainOrder: [],
};

test("rendering reads today and force-aliases from its arguments, never from module state", () => {
  const rendered = renderWrapper("alpha", {
    ...NON_EXPERT,
    description: "Alpha description (CustomTool).",
    existing: { status: "untried", aliases: ["Hand Curated"], personal: null },
  });

  expect(rendered).toContain("created: 2025-01-02");
  expect(rendered).toContain("aliases:\n  - Hand Curated");
  expect(rendered).not.toContain("2099-12-31");
  // The parenthetical becomes an alias only under --force-aliases; the hand-curated list wins here.
  expect(rendered.split("tags:", 1)[0]).not.toContain("CustomTool");
});

test("a new wrapper is byte-identical after parsing and re-rendering it", () => {
  const root = tempRoot();
  const first = renderWrapper("alpha", NON_EXPERT);
  write(notePath(root, "alpha", "uncategorized"), first);

  const path = findExistingNote(root, "alpha", "uncategorized");
  expect(path).not.toBeNull();
  const existing = parseExisting(path as string);
  const second = renderWrapper("alpha", { ...NON_EXPERT, existing });

  expect(second).toBe(first);
  expect(readFileSync(path as string, "utf8")).toBe(second);
});

test("an expert wrapper renders its metadata, navigation and preserved fields", () => {
  const assignment: ProfileAssignment = {
    primary: "biology-life-sciences",
    secondary: ["physics-astronomy"],
    bridgeDomains: ["imaging-signals", "data-science-compute"],
  };
  const personal = `${PERSONAL_MARKER}\n\n## Notes\n\nKeep this note exactly.\n`;

  const rendered = renderWrapper("biophysicist", {
    key: EXPERT_DOMAIN,
    domainTitle: "Scientific Expert Profiles",
    description: "Studies biological systems with physical methods.",
    shortDescriptions: new Map([["electron", "Electron tooling."]]),
    related: new Set(["electron"]),
    existing: {
      created: "2025-01-02",
      status: "favorite",
      rating: "5",
      aliases: ["Bio Physicist", "Custom: Alias"],
      personal,
    },
    today: "2025-01-02",
    forceAliases: false,
    expertAssignment: assignment,
    disciplineTitles: new Map([
      ["biology-life-sciences", "Biology & Life Sciences"],
      ["physics-astronomy", "Physics & Astronomy"],
    ]),
    categoryTitles: new Map([
      ["imaging-signals", "Imaging, Microscopy & Biosignals"],
      ["data-science-compute", "Data Science, Stats & Scientific Computing"],
    ]),
    bridgeDomainOrder: ["imaging-signals", "data-science-compute"],
  });

  for (const fragment of [
    "domain: scientific-expert-profiles",
    "expert_primary: biology-life-sciences",
    "expert_secondary:\n  - physics-astronomy",
    "bridge_domains:\n  - imaging-signals\n  - data-science-compute",
    "[Biology & Life Sciences](../../maps/scientific-expert-profiles/biology-life-sciences.md)",
    "[Physics & Astronomy](../../maps/scientific-expert-profiles/physics-astronomy.md)",
    "## Relevant capability domains",
    "[Imaging, Microscopy & Biosignals](../../maps/imaging-signals.md)",
    "[Data Science, Stats & Scientific Computing](../../maps/data-science-compute.md)",
    "status: favorite",
    "rating: 5",
    'aliases:\n  - Bio Physicist\n  - "Custom: Alias"',
    personal.trimEnd(),
  ]) {
    expect(rendered).toContain(fragment);
  }
  // An expert profile lists capability domains instead of name-matched skills.
  expect(rendered).not.toContain("## Related skills");
  expect(rendered).not.toContain("[electron](electron.md)");
});

test("a non-expert wrapper keeps its related section byte for byte", () => {
  const rendered = renderWrapper("alpha", {
    ...NON_EXPERT,
    shortDescriptions: new Map([["beta", "Beta summary"]]),
    related: new Set(["beta"]),
    existing: {
      created: "2025-01-02",
      status: "untried",
      aliases: [],
      personal: null,
    },
  });

  expect(rendered).toBe(
    "---\n" +
      "title: alpha\n" +
      "tags:\n" +
      "  - skill\n" +
      "  - domain/software-dev\n" +
      "domain: software-dev\n" +
      "status: untried\n" +
      "source: skills/alpha/SKILL.md\n" +
      "created: 2025-01-02\n" +
      "---\n\n" +
      "# alpha\n\n" +
      "> [!info] What it does\n" +
      "> Alpha description.\n\n" +
      "**Source:** [skills/alpha/SKILL.md](../../../skills/alpha/SKILL.md)  ·  " +
      "**Domain:** [Software Development & Engineering](../../maps/software-dev.md)  ·  " +
      "**Table:** [skills.base](../../skills.base)  ·  " +
      "**Index:** [Skills Index](../../index.md)\n\n" +
      "## Related skills\n\n" +
      "- [beta](../../notes/uncategorized/beta.md) — Beta summary\n\n" +
      `${PERSONAL_MARKER}\n\n` +
      "## Notes\n",
  );
});

test("expert skills are excluded from name matching", () => {
  const related = buildRelatedExcluding(
    ["alpha", "beta", "electron", "biophysicist", "scientific-agents"],
    new Map([
      ["alpha", "Uses beta."],
      ["beta", "General tool."],
      ["electron", "General tool."],
      ["biophysicist", "Uses electron and beta."],
      ["scientific-agents", "Dispatches to biophysicist."],
    ]),
    new Set(["biophysicist", "scientific-agents"]),
  );

  expect(related.get("alpha")).toEqual(new Set(["beta"]));
  expect(related.get("beta")).toEqual(new Set(["alpha"]));
  expect(related.get("electron")).toEqual(new Set());
  expect(related.get("biophysicist")).toEqual(new Set());
  expect(related.get("scientific-agents")).toEqual(new Set());
});
