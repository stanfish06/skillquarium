import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { linkClaude } from "../../src/install/linkClaude";

let sandbox = "";
let root = "";
let skillsDir = "";
let claudeDir = "";

beforeEach(() => {
  sandbox = realpathSync(mkdtempSync(join(tmpdir(), "sq-link-")));
  root = join(sandbox, "vault");
  skillsDir = join(root, "skills");
  claudeDir = join(sandbox, "claude-skills");
  mkdirSync(skillsDir, { recursive: true });
  mkdirSync(claudeDir);
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

function skill(name: string): string {
  const dir = join(skillsDir, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), `---\nname: ${name}\n---\n`);
  return dir;
}

describe("linkClaude", () => {
  test("counts fresh links, current links, real directories and pruned stale links", () => {
    const fresh = skill("fresh");
    const current = skill("current");
    skill("real-dir");
    symlinkSync(current, join(claudeDir, "current"));
    mkdirSync(join(claudeDir, "real-dir"));
    writeFileSync(join(claudeDir, "real-dir", "SKILL.md"), "copy-mode install\n");
    // Dangling and pointing into this vault: pruned.
    symlinkSync(join(skillsDir, "removed"), join(claudeDir, "removed"));
    // Dangling but owned by something else: left alone.
    symlinkSync(join(sandbox, "elsewhere", "other"), join(claudeDir, "other"));

    expect(linkClaude(root, claudeDir)).toEqual({ linked: 1, current: 1, kept: 1, pruned: 1 });
    expect(readlinkSync(join(claudeDir, "fresh"))).toBe(fresh);
    expect(existsSync(join(claudeDir, "removed"))).toBe(false);
    expect(lstatSync(join(claudeDir, "other")).isSymbolicLink()).toBe(true);
    // A real directory keeps its own content.
    expect(lstatSync(join(claudeDir, "real-dir")).isDirectory()).toBe(true);
  });

  test("prunes a dangling link into another checkout's .agents/skills", () => {
    symlinkSync("/nowhere/.agents/skills/gone", join(claudeDir, "gone"));
    expect(linkClaude(root, claudeDir).pruned).toBe(1);
    expect(lstatSync(join(claudeDir, "gone"), { throwIfNoEntry: false })).toBeUndefined();
  });

  test("relinks a symlink that points at the wrong source", () => {
    const right = skill("moved");
    const wrong = join(sandbox, "old-vault", "skills", "moved");
    mkdirSync(wrong, { recursive: true });
    symlinkSync(wrong, join(claudeDir, "moved"));

    expect(linkClaude(root, claudeDir)).toEqual({ linked: 1, current: 0, kept: 0, pruned: 0 });
    expect(readlinkSync(join(claudeDir, "moved"))).toBe(right);
  });

  test("creates the target directory and skips folders without SKILL.md", () => {
    skill("has-skill");
    mkdirSync(join(skillsDir, "no-skill"));
    const target = join(sandbox, "fresh-claude", "skills");

    expect(linkClaude(root, target)).toEqual({ linked: 1, current: 0, kept: 0, pruned: 0 });
    expect(existsSync(join(target, "has-skill"))).toBe(true);
    expect(existsSync(join(target, "no-skill"))).toBe(false);
  });

  test("dry run counts without touching the filesystem", () => {
    skill("fresh");
    expect(linkClaude(root, claudeDir, { dryRun: true })).toEqual({
      linked: 1,
      current: 0,
      kept: 0,
      pruned: 0,
    });
    expect(existsSync(join(claudeDir, "fresh"))).toBe(false);
  });
});
