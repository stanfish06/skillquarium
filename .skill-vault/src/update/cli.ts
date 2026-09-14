import type { Command, Context } from "../cli";
import { runDrift } from "./drift";
import { applyOverrides, loadOverrides, overridesPath, reportOverrides } from "./overrides";
import { update as runUpdate } from "./run";
import { softenVault } from "./soften";

interface CommandModule {
  run: Command;
  help: string;
}

// A malformed overrides file (OverridesError) and a root without skills/ (MissingSkillsDirError)
// both propagate to main, which reports them as `skillquarium <command>: <message>` and exits 1 --
// the same message and status the Python printed for its ValueError and SystemExit.
function flagged(
  help: string,
  allowed: string[],
  body: (flags: Set<string>, ctx: Context) => Promise<number> | number,
): CommandModule {
  return {
    help,
    run: async (args, ctx) => {
      const unknown = args.find((arg) => !allowed.includes(arg));
      if (unknown !== undefined) {
        ctx.err(`skillquarium: unknown option ${unknown}`);
        ctx.err(help);
        return 2;
      }
      return body(new Set(args), ctx);
    },
  };
}

export const overrides = flagged(
  `usage: skillquarium overrides [--check]

Re-apply the fixes recorded in .skill-vault/data/local-overrides.json to upstream-managed skills.

  --check  report without writing; exit 1 when an override is not applied`,
  ["--check"],
  (flags, ctx) => {
    const check = flags.has("--check");
    const recorded = loadOverrides(overridesPath(ctx.root));
    return reportOverrides(applyOverrides(recorded, ctx.root, !check), check, ctx);
  },
);

export const soften = flagged(
  `usage: skillquarium soften [--dry-run]

Rewrite coercive YAML description fields in skills/*/SKILL.md; skill bodies are untouched.

  --dry-run  print the files that would change without writing`,
  ["--dry-run"],
  (flags, ctx) => softenVault(ctx.root, { dryRun: flags.has("--dry-run") }, ctx),
);

const DRIFT_HELP = `usage: skillquarium drift [--lock PATH] [--skip-profiles] [--fail-on-drift]

Compare every .skill-lock.json entry and every frontmatter source-commit pin against upstream.

  --lock PATH       lock file to read (default <root>/.skill-lock.json)
  --skip-profiles   skip the imported-profile pins, which cost one API call per repo
  --fail-on-drift   exit 1 when anything is behind, unreachable, or unreadable`;

export const drift: CommandModule = {
  help: DRIFT_HELP,
  run: async (args, ctx) => {
    let lock: string | undefined;
    let skipProfiles = false;
    let failOnDrift = false;
    for (let i = 0; i < args.length; i++) {
      const arg = args[i] ?? "";
      if (arg === "--lock" || arg.startsWith("--lock=")) {
        lock = arg === "--lock" ? args[++i] : arg.slice("--lock=".length);
        if (!lock) {
          ctx.err("skillquarium drift: --lock requires a path");
          return 2;
        }
      } else if (arg === "--skip-profiles") skipProfiles = true;
      else if (arg === "--fail-on-drift") failOnDrift = true;
      else {
        ctx.err(`skillquarium drift: unknown option ${arg}`);
        ctx.err(DRIFT_HELP);
        return 2;
      }
    }
    return runDrift(ctx.root, { lock, skipProfiles, failOnDrift }, ctx);
  },
};

export const update = flagged(
  `usage: skillquarium update [--skip-fetch] [--skip-embed] [--fail-on-drift]

Run the upstream sync chain: skills update, overrides, soften, build --prune, kg, validate,
embed, drift. A failed upstream fetch still runs every later step and reports at the end.

  --skip-fetch     start at the overrides step
  --skip-embed     skip the embedding refresh (what CI passes)
  --fail-on-drift  exit 1 when the drift report finds anything behind or unreachable`,
  ["--skip-fetch", "--skip-embed", "--fail-on-drift"],
  (flags, ctx) =>
    runUpdate(
      {
        skipFetch: flags.has("--skip-fetch"),
        skipEmbed: flags.has("--skip-embed"),
        failOnDrift: flags.has("--fail-on-drift"),
      },
      ctx,
    ),
);
