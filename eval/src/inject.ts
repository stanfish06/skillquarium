import { streamText, tool, stepCountIs } from "ai";
import { EVAL_DIR } from "./config.ts";
import { moduleFor } from "../bench/index.ts";
import type { SkillDef, Task, Arm } from "./types.ts";

export const BASE_SYSTEM =
  "You are an expert software engineer. Produce production-quality code that " +
  "satisfies the request exactly. Return only the requested file's contents in " +
  "a single fenced code block, with no commentary before or after it.";

export async function skillText(skill: SkillDef): Promise<string> {
  return await Bun.file(`${skill.dir}/SKILL.md`).text();
}

export async function buildSystem(arm: Arm, skill: SkillDef | null): Promise<string> {
  if (arm === "baseline" || !skill) return BASE_SYSTEM;
  const body = await skillText(skill);
  const note = skill.tools ? `\n\n---\n\n${skill.tools.bridgeNote}` : "";
  return `${BASE_SYSTEM}\n\n---\n\n${body}${note}`;
}

// run under mise exec from the eval dir to put the pinned toolchains on PATH
async function runSkillCli(skill: SkillDef, args: string[]): Promise<string> {
  const bridge = skill.tools!;
  const proc = Bun.spawn(["mise", "exec", "--", ...bridge.command, ...args], {
    cwd: EVAL_DIR,
    stdout: "pipe",
    stderr: "pipe",
    signal: AbortSignal.timeout(bridge.timeoutMs ?? 120_000),
  });
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`skill CLI \`${args.join(" ")}\` exited ${code}: ${(err || out).slice(0, 400)}`);
  }
  return out.slice(0, 40_000);
}

function skillTools(skill: SkillDef, onFailure: (e: unknown) => void) {
  const guard = (fn: () => Promise<string>) => fn().catch((e) => { onFailure(e); throw e; });
  return Object.fromEntries(
    Object.entries(skill.tools!.tools).map(([name, def]) => [
      name,
      tool({
        description: def.description,
        inputSchema: def.inputSchema as any,
        execute: async (input: unknown) => guard(() => runSkillCli(skill, def.args(input))),
      }),
    ]),
  );
}

const FENCE = /```(\S+)?\n([\s\S]*?)```/g;

// fence tagged with the language, else the longest fence, else the raw text
export function extractCode(raw: string, fenceTags: string[]): string {
  const blocks = [...raw.matchAll(FENCE)].map((m) => ({ tag: (m[1] ?? "").toLowerCase(), body: m[2] ?? "" }));
  if (!blocks.length) return raw.trim();
  const tagged = blocks.filter((b) => fenceTags.includes(b.tag));
  const pool = tagged.length ? tagged : blocks;
  return pool.sort((a, b) => b.body.length - a.body.length)[0]!.body.trim();
}

export type GenResult = {
  raw: string;
  code: string;
  toolCalls: { name: string; input: unknown }[];
  steps: number;
  finishReason: string | null;
  usage: Record<string, unknown> | null;
  error: string | null;
};

export async function generate(opts: {
  model: string;
  system: string;
  task: Task;
  skill: SkillDef | null;
  arm: Arm;
  maxOutputTokens: number;
}): Promise<GenResult> {
  const useTools = opts.arm === "skill" && !!opts.skill?.tools;
  let toolFailure: string | null = null;
  let streamError: unknown = null;
  try {
    // streaming keeps the gateway connection alive across multi-minute generations
    const r = streamText({
      model: opts.model,
      system: opts.system,
      prompt: opts.task.prompt,
      temperature: 0.2,
      maxOutputTokens: opts.maxOutputTokens,
      timeout: { chunkMs: 180_000 },
      ...(useTools
        ? {
            tools: skillTools(opts.skill!, (e) => {
              toolFailure ??= e instanceof Error ? e.message : String(e);
            }),
            stopWhen: stepCountIs(opts.skill!.tools!.maxSteps ?? 8),
          }
        : {}),
    });
    await r.consumeStream({ onError: (e) => { streamError ??= e; } });
    if (streamError) throw streamError;
    const [text, steps, finishReason, usage] = await Promise.all([r.text, r.steps, r.finishReason, r.totalUsage]);
    const toolCalls = steps.flatMap((s) => s.toolCalls.map((c) => ({ name: c.toolName, input: c.input })));
    return {
      raw: text,
      code: extractCode(text, moduleFor(opts.task.lang).fenceTags),
      toolCalls,
      steps: steps.length,
      finishReason: finishReason ?? null,
      usage: (usage ?? null) as Record<string, unknown> | null,
      error: toolFailure,
    };
  } catch (e) {
    return {
      raw: "",
      code: "",
      toolCalls: [],
      steps: 0,
      finishReason: null,
      usage: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
