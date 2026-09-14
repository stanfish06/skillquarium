import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  statSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";

export interface LinkCounts {
  linked: number;
  current: number;
  kept: number;
  pruned: number;
}

function realpathOr(path: string, fallback: string): string {
  try {
    return realpathSync(path);
  } catch {
    return fallback;
  }
}

/**
 * Link every vault skill into the Claude Code skills dir. skills-cli >= 1.5.19 refuses to
 * link a skill whose source already sits in the global store, and this vault is that store,
 * so `skills add . -g` leaves the Claude dir untouched and this does the linking instead.
 */
export function linkClaude(
  root: string,
  claudeSkillsDir: string,
  opts: { dryRun?: boolean } = {},
): LinkCounts {
  const counts: LinkCounts = { linked: 0, current: 0, kept: 0, pruned: 0 };
  const skillsDir = join(root, "skills");
  if (!opts.dryRun) mkdirSync(claudeSkillsDir, { recursive: true });

  // Drop links whose vault skill is gone, so removed skills stop showing up.
  for (const name of existsSync(claudeSkillsDir) ? readdirSync(claudeSkillsDir) : []) {
    const link = join(claudeSkillsDir, name);
    if (lstatSync(link, { throwIfNoEntry: false })?.isSymbolicLink() !== true) continue;
    // existsSync follows the link: only a dangling one is stale.
    if (existsSync(link)) continue;
    const target = readlinkSync(link);
    if (!target.startsWith(`${skillsDir}/`) && !target.includes("/.agents/skills/")) continue;
    if (!opts.dryRun) unlinkSync(link);
    counts.pruned++;
  }

  for (const name of existsSync(skillsDir) ? readdirSync(skillsDir).sort() : []) {
    const src = join(skillsDir, name);
    // A plain file in skills/ has no SKILL.md to stat.
    if (!statSync(src, { throwIfNoEntry: false })?.isDirectory()) continue;
    if (statSync(join(src, "SKILL.md"), { throwIfNoEntry: false })?.isFile() !== true) continue;
    const dest = join(claudeSkillsDir, name);
    const stat = lstatSync(dest, { throwIfNoEntry: false });

    if (stat?.isSymbolicLink() === true) {
      if (realpathOr(dest, "") === realpathOr(src, src)) {
        counts.current++;
        continue;
      }
      if (!opts.dryRun) {
        unlinkSync(dest);
        symlinkSync(src, dest);
      }
      counts.linked++;
    } else if (stat !== undefined) {
      // A real directory: a copy-mode install or a separately managed skill. Leave it alone.
      counts.kept++;
    } else {
      if (!opts.dryRun) symlinkSync(src, dest);
      counts.linked++;
    }
  }

  return counts;
}
