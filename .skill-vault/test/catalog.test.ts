import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import {
  collapseWhitespace,
  discoverSkills,
  isScientificAgentsProfile,
  isUiUxProMaxSkill,
  readBooleanField,
  readDescriptionForBuild,
  readScalar,
  splitFrontmatter,
} from "../src/catalog";

function tmp(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function skill(root: string, rel: string, text = "---\nname: x\n---\n"): void {
  const dir = join(root, "skills", rel);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), text);
}

function fm(text: string) {
  const f = splitFrontmatter(text);
  if (!f) throw new Error("no frontmatter");
  return f;
}

describe("discoverSkills", () => {
  function tree(): string {
    const root = tmp("sq-cat-");
    skill(root, "b");
    skill(root, "a");
    skill(root, "gstack");
    skill(root, "gstack/child");
    skill(root, ".hidden");
    skill(root, "gstack-x");
    skill(root, "_gstack-y");
    mkdirSync(join(root, "skills", "nofile"));
    writeFileSync(join(root, "skills", "stray.md"), "not a skill\n");
    const outside = tmp("sq-cat-out-");
    writeFileSync(join(outside, "SKILL.md"), "---\nname: ext\n---\n");
    symlinkSync(outside, join(root, "skills", "ext"));
    return root;
  }

  test("build mode lists gstack children and transient names, not hidden or file-less dirs", () => {
    const root = tree();
    const entries = discoverSkills(root, { bundles: true, excludeTransient: false });
    expect(entries.map((e) => e.id)).toEqual([
      "_gstack-y",
      "a",
      "b",
      "ext",
      "gstack",
      "gstack-x",
      "gstack/child",
    ]);
    const child = entries.find((e) => e.id === "gstack/child");
    expect(child?.dir).toBe(join(root, "skills", "gstack", "child"));
    expect(child?.file).toBe(join(root, "skills", "gstack", "child", "SKILL.md"));
  });

  test("toggle mode drops gstack-*, _gstack*, bundle children, and symlinks leaving skills/", () => {
    const entries = discoverSkills(tree(), { bundles: false, excludeTransient: true });
    expect(entries.map((e) => e.id)).toEqual(["a", "b", "gstack"]);
  });

  test("ids sort in code-unit order", () => {
    const root = tmp("sq-cat-");
    for (const n of ["b", "B", "a-b", "a_b", "a"]) skill(root, n);
    const ids = discoverSkills(root, { bundles: false, excludeTransient: true }).map((e) => e.id);
    expect(ids).toEqual(["B", "a", "a-b", "a_b", "b"]);
  });

  test("throws when skills/ is missing", () => {
    const root = tmp("sq-cat-");
    expect(() => discoverSkills(root, { bundles: true, excludeTransient: false })).toThrow(
      /^cannot discover skills: .*no skills directory under the vault root\. Pass --root pointing at the vault/,
    );
  });
});

describe("splitFrontmatter", () => {
  test("null when line 0 is not ---", () => {
    expect(splitFrontmatter("# title\n---\n")).toBeNull();
    expect(splitFrontmatter("")).toBeNull();
  });

  test("null when the fence is never closed", () => {
    expect(splitFrontmatter("---\nname: x\n")).toBeNull();
  });

  test("closingIndex and lines with endings", () => {
    const f = fm("---\nname: x\ndescription: y\n---\nbody\n");
    expect(f.closingIndex).toBe(3);
    expect(f.newline).toBe("\n");
    expect(f.lines).toEqual(["---\n", "name: x\n", "description: y\n", "---\n", "body\n"]);
  });

  test("detects CRLF", () => {
    const f = fm("---\r\nname: x\r\n---\r\n");
    expect(f.newline).toBe("\r\n");
    expect(f.closingIndex).toBe(2);
    expect(f.lines[1]).toBe("name: x\r\n");
  });
});

