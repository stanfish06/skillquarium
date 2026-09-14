import { afterAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SkillEntry } from "../../src/catalog";
import { FULL_FILE_HASH_VERSION, HASH_VERSION, hashSkillText, skillContentHash } from "../../src/embed/hash";
import {
  EMBED_DIR,
  type Manifest,
  migrateHashes,
  pruneOrphans,
  readIndex,
  readManifest,
  removedSkills,
  removeSkill,
  staleSkills,
  writeManifest,
  writeSkill,
} from "../../src/embed/store";
import { setSkillEnabled, setSkillProductStates } from "../../src/toggle/edit";
import { loadSkill } from "../../src/toggle/state";
import { FAKE_DIM, fakeVector } from "./fakeClient";

const tmpDirs: string[] = [];
function tmp(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  tmpDirs.push(d);
  return d;
}
afterAll(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

function skill(
  root: string,
  id: string,
  text = `---\nname: ${id}\ndescription: ${id} skill\n---\nbody\n`,
): SkillEntry {
  const dir = join(root, "skills", id);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "SKILL.md");
  writeFileSync(file, text);
  return { id, dir, file };
}

describe("writeSkill / readIndex", () => {
  test("rows written for an id come back through readIndex", () => {
    const root = tmp("sq-store-");
    const a = skill(root, "a");
    const desc = fakeVector("a desc");
    const body = fakeVector("a body");
    writeSkill(root, "a", { desc, body });
    expect(existsSync(join(root, EMBED_DIR, "a.f16"))).toBe(true);
    writeManifest(root, {
      model: "fake-embed",
      dim: FAKE_DIM,
      hashVersion: HASH_VERSION,
      skills: { a: { sha256: skillContentHash(a.file), updated: "2026-01-01" } },
    });
    const idx = readIndex(root);
    expect(idx).not.toBeNull();
    if (!idx) return;
    expect(idx.dim).toBe(FAKE_DIM);
    expect(idx.ids).toEqual(["a"]);
    expect(idx.stale.size).toBe(0);
    for (let i = 0; i < FAKE_DIM; i++) {
      expect(Math.abs((idx.desc[0]?.[i] ?? 0) - (desc[i] ?? 0))).toBeLessThan(1e-3);
      expect(Math.abs((idx.body[0]?.[i] ?? 0) - (body[i] ?? 0))).toBeLessThan(1e-3);
    }
  });

  test("readIndex is null without a manifest and flags changed or missing skills as stale", () => {
    const root = tmp("sq-store-");
    expect(readIndex(root)).toBeNull();
    const a = skill(root, "a");
    skill(root, "b");
    writeSkill(root, "a", { desc: fakeVector("x"), body: fakeVector("y") });
    writeSkill(root, "gone", { desc: fakeVector("x"), body: fakeVector("y") });
    writeManifest(root, {
      model: "fake-embed",
      dim: FAKE_DIM,
      hashVersion: HASH_VERSION,
      skills: {
        a: { sha256: skillContentHash(a.file), updated: "2026-01-01" },
        gone: { sha256: "0".repeat(64), updated: "2026-01-01" },
      },
    });
    writeFileSync(a.file, "---\nname: a\ndescription: changed\n---\n");
    const idx = readIndex(root);
    expect(idx?.ids).toEqual(["a", "gone"]);
    expect([...(idx?.stale ?? [])].sort()).toEqual(["a", "b", "gone"]);
  });

  test("removeSkill deletes the row file and tolerates a missing one", () => {
    const root = tmp("sq-store-");
    writeSkill(root, "a", { desc: fakeVector("x"), body: fakeVector("y") });
    removeSkill(root, "a");
    expect(existsSync(join(root, EMBED_DIR, "a.f16"))).toBe(false);
    removeSkill(root, "a");
  });
});

