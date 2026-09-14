// IEEE 754 half precision: embeddings are stored as float16 rows, halving the index on disk
// for a quantization error well under the noise floor of cosine ranking.

// Reused scratch buffers so a per-value conversion allocates nothing.
const scratchF32 = new Float32Array(1);
const scratchU32 = new Uint32Array(scratchF32.buffer);

// Drop the low 13 bits, rounding to nearest with ties to even: half an ulp less one, plus the
// low bit of the kept mantissa so an exact tie lands on the even neighbour.
function round13(m: number): number {
  return (m + 0x0fff + ((m >>> 13) & 1)) >>> 13;
}

export function f32ToF16(v: number): number {
  scratchF32[0] = v;
  const u = scratchU32[0] ?? 0;
  const sign = (u >>> 16) & 0x8000;
  const raw = (u >>> 23) & 0xff;
  const exp = raw - 127 + 15;
  const mant = u & 0x7fffff;
  // Infinity and NaN carry across; a NaN keeps a payload bit so a poisoned vector stays detectable.
  if (raw === 0xff) return sign | 0x7c00 | (mant ? 0x200 : 0);
  if (exp <= 0) {
    // Below half the smallest subnormal the value rounds to a signed zero.
    if (exp < -10) return sign;
    // Subnormal: restore the implicit leading 1 and shift it into place. Bits the shift drops are
    // OR'd back in as a sticky bit, so a value just off a tie is not rounded as if it were on one.
    const shift = 1 - exp;
    const full = mant | 0x800000;
    const sticky = full & ((1 << shift) - 1) ? 1 : 0;
    // A subnormal that rounds up to 0x400 becomes the smallest normal, which is the right answer.
    return sign | round13((full >>> shift) | sticky);
  }
  // Finite but past 65504: saturate to Infinity.
  if (exp >= 0x1f) return sign | 0x7c00;
  // Add rather than or the rounded mantissa: rounding to nearest can overflow 10 bits and the
  // carry has to land in the exponent (2047.9 -> 2048, 65520 -> Infinity).
  return sign | ((exp << 10) + round13(mant));
}

export function f16ToF32(h: number): number {
  const sign = h & 0x8000 ? -1 : 1;
  const exp = (h >> 10) & 0x1f;
  const mant = h & 0x3ff;
  if (exp === 0) return sign * 2 ** -14 * (mant / 1024);
  if (exp === 0x1f) return mant ? Number.NaN : sign * Number.POSITIVE_INFINITY;
  return sign * 2 ** (exp - 15) * (1 + mant / 1024);
}

/** Rows of equal length packed row-major as little-endian uint16. */
export function packF16(rows: Float32Array[]): Uint8Array {
  const dim = rows[0]?.length ?? 0;
  const bytes = new Uint8Array(rows.length * dim * 2);
  const view = new DataView(bytes.buffer);
  let offset = 0;
  for (const row of rows) {
    if (row.length !== dim) throw new Error(`packF16: row of ${row.length} values among rows of ${dim}`);
    for (let i = 0; i < dim; i++) {
      view.setUint16(offset, f32ToF16(row[i] ?? 0), true);
      offset += 2;
    }
  }
  return bytes;
}

export function unpackF16(bytes: Uint8Array, dim: number): Float32Array[] {
  if (!Number.isInteger(dim) || dim <= 0)
    throw new Error(`unpackF16: dim must be a positive integer, got ${dim}`);
  const stride = dim * 2;
  if (bytes.byteLength % stride !== 0) {
    throw new Error(`unpackF16: ${bytes.byteLength} bytes is not a multiple of the ${stride}-byte row`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const rows: Float32Array[] = [];
  for (let offset = 0; offset < bytes.byteLength; offset += stride) {
    const row = new Float32Array(dim);
    for (let i = 0; i < dim; i++) row[i] = f16ToF32(view.getUint16(offset + i * 2, true));
    rows.push(row);
  }
  return rows;
}
