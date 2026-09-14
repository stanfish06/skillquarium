import { afterAll, expect, test } from "bun:test";
import { buildVault } from "../../src/build/run";
import {
  cleanupTempRoots,
  copyVaultFixture,
  diffSnapshots,
  REPO_ROOT,
  snapshotGeneratedTree,
  tempRoot,
} from "./helpers";

afterAll(cleanupTempRoots);

// Only the generated navigation is under test; another tool's vault/ output must not show up here.
const GENERATED = ["vault/notes", "vault/maps", "vault/index.md"];

function gitStatus(): string {
  const result = Bun.spawnSync(["git", "status", "--porcelain", ...GENERATED], { cwd: REPO_ROOT });
  return new TextDecoder().decode(result.stdout);
}

test("rebuilding the committed vault is a byte-identical fixed point", async () => {
  expect(gitStatus()).toBe("");

  const fixture = tempRoot("skillquarium-fixedpoint-");
  copyVaultFixture(REPO_ROOT, fixture);
  const before = snapshotGeneratedTree(fixture);
  expect(before.size).toBeGreaterThan(2000);

  const lines: string[] = [];
  const code = await buildVault(
    fixture,
    { prune: false, graph: false },
    { out: (line) => lines.push(line), err: (line) => lines.push(line) },
  );

  expect(code).toBe(0);
  const after = snapshotGeneratedTree(fixture);
  expect(diffSnapshots(before, after)).toEqual([]);
  expect(after.size).toBe(before.size);
  expect(lines.join("\n")).toContain("OK: ");
  expect(gitStatus()).toBe("");
}, 60_000);
