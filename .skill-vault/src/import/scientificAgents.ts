import { copyFileSync, mkdirSync, readFileSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import { collapseWhitespace, pyStrip, universalNewlines } from "../catalog";

export const SOURCE_REPO = "K-Dense-AI/scientific-agents";
export const SOURCE_URL = "https://github.com/K-Dense-AI/scientific-agents";
export const LOCAL_PATCH_NOTE =
  "Local corrections listed in `metadata.local-patches` are vault overlays, not upstream text.";
/** Patches moved into .skill-vault/data/ alongside local-overrides.json. */
export const PATCHES_PATH = resolve(import.meta.dir, "../../data/scientific-agent-patches.json");

const AgentSchema = z.object({
  slug: z.string(),
  profession: z.string(),
  summary: z.string().optional(),
  work_mode: z.string().optional(),
  path: z.string().optional(),
  created: z.string().optional(),
  updated: z.string().optional(),
  source_count: z.union([z.number(), z.string()]).optional(),
});
export type Agent = z.infer<typeof AgentSchema>;

const CatalogSchema = z.object({ agents: z.array(AgentSchema) });

const LocalPatchSchema = z.object({ id: z.string(), find: z.string(), replace: z.string() });
export type LocalPatch = z.infer<typeof LocalPatchSchema>;
const PatchMapSchema = z.record(z.string(), z.array(LocalPatchSchema));
export type PatchMap = z.infer<typeof PatchMapSchema>;

// Python textwrap character classes. \p{L}/\p{N} stand in for Python's Unicode-aware
// \w and \d, which JS \w and \d do not provide.
const WS = "\\t\\n\\v\\f\\r ";
const LETTER = "[_\\p{L}]";
const WORD = "[_\\p{L}\\p{N}]";
const WORD_PUNCT = "[_\\p{L}\\p{N}!\"'&.,?]";
// textwrap.wordsep_re: whitespace runs, em-dashes, and words breakable after an interior hyphen.
const WORDSEP = new RegExp(
  `([${WS}]+` +
    `|(?<=${WORD_PUNCT})-{2,}(?=${WORD})` +
    `|[^${WS}]+?(?:` +
    `-(?:(?<=${LETTER}{2}-)|(?<=${LETTER}-${LETTER}-))(?=${LETTER}-?${LETTER})` +
    `|(?=[${WS}]|$)` +
    `|(?<=${WORD_PUNCT})(?=-{2,}${WORD})))`,
  "u",
);
// Python str.splitlines() boundaries.
const LINE_BOUNDARIES = new Set([
  "\n",
  "\r",
  "\v",
  "\f",
  "\u001c",
  "\u001d",
  "\u001e",
  "\u0085",
  "\u2028",
  "\u2029",
]);

/** Python str.splitlines(): no trailing empty line, and "\r\n" counts once. */
function splitLines(text: string): string[] {
  const lines: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] ?? "";
    if (!LINE_BOUNDARIES.has(ch)) continue;
    lines.push(text.slice(start, i));
    if (ch === "\r" && text[i + 1] === "\n") i += 1;
    start = i + 1;
  }
  if (start < text.length) lines.push(text.slice(start));
  return lines;
}

/** Python str.expandtabs(8). */
function expandTabs(text: string, tabsize = 8): string {
  let out = "";
  let column = 0;
  for (const ch of text) {
    if (ch === "\t") {
      const pad = tabsize - (column % tabsize);
      out += " ".repeat(pad);
      column += pad;
    } else if (ch === "\n" || ch === "\r") {
      out += ch;
      column = 0;
    } else {
      out += ch;
      column += 1;
    }
  }
  return out;
}

/** textwrap.TextWrapper._munge_whitespace with expand_tabs and replace_whitespace on. */
function mungeWhitespace(text: string): string {
  return expandTabs(text).replace(/[\t\n\v\f\r]/g, " ");
}

