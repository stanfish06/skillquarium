import { expect, test } from "bun:test";
import { rrf, type Signal, type SignalName } from "../../src/search/fusion";
import type { Ranked } from "../../src/search/types";

const WEIGHTS: Record<SignalName, number> = { lexical: 1, fuzzy: 1, semantic: 1 };

/** Positions are what rrf reads; the scores only ride along. */
function list(...ids: string[]): Ranked[] {
  return ids.map((id, i) => ({ id, score: 1 - i * 0.1, rank: i + 1 }));
}

test("fused score is the summed reciprocal rank, ties broken by id", () => {
  const signals: Signal[] = [
    { name: "lexical", results: list("a", "b", "c") },
    { name: "fuzzy", results: list("b", "a") },
    { name: "semantic", results: list("c") },
  ];
  const fused = rrf(signals, 60, WEIGHTS);
  // a and b both take ranks 1 and 2, so their sums are bit-identical and the id decides.
  expect(fused.map((r) => r.id)).toEqual(["a", "b", "c"]);
  expect(fused[0]?.score).toBeCloseTo(1 / 61 + 1 / 62, 12);
  expect(fused[1]?.score).toBe(fused[0]?.score ?? 0);
  expect(fused[2]?.score).toBeCloseTo(1 / 63 + 1 / 61, 12);
});

test("ranks are reassigned 1-based over the fused order", () => {
  const fused = rrf(
    [
      { name: "lexical", results: list("x", "y") },
      { name: "semantic", results: list("z", "y") },
    ],
    60,
    WEIGHTS,
  );
  expect(fused.map((r) => r.rank)).toEqual([1, 2, 3]);
  // y is the only id two signals agree on, so it leads even though it was never first.
  expect(fused[0]?.id).toBe("y");
});

test("a weight of zero removes the signal entirely", () => {
  const signals: Signal[] = [
    { name: "lexical", results: list("a", "b") },
    { name: "semantic", results: list("z", "a") },
  ];
  const withSemantic = rrf(signals, 60, WEIGHTS);
  const without = rrf(signals, 60, { ...WEIGHTS, semantic: 0 });
  expect(withSemantic.map((r) => r.id)).toEqual(["a", "z", "b"]);
  // z came only from the zero-weighted signal, so it is gone rather than scored 0 and listed last.
  expect(without.map((r) => r.id)).toEqual(["a", "b"]);
  expect(without.map((r) => r.rank)).toEqual([1, 2]);
  expect(without[0]?.score).toBeCloseTo(1 / 61, 12);
});

test("a heavier weight outranks two light signals", () => {
  const signals: Signal[] = [
    { name: "lexical", results: list("a") },
    { name: "fuzzy", results: list("a") },
    { name: "semantic", results: list("b") },
  ];
  expect(rrf(signals, 60, WEIGHTS).map((r) => r.id)).toEqual(["a", "b"]);
  expect(rrf(signals, 60, { ...WEIGHTS, semantic: 3 }).map((r) => r.id)).toEqual(["b", "a"]);
});

test("no signals fuse to nothing", () => {
  expect(rrf([], 60, WEIGHTS)).toEqual([]);
  expect(rrf([{ name: "lexical", results: [] }], 60, WEIGHTS)).toEqual([]);
});
