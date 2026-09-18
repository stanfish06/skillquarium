import { cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { nixToolchain, parseBenchLine, run, taskDir, warningCount, type LangModule } from "./common.ts";

const TPL = resolve(import.meta.dir, "c");

const SAN_ENV = {
  ASAN_OPTIONS: "detect_leaks=1:abort_on_error=0:exitcode=86",
  UBSAN_OPTIONS: "halt_on_error=1:print_stacktrace=1:exitcode=87",
};

type Family = {
  lang: "c" | "cpp";
  compiler: "gcc" | "g++";
  std: string;
  sourceFile: string;
  fenceTags: string[];
  sgLang: string;
  ext: string;
  referenceFile: string;
  specFile: string;
  benchFile: string;
  benchMain: string;
  linkSolution: boolean;
  wrapMalloc: boolean;
};

function family(f: Family): LangModule {
  return {
    lang: f.lang,
    sourceFile: f.sourceFile,
    fenceTags: f.fenceTags,
    sgLang: f.sgLang,
    ext: f.ext,
    referenceFile: f.referenceFile,
    async gate(task, code, dir) {
      const cc = (await nixToolchain())[f.compiler];
      if (!cc) return { pass: false, detail: `toolchain: no ${f.compiler} (nix develop failed and none on PATH)` };
      await Bun.write(resolve(dir, f.sourceFile), code);
      const spec = resolve(taskDir(task.id), f.specFile);
      if (!task.spec || !existsSync(spec)) return { pass: false, detail: `task ${task.id} has no ${f.specFile}; C-family gates need one` };
      await cp(spec, resolve(dir, f.specFile));
      const units = [...(f.linkSolution ? [f.sourceFile] : []), f.specFile];
      const c = await run(
        [cc, `-std=${f.std}`, "-Wall", "-Wextra", "-g", "-O1", "-fno-omit-frame-pointer",
         "-fsanitize=address,undefined", ...units, "-o", "spec", "-lm"],
        dir, 120_000,
      );
      if (c.code !== 0) return { pass: false, detail: `${f.compiler}: ${c.out.slice(0, 600)}` };
      const s = await run(["./spec"], dir, 60_000, SAN_ENV);
      if (s.code !== 0) return { pass: false, detail: `spec (exit ${s.code}): ${s.out.replace(/^=+\n/gm, "").slice(0, 600)}` };
      return { pass: true, detail: `${f.compiler} + spec ok (${warningCount(c.out, f.sourceFile)} warnings)` };
    },
    async bench(task, dir) {
      const cc = (await nixToolchain())[f.compiler];
      if (!cc) return { result: null, error: `toolchain: no ${f.compiler}` };
      const bench = resolve(taskDir(task.id), f.benchFile);
      if (!existsSync(bench)) return { result: null, error: `task ${task.id} has no ${f.benchFile}` };
      await cp(bench, resolve(dir, f.benchFile));
      await cp(resolve(TPL, f.benchMain), resolve(dir, f.benchMain));
      const units = [...(f.linkSolution ? [f.sourceFile] : []), f.benchFile, f.benchMain];
      const wrap = f.wrapMalloc ? ["-Wl,--wrap=malloc,--wrap=calloc,--wrap=realloc"] : [];
      const c = await run([cc, `-std=${f.std}`, "-O2", "-DNDEBUG", ...units, ...wrap, "-o", "bench", "-lm"], dir, 120_000);
      if (c.code !== 0) return { result: null, error: `${f.compiler} bench: ${c.out.slice(0, 400)}` };
      const r = await run(["./bench"], dir, 180_000);
      if (r.code !== 0) return { result: null, error: `bench exit ${r.code}: ${r.out.slice(0, 400)}` };
      return parseBenchLine(r.out);
    },
  };
}

export const c = family({
  lang: "c", compiler: "gcc", std: "c17",
  sourceFile: "solution.c", fenceTags: ["c"], sgLang: "c", ext: "c",
  referenceFile: "reference.c", specFile: "spec.c", benchFile: "bench.c", benchMain: "bench_main.c",
  linkSolution: true, wrapMalloc: true,
});

export const cpp = family({
  lang: "cpp", compiler: "g++", std: "c++23",
  sourceFile: "solution.hpp", fenceTags: ["cpp", "c++", "cc", "cxx", "hpp"], sgLang: "cpp", ext: "cpp",
  referenceFile: "reference.hpp", specFile: "spec.cpp", benchFile: "bench.cpp", benchMain: "bench_main.cpp",
  linkSolution: false, wrapMalloc: false,
});
