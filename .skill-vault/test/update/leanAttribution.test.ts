import { afterAll, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { applyOrQuarantine, applyOverrides } from "../../src/update/overrides";

const roots: string[] = [];
const source = "scottnarmstrong/LeanAutoformalizationSkills";
const skills = { "lean-workflow": "a".repeat(40), "lean-proof-patterns": "b".repeat(40) };
type TestLock = { skills: Record<string, { source: string; skillFolderHash: string }> };
const files = {
  LICENSE: "Collection license\n",
  "THIRD_PARTY_NOTICES.md": "See [sources](SOURCES.md).\n",
  "LICENSES/Apache-2.0.txt": "Apache license\n",
  "SOURCES.md": "See [notices](THIRD_PARTY_NOTICES.md) and [index](INDEX.md).\n",
  "PROVENANCE.md": "Upstream provenance\n",
  "INDEX.md": "[Workflow](../lean-workflow/SKILL.md)\n[Patterns](../lean-proof-patterns/SKILL.md)\n",
};

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function write(root: string, relative: string, text: string): void {
  const path = join(root, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "lean-attribution-"));
  roots.push(root);
  const base = "skills/lean-autoformalization-common";
  for (const [name, text] of Object.entries(files)) write(root, `${base}/${name}`, text);
  write(
    root,
    `${base}/manifest.json`,
    JSON.stringify({
      source,
      revision: "c".repeat(40),
      skills,
      files: Object.fromEntries(
        Object.entries(files).map(([name, text]) => [name, createHash("sha256").update(text).digest("hex")]),
      ),
    }),
  );
  write(
    root,
    ".skill-lock.json",
    JSON.stringify({
      skills: Object.fromEntries(
        Object.entries(skills).map(([name, skillFolderHash]) => [name, { source, skillFolderHash }]),
      ),
    }),
  );
  for (const name of Object.keys(skills)) write(root, `skills/${name}/SKILL.md`, `# ${name}\n`);
  return root;
}

test("overrides restores standalone notices and renders each local index", () => {
  const root = fixture();
  const first = applyOverrides(new Map(), root);
  expect(first.pending).toHaveLength(12);
  expect(first.stale).toEqual([]);
  for (const name of Object.keys(skills)) {
    expect(readFileSync(join(root, "skills", name, "LICENSE"), "utf8")).toBe(files.LICENSE);
    expect(readFileSync(join(root, "skills", name, "LICENSES/Apache-2.0.txt"), "utf8")).toBe(
      files["LICENSES/Apache-2.0.txt"],
    );
    const index = readFileSync(join(root, "skills", name, "INDEX.md"), "utf8");
    expect(index).toContain("](SKILL.md)");
    expect(index).toContain(`https://github.com/${source}/blob/${"c".repeat(40)}/skills/`);
    expect(index).not.toContain("](../");
    expect(readFileSync(join(root, "skills", name, "PROVENANCE.md"), "utf8")).toContain(
      "Skillquarium adaptation",
    );
  }
  const second = applyOverrides(new Map(), root);
  expect(second.pending).toEqual([]);
  expect(second.applied).toHaveLength(12);
});

test("check mode reports missing bundled notices without writing", () => {
  const root = fixture();
  const result = applyOverrides(new Map(), root, false);
  expect(result.pending).toHaveLength(12);
  expect(existsSync(join(root, "skills/lean-workflow/LICENSE"))).toBe(false);
});

test("a changed folder hash blocks stale attribution before copying", () => {
  const root = fixture();
  const path = join(root, ".skill-lock.json");
  const lock = JSON.parse(readFileSync(path, "utf8")) as TestLock;
  const workflow = lock.skills["lean-workflow"];
  if (!workflow) throw new Error("missing workflow fixture");
  workflow.skillFolderHash = "d".repeat(40);
  writeFileSync(path, JSON.stringify(lock));
  const result = applyOverrides(new Map(), root);
  expect(result.stale).toContain("lean-workflow/attribution-pin");
  expect(existsSync(join(root, "skills/lean-workflow/LICENSE"))).toBe(false);
});

test("modified shared metadata fails before any standalone copy is written", () => {
  const root = fixture();
  write(root, "skills/lean-autoformalization-common/LICENSE", "Unreviewed new license\n");
  expect(() => applyOverrides(new Map(), root)).toThrow("LICENSE");
  expect(existsSync(join(root, "skills/lean-workflow/LICENSE"))).toBe(false);
});

test("fatal attribution errors return 2 so the update workflow cannot commit", () => {
  const root = fixture();
  write(root, "skills/lean-autoformalization-common/LICENSE", "Unreviewed new license\n");
  const errors: string[] = [];
  expect(applyOrQuarantine(root, { out: () => {}, err: (line) => errors.push(line) })).toBe(2);
  expect(errors.join("\n")).toContain("LICENSE");
  expect(existsSync(join(root, "skills/lean-workflow/LICENSE"))).toBe(false);
});

test("an upstream reinstall can be followed by restoring the pinned notices", () => {
  const root = fixture();
  applyOverrides(new Map(), root);
  rmSync(join(root, "skills/lean-workflow/LICENSE"));
  expect(applyOverrides(new Map(), root).pending).toContain("lean-workflow/attribution-LICENSE");
  expect(readFileSync(join(root, "skills/lean-workflow/LICENSE"), "utf8")).toBe(files.LICENSE);
});

test("a new collection skill requires an attribution pin", () => {
  const root = fixture();
  const path = join(root, ".skill-lock.json");
  const lock = JSON.parse(readFileSync(path, "utf8")) as TestLock;
  lock.skills["lean-new-skill"] = { source, skillFolderHash: "d".repeat(40) };
  writeFileSync(path, JSON.stringify(lock));
  expect(applyOverrides(new Map(), root).stale).toContain("lean-new-skill/attribution-pin");
});