describe("readDescriptionForBuild", () => {
  test("plain scalar", () => {
    expect(readDescriptionForBuild("---\nname: x\ndescription:  Plain  text.  \n---\n")).toBe("Plain text.");
  });

  test("folded block with two continuation lines", () => {
    const text = "---\ndescription: >\n  First part\n  second part.\nname: x\n---\n";
    expect(readDescriptionForBuild(text)).toBe("First part second part.");
  });

  test("double-quoted with escapes", () => {
    expect(readDescriptionForBuild('---\ndescription: "quoted \\"esc\\" and \\\\ slash"\n---\n')).toBe(
      'quoted "esc" and \\ slash',
    );
  });

  test("single-quote stripping is a plain strip, not YAML decoding", () => {
    expect(readDescriptionForBuild("---\ndescription: 'it''s'\n---\n")).toBe("it''s");
  });

  test("continuation stops at the next unindented key but not an indented one", () => {
    const text = "---\ndescription: |\n  Line one\n  note: kept\nlicense: MIT\n---\n";
    expect(readDescriptionForBuild(text)).toBe("Line one note: kept");
  });

  test("null for empty description or no frontmatter", () => {
    expect(readDescriptionForBuild("---\ndescription:\nname: x\n---\n")).toBeNull();
    expect(readDescriptionForBuild("description: x\n")).toBeNull();
    expect(readDescriptionForBuild("---\ndescription: x\n")).toBeNull();
  });

  test("CRLF reads like LF", () => {
    expect(readDescriptionForBuild("---\r\ndescription: >-\r\n  a\r\n  b\r\n---\r\n")).toBe("a b");
  });
});

describe("readScalar", () => {
  test("literal block joins lines with spaces; a blank line ends the block", () => {
    const f = fm("---\ndescription: |\n  one\n  two\nname: x\n---\n");
    expect(readScalar(f, "description")).toBe("one two");
    expect(readScalar(f, "name")).toBe("x");
    expect(readScalar(fm("---\ndescription: |\n  one\n\n  two\n---\n"), "description")).toBe("one");
  });

  test("folded strip block", () => {
    const f = fm("---\ndescription: >-\n  alpha\n\tbeta\n---\n");
    expect(readScalar(f, "description")).toBe("alpha beta");
  });

  test("single-quoted follows ast.literal_eval: '' concatenates, escapes decode, bad literal falls back", () => {
    expect(readScalar(fm("---\nname: 'it''s'\n---\n"), "name")).toBe("its");
    expect(readScalar(fm("---\nname: 'a\\tb'\n---\n"), "name")).toBe("a\tb");
    expect(readScalar(fm("---\nname: 'don't'\n---\n"), "name")).toBe("don't");
    expect(readScalar(fm("---\nname: 'plain'\n---\n"), "name")).toBe("plain");
  });

  test("JSON double-quoted, with fallback for invalid JSON", () => {
    expect(readScalar(fm('---\nname: "a \\"b\\" \\u00e9"\n---\n'), "name")).toBe('a "b" é');
    expect(readScalar(fm('---\nname: "bad \\q"\n---\n'), "name")).toBe("bad \\q");
  });

  test("absent -> null, present but empty -> empty string", () => {
    const f = fm("---\nname:\n---\n");
    expect(readScalar(f, "description")).toBeNull();
    expect(readScalar(f, "name")).toBe("");
  });

  test("CRLF lines strip the carriage return", () => {
    expect(readScalar(fm("---\r\nname: x \r\n---\r\n"), "name")).toBe("x");
  });
});

