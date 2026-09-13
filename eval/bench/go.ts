import { cp } from "node:fs/promises";
import { resolve } from "node:path";
import { EVAL_DIR } from "../src/config.ts";
import { run, taskDir, type LangModule } from "./common.ts";

let goBin: string | null = null;
async function go(): Promise<string> {
  if (goBin) return goBin;
  if ((await run(["go", "version"], EVAL_DIR, 10_000)).code === 0) {
    goBin = "go";
  } else {
    const r = await run(["mise", "which", "go"], EVAL_DIR, 10_000);
    goBin = r.code === 0 ? r.out.trim() : "go";
  }
  return goBin;
}

const BENCH_LINE =
  /^Benchmark\S*\s+\d+\s+([\d.]+)\s+ns\/op\s+([\d.]+)\s+B\/op\s+([\d.]+)\s+allocs\/op/m;

export const go_: LangModule = {
  lang: "go",
  sourceFile: "solution.go",
  fenceTags: ["go", "golang"],
  sgLang: "go",
  ext: "go",
  referenceFile: "reference.go",
  async gate(task, code, dir) {
    await Bun.write(resolve(dir, "go.mod"), "module evaltask\n\ngo 1.27\n");
    await Bun.write(resolve(dir, "solution.go"), code);
    await cp(resolve(taskDir(task.id), "bench_test.go"), resolve(dir, "bench_test.go"));
    const g = await go();
    for (const [stage, cmd] of [
      ["build", [g, "build", "./..."]],
      ["vet", [g, "vet", "./..."]],
      ["test", [g, "test", "-run", "Test", "-count=1", "-timeout", "30s", "./..."]],
    ] as const) {
      const r = await run([...cmd], dir, 120_000);
      if (r.code !== 0) return { pass: false, detail: `go ${stage}: ${r.out.slice(0, 600)}` };
    }
    return { pass: true, detail: "go build+vet+test ok" };
  },
  async bench(_task, dir) {
    const g = await go();
    const r = await run(
      [g, "test", "-run", "^$", "-bench=.", "-benchmem", "-count=1", "-timeout", "120s", "./..."],
      dir,
      180_000,
    );
    if (r.code !== 0) return { result: null, error: `go bench exit ${r.code}: ${r.out.slice(0, 400)}` };
    const m = r.out.match(BENCH_LINE);
    if (!m) return { result: null, error: `no benchmark line in output: ${r.out.slice(0, 400)}` };
    return {
      result: { nsPerOp: Number(m[1]), bytesPerOp: Number(m[2]), allocsPerOp: Number(m[3]) },
      error: null,
    };
  },
};
