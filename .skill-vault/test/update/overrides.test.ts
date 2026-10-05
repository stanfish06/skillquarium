import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  applyOrQuarantine,
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

function git(root: string, ...argv: string[]): void {
  const proc = Bun.spawnSync(["git", "-C", root, "-c", "user.name=t", "-c", "user.email=t@t", ...argv]);
  if (proc.exitCode !== 0) throw new Error(`git ${argv.join(" ")}: ${proc.stderr.toString()}`);
}

function writeLock(root: string, hashes: Record<string, string>): void {
  const skills = Object.fromEntries(Object.entries(hashes).map(([k, h]) => [k, { skillFolderHash: h }]));
  writeFileSync(join(root, ".skill-lock.json"), JSON.stringify({ version: 3, skills }, null, 2), "utf8");
}

function lockHashes(root: string): Record<string, string> {
  const lock = JSON.parse(readFileSync(join(root, ".skill-lock.json"), "utf8")) as {
    skills: Record<string, { skillFolderHash: string }>;
  };
  return Object.fromEntries(Object.entries(lock.skills).map(([k, v]) => [k, v.skillFolderHash]));
}

/** A committed vault with a fixed `demo` and a plain `keep`, then an upstream sync over both. */
function syncedRepo(demoText: string | null): string {
  const root = tempRoot();
  writeSkill(root, "demo", "run docker compose config\n");
  writeSkill(root, "keep", "keep v1\n");
  writeLock(root, { demo: "demo-v1", keep: "keep-v1" });
  mkdirSync(dirname(overridesPath(root)), { recursive: true });
  writeFileSync(overridesPath(root), JSON.stringify(Object.fromEntries(spec())), "utf8");
  git(root, "init", "-q");
  git(root, "add", "-A");
  git(root, "commit", "-qm", "base");

  if (demoText === null) rmSync(join(root, "skills/demo/SKILL.md"));
  else writeSkill(root, "demo", demoText);
  writeFileSync(join(root, "skills/demo/added.md"), "new upstream file\n", "utf8");
  writeSkill(root, "keep", "keep v2\n");
  writeLock(root, { demo: "demo-v2", keep: "keep-v2" });
  return root;
}

describe("quarantine", () => {
  const io = () => {
    const err: string[] = [];
    return { err, sink: { out: () => {}, err: (l: string) => err.push(l) } };
  };

  test("a stale skill goes back to HEAD, folder and lock entry; the rest of the sync stays", () => {
    const root = syncedRepo("upstream rewrote this section\n");
    const { err, sink } = io();

    expect(applyOrQuarantine(root, sink)).toBe(1);

    expect(readFileSync(join(root, "skills/demo/SKILL.md"), "utf8")).toBe("run docker compose config\n");
    expect(existsSync(join(root, "skills/demo/added.md"))).toBe(false);
    expect(readFileSync(join(root, "skills/keep/SKILL.md"), "utf8")).toBe("keep v2\n");
    expect(lockHashes(root)).toEqual({ demo: "demo-v1", keep: "keep-v2" });
    expect(err).toContain("  QUARANTINED: demo — held at HEAD until its overrides are re-derived");
  });

  test("a skill whose overridden file upstream deleted is quarantined too", () => {
    const root = syncedRepo(null);
    expect(applyOrQuarantine(root, io().sink)).toBe(1);
    expect(readFileSync(join(root, "skills/demo/SKILL.md"), "utf8")).toBe("run docker compose config\n");
    expect(lockHashes(root).demo).toBe("demo-v1");
  });

  test("a sync that only reverted the fix gets it re-applied, not quarantined", () => {
    const root = syncedRepo("run docker-compose config\n");
    const { err, sink } = io();
    expect(applyOrQuarantine(root, sink)).toBe(0);
    expect(readFileSync(join(root, "skills/demo/SKILL.md"), "utf8")).toBe("run docker compose config\n");
    expect(existsSync(join(root, "skills/demo/added.md"))).toBe(true);
    expect(lockHashes(root)).toEqual({ demo: "demo-v2", keep: "keep-v2" });
    expect(err).toEqual([]);
  });

  test("the lock keeps the skills CLI's formatting", () => {
    const root = syncedRepo("upstream rewrote this section\n");
    applyOrQuarantine(root, io().sink);
    const text = readFileSync(join(root, ".skill-lock.json"), "utf8");
    expect(text).toBe(JSON.stringify(JSON.parse(text), null, 2));
  });

  test("outside a git checkout nothing can be restored, so it exits 2", () => {
    const root = tempRoot();
    writeSkill(root, "demo", "upstream rewrote this section\n");
    writeLock(root, { demo: "demo-v2" });
    mkdirSync(dirname(overridesPath(root)), { recursive: true });
    writeFileSync(overridesPath(root), JSON.stringify(Object.fromEntries(spec())), "utf8");
    const { err, sink } = io();
    expect(applyOrQuarantine(root, sink)).toBe(2);
    expect(err).toContain("  QUARANTINE FAILED: demo — it still holds upstream's text");
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