describe("pruneOrphans", () => {
  test("drops row files with no manifest entry and keeps the rest", () => {
    const root = tmp("sq-store-");
    for (const id of ["a", "b", "left-over"]) {
      writeSkill(root, id, { desc: fakeVector(id), body: fakeVector(id) });
    }
    writeFileSync(join(root, EMBED_DIR, "manifest.json"), "{}\n");
    expect(pruneOrphans(root, new Set(["a", "b"]))).toEqual(["left-over"]);
    expect(existsSync(join(root, EMBED_DIR, "left-over.f16"))).toBe(false);
    expect(existsSync(join(root, EMBED_DIR, "a.f16"))).toBe(true);
    expect(existsSync(join(root, EMBED_DIR, "manifest.json"))).toBe(true);
    expect(pruneOrphans(tmp("sq-store-"), new Set())).toEqual([]);
  });
});

describe("manifest", () => {
  test("keys sorted at every level, indent 2, trailing newline", () => {
    const root = tmp("sq-store-");
    const m: Manifest = {
      skills: {
        b: { updated: "2026-01-02", sha256: "bb" },
        a: { truncated: true, updated: "2026-01-01", sha256: "aa" },
      },
      dim: 8,
      hashVersion: HASH_VERSION,
      model: "fake-embed",
    };
    writeManifest(root, m);
    const text = readFileSync(join(root, EMBED_DIR, "manifest.json"), "utf8");
    expect(text.endsWith("}\n")).toBe(true);
    expect(text).toBe(
      `${JSON.stringify(
        {
          dim: 8,
          hashVersion: HASH_VERSION,
          model: "fake-embed",
          skills: {
            a: { sha256: "aa", truncated: true, updated: "2026-01-01" },
            b: { sha256: "bb", updated: "2026-01-02" },
          },
        },
        null,
        2,
      )}\n`,
    );
    expect(readManifest(root)).toEqual(m);
    expect(existsSync(join(root, EMBED_DIR, "manifest.json.tmp"))).toBe(false);
  });

  test("readManifest is null when absent and throws on a malformed file", () => {
    const root = tmp("sq-store-");
    expect(readManifest(root)).toBeNull();
    mkdirSync(join(root, EMBED_DIR), { recursive: true });
    writeFileSync(join(root, EMBED_DIR, "manifest.json"), '{"model": 1}\n');
    expect(() => readManifest(root)).toThrow(/manifest/);
  });
});

