import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { buildGraph } from "../../src/kg/build";
import type { Graph } from "../../src/kg/types";

/** The repo this package lives in, for the ontology files the fixture copies. */
export const REPO = resolve(import.meta.dir, "..", "..", "..");

export function write(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
}

/**
 * The miniature vault from tests/test_kg.py::FixtureVault: four skills with a known-correct
 * answer for every assertion. `workflow` is the generic-name trap — every body mentions it in
 * prose, so it must not become a hub.
 */
export function makeFixtureVault(root: string): void {
  write(
    join(root, "skills/alpha/SKILL.md"),
    "---\nname: alpha\ndescription: Produces FASTQ reads for downstream work.\n---\n" +
      "# alpha\nEmits fastq files. Pairs with `beta` for the next step.\n",
  );
  write(
    join(root, "skills/beta/SKILL.md"),
    "---\nname: beta\ndescription: Aligns FASTQ to BAM using alpha output.\n---\n" +
      "# beta\nTakes fastq and writes bam. See alpha.\n",
  );
  write(
    join(root, "skills/gamma/SKILL.md"),
    "---\nname: gamma\ndescription: Unrelated document formatting helper.\n---\n" +
      "# gamma\nNothing to do with sequencing.\n",
  );
  write(
    join(root, "skills/workflow/SKILL.md"),
    "---\nname: workflow\ndescription: Generic workflow helper.\n---\n# workflow\n",
  );
  for (const name of ["alpha", "beta", "gamma", "workflow"]) {
    const p = join(root, `skills/${name}/SKILL.md`);
    writeFileSync(p, `${readFileSync(p, "utf8")}\nThis workflow is standard.\n`, "utf8");
    const aliases = name === "alpha" ? "aliases:\n  - calorie counter\n" : "";
    write(
      join(root, `vault/notes/testing/${name}.md`),
      `---\ntitle: ${name}\ndomain: testing\nsource: skills/${name}/SKILL.md\n${aliases}---\n`,
    );
  }
  write(
    join(root, "vault/recipes/demo.md"),
    "---\ntitle: Demo pipeline\n---\n# Demo\n\n" +
      "1. **[alpha](../notes/testing/alpha.md)** — start here. " +
      "Alternative: **[gamma](../notes/testing/gamma.md)**.\n" +
      "2. **[beta](../notes/testing/beta.md)** — then this.\n",
  );
  write(
    join(root, "vault/notes/testing/alpha.md"),
    "---\ntitle: alpha\ndomain: testing\nsource: skills/alpha/SKILL.md\n" +
      "aliases:\n  - calorie counter\n---\n",
  );
  // minimal ontology copied from the real one
  for (const f of ["schema.json", "lexicon.json"]) {
    write(
      join(root, ".skill-vault/ontology", f),
      readFileSync(join(REPO, ".skill-vault/ontology", f), "utf8"),
    );
  }
}

/** A fixture vault in a temp dir, with the graph built from it. Call `cleanup()` when done. */
export function buildFixtureGraph(extra?: (root: string) => void): {
  root: string;
  graph: Graph;
  cleanup: () => void;
} {
  const root = mkdtempSync(join(tmpdir(), "kg-fixture-"));
  makeFixtureVault(root);
  extra?.(root);
  return { root, graph: buildGraph(root), cleanup: () => rmSync(root, { recursive: true, force: true }) };
}
