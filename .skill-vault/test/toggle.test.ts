import { afterAll, describe, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type ContextOverrides, main } from "../src/cli";
import {
  atomicWrite,
  captureOriginal,
  restoreOriginalFiles,
  setSkillEnabled,
  setSkillProductStates,
  toggleSkill,
  transformOpenaiYamlField,
  transformSkillMdField,
} from "../src/toggle/edit";
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

/** Leftover `.SKILL.md.<hex>` / `.openai.yaml.<hex>` temp files from an interrupted atomicWrite. */
function tempFiles(dir: string): string[] {
  return readdirSync(dir).filter((name) => /^\.(SKILL\.md|openai\.yaml)\./.test(name));
}

describe("error classification", () => {
  test("invalid UTF-8 in SKILL.md becomes an error row, not a throw", () => {
    const root = tmp();
    const directory = join(root, "skills", "binary");
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "SKILL.md"), Buffer.from([0x2d, 0x2d, 0x2d, 0x0a, 0xff, 0xfe, 0x0a]));
    const skill = loadSkill(directory);
    expect(skill.state).toBe("error");
    expect(skill.claude_enabled).toBeNull();
    expect(skill.error).toContain("not valid for encoding utf-8");
  });

  test("metadata and fs errors print skill-toggle and exit 2", async () => {
    const root = tmp();
    makeSkill(root, "alpha");
    const unknown = capture();
    expect(await main(["--root", root, "preview", "nope"], unknown.overrides)).toBe(2);
    expect(unknown.err).toEqual(["skill-toggle: unknown skill: nope"]);

    // A snapshot path whose parent is a file: mkdir fails with a coded fs error (Python's OSError).
    writeFileSync(join(root, "blocker"), "not a directory\n");
    const fs = capture();
    expect(await main(["--root", root, "save", join(root, "blocker", "snap.json")], fs.overrides)).toBe(2);
    expect(fs.err[0]).toStartWith("skill-toggle: ");
  });

  test("an unexpected error propagates to the router instead of exiting 2", async () => {
    const root = tmp();
    makeSkill(root, "alpha");
    const err: string[] = [];
    const status = await main(["--root", root, "list"], {
      out: () => {
        throw new Error("boom");
      },
      err: (l) => err.push(l),
    });
    expect(status).toBe(1);
    expect(err).toEqual(["skillquarium list: boom"]);
  });
});

