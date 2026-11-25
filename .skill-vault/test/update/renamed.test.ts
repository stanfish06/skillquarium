import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { checkLock, type RepoTree } from "../../src/update/drift";
import { applyOrQuarantine, overridesPath } from "../../src/update/overrides";
import {
  addRenamed,
  loadRenamed,
  parseSource,
  type Renamed,
  renamedPath,
  reportRenamed,
  rewriteRefs,
  setName,
  syncRenamed,
  writeRenamed,
} from "../../src/update/renamed";

const created: string[] = [];

afterAll(() => {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir(label: string): string {
  const dir = mkdtempSync(join(tmpdir(), `skillquarium-renamed-${label}-`));
  created.push(dir);
  return dir;
}

function git(root: string, ...argv: string[]): string {
  const proc = Bun.spawnSync(["git", "-C", root, "-c", "user.name=t", "-c", "user.email=t@t", ...argv]);
  if (proc.exitCode !== 0) throw new Error(`git ${argv.join(" ")}: ${proc.stderr.toString()}`);
  return proc.stdout.toString().trim();
}

function write(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
}

const ANIMATE = `---
name: animate
description: Build one animation.
---

For groups use \`/choreograph\`, see ../choreograph/SKILL.md.
Docs: https://example.dev/skills/choreograph and the \`transition\`/\`animate\` props.
`;

/** An upstream repo with two skills that reference each other, committed; returns its file:// URL. */
function upstreamRepo(): { dir: string; url: string } {
  const dir = tempDir("upstream");
  write(join(dir, "skills/animate/SKILL.md"), ANIMATE);
  write(join(dir, "skills/animate/RECIPES.md"), "Stagger per ../choreograph/SKILL.md.\n");
  write(join(dir, "skills/animate/metadata.json"), "{}\n");
  write(join(dir, "skills/animate/__pycache__/x.pyc"), "bytes\n");
  write(join(dir, "skills/animate/run.sh"), "#!/bin/sh\n");
  Bun.spawnSync(["chmod", "755", join(dir, "skills/animate/run.sh")]);
  write(
    join(dir, "skills/choreograph/SKILL.md"),
    "---\nname: choreograph\ndescription: Group motion.\n---\n\nUse `/animate` first.\n",
  );
  write(
    join(dir, "skills/emil-design-eng/SKILL.md"),
    "---\nname: emil-design-eng\ndescription: Core.\n---\n\nSee /animate.\n",
  );
  git(dir, "init", "-q", "-b", "main");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "v1");
  return { dir, url: `file://${dir}` };
}

function commitUpstream(dir: string, path: string, text: string | null): void {
  if (text === null) rmSync(join(dir, path), { recursive: true, force: true });
  else write(join(dir, path), text);
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "change");
}

/** A vault root with a lock holding one plain entry. */
function vault(): string {
  const root = tempDir("vault");
  write(
    join(root, ".skill-lock.json"),
    JSON.stringify({ version: 3, skills: { taken: { skillFolderHash: "x" } } }),
  );
  mkdirSync(join(root, "skills"), { recursive: true });
  return root;
}

const NOW = () => new Date("2026-11-25T00:00:00.000Z");
const LATER = () => new Date("2026-11-26T00:00:00.000Z");

function addAll(root: string, url: string): [string, string][] {
  return addRenamed(
    root,
    { source: url, skills: [], all: true, prefix: "emil-", rewriteRefs: true },
    { now: NOW },
  );
}

describe("reference rewriting", () => {
  const names = new Map([
    ["animate", "emil-animate"],
    ["choreograph", "emil-choreograph"],
  ]);

  test("slash commands and ../name/ paths move; URLs, code and longer names do not", () => {
    const text =
      "`/choreograph` /animate. ../animate/RECIPES.md https://x.dev/skills/animate " +
      "`transition`/`animate` /animate-expo src/animate";
    expect(rewriteRefs(text, names)).toBe(
      "`/emil-choreograph` /emil-animate. ../emil-animate/RECIPES.md https://x.dev/skills/animate " +
        "`transition`/`animate` /animate-expo src/animate",
    );
  });

  test("setName replaces the frontmatter name only, keeping CRLF", () => {
    expect(setName("---\r\nname: animate\r\ndescription: x\r\n---\r\nname: body\r\n", "emil-animate")).toBe(
      "---\r\nname: emil-animate\r\ndescription: x\r\n---\r\nname: body\r\n",
    );
  });

  test("parseSource maps GitHub shorthand and URLs, keeps other URLs", () => {
    expect(parseSource("emilkowalski/skills").sourceUrl).toBe("https://github.com/emilkowalski/skills.git");
    expect(parseSource("https://github.com/emilkowalski/skills.git").source).toBe("emilkowalski/skills");
    expect(parseSource("file:///tmp/x")).toEqual({
      source: "file:///tmp/x",
      sourceType: "git",
      sourceUrl: "file:///tmp/x",
    });
  });
});

