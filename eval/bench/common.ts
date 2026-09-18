import { resolve } from "node:path";
import { EVAL_DIR } from "../src/config.ts";
import type { BenchResult, Lang, Task } from "../src/types.ts";

export type GateResult = { pass: boolean; detail: string };
export type BenchOutcome = { result: BenchResult | null; error: string | null };

export type LangModule = {
  lang: Lang;
  sourceFile: string;
  fenceTags: string[];
  sgLang: string;
  ext: string;
  referenceFile: string;
  gate(task: Task, code: string, dir: string): Promise<GateResult>;
  bench?(task: Task, dir: string): Promise<BenchOutcome>;
};

export const taskDir = (id: string) => resolve(EVAL_DIR, "tasks", id);

// env for compiling and running model code: allowlisted vars only, package managers offline
const PASSTHROUGH = [
  "PATH", "HOME", "TMPDIR", "LANG",
  "CARGO_HOME", "RUSTUP_HOME", "RUSTUP_TOOLCHAIN",
  "DOTNET_ROOT",
];
export const SANDBOX_ENV: Record<string, string> = {
  TMPDIR: "/tmp",
  LANG: "C.UTF-8",
  ...Object.fromEntries(PASSTHROUGH.filter((k) => process.env[k]).map((k) => [k, process.env[k]!])),
  GOPROXY: "off",
  GOTOOLCHAIN: "local",
  GOFLAGS: "-mod=mod",
  CARGO_NET_OFFLINE: "true",
  DOTNET_CLI_TELEMETRY_OPTOUT: "1",
  DOTNET_NOLOGO: "1",
  DOTNET_SKIP_FIRST_TIME_EXPERIENCE: "1",
  DOTNET_GENERATE_ASPNET_CERTIFICATE: "false",
  DOTNET_CLI_HOME: resolve(EVAL_DIR, ".cache/dotnet"),
  NUGET_PACKAGES: resolve(EVAL_DIR, ".cache/dotnet/nuget"),
};

/** Spawn in SANDBOX_ENV; spawn errors and timeouts return a non-zero code with the message in `out`. */
export async function run(cmd: string[], cwd: string, ms = 60_000, env: Record<string, string> = {}) {
  try {
    const proc = Bun.spawn(cmd, {
      cwd,
      env: { ...SANDBOX_ENV, ...env },
      stdout: "pipe",
      stderr: "pipe",
      signal: AbortSignal.timeout(ms),
    });
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const code = await proc.exited;
    const timedOut = proc.signalCode !== null && code !== 0;
    return { code: code === 0 ? 0 : (code || 124), out: (timedOut ? `timed out after ${ms}ms\n` : "") + stdout + stderr };
  } catch (e) {
    return { code: 127, out: `spawn ${cmd[0]}: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Spawn with the evaluator's env; for toolchain resolution only. */
export async function runHost(cmd: string[], cwd: string, ms = 60_000) {
  try {
    const proc = Bun.spawn(cmd, { cwd, stdout: "pipe", stderr: "pipe", signal: AbortSignal.timeout(ms) });
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    return { code: await proc.exited, stdout, stderr };
  } catch (e) {
    return { code: 127, stdout: "", stderr: e instanceof Error ? e.message : String(e) };
  }
}

// printed once by every non-Go bench program; `-` allocs = runtime cannot count
const BENCH_LINE = /^BENCH ns\/op=(\S+) B\/op=(\S+) allocs\/op=(\S+)\s*$/m;

export function parseBenchLine(out: string): BenchOutcome {
  const m = out.match(BENCH_LINE);
  if (!m) return { result: null, error: `no BENCH line in output: ${out.slice(0, 400)}` };
  const nsPerOp = Number(m[1]);
  const bytesPerOp = Number(m[2]);
  const allocsPerOp = m[3] === "-" ? null : Number(m[3]);
  const bad = [nsPerOp, bytesPerOp, ...(allocsPerOp === null ? [] : [allocsPerOp])].some((x) => !Number.isFinite(x));
  if (bad) return { result: null, error: `unparseable BENCH line: ${m[0]}` };
  return { result: { nsPerOp, bytesPerOp, allocsPerOp }, error: null };
}

/** Compiler warnings attributed to `file`. */
export function warningCount(out: string, file: string): number {
  const esc = file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (out.match(new RegExp(`(^|[\\s/])${esc}[:(].*?\\bwarning\\b`, "g")) ?? []).length;
}

type NixTools = { gcc: string | null; "g++": string | null; dotnet: string | null };
let nixTools: Promise<NixTools> | null = null;

/** gcc, g++, dotnet resolved once via `nix develop` on flake.nix, else PATH; EVAL_CC / EVAL_CXX / EVAL_DOTNET override. */
export function nixToolchain(): Promise<NixTools> {
  nixTools ??= (async () => {
    const want = ["gcc", "g++", "dotnet"] as const;
    const override: Record<(typeof want)[number], string | undefined> = {
      gcc: process.env.EVAL_CC,
      "g++": process.env.EVAL_CXX,
      dotnet: process.env.EVAL_DOTNET,
    };
    let fromNix: string[] = [];
    if (Bun.which("nix")) {
      const probe = want.map((w) => `command -v ${w} || echo -`).join("; ");
      const r = await runHost(["nix", "develop", `path:${EVAL_DIR}`, "-c", "sh", "-c", probe], EVAL_DIR, 900_000);
      if (r.code === 0) fromNix = r.stdout.trim().split("\n");
      else console.error(`nix develop failed; falling back to PATH:\n${r.stderr.slice(-600)}`);
    }
    const out = {} as NixTools;
    want.forEach((w, i) => {
      const nixPath = fromNix[i] && fromNix[i] !== "-" ? fromNix[i]! : null;
      out[w] = override[w] || nixPath || Bun.which(w);
    });
    return out;
  })();
  return nixTools;
}
