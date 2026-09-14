import { afterAll, expect, test } from "bun:test";
import { join } from "node:path";
import { type ContextOverrides, main } from "../../src/cli";
import { sha256File, writeManifest, writeSkill } from "../../src/embed/store";
import { writeGraph } from "../../src/kg/write";
import { FAKE_DIM, fakeVector } from "../embed/fakeClient";
import { buildFixtureGraph, write } from "../kg/fixtureVault";

const SKILLS = ["alpha", "beta", "gamma", "workflow"];
const cleanups: Array<() => void> = [];
afterAll(() => {
  for (const c of cleanups) c();
});

function capture(): { out: string[]; err: string[]; overrides: ContextOverrides } {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, overrides: { out: (l) => out.push(l), err: (l) => err.push(l) } };
}

/**
 * The kg fixture vault with a graph and an embedding index on disk, and an embed endpoint pointed
 * at a closed port so the semantic signal's first request is refused rather than timing out.
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
    skills: Object.fromEntries(
      SKILLS.map((id) => [
        id,
        { sha256: sha256File(join(fixture.root, "skills", id, "SKILL.md")), updated: "2026-01-01" },
      ]),
    ),
  });
  write(
    join(fixture.root, ".skill-vault/config.json"),
    JSON.stringify({ embed: { url: "http://127.0.0.1:1", retries: 0, timeoutMs: 500 } }),
  );
  return fixture.root;
}

test("query exits 0 with results and a notice when the embedding endpoint is unreachable", async () => {
  const root = vaultWithDeadEndpoint();
  const c = capture();

  expect(await main(["--root", root, "query", "fastq reads", "--k", "3", "--no-fuzzy"], c.overrides)).toBe(0);
  expect(c.out.some((l) => l.includes("alpha"))).toBe(true);
  const notice = c.err.find((l) => l.startsWith("semantic search unavailable:"));
  expect(notice).toBeDefined();
  expect(notice).toContain("http://127.0.0.1:1/v1/embeddings");
}, 20_000);
