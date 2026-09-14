import type { Command } from "../cli";
import { installVault, parseInstallArgs } from "./run";

export const help = `install [--extras <names>] [--dry-run]

Link every vault skill into the agents' skill directories and optionally install
heavier extras that are skipped by default.

Options:
  --extras <name>...   install optional extras (default: none)
                       names: gstack, career, ui-ux, all
                       aliases: career-ops, ui-ux-pro-max, uipro
  --extras=<csv>       comma-separated form (e.g. --extras=gstack,ui-ux)
  --dry-run            print the commands this would run, change nothing
  -h, --help           show this help

Examples:
  skillquarium install
  skillquarium install --extras gstack
  skillquarium install --extras gstack career ui-ux
  skillquarium install --extras=all

Environment (honored when the matching extra is enabled):
  GSTACK_SKIP=1              force-skip gstack even with --extras gstack
  GSTACK_SKIP_BUN=1          skip bun install (browser skills disabled)
  GSTACK_REF=<ref>           pin gstack to a git ref
  CAREER_OPS_SKIP=1          force-skip career-ops even with --extras career
  CAREER_OPS_DIR=<path>      career-ops workspace location (default: ~/career-ops)
  CAREER_OPS_AUTO_UPDATE=0   freeze an existing career-ops checkout
  UI_UX_PRO_MAX_SKIP=1       force-skip UI/UX Pro Max even with --extras ui-ux
  UI_UX_PRO_MAX_CLI_VERSION=<ver>
                             pin its CLI version (default: 2.14.1)

Environment (always honored):
  SKILLS_CLI_VERSION=<ver>   pin the skills CLI version
  CLAUDE_SKILLS_DIR=<path>   Claude Code skills dir (default: ~/.claude/skills)`;

export const run: Command = async (args, ctx) => {
  const parsed = parseInstallArgs(args);
  if (parsed.help) {
    ctx.out(help);
    return 0;
  }
  if (parsed.error !== undefined) {
    ctx.err(parsed.error);
    return 1;
  }
  return installVault(ctx, { extras: parsed.extras, dryRun: parsed.dryRun });
};
