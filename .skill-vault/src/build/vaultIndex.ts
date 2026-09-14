import { byCodeUnit, type Category, EXPERT_DOMAIN, noteLink } from "./tables";

export interface RenderIndexOptions {
  categories: readonly Category[];
  created: string;
  /** Indexed skill count: on-disk skills minus the transient optional extras. */
  total: number;
  /** Per domain key, the skills currently on disk, sorted. */
  skillsByKey: ReadonlyMap<string, readonly string[]>;
  /** Flat A-Z entries: no expert profiles, no bundled sub-skills, no optional extras. */
  azSkills: readonly string[];
  /** Uncategorized skills worth showing, in build order. */
  unsortedDisplay: readonly string[];
  shortDescriptions: ReadonlyMap<string, string>;
  domainBySkill: ReadonlyMap<string, string>;
}

/** build.py main(): vault/index.md. */
export function renderIndex(options: RenderIndexOptions): string {
  const {
    categories,
    created,
    total,
    skillsByKey,
    azSkills,
    unsortedDisplay,
    shortDescriptions,
    domainBySkill,
  } = options;
  const lines = [
    "---",
    "title: Skills Index",
    "tags:",
    "  - moc",
    "  - skill-index",
    `created: ${created}`,
    "---",
    "",
    "# Skills Index",
    "",
    `A navigable map of the **${total} agent skills** in this vault, grouped into ` +
      `${categories.length} domains. Each entry links to a per-skill note that wraps the ` +
      "original `SKILL.md` and holds your personal notes, status, and aliases.",
    "",
    "> [!tip] How to navigate",
    "> - **Find by name/synonym:** quick-switcher or grep (skills carry aliases like `DESeq2`, `single cell`).",
    "> - **Browse a domain:** open a map below for grouped, cross-linked skills.",
    "> - **Filter by attribute:** open [skills.base](skills.base) to sort/filter by domain, status, rating.",
    "> - **Navigate by goal:** see [Workflows & recipes](recipes/index.md).",
    "> - **See connections:** Obsidian Graph view is color-grouped by domain.",
    "",
    "## Quick access",
    "",
    "- [Filterable table — skills.base](skills.base)  ·  sort & filter all skills by domain / status / rating",
    "- [Workflows & recipes](recipes/index.md)  ·  goal-oriented chains of skills",
    "",
    "## Browse by domain",
    "",
  ];
  for (const category of categories) {
    const live = skillsByKey.get(category.key) ?? [];
    lines.push(`### [${category.title}](maps/${category.key}.md)  ·  ${live.length} skills`, "");
    lines.push(category.scope, "");
    const preview = live.slice(0, 6);
    const chips = preview.map((skill) => `[${skill}](${noteLink(skill, domainBySkill)})`).join(", ");
    const more = live.length > preview.length ? ` … [see all ${live.length} →](maps/${category.key}.md)` : "";
    lines.push(chips + more, "");
  }
  const personaCount = (skillsByKey.get(EXPERT_DOMAIN) ?? []).length;
  lines.push(
    "## All skills (A–Z)",
    "",
    `_${azSkills.length} tool skills. The ${personaCount} expert-persona entries ` +
      "(discipline profiles + the scientific-agents dispatcher) are omitted here to " +
      "keep this list scannable — browse them via " +
      `[Scientific Expert Profiles](maps/${EXPERT_DOMAIN}.md)._`,
    "",
  );

  let current: string | null = null;
  let bucket: string[] = [];
  const flush = (): void => {
    if (bucket.length) lines.push(bucket.join(" · "), "");
  };
  for (const skill of [...azSkills].sort((a, b) => byCodeUnit(a.toLowerCase(), b.toLowerCase()))) {
    const letter = (skill[0] ?? "").toUpperCase();
    if (letter !== current) {
      flush();
      bucket = [];
      current = letter;
      lines.push(`**${letter}**`);
    }
    bucket.push(`[${skill}](${noteLink(skill, domainBySkill)})`);
  }
  flush();

  if (unsortedDisplay.length) {
    lines.push("## Uncategorized", "");
    for (const skill of unsortedDisplay) {
      lines.push(`- [${skill}](${noteLink(skill, domainBySkill)}) — ${shortDescriptions.get(skill)}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
