import type { Dirent } from "node:fs";
import { lstatSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { collapseWhitespace, pyStrip, universalNewlines } from "../catalog";

/**
 * Self-referential catalog coercion only. Domain "must" / "mandatory" inside the skill body is
 * left alone; only the YAML description is rewritten.
 */
export const COERCION_NEEDLES: readonly string[] = [
  "always use",
  "always invoke",
  "you must use",
  "you must invoke",
  "you must learn",
  "must be used",
  "mandatory prerequisite",
  "this skill should be used",
  "should be invoked",
  "trigger broadly",
  "this skill should activate",
  "before any response",
  "starting any conversation",
  "used for everything",
  "use this skill proactively",
  "without loading this skill first",
  "don't ignore",
  "do not ignore",
  "rules you must follow",
];

/**
 * More specific patterns first; each pass is idempotent on already-softened text. Copied from
 * soften_skill_description.sh, `(?i)` as the `i` flag and `g` for re.sub's replace-all.
 */
const REPLACEMENTS: readonly [RegExp, string][] = [
  [/\*\*MANDATORY prerequisite\*\*\s*[—–-]\s*/gis, ""],
  [/MANDATORY prerequisite\s*[—–-]\s*/gis, ""],
  [/you MUST invoke this skill BEFORE every/gi, "Load this skill before every"],
  [/NEVER call (`[^`]+`) directly without loading this skill first\.?\s*/gi, ""],
  [/Skipping it causes common, hard-to-debug failures\.\s*/gi, ""],
  [/You MUST use this before any/gi, "Use before"],
  [/MUST be used first when/gi, "Use first when"],
  [/This skill MUST be used whenever/gi, "Use when"],
  [/MUST be used whenever/gi, "Use when"],
  [
    /When you plan or implement a feature, you must learn this skill\.?/gi,
    "Read this skill when planning or implementing a feature.",
  ],
  [/you must learn this skill/gi, "read this skill"],
  [/is used for EVERYTHING related to/gi, "covers"],
  [/used for EVERYTHING related to/gi, "covers"],
  [/ALWAYS use this skill when/gi, "Use when"],
  [/ALWAYS use when/gi, "Use when"],
  [/This skill should be used at the start of any/gi, "Use at the start of"],
  [/This skill should be used when/gi, "Use when"],
  [/This skill should be used for/gi, "Use for"],
  [/This skill should be used to/gi, "Use to"],
  [/Should be invoked for/gi, "Use for"],
  [/[Ii]t should be invoked\s+when/gi, "Use when"],
  [/[Ii]t should be invoked/gi, "Invoke it"],
  [/Use this skill proactively\s+when/gi, "Use when"],
  [/Use this skill proactively/gi, "Use when relevant"],
  [/Trigger broadly\s*[—–-]\s*/gi, ""],
  [/\s*this skill should activate\.?/gi, ""],
  [/Use when starting any conversation\s*[-—–]\s*/gi, "Use when discovering which skill applies — "],
  [/, requiring Skill tool invocation before ANY response including clarifying questions/gi, ""],
  [
    /requiring Skill tool invocation before ANY response including clarifying questions/gi,
    "helps locate and load the matching skill for the current task",
  ],
  [/Rules you must follow for/gi, "Rules for"],
  [/don't ignore/gi, "consider"],
  [/do not ignore/gi, "consider"],
];

/** Vault root that holds no skills/ directory: the script's SystemExit. */
export class MissingSkillsDirError extends Error {}

export function needsSoften(description: string): boolean {
  const lowered = description.toLowerCase();
  return COERCION_NEEDLES.some((needle) => lowered.includes(needle));
}

/** Python str.strip(chars). */
function stripChars(text: string, chars: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && chars.includes(text[start] ?? "")) start += 1;
  while (end > start && chars.includes(text[end - 1] ?? "")) end -= 1;
  return text.slice(start, end);
}

export function soften(description: string): string {
  let text = pyStrip(description);
  for (const [pattern, replacement] of REPLACEMENTS) text = text.replace(pattern, replacement);
  // Hard rule: no catalog line may tell the agent to "always use" anything.
  text = text.replace(/\balways use\b/gi, "Use");
  text = text.replace(/\balways invoke\b/gi, "Invoke");
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/ *\n */g, "\n");
  text = text.replace(/ +([,;:])/g, "$1");
  text = text.replace(/\s*[—–]\s*[—–]\s*/g, " — ");
  text = stripChars(text, " \t—-");
  text = text.replace(/ {2,}/g, " ");
  const first = text[0];
  if (first !== undefined) text = first.toUpperCase() + text.slice(1);
  return text;
}

function yamlDoubleQuote(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

/** Greedy wrap at `width` columns, each line prefixed with `indent`. */
export function foldYaml(value: string, width = 88, indent = "  "): string {
  const words = collapseWhitespace(value).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current: string[] = [];
  let length = 0;
  for (const word of words) {
    const extra = word.length + (current.length ? 1 : 0);
    if (current.length && length + extra > width) {
      lines.push(indent + current.join(" "));
      current = [word];
      length = word.length;
    } else {
      current.push(word);
      length += extra;
    }
  }
  if (current.length) lines.push(indent + current.join(" "));
  return `${lines.join("\n")}\n`;
}

export type DescriptionStyle = "quoted" | "folded" | "literal" | "plain";

export interface ParsedDescription {
  /** Offsets of the description entry inside the frontmatter text. */
  start: number;
  end: number;
  value: string;
  style: DescriptionStyle;
}

const BLOCK_DESCRIPTION = /^(description:\s*)([|>][+-]?)[ \t]*\n((?:[ \t]+.*\n?)*)/m;
const SCALAR_DESCRIPTION = /^(description:\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\n]+)[ \t]*\n?/m;
const BLOCK_INDICATORS = new Set([">", "|", ">-", "|-", ">+", "|+"]);

/** Python str.splitlines(): no trailing empty element for a text ending in a newline. */
function splitLines(text: string): string[] {
  const lines = text.split("\n");
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

export function parseDescription(frontmatter: string): ParsedDescription | null {
  const block = BLOCK_DESCRIPTION.exec(frontmatter);
  if (block) {
    const body = block[3] ?? "";
    const indent = /^[ \t]+/.exec(body)?.[0] ?? "  ";
    const chunks: string[] = [];
    for (const raw of splitLines(body)) {
      if (pyStrip(raw) === "") chunks.push("");
      else chunks.push(raw.startsWith(indent) ? raw.slice(indent.length) : raw.replace(/^\s+/, ""));
    }
    const span = { start: block.index, end: block.index + block[0].length };
    if ((block[2] ?? "").startsWith(">")) {
      const parsed = chunks.map(pyStrip).filter(Boolean).join(" ");
      return { ...span, value: parsed, style: "folded" };
    }
    return { ...span, value: stripChars(chunks.join("\n"), "\n"), style: "literal" };
  }

  const scalar = SCALAR_DESCRIPTION.exec(frontmatter);
  if (!scalar) return null;
  const raw = pyStrip(scalar[2] ?? "");
  // A bare indicator means the block regex above should have matched; leave the file alone.
  if (BLOCK_INDICATORS.has(raw)) return null;
  const span = { start: scalar.index, end: scalar.index + scalar[0].length };
  if (raw.startsWith('"') && raw.endsWith('"')) {
    return {
      ...span,
      value: raw.slice(1, -1).replaceAll('\\"', '"').replaceAll("\\\\", "\\"),
      style: "quoted",
    };
  }
  if (raw.startsWith("'") && raw.endsWith("'")) {
    return { ...span, value: raw.slice(1, -1).replaceAll("''", "'"), style: "quoted" };
  }
  return { ...span, value: raw, style: "plain" };
}

export function renderDescription(value: string, style: DescriptionStyle): string {
  if (style === "folded") return `description: >\n${foldYaml(value)}`;
  if (style === "literal") {
    const indented = value
      .split("\n")
      .map((line) => (line ? `  ${line}` : ""))
      .join("\n");
    return `description: |\n${indented}\n`;
  }
  // quoted / plain: quote whenever the value would be ambiguous YAML
  if (style === "plain" && !/[:#[\]{}"']/.test(value) && !value.includes("\n")) {
    return `description: ${value}\n`;
  }
  return `description: ${yamlDoubleQuote(value)}\n`;
}

export interface Document {
  opener: string;
  frontmatter: string;
  /** The closing fence and everything after it, kept byte for byte. */
  closerAndBody: string;
}

export function splitDocument(text: string): Document | null {
  if (!text.startsWith("---")) return null;
  let rest = text.slice(3);
  let opener: string;
  if (rest.startsWith("\r\n")) {
    rest = rest.slice(2);
    opener = "---\r\n";
  } else if (rest.startsWith("\n")) {
    rest = rest.slice(1);
    opener = "---\n";
  } else {
    return null;
  }
  if (rest.startsWith("---")) return null;
  const end = rest.indexOf("\n---");
  if (end < 0) return null;
  return { opener, frontmatter: rest.slice(0, end), closerAndBody: rest.slice(end) };
}

export interface SoftenIo {
  out: (line: string) => void;
  err: (line: string) => void;
}

function realpathOr(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

/** The path the script prints: relative to the vault root, absolute when it lies outside. */
function displayPath(path: string, root: string): string {
  const rel = relative(root, realpathOr(path));
  return rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel : path;
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Rewrite one file's description; returns whether it changed (or would, under dryRun). */
export function processFile(path: string, root: string, dryRun: boolean, io: SoftenIo): boolean {
  try {
    if (lstatSync(path).isSymbolicLink()) return false;
  } catch {
    return false;
  }
  let original: string;
  try {
    original = universalNewlines(readFileSync(path, "utf8"));
  } catch (e) {
    io.err(`skip ${path}: ${message(e)}`);
    return false;
  }
  const document = splitDocument(original);
  if (document === null) return false;
  const parsed = parseDescription(document.frontmatter);
  if (parsed === null) return false;
  // Three gates, each of which makes a second run a no-op: the needles, the rewritten
  // description, and the re-emitted frontmatter.
  if (!needsSoften(parsed.value)) return false;
  const softened = soften(parsed.value);
  if (softened === parsed.value) return false;
  const newFrontmatter =
    document.frontmatter.slice(0, parsed.start) +
    renderDescription(softened, parsed.style) +
    document.frontmatter.slice(parsed.end);
  if (newFrontmatter === document.frontmatter) return false;

  io.out(`${dryRun ? "would soften" : "softened"} ${displayPath(path, root)}`);
  if (!dryRun) writeFileSync(path, document.opener + newFrontmatter + document.closerAndBody, "utf8");
  return true;
}

const SKIP_DIRS = new Set(["node_modules", ".git", "__pycache__"]);

/** Every SKILL.md under `skillsDir`, sorted; symlinked directories are not followed. */
export function iterSkillFiles(skillsDir: string): string[] {
  const found: string[] = [];
  const walk = (directory: string): void => {
    let entries: Dirent[];
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some((entry) => entry.name === "SKILL.md" && !entry.isDirectory())) {
      found.push(join(directory, "SKILL.md"));
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) walk(join(directory, entry.name));
    }
  };
  walk(skillsDir);
  return found.sort();
}

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export function resolveSkillsDir(root: string): string {
  if (isDir(join(root, "skills"))) return join(root, "skills");
  if (basename(root) === "skills" && isDir(root)) return root;
  throw new MissingSkillsDirError(`No skills/ directory under ${root}`);
}

export interface SoftenOptions {
  dryRun?: boolean;
}

/** soften_skill_description.sh main(): rewrite every coercive description, always exit 0. */
export function softenVault(root: string, options: SoftenOptions, io: SoftenIo): number {
  const vaultRoot = realpathOr(resolve(root));
  const skillsDir = resolveSkillsDir(vaultRoot);
  const dryRun = options.dryRun === true;
  let changed = 0;
  for (const file of iterSkillFiles(skillsDir)) {
    if (processFile(file, vaultRoot, dryRun, io)) changed += 1;
  }
  io.out(
    `${dryRun ? "would soften" : "softened"} ${changed} skill ${changed === 1 ? "description" : "descriptions"}`,
  );
  return 0;
}
