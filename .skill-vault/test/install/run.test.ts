import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Context } from "../../src/cli";
import type { Config } from "../../src/config";
import { installVault, parseInstallArgs } from "../../src/install/run";

// Stands in for the skills CLI: it rewrites vault files and leaves generated roots behind,
// which is exactly what the selective restore has to undo.
const NPX_STUB = [
  "#!/usr/bin/env bash",
  "{ printf 'npx'; printf ' %s' \"$@\"; printf '\\n'; } >> \"$COMMAND_LOG\"",
  '[ -e "$FAKE_VAULT/skills/gstack" ] && printf \'gstack-present\\n\' >> "$COMMAND_LOG"',
  "printf 'rewritten by the CLI\\n' >> \"$FAKE_VAULT/skills/clean/SKILL.md\"",
  "printf 'rewritten by the CLI\\n' >> \"$FAKE_VAULT/skills/dirty/SKILL.md\"",
  "printf 'generated\\n' > \"$FAKE_VAULT/untracked-after.txt\"",
  '[ -n "$STUB_DELETES" ] && rm -f "$FAKE_VAULT/$STUB_DELETES"',
  'mkdir -p "$FAKE_VAULT/.agents/skills" "$FAKE_VAULT/skills/.pi"',
  "printf 'link root\\n' > \"$FAKE_VAULT/.agents/skills/x\"",
  "printf 'link root\\n' > \"$FAKE_VAULT/skills/.pi/x\"",
  "exit 0",
  "",
].join("\n");

const ENV_KEYS = ["HOME", "PATH", "COMMAND_LOG", "FAKE_VAULT", "STUB_DELETES"];

let sandbox = "";
let root = "";
let claudeDir = "";
let logPath = "";
let saved: Record<string, string | undefined> = {};
let out: string[] = [];
let err: string[] = [];

