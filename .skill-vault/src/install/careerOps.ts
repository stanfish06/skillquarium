import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Io, Runner } from "./run";

/**
 * Career Ops is a stateful workspace whose skill router depends on the full repository:
 * it lives outside the vault and updates through its own updater. Pinned to a version
 * verified as published on npm — a GitHub release can precede the registry.
 */
const SCAFFOLDER_VERSION = "1.18.0";

export function careerOpsDir(): string {
  return process.env.CAREER_OPS_DIR ?? join(process.env.HOME ?? homedir(), "career-ops");
}

/** Lines `from`..`to` (1-based, inclusive), each newline-terminated, like `sed -n 'from,to p'`. */
function sliceLines(text: string, from: number, to?: number): string {
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines
    .slice(from - 1, to)
    .map((line) => `${line}\n`)
    .join("");
}

/**
 * Apply the pending update, then rebuild CLAUDE.md from the new two-line system header
 * plus the user's saved tail — the native updater replaces the file wholesale.
 */
async function applyUpdate(dir: string, io: Io, runner: Runner): Promise<number> {
  const claudeFile = join(dir, "CLAUDE.md");
  const savedTail = existsSync(claudeFile) ? sliceLines(readFileSync(claudeFile, "utf8"), 3) : "";

  io.out(`career-ops: applying available update at ${dir}...`);
  const applied = await runner.exec(["node", "update-system.mjs", "apply"], { cwd: dir });

  if (savedTail !== "") {
    const header = existsSync(claudeFile) ? sliceLines(readFileSync(claudeFile, "utf8"), 1, 2) : "";
    writeFileSync(claudeFile, header + savedTail);
  }

  if (applied.code !== 0) {
    io.err(`ERROR: career-ops update failed at ${dir}.`);
    return applied.code;
  }
  io.out(`career-ops: updated at ${dir}`);
  return 0;
}

export async function installCareerOps(io: Io, runner: Runner): Promise<number> {
  if (process.env.CAREER_OPS_SKIP === "1") {
    io.out("career-ops: skipped (CAREER_OPS_SKIP=1)");
    return 0;
  }

  const dir = careerOpsDir();
  if (!existsSync(dir)) {
    io.out(`career-ops: initializing at ${dir}...`);
    const init = await runner.exec(["npx", "-y", `@santifer/career-ops@${SCAFFOLDER_VERSION}`, "init", dir]);
    if (init.code !== 0) {
      io.err(`ERROR: career-ops initialization failed at ${dir}.`);
      return init.code;
    }
    io.out(`career-ops: initialized at ${dir}`);
    return 0;
  }

  const gitDir = join(dir, ".git");
  const updater = join(dir, "update-system.mjs");
  if (
    !(existsSync(gitDir) && statSync(gitDir).isDirectory()) ||
    !(existsSync(updater) && statSync(updater).isFile())
  ) {
    io.err(`ERROR: ${dir} is not a valid Career Ops workspace; expected .git/ and update-system.mjs.`);
    return 1;
  }

  if (process.env.CAREER_OPS_AUTO_UPDATE === "0") {
    io.out(`career-ops: frozen at ${dir} (CAREER_OPS_AUTO_UPDATE=0)`);
    return 0;
  }

  // Automatic mode supersedes a dismissal recorded by an interactive session.
  if (runner.dryRun) io.out(`+ rm -f ${join(dir, ".update-dismissed")}`);
  else rmSync(join(dir, ".update-dismissed"), { force: true });

  const check = await runner.exec(["node", "update-system.mjs", "check"], {
    cwd: dir,
    capture: true,
  });
  if (check.code !== 0) {
    io.err(`ERROR: career-ops update check failed at ${dir}.`);
    return 1;
  }
  if (runner.dryRun) {
    io.out("career-ops: would apply the update when check reports one");
    return 0;
  }

  let status: unknown;
  try {
    const parsed: unknown = JSON.parse(check.stdout);
    status = typeof parsed === "object" && parsed !== null ? Reflect.get(parsed, "status") : undefined;
  } catch {
    status = undefined;
  }
  if (typeof status !== "string") {
    io.err("ERROR: career-ops returned malformed update status.");
    return 1;
  }

  switch (status) {
    case "up-to-date":
      io.out(`career-ops: up to date at ${dir}`);
      return 0;
    case "offline":
    case "no-remote-version":
      io.err(`WARNING: career-ops update check is ${status}; keeping the current workspace.`);
      return 0;
    case "update-available":
      return applyUpdate(dir, io, runner);
    default:
      io.err(`ERROR: unknown career-ops update status: ${status}`);
      return 1;
  }
}
