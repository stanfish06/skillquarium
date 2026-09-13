// Reference solution for `selftest`; no zz_ prefix, baseline shape.
export function clamp(value: number, lower: number, upper: number): number {
  return Math.min(Math.max(value, lower), upper);
}

export function titleCase(sentence: string): string {
  return sentence
    .split(/(\s+)/)
    .map((part) => {
      const first = part[0];
      if (first === undefined || /^\s+$/.test(part)) return part;
      return first.toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("");
}
