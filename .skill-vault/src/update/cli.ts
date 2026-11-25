import type { Command, Context } from "../cli";
import { runDrift } from "./drift";
import {
  applyOrQuarantine,
  applyOverrides,
  loadOverrides,
  overridesPath,
  reportOverrides,
} from "./overrides";
import { addRenamed, reportRenamed, syncRenamed } from "./renamed";
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
  `usage: skillquarium overrides [--check | --quarantine]

Re-apply the fixes recorded in .skill-vault/data/local-overrides.json to upstream-managed skills.
Also verify the pinned Lean attribution bundle and restore its per-skill notices after reinstalling.

  --check       report without writing; exit 1 when an override is not applied
  --quarantine  also restore each skill left stale or missing, folder and lock entry,
                from HEAD; exit 1 when one was quarantined, 2 when one could not be restored.
                For update-skills.yml: it discards uncommitted edits in those skills`,
  ["--check", "--quarantine"],
  (flags, ctx) => {
    const check = flags.has("--check");
    if (flags.has("--quarantine")) {
      if (check) {
        ctx.err("skillquarium: --check and --quarantine cannot be combined");
        return 2;
      }
      return applyOrQuarantine(ctx.root, ctx);
    }
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

export const renamed = flagged(
  `usage: skillquarium renamed [--check]

Sync the upstream skills installed under a new name, recorded in
.skill-vault/data/renamed-skills.json. The skills CLI cannot update them: it matches a lock
entry's name against upstream's \`name:\` (#827). Each changed upstream folder is copied over
skills/<name>, its \`name:\` set to the local name and, for rewriteRefs entries, its \`/skill\`
and \`../skill/\` references to the same source renamed too. Run overrides afterwards.

  --check  report without writing; exit 1 when a skill is behind`,
  ["--check"],
  (flags, ctx) => {
    const check = flags.has("--check");
    return reportRenamed(syncRenamed(ctx.root, !check), check, ctx);
  },
);

const ADD_HELP = `usage: skillquarium add <owner/repo | git-url> (--skill NAME... | --all)
                        (--as NAME | --prefix PREFIX) [--rewrite-refs]

Install upstream skills under new names and record them in
.skill-vault/data/renamed-skills.json, which \`skillquarium renamed\` keeps in sync. For a skill
that keeps its upstream name, use \`npx skills add <source> -g --skill NAME\` instead.

  --skill NAME    upstream \`name:\` to add; repeat for several
  --all           every skill in the source
  --as NAME       local name for a single --skill
  --prefix P      prepend P to each upstream name that does not already start with it
  --rewrite-refs  point \`/skill\` and \`../skill/\` references between the added skills at the
                  new names; mentions in prose still need overrides`;

export const add: CommandModule = {
  help: ADD_HELP,
  run: async (args, ctx) => {
    const skills: string[] = [];
    let source: string | undefined;
    let as: string | undefined;
    let prefix: string | undefined;
    let all = false;
    let rewriteRefs = false;
    const usage = (message: string) => {
      ctx.err(`skillquarium add: ${message}`);
      ctx.err(ADD_HELP);
      return 2;
    };
    for (let i = 0; i < args.length; i++) {
      const arg = args[i] ?? "";
      const [flag, inline] =
        arg.startsWith("--") && arg.includes("=")
          ? [arg.slice(0, arg.indexOf("=")), arg.slice(arg.indexOf("=") + 1)]
          : [arg, undefined];
      const value = () => inline ?? args[++i];
      if (flag === "--skill" || flag === "--as" || flag === "--prefix") {
        const v = value();
        if (!v) return usage(`${flag} requires a value`);
        if (flag === "--skill") skills.push(v);
        else if (flag === "--as") as = v;
        else prefix = v;
      } else if (arg === "--all") all = true;
      else if (arg === "--rewrite-refs") rewriteRefs = true;
      else if (arg.startsWith("-")) return usage(`unknown option ${arg}`);
      else if (source === undefined) source = arg;
      else return usage(`unexpected argument ${arg}`);
    }
    if (source === undefined) return usage("a source is required");
    if (all === skills.length > 0) return usage("pass either --skill NAME or --all");
    if ((as === undefined) === (prefix === undefined)) return usage("pass exactly one of --as or --prefix");
    let added: [string, string][];
    try {
      added = addRenamed(ctx.root, { source, skills, all, as, prefix, rewriteRefs });
    } catch (e) {
      ctx.err(`skillquarium add: ${e instanceof Error ? e.message : String(e)}`);
      return 1;
    }
    for (const [local, upstream] of added) ctx.out(`added skills/${local} (upstream ${upstream})`);
    ctx.out("next: assign each a domain in categories.json extraAssignments, then build and validate");
    return 0;
  },
};

export const update = flagged(
  `usage: skillquarium update [--skip-fetch] [--skip-embed] [--fail-on-drift]

Run the upstream sync chain: skills update, renamed, overrides, soften, build --prune, kg,
validate, embed, drift. A failed upstream fetch still runs every later step and reports at the end.

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
