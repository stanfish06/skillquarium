export interface SkillEntry {
  /** "scanpy", or "gstack/qa" for a one-level bundle child. */
  id: string;
  /** Absolute path to the skill folder. */
  dir: string;
  /** Absolute path to SKILL.md. */
  file: string;
}

export interface Frontmatter {
  /** Full file split into lines, each keeping its own line ending. */
  lines: string[];
  /** Index of the closing "---" line. */
  closingIndex: number;
  newline: "\n" | "\r\n";
}
