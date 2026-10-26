---
title: autoskill
tags:
  - skill
  - domain/vault-meta
domain: vault-meta
status: untried
source: skills/autoskill/SKILL.md
created: 2026-06-09
---

# autoskill

> [!info] What it does
> Analyzes user-requested Screenpipe history windows to detect repeated research workflows, match existing scientific skills, and stage new skill drafts or composition recipes for review. Requires a reachable Screenpipe HTTP API, normally on localhost:3030. Detection and embedding inference run locally; the selected LLM receives redacted app/title cluster summaries and matched skill descriptions. Use only when the user explicitly asks to analyze their recent work and propose skills.

**Source:** [skills/autoskill/SKILL.md](../../../skills/autoskill/SKILL.md)  ·  **Domain:** [Vault, Skills & Workflow Meta](../../maps/vault-meta.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [research](../../notes/software-dev/research.md) — Investigate a question against high-trust primary sources and capture the findings as a Markdown file in the repo

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

> [!warning] Vault audit 2026-07-24 — MNT-10
> References a superseded model id `claude-opus-4-7` and hardcodes a stale sibling count ("135 skills") in two places — both are drift. Use a current model id and don't trust the hardcoded count (the vault has ~1250 skills).
> _Remote-managed skill — the durable fix belongs upstream; this wrapper note is the local record._

> [!note] Vault audit 2026-07-24 — USE-10
> Use this to auto-draft skills from repeated workflows observed on your screen (screenpipe); to hand-scaffold a new skill from a spec use `skill-builder`, to eval-tune an existing skill use `clawpathy-autoresearch`, to package a plugin bundle use `plugin-creator`. Distinguishing axis: authoring mode (screen-observation vs manual scaffold vs eval-tuning vs plugin packaging).
