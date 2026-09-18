// Content search across skills/: ripgrep when it is installed, the fff index when it is not.
import { finderFor } from "./fff";

export interface GrepHit {
  skill: string;
  /** Path relative to the vault root, so `skills/<id>/...` either way. */
  file: string;
  line: number;
  text: string;
}

export interface GrepOptions {
  /** Extra ripgrep flags, passed through before the pattern. Ignored by the fff fallback. */
  rgArgs?: string[];
  rgPath?: string;
}

const RG_FLAGS = ["--with-filename", "--line-number", "--no-heading", "-S"];
const FFF_PAGE_SIZE = 500;

/** `skills/<id>/<rest>` -> `<id>`; anything outside skills/ is not a skill hit. */
function skillOf(file: string): string | null {
  const parts = file.split("/");
  return parts[0] === "skills" && parts[1] ? parts[1] : null;
}

// `path:line:text`, splitting on the first two colons only so a colon in the text survives.
function parseRg(stdout: string): GrepHit[] {
  const hits: GrepHit[] = [];
  for (const row of stdout.split("\n")) {
    const first = row.indexOf(":");
    if (first < 0) continue;
    const second = row.indexOf(":", first + 1);
    if (second < 0) continue;
    const line = Number(row.slice(first + 1, second));
    if (!Number.isInteger(line)) continue;
    const file = row.slice(0, first);
    const skill = skillOf(file);
    if (skill === null) continue;
    hits.push({ skill, file, line, text: row.slice(second + 1) });
  }
  return hits;
}

async function fffGrep(root: string, pattern: string): Promise<GrepHit[]> {
  const finder = await finderFor(root);
  if (finder.api === null) throw new Error(`no ripgrep and no file index: ${finder.problem}`);
  const found = finder.api.grep(pattern, { mode: "regex", pageSize: FFF_PAGE_SIZE });
  if (!found.ok) throw new Error(found.error);
  const hits: GrepHit[] = [];
  for (const match of found.value.items) {
    const file = `skills/${match.relativePath}`;
    const skill = skillOf(file);
    if (skill === null) continue;
    hits.push({ skill, file, line: match.lineNumber, text: match.lineContent });
  }
  return hits;
}

/** rg walks files in parallel, so the order it prints in is not stable; sort before returning. */
function ordered(hits: GrepHit[]): GrepHit[] {
  return hits.sort(
    (a, b) =>
      (a.skill < b.skill ? -1 : a.skill > b.skill ? 1 : 0) ||
      (a.file < b.file ? -1 : a.file > b.file ? 1 : 0) ||
      a.line - b.line,
  );
}

/** The pattern is an argv element, never a shell word, so no quoting rule applies to it. */
export async function grepSkills(root: string, pattern: string, opts: GrepOptions = {}): Promise<GrepHit[]> {
  const rg = opts.rgPath ?? "rg";
  let proc: Bun.Subprocess<"ignore", "pipe", "pipe">;
  try {
    proc = Bun.spawn([rg, ...RG_FLAGS, ...(opts.rgArgs ?? []), "--", pattern, "skills"], {
      cwd: root,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
  } catch {
    return ordered(await fffGrep(root, pattern));
  }
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  // rg exits 1 for no matches and 2 for a real failure; 127 is the shell-less spawn of a missing rg.
  if (code === 127) return ordered(await fffGrep(root, pattern));
  if (code >= 2) throw new Error(`rg exited ${code}: ${stderr.trim().split("\n")[0] ?? ""}`);
  return ordered(parseRg(stdout));
}
