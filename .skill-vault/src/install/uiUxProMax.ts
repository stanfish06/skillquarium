import { existsSync, lstatSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Io, Runner } from "./run";

const DEFAULT_CLI_VERSION = "2.14.1";

/** The generated bundle's seven skill folders, all installed by one CLI run. */
export const BUNDLE_SKILLS = [
  "ui-ux-pro-max",
  "banner-design",
  "brand",
  "design-system",
  "design",
  "slides",
  "ui-styling",
];

const MARKER = ".ui-ux-pro-max-managed";

function removeBundle(skillsDir: string): void {
  for (const name of BUNDLE_SKILLS) rmSync(join(skillsDir, name), { recursive: true, force: true });
  rmSync(join(skillsDir, MARKER), { force: true });
}

/**
 * Install the seven-skill bundle into the vault's own `skills/` store, which is the
 * canonical global store the skills CLI propagates to every agent.
 */
export async function installUiUxProMax(root: string, io: Io, runner: Runner): Promise<number> {
  if (process.env.UI_UX_PRO_MAX_SKIP === "1") {
    io.out("ui-ux-pro-max: skipped (UI_UX_PRO_MAX_SKIP=1)");
    return 0;
  }

  const version = process.env.UI_UX_PRO_MAX_CLI_VERSION || DEFAULT_CLI_VERSION;
  const skillsDir = join(root, "skills");
  const marker = join(skillsDir, MARKER);
  // The marker records that an earlier run owns these folders; without it they are the user's.
  const managed = existsSync(marker) && statSync(marker).isFile();

  if (!managed) {
    for (const name of BUNDLE_SKILLS) {
      if (lstatSync(join(skillsDir, name), { throwIfNoEntry: false }) !== undefined) {
        io.err(`ERROR: refusing to overwrite unmanaged skill at ${skillsDir}/${name}.`);
        io.err("Remove or relocate it before enabling the ui-ux extra.");
        return 1;
      }
    }
  }

  io.out(`ui-ux-pro-max: installing bundle with CLI ${version}...`);
  const install = await runner.exec([
    "npx",
    "-y",
    `ui-ux-pro-max-cli@${version}`,
    "init",
    "--ai",
    "universal",
    "--global",
    "--force",
  ]);
  if (install.code !== 0) {
    if (!managed) removeBundle(skillsDir);
    io.err("ERROR: ui-ux-pro-max installer failed.");
    return install.code;
  }
  if (runner.dryRun) return 0;

  for (const name of BUNDLE_SKILLS) {
    const md = join(skillsDir, name, "SKILL.md");
    if (!(existsSync(md) && statSync(md).isFile())) {
      if (!managed) removeBundle(skillsDir);
      io.err(`ERROR: ui-ux-pro-max did not install the complete bundle; missing ${name}/SKILL.md.`);
      return 1;
    }
  }

  // Temp file then rename so an interrupted write cannot leave a half-written marker.
  const tmp = `${marker}.tmp.${process.pid}`;
  writeFileSync(tmp, `${version}\n`);
  renameSync(tmp, marker);
  io.out(`ui-ux-pro-max: installed seven-skill bundle at ${skillsDir}`);
  return 0;
}
