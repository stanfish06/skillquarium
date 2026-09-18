import { afterAll, expect, test } from "bun:test";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { type ContextOverrides, main } from "../../src/cli";
import { HASH_VERSION, skillContentHash } from "../../src/embed/hash";
import { writeManifest, writeSkill } from "../../src/embed/store";
import { writeGraph } from "../../src/kg/write";
import { TOKENIZER_PATH } from "../../src/search/bpe";
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

  expect(
    await withoutNetwork(["--root", root, "query", "fastq reads", "--k", "3", "--no-fuzzy", "--no-bpe"], c),
  ).toBe(0);
  expect(c.out.some((l) => l.includes("alpha"))).toBe(true);
  expect(c.err).toEqual([]);
}, 20_000);

test("query answers without an index at all, as one notice", async () => {
  const fixture = buildFixtureGraph();
  cleanups.push(fixture.cleanup);
  writeGraph(fixture.root, fixture.graph);
  const c = capture();

  const argv = ["--root", fixture.root, "query", "fastq reads", "--k", "3", "--no-fuzzy", "--no-bpe"];
  expect(await withoutNetwork(argv, c)).toBe(0);
  expect(c.out.some((l) => l.includes("alpha"))).toBe(true);
  expect(c.err).toHaveLength(1);
  expect(c.err[0]).toContain("semantic expansion unavailable");
}, 20_000);

/** The kg fixture vault, with or without the BPE model trained. */
function vaultWithBpe(trained: boolean): string {
  const fixture = buildFixtureGraph();
  cleanups.push(fixture.cleanup);
  writeGraph(fixture.root, fixture.graph);
  if (trained) {
    const dest = join(fixture.root, TOKENIZER_PATH);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(resolve(import.meta.dir, "../fixtures/tokenizer/tokenizer.json"), dest);
  }
  return fixture.root;
}

// ASCII finds only gamma ("formatting"); the fixture model's pieces also reach alpha.
const LEXICAL = ["query", "formatting", "--k", "2", "--no-fuzzy", "--no-semantic", "--json"];

interface Row {
  skill: string;
  score: number;
  why: string;
}

/** What a result says about ranking; `signals` is left out because BPE adds its rank there. */
async function jsonRun(root: string, extra: string[]): Promise<Row[]> {
  const c = capture();
  expect(await withoutNetwork(["--root", root, ...LEXICAL, ...extra], c)).toBe(0);
  const { results } = JSON.parse(c.out.join("\n")) as { results: Row[] };
  return results.map(({ skill, score, why }) => ({ skill, score, why }));
}

test("bpe with no trained model answers the ASCII list, as one notice", async () => {
  const root = vaultWithBpe(false);
  const c = capture();

  expect(await withoutNetwork(["--root", root, ...LEXICAL], c)).toBe(0);
  const ids = (JSON.parse(c.out.join("\n")) as { results: { skill: string }[] }).results.map((r) => r.skill);
  expect(ids).toEqual((await jsonRun(root, ["--no-bpe"])).map((r) => r.skill));
  expect(c.err).toHaveLength(1);
  expect(c.err[0]).toContain("bpe augmentation unavailable");
}, 20_000);

test("bpe appends after the ASCII list and never reorders or drops it", async () => {
  const root = vaultWithBpe(true);
  const ascii = await jsonRun(root, ["--no-bpe"]);
  const withBpe = await jsonRun(root, []);

  expect(ascii.length).toBeGreaterThan(0);
  expect(withBpe.slice(0, ascii.length)).toEqual(ascii);
  const extras = withBpe.slice(ascii.length);
  expect(extras.length).toBeGreaterThan(0);
  expect(extras.length).toBeLessThanOrEqual(3);
  for (const e of extras) {
    expect(e.why).toBe("matched word pieces of the query (bpe)");
    expect(ascii.map((r) => r.skill)).not.toContain(e.skill);
  }
}, 20_000);
