import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  type Buckets,
  checkLock,
  type DriftReport,
  folderOf,
  pinnedProfiles,
  type RepoTree,
  render,
  runDrift,
} from "../../src/update/drift";

const created: string[] = [];

afterAll(() => {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "skillquarium-drift-"));
  created.push(dir);
  return dir;
}

function lockFile(root: string, skills: unknown): string {
  const path = join(root, ".skill-lock.json");
  writeFileSync(path, JSON.stringify({ version: 3, skills }), "utf8");
  return path;
}

/** The injected seam: a fixed tree, so no test touches the network. */
function stubTree(folders: Record<string, string>): () => Promise<RepoTree> {
  const tree = Object.entries(folders).map(([path, sha]) => ({ path, sha, type: "tree" }));
  return async () => ({ tree });
}

function reportOf(entries: [string, Buckets][]): DriftReport {
  return new Map(entries);
}

describe("folder resolution", () => {
  test("SKILL.md suffix is stripped case-insensitively", () => {
    expect(folderOf("skills/adaptyv/SKILL.md")).toBe("skills/adaptyv");
    expect(folderOf("skills/adaptyv/skill.md")).toBe("skills/adaptyv");
    expect(folderOf("skills\\adaptyv\\SKILL.md")).toBe("skills/adaptyv");
    expect(folderOf("skills/adaptyv/")).toBe("skills/adaptyv");
  });
});

describe("lock classification", () => {
  test("entries split into current, behind and unreachable", async () => {
    const root = tempRoot();
    const path = lockFile(root, {
      kept: { source: "o/r", skillPath: "skills/kept/SKILL.md", skillFolderHash: "aaa" },
      moved: { source: "o/r", skillPath: "skills/moved/SKILL.md", skillFolderHash: "old" },
      renamed: { source: "o/r", skillPath: "old-dir/renamed/SKILL.md", skillFolderHash: "ccc" },
    });

    const { report, errors } = await checkLock(path, {
      repoTree: stubTree({ "skills/kept": "aaa", "skills/moved": "bbb" }),
    });

    expect(errors).toEqual([]);
    expect(report.get("o/r")?.current).toEqual(["kept"]);
    expect(report.get("o/r")?.behind).toEqual(["moved"]);
    expect(report.get("o/r")?.unreachable).toEqual(["renamed"]);
  });

  test("an unreadable source is an error, not a silent pass", async () => {
    const root = tempRoot();
    const path = lockFile(root, {
      x: { source: "o/r", skillPath: "skills/x/SKILL.md", skillFolderHash: "a" },
    });

    const { report, errors } = await checkLock(path, { repoTree: async () => null });

    expect(report.size).toBe(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("o/r");
  });

  test("the drift count drives the exit code", () => {
    const clean = reportOf([["o/r", { current: ["a"], behind: [], unreachable: [] }]]);
    const dirty = reportOf([["o/r", { current: [], behind: ["a"], unreachable: ["b"] }]]);
    expect(render(clean, [], [])[1]).toBe(0);
    expect(render(dirty, [], [])[1]).toBe(2);
    expect(render(dirty, [], [])[0]).toContain("| `o/r` | 2 | 0 | 1 | 1 |");
    expect(render(clean, ["o/r: could not read the upstream git tree"], [])[0]).toContain("Errors:");
    const [text, drift] = render(
      clean,
      [],
      [{ repo: "k/s", commits: [["896ed6ed", 2]], head: "0123456789abcdef" }],
    );
    expect(drift).toBe(2);
    expect(text).toContain("- `k/s` — 2 skills pinned at `896ed6ed`, behind HEAD `0123456789ab`");
  });
});

describe("drift report", () => {
  test("--fail-on-drift exits 1 and the table lands in the job summary", async () => {
    const root = tempRoot();
    lockFile(root, {
      moved: { source: "o/r", skillPath: "skills/moved/SKILL.md", skillFolderHash: "old" },
    });
    const summary = join(root, "summary.md");
    const out: string[] = [];

    const code = await runDrift(
      root,
      { skipProfiles: true, failOnDrift: true },
      { out: (line) => out.push(line) },
      { repoTree: stubTree({ "skills/moved": "bbb" }), env: { GITHUB_STEP_SUMMARY: summary } },
    );

    expect(code).toBe(1);
    expect(out.join("\n")).toContain("**1 behind upstream, 0 unreachable**");
    expect(readFileSync(summary, "utf8").startsWith("## Upstream drift\n\n| source |")).toBe(true);
  });

  test("without --fail-on-drift the report exits 0", async () => {
    const root = tempRoot();
    lockFile(root, {
      moved: { source: "o/r", skillPath: "skills/moved/SKILL.md", skillFolderHash: "old" },
    });
    const code = await runDrift(
      root,
      { skipProfiles: true },
      { out: () => {} },
      { repoTree: stubTree({ "skills/moved": "bbb" }), env: {} },
    );
    expect(code).toBe(0);
  });
});

describe("pinned profiles", () => {
  test("frontmatter pins are grouped by repo and commit", () => {
    const root = tempRoot();
    for (const name of ["botanist", "geochemist"]) {
      const path = join(root, "skills", name, "SKILL.md");
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(
        path,
        `---\nname: ${name}\nmetadata:\n  source-repo: K-Dense-AI/scientific-agents\n` +
          "  source-commit: 896ed6ed\n---\n",
        "utf8",
      );
    }

    const pinned = pinnedProfiles(root);

    expect([...(pinned.get("K-Dense-AI/scientific-agents") ?? [])]).toEqual([["896ed6ed", 2]]);
  });
});
