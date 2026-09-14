import { statSync } from "node:fs";
import { pyStrip, readHead, universalNewlines } from "../catalog";
import { type Category, noteLink, PY_WS } from "./tables";

const CREATED = new RegExp(`^created:[${PY_WS}]*([^\\n]+)$`, "m");

/** build.py existing_created: keep a generated note's creation date across rebuilds. */
export function existingCreated(path: string, today: string): string {
  try {
    if (!statSync(path).isFile()) return today;
  } catch {
    return today;
  }
  const head = readHead(path, 8192);
  if (head === null) return today;
  // Python reads 1024 decoded characters, not bytes.
  const text = Array.from(universalNewlines(head)).slice(0, 1024).join("");
  const match = CREATED.exec(text);
  return match ? pyStrip(match[1] ?? "") : today;
}

export interface RenderMapOptions {
  category: Category;
  created: string;
  /** Skills currently on disk in this domain, sorted. */
  live: readonly string[];
  shortDescriptions: ReadonlyMap<string, string>;
  titleByKey: ReadonlyMap<string, string>;
  domainBySkill: ReadonlyMap<string, string>;
}

/** build.py main(): one domain map note. */
export function renderCategoryMap(options: RenderMapOptions): string {
  const { category, created, live, shortDescriptions, titleByKey, domainBySkill } = options;
  const lines = [
    "---",
    `title: ${category.title}`,
    "tags:",
    "  - skill-map",
    `created: ${created}`,
    "---",
    "",
    `# ${category.title}`,
    "",
    "> [!abstract] Scope",
    `> ${category.scope}`,
    "",
    "[Back to Skill Index](../index.md)",
    "",
  ];
  const related = category.related
    .filter((key) => titleByKey.has(key))
    .map((key) => `[${titleByKey.get(key)}](${key}.md)`);
  if (related.length) lines.push(`**Related maps:** ${related.join(" | ")}`, "");
  lines.push(`## Skills (${live.length})`, "");
  for (const skill of live) {
    lines.push(`- [${skill}](${noteLink(skill, domainBySkill, "../")}) — ${shortDescriptions.get(skill)}`);
  }
  lines.push("");
  return lines.join("\n");
}
