import { readdir, stat } from "node:fs/promises"
import { resolve } from "node:path"

export interface BenchNumbers {
  ns: number
  bytes: number
  allocs: number | null
}

export interface ArmStats {
  n: number
  ok: number
  gated: number
  empty: number
  errors: number
  benchFailures: number
  subset: number | null
  full: number | null
  bench: BenchNumbers | null
  reasoning: number | null
  toolCalls: number | null
}

export interface BenchRow {
  model: string
  task: string
  skill: string | null
  baseline: ArmStats
  withSkill: ArmStats | null
}

export interface EvalRun {
  runId: string
  startedAt: string
  configId: string
  models: string[]
  reps: number
  cells: number
  provenance: Record<string, string>
  skills: Record<string, { injection: string; version: string | null }>
  rows: BenchRow[]
}

export interface EvalSource {
  /** Skill ids under eval/skills/. */
  benchmarkedSkills(): Promise<string[]>
  /** Saved run ids, oldest first. */
  runIds(): Promise<string[]>
  loadRun(runId: string): Promise<EvalRun>
}

async function dirNames(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true }).catch(() => [])
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort()
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(() => true, () => false)
}

export class FsEvalSource implements EvalSource {
  constructor(private readonly evalDir: string) {}

  async benchmarkedSkills(): Promise<string[]> {
    const names = await dirNames(resolve(this.evalDir, "skills"))
    const kept: string[] = []
    for (const name of names) {
      if (await exists(resolve(this.evalDir, "skills", name, "skill.ts"))) kept.push(name)
    }
    return kept
  }

  async runIds(): Promise<string[]> {
    const names = await dirNames(resolve(this.evalDir, "runs"))
    const kept: string[] = []
    for (const name of names) {
      if (await exists(resolve(this.evalDir, "runs", name, "summary.json"))) kept.push(name)
    }
    return kept
  }

  async loadRun(runId: string): Promise<EvalRun> {
    const dir = resolve(this.evalDir, "runs", runId)
    const manifest = (await Bun.file(resolve(dir, "manifest.json")).json()) as {
      runId: string
      startedAt?: string
      cells?: number
      config: { id: string; models: string[]; reps: number }
      provenance?: Record<string, string>
      skills?: Record<string, { injection: string; version: string | null }>
    }
    const summary = (await Bun.file(resolve(dir, "summary.json")).json()) as { rows: BenchRow[] }
    return {
      runId: manifest.runId ?? runId,
      startedAt: manifest.startedAt ?? "",
      configId: manifest.config.id,
      models: manifest.config.models,
      reps: manifest.config.reps,
      cells: manifest.cells ?? 0,
      provenance: manifest.provenance ?? {},
      skills: manifest.skills ?? {},
      // NaN serializes as null; older summaries have no baseline-only rows
      rows: summary.rows.map((row) => ({ ...row, skill: row.skill ?? null, withSkill: row.withSkill ?? null })),
    }
  }
}
