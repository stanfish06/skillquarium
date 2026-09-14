import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Context } from "../../src/cli";
import type { Config } from "../../src/config";
import { installCareerOps } from "../../src/install/careerOps";
import { help, run } from "../../src/install/command";
import { type Io, makeRunner } from "../../src/install/run";

// Fake npx/node on PATH log their argv to $COMMAND_LOG, the technique the shell tests used.
const NPX_STUB = [
  "#!/usr/bin/env bash",
  "{ printf 'npx'; printf ' %s' \"$@\"; printf '\\n'; } >> \"$COMMAND_LOG\"",
  "",
].join("\n");

const NODE_STUB = [
  "#!/usr/bin/env bash",
  "{ printf 'node'; printf ' %s' \"$@\"; printf '\\n'; } >> \"$COMMAND_LOG\"",
  'if [ "$2" = "check" ]; then',
  '  if [ -n "${FAKE_CHECK_OUTPUT+x}" ]; then',
  "    printf '%s\\n' \"$FAKE_CHECK_OUTPUT\"",
  "  else",
  '    printf \'{"status":"%s"}\\n\' "${FAKE_UPDATE_STATUS:-up-to-date}"',
  "  fi",
  '  exit "${FAKE_CHECK_STATUS:-0}"',
  "fi",
  'if [ "$2" = "apply" ]; then',
  "  printf 'new system one\\nnew system two\\n' > \"$CAREER_OPS_DIR/CLAUDE.md\"",
  '  exit "${FAKE_APPLY_STATUS:-0}"',
  "fi",
  "exit 64",
  "",
].join("\n");

const ENV_KEYS = [
  "HOME",
  "PATH",
  "COMMAND_LOG",
  "CAREER_OPS_DIR",
  "CAREER_OPS_SKIP",
  "CAREER_OPS_AUTO_UPDATE",
  "FAKE_UPDATE_STATUS",
  "FAKE_CHECK_OUTPUT",
  "FAKE_CHECK_STATUS",
  "FAKE_APPLY_STATUS",
];

let sandbox = "";
let workspace = "";
let logPath = "";
let saved: Record<string, string | undefined> = {};
let out: string[] = [];
let err: string[] = [];
let io: Io;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  sandbox = mkdtempSync(join(tmpdir(), "sq-career-"));
  const home = join(sandbox, "home");
  const bin = join(sandbox, "bin");
  mkdirSync(home);
  mkdirSync(bin);
  writeFileSync(join(bin, "npx"), NPX_STUB, { mode: 0o755 });
  writeFileSync(join(bin, "node"), NODE_STUB, { mode: 0o755 });
  workspace = join(home, "career-ops");
  logPath = join(sandbox, "commands.log");
  process.env.HOME = home;
  process.env.PATH = `${bin}:${process.env.PATH ?? ""}`;
  process.env.COMMAND_LOG = logPath;
  process.env.CAREER_OPS_DIR = workspace;
  out = [];
  err = [];
  io = { out: (l) => out.push(l), err: (l) => err.push(l) };
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(sandbox, { recursive: true, force: true });
});

function makeWorkspace(claudeContents?: string): void {
  mkdirSync(join(workspace, ".git"), { recursive: true });
  writeFileSync(join(workspace, "update-system.mjs"), "// test updater\n");
  if (claudeContents !== undefined) writeFileSync(join(workspace, "CLAUDE.md"), claudeContents);
}

function commandLog(): string[] {
  if (!existsSync(logPath)) return [];
  const text = readFileSync(logPath, "utf8");
  return text === "" ? [] : text.trimEnd().split("\n");
}

function claudeMd(): string {
  return readFileSync(join(workspace, "CLAUDE.md"), "utf8");
}

function install(): Promise<number> {
  return installCareerOps(io, makeRunner(io));
}

