import { cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { EVAL_DIR } from "../src/config.ts";
import { run, taskDir, type LangModule } from "./common.ts";

export const ts: LangModule = {
  lang: "ts",
  sourceFile: "solution.ts",
  fenceTags: ["ts", "typescript", "tsx"],
  sgLang: "ts",
  ext: "ts",
  referenceFile: "reference.ts",
  async gate(task, code, dir) {
    await Bun.write(resolve(dir, "solution.ts"), code);
    const tsc = resolve(EVAL_DIR, "node_modules/.bin/tsc");
    const t = await run(
      [tsc, "--noEmit", "--strict", "--noUncheckedIndexedAccess", "--target", "es2022",
       "--lib", "es2023", "--skipLibCheck", "--moduleDetection", "force", "solution.ts"],
      dir,
    );
    if (t.code !== 0) return { pass: false, detail: `tsc: ${t.out.slice(0, 600)}` };

    const spec = resolve(taskDir(task.id), "spec.ts");
    if (task.spec && existsSync(spec)) {
      await cp(spec, resolve(dir, "spec.ts"));
      const s = await run([process.execPath, "spec.ts"], dir, 60_000);
      if (s.code !== 0) return { pass: false, detail: `spec: ${s.out.slice(0, 600)}` };
      return { pass: true, detail: "tsc + spec ok" };
    }
    return { pass: true, detail: "tsc ok" };
  },
};