describe("skillquarium add", () => {
  test("installs every skill under the prefix, rewritten, and records the upstream tree", () => {
    const { dir, url } = upstreamRepo();
    const root = vault();

    const added = addAll(root, url);

    expect(added).toEqual([
      ["emil-animate", "animate"],
      ["emil-choreograph", "choreograph"],
      ["emil-design-eng", "emil-design-eng"],
    ]);
    const skill = readFileSync(join(root, "skills/emil-animate/SKILL.md"), "utf8");
    expect(skill).toContain("name: emil-animate\n");
    expect(skill).toContain("`/emil-choreograph`, see ../emil-choreograph/SKILL.md.");
    expect(skill).toContain("https://example.dev/skills/choreograph and the `transition`/`animate` props.");
    expect(readFileSync(join(root, "skills/emil-animate/RECIPES.md"), "utf8")).toBe(
      "Stagger per ../emil-choreograph/SKILL.md.\n",
    );
    expect(readFileSync(join(root, "skills/emil-design-eng/SKILL.md"), "utf8")).toContain(
      "See /emil-animate.",
    );
    // the skills CLI's exclusions and permission bits
    expect(existsSync(join(root, "skills/emil-animate/metadata.json"))).toBe(false);
    expect(existsSync(join(root, "skills/emil-animate/__pycache__"))).toBe(false);
    // git checks out 100755 under the local umask, so only the executable bits are fixed
    expect(statSync(join(root, "skills/emil-animate/run.sh")).mode & 0o111).toBe(0o111);
    expect(statSync(join(root, "skills/emil-animate/SKILL.md")).mode & 0o111).toBe(0);

    const entry = loadRenamed(renamedPath(root))["emil-animate"];
    expect(entry).toEqual({
      upstreamName: "animate",
      source: url,
      sourceType: "git",
      sourceUrl: url,
      skillPath: "skills/animate/SKILL.md",
      skillFolderHash: git(dir, "rev-parse", "HEAD:skills/animate"),
      rewriteRefs: true,
      installedAt: "2026-11-25T00:00:00.000Z",
      updatedAt: "2026-11-25T00:00:00.000Z",
    });
  });

  test("--as renames one skill and leaves references alone without --rewrite-refs", () => {
    const { url } = upstreamRepo();
    const root = vault();
    addRenamed(root, {
      source: url,
      skills: ["Choreograph"],
      all: false,
      as: "group-motion",
      rewriteRefs: false,
    });
    const text = readFileSync(join(root, "skills/group-motion/SKILL.md"), "utf8");
    expect(text).toContain("name: group-motion\n");
    expect(text).toContain("Use `/animate` first.");
    expect(loadRenamed(renamedPath(root))["group-motion"]?.rewriteRefs).toBeUndefined();
  });

  test("an unknown name lists what the source has, and writes nothing", () => {
    const { url } = upstreamRepo();
    const root = vault();
    expect(() =>
      addRenamed(root, { source: url, skills: ["nope"], all: false, prefix: "emil-", rewriteRefs: false }),
    ).toThrow("available: animate, choreograph, emil-design-eng");
    expect(existsSync(renamedPath(root))).toBe(false);
  });

  test("a name already taken by a folder or a lock entry is refused before anything is written", () => {
    const { url } = upstreamRepo();
    const root = vault();
    mkdirSync(join(root, "skills/emil-choreograph"));
    expect(() => addAll(root, url)).toThrow("emil-choreograph: skills/emil-choreograph already exists");
    expect(existsSync(join(root, "skills/emil-animate"))).toBe(false);
    expect(() =>
      addRenamed(root, { source: url, skills: ["animate"], all: false, as: "taken", rewriteRefs: false }),
    ).toThrow("taken: already in .skill-lock.json");
  });
});

