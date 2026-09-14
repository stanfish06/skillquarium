import { afterAll, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type ContextOverrides, main } from "../src/cli";
import { setSkillEnabled, setSkillProductStates, toggleSkill } from "../src/toggle/edit";
import { preCommitReset } from "../src/toggle/reset";
import { loadSnapshot, saveSnapshot } from "../src/toggle/snapshot";
import { discover, loadSkill } from "../src/toggle/state";
import golden from "./fixtures/catalog.golden.json";

const VAULT_ROOT = resolve(import.meta.dir, "..", "..");
const roots: string[] = [];

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function tmp(): string {
  const root = mkdtempSync(join(tmpdir(), "sq-toggle-"));
  roots.push(root);
  return root;
}

function capture(): { out: string[]; err: string[]; overrides: ContextOverrides } {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, overrides: { out: (l) => out.push(l), err: (l) => err.push(l) } };
}

function git(root: string, ...args: string[]): void {
  const result = Bun.spawnSync(
    ["git", "-c", "user.name=Skill Toggle Test", "-c", "user.email=skill-toggle@example.test", ...args],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  if (result.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr.toString()}`);
}

function commitFixture(root: string, ...paths: string[]): void {
  git(root, "init", "-q");
  git(root, "add", ...(paths.length ? paths : ["."]));
  git(root, "-c", "commit.gpgsign=false", "commit", "-qm", "fixture");
}

function makeSkill(root: string, name: string, opts: { claude?: boolean; codex?: boolean } = {}): string {
  const directory = join(root, "skills", name);
  mkdirSync(directory, { recursive: true });
  const claudeLine = opts.claude === undefined ? "" : `disable-model-invocation: ${opts.claude}\n`;
  writeFileSync(
    join(directory, "SKILL.md"),
    `---\nname: ${name}\ndescription: Use ${name} for tests.\n${claudeLine}---\n\n# ${name}\n`,
  );
  if (opts.codex !== undefined) {
    mkdirSync(join(directory, "agents"));
    writeFileSync(
      join(directory, "agents", "openai.yaml"),
      "interface:\n" +
        `  display_name: "${name}"\n` +
        '  short_description: "A test skill used by the selector."\n' +
        `  default_prompt: "Use $${name} for this task."\n` +
        "\n" +
        "policy:\n" +
        "  products:\n" +
        "  - codex\n" +
        `  allow_implicit_invocation: ${opts.codex}  # preserve me\n`,
    );
  }
  return directory;
}

const read = (path: string): string => readFileSync(path, "utf8");

