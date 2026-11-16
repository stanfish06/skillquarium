import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { makeContext } from "../../src/cli";
import { changedSkills, parseTier1Args, runTier1, summarize } from "../../src/eval/tier1";
import {
  committedSkillTrees,
  entryFromReport,
  formatResults,
  loadTier1Views,
  parseResults,
  RESULTS_PATH,
  readResults,
  skillTrees,
  type Tier1Entry,
  writeResults,
} from "../../src/eval/tier1Results";

const FIXTURE = resolve(import.meta.dir, "../fixtures/tier1/report-failed.json");
const report = () => JSON.parse(readFileSync(FIXTURE, "utf8"));

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
function tempDir(): string {
  const d = mkdtempSync(join(tmpdir(), "tier1-test-"));
  dirs.push(d);
  return d;
}

function git(cwd: string, ...args: string[]): string {
  const p = Bun.spawnSync(["git", ...args], { cwd, stderr: "pipe" });
  if (p.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${p.stderr.toString()}`);
  return p.stdout.toString().trim();
}

// Vault with skills alpha, beta, broken committed on main.
function vault(): string {
  const root = tempDir();
  for (const name of ["alpha", "beta", "broken"]) {
    mkdirSync(join(root, "skills", name), { recursive: true });
    writeFileSync(join(root, "skills", name, "SKILL.md"), `---\nname: ${name}\ndescription: d\n---\nbody\n`);
  }
  git(root, "init", "-q", "-b", "main");
  git(root, "-c", "user.email=t@t", "-c", "user.name=t", "add", "-A");
  git(root, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "init");
  return root;
}

// Stands in for uvx skillevaluator: copies the fixture report, or exits without one for "broken".
function fakeEvaluator(dir: string) {
  const script = join(dir, "fake-evaluator.ts");
  writeFileSync(
    script,
    `const [skill, out] = process.argv.slice(2);
if (skill === "broken") { console.error("boom"); process.exit(3); }
await Bun.write(out + "/skillevaluator-tier1.json", Bun.file(${JSON.stringify(FIXTURE)}));
process.exit(1);
`,
  );
  return (skill: string, out: string) => [process.execPath, script, skill, out];
}

function capture(root: string) {
  const out: string[] = [];
  const err: string[] = [];
  const ctx = makeContext(root, false, { out: (l) => out.push(l), err: (l) => err.push(l) });
  return { ctx, out, err };
}

describe("entryFromReport", () => {
  test("keeps verdict, score, failed checks and the top five issues by severity", () => {
    const e = entryFromReport("scanpy", "abc", report());
    expect(e.status).toBe("failed");
    expect([e.score, e.grade, e.evaluator]).toEqual([77.5, "C", "0.9.0"]);
    expect(e.failedChecks).toEqual(["Schema & Repository Governance", "Semantic Version Validation"]);
    expect(e.incompleteChecks).toEqual([]);
    expect(e.severity).toEqual({ critical: 0, high: 2, medium: 12, low: 16, info: 0 });
    expect(e.issues).toHaveLength(5);
    expect(e.issues.slice(0, 2).map((i) => i.severity)).toEqual(["high", "high"]);
    expect(Object.keys(e.issues[0] as object)).toEqual(["severity", "category", "message"]);
  });

  test("an unknown overall status counts as failed; incomplete is kept", () => {
    expect(entryFromReport("s", null, { ...report(), overall_status: "weird" }).status).toBe("failed");
    expect(entryFromReport("s", null, { ...report(), overall_status: "incomplete" }).status).toBe(
      "incomplete",
    );
  });

  test("rejects a report without the fields it reads", () => {
    expect(() => entryFromReport("s", null, { version: "0.9.0" })).toThrow();
  });
});

describe("parseTier1Args", () => {
  test("normalizes skill paths and parses shards", () => {
    const o = parseTier1Args(["skills/alpha/", "./skills/beta", "gamma", "--jobs", "2"]);
    expect(o.skills).toEqual(["alpha", "beta", "gamma"]);
    expect(o.jobs).toBe(2);
    expect(parseTier1Args(["--all", "--shard", "2/5"]).shard).toEqual({ k: 2, n: 5 });
  });

  test("needs exactly one selection mode", () => {
    expect(() => parseTier1Args([])).toThrow("exactly one");
    expect(() => parseTier1Args(["--all", "alpha"])).toThrow("exactly one");
    expect(() => parseTier1Args(["--all", "--shard", "6/5"])).toThrow("--shard");
    expect(() => parseTier1Args(["--changed"])).toThrow("requires a value");
    expect(parseTier1Args(["--merge", "a.jsonl", "b.jsonl"]).merge).toEqual(["a.jsonl", "b.jsonl"]);
  });
});

describe("results file", () => {
  const entry = (skill: string, score: number): Tier1Entry => ({
    ...entryFromReport(skill, "t", report()),
    score,
  });

  test("merges updates, drops removed skills, and writes sorted lines", () => {
    const file = join(tempDir(), "results.jsonl");
    writeResults(file, [entry("b", 1), entry("gone", 2)], new Set(["a", "b", "gone"]));
    const merged = writeResults(file, [entry("a", 3), entry("b", 4)], new Set(["a", "b"]));
    expect([...merged.keys()].sort()).toEqual(["a", "b"]);
    const text = readFileSync(file, "utf8");
    expect(
      text
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l).skill),
    ).toEqual(["a", "b"]);
    expect(readResults(file).get("b")?.score).toBe(4);
    expect(formatResults(parseResults(text).values())).toBe(text);
  });

  test("names the bad line", () => {
    expect(() => parseResults(`${JSON.stringify(entry("a", 1))}\n{"skill":1}\n`)).toThrow("line 2");
  });
});

describe("summarize", () => {
  test("orders worst first and caps nothing below 200 rows", () => {
    const failed = entryFromReport("zeta", null, report());
    const passed = { ...failed, skill: "alpha", status: "passed" as const, failedChecks: [], score: 95 };
    const md = summarize([passed, failed], "Tier 1");
    expect(md).toContain("2 skills · 1 passed · 1 failed · 0 incomplete · 0 errors");
    expect(md).toContain("| Schema & Repository Governance | 1 |");
    expect(md.indexOf("`zeta`")).toBeLessThan(md.indexOf("`alpha`"));
  });
});

describe("runTier1", () => {
  test("scans changed skills, records results, and fails only on evaluator errors", async () => {
    const root = vault();
    writeFileSync(join(root, "skills", "alpha", "SKILL.md"), "---\nname: alpha\ndescription: changed\n---\n");
    writeFileSync(
      join(root, "skills", "broken", "SKILL.md"),
      "---\nname: broken\ndescription: changed\n---\n",
    );
    const stepSummary = join(tempDir(), "summary.md");
    process.env.GITHUB_STEP_SUMMARY = stepSummary;
    try {
      const { ctx, err } = capture(root);
      const out = join(tempDir(), "out");
      const { code, entries } = await runTier1(
        { ...parseTier1Args(["--changed", "main", "--out", out]) },
        ctx,
        fakeEvaluator(tempDir()),
      );
      expect(code).toBe(1);
      expect(entries.map((e) => [e.skill, e.status])).toEqual([
        ["alpha", "failed"],
        ["broken", "error"],
      ]);
      expect(entries[1]?.error).toContain("exit 3");
      expect(entries[1]?.error).toContain("boom");
      expect(err.join("\n")).toContain("error: broken");
      expect(readFileSync(join(out, "broken", "log.txt"), "utf8")).toContain("boom");
      expect(readFileSync(stepSummary, "utf8")).toContain("2 skills · 0 passed · 1 failed");

      const recorded = readResults(join(root, "eval/tier1/results.jsonl"));
      expect([...recorded.keys()]).toEqual(["alpha", "broken"]);
      // the tree is the working-tree content, so the uncommitted edit counts as scanned
      expect(recorded.get("alpha")?.tree).toBe(skillTrees(root).get("alpha") as string);
      expect(loadTier1Views(root).get("alpha")?.stale).toBe(false);

      writeFileSync(join(root, "skills", "alpha", "extra.md"), "new file\n");
      expect(loadTier1Views(root).get("alpha")?.stale).toBe(true);
    } finally {
      delete process.env.GITHUB_STEP_SUMMARY;
    }
  });

  test("no changed skills writes an empty result and exits 0", async () => {
    const root = vault();
    const { ctx, out } = capture(root);
    const dir = join(tempDir(), "out");
    const { code } = await runTier1(
      parseTier1Args(["--changed", "main", "--out", dir]),
      ctx,
      fakeEvaluator(tempDir()),
    );
    expect(code).toBe(0);
    expect(out).toContain("no skills to scan");
    expect(readFileSync(join(dir, "summary.md"), "utf8")).toContain("No skills changed.");
  });

  test("shards split --all and --merge combines them", async () => {
    const root = vault();
    const evaluator = fakeEvaluator(tempDir());
    const parts: string[] = [];
    for (const shard of ["1/2", "2/2"]) {
      const { ctx } = capture(root);
      const out = join(tempDir(), shard.replace("/", "-"));
      await runTier1(
        parseTier1Args(["--all", "--shard", shard, "--no-record", "--out", out]),
        ctx,
        evaluator,
      );
      parts.push(join(out, "results.jsonl"));
    }
    expect(parts.map((p) => [...parseResults(readFileSync(p, "utf8")).keys()])).toEqual([
      ["alpha", "broken"],
      ["beta"],
    ]);
    expect(readResults(join(root, "eval/tier1/results.jsonl")).size).toBe(0);

    const { ctx } = capture(root);
    await runTier1(parseTier1Args(["--merge", ...parts]), ctx);
    expect([...readResults(join(root, "eval/tier1/results.jsonl")).keys()]).toEqual([
      "alpha",
      "beta",
      "broken",
    ]);
  });

  test("a report left in a reused --out does not stand in for a failed run", async () => {
    const root = vault();
    const out = join(tempDir(), "out");
    mkdirSync(join(out, "broken"), { recursive: true });
    writeFileSync(join(out, "broken", "skillevaluator-tier1.json"), readFileSync(FIXTURE));
    const { ctx } = capture(root);
    const { entries } = await runTier1(
      parseTier1Args(["broken", "--no-record", "--out", out]),
      ctx,
      fakeEvaluator(tempDir()),
    );
    expect(entries.map((e) => e.status)).toEqual(["error"]);
  });

  test("a file moved between skills selects both", () => {
    const root = vault();
    writeFileSync(join(root, "skills", "alpha", "helper.py"), "print('a')\n");
    git(root, "-c", "user.email=t@t", "-c", "user.name=t", "add", "-A");
    git(root, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "helper");
    git(root, "branch", "base");
    git(root, "mv", "skills/alpha/helper.py", "skills/beta/helper.py");
    expect(changedSkills(root, "base")).toEqual(["alpha", "beta"]);
  });

  test("an uncommitted toggle leaves a scan of the committed skill current", () => {
    const root = vault();
    const tree = committedSkillTrees(root).get("alpha") as string;
    mkdirSync(join(root, "eval/tier1"), { recursive: true });
    writeResults(join(root, RESULTS_PATH), [entryFromReport("alpha", tree, report())], new Set(["alpha"]));
    writeFileSync(
      join(root, "skills", "alpha", "SKILL.md"),
      "---\nname: alpha\ndescription: d\ndisable-model-invocation: true\n---\nbody\n",
    );
    expect(loadTier1Views(root).get("alpha")?.stale).toBe(false);
  });

  test("an unknown skill name is rejected before any scan", async () => {
    const root = vault();
    const { ctx } = capture(root);
    const failure = await runTier1(parseTier1Args(["nope"]), ctx, fakeEvaluator(tempDir())).catch((e) => e);
    expect(String(failure)).toContain("unknown skill: nope");
  });
});
