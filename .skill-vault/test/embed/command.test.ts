import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Context } from "../../src/cli";
import type { Config } from "../../src/config";
import { help, run } from "../../src/embed/command";
import { embedVault } from "../../src/embed/run";
import { fakeClient } from "./fakeClient";

const tmpDirs: string[] = [];
afterAll(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

const config: Config = {
  skillsCliVersion: "1.5.23",
  claudeSkillsDir: "/nonexistent",
  // Unroutable on purpose: every assertion here must stay off the network.
  embed: { url: "http://127.0.0.1:1", model: null, batchSize: 16, timeoutMs: 100, retries: 0 },
  query: { k: 8, rrfK: 60, weights: { lexical: 1, fuzzy: 1 } },
};

function vault(): { root: string; ctx: Context; out: string[]; err: string[] } {
  const root = mkdtempSync(join(tmpdir(), "sq-cmd-"));
  tmpDirs.push(root);
  for (const id of ["a", "b", "c"]) {
    mkdirSync(join(root, "skills", id), { recursive: true });
    writeFileSync(
      join(root, "skills", id, "SKILL.md"),
      `---\nname: ${id}\ndescription: ${id} does things\n---\n`,
    );
  }
  const out: string[] = [];
  const err: string[] = [];
  const ctx: Context = {
    root,
    json: false,
    out: (l) => out.push(l),
    err: (l) => err.push(l),
    config: async () => config,
  };
  return { root, ctx, out, err };
}

describe("embed command", () => {
  test("--check lists stale ids and exits 1", async () => {
    const { ctx, out } = vault();
    expect(await run(["--check"], ctx)).toBe(1);
    expect(out).toEqual(["a", "b", "c"]);
  });

  test("--check on a current index exits 0 with the skill count", async () => {
    const { root, ctx, out } = vault();
    await embedVault(root, fakeClient(), { batchSize: 16, today: () => "2026-01-01" });
    expect(await run(["--check"], ctx)).toBe(0);
    expect(out).toEqual(["embeddings current (3 skills)"]);
  });

  test("--json prints the result object", async () => {
    const { ctx, out } = vault();
    ctx.json = true;
    expect(await run(["--check"], ctx)).toBe(1);
    expect(JSON.parse(out[0] ?? "{}")).toEqual({
      embedded: 0,
      removed: 0,
      stale: ["a", "b", "c"],
      migrated: 0,
      unproven: 0,
      model: "",
      dim: 0,
    });
  });

  test("an unknown argument is a usage error", async () => {
    const { ctx, err } = vault();
    expect(await run(["--all"], ctx)).toBe(2);
    expect(err).toEqual([`usage: skillquarium ${help}`]);
  });
});
