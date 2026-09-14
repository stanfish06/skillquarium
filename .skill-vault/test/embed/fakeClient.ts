import { createHash } from "node:crypto";
import type { EmbedClient } from "../../src/embed/client";

export const FAKE_DIM = 8;

/** Deterministic unit vector derived from sha256 of the text; records every embed() call. */
export interface FakeClient extends EmbedClient {
  calls: string[][];
}

export function fakeClient(opts: { fail?: boolean; model?: string } = {}): FakeClient {
  const calls: string[][] = [];
  return {
    calls,
    async embed(inputs) {
      if (opts.fail) throw new Error("fake client must not be called");
      calls.push([...inputs]);
      return inputs.map(fakeVector);
    },
    async modelName() {
      if (opts.fail) throw new Error("fake client must not be called");
      return opts.model ?? "fake-embed";
    },
  };
}

export function fakeVector(text: string): Float32Array {
  const digest = createHash("sha256").update(text).digest();
  const v = new Float32Array(FAKE_DIM);
  for (let i = 0; i < FAKE_DIM; i++) v[i] = (digest[i] ?? 0) / 255 - 0.5;
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < FAKE_DIM; i++) v[i] = (v[i] ?? 0) / norm;
  return v;
}
