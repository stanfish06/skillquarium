function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// skill_toggle.py _read_boolean_field. `text` is whatever load_skill passes: the frontmatter body
// (lines between the fences) for SKILL.md, the whole file for agents/openai.yaml.
export function readBooleanField(text: string, field: string, topLevel: boolean): boolean | null {
  const f = escapeRegExp(field);
  const indent = topLevel ? "" : "[ \\t]+";
  const valid = new RegExp(`^${indent}${f}:[ \\t]*(true|false)[ \\t]*(?:#[^\\n]*)?$`);
  // The presence check ignores indentation in both modes, so an indented top-level field is an error.
  const anyField = new RegExp(`^[ \\t]*${f}:`);
  const values: string[] = [];
  let seen = 0;
  // Python reads in universal-newline mode and matches with (?m), whose ^/$ only see "\n".
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    const m = valid.exec(line);
    if (m?.[1] !== undefined) values.push(m[1]);
    if (anyField.test(line)) seen += 1;
  }
  if (seen > 1 || values.length > 1) throw new Error(`duplicate ${field} fields`);
  if (seen > 0 && values.length === 0) throw new Error(`${field} must be true or false`);
  const v = values[0];
  return v === undefined ? null : v === "true";
}
