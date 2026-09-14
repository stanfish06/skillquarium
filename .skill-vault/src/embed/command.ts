import type { Command } from "../cli";
import { llamaCppClient } from "./client";
import { embedVault } from "./run";
import { readManifest } from "./store";

export const help =
  "embed [--force] [--check]: build or refresh vault/embeddings from the llama.cpp endpoint";

export const run: Command = async (args, ctx) => {
  const unknown = args.find((a) => a !== "--force" && a !== "--check");
  if (unknown !== undefined) {
    ctx.err(`usage: skillquarium ${help}`);
    return 2;
  }
  const check = args.includes("--check");
  const cfg = await ctx.config();
  const result = await embedVault(ctx.root, llamaCppClient(cfg.embed), {
    force: args.includes("--force"),
    check,
    batchSize: cfg.embed.batchSize,
    // Progress goes to stderr so --json output stays a single parseable object.
    log: (line) => ctx.err(line),
  });
  if (ctx.json) {
    ctx.out(JSON.stringify(result));
    return check && result.stale.length > 0 ? 1 : 0;
  }
  if (check) {
    for (const id of result.stale) ctx.out(id);
    if (result.stale.length > 0) return 1;
    ctx.out(`embeddings current (${Object.keys(readManifest(ctx.root)?.skills ?? {}).length} skills)`);
    return 0;
  }
  ctx.out(
    `embedded ${result.embedded} skills, removed ${result.removed}, model ${result.model} dim ${result.dim}`,
  );
  return 0;
};
