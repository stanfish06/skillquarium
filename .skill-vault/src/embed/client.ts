import type { Config } from "../config";

export interface EmbedClient {
  embed(inputs: string[]): Promise<Float32Array[]>;
  modelName(): Promise<string>;
}

/** L2 normalization so cosine similarity is a dot product; a zero vector is left as it is. */
export function normalize(v: Float32Array): Float32Array {
  let sum = 0;
  for (const x of v) sum += x * x;
  const norm = Math.sqrt(sum);
  if (norm === 0 || norm === 1) return v;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = (v[i] ?? 0) / norm;
  return out;
}

interface EmbeddingRow {
  index?: number;
  embedding?: unknown;
}

function rowsOf(payload: unknown, count: number): Float32Array[] {
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) throw new Error("embeddings response has no data array");
  if (data.length !== count)
    throw new Error(`embeddings response has ${data.length} rows for ${count} inputs`);
  // llama.cpp returns rows in request order, but `index` is authoritative.
  const sorted = [...(data as EmbeddingRow[])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return sorted.map((row, i) => {
    const values = row.embedding;
    if (!Array.isArray(values) || typeof values[0] !== "number") {
      throw new Error(`embeddings response row ${i} has no numeric embedding`);
    }
    return normalize(Float32Array.from(values as number[]));
  });
}

/** OpenAI-compatible embeddings endpoint as served by llama.cpp. */
export function llamaCppClient(
  cfg: Config["embed"],
  fetchFn: (url: string, init?: RequestInit) => Promise<Response> = fetch,
): EmbedClient {
  const base = cfg.url.replace(/\/+$/, "");

  async function request(path: string, init: RequestInit): Promise<unknown> {
    let last: unknown;
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetchFn(`${base}${path}`, { ...init, signal: AbortSignal.timeout(cfg.timeoutMs) });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
        return await res.json();
      } catch (e) {
        last = e;
        // A loading or restarting server answers 503 for a while; back off and try again.
        if (attempt >= cfg.retries) break;
        await Bun.sleep(500 * 2 ** attempt);
      }
    }
    throw last instanceof Error ? last : new Error(String(last));
  }

  return {
    async embed(inputs) {
      if (inputs.length === 0) return [];
      const body: { input: string[]; model?: string } = { input: inputs };
      if (cfg.model) body.model = cfg.model;
      const payload = await request("/v1/embeddings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      return rowsOf(payload, inputs.length);
    },
    async modelName() {
      const payload = await request("/v1/models", { method: "GET" });
      const first = (payload as { data?: { id?: unknown }[] }).data?.[0];
      return typeof first?.id === "string" ? first.id : "unknown";
    },
  };
}
