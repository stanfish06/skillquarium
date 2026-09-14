import {
  accessSync,
  constants,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
  symlinkSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Io, Runner } from "./run";

const GSTACK_REPO = "https://github.com/garrytan/gstack.git";
/** Pinned to a known-good commit (VERSION 1.58.4.0). Bump deliberately. */
const GSTACK_DEFAULT_REF = "9fd03fae9e74f5daa7a138366aca8f86c7367c5c";
const BUN_INSTALL_URL = "https://bun.sh/install";

// Resolve against the live PATH: installBun prepends bun's bin dir to it.
function which(cmd: string): string | null {
  return Bun.which(cmd, { PATH: process.env.PATH ?? "" });
}

function isExecutable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Install bun through its own script so gstack's ./setup can build the browse binary.
 * Downloads to a file first, then executes it, so a truncated stream cannot half-run.
 */
async function installBun(io: Io, runner: Runner): Promise<boolean> {
  if (which("curl") === null) {
    io.err("WARNING: curl not found, cannot install bun — falling back to symlink-only mode.");
    return false;
  }
  io.out("gstack: installing bun (required for browser skills)...");
  const installer = join(mkdtempSync(join(tmpdir(), "bun-install.")), "install.sh");
  try {
    const download = await runner.exec([
      "curl",
      "--proto",
      "=https",
      "--tlsv1.2",
      "--fail",
      "--location",
      "--retry",
      "3",
      "--connect-timeout",
      "10",
      "-o",
      installer,
      BUN_INSTALL_URL,
    ]);
    if (download.code === 0 && (await runner.exec(["bash", installer])).code === 0) {
      const bunInstall = join(process.env.HOME ?? homedir(), ".bun");
      process.env.BUN_INSTALL = bunInstall;
      process.env.PATH = `${join(bunInstall, "bin")}:${process.env.PATH ?? ""}`;
      return true;
    }
    io.err("WARNING: bun install failed — falling back to symlink-only mode.");
    io.err("  Browser skills disabled; methodology skills still work.");
    io.err("  Install bun manually from https://bun.sh for full gstack.");
    return false;
  } finally {
    rmSync(dirname(installer), { recursive: true, force: true });
  }
}

/**
 * gstack is a bundled collection whose sub-skills share lib/, bin/ and browse/ runtime code,
 * so it installs as one folder through its own ./setup rather than as per-skill entries.
 * --prefix namespaces its commands (/gstack-qa) so they cannot clobber vault skills.
 */
export async function installGstack(
  gstackDir: string,
  claudeSkillsDir: string,
  io: Io,
  runner: Runner,
): Promise<number> {
  if ((process.env.GSTACK_SKIP ?? "") !== "") {
    io.out("gstack: skipped (GSTACK_SKIP=1)");
    return 0;
  }

  const ref = process.env.GSTACK_REF || GSTACK_DEFAULT_REF;
  if (statSync(join(gstackDir, ".git"), { throwIfNoEntry: false })?.isDirectory()) {
    io.out(`gstack: updating to ref ${ref}...`);
    // A failed fetch or checkout is tolerated: the existing checkout stays usable.
    await runner.exec(["git", "-C", gstackDir, "fetch", "--depth", "1", "origin", ref]);
    const checkout = await runner.exec(["git", "-C", gstackDir, "checkout", "--detach", ref]);
    if (checkout.code !== 0) {
      await runner.exec(["git", "-C", gstackDir, "checkout", "--detach", "FETCH_HEAD"]);
    }
  } else {
    io.out(`gstack: cloning (ref ${ref})...`);
    if (runner.dryRun) io.out(`+ rm -rf ${gstackDir}`);
    else rmSync(gstackDir, { recursive: true, force: true });
    const clone = await runner.exec([
      "git",
      "clone",
      "--no-checkout",
      "--depth",
      "1",
      GSTACK_REPO,
      gstackDir,
    ]);
    if (clone.code !== 0) return clone.code;
    const fetch = await runner.exec(["git", "-C", gstackDir, "fetch", "--depth", "1", "origin", ref]);
    if (fetch.code !== 0) return fetch.code;
    const checkout = await runner.exec(["git", "-C", gstackDir, "checkout", "--detach", "FETCH_HEAD"]);
    if (checkout.code !== 0) return checkout.code;
  }

  if (!runner.dryRun && !isExecutable(join(gstackDir, "setup"))) {
    io.err(`ERROR: gstack setup script not found at ${gstackDir}/setup`);
    return 1;
  }

  let bunAvailable = which("bun") !== null;
  if (!bunAvailable && (process.env.GSTACK_SKIP_BUN ?? "") === "") {
    bunAvailable = await installBun(io, runner);
  }

  if (bunAvailable || runner.dryRun) {
    io.out("gstack: running ./setup --host auto --prefix --quiet...");
    const setup = await runner.exec(["./setup", "--host", "auto", "--prefix", "--quiet"], {
      cwd: gstackDir,
    });
    if (setup.code !== 0) return setup.code;
  } else {
    // Without bun only the methodology skills work, and gstack's ./setup generates
    // Claude-oriented docs, so link the bundle into Claude Code alone.
    io.out("gstack: bun not available — Claude-only symlink fallback...");
    if (existsSync(dirname(claudeSkillsDir))) {
      mkdirSync(claudeSkillsDir, { recursive: true });
      const link = join(claudeSkillsDir, "gstack");
      rmSync(link, { recursive: false, force: true });
      symlinkSync(gstackDir, link);
      io.out(`  linked ${link}`);
    }
  }

  io.out(
    "gstack: done. Skills: /gstack-office-hours /gstack-plan-ceo-review /gstack-review " +
      "/gstack-qa /gstack-ship /gstack-cso /gstack-autoplan /gstack-spec /gstack-retro ...",
  );
  return 0;
}
