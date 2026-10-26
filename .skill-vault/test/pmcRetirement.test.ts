import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { z } from "zod";

const script = resolve(import.meta.dir, "../../skills/ncbi-pmc-skill/scripts/ncbi_pmc.py");
const python = Bun.which("python3");

describe("retired PMC OA service", () => {
  if (python === null) {
    test.skip("python3 is required for the legacy CLI regression checks", () => {});
    return;
  }
  const pythonCommand = python;
  const response = z.object({
    ok: z.literal(false),
    error: z.object({ code: z.string(), message: z.string() }),
    warnings: z.array(z.string()),
    alternatives: z.array(z.object({ skill: z.string(), use: z.string() })).optional(),
  });

  function invoke(input: string) {
    // -I -S prevents installed packages from masking a missing runtime dependency.
    const result = Bun.spawnSync([pythonCommand, "-I", "-S", script], {
      stdin: new TextEncoder().encode(input),
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(result.stderr.toString()).toBe("");
    return { code: result.exitCode, output: response.parse(JSON.parse(result.stdout.toString())) };
  }

  test.each(["PMC3257301", "10.1093/nar/gkr1184"])("legacy lookup %s gives a migration error", (id) => {
    const { code, output } = invoke(JSON.stringify({ params: { id }, save_raw: true }));
    expect(code).toBe(1);
    expect(output.ok).toBe(false);
    expect(output.error.code).toBe("service_retired");
    expect(output.alternatives?.map((route) => route.skill)).toEqual(["paper-lookup", "ncbi-entrez-skill"]);
  });

  test("an empty object cannot make an unfiltered service request", () => {
    const { code, output } = invoke("{}");
    expect(code).toBe(1);
    expect(output.error.code).toBe("service_retired");
  });

  test.each([
    ["{", "invalid_json"],
    ["[]", "invalid_input"],
  ])("invalid input %s remains a usage error", (input, errorCode) => {
    const { code, output } = invoke(input);
    expect(code).toBe(2);
    expect(output.error.code).toBe(errorCode);
  });
});
