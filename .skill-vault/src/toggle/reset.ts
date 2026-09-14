import { existsSync, rmdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { MetadataError } from "../catalog";
import {
  atomicWrite,
  defaultOpenaiYaml,
  type Original,
  rollback,
  transformOpenaiYamlField,
  transformSkillMdField,
} from "./edit";
import { saveSnapshot } from "./snapshot";
import { discover, fileMode, readUtf8, resolveRoot } from "./state";

/** HEAD blob text per repo-relative path (null when HEAD lacks it), from one `git cat-file --batch`. */
export function gitHeadTexts(root: string, relativePaths: string[]): Map<string, string | null> {
  const input = relativePaths.map((p) => `HEAD:${p}\n`).join("");
  const proc = Bun.spawnSync(["git", "-C", root, "cat-file", "--batch"], {
    stdin: Buffer.from(input, "utf8"),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    throw new MetadataError(proc.stderr.toString("utf8").trim() || "could not read Git HEAD");
  }
  const out = proc.stdout;
  const results = new Map<string, string | null>();
  let offset = 0;
  for (const relative of relativePaths) {
    const end = out.indexOf(0x0a, offset);
    const header = out
      .subarray(offset, end === -1 ? out.length : end)
      .toString("utf8")
      .trim();
    offset = end === -1 ? out.length : end + 1;
    if (header.endsWith(" missing")) {
      results.set(relative, null);
      continue;
    }
    const parts = header.split(/\s+/);
    if (parts.length !== 3 || parts[1] !== "blob")
      throw new MetadataError(`git cat-file returned: ${header}`);
    const size = Number(parts[2]);
    results.set(relative, out.subarray(offset, offset + size).toString("utf8"));
    // Each blob is followed by one newline.
    offset += size + 1;
  }
  return results;
}

function matchesGeneratedOpenaiYaml(key: string, text: string): boolean {
  return text === defaultOpenaiYaml(key, true) || text === defaultOpenaiYaml(key, false);
}

/**
 * Save a snapshot, then make every skill model-invocable for both products by dropping the two
 * opt-out fields. A generated agents/openai.yaml with no HEAD counterpart is deleted outright.
 * Returns the snapshot path and the number of files changed.
 */
export function preCommitReset(root: string, snapshotArg?: string): [string, number] {
  const resolved = resolveRoot(root);
  const snapshot = saveSnapshot(resolved, snapshotArg);
  const skills = discover(resolved);
  const head = gitHeadTexts(
    resolved,
    skills.map((skill) => `skills/${skill.key}/agents/openai.yaml`),
  );
  const operations: Array<Original & { updated: string | null }> = [];

  for (const skill of skills) {
    const skillPath = join(skill.directory, "SKILL.md");
    const currentSkill = readUtf8(skillPath);
    const updatedSkill = transformSkillMdField(currentSkill, skillPath, null);
    if (updatedSkill !== currentSkill) {
      operations.push({
        path: skillPath,
        text: currentSkill,
        updated: updatedSkill,
        mode: fileMode(skillPath),
      });
    }

    const openaiPath = join(skill.directory, "agents", "openai.yaml");
    if (!existsSync(openaiPath)) continue;
    const currentOpenai = readUtf8(openaiPath);
    const inHead = head.get(`skills/${skill.key}/agents/openai.yaml`) ?? null;
    const updatedOpenai =
      inHead === null && matchesGeneratedOpenaiYaml(skill.key, currentOpenai)
        ? null
        : transformOpenaiYamlField(currentOpenai, openaiPath, null);
    if (updatedOpenai !== currentOpenai) {
      operations.push({
        path: openaiPath,
        text: currentOpenai,
        updated: updatedOpenai,
        mode: fileMode(openaiPath),
      });
    }
  }

  const completed: Original[] = [];
  try {
    for (const op of operations) {
      if (op.updated === null) {
        rmSync(op.path, { force: true });
        try {
          rmdirSync(dirname(op.path));
        } catch {
          // agents/ still holds other files
        }
      } else {
        atomicWrite(op.path, op.updated, op.mode);
      }
      // After the write, never before: an op that threw is not completed, and rolling it back
      // first would throw again for the same reason and strand every file already rewritten.
      completed.push(op);
    }
  } catch (e) {
    rollback(completed, e);
  }
  return [snapshot, operations.length];
}