/** textwrap.TextWrapper._wrap_chunks for one paragraph, drop_whitespace and break_long_words on. */
function wrapParagraph(text: string, width: number, indent: string): string[] {
  const chunks = mungeWhitespace(text).split(WORDSEP).filter(Boolean);
  const lines: string[] = [];
  let i = 0;
  while (i < chunks.length) {
    const available = width - indent.length;
    // Leading whitespace is dropped on every line after the first.
    if (lines.length > 0 && pyStrip(chunks[i] ?? "") === "") {
      i += 1;
      continue;
    }
    const current: string[] = [];
    let length = 0;
    while (i < chunks.length) {
      const chunk = chunks[i] ?? "";
      if (length + chunk.length > available) break;
      current.push(chunk);
      length += chunk.length;
      i += 1;
    }
    // A chunk wider than the whole line is broken, after its last hyphen when it has one.
    const head = chunks[i];
    if (head !== undefined && head.length > available) {
      const spaceLeft = available < 1 ? 1 : available - length;
      let end = spaceLeft;
      if (head.length > spaceLeft) {
        const hyphen = head.lastIndexOf("-", spaceLeft - 1);
        if (hyphen > 0 && /[^-]/.test(head.slice(0, hyphen))) end = hyphen + 1;
      }
      current.push(head.slice(0, end));
      chunks[i] = head.slice(end);
    }
    // Trailing whitespace never survives into the emitted line.
    const last = current[current.length - 1];
    if (last !== undefined && pyStrip(last) === "") current.pop();
    if (current.length > 0) lines.push(indent + current.join(""));
  }
  return lines;
}

/** Wrap for a YAML folded scalar: greedy 88-column lines under a 2-space indent. */
export function folded(text: string, width = 88, indent = "  "): string {
  const lines: string[] = [];
  const paragraphs = splitLines(text);
  for (const paragraph of paragraphs.length > 0 ? paragraphs : [""]) {
    if (pyStrip(paragraph) === "") {
      lines.push(pyStrip(indent));
      continue;
    }
    lines.push(...wrapParagraph(paragraph, width, indent));
  }
  return lines.join("\n");
}

/** Truncate on a word boundary, trimming the listed trailing punctuation. */
function truncate(text: string, limit: number, strip: string): string {
  if (text.length <= limit) return text;
  const head = text.slice(0, limit);
  const cut = head.lastIndexOf(" ");
  const kept = cut === -1 ? head : head.slice(0, cut);
  let end = kept.length;
  while (end > 0 && strip.includes(kept[end - 1] ?? "")) end -= 1;
  return `${kept.slice(0, end)}...`;
}

/** The SKILL.md description: profession, work mode at 140 chars, catalog summary at 320. */
export function compactDescription(agent: Agent): string {
  let workMode = collapseWhitespace(agent.work_mode ?? "");
  const summary = truncate(collapseWhitespace(agent.summary ?? ""), 320, " .;,");
  let desc = `Expert-thinking profile for ${agent.profession}`;
  if (workMode) {
    workMode = truncate(workMode, 140, " /,;");
    desc += ` (${workMode})`;
  }
  if (summary) desc += `: ${summary}`;
  return desc;
}

/** The catalog-relative profile path, rejecting absolute paths and `..` escapes. */
export function catalogProfilePath(agent: Agent): string {
  const raw = agent.path ? agent.path : `${agent.slug}/AGENTS.md`;
  const parts = raw.split("/").filter((part) => part !== "" && part !== ".");
  const normalized = (raw.startsWith("/") ? "/" : "") + parts.join("/");
  if (raw.startsWith("/") || parts.includes("..")) {
    throw new Error(`Unsafe catalog path for ${agent.slug}: ${normalized}`);
  }
  return normalized;
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** Catalog path first, then the nested scientific-agents/ layout current checkouts use. */
export function resolveProfilePath(source: string, agent: Agent): string {
  const catalogPath = catalogProfilePath(agent);
  const candidates = [join(source, catalogPath), join(source, "scientific-agents", catalogPath)];
  for (const candidate of candidates) {
    if (isFile(candidate)) return candidate;
  }
  throw new Error(`${catalogPath} for ${agent.slug} (tried: ${candidates.join(", ")})`);
}

export function sourceCommit(source: string): string {
  try {
    const proc = Bun.spawnSync(["git", "-C", source, "rev-parse", "HEAD"], { stderr: "ignore" });
    if (!proc.success) return "unknown";
    return pyStrip(proc.stdout.toString());
  } catch {
    return "unknown";
  }
}

export function loadLocalPatches(path: string = PATCHES_PATH): PatchMap {
  if (!isFile(path)) return {};
  const data: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("local patches file must be an object keyed by skill slug");
  }
  return PatchMapSchema.parse(data);
}

