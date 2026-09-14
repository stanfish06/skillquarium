import { afterAll, expect, test } from "bun:test";
import { join } from "node:path";
import { type ContextOverrides, main } from "../../src/cli";
import { HASH_VERSION, skillContentHash } from "../../src/embed/hash";
import { writeManifest, writeSkill } from "../../src/embed/store";
import { writeGraph } from "../../src/kg/write";
import { FAKE_DIM, fakeVector } from "../embed/fakeClient";
import { buildFixtureGraph, write } from "../kg/fixtureVault";

const SKILLS = ["alpha", "beta", "gamma", "workflow"];
const cleanups: Array<() => void> = [];
afterAll(() => {
  for (const c of cleanups) c();
});

/**
 * The kg fixture vault with a graph and an embedding index on disk, and an embed endpoint pointed
 * at a closed port: nothing in the query path may want it.
 */
function vaultWithDeadEndpoint(): string {
  const fixture = buildFixtureGraph();
  cleanups.push(fixture.cleanup);
  writeGraph(fixture.root, fixture.graph);
  for (const id of SKILLS) {
    writeSkill(fixture.root, id, { desc: fakeVector(`${id} desc`), body: fakeVector(`${id} body`) });
  }
  writeManifest(fixture.root, {
    model: "fake-embed",
    dim: FAKE_DIM,
    hashVersion: HASH_VERSION,
    skills: Object.fromEntries(
      SKILLS.map((id) => [
        id,
        { sha256: skillContentHash(join(fixture.root, "skills", id, "SKILL.md")), updated: "2026-01-01" },
      ]),
    ),
  });
  write(
    join(fixture.root, ".skill-vault/config.json"),
    JSON.stringify({ embed: { url: "http://127.0.0.1:1", retries: 0, timeoutMs: 500 } }),
  );
  return fixture.root;
}

function capture(): { out: string[]; err: string[]; overrides: ContextOverrides } {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, overrides: { out: (l) => out.push(l), err: (l) => err.push(l) } };
}

/** Runs argv with fetch replaced by a thrower, so any network call fails the test outright. */
async function withoutNetwork(argv: string[], c: ReturnType<typeof capture>): Promise<number> {
  const real = globalThis.fetch;
  const thrower = (input: RequestInfo | URL): never => {
    throw new Error(`the query made a network request to ${String(input)}`);
  };
  globalThis.fetch = Object.assign(thrower, { preconnect: real.preconnect });
  try {
    return await main(argv, c.overrides);
  } finally {
    globalThis.fetch = real;
  }
}

test("query answers with an index on disk and never contacts the endpoint", async () => {
  const root = vaultWithDeadEndpoint();
  const c = capture();

  expect(await withoutNetwork(["--root", root, "query", "fastq reads", "--k", "3", "--no-fuzzy"], c)).toBe(0);
  expect(c.out.some((l) => l.includes("alpha"))).toBe(true);
  expect(c.err).toEqual([]);
}, 20_000);

test("query answers without an index at all, as one notice", async () => {
  const fixture = buildFixtureGraph();
  cleanups.push(fixture.cleanup);
  writeGraph(fixture.root, fixture.graph);
  const c = capture();

  const argv = ["--root", fixture.root, "query", "fastq reads", "--k", "3", "--no-fuzzy"];
  expect(await withoutNetwork(argv, c)).toBe(0);
  expect(c.out.some((l) => l.includes("alpha"))).toBe(true);
  expect(c.err).toHaveLength(1);
  expect(c.err[0]).toContain("semantic expansion unavailable");
}, 20_000);
