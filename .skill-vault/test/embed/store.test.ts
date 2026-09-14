import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SkillEntry } from "../../src/catalog";
import {
  EMBED_DIR,
  type Manifest,
  pruneOrphans,
  readIndex,
  readManifest,
  removedSkills,
  removeSkill,
  sha256File,
  staleSkills,
  writeManifest,
  writeSkill,
} from "../../src/embed/store";
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
      skills: { a: { sha256: sha256File(a.file), updated: "2026-01-01" } },
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
      skills: {
        a: { sha256: sha256File(a.file), updated: "2026-01-01" },
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
      model: "fake-embed",
    };
    writeManifest(root, m);
    const text = readFileSync(join(root, EMBED_DIR, "manifest.json"), "utf8");
    expect(text.endsWith("}\n")).toBe(true);
    expect(text).toBe(
      `${JSON.stringify(
        {
          dim: 8,
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
      skills: {
        a: { sha256: sha256File(a.file), updated: "2026-01-01" },
        b: { sha256: "deadbeef", updated: "2026-01-01" },
        zzz: { sha256: sha256File(c.file), updated: "2026-01-01" },
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
    const manifest: Manifest = { model: "fake-embed", dim: FAKE_DIM, skills: {} };
    for (const e of entries) {
      writeSkill(root, e.id, { desc: fakeVector(e.id), body: fakeVector(e.id) });
      manifest.skills[e.id] = { sha256: sha256File(e.file), updated: "2026-01-01" };
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

  test("sha256File matches a known digest", () => {
    const root = tmp("sq-store-");
    const p = join(root, "x.txt");
    writeFileSync(p, "abc");
    expect(sha256File(p)).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