describe("staleSkills / removedSkills", () => {
  test("hash mismatch and missing-from-manifest are stale; manifest-only ids are removed", () => {
    const root = tmp("sq-store-");
    const a = skill(root, "a");
    const b = skill(root, "b");
    const c = skill(root, "c");
    for (const id of ["a", "b"]) writeSkill(root, id, { desc: fakeVector(id), body: fakeVector(id) });
    const manifest: Manifest = {
      model: "fake-embed",
      dim: FAKE_DIM,
      hashVersion: HASH_VERSION,
      skills: {
        a: { sha256: skillContentHash(a.file), updated: "2026-01-01" },
        b: { sha256: "deadbeef", updated: "2026-01-01" },
        zzz: { sha256: skillContentHash(c.file), updated: "2026-01-01" },
      },
    };
    const entries = [c, b, a];
    expect(staleSkills(root, manifest, entries)).toEqual(["b", "c"]);
    expect(removedSkills(manifest, entries)).toEqual(["zzz"]);
    expect(staleSkills(root, null, entries)).toEqual(["a", "b", "c"]);
    expect(removedSkills(null, entries)).toEqual([]);
  });

  test("a manifest entry whose .f16 is gone is stale even though its SKILL.md is unchanged", () => {
    const root = tmp("sq-store-");
    const entries = ["a", "b", "c"].map((id) => skill(root, id));
    const manifest: Manifest = {
      model: "fake-embed",
      dim: FAKE_DIM,
      hashVersion: HASH_VERSION,
      skills: {},
    };
    for (const e of entries) {
      writeSkill(root, e.id, { desc: fakeVector(e.id), body: fakeVector(e.id) });
      manifest.skills[e.id] = { sha256: skillContentHash(e.file), updated: "2026-01-01" };
    }
    writeManifest(root, manifest);
    expect(staleSkills(root, manifest, entries)).toEqual([]);

    rmSync(join(root, EMBED_DIR, "b.f16"));
    expect(staleSkills(root, manifest, entries)).toEqual(["b"]);
    // readIndex drops it from the searchable ids and reports it stale rather than reporting clean.
    const idx = readIndex(root);
    expect(idx?.ids).toEqual(["a", "c"]);
    expect([...(idx?.stale ?? [])]).toEqual(["b"]);
  });

  test("hashSkillText matches a known digest of the text it is given", () => {
    expect(hashSkillText("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("toggle-insensitive hashing", () => {
  function toggledPair(id: string): { plain: SkillEntry; toggled: SkillEntry } {
    const plain = skill(tmp("sq-hash-"), id);
    const toggled = skill(tmp("sq-hash-"), id);
    setSkillEnabled(loadSkill(toggled.dir), false);
    return { plain, toggled };
  }

  test("disabling a skill rewrites SKILL.md but not its hash", () => {
    const { plain, toggled } = toggledPair("a");
    expect(readFileSync(toggled.file, "utf8")).toContain("disable-model-invocation: true");
    expect(readFileSync(toggled.file, "utf8")).not.toBe(readFileSync(plain.file, "utf8"));
    expect(skillContentHash(toggled.file)).toBe(skillContentHash(plain.file));
    // Re-enabling writes `false` rather than dropping the line; that must not move the hash either.
    setSkillEnabled(loadSkill(toggled.dir), true);
    expect(readFileSync(toggled.file, "utf8")).toContain("disable-model-invocation: false");
    expect(skillContentHash(toggled.file)).toBe(skillContentHash(plain.file));
  });

  test("a toggled skill is not stale; an edited one is", () => {
    const root = tmp("sq-hash-");
    const a = skill(root, "a");
    const b = skill(root, "b");
    const manifest: Manifest = {
      model: "fake-embed",
      dim: FAKE_DIM,
      hashVersion: HASH_VERSION,
      skills: {
        a: { sha256: skillContentHash(a.file), updated: "2026-01-01" },
        b: { sha256: skillContentHash(b.file), updated: "2026-01-01" },
      },
    };
    for (const id of ["a", "b"]) writeSkill(root, id, { desc: fakeVector(id), body: fakeVector(id) });
    expect(staleSkills(root, manifest, [a, b])).toEqual([]);

    setSkillEnabled(loadSkill(a.dir), false);
    expect(staleSkills(root, manifest, [a, b])).toEqual([]);

    writeFileSync(b.file, "---\nname: b\ndescription: b skill\n---\nrewritten body\n");
    expect(staleSkills(root, manifest, [a, b])).toEqual(["b"]);
  });

  test("agents/openai.yaml is outside the hash, so the Codex toggle never ages a vector", () => {
    const root = tmp("sq-hash-");
    const a = skill(root, "a");
    writeSkill(root, "a", { desc: fakeVector("a"), body: fakeVector("a") });
    const manifest: Manifest = {
      model: "fake-embed",
      dim: FAKE_DIM,
      hashVersion: HASH_VERSION,
      skills: { a: { sha256: skillContentHash(a.file), updated: "2026-01-01" } },
    };
    const before = skillContentHash(a.file);
    setSkillProductStates(loadSkill(a.dir), { codex: false });
    expect(readFileSync(join(a.dir, "agents", "openai.yaml"), "utf8")).toContain(
      "allow_implicit_invocation: false",
    );
    expect(skillContentHash(a.file)).toBe(before);
    expect(staleSkills(root, manifest, [a])).toEqual([]);
  });
});

describe("migrateHashes", () => {
  /** A scheme-1 manifest: sha256 over each SKILL.md exactly as it stands, toggle line included. */
  function legacyManifest(entries: SkillEntry[]): Manifest {
    const skills: Record<string, { sha256: string; updated: string }> = {};
    for (const e of entries) {
      skills[e.id] = {
        sha256: createHash("sha256").update(readFileSync(e.file)).digest("hex"),
        updated: "2026-01-01",
      };
    }
    return {
      model: "fake-embed",
      dim: FAKE_DIM,
      hashVersion: FULL_FILE_HASH_VERSION,
      skills,
    };
  }

  test("rehashes what it can prove unchanged and leaves a real edit stale", () => {
    const root = tmp("sq-migrate-");
    const entries = ["a", "b", "c", "d"].map((id) => skill(root, id));
    for (const e of entries) writeSkill(root, e.id, { desc: fakeVector(e.id), body: fakeVector(e.id) });
    const legacy = legacyManifest(entries);
    const [a, b, c, d] = entries as [SkillEntry, SkillEntry, SkillEntry, SkillEntry];

    setSkillEnabled(loadSkill(a.dir), false);
    setSkillEnabled(loadSkill(b.dir), true);
    writeFileSync(c.file, "---\nname: c\ndescription: c skill\n---\ndifferent body\n");

    // Even before migrating, the old digests are read under their own scheme, so only c is stale.
    expect(staleSkills(root, legacy, entries)).toEqual(["c"]);

    const { manifest, migrated, unproven } = migrateHashes(legacy, entries);
    expect(migrated).toEqual(["a", "b", "d"]);
    expect(unproven).toEqual(["c"]);
    expect(manifest?.hashVersion).toBe(HASH_VERSION);
    expect(manifest?.skills.a?.sha256).toBe(skillContentHash(a.file));
    expect(manifest?.skills.b?.sha256).toBe(skillContentHash(b.file));
    expect(manifest?.skills.d?.sha256).toBe(skillContentHash(d.file));
    // The one it could not prove keeps its scheme-1 digest, which no longer matches anything.
    expect(manifest?.skills.c?.sha256).toBe(legacy.skills.c?.sha256);
    expect(manifest?.skills.a?.updated).toBe("2026-01-01");
    expect(staleSkills(root, manifest, entries)).toEqual(["c"]);
  });

  test("no-ops on a current manifest and on no manifest at all", () => {
    const root = tmp("sq-migrate-");
    const entries = ["a"].map((id) => skill(root, id));
    const current: Manifest = {
      model: "fake-embed",
      dim: FAKE_DIM,
      hashVersion: HASH_VERSION,
      skills: { a: { sha256: "whatever", updated: "2026-01-01" } },
    };
    expect(migrateHashes(current, entries)).toEqual({ manifest: current, migrated: [], unproven: [] });
    expect(migrateHashes(null, entries)).toEqual({ manifest: null, migrated: [], unproven: [] });
  });

  test("a manifest id with no skill on disk is a removal, not a failed migration", () => {
    const root = tmp("sq-migrate-");
    const entries = [skill(root, "a")];
    const legacy = legacyManifest(entries);
    legacy.skills.gone = { sha256: "0".repeat(64), updated: "2026-01-01" };
    const { manifest, migrated, unproven } = migrateHashes(legacy, entries);
    expect(migrated).toEqual(["a"]);
    expect(unproven).toEqual([]);
    expect(manifest?.skills.gone?.sha256).toBe("0".repeat(64));
    expect(removedSkills(manifest, entries)).toEqual(["gone"]);
  });

  test("an unrecognised newer scheme is never trusted", () => {
    const root = tmp("sq-migrate-");
    const entries = [skill(root, "a")];
    const future: Manifest = {
      ...legacyManifest(entries),
      hashVersion: HASH_VERSION + 1,
    };
    expect(staleSkills(root, future, entries)).toEqual(["a"]);
  });
});