/** Literal find/replace of every occurrence; `$` in the replacement is not a back-reference. */
function replaceAllLiteral(text: string, find: string, replacement: string): string {
  return text.split(find).join(replacement);
}

function replaceFirstLiteral(text: string, find: string, replacement: string): string {
  const at = text.indexOf(find);
  if (at === -1) return text;
  return text.slice(0, at) + replacement + text.slice(at + find.length);
}

function stampLocalPatches(text: string, applied: string[]): string {
  const stamp = `  local-patches:\n${applied.map((id) => `    - ${id}\n`).join("")}`;
  const marker = "  scientific-agents-profile: true\n";
  let stamped = text.includes(marker)
    ? replaceFirstLiteral(text, marker, marker + stamp)
    : replaceFirstLiteral(text, "---\n\n", `---\n${stamp}\n`);

  if (!stamped.includes(LOCAL_PATCH_NOTE)) {
    const imported = stamped.split("\n").find((line) => line.startsWith("Imported from "));
    if (imported !== undefined) {
      stamped = replaceFirstLiteral(stamped, imported, `${imported}\n\n${LOCAL_PATCH_NOTE}`);
    }
  }
  return stamped;
}

/**
 * Apply the vault's factual corrections for one slug. Entries whose `find` is absent are
 * skipped silently, unlike `update overrides`, which fails on a stale anchor: a patch that
 * upstream has already fixed must not break the next import.
 */
export function applyLocalPatches(
  text: string,
  slug: string,
  patches: PatchMap,
): { text: string; applied: string[] } {
  const applied: string[] = [];
  let updated = text;
  for (const entry of patches[slug] ?? []) {
    if (!updated.includes(entry.find)) continue;
    updated = replaceAllLiteral(updated, entry.find, entry.replace);
    applied.push(entry.id);
  }
  if (applied.length > 0) updated = stampLocalPatches(updated, applied);
  return { text: updated, applied };
}

export function renderSkill(agent: Agent, profileBody: string, commit: string): string {
  const upstreamPath = catalogProfilePath(agent);
  const summary = collapseWhitespace(agent.summary ?? "");
  const workMode = collapseWhitespace(agent.work_mode ?? "");

  const frontmatter = [
    "---",
    `name: ${agent.slug}`,
    "description: >",
    folded(compactDescription(agent)),
    "metadata:",
    `  short-description: ${agent.profession} expert profile`,
    `  source-repo: ${SOURCE_REPO}`,
    `  source-url: ${SOURCE_URL}`,
    `  source-commit: ${commit}`,
    `  source-path: ${upstreamPath}`,
    `  upstream-created: ${agent.created ?? ""}`,
    `  upstream-updated: ${agent.updated ?? ""}`,
    `  source-count: ${agent.source_count ?? ""}`,
    "  scientific-agents-profile: true",
    "---",
    "",
  ];

  const intro = [
    `# ${agent.profession} Expert Profile`,
    "",
    `Imported from [${SOURCE_REPO}](${SOURCE_URL}) at commit \`${commit}\`.`,
    "",
    "Use this skill when the task benefits from a senior domain practitioner's",
    "operating model: how they frame problems, select methods, stress-test",
    "claims, watch for artifacts, and report uncertainty.",
    "",
    "This profile should be combined with project instructions, local protocols,",
    "tool-specific skills, and current primary sources. For medical, clinical,",
    "regulatory, or safety-critical work, treat it as research support rather",
    "than individualized professional advice.",
    "",
    "## Catalog Metadata",
    "",
    `- Profession: ${agent.profession}`,
    `- Work mode: ${workMode || "unspecified"}`,
    `- Upstream path: \`${upstreamPath}\``,
    `- Upstream source count: ${agent.source_count ?? "unknown"}`,
  ];
  if (summary) intro.push(`- Catalog summary: ${summary}`);
  intro.push("", "## Imported Profile", "", rstrip(profileBody), "");
  return [...frontmatter, ...intro].join("\n");
}

/** Python str.rstrip(). */
function rstrip(text: string): string {
  let end = text.length;
  while (end > 0 && pyStrip(text[end - 1] ?? "") === "") end -= 1;
  return text.slice(0, end);
}

const DISPATCHER_EXAMPLES = [
  "bioinformatician",
  "single-cell-biologist",
  "clinical-epidemiologist",
  "computational-chemist",
  "materials-scientist",
  "astrophysicist",
  "statistician",
  "machine-learning-researcher",
];

