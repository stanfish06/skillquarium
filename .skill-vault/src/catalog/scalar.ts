import { pyStrip } from "./pytext";

const SIMPLE_ESCAPES: Record<string, string> = {
  "\\": "\\",
  "'": "'",
  '"': '"',
  a: "\x07",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
  v: "\v",
};

// Python string-literal escapes; null for \N{...}, which needs the Unicode name table.
function decodePyEscapes(body: string): string | null {
  let out = "";
  for (let i = 0; i < body.length; i++) {
    const ch = body[i] as string;
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = body[i + 1];
    if (next === undefined) return null;
    const s = SIMPLE_ESCAPES[next];
    if (s !== undefined) {
      out += s;
      i += 1;
      continue;
    }
    if (next === "N") return null;
    const oct = /^[0-7]{1,3}/.exec(body.slice(i + 1));
    if (oct) {
      out += String.fromCodePoint(Number.parseInt(oct[0], 8));
      i += oct[0].length;
      continue;
    }
    const hexLen = next === "x" ? 2 : next === "u" ? 4 : next === "U" ? 8 : 0;
    if (hexLen > 0) {
      const hex = body.slice(i + 2, i + 2 + hexLen);
      const code = new RegExp(`^[0-9A-Fa-f]{${hexLen}}$`).test(hex) ? Number.parseInt(hex, 16) : Number.NaN;
      if (Number.isNaN(code) || code > 0x10ffff) return null;
      out += String.fromCodePoint(code);
      i += 1 + hexLen;
      continue;
    }
    // Unknown escapes keep the backslash, as Python does.
    out += ch;
  }
  return out;
}

// ast.literal_eval on a value that starts and ends with `'`: adjacent literals concatenate
// (so YAML's `''` collapses to nothing), escapes decode; null where Python raises.
function pyLiteralEval(value: string): string | null {
  let out = "";
  let i = 0;
  while (i < value.length) {
    const ch = value[i];
    if (ch === " " || ch === "\t") {
      i += 1;
      continue;
    }
    if (ch !== "'") return null;
    let j = i + 1;
    let body = "";
    while (j < value.length && value[j] !== "'") {
      if (value[j] === "\\") {
        if (j + 1 >= value.length) return null;
        body += value.slice(j, j + 2);
        j += 2;
      } else {
        body += value[j];
        j += 1;
      }
    }
    if (j >= value.length) return null;
    const decoded = decodePyEscapes(body);
    if (decoded === null) return null;
    out += decoded;
    i = j + 1;
  }
  return out;
}

// skill_toggle.py _decode_scalar: JSON for "...", ast.literal_eval for '...', plain otherwise.
export function decodeScalar(raw: string): string {
  const value = pyStrip(raw);
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    try {
      return String(JSON.parse(value));
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return pyLiteralEval(value) ?? value.slice(1, -1).replaceAll("''", "'");
  }
  return value;
}
