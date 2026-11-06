import { expect, test } from "bun:test";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const suites = [
  ["frozen anchors", "skills/lean-orchestrator/tests/test_check_frozen_anchors.py"],
  ["module layout", "skills/lean-project-architecture/tests/test_check_lean_modules.py"],
  ["proof dependency graph", "skills/build-proof-dependency-graph/scripts/test_proof_depgraph.py"],
  ["compile gate", "skills/lean-orchestrator/tests/test_lean_compile_gate.py"],
  ["snapshot lines", ".skill-vault/test/python/test_lean_line_count.py"],
] as const;

for (const [name, script] of suites) {
  test(`Lean helper regressions: ${name}`, () => {
    const result = Bun.spawnSync(["python3", script], {
      cwd: root,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
      stdout: "pipe",
      stderr: "pipe",
    });
    if (result.exitCode !== 0) {
      throw new Error(`${script}\n${result.stdout.toString()}${result.stderr.toString()}`);
    }
    expect(result.exitCode).toBe(0);
  }, 30_000);
}
