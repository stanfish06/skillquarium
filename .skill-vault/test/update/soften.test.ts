import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { softenVault } from "../../src/update/soften";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const created: string[] = [];

afterAll(() => {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "skillquarium-soften-"));
  created.push(dir);
  return dir;
}

function writeSkill(root: string, name: string, description: string, body = "# Body\nMUST stay.\n"): string {
  const folder = join(root, "skills", name);
  mkdirSync(folder, { recursive: true });
  const path = join(folder, "SKILL.md");
  writeFileSync(path, `---\nname: ${name}\n${description}---\n\n${body}`, "utf8");
  return path;
}

/** The Python test's own frontmatter reader, so the port is not checked against itself. */
function descriptionOf(path: string): string {
  const text = readFileSync(path, "utf8");
  expect(text.startsWith("---\n")).toBe(true);
  const frontmatter = text.split("\n---\n", 1)[0] ?? "";
  const out: string[] = [];
  let capturing = false;
  for (const line of frontmatter.split("\n").slice(1)) {
    if (line.startsWith("description:")) {
      const rest = line.slice("description:".length).trim();
      if ([">", ">-", ">+", "|", "|-", "|+"].includes(rest)) {
        capturing = true;
        continue;
      }
      if (rest.startsWith('"') && rest.endsWith('"')) return rest.slice(1, -1).replaceAll('\\"', '"');
      return rest;
    }
    if (capturing) {
      if (line.startsWith("  ")) out.push(line.trim());
      else if (line.trim() === "") continue;
      else break;
    }
  }
  return out.join(" ");
}

function run(root: string, dryRun = false): { out: string[]; err: string[]; code: number } {
  const out: string[] = [];
  const err: string[] = [];
  const code = softenVault(root, { dryRun }, { out: (l) => out.push(l), err: (l) => err.push(l) });
  return { out, err, code };
}