describe("skillquarium renamed", () => {
  const io = () => {
    const out: string[] = [];
    const err: string[] = [];
    return { out, err, sink: { out: (l: string) => out.push(l), err: (l: string) => err.push(l) } };
  };

  test("an unchanged upstream is current and local edits stay", () => {
    const { url } = upstreamRepo();
    const root = vault();
    addAll(root, url);
    write(join(root, "skills/emil-animate/SKILL.md"), "local override applied\n");

    const result = syncRenamed(root, true, { now: LATER });

    expect(result.current).toEqual(["emil-animate", "emil-choreograph", "emil-design-eng"]);
    expect(result.updated).toEqual([]);
    expect(readFileSync(join(root, "skills/emil-animate/SKILL.md"), "utf8")).toBe("local override applied\n");
  });

  test("a changed upstream folder is reinstalled, renamed, and its hash recorded", () => {
    const { dir, url } = upstreamRepo();
    const root = vault();
    addAll(root, url);
    write(join(root, "skills/emil-animate/stale.md"), "left from an old version\n");
    commitUpstream(
      dir,
      "skills/animate/SKILL.md",
      ANIMATE.replace("Build one animation.", "Build an animation."),
    );

    const result = syncRenamed(root, true, { now: LATER });

    expect(result.updated).toEqual(["emil-animate"]);
    expect(result.current).toEqual(["emil-choreograph", "emil-design-eng"]);
    const text = readFileSync(join(root, "skills/emil-animate/SKILL.md"), "utf8");
    expect(text).toContain("name: emil-animate\ndescription: Build an animation.");
    expect(text).toContain("`/emil-choreograph`");
    expect(existsSync(join(root, "skills/emil-animate/stale.md"))).toBe(false);
    const entry = loadRenamed(renamedPath(root))["emil-animate"];
    expect(entry?.skillFolderHash).toBe(git(dir, "rev-parse", "HEAD:skills/animate"));
    expect(entry?.updatedAt).toBe("2026-11-26T00:00:00.000Z");
    expect(entry?.installedAt).toBe("2026-11-25T00:00:00.000Z");
  });

  test("--check reports behind and exits 1 without writing", () => {
    const { dir, url } = upstreamRepo();
    const root = vault();
    addAll(root, url);
    const before = readFileSync(renamedPath(root), "utf8");
    commitUpstream(dir, "skills/choreograph/SKILL.md", "---\nname: choreograph\ndescription: v2\n---\n");
    const { out, sink } = io();

    expect(reportRenamed(syncRenamed(root, false), true, sink)).toBe(1);

    expect(out).toEqual([
      "renamed skills: 3 tracked, 2 current, 1 behind, 0 unreachable",
      "  behind: emil-choreograph",
    ]);
    expect(readFileSync(renamedPath(root), "utf8")).toBe(before);
    expect(readFileSync(join(root, "skills/emil-choreograph/SKILL.md"), "utf8")).toContain("Group motion.");
  });

  test("a folder deleted upstream is unreachable and kept", () => {
    const { dir, url } = upstreamRepo();
    const root = vault();
    addAll(root, url);
    commitUpstream(dir, "skills/choreograph", null);
    const { err, sink } = io();

    expect(reportRenamed(syncRenamed(root), false, sink)).toBe(0);

    expect(err).toEqual(["  UNREACHABLE: emil-choreograph — its skillPath no longer exists upstream"]);
    expect(existsSync(join(root, "skills/emil-choreograph/SKILL.md"))).toBe(true);
  });

  test("an unreachable source fails its skills and exits 1", () => {
    const root = vault();
    const skills: Renamed = {
      gone: {
        upstreamName: "x",
        source: "file:///nonexistent",
        sourceType: "git",
        sourceUrl: "file:///nonexistent/repo",
        skillPath: "x/SKILL.md",
        skillFolderHash: "0",
        installedAt: "t",
        updatedAt: "t",
      },
    };
    writeRenamed(renamedPath(root), skills);
    const { err, sink } = io();
    expect(reportRenamed(syncRenamed(root), false, sink)).toBe(1);
    expect(err[0]).toStartWith("  FAILED: gone — git clone file:///nonexistent/repo: ");
  });
});

describe("renamed skills in quarantine and drift", () => {
  test("quarantine restores a renamed skill's entry from HEAD, not the lock", () => {
    const { dir, url } = upstreamRepo();
    const root = vault();
    addAll(root, url);
    write(
      overridesPath(root),
      JSON.stringify({
        "emil-animate": [{ id: "fix", find: "Build one animation.", replace: "Build one animation well." }],
      }),
    );
    const skillMd = join(root, "skills/emil-animate/SKILL.md");
    write(
      skillMd,
      readFileSync(skillMd, "utf8").replace("Build one animation.", "Build one animation well."),
    );
    git(root, "init", "-q");
    git(root, "add", "-A");
    git(root, "commit", "-qm", "base");
    const committed = loadRenamed(renamedPath(root))["emil-animate"];
    const lockBefore = readFileSync(join(root, ".skill-lock.json"), "utf8");
    // upstream rewrites the overridden sentence, so the override goes stale
    commitUpstream(dir, "skills/animate/SKILL.md", ANIMATE.replace("Build one animation.", "Rewritten."));
    expect(syncRenamed(root, true, { now: LATER }).updated).toEqual(["emil-animate"]);

    expect(applyOrQuarantine(root, { out: () => {}, err: () => {} })).toBe(1);

    expect(loadRenamed(renamedPath(root))["emil-animate"]).toEqual(committed);
    expect(readFileSync(join(root, "skills/emil-animate/SKILL.md"), "utf8")).toContain(
      "Build one animation well.",
    );
    expect(readFileSync(join(root, ".skill-lock.json"), "utf8")).toBe(
      JSON.stringify(JSON.parse(lockBefore), null, 2),
    );
  });

  test("drift buckets extra entries with the lock's", async () => {
    const root = vault();
    const tree: RepoTree = { tree: [{ path: "skills/animate", sha: "new", type: "tree" }] };
    const { report } = await checkLock(
      join(root, ".skill-lock.json"),
      { repoTree: async () => tree },
      {
        "emil-animate": {
          source: "emilkowalski/skills",
          skillPath: "skills/animate/SKILL.md",
          skillFolderHash: "old",
        },
      },
    );
    expect(report.get("emilkowalski/skills")).toEqual({
      current: [],
      behind: ["emil-animate"],
      unreachable: [],
    });
  });
});
