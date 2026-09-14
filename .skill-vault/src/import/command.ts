import { join, resolve } from "node:path";
import type { Command } from "../cli";
import { importScientificAgents } from "./scientificAgents";

export const help = `usage: skillquarium import scientific-agents <source> [--dest DIR]

Import a local checkout of K-Dense-AI/scientific-agents as native SKILL.md folders.

  <source>     checkout holding catalog.json, README.md and LICENSE.md
  --dest DIR   flat skills directory to write (default: <root>/skills)

Every catalog entry becomes <dest>/<slug>/SKILL.md. The dispatcher and copies of the
upstream catalog.json, README.md and LICENSE.md land in <dest>/scientific-agents/.
Corrections in .skill-vault/data/scientific-agent-patches.json are reapplied after each
import and recorded in metadata.local-patches.`;

export const run: Command = async (args, ctx) => {
  const importer = args[0];
  if (importer !== "scientific-agents") {
    const shown = importer === undefined ? "" : ` '${importer}'`;
    ctx.err(`skillquarium import: expected importer 'scientific-agents', got${shown || " nothing"}`);
    ctx.err(help);
    return 2;
  }

  let dest: string | undefined;
  const positional: string[] = [];
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === undefined) continue;
    if (arg === "--dest") {
      const value = args[++i];
      if (value === undefined) {
        ctx.err("skillquarium import: --dest requires a directory");
        return 2;
      }
      dest = value;
    } else if (arg.startsWith("--dest=")) {
      const value = arg.slice("--dest=".length);
      if (value === "") {
        ctx.err("skillquarium import: --dest requires a directory");
        return 2;
      }
      dest = value;
    } else if (arg.startsWith("-")) {
      ctx.err(`skillquarium import: unknown option ${arg}`);
      ctx.err(help);
      return 2;
    } else {
      positional.push(arg);
    }
  }

  const source = positional[0];
  if (source === undefined || positional.length > 1) {
    ctx.err("skillquarium import: scientific-agents takes exactly one source directory");
    ctx.err(help);
    return 2;
  }

  const destDir = resolve(dest ?? join(ctx.root, "skills"));
  const result = importScientificAgents(resolve(source), destDir);
  ctx.out(`Imported ${result.count} profiles plus dispatcher into ${destDir}`);
  ctx.out(`Source commit: ${result.commit}`);
  if (result.patched.length > 0) {
    ctx.out(`Local patches applied: ${result.patched.join("; ")}`);
  }
  return 0;
};