function git(...args: string[]): void {
  const proc = Bun.spawnSync(["git", "-C", root, ...args], { stdout: "pipe", stderr: "pipe" });
  if (proc.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${proc.stderr.toString()}`);
}

function skill(name: string, body: string): void {
  mkdirSync(join(root, "skills", name), { recursive: true });
  writeFileSync(join(root, "skills", name, "SKILL.md"), body);
}

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  sandbox = realpathSync(mkdtempSync(join(tmpdir(), "sq-install-")));
  root = join(sandbox, "vault");
  claudeDir = join(sandbox, "claude-skills");
  logPath = join(sandbox, "commands.log");
  const bin = join(sandbox, "bin");
  mkdirSync(root);
  mkdirSync(bin);
  writeFileSync(join(bin, "npx"), NPX_STUB, { mode: 0o755 });

  skill("clean", "---\nname: clean\n---\nbase\n");
  skill("dirty", "---\nname: dirty\n---\nbase\n");
  git("init", "-q");
  git("add", "-A");
  git(
    "-c",
    "user.email=t@example.com",
    "-c",
    "user.name=T",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-qm",
    "fixture",
  );

  // One tracked file edited before the run and one untracked file that predates it.
  writeFileSync(join(root, "skills", "dirty", "SKILL.md"), "---\nname: dirty\n---\nbase\nlocal edit\n");
  writeFileSync(join(root, "untracked-before.txt"), "mine\n");

  process.env.HOME = join(sandbox, "home");
  process.env.PATH = `${bin}:${process.env.PATH ?? ""}`;
  process.env.COMMAND_LOG = logPath;
  process.env.FAKE_VAULT = root;
  delete process.env.STUB_DELETES;
  out = [];
  err = [];
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(sandbox, { recursive: true, force: true });
});

function context(): Context {
  const config: Config = {
    skillsCliVersion: "1.5.23",
    claudeSkillsDir: claudeDir,
    embed: { url: "http://127.0.0.1:1", model: null, batchSize: 16, timeoutMs: 100, retries: 0 },
    tokenizer: { bin: "skill-tokenizer", vocabSize: 4000 },
    query: { k: 8, rrfK: 60, bpeExtra: 3, weights: { lexical: 1, fuzzy: 1 } },
  };
  return {
    root,
    json: false,
    out: (l) => out.push(l),
    err: (l) => err.push(l),
    config: async () => config,
  };
}

function install(dryRun = false): Promise<number> {
  return installVault(context(), {
    extras: { gstack: false, career: false, uiUx: false },
    dryRun,
  });
}

function commandLog(): string[] {
  if (!existsSync(logPath)) return [];
  const text = readFileSync(logPath, "utf8");
  return text === "" ? [] : text.trimEnd().split("\n");
}

function read(...parts: string[]): string {
  return readFileSync(join(root, ...parts), "utf8");
}

describe("install run", () => {
  test("selective restore reverts what the CLI changed and keeps pre-existing edits", async () => {
    expect(await install()).toBe(0);
    expect(commandLog()).toEqual(["npx -y skills@1.5.23 add . -s * -g"]);

    // Clean before the run: the CLI's rewrite is undone.
    expect(read("skills", "clean", "SKILL.md")).toBe("---\nname: clean\n---\nbase\n");
    // Dirty before the run and rewritten by the CLI: back to the exact pre-install bytes, with
    // nothing the CLI appended left on top of the local edit.
    expect(read("skills", "dirty", "SKILL.md")).toBe("---\nname: dirty\n---\nbase\nlocal edit\n");
    // Untracked after the run only: removed. Untracked before it: kept.
    expect(existsSync(join(root, "untracked-after.txt"))).toBe(false);
    expect(read("untracked-before.txt")).toBe("mine\n");
    expect(out).toContain(
      "vault: 1 file(s) reverted, 3 generated file(s) removed, 1 pre-existing edit(s) restored",
    );
  });

  test("a dirty file the CLI deletes comes back byte for byte", async () => {
    process.env.STUB_DELETES = "untracked-before.txt";
    expect(await install()).toBe(0);
    expect(read("untracked-before.txt")).toBe("mine\n");
  });

  test("a path the user deleted stays deleted when the CLI recreates it", async () => {
    // " D" in git status: the snapshot has no bytes to put back, so restoring means deleting again.
    rmSync(join(root, "skills", "dirty", "SKILL.md"));
    expect(await install()).toBe(0);
    expect(existsSync(join(root, "skills", "dirty", "SKILL.md"))).toBe(false);
  });

  test.skipIf(process.getuid?.() === 0)(
    "a restore git cannot apply fails the install and names the path",
    async () => {
      // Read-only directory: the CLI can still append to the file inside it, but git checkout
      // has to unlink and recreate, which it cannot.
      chmodSync(join(root, "skills", "clean"), 0o500);
      try {
        expect(await install()).toBe(1);
        expect(err.join("\n")).toContain("could not restore 1 path(s)");
        expect(err.join("\n")).toContain("skills/clean/SKILL.md");
        // The rewrite is still there: the failure is reported rather than papered over.
        expect(read("skills", "clean", "SKILL.md")).toContain("rewritten by the CLI");
      } finally {
        chmodSync(join(root, "skills", "clean"), 0o700);
      }
    },
  );

  test("removes the link roots the CLI creates inside the vault", async () => {
    expect(await install()).toBe(0);
    expect(existsSync(join(root, ".agents"))).toBe(false);
    expect(existsSync(join(root, "skills", ".pi"))).toBe(false);
  });

  test("links the vault skills into the Claude skills dir and prints the summary", async () => {
    expect(await install()).toBe(0);
    expect(lstatSync(join(claudeDir, "clean")).isSymbolicLink()).toBe(true);
    expect(lstatSync(join(claudeDir, "dirty")).isSymbolicLink()).toBe(true);
    expect(out).toContain(
      "claude-code: 2 linked, 0 already current, 0 left as directories, 0 stale links pruned",
    );
    expect(out).toContain("ui-ux-pro-max: skipped (pass --extras ui-ux to install)");
    expect(out).toContain("career-ops: skipped (pass --extras career to install)");
    expect(out).toContain("gstack: skipped (pass --extras gstack to install)");
  });

  test("moves a gstack checkout aside for the CLI and restores it afterwards", async () => {
    mkdirSync(join(root, "skills", "gstack", ".git"), { recursive: true });
    writeFileSync(join(root, "skills", "gstack", ".git", "HEAD"), "ref: refs/heads/main\n");
    writeFileSync(join(root, "skills", "gstack", "setup"), "#!/bin/sh\n", { mode: 0o755 });

    expect(await install()).toBe(0);
    // The stub reports gstack only if it saw it while running.
    expect(commandLog()).toEqual(["npx -y skills@1.5.23 add . -s * -g"]);
    expect(read("skills", "gstack", "setup")).toBe("#!/bin/sh\n");
  });

  test("purges gstack leftovers from the skills tree", async () => {
    mkdirSync(join(root, "skills", "stray"), { recursive: true });
    symlinkSync("/opt/gstack/skills/qa/SKILL.md", join(root, "skills", "stray", "SKILL.md"));
    mkdirSync(join(root, "skills", "gstack-qa"), { recursive: true });
    writeFileSync(join(root, "skills", "gstack-qa", "SKILL.md"), "generated\n");
    writeFileSync(join(root, "skills", "gstack-notes.md"), "kept\n");

    expect(await install()).toBe(0);
    expect(existsSync(join(root, "skills", "stray"))).toBe(false);
    expect(existsSync(join(root, "skills", "gstack-qa"))).toBe(false);
    expect(existsSync(join(root, "skills", "gstack-notes.md"))).toBe(true);
  });

  test("the interrupt handlers that restore gstack are removed when the run ends", async () => {
    const before = process.listenerCount("SIGINT") + process.listenerCount("SIGTERM");
    expect(await install()).toBe(0);
    expect(process.listenerCount("SIGINT") + process.listenerCount("SIGTERM")).toBe(before);
  });

  test("dry run prints the commands and changes nothing", async () => {
    expect(await install(true)).toBe(0);
    expect(commandLog()).toEqual([]);
    expect(out).toContain(`+ npx -y skills@1.5.23 add . -s * -g   (in ${root})`);
    expect(existsSync(claudeDir)).toBe(false);
    expect(read("skills", "dirty", "SKILL.md")).toBe("---\nname: dirty\n---\nbase\nlocal edit\n");
  });
});

describe("parseInstallArgs", () => {
  test("accepts space-separated and csv extras with aliases", () => {
    expect(parseInstallArgs(["--extras", "gstack", "career-ops"]).extras).toEqual({
      gstack: true,
      career: true,
      uiUx: false,
    });
    expect(parseInstallArgs(["--extras=uipro,gstack"]).extras).toEqual({
      gstack: true,
      career: false,
      uiUx: true,
    });
    expect(parseInstallArgs(["--extras", "all"]).extras).toEqual({
      gstack: true,
      career: true,
      uiUx: true,
    });
  });

  test("reports unknown extras, empty lists and unknown options", () => {
    expect(parseInstallArgs(["--extras", "nope"]).error).toContain("unknown extra 'nope'");
    expect(parseInstallArgs(["--extras"]).error).toContain("--extras requires at least one name");
    expect(parseInstallArgs(["--extras="]).error).toContain("--extras= requires at least one name");
    expect(parseInstallArgs(["--wat"]).error).toBe("ERROR: unknown option: --wat");
  });

  test("--dry-run and --help are recognized", () => {
    expect(parseInstallArgs(["--dry-run"]).dryRun).toBe(true);
    expect(parseInstallArgs(["-h"]).help).toBe(true);
  });
});