describe("skill toggle", () => {
  test("disableUpdatesClaudeAndCreatesValidCodexMetadata", () => {
    const directory = makeSkill(tmp(), "alpha");
    setSkillEnabled(loadSkill(directory), false);
    const skillText = read(join(directory, "SKILL.md"));
    const openaiText = read(join(directory, "agents/openai.yaml"));
    expect(skillText).toContain("disable-model-invocation: true");
    expect(openaiText).toContain("interface:\n");
    expect(openaiText).toContain("allow_implicit_invocation: false");
    expect(loadSkill(directory).state).toBe("disabled");
  });

  test("enablePreservesExistingCodexMetadataAndComment", () => {
    const directory = makeSkill(tmp(), "beta", { claude: true, codex: false });
    setSkillEnabled(loadSkill(directory), true);
    const skillText = read(join(directory, "SKILL.md"));
    const openaiText = read(join(directory, "agents/openai.yaml"));
    expect(skillText).toContain("disable-model-invocation: false");
    expect(openaiText).toContain("  - codex");
    expect(openaiText).toContain("allow_implicit_invocation: true  # preserve me");
    expect(loadSkill(directory).state).toBe("enabled");
  });

  test("mixedStateTogglesToEnabled", () => {
    const directory = makeSkill(tmp(), "gamma", { claude: false, codex: false });
    const skill = loadSkill(directory);
    expect(skill.state).toBe("mixed");
    toggleSkill(skill);
    expect(loadSkill(directory).state).toBe("enabled");
  });

  test("productsCanBeChangedIndependently", () => {
    const directory = makeSkill(tmp(), "individual");
    const claudeChanged = setSkillProductStates(loadSkill(directory), { claude: false });
    expect(claudeChanged.claude_enabled).toBe(false);
    expect(claudeChanged.codex_enabled).toBe(true);
    expect(existsSync(join(directory, "agents/openai.yaml"))).toBe(false);
    const codexChanged = setSkillProductStates(claudeChanged, { codex: false });
    expect(codexChanged.state).toBe("disabled");
  });

  test("discoveryExcludesHiddenAndExternalSymlinkedSkills", () => {
    const root = tmp();
    makeSkill(root, "visible");
    makeSkill(join(root, ".hidden"), "nested");
    makeSkill(root, "gstack-transient");
    const external = makeSkill(tmp(), "outside");
    symlinkSync(external, join(root, "skills", "linked"));
    expect(discover(root).map((s) => s.key)).toEqual(["visible"]);
  });

  test("discoveryReadsCategoriesFromWrapperFrontmatter", () => {
    const root = tmp();
    makeSkill(root, "categorized");
    // The domain is the notes/<domain>/ folder name, not a frontmatter field.
    const note = join(root, "vault/notes", "single-cell-omics");
    mkdirSync(note, { recursive: true });
    writeFileSync(join(note, "categorized.md"), "---\ntitle: categorized\ndomain: single-cell-omics\n---\n");
    expect(discover(root)[0]?.category).toBe("single-cell-omics");
  });

  test("cliDisableAndList", async () => {
    const root = tmp();
    const directory = makeSkill(root, "delta");
    const c1 = capture();
    expect(await main(["--root", root, "disable", "delta"], c1.overrides)).toBe(0);
    expect(c1.err).toEqual([]);
    expect(c1.out).toContain("disabled\tdelta");
    const c2 = capture();
    expect(await main(["--root", root, "list"], c2.overrides)).toBe(0);
    expect(c2.out).toContain("disabled\tdelta\tuncategorized\tUse delta for tests.");
    expect(existsSync(join(directory, "agents/openai.yaml"))).toBe(true);
  });

  test("cliChangesMultipleSkillsInOneCommand", async () => {
    const root = tmp();
    const alpha = makeSkill(root, "alpha");
    const beta = makeSkill(root, "beta");
    const c = capture();
    expect(await main(["--root", root, "disable", "--product", "codex", "alpha", "beta"], c.overrides)).toBe(
      0,
    );
    expect(c.err).toEqual([]);
    expect(loadSkill(alpha).codex_enabled).toBe(false);
    expect(loadSkill(beta).codex_enabled).toBe(false);
  });

  test("snapshotRoundTripRestoresBothProducts", () => {
    const root = tmp();
    const directory = makeSkill(root, "snapshot");
    const snapshot = saveSnapshot(root);
    expect(snapshot).toBe(join(root, ".skill-vault", "data", "skill-toggle-state.json"));
    setSkillEnabled(loadSkill(directory), false);
    const { source, changed } = loadSnapshot(root);
    expect(source).toBe(snapshot);
    expect(changed).toBe(1);
    expect(loadSkill(directory).state).toBe("enabled");
  });

  test("preCommitResetSavesStateAndActivatesWorkingTree", () => {
    const root = tmp();
    const directory = makeSkill(root, "committed");
    commitFixture(root, "skills/committed/SKILL.md");
    setSkillEnabled(loadSkill(directory), false);
    const skillPath = join(directory, "SKILL.md");
    writeFileSync(skillPath, `${read(skillPath)}\nUnrelated working edit.\n`);
    const [snapshot, changed] = preCommitReset(root);
    const skillText = read(skillPath);
    expect(changed).toBeGreaterThanOrEqual(2);
    expect(existsSync(snapshot)).toBe(true);
    expect(skillText).not.toContain("disable-model-invocation");
    expect(skillText).toContain("Unrelated working edit.");
    expect(existsSync(join(directory, "agents/openai.yaml"))).toBe(false);
    expect(loadSkill(directory).state).toBe("enabled");
  });

  test("preCommitResetRestoresTrackedOpenaiYamlExactly", () => {
    const root = tmp();
    const directory = makeSkill(root, "tracked-openai");
    const openaiPath = join(directory, "agents", "openai.yaml");
    mkdirSync(join(directory, "agents"));
    const original =
      "interface:\n" +
      '  display_name: "Tracked OpenAI"\n' +
      '  short_description: "Preserve exact formatting."\n';
    writeFileSync(openaiPath, original);
    commitFixture(root);
    setSkillProductStates(loadSkill(directory), { codex: false });
    preCommitReset(root);
    expect(read(openaiPath)).toBe(original);
  });

  test("preCommitResetActivatesSkillsDisabledInHead", () => {
    const root = tmp();
    const directory = makeSkill(root, "head-disabled", { claude: true, codex: false });
    commitFixture(root);
    const [, changed] = preCommitReset(root);
    const openaiText = read(join(directory, "agents", "openai.yaml"));
    expect(changed).toBe(2);
    expect(read(join(directory, "SKILL.md"))).not.toContain("disable-model-invocation");
    expect(openaiText).not.toContain("allow_implicit_invocation");
    expect(openaiText).toContain("- codex");
    expect(loadSkill(directory).state).toBe("enabled");
  });
});

describe("golden parity with skill_toggle.py", () => {
  test("catalog matches catalog.golden.json", async () => {
    const c = capture();
    expect(await main(["--root", VAULT_ROOT, "catalog"], c.overrides)).toBe(0);
    expect(c.out).toHaveLength(1);
    const actual = JSON.parse(c.out[0] ?? "") as typeof golden;
    // The golden was recorded from one checkout; only the root prefix of `directory` may differ.
    const first = golden.skills[0];
    if (!first) throw new Error("empty golden");
    const goldenRoot = first.directory.slice(0, -`/skills/${first.key}`.length);
    const expected = golden.skills.map((s) => ({
      ...s,
      directory: VAULT_ROOT + s.directory.slice(goldenRoot.length),
    }));
    expect(actual.skills).toEqual(expected);
    expect(actual.categories).toEqual(golden.categories);
    expect(Object.keys(actual.skills[0] ?? {})).toEqual(Object.keys(first));
  });

  test("list matches list.golden.tsv line for line", async () => {
    const c = capture();
    expect(await main(["--root", VAULT_ROOT, "list"], c.overrides)).toBe(0);
    const expected = readFileSync(join(import.meta.dir, "fixtures", "list.golden.tsv"), "utf8").split("\n");
    expected.pop();
    expect(c.out).toEqual(expected);
  });
});
