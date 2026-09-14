import { describe, expect, test } from "bun:test";
import type { Config } from "../../src/config";
import { llamaCppClient, normalize } from "../../src/embed/client";

const cfg: Config["embed"] = { url: "http://x/", model: null, batchSize: 16, timeoutMs: 5000, retries: 0 };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("normalize", () => {
  test("unit length, zero vector untouched", () => {
    const v = normalize(new Float32Array([3, 4]));
    expect(v[0]).toBeCloseTo(0.6, 6);
    expect(v[1]).toBeCloseTo(0.8, 6);
    expect(Array.from(normalize(new Float32Array([0, 0])))).toEqual([0, 0]);
  });
});

describe("llamaCppClient", () => {
  test("posts input, keeps result order by index, normalizes rows", async () => {
    const seen: { url: string; body: unknown }[] = [];
    const client = llamaCppClient(cfg, async (url, init) => {
      seen.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return jsonResponse({
        data: [
          { index: 1, embedding: [0, 2] },
          { index: 0, embedding: [3, 4] },
        ],
      });
    });
    const rows = await client.embed(["a", "b"]);
    expect(seen[0]?.url).toBe("http://x/v1/embeddings");
    expect(seen[0]?.body).toEqual({ input: ["a", "b"] });
    expect(rows[0]?.[0]).toBeCloseTo(0.6, 6);
    expect(rows[0]?.[1]).toBeCloseTo(0.8, 6);
    expect(Array.from(rows[1] ?? [])).toEqual([0, 1]);
  });

  test("model is sent only when configured, and no request is made for no inputs", async () => {
    let calls = 0;
    const client = llamaCppClient({ ...cfg, model: "qwen3" }, async (_url, init) => {
      calls++;
      expect(JSON.parse(String(init?.body))).toEqual({ input: ["a"], model: "qwen3" });
      return jsonResponse({ data: [{ index: 0, embedding: [1] }] });
    });
    await client.embed(["a"]);
    expect(await client.embed([])).toEqual([]);
    expect(calls).toBe(1);
  });

  test("non-2xx throws with the status and the start of the body", async () => {
    const client = llamaCppClient(cfg, async () => new Response("x".repeat(500), { status: 500 }));
    await expect(client.embed(["a"])).rejects.toThrow(/^HTTP 500: x{200}$/);
  });

  test("retries with backoff, then succeeds", async () => {
    let calls = 0;
    const client = llamaCppClient({ ...cfg, retries: 2 }, async () => {
      calls++;
      if (calls < 3) return new Response("loading", { status: 503 });
      return jsonResponse({ data: [{ index: 0, embedding: [1, 0] }] });
    });
    const started = Date.now();
    const rows = await client.embed(["a"]);
    expect(calls).toBe(3);
    expect(Date.now() - started).toBeGreaterThanOrEqual(1400); // 500 + 1000 ms of backoff
    expect(Array.from(rows[0] ?? [])).toEqual([1, 0]);
  }, 10_000);

  test("a row count that does not match the inputs is an error", async () => {
    const client = llamaCppClient(cfg, async () => jsonResponse({ data: [{ index: 0, embedding: [1] }] }));
    await expect(client.embed(["a", "b"])).rejects.toThrow("1 rows for 2 inputs");
  });

  test("modelName reads /v1/models and falls back to unknown", async () => {
    const withModel = llamaCppClient(cfg, async (url) => {
      expect(String(url)).toBe("http://x/v1/models");
      return jsonResponse({ data: [{ id: "qwen3-embed-0.6b", meta: { n_embd: 1024 } }] });
    });
    expect(await withModel.modelName()).toBe("qwen3-embed-0.6b");
    const empty = llamaCppClient(cfg, async () => jsonResponse({ data: [] }));
    expect(await empty.modelName()).toBe("unknown");
  });
});
