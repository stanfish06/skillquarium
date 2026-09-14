import { describe, expect, test } from "bun:test";
import { f16ToF32, f32ToF16, packF16, unpackF16 } from "../../src/embed/f16";

describe("f16 scalar conversion", () => {
  test("round trip within 1e-3 relative, denormals within 1e-7 absolute", () => {
    for (const v of [0, 1, -1, 0.5, 65504, 6.1e-5, -Math.PI, 1e-8]) {
      const back = f16ToF32(f32ToF16(v));
      if (Math.abs(v) < 6.1e-5) expect(Math.abs(back - v)).toBeLessThanOrEqual(1e-7);
      else expect(Math.abs(back - v) / Math.abs(v)).toBeLessThanOrEqual(1e-3);
    }
  });

  test("mantissa rounding carries into the exponent", () => {
    // 2047.9 rounds up past the 10-bit mantissa; result must be 2048, not a corrupted exponent field.
    expect(f16ToF32(f32ToF16(2047.9))).toBe(2048);
    // Largest finite f16 stays finite; anything rounding past it becomes Infinity.
    expect(f16ToF32(f32ToF16(65504))).toBe(65504);
    expect(f16ToF32(f32ToF16(65520))).toBe(Number.POSITIVE_INFINITY);
    expect(f16ToF32(f32ToF16(1e10))).toBe(Number.POSITIVE_INFINITY);
    expect(f16ToF32(f32ToF16(-1e10))).toBe(Number.NEGATIVE_INFINITY);
  });

  test("ties round to even, including across the subnormal boundary", () => {
    // Exactly halfway between 1 and the next half value: the even neighbour wins.
    expect(f32ToF16(1.00048828125)).toBe(0x3c00);
    expect(f32ToF16(1.00146484375)).toBe(0x3c02);
    // 2^-25 is half the smallest subnormal, so it ties down to zero; anything above it rounds up.
    expect(f32ToF16(2.9802322387695312e-8)).toBe(0x0000);
    expect(f32ToF16(3e-8)).toBe(0x0001);
    // 1.5 * 2^-24 ties to the even code 2; a value one f32 ulp below it must stay at code 1.
    expect(f32ToF16(8.940696716308594e-8)).toBe(0x0002);
    expect(f32ToF16(8.94051979116739e-8)).toBe(0x0001);
    // Smallest normal, reached by a subnormal whose rounding carries into the exponent.
    expect(f32ToF16(6.1035156e-5)).toBe(0x0400);
  });

  test("NaN stays NaN while finite overflow saturates to Infinity", () => {
    expect(f16ToF32(f32ToF16(Number.NaN))).toBeNaN();
    expect(f32ToF16(Number.POSITIVE_INFINITY)).toBe(0x7c00);
    expect(f32ToF16(Number.NEGATIVE_INFINITY)).toBe(0xfc00);
    expect(f32ToF16(1e10)).toBe(0x7c00);
  });

  test("codes are 16-bit and preserve sign of zero", () => {
    expect(f32ToF16(-0)).toBe(0x8000);
    expect(f32ToF16(1)).toBe(0x3c00);
    expect(f32ToF16(-2)).toBe(0xc000);
  });
});

describe("packF16 / unpackF16", () => {
  test("1024 floats pack to exactly 2048 bytes", () => {
    const row = new Float32Array(1024).map((_, i) => Math.sin(i));
    const bytes = packF16([row]);
    expect(bytes.byteLength).toBe(2048);
  });

  test("two rows round trip", () => {
    const a = new Float32Array([0.25, -0.5, 1, 0]);
    const b = new Float32Array([2, -3, 0.125, 100]);
    const rows = unpackF16(packF16([a, b]), 4);
    expect(rows).toHaveLength(2);
    expect(Array.from(rows[0] ?? [])).toEqual(Array.from(a));
    expect(Array.from(rows[1] ?? [])).toEqual(Array.from(b));
  });

  test("little-endian layout", () => {
    const bytes = packF16([new Float32Array([1])]);
    expect(Array.from(bytes)).toEqual([0x00, 0x3c]);
  });

  test("unpack rejects a byte length that is not a multiple of the row size", () => {
    expect(() => unpackF16(new Uint8Array(6), 4)).toThrow();
  });
});
