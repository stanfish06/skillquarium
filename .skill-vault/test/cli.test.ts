import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type ContextOverrides, main, makeContext, parseGlobal, usage } from "../src/cli";
import { loadConfig } from "../src/config";
import { type DoctorDeps, runDoctor } from "../src/doctor";

// Collect out/err lines so router and command output can be asserted without touching console.
function capture(): { out: string[]; err: string[]; overrides: ContextOverrides } {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, overrides: { out: (l) => out.push(l), err: (l) => err.push(l) } };
}

describe("parseGlobal", () => {
  test("--root before and after the command", () => {
    expect(parseGlobal(["--root", "/tmp/a", "doctor"])).toEqual({
      root: "/tmp/a",
      json: false,
      rest: ["doctor"],
    });
    expect(parseGlobal(["doctor", "--root", "/tmp/b"])).toEqual({
      root: "/tmp/b",
      json: false,
      rest: ["doctor"],
    });
  });

  test("--root=X and relative paths resolve", () => {
    expect(parseGlobal(["--root=/tmp/c", "doctor"]).root).toBe("/tmp/c");
    expect(parseGlobal(["--root", "rel"]).root).toBe(resolve("rel"));
  });

  test("--root without a value throws", () => {
    expect(() => parseGlobal(["doctor", "--root"])).toThrow("--root requires a path");
    expect(() => parseGlobal(["--root=", "doctor"])).toThrow("--root requires a path");
  });

  test("--json before or after the command, command args kept in order", () => {
    expect(parseGlobal(["--json", "doctor", "x"])).toMatchObject({ json: true, rest: ["doctor", "x"] });
    expect(parseGlobal(["doctor", "x", "--json"])).toMatchObject({ json: true, rest: ["doctor", "x"] });
  });
});

describe("main", () => {
  test("-h and --help print usage to out and return 0", async () => {
    for (const flag of ["-h", "--help"]) {
      const c = capture();
      expect(await main([flag], c.overrides)).toBe(0);
      expect(c.out).toEqual([usage()]);
      expect(c.err).toEqual([]);
    }
  });

  test("unknown command returns 2 and writes usage to err only", async () => {
    const c = capture();
    expect(await main(["bogus"], c.overrides)).toBe(2);
    expect(c.out).toEqual([]);
    expect(c.err).toEqual(["skillquarium: unknown command 'bogus'", usage()]);
  });

  test("--root without a value returns 2 with the message", async () => {
    const c = capture();
    expect(await main(["--root"], c.overrides)).toBe(2);
    expect(c.err).toEqual(["skillquarium: --root requires a path"]);
  });

  test("doctor --help prints the command help", async () => {
    const c = capture();
    expect(await main(["doctor", "--help"], c.overrides)).toBe(0);
    expect(c.out).toEqual(["doctor: report tool availability and embed endpoint reachability"]);
  });
});

describe("makeContext", () => {
  test("resolves root and memoizes the default config loader", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sq-ctx-"));
    const ctx = makeContext(dir, true);
    expect(ctx.root).toBe(resolve(dir));
    expect(ctx.json).toBe(true);
    expect(ctx.config()).toBe(ctx.config());
    expect((await ctx.config()).embed.url).toBe("http://127.0.0.1:8080");
  });

  test("an overridden config loader is used as given", async () => {
    let calls = 0;
    const ctx = makeContext("rel", false, {
      config: async () => {
        calls += 1;
        return loadConfig(mkdtempSync(join(tmpdir(), "sq-ctx-")));
      },
    });
    expect(ctx.root).toBe(resolve("rel"));
    await ctx.config();
    await ctx.config();
    expect(calls).toBe(2);
  });
});

describe("doctor", () => {
  const offline: DoctorDeps["fetch"] = () => Promise.reject(new Error("offline"));

  test("a missing tool yields exit 1 and MISSING in the table", async () => {
    const c = capture();
    const ctx = makeContext(mkdtempSync(join(tmpdir(), "sq-doc-")), false, c.overrides);
    const code = await runDoctor(ctx, {
      which: (bin) => (bin === "rg" ? null : `/usr/bin/${bin}`),
      fetch: offline,
    });
    expect(code).toBe(1);
    expect(c.out.find((l) => l.startsWith("rg"))).toMatch(/MISSING$/);
    expect(c.out.find((l) => l.startsWith("embed endpoint"))).toContain("UNREACHABLE (offline)");
  });

  test("all tools present with an offline endpoint is exit 0; --json emits one object", async () => {
    const c = capture();
    const ctx = makeContext(mkdtempSync(join(tmpdir(), "sq-doc-")), true, c.overrides);
    const code = await runDoctor(ctx, { which: (bin) => `/usr/bin/${bin}`, fetch: offline });
    expect(code).toBe(0);
    expect(c.out).toHaveLength(1);
    const j = JSON.parse(c.out[0] ?? "{}") as Record<string, string>;
    expect(j.rg).toBe("/usr/bin/rg");
    expect(j.fff).toBe("ok");
  });

  test("a non-2xx endpoint reports HTTP status and stays informational", async () => {
    const c = capture();
    const ctx = makeContext(mkdtempSync(join(tmpdir(), "sq-doc-")), false, c.overrides);
    const http503: DoctorDeps["fetch"] = () => Promise.resolve(new Response("busy", { status: 503 }));
    const code = await runDoctor(ctx, { which: (bin) => `/usr/bin/${bin}`, fetch: http503 });
    expect(code).toBe(0);
    expect(c.out.find((l) => l.startsWith("embed endpoint"))).toMatch(/HTTP 503$/);
  });
});
