import { expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildFixtureGraph, write } from "./fixtureVault";

/**
 * A toggle line sits in frontmatter, so it shifts the 8 KB body window and drops whatever the last
 * line mentions. Left unstripped, the graph a contributor commits depends on whose toggles are
 * applied, and CI rebuilds a different one. `long` puts a mention of `beta` right at the cutoff.
 */
const WINDOW = 8000;

function addLongSkill(root: string): void {
  const head = `---\nname: long\ndescription: A long skill.\n---\n\n`;
  const mention = "It also uses `beta` at the very end.\n";
  const filler = "x".repeat(WINDOW - head.length - mention.length);
  write(join(root, "skills", "long", "SKILL.md"), head + filler + mention);
  write(join(root, "vault", "notes", "demo", "long.md"), "---\nsource: skills/long/SKILL.md\n---\n");
}

function toggle(root: string): void {
  const file = join(root, "skills", "long", "SKILL.md");
  const text = readFileSync(file, "utf8");
  writeFileSync(file, text.replace("\n---\n", "\ndisable-model-invocation: true\n---\n"));
}

test("a toggle does not change which mentions fall inside the body window", () => {
  const plain = buildFixtureGraph(addLongSkill);
  const toggled = buildFixtureGraph((root) => {
    addLongSkill(root);
    toggle(root);
  });
  const edges = (g: typeof plain.graph) => g.edges.map((e) => `${e.src}|${e.rel}|${e.dst}`).sort();

  // The mention must be inside the window to begin with, or the test proves nothing.
  expect(edges(plain.graph)).toContain("long|references|beta");
  expect(edges(toggled.graph)).toEqual(edges(plain.graph));

  plain.cleanup();
  toggled.cleanup();
});
