import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseBenchLine, run, taskDir, type LangModule } from "./common.ts";

const TPL = resolve(import.meta.dir, "rust");

export const rust: LangModule = {
  lang: "rust",
  sourceFile: "solution.rs",
  fenceTags: ["rust", "rs"],
  sgLang: "rust",
  ext: "rs",
  referenceFile: "reference.rs",
  async gate(task, code, dir) {
    await mkdir(resolve(dir, "tests"), { recursive: true });
    await mkdir(resolve(dir, "bench"), { recursive: true });
    await cp(resolve(TPL, "Cargo.toml"), resolve(dir, "Cargo.toml"));
    await cp(resolve(TPL, "main.rs"), resolve(dir, "bench/main.rs"));
    await Bun.write(resolve(dir, "solution.rs"), code);
    const spec = resolve(taskDir(task.id), "spec.rs");
    if (task.spec && existsSync(spec)) await cp(spec, resolve(dir, "tests/spec.rs"));
    const bench = resolve(taskDir(task.id), "bench.rs");
    await cp(task.bench && existsSync(bench) ? bench : resolve(TPL, "stub_task.rs"), resolve(dir, "bench/task.rs"));

    for (const [stage, cmd] of [
      ["build", ["cargo", "build", "--offline", "--quiet"]],
      ["test", ["cargo", "test", "--offline", "--quiet"]],
    ] as const) {
      const r = await run([...cmd], dir, 180_000);
      if (r.code !== 0) return { pass: false, detail: `cargo ${stage}: ${r.out.slice(0, 600)}` };
    }
    return { pass: true, detail: "cargo build+test ok" };
  },
  async bench(_task, dir) {
    const r = await run(["cargo", "run", "--offline", "--quiet", "--release", "--bin", "bench"], dir, 300_000);
    if (r.code !== 0) return { result: null, error: `cargo bench exit ${r.code}: ${r.out.slice(0, 400)}` };
    return parseBenchLine(r.out);
  },
};
