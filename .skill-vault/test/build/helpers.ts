import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import type { ProfileAssignment } from "../../src/build/taxonomy";

export const REPO_ROOT = resolve(import.meta.dir, "../../..");

const created: string[] = [];

export function tempRoot(prefix = "skillquarium-build-"): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  created.push(dir);
  return dir;
}

export function cleanupTempRoots(): void {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
}

export function write(path: string, text: string): string {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
  return path;
}

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function copyInto(source: string, destination: string): void {
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
}

/**
 * Copy everything build.py reads: every skills/<id>/SKILL.md, the upstream catalog,
 * the taxonomy manifest, and the generated navigation layer it must reproduce.
 */
export function copyVaultFixture(source: string, destination: string): string[] {
  const skills: string[] = [];
  for (const name of readdirSync(join(source, "skills"))) {
    const file = join(source, "skills", name, "SKILL.md");
    if (!isFile(file)) continue;
    skills.push(name);
    copyInto(file, join(destination, "skills", name, "SKILL.md"));
  }
  const catalog = join("skills", "scientific-agents", "references", "catalog.json");
  copyInto(join(source, catalog), join(destination, catalog));
  copyInto(
    join(source, ".skill-vault/data/scientific-expert-taxonomy.json"),
    join(destination, ".skill-vault/data/scientific-expert-taxonomy.json"),
  );
  copyInto(join(source, "vault/index.md"), join(destination, "vault/index.md"));
  for (const path of markdownUnder(join(source, "vault/notes"))) {
    copyInto(path, join(destination, relative(source, path)));
  }
  for (const path of markdownUnder(join(source, "vault/maps"))) {
    copyInto(path, join(destination, relative(source, path)));
  }
  return skills.sort();
}

function markdownUnder(directory: string): string[] {
  const found: string[] = [];
  if (!isDir(directory)) return found;
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (isDir(path)) found.push(...markdownUnder(path));
    else if (name.endsWith(".md")) found.push(path);
  }
  return found;
}

/** SHA-256 of every generated navigation file, keyed by path relative to `root`. */
export function snapshotGeneratedTree(root: string): Map<string, string> {
  const paths = [
    join(root, "vault/index.md"),
    ...markdownUnder(join(root, "vault/notes")),
    ...markdownUnder(join(root, "vault/maps")),
  ];
  const snapshot = new Map<string, string>();
  for (const path of paths.sort()) {
    snapshot.set(relative(root, path), createHash("sha256").update(readFileSync(path)).digest("hex"));
  }
  return snapshot;
}

export function diffSnapshots(before: Map<string, string>, after: Map<string, string>): string[] {
  const keys = new Set([...before.keys(), ...after.keys()]);
  return [...keys].filter((key) => before.get(key) !== after.get(key)).sort();
}

// --- ported test_expert_navigation.py validators ---------------------------

const LIST_KEYS = new Set(["aliases", "tags", "expert_secondary", "bridge_domains"]);

