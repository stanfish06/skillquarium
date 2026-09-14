import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Context } from "../../src/cli";
import type { Config } from "../../src/config";
import { help, run } from "../../src/install/command";
import { type Io, makeRunner } from "../../src/install/run";
import { BUNDLE_SKILLS, installUiUxProMax } from "../../src/install/uiUxProMax";

// The fake CLI writes the bundle where the real one would: $FAKE_SKILLS_DIR stands in for
// the store the installer passes on the command line.
const NPX_STUB = [
  "#!/usr/bin/env bash",
  "{ printf 'npx'; printf ' %s' \"$@\"; printf '\\n'; } >> \"$COMMAND_LOG\"",
  'mkdir -p "$FAKE_SKILLS_DIR"',
  'case "${FAKE_INSTALL_RESULT:-complete}" in',
  "  complete)",
  `    for name in ${BUNDLE_SKILLS.join(" ")}; do`,
  '      mkdir -p "$FAKE_SKILLS_DIR/$name"',
  '      printf \'%s\\n\' "$name" > "$FAKE_SKILLS_DIR/$name/SKILL.md"',
  "    done",
  "    ;;",
  "  incomplete)",
  '    mkdir -p "$FAKE_SKILLS_DIR/ui-ux-pro-max"',
  "    printf 'ui-ux-pro-max\\n' > \"$FAKE_SKILLS_DIR/ui-ux-pro-max/SKILL.md\"",
  "    ;;",
  "  fail)",
  '    mkdir -p "$FAKE_SKILLS_DIR/ui-ux-pro-max"',
  "    printf 'partial\\n' > \"$FAKE_SKILLS_DIR/ui-ux-pro-max/SKILL.md\"",
  "    exit 23",
  "    ;;",
  "esac",
  "",
].join("\n");

const ENV_KEYS = [
  "HOME",
  "PATH",
  "COMMAND_LOG",
  "FAKE_SKILLS_DIR",
  "FAKE_INSTALL_RESULT",
  "UI_UX_PRO_MAX_SKIP",
  "UI_UX_PRO_MAX_CLI_VERSION",
];

const MARKER = ".ui-ux-pro-max-managed";

let sandbox = "";
let home = "";
let root = "";
let skillsDir = "";
let logPath = "";
let saved: Record<string, string | undefined> = {};
let out: string[] = [];
let err: string[] = [];
let io: Io;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  sandbox = mkdtempSync(join(tmpdir(), "sq-uiux-"));
  home = join(sandbox, "home");
  root = join(sandbox, "vault");
  skillsDir = join(root, "skills");
  logPath = join(sandbox, "commands.log");
  const bin = join(sandbox, "bin");
  mkdirSync(home);
  mkdirSync(root);
  mkdirSync(bin);
  writeFileSync(join(bin, "npx"), NPX_STUB, { mode: 0o755 });
  process.env.HOME = home;
  process.env.PATH = `${bin}:${process.env.PATH ?? ""}`;
  process.env.COMMAND_LOG = logPath;
  process.env.FAKE_SKILLS_DIR = skillsDir;
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

function commandLog(): string[] {
  if (!existsSync(logPath)) return [];
  const text = readFileSync(logPath, "utf8");
  return text === "" ? [] : text.trimEnd().split("\n");
}

function install(): Promise<number> {
  return installUiUxProMax(root, io, makeRunner(io));
}

describe("ui-ux-pro-max installer", () => {
  test("installs the complete bundle with the pinned CLI", async () => {
    expect(await install()).toBe(0);
    expect(commandLog()).toEqual(["npx -y ui-ux-pro-max-cli@2.14.1 init --ai universal --global --force"]);
    for (const name of BUNDLE_SKILLS) {
      expect(existsSync(join(skillsDir, name, "SKILL.md"))).toBe(true);
    }
    expect(readFileSync(join(skillsDir, MARKER), "utf8")).toBe("2.14.1\n");
  });

  test("the bundle lands in the vault store, not in $HOME/.agents/skills", async () => {
    expect(await install()).toBe(0);
    expect(existsSync(join(home, ".agents"))).toBe(false);
    expect(existsSync(join(skillsDir, "design", "SKILL.md"))).toBe(true);
  });

  test("skip avoids all work", async () => {
    process.env.UI_UX_PRO_MAX_SKIP = "1";
    expect(await install()).toBe(0);
    expect(commandLog()).toEqual([]);
    expect(out.join("\n")).toContain("skipped");
  });

  test("refuses to overwrite an unmanaged bundle name", async () => {
    const collision = join(skillsDir, "design");
    mkdirSync(collision, { recursive: true });
    writeFileSync(join(collision, "SKILL.md"), "user-owned\n");

    expect(await install()).not.toBe(0);
    expect(commandLog()).toEqual([]);
    expect(err.join("\n")).toContain("refusing to overwrite unmanaged skill");
    expect(readFileSync(join(collision, "SKILL.md"), "utf8")).toBe("user-owned\n");
  });

  test("a managed bundle refreshes with a version override", async () => {
    mkdirSync(skillsDir, { recursive: true });
    writeFileSync(join(skillsDir, MARKER), "2.14.1\n");
    for (const name of BUNDLE_SKILLS) {
      mkdirSync(join(skillsDir, name));
      writeFileSync(join(skillsDir, name, "SKILL.md"), "old\n");
    }
    process.env.UI_UX_PRO_MAX_CLI_VERSION = "2.15.0";

    expect(await install()).toBe(0);
    expect(commandLog()).toEqual(["npx -y ui-ux-pro-max-cli@2.15.0 init --ai universal --global --force"]);
    expect(readFileSync(join(skillsDir, MARKER), "utf8")).toBe("2.15.0\n");
  });

  test("a failed first install propagates the code and removes the partial bundle", async () => {
    process.env.FAKE_INSTALL_RESULT = "fail";
    expect(await install()).toBe(23);
    for (const name of BUNDLE_SKILLS) expect(existsSync(join(skillsDir, name))).toBe(false);
    expect(existsSync(join(skillsDir, MARKER))).toBe(false);
  });

  test("an incomplete first install is rejected and cleaned up", async () => {
    process.env.FAKE_INSTALL_RESULT = "incomplete";
    expect(await install()).not.toBe(0);
    expect(err.join("\n")).toContain("did not install the complete bundle");
    for (const name of BUNDLE_SKILLS) expect(existsSync(join(skillsDir, name))).toBe(false);
    expect(existsSync(join(skillsDir, MARKER))).toBe(false);
  });

  test("--help exposes the ui-ux aliases", async () => {
    const config: Config = {
      skillsCliVersion: "1.5.23",
      claudeSkillsDir: join(sandbox, "claude"),
      embed: { url: "http://127.0.0.1:1", model: null, batchSize: 16, timeoutMs: 100, retries: 0 },
      query: { k: 8, rrfK: 60, weights: { lexical: 1, fuzzy: 1, semantic: 1 } },
    };
    const ctx: Context = { root, json: false, out: io.out, err: io.err, config: async () => config };
    expect(await run(["--help"], ctx)).toBe(0);
    const text = out.join("\n");
    for (const token of ["ui-ux", "ui-ux-pro-max", "uipro"]) expect(text).toContain(token);
    expect(text).toBe(help);
  });
});
