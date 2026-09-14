import { readdirSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { SkillEntry } from "./types";

// Bundles whose one-level children register as "<bundle>/<child>" (build.py discover_skills).
const BUNDLES = ["gstack"];

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function isFile(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

// Path(root).resolve(): realpath when it exists, else just absolute.
function resolveRoot(root: string): string {
  try {
    return realpathSync(root);
  } catch {
    return resolve(root);
  }
}

function entry(skillsRoot: string, id: string): SkillEntry {
  const dir = join(skillsRoot, id);
  return { id, dir, file: join(dir, "SKILL.md") };
}

/**
 * `bundles`: also list `gstack/<child>` children (build.py).
 * `excludeTransient`: skip `gstack-*` / `_gstack*` names and symlinks that resolve outside skills/ (skill_toggle.py).
 * Sorted by id in UTF-16 code-unit order.
 */
export function discoverSkills(
  root: string,
  opts: { bundles: boolean; excludeTransient: boolean },
): SkillEntry[] {
  const skillsRoot = join(resolveRoot(root), "skills");
  if (!isDir(skillsRoot)) {
    throw new Error(
      `cannot discover skills: ${skillsRoot}: no skills directory under the vault root. ` +
        "Pass --root pointing at the vault (the parent of skills/).",
    );
  }
  const found: SkillEntry[] = [];
  for (const name of readdirSync(skillsRoot)) {
    if (name.startsWith(".")) continue;
    if (opts.excludeTransient && (name.startsWith("gstack-") || name.startsWith("_gstack"))) continue;
    const dir = join(skillsRoot, name);
    if (!isDir(dir) || !isFile(join(dir, "SKILL.md"))) continue;
    if (opts.excludeTransient) {
      // directory.resolve().relative_to(skills_root): drop symlinks that leave skills/.
      const rel = relative(skillsRoot, realpathSync(dir));
      if (rel.startsWith("..") || isAbsolute(rel)) continue;
    }
    found.push(entry(skillsRoot, name));
  }
  if (opts.bundles) {
    for (const bundle of BUNDLES) {
      const bundleDir = join(skillsRoot, bundle);
      if (!isDir(bundleDir)) continue;
      for (const sub of readdirSync(bundleDir)) {
        if (sub.startsWith(".")) continue;
        const dir = join(bundleDir, sub);
        if (isDir(dir) && isFile(join(dir, "SKILL.md"))) found.push(entry(skillsRoot, `${bundle}/${sub}`));
      }
    }
  }
  return found.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
