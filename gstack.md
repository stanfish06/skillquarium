---
title: gstack
tags:
  - skill
  - domain/software-dev
domain: software-dev
status: untried
source: gstack/SKILL.md
created: 2026-06-21
---

# gstack

> [!info] What it does
> Fast headless browser for QA testing and site dogfooding. (gstack)

**Source:** [gstack/SKILL.md](gstack/SKILL.md)  ·  **Domain:** [Software Development & Engineering](maps/software-dev.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [qa](qa.md) — Interactive QA session where user reports bugs or issues conversationally, and the agent files GitHub issues

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

**gstack** is Garry Tan's (YC CEO) opinionated Claude Code setup — 23 specialist
slash commands + 8 power tools that turn Claude Code into a virtual engineering
team: CEO, eng manager, designer, reviewer, QA lead, security officer, release
engineer. MIT licensed.

The root `SKILL.md` (description above) is actually gstack's `/browse` skill
entry point. The real value is the bundled slash commands inside the `gstack/`
folder: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/review`,
`/qa`, `/ship`, `/cso`, `/investigate`, `/retro`, `/autoplan`, `/spec`,
`/learn`, `/design-shotgun`, `/design-html`, `/design-review`, `/devex-review`,
`/document-release`, `/document-generate`, `/land-and-deploy`, `/canary`,
`/benchmark`, `/codex`, `/careful`, `/freeze`, `/guard`, `/make-pdf`,
`/diagram`, `/pair-agent`, and more.

**Install for working skills (not just navigation):** `install-skills.sh`
clones gstack fresh and runs its `./setup --host auto --no-prefix` to
symlink the whole bundle (with `lib/`, `bin/`, `browse/` runtime) into
each detected agent's skills directory. Bun is auto-installed if missing
so browser skills work; set `GSTACK_SKIP_BUN=1` for a manual-symlink
fallback (methodology skills only). The bundle stays intact — do NOT
split gstack into per-skill folders.

Docs: https://github.com/garrytan/gstack  ·  License: MIT