export function renderDispatcher(agents: Agent[], commit: string): string {
  const examples = DISPATCHER_EXAMPLES.filter((slug) => agents.some((a) => a.slug === slug));
  const catalogLines = agents
    .slice(0, 60)
    .map((a) => `- \`${a.slug}\` - ${a.profession}: ${collapseWhitespace(a.summary ?? "")}`);
  if (agents.length > 60) {
    catalogLines.push(`- ... ${agents.length - 60} more profiles in references/catalog.json`);
  }

  return [
    "---",
    "name: scientific-agents",
    "description: >",
    folded(
      "Dispatcher for the K-Dense scientific-agents collection. Use when you need " +
        "to choose among imported scientific and engineering expert profiles, such " +
        "as bioinformatician, clinical epidemiologist, materials scientist, " +
        "astrophysicist, or machine-learning researcher.",
    ),
    "metadata:",
    "  short-description: K-Dense scientific-agents profile dispatcher",
    `  source-repo: ${SOURCE_REPO}`,
    `  source-url: ${SOURCE_URL}`,
    `  source-commit: ${commit}`,
    "  source-path: catalog.json",
    "  scientific-agents-profile: true",
    "---",
    "",
    "# Scientific Agents Profile Dispatcher",
    "",
    `This skill indexes ${agents.length} expert-thinking profiles imported from ` +
      `[${SOURCE_REPO}](${SOURCE_URL}) at commit \`${commit}\`.`,
    "",
    "Use it when the user asks for a scientific discipline perspective but no",
    "specific profile has been selected yet. Pick the closest imported profile,",
    "then read that profile's `SKILL.md` before acting.",
    "",
    "## Selection Rules",
    "",
    "- Prefer the narrowest relevant profile over a broad one.",
    "- Combine profession profiles with tool skills already in this vault.",
    "- For clinical, regulatory, safety, legal, or financial topics, verify current",
    "  primary sources and keep advice scoped to research support.",
    "- If several profiles fit, say which ones you are combining and why.",
    "",
    "## Useful Starting Profiles",
    "",
    ...examples.map((slug) => `- [${slug}](../${slug}/SKILL.md)`),
    "",
    "## Catalog Preview",
    "",
    ...catalogLines,
    "",
    "The complete upstream catalog is stored at `references/catalog.json`.",
    "",
  ].join("\n");
}

/** Read catalog.json and check every profile path before any file is written. */
export function loadAgents(source: string): Agent[] {
  const data: unknown = JSON.parse(readFileSync(join(source, "catalog.json"), "utf8"));
  const { agents } = CatalogSchema.parse(data);
  for (const agent of agents) resolveProfilePath(source, agent);
  return agents;
}

function copyPreservingMtime(from: string, to: string): void {
  copyFileSync(from, to);
  const stat = statSync(from);
  utimesSync(to, stat.atime, stat.mtime);
}

export interface ImportResult {
  count: number;
  commit: string;
  /** `slug (id1, id2)` per profile that took at least one local patch. */
  patched: string[];
}

export function importScientificAgents(
  source: string,
  dest: string,
  patches: PatchMap = loadLocalPatches(),
): ImportResult {
  const agents = loadAgents(source);
  const commit = sourceCommit(source);
  const patched: string[] = [];

  for (const agent of agents) {
    const profilePath = resolveProfilePath(source, agent);
    const skillDir = join(dest, agent.slug);
    mkdirSync(skillDir, { recursive: true });
    const body = universalNewlines(readFileSync(profilePath, "utf8"));
    const { text, applied } = applyLocalPatches(renderSkill(agent, body, commit), agent.slug, patches);
    if (applied.length > 0) patched.push(`${agent.slug} (${applied.join(", ")})`);
    writeFileSync(join(skillDir, "SKILL.md"), text, "utf8");
  }

  const dispatcherDir = join(dest, "scientific-agents");
  const referencesDir = join(dispatcherDir, "references");
  mkdirSync(referencesDir, { recursive: true });
  writeFileSync(join(dispatcherDir, "SKILL.md"), renderDispatcher(agents, commit), "utf8");
  for (const name of ["catalog.json", "README.md", "LICENSE.md"]) {
    copyPreservingMtime(join(source, name), join(referencesDir, name));
  }

  return { count: agents.length, commit, patched };
}
