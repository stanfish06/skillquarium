import { resolve } from "node:path";
import type { SkillDef, Task } from "./types.ts";

export const EVAL_DIR = resolve(import.meta.dir, "..");
export const REPO_DIR = resolve(EVAL_DIR, "..");

async function importAll<T>(glob: string, key: string, expectId: (dir: string, v: T) => void): Promise<Map<string, T>> {
  const out = new Map<string, T>();
  const files = [...new Bun.Glob(glob).scanSync({ cwd: EVAL_DIR, onlyFiles: true })].sort();
  for (const rel of files) {
    const mod = await import(resolve(EVAL_DIR, rel));
    const v = mod[key] as T | undefined;
    if (!v) throw new Error(`${rel} does not export \`${key}\``);
    const dirName = rel.split("/").at(-2)!;
    expectId(dirName, v);
    out.set(dirName, v);
  }
  return out;
}

export function loadSkills(): Promise<Map<string, SkillDef>> {
  return importAll<SkillDef>("skills/*/skill.ts", "skill", (dir, s) => {
    if (s.id !== dir) throw new Error(`skills/${dir}/skill.ts declares id "${s.id}"; must match the folder`);
  });
}

export function loadTasks(): Promise<Map<string, Task>> {
  return importAll<Task>("tasks/*/task.ts", "task", (dir, t) => {
    if (t.id !== dir) throw new Error(`tasks/${dir}/task.ts declares id "${t.id}"; must match the folder`);
  });
}

export type RunConfig = {
  id: string;
  models: string[];
  reps: number;
  /** Must clear the model's thinking budget; reasoning tokens count against it. */
  maxOutputTokens: number;
  pairs: { skill: string; task: string }[];
  /** Run in the baseline arm only. */
  baselineTasks?: string[];
};

const PAIRS = [
  { skill: "zz-prefix", task: "ts-control-probe" },
  { skill: "modern-typescript", task: "ts-settings-parser" },
  { skill: "use-modern-go", task: "go-batch-processor" },
  { skill: "rust-coding-guidelines", task: "rust-record-parser" },
  { skill: "cpp-pro", task: "cpp-lru-cache" },
  { skill: "csharp-developer", task: "csharp-order-parser" },
];

const BASELINE_TASKS = ["c-run-length"];

export const CONFIG: RunConfig = {
  id: "default",
  models: ["openai/gpt-5.6-luna"],
  reps: 3,
  maxOutputTokens: 500_000,
  pairs: PAIRS,
  baselineTasks: BASELINE_TASKS,
};

export async function skillHash(dir: string): Promise<string> {
  const files = [...new Bun.Glob("**/*").scanSync({ cwd: dir, onlyFiles: true })].sort();
  const h = new Bun.CryptoHasher("sha256");
  for (const rel of files) {
    h.update(rel + "\0");
    h.update(await Bun.file(resolve(dir, rel)).arrayBuffer());
  }
  return h.digest("hex").slice(0, 16);
}

export async function provenance(skills: Iterable<SkillDef>): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const s of skills) {
    out[`skill:${s.id}`] = await skillHash(s.dir).catch(() => "unreadable");
    if (s.version) out[`skill:${s.id}:version`] = await s.version().catch(() => "unknown");
  }
  return out;
}
