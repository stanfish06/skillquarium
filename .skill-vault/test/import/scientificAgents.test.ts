import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { makeContext } from "../../src/cli";
import { evalPlan, run as evalRun } from "../../src/evalCommand";
import {
  type Agent,
  applyLocalPatches,
  catalogProfilePath,
  compactDescription,
  folded,
  importScientificAgents,
  loadLocalPatches,
  PATCHES_PATH,
  type PatchMap,
  renderSkill,
  resolveProfilePath,
} from "../../src/import/scientificAgents";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const temps: string[] = [];

afterAll(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function temp(prefix = "skillquarium-import-"): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

function write(path: string, text: string): string {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
  return path;
}

describe("applyLocalPatches", () => {
  const rendered = [
    "---",
    "name: fusion-scientist",
    "metadata:",
    "  source-commit: abc123",
    "  scientific-agents-profile: true",
    "---",
    "",
    "Imported from upstream at commit `abc123`.",
    "",
    "ITER uses **beryllium** first wall and **tungsten** divertor; carbon is retired.",
    "",
  ].join("\n");
  const patches: PatchMap = {
    "fusion-scientist": [
      {
        id: "iter-2024-tungsten-first-wall",
        find: "ITER uses **beryllium** first wall and **tungsten** divertor",
        replace: "ITER's 2024 baseline specifies **tungsten** armour for the first wall and divertor",
      },
    ],
  };

  test("replaces text, records ids, stamps metadata and the overlay note", () => {
    const { text, applied } = applyLocalPatches(rendered, "fusion-scientist", patches);

    expect(applied).toEqual(["iter-2024-tungsten-first-wall"]);
    expect(text).toContain("tungsten** armour for the first wall and divertor");
    expect(text).not.toContain("beryllium** first wall");
    expect(text).toContain(
      "  scientific-agents-profile: true\n  local-patches:\n    - iter-2024-tungsten-first-wall\n",
    );
    expect(text).toContain("vault overlays, not upstream text");
  });

  test("leaves a slug with no patch entries unchanged", () => {
    const other = "---\nname: other\n---\n\nno match\n";
    const { text, applied } = applyLocalPatches(other, "other", patches);

    expect(applied).toEqual([]);
    expect(text).toBe(other);
  });

  // Unlike `update overrides`, a patch whose anchor is gone is skipped instead of failing:
  // upstream fixing the text itself must not break the next import.
  test("skips an entry whose find text is absent", () => {
    const stale: PatchMap = {
      "fusion-scientist": [{ id: "stale", find: "text upstream no longer has", replace: "x" }],
    };
    const { text, applied } = applyLocalPatches(rendered, "fusion-scientist", stale);

    expect(applied).toEqual([]);
    expect(text).toBe(rendered);
    expect(text).not.toContain("local-patches:");
  });

  test("stamps after the frontmatter when the profile marker is absent", () => {
    const bare =
      "---\nname: fusion-scientist\n---\n\nITER uses **beryllium** first wall and **tungsten** divertor.\n";
    const { text, applied } = applyLocalPatches(bare, "fusion-scientist", patches);

    expect(applied).toEqual(["iter-2024-tungsten-first-wall"]);
    expect(
      text.startsWith(
        "---\nname: fusion-scientist\n---\n  local-patches:\n    - iter-2024-tungsten-first-wall\n\n",
      ),
    ).toBe(true);
  });
});

describe("loadLocalPatches", () => {
  test("defaults to .skill-vault/data/scientific-agent-patches.json", () => {
    expect(PATCHES_PATH).toBe(join(REPO_ROOT, ".skill-vault/data/scientific-agent-patches.json"));
    const patches = loadLocalPatches();
    expect(patches["fusion-scientist"]?.[0]?.id).toBe("iter-2024-tungsten-first-wall");
  });

  test("reads an explicit path and returns {} when the file is missing", () => {
    const dir = temp();
    const path = write(
      join(dir, "scientific-agent-patches.json"),
      JSON.stringify({
        "fusion-scientist": [{ id: "iter-2024-tungsten-first-wall", find: "a", replace: "b" }],
      }),
    );

    expect(loadLocalPatches(path)["fusion-scientist"]?.[0]?.id).toBe("iter-2024-tungsten-first-wall");
    expect(loadLocalPatches(join(dir, "absent.json"))).toEqual({});
  });

  test("rejects a non-object patches file", () => {
    const path = write(join(temp(), "patches.json"), "[]");
    expect(() => loadLocalPatches(path)).toThrow("object keyed by skill slug");
  });
});

describe("folded", () => {
  test("wraps at 88 columns under a 2-space indent", () => {
    const text =
      "Expert-thinking profile for Accelerator Physicist (experimental / beam physics): " +
      "Reasons from beam optics, RF cavities, emittance budgets, and loss maps while treating " +
      "halo and impedance-driven instabilities as first-class failure modes.";

    const lines = folded(text).split("\n");

    expect(lines).toEqual([
      "  Expert-thinking profile for Accelerator Physicist (experimental / beam physics):",
      "  Reasons from beam optics, RF cavities, emittance budgets, and loss maps while treating",
      "  halo and impedance-driven instabilities as first-class failure modes.",
    ]);
    for (const line of lines) {
      expect(line.startsWith("  ")).toBe(true);
      expect(line.length).toBeLessThanOrEqual(88);
    }
  });

  test("breaks an over-long word, after its last hyphen when it has one", () => {
    // The hyphen is followed by digits, so the word is one chunk wider than the line.
    expect(folded(`${"a".repeat(60)}-${"1".repeat(40)}`).split("\n")).toEqual([
      `  ${"a".repeat(60)}-`,
      `  ${"1".repeat(40)}`,
    ]);
    expect(folded("x".repeat(100)).split("\n")).toEqual([`  ${"x".repeat(86)}`, `  ${"x".repeat(14)}`]);
  });
});

describe("compactDescription", () => {
  const base: Agent = { slug: "x", profession: "Statistician" };

  test("keeps whole words when truncating the summary at 320 characters", () => {
    const summary = `${"abcdefghij ".repeat(40)}tail.`;
    const desc = compactDescription({ ...base, summary });
    const truncated = desc.slice("Expert-thinking profile for Statistician: ".length);

    expect(truncated.endsWith("...")).toBe(true);
    expect(truncated.length).toBeLessThanOrEqual(323);
    expect(truncated.slice(0, -3).endsWith("abcdefghij")).toBe(true);
    expect(summary.startsWith(truncated.slice(0, -3))).toBe(true);
  });

  test("truncates work mode at 140 characters and drops trailing separators", () => {
    const workMode = `${"computational ".repeat(12)}/ extra`;
    const desc = compactDescription({ ...base, work_mode: workMode });
    const parenthetical = desc.slice(desc.indexOf("(") + 1, desc.lastIndexOf(")"));

    expect(parenthetical.endsWith("computational...")).toBe(true);
    expect(parenthetical.length).toBeLessThanOrEqual(143);
  });

  test("omits an empty work mode and summary, collapsing inner whitespace", () => {
    expect(compactDescription(base)).toBe("Expert-thinking profile for Statistician");
    expect(
      compactDescription({ ...base, work_mode: " applied\n  stats ", summary: "  Counts\tthings. " }),
    ).toBe("Expert-thinking profile for Statistician (applied stats): Counts things.");
  });
});

describe("catalog path safety", () => {
  test("rejects an absolute path", () => {
    expect(() => catalogProfilePath({ slug: "bad", profession: "X", path: "/etc/passwd" })).toThrow(
      "Unsafe catalog path for bad: /etc/passwd",
    );
  });

  test("rejects a parent-directory escape", () => {
    expect(() => catalogProfilePath({ slug: "bad", profession: "X", path: "../../etc/passwd" })).toThrow(
      "Unsafe catalog path for bad: ../../etc/passwd",
    );
  });

  test("defaults to <slug>/AGENTS.md and normalizes the catalog path", () => {
    expect(catalogProfilePath({ slug: "alpha", profession: "X" })).toBe("alpha/AGENTS.md");
    expect(catalogProfilePath({ slug: "alpha", profession: "X", path: "./alpha//AGENTS.md" })).toBe(
      "alpha/AGENTS.md",
    );
  });

  test("falls back to the nested layout and names both candidates when absent", () => {
    const source = temp();
    const agent: Agent = { slug: "alpha", profession: "X" };
    expect(() => resolveProfilePath(source, agent)).toThrow(
      `alpha/AGENTS.md for alpha (tried: ${join(source, "alpha/AGENTS.md")}, ${join(source, "scientific-agents/alpha/AGENTS.md")})`,
    );

    write(join(source, "scientific-agents/alpha/AGENTS.md"), "body\n");
    expect(resolveProfilePath(source, agent)).toBe(join(source, "scientific-agents/alpha/AGENTS.md"));
  });
});

describe("renderSkill parity with the committed tree", () => {
  test("accelerator-physicist round-trips byte for byte", () => {
    const catalog = JSON.parse(
      readFileSync(join(REPO_ROOT, "skills/scientific-agents/references/catalog.json"), "utf8"),
    ) as { agents: Agent[] };
    const agent = catalog.agents.find((a) => a.slug === "accelerator-physicist");
    expect(agent).toBeDefined();
    if (!agent) return;

    // The tree carries whatever toggle state the user has loaded; renderSkill never emits that
    // field, so drop it before comparing rather than pinning the test to one toggle state.
    const committed = readFileSync(join(REPO_ROOT, "skills/accelerator-physicist/SKILL.md"), "utf8").replace(
      "disable-model-invocation: true\n",
      "",
    );
    const commit = committed.split("  source-commit: ")[1]?.split("\n")[0] ?? "";
    const marker = "\n## Imported Profile\n\n";
    const body = committed.slice(committed.indexOf(marker) + marker.length);

    expect(renderSkill(agent, body, commit)).toBe(committed);
  });
});

describe("importScientificAgents", () => {
  function sourceTree(): string {
    const source = temp("skillquarium-import-src-");
    write(
      join(source, "catalog.json"),
      JSON.stringify({
        agents: [
          {
            profession: "Alpha Physicist",
            slug: "alpha-physicist",
            path: "alpha-physicist/AGENTS.md",
            work_mode: "theory / simulation",
            summary: "Reasons about alpha particles.",
            created: "2026-06-02",
            updated: "2026-06-03",
            source_count: 7,
          },
          { profession: "Beta Chemist", slug: "beta-chemist", summary: "Reasons about beta decay." },
        ],
      }),
    );
    write(join(source, "alpha-physicist/AGENTS.md"), "# AGENTS.md - Alpha\n\nAlpha decays are slow.\n\n\n");
    write(join(source, "scientific-agents/beta-chemist/AGENTS.md"), "# AGENTS.md - Beta\n");
    write(join(source, "README.md"), "upstream readme\n");
    write(join(source, "LICENSE.md"), "upstream license\n");
    utimesSync(join(source, "README.md"), new Date(1e9), new Date(1e9));
    return source;
  }

  test("writes a profile per agent, the dispatcher, and the copied references", () => {
    const source = sourceTree();
    const dest = temp("skillquarium-import-dest-");

    const result = importScientificAgents(source, dest, {
      "alpha-physicist": [
        { id: "alpha-decay-rate", find: "Alpha decays are slow.", replace: "Alpha decay is fast." },
      ],
    });

    expect(result.count).toBe(2);
    expect(result.commit).toBe("unknown");
    expect(result.patched).toEqual(["alpha-physicist (alpha-decay-rate)"]);

    const alpha = readFileSync(join(dest, "alpha-physicist/SKILL.md"), "utf8");
    expect(alpha).toContain("name: alpha-physicist\n");
    expect(alpha).toContain("  source-path: alpha-physicist/AGENTS.md\n");
    expect(alpha).toContain("  source-count: 7\n");
    expect(alpha).toContain("  local-patches:\n    - alpha-decay-rate\n");
    expect(alpha).toContain("vault overlays, not upstream text");
    // The upstream body is right-stripped and closed with a single newline.
    expect(alpha.endsWith("## Imported Profile\n\n# AGENTS.md - Alpha\n\nAlpha decay is fast.\n")).toBe(true);

    const beta = readFileSync(join(dest, "beta-chemist/SKILL.md"), "utf8");
    expect(beta).toContain("  source-path: beta-chemist/AGENTS.md\n");
    expect(beta).toContain("- Work mode: unspecified\n");
    expect(beta).toContain("- Upstream source count: unknown\n");

    const dispatcher = readFileSync(join(dest, "scientific-agents/SKILL.md"), "utf8");
    expect(dispatcher).toContain("This skill indexes 2 expert-thinking profiles imported from");
    expect(dispatcher).toContain("- `alpha-physicist` - Alpha Physicist: Reasons about alpha particles.");
    expect(dispatcher).not.toContain("more profiles in references/catalog.json");

    for (const name of ["catalog.json", "README.md", "LICENSE.md"]) {
      expect(readFileSync(join(dest, "scientific-agents/references", name), "utf8")).toBe(
        readFileSync(join(source, name), "utf8"),
      );
    }
    expect(statSync(join(dest, "scientific-agents/references/README.md")).mtimeMs).toBe(
      statSync(join(source, "README.md")).mtimeMs,
    );
  });

  test("validates every catalog path before writing anything", () => {
    const source = temp("skillquarium-import-src-");
    write(
      join(source, "catalog.json"),
      JSON.stringify({
        agents: [
          { profession: "Alpha", slug: "alpha", path: "alpha/AGENTS.md" },
          { profession: "Escape", slug: "escape", path: "../outside/AGENTS.md" },
        ],
      }),
    );
    write(join(source, "alpha/AGENTS.md"), "body\n");
    const dest = temp("skillquarium-import-dest-");

    expect(() => importScientificAgents(source, dest, {})).toThrow("Unsafe catalog path for escape");
    expect(() => statSync(join(dest, "alpha"))).toThrow();
  });
});

describe("evalPlan", () => {
  const cwd = join("/vault", "eval");

  test("defaults to run and installs dependencies first", () => {
    expect(evalPlan("/vault", [])).toEqual({
      cwd,
      steps: [
        { argv: ["mise", "trust", "--quiet", "."], optional: true },
        { argv: ["mise", "run", "setup"] },
        { argv: ["mise", "exec", "--", "bun", "run", "src/cli.ts", "run"] },
      ],
    });
    expect(evalPlan("/vault", ["run", "--concurrency", "2"])?.steps.at(-1)?.argv).toEqual([
      "mise",
      "exec",
      "--",
      "bun",
      "run",
      "src/cli.ts",
      "run",
      "--concurrency",
      "2",
    ]);
  });

  test("selftest sets up but forwards nothing", () => {
    expect(evalPlan("/vault", ["selftest", "ignored"])?.steps).toEqual([
      { argv: ["mise", "trust", "--quiet", "."], optional: true },
      { argv: ["mise", "run", "setup"] },
      { argv: ["mise", "exec", "--", "bun", "run", "src/cli.ts", "selftest"] },
    ]);
  });

  test("replay and report forward a run id without setup", () => {
    for (const sub of ["replay", "report"]) {
      expect(evalPlan("/vault", [sub, "20260102-030405"])?.steps).toEqual([
        { argv: ["mise", "trust", "--quiet", "."], optional: true },
        { argv: ["mise", "exec", "--", "bun", "run", "src/cli.ts", sub, "20260102-030405"] },
      ]);
    }
  });

  test("runs takes no arguments", () => {
    expect(evalPlan("/vault", ["runs", "extra"])?.steps.at(-1)?.argv).toEqual([
      "mise",
      "exec",
      "--",
      "bun",
      "run",
      "src/cli.ts",
      "runs",
    ]);
  });

  test("unknown subcommand has no plan and exits 2 with the usage line", async () => {
    expect(evalPlan("/vault", ["bogus"])).toBeNull();

    const err: string[] = [];
    const ctx = makeContext("/vault", false, { err: (line) => err.push(line) });
    expect(await evalRun(["bogus"], ctx)).toBe(2);
    expect(err[0]).toBe("skillquarium eval: unknown subcommand 'bogus'");
    expect(err[1]).toBe("usage: skillquarium eval [run|replay|report|runs|selftest] [runId]");
  });
});
