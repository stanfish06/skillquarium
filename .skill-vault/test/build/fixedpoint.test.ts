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

// The fixed point is proved inside the temp fixture, which is the only tree this touches: the
// checkout is read to seed it and never inspected, so a dirty working tree cannot fail this test.
test("rebuilding the committed vault is a byte-identical fixed point", async () => {
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
}, 60_000);
