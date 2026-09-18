import { z } from "zod";

/** `placebo` is declared but not run in v0. */
export const Arm = z.enum(["baseline", "placebo", "skill"]);
export type Arm = z.infer<typeof Arm>;

/** One module per language under bench/. */
export const Lang = z.enum(["ts", "go", "rust", "c", "cpp", "csharp"]);
export type Lang = z.infer<typeof Lang>;

export const Trait = z.object({
  id: z.string(),
  polarity: z.enum(["require", "forbid"]),
  kind: z.enum(["regex", "ast-grep"]),
  pattern: z.string(),
  /** [] = blind trait no skill under test prescribes. */
  prescribedBy: z.array(z.string()).default([]),
  note: z.string().optional(),
  /** Self-test samples; scoring refuses to start if either misclassifies. */
  fixture: z.object({ satisfies: z.string(), violates: z.string() }),
});
export type Trait = z.infer<typeof Trait>;

export const Task = z.object({
  id: z.string(),
  lang: Lang,
  prompt: z.string(),
  traits: z.array(Trait),
  bench: z.boolean().default(false),
  /** Run the task's behaviour check in the gate. */
  spec: z.boolean().default(false),
});
export type Task = z.infer<typeof Task>;

/** `args` maps validated tool input to argv appended to `ToolBridge.command`. */
export type ToolDef = {
  description: string;
  inputSchema: z.ZodType;
  args: (input: any) => string[];
};

export type ToolBridge = {
  /** argv prefix, absolute paths. */
  command: string[];
  bridgeNote: string;
  tools: Record<string, ToolDef>;
  maxSteps?: number;
  timeoutMs?: number;
};

/** Exported as `skill` from eval/skills/<id>/skill.ts. */
export type SkillDef = {
  id: string;
  dir: string;
  /** prose = paste SKILL.md; tool = also expose its CLI as tools. */
  injection: "prose" | "tool";
  tools?: ToolBridge;
  /** Version of anything the skill shells out to; part of the cache key. */
  version?: () => Promise<string>;
};

export const TraitResult = z.object({
  id: z.string(),
  satisfied: z.boolean(),
  matched: z.boolean(),
  prescribedBy: z.array(z.string()),
});
export type TraitResult = z.infer<typeof TraitResult>;

/** allocsPerOp is null where the runtime cannot count (.NET). */
export const BenchResult = z.object({
  nsPerOp: z.number(),
  bytesPerOp: z.number(),
  allocsPerOp: z.number().nullable(),
});
export type BenchResult = z.infer<typeof BenchResult>;

/** One row of cells.jsonl. */
export const Cell = z.object({
  runId: z.string(),
  key: z.string(),
  model: z.string(),
  taskId: z.string(),
  skillId: z.string().nullable(),
  arm: Arm,
  rep: z.number(),
  system: z.string(),
  prompt: z.string(),
  code: z.string(),
  raw: z.string(),
  toolCalls: z.array(z.object({ name: z.string(), input: z.unknown() })),
  steps: z.number(),
  finishReason: z.string().nullable(),
  outcome: z.enum(["ok", "gate-fail", "empty", "error"]),
  usage: z.record(z.string(), z.unknown()).nullable(),
  ms: z.number(),
  cached: z.boolean(),
  error: z.string().nullable(),
  gate: z.object({ pass: z.boolean(), detail: z.string() }).nullable(),
  traits: z.array(TraitResult),
  bench: BenchResult.nullable(),
  benchError: z.string().nullable(),
});
export type Cell = z.infer<typeof Cell>;