export function rejectHiddenNavigationMarkup(text: string): void {
  if (/^[ \t]*(?:```|~~~)/m.test(text)) throw new Error("generated navigation contains fenced code");
  if (text.includes("<!--") || text.includes("-->")) {
    throw new Error("generated navigation contains HTML comment markup");
  }
}

export type FrontmatterField = [string, string | string[]];

export function parseFirstFrontmatter(text: string): FrontmatterField[] {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (match === null) throw new Error("wrapper is missing exact first frontmatter delimiters");

  const fields: FrontmatterField[] = [];
  let currentKey: string | null = null;
  let currentValues: string[] | null = null;
  for (const line of (match[1] ?? "").split("\n")) {
    if (line.startsWith(" ") || line.startsWith("\t")) {
      if (currentKey === null || !LIST_KEYS.has(currentKey) || currentValues === null) {
        throw new Error(`invalid frontmatter list indentation: ${line}`);
      }
      if (!/^ {2}- .+$/.test(line)) throw new Error(`invalid frontmatter list indentation: ${line}`);
      currentValues.push(line.slice(4));
      continue;
    }
    if (currentKey !== null && LIST_KEYS.has(currentKey) && !currentValues?.length) {
      throw new Error(`frontmatter list ${currentKey} is empty`);
    }
    const keyMatch = /^([a-z][a-z0-9_-]*):([^\n]*)$/.exec(line);
    if (keyMatch === null) throw new Error(`invalid top-level frontmatter line: ${line}`);
    const key = keyMatch[1] ?? "";
    const remainder = keyMatch[2] ?? "";
    let value: string | string[];
    if (LIST_KEYS.has(key)) {
      if (remainder) throw new Error(`frontmatter list ${key} must be block style`);
      value = [];
    } else {
      if (!remainder.startsWith(" ") || remainder.trim() === "") {
        throw new Error(`frontmatter scalar ${key} is empty`);
      }
      value = remainder.slice(1);
    }
    fields.push([key, value]);
    currentKey = key;
    currentValues = Array.isArray(value) ? value : null;
  }
  if (currentKey !== null && LIST_KEYS.has(currentKey) && !currentValues?.length) {
    throw new Error(`frontmatter list ${currentKey} is empty`);
  }
  return fields;
}

export function validateExpertTaxonomyMetadata(text: string, assignment: ProfileAssignment): void {
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(text);
  if (match === null) throw new Error("wrapper is missing first frontmatter block");
  const lines = (match[1] ?? "").split("\n");
  const positions = (key: string): number[] =>
    lines.flatMap((line, index) => (line.startsWith(`${key}:`) ? [index] : []));
  const expectedCounts: [string, number][] = [
    ["expert_primary", 1],
    ["expert_secondary", assignment.secondary.length ? 1 : 0],
    ["bridge_domains", 1],
  ];
  for (const [key, expectedCount] of expectedCounts) {
    const actual = positions(key).length;
    if (actual !== expectedCount) {
      const expectation = expectedCount === 1 ? `exactly one ${key}` : `no ${key}`;
      throw new Error(`expected ${expectation}, found ${actual}`);
    }
  }

  const expected = [`expert_primary: ${assignment.primary}`];
  if (assignment.secondary.length) {
    expected.push("expert_secondary:", ...assignment.secondary.map((value) => `  - ${value}`));
  }
  expected.push("bridge_domains:", ...assignment.bridgeDomains.map((value) => `  - ${value}`));

  const start = positions("expert_primary")[0] ?? 0;
  let end = (positions("bridge_domains")[0] ?? 0) + 1;
  while (end < lines.length && (lines[end] ?? "").startsWith("  - ")) end += 1;
  const actual = lines.slice(start, end);
  if (actual.join("\n") !== expected.join("\n")) {
    throw new Error(
      `expert taxonomy metadata mismatch: expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`,
    );
  }
}

const SIMPLE_SCALAR = /^[A-Za-z0-9]+(?:[._/-][A-Za-z0-9]+)*$/;

export function validateExpertWrapperFrontmatter(
  text: string,
  slug: string,
  assignment: ProfileAssignment,
  expertDomain: string,
): void {
  const fields = parseFirstFrontmatter(text);
  const keys = fields.map(([key]) => key);
  const expectedKeys = ["title"];
  if (keys.includes("aliases")) expectedKeys.push("aliases");
  expectedKeys.push("tags", "domain", "expert_primary");
  if (assignment.secondary.length) expectedKeys.push("expert_secondary");
  expectedKeys.push("bridge_domains", "status");
  if (keys.includes("rating")) expectedKeys.push("rating");
  expectedKeys.push("source", "created");
  if (keys.join(",") !== expectedKeys.join(",")) {
    throw new Error(
      `expert wrapper frontmatter keys mismatch: expected ${JSON.stringify(expectedKeys)}, found ${JSON.stringify(keys)}`,
    );
  }

  const values = new Map(fields);
  const scalarKeys = ["title", "domain", "expert_primary", "status", "source", "created"];
  if (values.has("rating")) scalarKeys.push("rating");
  for (const key of scalarKeys) {
    const value = values.get(key);
    if (typeof value !== "string" || !SIMPLE_SCALAR.test(value)) {
      throw new Error(`expert wrapper ${key} scalar has invalid syntax: ${String(value)}`);
    }
  }
  if (values.get("title") !== slug) {
    throw new Error(`expert wrapper title mismatch: expected ${slug}, found ${String(values.get("title"))}`);
  }
  const tags = values.get("tags");
  if (!Array.isArray(tags) || tags.join(",") !== `skill,domain/${expertDomain}`) {
    throw new Error(`expert wrapper tags mismatch: ${JSON.stringify(tags)}`);
  }
  if (values.get("domain") !== expertDomain) {
    throw new Error(`expert wrapper domain mismatch: ${String(values.get("domain"))}`);
  }
  if (values.get("source") !== `skills/${slug}/SKILL.md`) {
    throw new Error(`expert wrapper source mismatch: ${String(values.get("source"))}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(values.get("created")))) {
    throw new Error(`expert wrapper created date is invalid: ${String(values.get("created"))}`);
  }
  validateExpertTaxonomyMetadata(text, assignment);
}