describe("soften skill descriptions", () => {
  test("softens MUST, ALWAYS and MANDATORY catalog copy", () => {
    const root = tempRoot();
    const figma = writeSkill(
      root,
      "figma-use",
      'description: "**MANDATORY prerequisite** — you MUST invoke this skill BEFORE every `use_figma` tool call. NEVER call `use_figma` directly without loading this skill first. Trigger whenever the user wants to edit nodes."\n',
    );
    const brain = writeSkill(
      root,
      "brainstorming",
      'description: "You MUST use this before any creative work - creating features."\n',
    );
    const superpowers = writeSkill(
      root,
      "using-superpowers",
      "description: Use when starting any conversation - establishes how to find and use skills, requiring Skill tool invocation before ANY response including clarifying questions\n",
    );
    const shopify = writeSkill(
      root,
      "shopify-custom-data",
      'description: "MUST be used first when prompts mention Metafields or Metaobjects."\n',
    );
    const resources = writeSkill(
      root,
      "get-available-resources",
      "description: This skill should be used at the start of any computationally intensive scientific task to detect GPUs.\n",
    );
    const aeon = writeSkill(
      root,
      "aeon",
      "description: This skill should be used for time series machine learning tasks including classification.\n",
    );
    const runTests = writeSkill(
      root,
      "run-tests",
      "description: >\n  Recommend the exact dotnet test command. ALWAYS use when the\n  user asks to run .NET tests.\n",
    );
    const briefing = writeSkill(
      root,
      "morning-briefing",
      'description: "Generates a morning briefing. Use this skill whenever someone asks. Trigger broadly — if someone wants a summary, this skill should activate."\n',
    );
    const base44 = writeSkill(
      root,
      "base44-cli",
      'description: "The base44 CLI is used for EVERYTHING related to base44 projects. When you plan or implement a feature, you must learn this skill"\n',
    );
    const untouched = writeSkill(
      root,
      "pandas",
      "description: Use when working with tabular data in Python.\n",
      "# Body\nYou MUST follow pandas dtypes.\n",
    );

    const first = run(root);
    expect(first.code).toBe(0);
    expect(first.out).toContain("softened 9 skill descriptions");

    const figmaDescription = descriptionOf(figma);
    expect(figmaDescription).not.toContain("MANDATORY");
    expect(figmaDescription).not.toContain("MUST invoke");
    expect(figmaDescription).not.toContain("NEVER call");
    expect(figmaDescription).toContain("Load this skill before every");
    expect(figmaDescription).toContain("`use_figma`");

    expect(descriptionOf(brain).startsWith("Use before")).toBe(true);
    expect(descriptionOf(brain)).not.toContain("MUST");

    const sp = descriptionOf(superpowers);
    expect(sp.toLowerCase()).not.toContain("any conversation");
    expect(sp).not.toContain("ANY response");
    expect(sp).toContain("discovering which skill applies");

    expect(descriptionOf(shopify).startsWith("Use first when")).toBe(true);
    expect(descriptionOf(resources)).toContain("Use at the start of");
    expect(descriptionOf(aeon).startsWith("Use for time series")).toBe(true);
    expect(descriptionOf(runTests)).not.toMatch(/always use/i);
    expect(descriptionOf(runTests)).toContain("Use when the user asks");

    const briefingDescription = descriptionOf(briefing);
    expect(briefingDescription).not.toContain("Trigger broadly");
    expect(briefingDescription).not.toContain("this skill should activate");

    const base44Description = descriptionOf(base44);
    expect(base44Description).not.toContain("EVERYTHING");
    expect(base44Description.toLowerCase()).not.toContain("must learn");

    // A clean description is left byte for byte, and coercive body copy survives.
    expect(descriptionOf(untouched)).toBe("Use when working with tabular data in Python.");
    expect(readFileSync(untouched, "utf8")).toContain("You MUST follow pandas dtypes.");

    const again = run(root);
    expect(again.code).toBe(0);
    expect(again.out).toContain("softened 0 skill descriptions");
  });

  test("softens upper-case priority claims and keeps domain rules and skill ordering", () => {
    const root = tempRoot();
    const webGuidance = writeSkill(
      root,
      "modern-web-guidance",
      "description: |\n  Search tool for modern web development best practices. MANDATORY: Execute FIRST for all HTML/CSS and clientside JS tasks. Do NOT skip — web APIs evolve rapidly and training weights contain obsolete patterns.\n  Trigger immediately for: modals/dialogs/popovers, tables, dark mode.\n  DO NOT trigger for: backend (SQL, ORMs, API routes).\n",
    );
    const ownership = writeSkill(
      root,
      "m01-ownership",
      'description: "CRITICAL: Use for ownership/borrow/lifetime issues. Triggers: E0382, E0597."\n',
    );
    const router = writeSkill(
      root,
      "rust-router",
      "description: |-\n  CRITICAL: Use for ALL Rust questions including errors, design, and coding.\n  HIGHEST PRIORITY for: compare, vs, best practice.\n",
    );
    const clickhouse = writeSkill(
      root,
      "clickhouse-best-practices",
      "description: MUST USE when reviewing ClickHouse schemas. Contains 31 rules that MUST be checked before providing recommendations.\n",
    );
    const dashboards = writeSkill(
      root,
      "databricks-aibi-dashboards",
      'description: "Create Databricks AI/BI dashboards. Must use when creating Lakeview dashboards. CRITICAL: You MUST test ALL SQL queries via CLI BEFORE deploying."\n',
    );
    const rag = writeSkill(
      root,
      "langchain-rag",
      'description: "INVOKE THIS SKILL when building ANY retrieval-augmented generation (RAG) system."\n',
    );
    const primer = writeSkill(
      root,
      "ecosystem-primer",
      'description: "INVOKE FIRST for any LangChain project before consulting other skills."\n',
    );
    const hydrogen = writeSkill(
      root,
      "shopify-hydrogen",
      "description: \"Hydrogen storefront cookbooks. MANDATORY: Use this API for ANY Hydrogen storefront question - do NOT use Storefront GraphQL when 'Hydrogen' is mentioned.\"\n",
    );
    const untested = writeSkill(
      root,
      "find-untested-sources",
      "description: >\n  MANDATORY for static source-to-test pairing: find source files without\n  corresponding tests. Invoke even for a tiny package.\n",
    );
    // Ordering between skills and ANY as scope are legitimate catalog copy.
    const ordering = writeSkill(
      root,
      "databricks-core",
      "description: Load this first for CLI, auth, profile, and bundle tasks, then load the matching product skill.\n",
    );
    const scope = writeSkill(
      root,
      "supabase",
      'description: "Use when doing ANY task involving Supabase."\n',
    );
    const first = writeSkill(
      root,
      "twilio-numbers-senders",
      "description: Use this skill first when buying numbers.\n",
    );
    const untouchedBefore = [ordering, scope, first].map((path) => readFileSync(path, "utf8"));

    const result = run(root);
    expect(result.code).toBe(0);
    expect(result.out).toContain("softened 9 skill descriptions");

    const web = descriptionOf(webGuidance);
    for (const phrase of ["MANDATORY", "Execute FIRST", "Do NOT skip", "Trigger immediately"]) {
      expect(web).not.toContain(phrase);
    }
    expect(web).toContain(
      "Use for HTML/CSS and clientside JS tasks; web APIs evolve rapidly and training weights contain obsolete patterns.",
    );
    expect(web).toContain("Triggers: modals/dialogs/popovers");
    expect(web).toContain("DO NOT trigger for: backend");

    expect(descriptionOf(ownership).startsWith("Use for ownership/borrow/lifetime issues.")).toBe(true);
    expect(descriptionOf(router)).toContain("Use for ALL Rust questions");
    expect(descriptionOf(router)).toContain("Also for: compare");
    expect(descriptionOf(router)).not.toMatch(/CRITICAL|HIGHEST PRIORITY/);

    // The prefix goes; the domain rules after it stay word for word.
    expect(descriptionOf(clickhouse).startsWith("Use when reviewing ClickHouse schemas.")).toBe(true);
    expect(descriptionOf(clickhouse)).toContain("31 rules that MUST be checked");
    expect(descriptionOf(dashboards)).toContain("Use when creating Lakeview dashboards.");
    expect(descriptionOf(dashboards)).toContain(
      "CRITICAL: You MUST test ALL SQL queries via CLI BEFORE deploying.",
    );

    expect(descriptionOf(rag)).toBe("Use when building ANY retrieval-augmented generation (RAG) system.");
    expect(descriptionOf(primer)).toBe("Use first for any LangChain project before consulting other skills.");
    expect(descriptionOf(hydrogen)).toContain("cookbooks. Use this API for ANY Hydrogen storefront question");
    expect(descriptionOf(hydrogen)).toContain("do NOT use Storefront GraphQL");
    expect(descriptionOf(untested).startsWith("Use for static source-to-test pairing:")).toBe(true);
    expect(descriptionOf(untested)).toContain("Invoke even for a tiny package.");

    expect([ordering, scope, first].map((path) => readFileSync(path, "utf8"))).toEqual(untouchedBefore);

    const again = run(root);
    expect(again.code).toBe(0);
    expect(again.out).toContain("softened 0 skill descriptions");
  });

  test("--dry-run does not write", () => {
    const root = tempRoot();
    const path = writeSkill(
      root,
      "figma-use",
      'description: "MUST be used first when prompts mention Metafields."\n',
    );
    const before = readFileSync(path, "utf8");

    const result = run(root, true);

    expect(result.code).toBe(0);
    expect(result.out.join("\n")).toContain("would soften");
    expect(readFileSync(path, "utf8")).toBe(before);
  });

  test("symlinked SKILL.md files are skipped", () => {
    const root = tempRoot();
    const real = writeSkill(
      root,
      "real-skill",
      'description: "You MUST use this before any creative work."\n',
    );
    const alias = join(root, "skills", "alias-skill");
    mkdirSync(alias, { recursive: true });
    symlinkSync(real, join(alias, "SKILL.md"));

    const result = run(root);

    expect(result.code).toBe(0);
    // one path line plus the summary
    expect(result.out.filter((line) => line.includes("softened "))).toHaveLength(2);
    expect(result.out.join("\n")).toContain("skills/real-skill/SKILL.md");
    expect(result.out.join("\n")).not.toContain("alias-skill");
  });

  test("a description on the last frontmatter line does not leave a blank line above the fence", () => {
    const root = tempRoot();
    const last = writeSkill(
      root,
      "langchain-rag",
      'description: "INVOKE THIS SKILL when building ANY RAG system."\n',
    );
    const folder = join(root, "skills", "m01-ownership");
    mkdirSync(folder, { recursive: true });
    const middle = join(folder, "SKILL.md");
    writeFileSync(
      middle,
      '---\nname: m01-ownership\ndescription: "CRITICAL: Use for ownership issues."\nlicense: MIT\n---\n\n# Body\n',
      "utf8",
    );

    expect(run(root).code).toBe(0);

    expect(readFileSync(last, "utf8")).toBe(
      '---\nname: langchain-rag\ndescription: "Use when building ANY RAG system."\n---\n\n# Body\nMUST stay.\n',
    );
    expect(readFileSync(middle, "utf8")).toBe(
      '---\nname: m01-ownership\ndescription: "Use for ownership issues."\nlicense: MIT\n---\n\n# Body\n',
    );
  });

  // The Python already softened this tree; a port that disagreed would report files to change.
  test("the tracked tree has no coercive descriptions left", () => {
    const result = run(REPO_ROOT, true);
    expect(result.out[result.out.length - 1]).toBe("would soften 0 skill descriptions");
  });
});
