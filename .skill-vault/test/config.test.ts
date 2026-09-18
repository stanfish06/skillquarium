import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/config";

// Env vars the loader reads; saved and cleared per test so the invoking shell cannot leak in.
const ENV_KEYS = [
  "SKILLQUARIUM_EMBED_URL",
  "SKILLQUARIUM_EMBED_MODEL",
  "CLAUDE_SKILLS_DIR",
  "SKILLS_CLI_VERSION",
];
const saved: Record<string, string | undefined> = {};
const roots: string[] = [];

function root(): string {
  const r = mkdtempSync(join(tmpdir(), "sq-cfg-"));
  mkdirSync(join(r, ".skill-vault"));
  roots.push(r);
  return r;
}

function writeCommitted(r: string, body: string): string {
  const p = join(r, ".skill-vault/config.json");
  writeFileSync(p, body);
  return p;
}

function writeLocal(r: string, body: string): string {
  const p = join(r, ".skill-vault/config.local.json");
  writeFileSync(p, body);
  return p;
}

describe("config", () => {
  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      const v = saved[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
  afterAll(() => {
    for (const r of roots) rmSync(r, { recursive: true, force: true });
  });

  test("defaults apply when no files exist", async () => {
    const c = await loadConfig(root());
    expect(c.embed.url).toBe("http://127.0.0.1:8080");
    expect(c.embed.model).toBeNull();
    expect(c.query.rrfK).toBe(60);
    expect(c.query.bpeExtra).toBe(3);
    expect(c.tokenizer).toEqual({ bin: "skill-tokenizer", vocabSize: 4000 });
    expect(c.skillsCliVersion).toBe("1.5.23");
  });

  test("bpeExtra is a count, and 0 turns BPE off", async () => {
    const r = root();
    writeCommitted(r, JSON.stringify({ query: { bpeExtra: 0 } }));
    expect((await loadConfig(r)).query.bpeExtra).toBe(0);
    writeCommitted(r, JSON.stringify({ query: { bpeExtra: -1 } }));
    await expect(loadConfig(r)).rejects.toThrow(/^config: query\.bpeExtra: /);
    writeCommitted(r, JSON.stringify({ query: { tokenizer: "bpe" } }));
    await expect(loadConfig(r)).rejects.toThrow(/^config: query: /);
  });

  test("local file overrides committed file per key, env overrides both", async () => {
    const r = root();
    writeCommitted(r, JSON.stringify({ embed: { url: "http://a", model: "m" } }));
    writeLocal(r, JSON.stringify({ embed: { url: "http://b" } }));
    const local = await loadConfig(r);
    expect(local.embed.url).toBe("http://b");
    expect(local.embed.model).toBe("m");
    process.env.SKILLQUARIUM_EMBED_URL = "http://c";
    const env = await loadConfig(r);
    expect(env.embed.url).toBe("http://c");
    expect(env.embed.model).toBe("m");
  });

  test("invalid value reports the path", async () => {
    const r = root();
    writeCommitted(r, JSON.stringify({ query: { k: "eight" } }));
    await expect(loadConfig(r)).rejects.toThrow(/^config: query\.k: /);
  });

  test("malformed JSON names the file", async () => {
    const r = root();
    const p = writeCommitted(r, "{ embed: ");
    await expect(loadConfig(r)).rejects.toThrow(new RegExp(`^config: ${p}: `));
  });

  test("non-object JSON names the file", async () => {
    const r = root();
    const p = writeLocal(r, "[1, 2]");
    await expect(loadConfig(r)).rejects.toThrow(`config: ${p}: expected a JSON object`);
  });

  test("unknown key is rejected", async () => {
    const r = root();
    writeCommitted(r, JSON.stringify({ embed: { urll: "http://a" } }));
    await expect(loadConfig(r)).rejects.toThrow(/^config: embed: /);
  });

  test("embed.url must be http(s)", async () => {
    const r = root();
    writeCommitted(r, JSON.stringify({ embed: { url: "localhost:8080" } }));
    await expect(loadConfig(r)).rejects.toThrow(/^config: embed\.url: /);
  });

  test("every issue is reported", async () => {
    const r = root();
    writeCommitted(r, JSON.stringify({ query: { k: 0, rrfK: -1 } }));
    await expect(loadConfig(r)).rejects.toThrow(/^config: query\.k: .*; query\.rrfK: /);
  });
});
