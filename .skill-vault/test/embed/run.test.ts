import { afterAll, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Config } from "../../src/config";
import { llamaCppClient } from "../../src/embed/client";
import { FULL_FILE_HASH_VERSION, HASH_VERSION } from "../../src/embed/hash";
import { embedVault, MAX_BATCH_CHARS, MAX_CHARS } from "../../src/embed/run";
import { EMBED_DIR, readIndex, readManifest, writeManifest } from "../../src/embed/store";
import { setSkillEnabled } from "../../src/toggle/edit";
import { loadSkill } from "../../src/toggle/state";
import { FAKE_DIM, fakeClient, fakeVector } from "./fakeClient";

const tmpDirs: string[] = [];
function tmp(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  tmpDirs.push(d);
  return d;
}
afterAll(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

function skill(root: string, id: string, body = "body"): string {
  const dir = join(root, "skills", id);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "SKILL.md");
  writeFileSync(file, `---\nname: ${id}\ndescription: ${id} does things\n---\n${body}\n`);
  return file;
}

function vault(): string {
  const root = tmp("sq-run-");
  skill(root, "a");
  skill(root, "b");
  skill(root, "c");
  return root;
}

const today = () => "2026-01-01";

// Unroutable on purpose: these clients only ever see the stub fetch below.
const endpoint: Config["embed"] = {
  url: "http://offline.invalid",
  model: null,
  batchSize: 16,
  timeoutMs: 500,
  retries: 0,
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
}

/**
 * A second model behind the same endpoint: every vector it returns differs from fakeClient's, so a
 * row that reached the index is visible byte for byte. Post number `failAt` answers 502.
 */
function v2Client(failAt = 0) {
  let posts = 0;
  return llamaCppClient(endpoint, async (url, init) => {
    if (url.endsWith("/v1/models")) return jsonResponse({ data: [{ id: "fake-embed-v2" }] });
    posts++;
    if (posts === failAt) return new Response("upstream connect error", { status: 502 });
    const inputs = (JSON.parse(String(init?.body)) as { input: string[] }).input;
    return jsonResponse({
      data: inputs.map((t, index) => ({ index, embedding: Array.from(fakeVector(`v2:${t}`)) })),
    });
  });
}

