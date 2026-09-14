import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { destroyFinder } from "../../src/search/fff";
import { grepSkills } from "../../src/search/grep";

const root = mkdtempSync(join(tmpdir(), "sq-grep-"));

function skill(id: string, text: string): void {
  mkdirSync(join(root, "skills", id), { recursive: true });
  writeFileSync(join(root, "skills", id, "SKILL.md"), text);
}

skill("harmonypy", "---\nname: harmonypy\n---\n\nHarmony batch correction.\nRun harmonize() on PCA.\n");
skill(
  "htmx",
  "---\nname: htmx\n---\n\nSet the response header:\n\n    Vary: HX-Request\n\nand cache per target.\n",
);
skill("scanpy", "---\nname: scanpy\n---\n\nCall sc.pp.harmony_integrate to run Harmony.\n");

afterAll(async () => {
  await destroyFinder(root);
  rmSync(root, { recursive: true, force: true });
});

test("hits carry the skill id, the vault-relative path, the line number and the text", async () => {
  const hits = await grepSkills(root, "Harmony");
  expect(hits.map((h) => h.skill)).toEqual(["harmonypy", "scanpy"]);
  expect(hits[0]).toEqual({
    skill: "harmonypy",
    file: "skills/harmonypy/SKILL.md",
    line: 5,
    text: "Harmony batch correction.",
  });
  expect(hits[1]?.line).toBe(5);
});

test("a pattern with a colon survives the path:line:text split", async () => {
  const hits = await grepSkills(root, "Vary: HX-Request");
  expect(hits.length).toBe(1);
  expect(hits[0]?.skill).toBe("htmx");
  expect(hits[0]?.text.trim()).toBe("Vary: HX-Request");
});

test("extra ripgrep flags are passed through", async () => {
  // -w makes `run` a whole word, which the line "Run harmonize() on PCA." only matches case-folded.
  expect((await grepSkills(root, "run", { rgArgs: ["-w"] })).length).toBe(2);
  expect((await grepSkills(root, "run", { rgArgs: ["-w", "--case-sensitive"] })).length).toBe(1);
});

test("no match is an empty list, not an error", async () => {
  expect(await grepSkills(root, "nothing-matches-this")).toEqual([]);
});

test("without ripgrep the fff index answers with the same skills", async () => {
  const rg = await grepSkills(root, "Harmony");
  const fff = await grepSkills(root, "Harmony", { rgPath: "/nonexistent/rg" });
  expect(fff.map((h) => h.skill)).toEqual(rg.map((h) => h.skill));
  expect(fff.map((h) => `${h.file}:${h.line}`)).toEqual(rg.map((h) => `${h.file}:${h.line}`));
});
