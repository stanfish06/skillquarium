import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
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

function root(): string {
  const r = mkdtempSync(join(tmpdir(), "sq-cfg-"));
  mkdirSync(join(r, ".skill-vault"));
  return r;
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

  test("defaults apply when no files exist", async () => {
    const c = await loadConfig(root());
    expect(c.embed.url).toBe("http://127.0.0.1:8080");
    expect(c.query.rrfK).toBe(60);
    expect(c.skillsCliVersion).toBe("1.5.23");
  });

  test("local file overrides committed file, env overrides both", async () => {
    const r = root();
    writeFileSync(join(r, ".skill-vault/config.json"), JSON.stringify({ embed: { url: "http://a" } }));
    writeFileSync(join(r, ".skill-vault/config.local.json"), JSON.stringify({ embed: { url: "http://b" } }));
    expect((await loadConfig(r)).embed.url).toBe("http://b");
    process.env.SKILLQUARIUM_EMBED_URL = "http://c";
    expect((await loadConfig(r)).embed.url).toBe("http://c");
  });

  test("invalid value reports the path", async () => {
    const r = root();
    writeFileSync(join(r, ".skill-vault/config.json"), JSON.stringify({ query: { k: "eight" } }));
    await expect(loadConfig(r)).rejects.toThrow(/query\.k/);
  });
});