describe("embedVault", () => {
  test("first run embeds every skill, second run embeds none", async () => {
    const root = vault();
    const client = fakeClient();
    const log: string[] = [];
    const r1 = await embedVault(root, client, { batchSize: 16, log: (l) => log.push(l), today });
    expect(r1).toEqual({
      embedded: 3,
      removed: 0,
      stale: ["a", "b", "c"],
      migrated: 0,
      unproven: 0,
      model: "fake-embed",
      dim: FAKE_DIM,
    });
    expect(readdirSync(join(root, EMBED_DIR)).sort()).toEqual(["a.f16", "b.f16", "c.f16", "manifest.json"]);
    expect(log).toEqual(["embedded 3/3"]);
    const m = readManifest(root);
    expect(m?.model).toBe("fake-embed");
    expect(m?.dim).toBe(FAKE_DIM);
    expect(Object.keys(m?.skills ?? {})).toEqual(["a", "b", "c"]);
    expect(m?.skills.a?.updated).toBe("2026-01-01");
    expect(m?.skills.a?.truncated).toBeUndefined();

    const r2 = await embedVault(root, client, { batchSize: 16, today });
    expect(r2.embedded).toBe(0);
    expect(r2.stale).toEqual([]);
    expect(client.calls).toHaveLength(1);
  });

  test("editing one SKILL.md re-embeds only that skill", async () => {
    const root = vault();
    const client = fakeClient();
    await embedVault(root, client, { batchSize: 16, today });
    skill(root, "b", "changed body");
    const r = await embedVault(root, client, { batchSize: 16, today: () => "2026-02-02" });
    expect(r.embedded).toBe(1);
    expect(r.stale).toEqual(["b"]);
    expect(client.calls[1]).toEqual([
      "b: b does things",
      `---\nname: b\ndescription: b does things\n---\nchanged body\n`,
    ]);
    const m = readManifest(root);
    expect(m?.skills.b?.updated).toBe("2026-02-02");
    expect(m?.skills.a?.updated).toBe("2026-01-01");
  });

  test("a lost row file is re-embedded, and --check reports it instead of clean", async () => {
    const root = vault();
    const client = fakeClient();
    await embedVault(root, client, { batchSize: 16, today });
    rmSync(join(root, EMBED_DIR, "b.f16"));

    // Nothing touched b's SKILL.md, so its manifest hash still matches: only the row-file check
    // sees that b has dropped out of the index.
    const checked = await embedVault(root, client, { batchSize: 16, check: true, today });
    expect(checked.stale).toEqual(["b"]);

    const r = await embedVault(root, client, { batchSize: 16, today: () => "2026-02-02" });
    expect(r.embedded).toBe(1);
    expect(r.stale).toEqual(["b"]);
    expect(client.calls[1]).toEqual([
      "b: b does things",
      "---\nname: b\ndescription: b does things\n---\nbody\n",
    ]);
    expect(existsSync(join(root, EMBED_DIR, "b.f16"))).toBe(true);
    expect(readIndex(root)?.ids).toEqual(["a", "b", "c"]);
    // The untouched skills keep their original entries: only b was re-embedded.
    const m = readManifest(root);
    expect(m?.skills.b?.updated).toBe("2026-02-02");
    expect(m?.skills.a?.updated).toBe("2026-01-01");
  });

  test("deleting a skill removes its row file and manifest entry", async () => {
    const root = vault();
    const client = fakeClient();
    await embedVault(root, client, { batchSize: 16, today });
    rmSync(join(root, "skills", "c"), { recursive: true });
    const r = await embedVault(root, client, { batchSize: 16, today });
    expect(r).toMatchObject({ embedded: 0, removed: 1 });
    expect(existsSync(join(root, EMBED_DIR, "c.f16"))).toBe(false);
    expect(Object.keys(readManifest(root)?.skills ?? {})).toEqual(["a", "b"]);
    expect(readIndex(root)?.ids).toEqual(["a", "b"]);
  });

  test("a different manifest model forces every skill", async () => {
    const root = vault();
    const client = fakeClient();
    await embedVault(root, client, { batchSize: 16, today });
    const m = readManifest(root);
    if (!m) throw new Error("manifest missing");
    writeManifest(root, { ...m, model: "old-model" });
    const r = await embedVault(root, client, { batchSize: 16, today });
    expect(r.embedded).toBe(3);
    expect(readManifest(root)?.model).toBe("fake-embed");
  });

  test("force re-embeds everything", async () => {
    const root = vault();
    const client = fakeClient();
    await embedVault(root, client, { batchSize: 16, today });
    const r = await embedVault(root, client, { batchSize: 16, force: true, today });
    expect(r.embedded).toBe(3);
  });

  test("check mode contacts no endpoint and lists stale and removed ids", async () => {
    const root = vault();
    const r0 = await embedVault(root, fakeClient({ fail: true }), { batchSize: 16, check: true, today });
    expect(r0).toEqual({
      embedded: 0,
      removed: 0,
      stale: ["a", "b", "c"],
      migrated: 0,
      unproven: 0,
      model: "",
      dim: 0,
    });

    await embedVault(root, fakeClient(), { batchSize: 16, today });
    const r1 = await embedVault(root, fakeClient({ fail: true }), { batchSize: 16, check: true, today });
    expect(r1).toEqual({
      embedded: 0,
      removed: 0,
      stale: [],
      migrated: 0,
      unproven: 0,
      model: "fake-embed",
      dim: FAKE_DIM,
    });

    skill(root, "a", "edited");
    rmSync(join(root, "skills", "c"), { recursive: true });
    const r2 = await embedVault(root, fakeClient({ fail: true }), { batchSize: 16, check: true, today });
    expect(r2.stale).toEqual(["a", "c"]);
    expect(r2.removed).toBe(1);
    expect(existsSync(join(root, EMBED_DIR, "c.f16"))).toBe(true);
  });

  test("batches hold floor(batchSize/2) skills with both inputs of a skill together", async () => {
    const root = vault();
    skill(root, "d");
    skill(root, "e");
    const client = fakeClient();
    const log: string[] = [];
    const r = await embedVault(root, client, { batchSize: 5, log: (l) => log.push(l), today });
    expect(r.embedded).toBe(5);
    expect(client.calls.map((c) => c.length)).toEqual([4, 4, 2]);
    expect(client.calls.map((c) => c.filter((s) => !s.startsWith("---")).join(","))).toEqual([
      "a: a does things,b: b does things",
      "c: c does things,d: d does things",
      "e: e does things",
    ]);
    expect(log).toEqual(["embedded 2/5", "embedded 4/5", "embedded 5/5"]);
  });

  test("batchSize 1 still sends both inputs of one skill together", async () => {
    const root = vault();
    const client = fakeClient();
    await embedVault(root, client, { batchSize: 1, today });
    expect(client.calls.map((c) => c.length)).toEqual([2, 2, 2]);
  });

  test("bodies over the character cap are truncated and flagged", async () => {
    const root = vault();
    skill(root, "big", "x".repeat(MAX_CHARS + 10_000));
    const client = fakeClient();
    await embedVault(root, client, { batchSize: 16, today });
    // The body follows its own description in the same request, cut to the cap.
    const call = client.calls.find((c) => c.includes("big: big does things"));
    const at = call?.indexOf("big: big does things") ?? -1;
    expect(call?.[at + 1]?.length).toBe(MAX_CHARS);
    expect(readManifest(root)?.skills.big?.truncated).toBe(true);
    expect(readManifest(root)?.skills.a?.truncated).toBeUndefined();
  });

  test("a batch closes on the character budget before the input count", async () => {
    const root = tmp("sq-run-");
    // Three skills just over a third of the budget each: two fit in one request, the third starts
    // the next, even though batchSize alone would allow all six inputs in one.
    for (const id of ["a", "b", "c"]) skill(root, id, "x".repeat(Math.floor(MAX_BATCH_CHARS / 2) - 200));
    const client = fakeClient();
    await embedVault(root, client, { batchSize: 16, today });
    expect(client.calls.map((c) => c.length)).toEqual([4, 2]);
    const chars = client.calls.map((c) => c.reduce((n, s) => n + s.length, 0));
    expect(chars.every((n) => n <= MAX_BATCH_CHARS)).toBe(true);
  });

  test("a dim change without force or model change is an error", async () => {
    const root = vault();
    await embedVault(root, fakeClient(), { batchSize: 16, today });
    const m = readManifest(root);
    if (!m) throw new Error("manifest missing");
    writeManifest(root, { ...m, dim: 4 });
    skill(root, "a", "edited");
    await expect(embedVault(root, fakeClient(), { batchSize: 16, today })).rejects.toThrow(
      "dim changed from 4 to 8; rerun with --force",
    );
    await embedVault(root, fakeClient(), { batchSize: 16, force: true, today });
    expect(readManifest(root)?.dim).toBe(FAKE_DIM);
  });

  test("an endpoint that is down fails the run and leaves no index behind", async () => {
    const root = vault();
    const client = llamaCppClient(
      endpoint,
      async () => new Response("upstream connect error", { status: 502 }),
    );
    await expect(embedVault(root, client, { batchSize: 16, today })).rejects.toThrow(
      "HTTP 502: upstream connect error",
    );
    expect(existsSync(join(root, EMBED_DIR))).toBe(false);
  });

  test("a 502 on the second batch leaves the previous manifest untouched", async () => {
    const root = vault();
    await embedVault(root, fakeClient(), { batchSize: 16, today });
    const before = readFileSync(join(root, EMBED_DIR, "manifest.json"), "utf8");
    for (const id of ["a", "b", "c"]) skill(root, id, "edited");

    let posts = 0;
    const client = llamaCppClient(endpoint, async (url, init) => {
      if (url.endsWith("/v1/models")) return jsonResponse({ data: [{ id: "fake-embed" }] });
      posts++;
      if (posts === 2) return new Response("upstream connect error", { status: 502 });
      const inputs = (JSON.parse(String(init?.body)) as { input: string[] }).input;
      return jsonResponse({
        data: inputs.map((t, index) => ({ index, embedding: Array.from(fakeVector(t)) })),
      });
    });
    // batchSize 2 is one skill per request: a succeeds, b fails, c never goes out.
    await expect(embedVault(root, client, { batchSize: 2, today: () => "2026-03-03" })).rejects.toThrow(
      /embedding b: http:\/\/offline\.invalid\/v1\/embeddings: HTTP 502/,
    );
    expect(posts).toBe(2);
    expect(readFileSync(join(root, EMBED_DIR, "manifest.json"), "utf8")).toBe(before);

    // The manifest still describes the pre-run state, so every edited skill recomputes as stale.
    const checked = await embedVault(root, fakeClient({ fail: true }), {
      batchSize: 16,
      check: true,
      today,
    });
    expect(checked.stale).toEqual(["a", "b", "c"]);

    const after = await embedVault(root, fakeClient(), { batchSize: 16, today: () => "2026-03-03" });
    expect(after.embedded).toBe(3);
    expect(readdirSync(join(root, EMBED_DIR)).sort()).toEqual(["a.f16", "b.f16", "c.f16", "manifest.json"]);
    expect(readIndex(root)?.stale.size).toBe(0);
  });

  test("a forced refresh that fails partway leaves the committed index whole", async () => {
    const root = vault();
    await embedVault(root, fakeClient(), { batchSize: 16, today });
    const rows = new Map(
      ["a", "b", "c"].map((id) => [id, readFileSync(join(root, EMBED_DIR, `${id}.f16`))] as const),
    );
    const manifest = readFileSync(join(root, EMBED_DIR, "manifest.json"), "utf8");

    // The endpoint has moved to another model, so every skill is refreshed even though no
    // SKILL.md changed. batchSize 2 is one skill per request: a succeeds, b 502s, c never goes out.
    await expect(embedVault(root, v2Client(2), { batchSize: 2, today: () => "2026-03-03" })).rejects.toThrow(
      /embedding b: .*HTTP 502/,
    );

    // None of the refreshed rows reached the index, and no staging is left behind.
    expect(readdirSync(join(root, EMBED_DIR)).sort()).toEqual(["a.f16", "b.f16", "c.f16", "manifest.json"]);
    for (const [id, bytes] of rows) {
      expect(readFileSync(join(root, EMBED_DIR, `${id}.f16`))).toEqual(bytes);
    }
    expect(readFileSync(join(root, EMBED_DIR, "manifest.json"), "utf8")).toBe(manifest);

    // Index and manifest still describe the same model, so --check is telling the truth here.
    const checked = await embedVault(root, fakeClient({ fail: true }), {
      batchSize: 16,
      check: true,
      today,
    });
    expect(checked.stale).toEqual([]);
    expect(checked.model).toBe("fake-embed");

    // The model change is still pending, so the next run refreshes every skill and every row moves.
    const after = await embedVault(root, v2Client(), { batchSize: 16, today: () => "2026-03-03" });
    expect(after.embedded).toBe(3);
    expect(readManifest(root)?.model).toBe("fake-embed-v2");
    expect(readdirSync(join(root, EMBED_DIR)).sort()).toEqual(["a.f16", "b.f16", "c.f16", "manifest.json"]);
    for (const [id, bytes] of rows) {
      expect(readFileSync(join(root, EMBED_DIR, `${id}.f16`))).not.toEqual(bytes);
    }
    expect(readIndex(root)?.stale.size).toBe(0);
  });

  test("row files left by an interrupted run are dropped by the next one", async () => {
    const root = vault();
    mkdirSync(join(root, EMBED_DIR), { recursive: true });
    writeFileSync(join(root, EMBED_DIR, "zz.f16"), new Uint8Array(2 * FAKE_DIM * 2));
    const log: string[] = [];
    await embedVault(root, fakeClient(), { batchSize: 16, log: (l) => log.push(l), today });
    expect(readdirSync(join(root, EMBED_DIR)).sort()).toEqual(["a.f16", "b.f16", "c.f16", "manifest.json"]);
    expect(log).toContain("dropped unreferenced rows: zz");
  });

  test("toggling a skill invalidates nothing; editing its body still does", async () => {
    const root = vault();
    const client = fakeClient();
    await embedVault(root, client, { batchSize: 16, today });
    setSkillEnabled(loadSkill(join(root, "skills", "b")), false);
    setSkillEnabled(loadSkill(join(root, "skills", "c")), true);

    const check = await embedVault(root, fakeClient({ fail: true }), {
      batchSize: 16,
      check: true,
      today,
    });
    expect(check.stale).toEqual([]);
    const again = await embedVault(root, client, { batchSize: 16, today });
    expect(again.embedded).toBe(0);
    expect(client.calls).toHaveLength(1);

    skill(root, "b", "a genuinely different body");
    const edited = await embedVault(root, client, { batchSize: 16, today });
    expect(edited.stale).toEqual(["b"]);
    // The toggle line never reaches the endpoint, so the body sent is the file without it.
    expect(client.calls[1]?.[1]).toBe(
      "---\nname: b\ndescription: b does things\n---\na genuinely different body\n",
    );
  });

  test("a scheme-1 manifest migrates in place instead of re-embedding", async () => {
    const root = vault();
    const client = fakeClient();
    await embedVault(root, client, { batchSize: 16, today });
    // Nothing is toggled yet, so the recorded digests are already whole-file digests: relabel them.
    const embedded = readManifest(root);
    if (!embedded) throw new Error("no manifest");
    writeManifest(root, { ...embedded, hashVersion: FULL_FILE_HASH_VERSION });
    setSkillEnabled(loadSkill(join(root, "skills", "a")), false);
    skill(root, "c", "rewritten");

    const log: string[] = [];
    const check = await embedVault(root, fakeClient({ fail: true }), {
      batchSize: 16,
      check: true,
      log: (l) => log.push(l),
      today,
    });
    expect(check).toMatchObject({ stale: ["c"], migrated: 2, unproven: 1 });
    expect(log).toEqual([`hash scheme ${HASH_VERSION}: migrated 2 manifest entries, 1 left stale`]);
    // check writes nothing: the manifest on disk is still the old scheme.
    expect(readManifest(root)?.hashVersion).toBe(FULL_FILE_HASH_VERSION);

    const run = await embedVault(root, client, { batchSize: 16, today: () => "2026-02-02" });
    expect(run).toMatchObject({ embedded: 1, stale: ["c"], migrated: 2, unproven: 1 });
    const after = readManifest(root);
    expect(after?.hashVersion).toBe(HASH_VERSION);
    expect(after?.skills.a?.updated).toBe("2026-01-01");
    expect(after?.skills.c?.updated).toBe("2026-02-02");
    expect(await embedVault(root, client, { batchSize: 16, today })).toMatchObject({ stale: [] });
  });

  test("a failing batch names the skills in it", async () => {
    const root = vault();
    const client = fakeClient();
    client.embed = async () => {
      throw new Error("HTTP 500: n_tokens exceeds context");
    };
    await expect(embedVault(root, client, { batchSize: 4, today })).rejects.toThrow(/a, b.*HTTP 500/);
    expect(existsSync(join(root, EMBED_DIR, "manifest.json"))).toBe(false);
  });
});