describe("career-ops installer", () => {
  test("bootstraps a missing workspace with the pinned scaffolder", async () => {
    expect(await install()).toBe(0);
    expect(commandLog()).toEqual([`npx -y @santifer/career-ops@1.18.0 init ${workspace}`]);
  });

  test("skip avoids all work", async () => {
    process.env.CAREER_OPS_SKIP = "1";
    expect(await install()).toBe(0);
    expect(commandLog()).toEqual([]);
    expect(out.join("\n")).toContain("skipped");
  });

  test("freeze leaves an existing workspace untouched", async () => {
    makeWorkspace();
    process.env.CAREER_OPS_AUTO_UPDATE = "0";
    expect(await install()).toBe(0);
    expect(commandLog()).toEqual([]);
    expect(out.join("\n")).toContain("frozen");
  });

  test("rejects an existing non-workspace directory", async () => {
    mkdirSync(workspace, { recursive: true });
    expect(await install()).not.toBe(0);
    expect(err.join("\n")).toContain("not a valid Career Ops workspace");
  });

  test("up-to-date does not apply", async () => {
    makeWorkspace();
    process.env.FAKE_UPDATE_STATUS = "up-to-date";
    expect(await install()).toBe(0);
    expect(commandLog()).toEqual(["node update-system.mjs check"]);
    expect(out.join("\n")).toContain("up to date");
  });

  test("offline status warns and succeeds", async () => {
    makeWorkspace();
    process.env.FAKE_UPDATE_STATUS = "offline";
    expect(await install()).toBe(0);
    expect(err.join("\n")).toContain("offline");
    expect(commandLog()).toEqual(["node update-system.mjs check"]);
  });

  test("no-remote-version warns and succeeds", async () => {
    makeWorkspace();
    process.env.FAKE_UPDATE_STATUS = "no-remote-version";
    expect(await install()).toBe(0);
    expect(err.join("\n")).toContain("no-remote-version");
    expect(commandLog()).toEqual(["node update-system.mjs check"]);
  });

  test("an available update applies once and preserves local instructions", async () => {
    makeWorkspace("system one\nsystem two\nlocal instruction\n");
    process.env.FAKE_UPDATE_STATUS = "update-available";
    expect(await install()).toBe(0);
    expect(commandLog()).toEqual(["node update-system.mjs check", "node update-system.mjs apply"]);
    expect(claudeMd()).toBe("new system one\nnew system two\nlocal instruction\n");
  });

  test("a failed apply restores local instructions and fails", async () => {
    makeWorkspace("system one\nsystem two\nlocal instruction\n");
    process.env.FAKE_UPDATE_STATUS = "update-available";
    process.env.FAKE_APPLY_STATUS = "23";
    expect(await install()).toBe(23);
    expect(claudeMd()).toBe("new system one\nnew system two\nlocal instruction\n");
    expect(err.join("\n")).toContain("update failed");
  });

  test("repeated updates do not duplicate local instructions", async () => {
    makeWorkspace("system one\nsystem two\nlocal instruction\n");
    process.env.FAKE_UPDATE_STATUS = "update-available";
    expect(await install()).toBe(0);
    expect(await install()).toBe(0);
    expect(claudeMd()).toBe("new system one\nnew system two\nlocal instruction\n");
  });

  test("an update without a local tail keeps the new template", async () => {
    makeWorkspace("system one\nsystem two\n");
    process.env.FAKE_UPDATE_STATUS = "update-available";
    expect(await install()).toBe(0);
    expect(claudeMd()).toBe("new system one\nnew system two\n");
  });

  test("auto update removes the dismissed marker", async () => {
    makeWorkspace();
    const dismissed = join(workspace, ".update-dismissed");
    writeFileSync(dismissed, "career-ops-v1.19.0\n");
    process.env.FAKE_UPDATE_STATUS = "up-to-date";
    expect(await install()).toBe(0);
    expect(existsSync(dismissed)).toBe(false);
  });

  test("an unknown status fails", async () => {
    makeWorkspace();
    process.env.FAKE_UPDATE_STATUS = "unexpected";
    expect(await install()).not.toBe(0);
    expect(err.join("\n")).toContain("unknown career-ops update status");
  });

  test("a malformed status fails", async () => {
    makeWorkspace();
    process.env.FAKE_CHECK_OUTPUT = "{";
    expect(await install()).not.toBe(0);
    expect(err.join("\n")).toContain("malformed update status");
  });

  test("a failed check fails", async () => {
    makeWorkspace();
    process.env.FAKE_CHECK_STATUS = "9";
    expect(await install()).not.toBe(0);
    expect(err.join("\n")).toContain("update check failed");
  });
});

const config: Config = {
  skillsCliVersion: "1.5.23",
  claudeSkillsDir: "/nonexistent",
  embed: { url: "http://127.0.0.1:1", model: null, batchSize: 16, timeoutMs: 100, retries: 0 },
  query: { k: 8, rrfK: 60, weights: { lexical: 1, fuzzy: 1, semantic: 1 } },
};

function context(): Context {
  return { root: sandbox, json: false, out: io.out, err: io.err, config: async () => config };
}

describe("install command arguments", () => {
  test("--help names every extra and alias", async () => {
    expect(await run(["--help"], context())).toBe(0);
    const text = out.join("\n");
    for (const token of ["--extras", "gstack", "career", "ui-ux", "ui-ux-pro-max", "uipro"]) {
      expect(text).toContain(token);
    }
    expect(help).toContain("--dry-run");
  });

  test("an unknown extra exits 1", async () => {
    expect(await run(["--extras", "not-a-real-extra"], context())).toBe(1);
    expect(err.join("\n")).toContain("unknown extra");
  });
});
