import { cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { nixToolchain, parseBenchLine, run, taskDir, warningCount, type LangModule } from "./common.ts";

const TPL = resolve(import.meta.dir, "csharp");
const DLL = "bin/Release/net10.0/Eval.dll";

export const csharp: LangModule = {
  lang: "csharp",
  sourceFile: "Solution.cs",
  fenceTags: ["csharp", "cs", "c#"],
  sgLang: "csharp",
  ext: "cs",
  referenceFile: "Reference.cs",
  async gate(task, code, dir) {
    const dotnet = (await nixToolchain()).dotnet;
    if (!dotnet) return { pass: false, detail: "toolchain: no dotnet (nix develop failed and none on PATH)" };
    await cp(resolve(TPL, "Eval.csproj"), resolve(dir, "Eval.csproj"));
    await cp(resolve(TPL, "Program.cs"), resolve(dir, "Program.cs"));
    await Bun.write(resolve(dir, "Solution.cs"), code);
    const spec = resolve(taskDir(task.id), "Spec.cs");
    if (!task.spec || !existsSync(spec)) return { pass: false, detail: `task ${task.id} has no Spec.cs; the C# gate needs one` };
    await cp(spec, resolve(dir, "Spec.cs"));
    const bench = resolve(taskDir(task.id), "Bench.cs");
    await cp(task.bench && existsSync(bench) ? bench : resolve(TPL, "StubBench.cs"), resolve(dir, "Bench.cs"));

    const b = await run([dotnet, "build", "-c", "Release", "-nologo", "-v", "q", "-clp:NoSummary"], dir, 240_000);
    if (b.code !== 0) return { pass: false, detail: `dotnet build: ${b.out.slice(0, 600)}` };
    const s = await run([dotnet, DLL, "spec"], dir, 60_000);
    if (s.code !== 0) return { pass: false, detail: `spec (exit ${s.code}): ${s.out.slice(0, 600)}` };
    return { pass: true, detail: `dotnet build + spec ok (${warningCount(b.out, "Solution.cs")} warnings)` };
  },
  async bench(_task, dir) {
    const dotnet = (await nixToolchain()).dotnet;
    if (!dotnet) return { result: null, error: "toolchain: no dotnet" };
    const r = await run([dotnet, DLL, "bench"], dir, 180_000);
    if (r.code !== 0) return { result: null, error: `bench exit ${r.code}: ${r.out.slice(0, 400)}` };
    return parseBenchLine(r.out);
  },
};
