import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

const python = Bun.which("python3");
const suite = resolve(import.meta.dir, "../../skills/clinical-trial-finder/tests/test_euctr_unavailable.py");

describe("clinical trial source coverage", () => {
  if (python === null) {
    test.skip("python3 is required for the source-coverage regressions", () => {});
    return;
  }
  const pythonCommand = python;

  test("unavailable European coverage stays distinct from an empty CT.gov search", () => {
    const result = Bun.spawnSync([pythonCommand, "-B", "-I", "-S", suite], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = result.stdout.toString() + result.stderr.toString();
    expect(output).toContain("Ran 3 tests");
    expect(output).toContain("OK");
    expect(result.exitCode).toBe(0);
  });
});
