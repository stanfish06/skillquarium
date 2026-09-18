import { afterEach, beforeEach, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Config } from "../../src/config";
import { TOKENIZER_PATH } from "../../src/search/bpe";
import { run, trainTokenizer } from "../../src/tokenizer/command";

const FIXTURE = resolve(import.meta.dir, "../fixtures/tokenizer/tokenizer.json");

let root: string;
let log: string;

function git(...args: string[]): void {
  const result = Bun.spawnSync(["git", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr.toString()}`);
}

function write(rel: string, text: string): void {
  mkdirSync(join(root, rel, ".."), { recursive: true });
  writeFileSync(join(root, rel), text);
}

/** A stand-in for skill-tokenizer: records what it was given, then writes `model` to -o. */
function fakeBin(model: string, exitCode = 0): string {
  const bin = join(root, "fake-tokenizer");
  writeFileSync(
    bin,
    [
      "#!/bin/sh",
      `echo "$@" > '${log}/args'`,
      `(cd "$2" && find . -type f) > '${log}/files'`,
      `cat "$2/one/SKILL.md" > '${log}/one'`,
      `[ ${exitCode} -ne 0 ] && { echo 'boom' >&2; exit ${exitCode}; }`,
      `cp '${model}' "$4"`,
      "",
    ].join("\n"),
  );
  chmodSync(bin, 0o755);
  return bin;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "sq-tok-"));
  log = join(root, "log");
  mkdirSync(log);
  write("skills/one/SKILL.md", "---\nname: one\ndisable-model-invocation: true\n---\n\n# One\n");
  write("skills/one/references/extra.md", "# Extra\n");
  write("skills/one/script.py", "print('not markdown')\n");
  write("skills/two/SKILL.md", "---\nname: two\n---\n\n# Two\n");
  git("init", "-q");
  git("add", "skills");
  // Installed on this host only: must not reach the committed model.
  write("skills/three/SKILL.md", "---\nname: three\n---\n");
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

test("trains on tracked markdown only, toggle lines stripped, and installs the model", async () => {
  const result = await trainTokenizer(root, fakeBin(FIXTURE), 123);
  expect(readFileSync(join(log, "files"), "utf8").trim().split("\n").sort()).toEqual([
    "./one/SKILL.md",
    "./one/references/extra.md",
    "./two/SKILL.md",
  ]);
  expect(readFileSync(join(log, "one"), "utf8")).toBe("---\nname: one\n---\n\n# One\n");
  expect(readFileSync(join(log, "args"), "utf8")).toMatch(
    /^train .+ -o .+tokenizer\.json --vocab-size 123\n$/,
  );
  expect(readFileSync(join(root, TOKENIZER_PATH), "utf8")).toBe(readFileSync(FIXTURE, "utf8"));
  expect(result).toMatchObject({ path: TOKENIZER_PATH, files: 3, vocab: 200, merges: 162 });
});

test("a model with no merges is refused and the installed one kept", async () => {
  await trainTokenizer(root, fakeBin(FIXTURE), 200);
  const charLevel = join(root, "char.json");
  const json = JSON.parse(readFileSync(FIXTURE, "utf8"));
  json.model.merges = [];
  writeFileSync(charLevel, JSON.stringify(json));
  await expect(trainTokenizer(root, fakeBin(charLevel), 10)).rejects.toThrow(/no room for merges/);
  expect(readFileSync(join(root, TOKENIZER_PATH), "utf8")).toBe(readFileSync(FIXTURE, "utf8"));
});

test("a missing or failing binary is an error that says why", async () => {
  await expect(trainTokenizer(root, join(root, "nope"), 200)).rejects.toThrow(/cannot run .*skill-tokenizer/);
  await expect(trainTokenizer(root, fakeBin(FIXTURE, 3), 200)).rejects.toThrow(/exited 3: boom/);
  expect(existsSync(join(root, TOKENIZER_PATH))).toBe(false);
});

test("the command takes --vocab-size and rejects anything else", async () => {
  const bin = fakeBin(FIXTURE);
  const out: string[] = [];
  const err: string[] = [];
  const config = {
    tokenizer: { bin, vocabSize: 777 },
  } as Config;
  const ctx = {
    root,
    json: false,
    out: (l: string) => out.push(l),
    err: (l: string) => err.push(l),
    config: async () => config,
  };
  expect(await run([], ctx)).toBe(0);
  expect(readFileSync(join(log, "args"), "utf8")).toContain("--vocab-size 777");
  expect(await run(["--vocab-size=55"], ctx)).toBe(0);
  expect(readFileSync(join(log, "args"), "utf8")).toContain("--vocab-size 55");
  expect(out.at(-1)).toMatch(/^trained vault\/tokenizer\/tokenizer\.json: vocab 200 \(162 merges/);
  expect(await run(["--vocab-size", "0"], ctx)).toBe(2);
  expect(await run(["--bogus"], ctx)).toBe(2);
  expect(err.join("\n")).toContain("unknown argument --bogus");
});
