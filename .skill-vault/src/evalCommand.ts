import { join } from "node:path";
import type { Command } from "./cli";

export const SUBCOMMANDS = ["run", "replay", "report", "runs", "selftest"] as const;
export type EvalSubcommand = (typeof SUBCOMMANDS)[number];

const USAGE = "usage: skillquarium eval [run|replay|report|runs|selftest] [runId]";

export const help = `${USAGE}

Run the eval suite in <root>/eval through its own mise toolchain.

  run       generate, gate, score, report (needs AI_GATEWAY_API_KEY; costs API credits)
  replay    re-score a saved run offline
  report    print a saved run's report
  runs      list saved runs
  selftest  offline: fixtures, configs, reference solutions through every gate

run and selftest install dependencies first via 'mise run setup'. Extra arguments are
forwarded to eval/src/cli.ts, which accepts a runId for replay and report.`;

export interface EvalStep {
  argv: string[];
  /** `mise trust` failure is ignored, matching the run-eval.sh this replaces. */
  optional?: boolean;
}

export interface EvalPlan {
  cwd: string;
  steps: EvalStep[];
}

function isSubcommand(name: string): name is EvalSubcommand {
  return (SUBCOMMANDS as readonly string[]).includes(name);
}

/** Commands to run in <root>/eval, in order; null when the subcommand is unknown. */
export function evalPlan(root: string, args: string[]): EvalPlan | null {
  const sub = args[0] ?? "run";
  if (!isSubcommand(sub)) return null;
  // runs and selftest take no arguments upstream, so nothing is forwarded for them.
  const forwarded = sub === "runs" || sub === "selftest" ? [] : args.slice(1);
  const steps: EvalStep[] = [{ argv: ["mise", "trust", "--quiet", "."], optional: true }];
  if (sub === "run" || sub === "selftest") steps.push({ argv: ["mise", "run", "setup"] });
  steps.push({ argv: ["mise", "exec", "--", "bun", "run", "src/cli.ts", sub, ...forwarded] });
  return { cwd: join(root, "eval"), steps };
}

export const run: Command = async (args, ctx) => {
  const plan = evalPlan(ctx.root, args);
  if (plan === null) {
    ctx.err(`skillquarium eval: unknown subcommand '${args[0]}'`);
    ctx.err(USAGE);
    return 2;
  }
  if (Bun.which("mise") === null) {
    ctx.err("skillquarium eval: mise is required (see mise.jdx.dev)");
    return 2;
  }
  for (const step of plan.steps) {
    const proc = Bun.spawnSync(step.argv, {
      cwd: plan.cwd,
      stdin: "inherit",
      stdout: "inherit",
      stderr: step.optional ? "ignore" : "inherit",
    });
    if (step.optional) continue;
    if (proc.exitCode !== 0) return proc.exitCode ?? 1;
  }
  return 0;
};