describe("rollback and atomic writes", () => {
  test("a failed second write rolls the first file back byte-for-byte", () => {
    const root = tmp();
    const directory = makeSkill(root, "alpha");
    const skillPath = join(directory, "SKILL.md");
    const original = read(skillPath);
    // `agents` as a file makes the openai.yaml write fail after SKILL.md has been rewritten.
    writeFileSync(join(directory, "agents"), "not a directory\n");

    expect(() => setSkillProductStates(loadSkill(directory), { claude: false, codex: false })).toThrow();
    expect(read(skillPath)).toBe(original);
    expect(tempFiles(directory)).toEqual([]);
    expect(loadSkill(directory).claude_enabled).toBe(true);
  });

  test("loadSnapshot restores rewritten and newly created files when one entry is invalid", () => {
    const root = tmp();
    const alpha = makeSkill(root, "alpha");
    makeSkill(root, "zeta");
    const skillPath = join(alpha, "SKILL.md");
    const original = read(skillPath);
    const snapshot = saveSnapshot(root);
    writeFileSync(
      snapshot,
      JSON.stringify({
        schema_version: 1,
        saved_at: "2026-01-01T00:00:00+00:00",
        root,
        skills: {
          alpha: { claude_enabled: false, codex_enabled: false },
          zeta: { claude_enabled: "nope", codex_enabled: true },
        },
      }),
    );

    expect(() => loadSnapshot(root)).toThrow(`${snapshot}: invalid state for zeta`);
    expect(read(skillPath)).toBe(original);
    expect(existsSync(join(alpha, "agents"))).toBe(false);
    expect(tempFiles(alpha)).toEqual([]);
    expect(loadSkill(alpha).state).toBe("enabled");
  });

  test("restoreOriginalFiles rewrites captured files and removes created ones", () => {
    const root = tmp();
    const directory = makeSkill(root, "alpha");
    const skillPath = join(directory, "SKILL.md");
    chmodSync(skillPath, 0o640);
    const originals = [captureOriginal(skillPath), captureOriginal(join(directory, "agents", "openai.yaml"))];
    const before = read(skillPath);

    setSkillProductStates(loadSkill(directory), { claude: false, codex: false });
    expect(existsSync(join(directory, "agents", "openai.yaml"))).toBe(true);

    restoreOriginalFiles(originals);
    expect(read(skillPath)).toBe(before);
    expect(statSync(skillPath).mode & 0o777).toBe(0o640);
    // The created file goes, and so does the agents/ directory it was the only entry of.
    expect(existsSync(join(directory, "agents"))).toBe(false);
  });

  test("preCommitReset rolls every written file back when a later write fails", () => {
    const root = tmp();
    const first = makeSkill(root, "aaa", { claude: true });
    const second = makeSkill(root, "zzz", { claude: true });
    commitFixture(root);
    const firstPath = join(first, "SKILL.md");
    const secondPath = join(second, "SKILL.md");
    const firstBefore = read(firstPath);
    const secondBefore = read(secondPath);
    // A read-only skill directory fails the second SKILL.md rewrite, after the first has been
    // rewritten. The failing op was never completed, so the rollback reaches the first one.
    chmodSync(second, 0o500);
    try {
      let thrown: unknown;
      try {
        preCommitReset(root);
      } catch (e) {
        thrown = e;
      }
      expect((thrown as Error | undefined)?.message).toContain("zzz");
      // The failing op never entered the rollback list, so the error is the write failure itself
      // and not a phantom "could not restore" for a file that was never rewritten.
      expect((thrown as Error).message).not.toContain("could not restore");
      expect(read(firstPath)).toBe(firstBefore);
      expect(read(secondPath)).toBe(secondBefore);
      expect(loadSkill(first).claude_enabled).toBe(false);
      expect(tempFiles(first)).toEqual([]);
      expect(tempFiles(second)).toEqual([]);
    } finally {
      chmodSync(second, 0o700);
    }
  });

  test("restoreOriginalFiles reports the file it could not restore and still restores the rest", () => {
    const root = tmp();
    const first = makeSkill(root, "aaa", { claude: true });
    const second = makeSkill(root, "zzz", { claude: true });
    const firstPath = join(first, "SKILL.md");
    const originals = [captureOriginal(firstPath), captureOriginal(join(second, "SKILL.md"))];
    const firstBefore = read(firstPath);

    setSkillProductStates(loadSkill(first), { claude: true, codex: null });
    expect(read(firstPath)).not.toBe(firstBefore);
    chmodSync(second, 0o500);
    try {
      // zzz is restored first (reverse order) and cannot be written; aaa must still come back.
      expect(restoreOriginalFiles(originals)).toEqual([join(second, "SKILL.md")]);
      expect(read(firstPath)).toBe(firstBefore);
    } finally {
      chmodSync(second, 0o700);
    }
  });

  test("atomicWrite keeps the original file mode", () => {
    const root = tmp();
    const directory = makeSkill(root, "alpha");
    const skillPath = join(directory, "SKILL.md");
    chmodSync(skillPath, 0o640);

    atomicWrite(skillPath, "replaced\n", statSync(skillPath).mode);
    expect(read(skillPath)).toBe("replaced\n");
    expect(statSync(skillPath).mode & 0o777).toBe(0o640);

    // The same mode survives a real toggle, which reads it back off the file it is rewriting.
    writeFileSync(skillPath, "---\nname: alpha\n---\n");
    chmodSync(skillPath, 0o640);
    setSkillProductStates(loadSkill(directory), { claude: false });
    expect(statSync(skillPath).mode & 0o777).toBe(0o640);
  });
});

