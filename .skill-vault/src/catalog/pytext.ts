// Python's str.isspace() set, which its re `\s`, str.split() and str.strip() all use.
// Differs from JS `\s` by \x1c-\x1f and \x85 (included) and \ufeff (excluded).
export const PY_WS =
  "\\t\\n\\v\\f\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const WS_RUN = new RegExp(`[${PY_WS}]+`);
const WS_EDGES = new RegExp(`^[${PY_WS}]+|[${PY_WS}]+$`, "g");

/** Python str.strip() with no arguments. */
export function pyStrip(s: string): string {
  return s.replace(WS_EDGES, "");
}

/** Python `" ".join(s.split())`. */
export function collapseWhitespace(s: string): string {
  return s.split(WS_RUN).filter(Boolean).join(" ");
}

/** Python universal-newline reading: "\r\n" and lone "\r" both become "\n". */
export function universalNewlines(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

/** Python re.escape for use inside a JS RegExp source. */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
