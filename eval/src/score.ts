import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { EVAL_DIR } from "./config.ts";
import { moduleFor } from "../bench/index.ts";
import { run } from "../bench/common.ts";
import type { Lang, Task, Trait, TraitResult } from "./types.ts";

export function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

let sgAvailable: boolean | null = null;

async function matches(trait: Trait, code: string, lang: Lang, dir: string): Promise<boolean> {
  const src = stripComments(code);
  if (trait.kind === "regex") return new RegExp(trait.pattern, "m").test(src);

  if (sgAvailable === null) {
    sgAvailable = (await run(["ast-grep", "--version"], EVAL_DIR, 10_000)).code === 0;
  }
  if (!sgAvailable) throw new Error(`trait ${trait.id} needs ast-grep on PATH`);
  const mod = moduleFor(lang);
  await mkdir(dir, { recursive: true });
  const file = resolve(dir, `probe-${trait.id}.${mod.ext}`);
  await Bun.write(file, src);
  const r = await run(["ast-grep", "run", "-p", trait.pattern, "-l", mod.sgLang, file, "--json=compact"], dir);
  return r.code === 0 && r.out.trim() !== "[]" && r.out.trim() !== "";
}

export async function scoreTrait(
  trait: Trait,
  code: string,
  lang: Lang,
  scratch = resolve(EVAL_DIR, ".cache/sg"),
): Promise<TraitResult> {
  const m = await matches(trait, code, lang, scratch);
  return {
    id: trait.id,
    matched: m,
    satisfied: trait.polarity === "require" ? m : !m,
    prescribedBy: trait.prescribedBy,
  };
}

export async function verifyTraits(tasks: Map<string, Task>): Promise<string[]> {
  const problems: string[] = [];
  for (const task of tasks.values()) {
    for (const trait of task.traits) {
      const ok = await scoreTrait(trait, trait.fixture.satisfies, task.lang);
      const bad = await scoreTrait(trait, trait.fixture.violates, task.lang);
      if (!ok.satisfied) problems.push(`${task.id}/${trait.id}: fixture.satisfies scored as violated`);
      if (bad.satisfied) problems.push(`${task.id}/${trait.id}: fixture.violates scored as satisfied`);
    }
  }
  return problems;
}