describe("line endings and metadata errors", () => {
  test("a CRLF SKILL.md keeps CRLF through disable and enable", () => {
    const root = tmp();
    const directory = join(root, "skills", "crlf");
    mkdirSync(directory, { recursive: true });
    const skillPath = join(directory, "SKILL.md");
    writeFileSync(skillPath, "---\r\nname: crlf\r\ndescription: crlf\r\n---\r\n\r\n# crlf\r\n");

    setSkillEnabled(loadSkill(directory), false);
    let text = read(skillPath);
    expect(text).toContain("disable-model-invocation: true\r\n");
    expect(text.replaceAll("\r\n", "")).not.toContain("\n");

    setSkillEnabled(loadSkill(directory), true);
    text = read(skillPath);
    expect(text).toContain("disable-model-invocation: false\r\n");
    expect(text.replaceAll("\r\n", "")).not.toContain("\n");
    // The generated yaml is always LF, as Python's template is.
    expect(read(join(directory, "agents", "openai.yaml"))).not.toContain("\r");
  });

  test("duplicate and non-boolean fields surface as path-prefixed metadata errors", () => {
    const root = tmp();
    const directory = join(root, "skills", "broken");
    mkdirSync(join(directory, "agents"), { recursive: true });
    const skillPath = join(directory, "SKILL.md");
    const head = "---\nname: broken\ndescription: broken\n";
    writeFileSync(skillPath, `${head}disable-model-invocation: true\ndisable-model-invocation: false\n---\n`);
    writeFileSync(join(directory, "agents", "openai.yaml"), "policy:\n  allow_implicit_invocation: true\n");

    const duplicate = loadSkill(directory);
    expect(duplicate.state).toBe("error");
    expect(duplicate.error).toBe(`${skillPath}: duplicate disable-model-invocation fields`);
    // An error skill cannot be edited: the message is re-raised rather than guessed at.
    expect(() => setSkillEnabled(duplicate, true)).toThrow(duplicate.error ?? "");

    writeFileSync(skillPath, `${head}disable-model-invocation: maybe\n---\n`);
    expect(loadSkill(directory).error).toBe(`${skillPath}: disable-model-invocation must be true or false`);

    writeFileSync(skillPath, `${head}---\n`);
    const openaiPath = join(directory, "agents", "openai.yaml");
    writeFileSync(
      openaiPath,
      "policy:\n  allow_implicit_invocation: true\n  allow_implicit_invocation: false\n",
    );
    expect(loadSkill(directory).error).toBe(`${openaiPath}: duplicate allow_implicit_invocation fields`);
  });

  test("transforms reject duplicate fields, duplicate policy blocks and inline policy", () => {
    const path = "/tmp/openai.yaml";
    expect(() => transformSkillMdField("---\na: 1\n---\n", path, true)).not.toThrow();
    expect(() =>
      transformSkillMdField(
        "---\ndisable-model-invocation: true\ndisable-model-invocation: false\n---\n",
        path,
        null,
      ),
    ).toThrow(`${path}: duplicate disable-model-invocation fields`);
    expect(() => transformSkillMdField("---\ndisable-model-invocation: maybe\n---\n", path, true)).toThrow(
      `${path}: disable-model-invocation must be true or false`,
    );
    expect(() => transformSkillMdField("no frontmatter\n", path, true)).toThrow(
      `${path}: SKILL.md has no YAML frontmatter`,
    );

    expect(() =>
      transformOpenaiYamlField(
        "policy:\n  allow_implicit_invocation: true\n  allow_implicit_invocation: false\n",
        path,
        null,
      ),
    ).toThrow(`${path}: duplicate allow_implicit_invocation fields`);
    expect(() => transformOpenaiYamlField("policy:\n  a: 1\npolicy:\n  b: 2\n", path, true)).toThrow(
      `${path}: duplicate policy blocks`,
    );
    expect(() => transformOpenaiYamlField("policy: {products: [codex]}\n", path, true)).toThrow(
      `${path}: inline policy mappings are not supported`,
    );
    expect(() =>
      transformOpenaiYamlField("policy:\n  allow_implicit_invocation: maybe\n", path, true),
    ).toThrow(`${path}: allow_implicit_invocation must be true or false`);
  });
});
