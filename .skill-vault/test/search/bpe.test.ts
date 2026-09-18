import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { Bm25Index } from "../../src/search/bm25";
import { Bpe, loadBpeTokenizer, normalize, TOKENIZER_PATH } from "../../src/search/bpe";
import { buildGraph } from "../../src/search/graph";

// Trained by skill-tokenizer on fixtures/tokenizer/corpus; the golden is that binary's own
// `encode` output, so these tests hold the encoder to the Rust implementation without Rust.
const FIXTURE = resolve(import.meta.dir, "../fixtures/tokenizer/tokenizer.json");
const GOLDEN = resolve(import.meta.dir, "../fixtures/tokenizer/encode.golden.json");

test("encodes exactly what skill-tokenizer encodes", () => {
  const bpe = Bpe.load(FIXTURE);
  const golden = JSON.parse(readFileSync(GOLDEN, "utf8")) as Record<string, string[]>;
  expect(Object.keys(golden).length).toBeGreaterThan(10);
  for (const [text, tokens] of Object.entries(golden)) {
    expect({ text, tokens: bpe.encode(text) }).toEqual({ text, tokens });
  }
});

test("a __proto__ vocab entry survives loading", () => {
  const json = JSON.parse(readFileSync(FIXTURE, "utf8")) as { model: { vocab: Record<string, number> } };
  expect(Object.hasOwn(json.model.vocab, "__proto__")).toBe(true);
  expect(Bpe.load(FIXTURE).encode("__proto__")).toEqual(["__proto__"]);
});

test("string and pair merge formats encode alike", () => {
  const model = (merges: unknown[]) => ({
    normalizer: null,
    pre_tokenizer: { type: "WhitespaceSplit" },
    model: {
      type: "BPE",
      unk_token: "[UNK]",
      vocab: { "[UNK]": 0, a: 1, b: 2, c: 3, ab: 4, abc: 5 },
      merges,
    },
  });
  const strings = new Bpe(model(["a b", "ab c"]));
  const pairs = new Bpe(
    model([
      ["a", "b"],
      ["ab", "c"],
    ]),
  );
  expect(strings.encode("abc cab zz")).toEqual(["abc", "c", "ab", "[UNK]", "[UNK]"]);
  expect(pairs.encode("abc cab zz")).toEqual(strings.encode("abc cab zz"));
});

test("merges apply lowest rank first, not left to right", () => {
  // "bc" outranks "ab", so "abc" must become a + bc even though "ab" is the leftmost pair.
  const bpe = new Bpe({
    normalizer: null,
    pre_tokenizer: { type: "WhitespaceSplit" },
    model: {
      type: "BPE",
      unk_token: null,
      vocab: { a: 0, b: 1, c: 2, ab: 3, bc: 4 },
      merges: ["b c", "a b"],
    },
  });
  expect(bpe.encode("abc")).toEqual(["a", "bc"]);
});

test("a merge naming a token outside the vocab is rejected at load", () => {
  expect(
    () =>
      new Bpe({
        normalizer: null,
        pre_tokenizer: { type: "WhitespaceSplit" },
        model: { type: "BPE", unk_token: null, vocab: { a: 0, b: 1 }, merges: ["a b"] },
      }),
  ).toThrow(/outside the vocab/);
});

test("normalize strips, drops combining marks, lowercases, then composes", () => {
  expect(normalize("  Hello World  ")).toBe("hello world");
  expect(normalize("é")).toBe("e");
  // Precomposed accents carry no combining mark to drop: skill-tokenizer keeps them too.
  expect(normalize("Café")).toBe("café");
});

test("the loader reads the committed model path, or reports none", () => {
  const root = mkdtempSync(join(tmpdir(), "sq-bpe-"));
  try {
    expect(loadBpeTokenizer(root)).toBeNull();
    const dest = join(root, TOKENIZER_PATH);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, readFileSync(FIXTURE));
    const tokenizer = loadBpeTokenizer(root);
    expect(tokenizer?.name).toBe("bpe");
    expect(tokenizer?.encode(null)).toEqual([]);
    expect(tokenizer?.encode("reverse engineer")).toEqual(Bpe.load(FIXTURE).encode("reverse engineer"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("BM25 over BPE pieces matches words that share a piece", () => {
  const bpe = Bpe.load(FIXTURE);
  // The fixture splits both into "binar" + suffix, so the piece carries the match.
  expect(bpe.encode("binary")[0]).toBe(bpe.encode("binaries")[0]);
  const graph = buildGraph({
    nodes: [
      { id: "disassembler", type: "Skill", label: "disassembler", description: "inspect binaries" },
      { id: "plotter", type: "Skill", label: "plotter", description: "draw interactive charts" },
    ],
    edges: [],
  });
  const index = new Bm25Index(graph, { name: "bpe", encode: (t) => bpe.encode(t ?? "") });
  expect(index.topK("binary", 2).map((r) => r.id)).toEqual(["disassembler"]);
});
