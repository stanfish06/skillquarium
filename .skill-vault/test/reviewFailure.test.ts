import { describe, expect, test } from "bun:test";
import { join } from "node:path";

// The only Python left in the vault. It exercises the image-review failure path of
// scripts that ship inside four skills (scientific-slides, scientific-schematics,
// infographics, scholar-evaluation), so it stays Python and runs here as a subprocess.
const SUITE_DIR = join(import.meta.dir, "python");
const python3 = Bun.which("python3");

describe("review-failure integrity", () => {
  if (python3 === null) {
    test.skip("python3 is not on PATH, so the Python suite under test/python cannot run", () => {});
    return;
  }

  test("python3 -m unittest exits 0", () => {
    // -B so importing the skill scripts leaves no __pycache__ in skills/ or here.
    const proc = Bun.spawnSync(
      [python3, "-B", "-m", "unittest", "discover", "-s", SUITE_DIR, "-p", "test_*.py", "-t", SUITE_DIR],
      { stdout: "pipe", stderr: "pipe" },
    );
    const output = `${proc.stdout.toString()}${proc.stderr.toString()}`;
    expect(output.length > 0 ? output : "(no output)").toContain("OK");
    expect(proc.exitCode).toBe(0);
  }, 60_000);
});