export type Link = [string, string];

export function validateGeneratedMapLinks(text: string, expectedLinks: readonly Link[]): Link[] {
  rejectHiddenNavigationMarkup(text);
  const actual: Link[] = [...text.matchAll(/(?<!!)\[([^\]\n]+)\]\(([^)\n]+)\)/g)].map((m) => [
    m[1] ?? "",
    m[2] ?? "",
  ]);
  if (JSON.stringify(actual) !== JSON.stringify(expectedLinks)) {
    throw new Error(
      `ordered links mismatch: expected ${JSON.stringify(expectedLinks)}, found ${JSON.stringify(actual)}`,
    );
  }
  return actual;
}

function profileBulletSlugs(section: string, expertDomain: string): string[] {
  const pattern = new RegExp(
    `^- \\[([a-z0-9]+(?:-[a-z0-9]+)*)\\]\\(\\.\\./\\.\\./notes/${expertDomain}/([a-z0-9]+(?:-[a-z0-9]+)*)\\.md\\) - .+$`,
  );
  const slugs: string[] = [];
  for (const line of section.split("\n")) {
    if (!line.startsWith("- ")) continue;
    const match = pattern.exec(line);
    if (match === null || match[1] !== match[2]) throw new Error(`invalid profile bullet: ${line}`);
    slugs.push(match[1] ?? "");
  }
  return slugs;
}

export function validateDisciplineProfileSections(
  text: string,
  expected: { primary: readonly string[]; cross: readonly string[]; expertDomain: string },
): void {
  rejectHiddenNavigationMarkup(text);
  const primaryHeadings = [...text.matchAll(/^## Primary experts$/gm)];
  const crossHeadings = [...text.matchAll(/^## Cross-disciplinary experts$/gm)];
  if (primaryHeadings.length !== 1 || crossHeadings.length !== 1) {
    throw new Error("profile section headings must each appear exactly once");
  }
  const primaryHeading = primaryHeadings[0] as RegExpMatchArray & { index: number };
  const crossHeading = crossHeadings[0] as RegExpMatchArray & { index: number };
  if (primaryHeading.index >= crossHeading.index) {
    throw new Error("profile section headings are out of order");
  }
  const primarySection = text.slice(primaryHeading.index + primaryHeading[0].length, crossHeading.index);
  const crossSection = text.slice(crossHeading.index + crossHeading[0].length);
  const actualPrimary = profileBulletSlugs(primarySection, expected.expertDomain);
  const actualCross = profileBulletSlugs(crossSection, expected.expertDomain);
  const linked = [
    ...text.matchAll(
      new RegExp(
        `\\]\\(\\.\\./\\.\\./notes/${expected.expertDomain}/([a-z0-9]+(?:-[a-z0-9]+)*)\\.md\\)`,
        "g",
      ),
    ),
  ].map((m) => m[1] ?? "");
  const all = [...expected.primary, ...expected.cross];
  if (
    actualPrimary.join(",") !== expected.primary.join(",") ||
    actualCross.join(",") !== expected.cross.join(",") ||
    linked.join(",") !== all.join(",")
  ) {
    throw new Error(
      `profile section mismatch: expected ${JSON.stringify([expected.primary, expected.cross])}, ` +
        `found ${JSON.stringify([actualPrimary, actualCross])}`,
    );
  }
}
