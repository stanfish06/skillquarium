// Trains the BM25 tokenizer with the external skill-tokenizer binary, the way `embed` builds vectors
// with an external endpoint: a build-time dependency only, since queries encode in-process.
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Command } from "../cli";
import { untoggledText } from "../embed/hash";
import { Bpe, TOKENIZER_PATH } from "../search/bpe";

export const help =
  "tokenizer [--vocab-size N]: train vault/tokenizer/tokenizer.json from the tracked skill markdown with skill-tokenizer";

export interface TrainResult {
  path: string;
  files: number;
  vocab: number;
  merges: number;
  /** Single-character vocab entries: the corpus alphabet the merges are built on. */
  alphabet: number;
}

function parseArgs(args: string[], fallback: number): number | string {
  let vocab = fallback;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? "";
    let value: string | undefined;
    if (arg === "--vocab-size") value = args[++i];
    else if (arg.startsWith("--vocab-size=")) value = arg.slice("--vocab-size=".length);
    else return `unknown argument ${arg}`;
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0) return "--vocab-size must be a positive integer";
    vocab = n;
  }
  return vocab;
}

/** Tracked markdown under skills/, so the model never depends on what one host has installed. */
function trackedMarkdown(root: string): string[] {
  const listed = Bun.spawnSync(["git", "ls-files", "-z", "--", "skills"], { cwd: root });
  if (listed.exitCode !== 0) {
    throw new Error(`git ls-files failed: ${new TextDecoder().decode(listed.stderr).trim()}`);
  }
  return new TextDecoder()
    .decode(listed.stdout)
    .split("\0")
    .filter((p) => p.endsWith(".md"));
}

export async function trainTokenizer(root: string, bin: string, vocabSize: number): Promise<TrainResult> {
  const files = trackedMarkdown(root);
  if (files.length === 0) throw new Error("no tracked markdown under skills/");
  const stage = mkdtempSync(join(tmpdir(), "sq-tokenizer-"));
  try {
    // Toggle lines are stripped as embed strips them: the corpus is what is committed, not what is enabled.
    for (const rel of files) {
      const dest = join(stage, rel);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, untoggledText(readFileSync(join(root, rel), "utf8")));
    }
    const out = join(stage, "tokenizer.json");
    let proc: ReturnType<typeof Bun.spawnSync>;
    try {
      proc = Bun.spawnSync([
        bin,
        "train",
        join(stage, "skills"),
        "-o",
        out,
        "--vocab-size",
        String(vocabSize),
      ]);
    } catch {
      throw new Error(
        `cannot run ${bin}: build it from github.com/stanfish06/skill-tokenizer ` +
          "(cargo build --release) and put it on PATH or set tokenizer.bin",
      );
    }
    if (proc.exitCode !== 0) {
      throw new Error(
        `${bin} train exited ${proc.exitCode}: ${new TextDecoder().decode(proc.stderr).trim()}`,
      );
    }
    const text = readFileSync(out, "utf8");
    const json = JSON.parse(text) as { model: { vocab: Record<string, number>; merges: unknown[] } };
    // Constructing it is the compatibility check: a model this encoder cannot reproduce throws here.
    new Bpe(json);
    const vocab = Object.keys(json.model.vocab);
    const alphabet = vocab.filter((t) => [...t].length === 1).length;
    const merges = json.model.merges.length;
    // The trainer admits the whole alphabet before any merge, so a small vocab yields a character
    // tokenizer that matches every document on single letters.
    if (merges === 0) {
      throw new Error(
        `--vocab-size ${vocabSize} leaves no room for merges: the corpus alphabet alone is ${alphabet} characters`,
      );
    }
    const dest = join(root, TOKENIZER_PATH);
    mkdirSync(dirname(dest), { recursive: true });
    const tmp = `${dest}.${process.pid}.tmp`;
    writeFileSync(tmp, text);
    renameSync(tmp, dest);
    return { path: TOKENIZER_PATH, files: files.length, vocab: vocab.length, merges, alphabet };
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

export const run: Command = async (args, ctx) => {
  const cfg = await ctx.config();
  const vocabSize = parseArgs(args, cfg.tokenizer.vocabSize);
  if (typeof vocabSize === "string") {
    ctx.err(`skillquarium tokenizer: ${vocabSize}`);
    ctx.err(`usage: skillquarium ${help}`);
    return 2;
  }
  const result = await trainTokenizer(ctx.root, cfg.tokenizer.bin, vocabSize);
  if (ctx.json) {
    ctx.out(JSON.stringify(result));
    return 0;
  }
  ctx.out(
    `trained ${result.path}: vocab ${result.vocab} (${result.merges} merges on a ${result.alphabet}-character alphabet) ` +
      `from ${result.files} files`,
  );
  return 0;
};