describe("readBooleanField", () => {
  test("true, false, null", () => {
    expect(readBooleanField("disable-model-invocation: true\n", "disable-model-invocation", true)).toBe(true);
    expect(readBooleanField("disable-model-invocation: false\n", "disable-model-invocation", true)).toBe(
      false,
    );
    expect(readBooleanField("name: x\n", "disable-model-invocation", true)).toBeNull();
  });

  test("trailing comment accepted", () => {
    expect(readBooleanField("f: true   # why\n", "f", true)).toBe(true);
  });

  test("duplicates throw", () => {
    expect(() => readBooleanField("f: true\nf: false\n", "f", true)).toThrow("duplicate f fields");
    expect(() => readBooleanField("f: true\n  f: nope\n", "f", true)).toThrow("duplicate f fields");
  });

  test("non-boolean value throws", () => {
    expect(() => readBooleanField("f: yes\n", "f", true)).toThrow("f must be true or false");
    expect(() => readBooleanField("f: true # c\n", "f", false)).toThrow("f must be true or false");
  });

  test("nested requires indentation", () => {
    expect(
      readBooleanField("policy:\n  allow_implicit_invocation: false\n", "allow_implicit_invocation", false),
    ).toBe(false);
    expect(() =>
      readBooleanField("allow_implicit_invocation: false\n", "allow_implicit_invocation", false),
    ).toThrow("must be true or false");
  });

  test("CRLF text matches", () => {
    expect(readBooleanField("f: true\r\n", "f", true)).toBe(true);
  });
});

describe("isScientificAgentsProfile", () => {
  test("either marker within the first 4096 chars", () => {
    const dir = tmp("sq-sci-");
    const a = join(dir, "a.md");
    writeFileSync(a, "---\nname: a\nscientific-agents-profile: true\n---\nbody\n");
    const b = join(dir, "b.md");
    writeFileSync(b, "---\nname: b\nsource-repo: K-Dense-AI/scientific-agents\n---\n");
    const c = join(dir, "c.md");
    writeFileSync(c, "---\nname: c\nscientific-agents-profile: false\n---\n");
    expect(isScientificAgentsProfile(a)).toBe(true);
    expect(isScientificAgentsProfile(b)).toBe(true);
    expect(isScientificAgentsProfile(c)).toBe(false);
    expect(isScientificAgentsProfile(join(dir, "missing.md"))).toBe(false);
  });

  test("marker beyond 4096 chars is not detected", () => {
    const dir = tmp("sq-sci-");
    const f = join(dir, "long.md");
    writeFileSync(f, `---\nname: long\nnote: ${"x".repeat(4100)}\nscientific-agents-profile: true\n---\n`);
    expect(isScientificAgentsProfile(f)).toBe(false);
  });
});

describe("isUiUxProMaxSkill", () => {
  test("reads the categories.json list", () => {
    expect(isUiUxProMaxSkill("ui-ux-pro-max")).toBe(true);
    expect(isUiUxProMaxSkill("scanpy")).toBe(false);
  });
});

describe("parity with the Python golden", () => {
  interface Golden {
    skills: { key: string; name: string; description: string; error: string | null }[];
  }
  const root = resolve(import.meta.dir, "../..");
  const golden = JSON.parse(
    readFileSync(join(import.meta.dir, "fixtures/catalog.golden.json"), "utf8"),
  ) as Golden;

  test("toggle-mode discovery and description/name match skill_toggle.py output", () => {
    const entries = discoverSkills(root, { bundles: false, excludeTransient: true });
    expect(entries.map((e) => e.id)).toEqual(golden.skills.map((s) => s.key).sort());
    const byKey = new Map(golden.skills.map((s) => [s.key, s]));
    const mismatches: string[] = [];
    for (const e of entries) {
      const g = byKey.get(e.id);
      if (!g || g.error !== null) continue;
      const f = splitFrontmatter(readFileSync(e.file, "utf8"));
      if (!f) {
        mismatches.push(`${e.id}: no frontmatter`);
        continue;
      }
      const description = collapseWhitespace(readScalar(f, "description") ?? "");
      const name = readScalar(f, "name") || basename(e.dir);
      if (description !== g.description) mismatches.push(`${e.id}: description`);
      if (name !== g.name) mismatches.push(`${e.id}: name`);
    }
    expect(mismatches).toEqual([]);
  });
});
