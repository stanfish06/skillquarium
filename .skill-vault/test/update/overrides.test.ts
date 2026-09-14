import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  applyOverrides,
  loadOverrides,
  type Overrides,
  overridesPath,
  reportOverrides,
} from "../../src/update/overrides";

const VAULT_PARENT = resolve(import.meta.dir, "../../..");
const created: string[] = [];

afterAll(() => {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "skillquarium-overrides-"));
  created.push(dir);
  return dir;
}

function writeSkill(root: string, name: string, text: string): string {
  const path = join(root, "skills", name, "SKILL.md");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
  return path;
}

function spec(): Overrides {
  return new Map([
    ["demo", [{ id: "compose-v2", find: "docker-compose config", replace: "docker compose config" }]],
  ]);
}

describe("local override mechanics", () => {
  test("a pending override is written and is idempotent", () => {
    const root = tempRoot();
    const path = writeSkill(root, "demo", "run docker-compose config\n");

    const first = applyOverrides(spec(), root);
    expect(first.pending).toEqual(["demo/compose-v2"]);
    expect(readFileSync(path, "utf8")).toBe("run docker compose config\n");

    const second = applyOverrides(spec(), root);
    expect(second.applied).toEqual(["demo/compose-v2"]);
    expect(second.pending).toEqual([]);
  });

  test("--check reports without writing", () => {
    const root = tempRoot();
    const path = writeSkill(root, "demo", "run docker-compose config\n");

    const result = applyOverrides(spec(), root, false);

    expect(result.pending).toEqual(["demo/compose-v2"]);
    expect(readFileSync(path, "utf8")).toBe("run docker-compose config\n");

    const out: string[] = [];
    const err: string[] = [];
    const code = reportOverrides(result, true, { out: (l) => out.push(l), err: (l) => err.push(l) });
    expect(code).toBe(1);
    expect(out).toEqual([
      "local overrides: 1 recorded, 0 already applied, 1 would re-apply",
      "  stale in tree: demo/compose-v2",
    ]);
    expect(err).toEqual([]);
  });

  test("an override is stale when upstream rewrote the region", () => {
    const root = tempRoot();
    writeSkill(root, "demo", "upstream rewrote this section\n");

    const result = applyOverrides(spec(), root);

    expect(result.stale).toEqual(["demo/compose-v2"]);
    expect(result.pending).toEqual([]);
    const err: string[] = [];
    expect(reportOverrides(result, false, { out: () => {}, err: (l) => err.push(l) })).toBe(1);
    expect(err).toEqual(["  STALE: demo/compose-v2 — upstream rewrote this region; re-derive the fix"]);
  });

  test("a missing skill is reported", () => {
    const root = tempRoot();
    const result = applyOverrides(new Map([["gone", [{ id: "x", find: "a", replace: "b" }]]]), root);
    expect(result.missing).toHaveLength(1);
    expect(result.missing[0]).toContain("skills/gone/SKILL.md");
    expect(reportOverrides(result, false, { out: () => {}, err: () => {} })).toBe(1);
  });

  test("every occurrence of the defect is replaced", () => {
    const root = tempRoot();
    const path = writeSkill(root, "demo", "docker-compose config\nand docker-compose config\n");
    applyOverrides(spec(), root);
    expect(readFileSync(path, "utf8")).toBe("docker compose config\nand docker compose config\n");
  });

  test("load rejects incomplete and no-op overrides", () => {
    const root = tempRoot();
    const path = join(root, "overrides.json");

    writeFileSync(path, JSON.stringify({ demo: [{ id: "x", find: "a" }] }), "utf8");
    expect(() => loadOverrides(path)).toThrow("demo: override missing ['replace']");

    writeFileSync(path, JSON.stringify({ demo: [{ id: "x", find: "a", replace: "a" }] }), "utf8");
    expect(() => loadOverrides(path)).toThrow("demo/x: find and replace are identical");

    writeFileSync(path, JSON.stringify([1, 2]), "utf8");
    expect(() => loadOverrides(path)).toThrow("must be an object keyed by skill name");

    writeFileSync(path, JSON.stringify({ demo: { id: "x" } }), "utf8");
    expect(() => loadOverrides(path)).toThrow("demo: overrides must be a list");

    expect(loadOverrides(join(root, "absent.json")).size).toBe(0);
  });
});

/**
 * mermaid-studio/metadata-source anchors its replacement on the last metadata line plus the
 * closing `---`; toggling the skill off (e70fb792) inserted `disable-model-invocation: true`
 * between them, so the entry reads stale although its fix is in the file. The anchor has to be
 * narrowed to the metadata lines; until then this one entry is allowed to be stale.
 */
const KNOWN_STALE = ["mermaid-studio/metadata-source"];

describe("tracked overrides", () => {
  // If the tree does not already satisfy every recorded override, an upstream sync reverted a
  // merged fix and nobody noticed -- the failure mode issue #665 describes.
  test("every recorded override is applied in the tracked tree", () => {
    const recorded = loadOverrides(overridesPath(VAULT_PARENT));
    expect(recorded.size).toBeGreaterThan(0);

    const result = applyOverrides(recorded, VAULT_PARENT, false);

    expect(result.missing).toEqual([]);
    expect(result.stale.filter((label) => !KNOWN_STALE.includes(label))).toEqual([]);
    expect(result.pending).toEqual([]);
  });
});
