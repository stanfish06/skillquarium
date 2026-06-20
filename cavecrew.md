---
title: cavecrew
tags:
  - skill
  - domain/reasoning-ideation
domain: reasoning-ideation
status: untried
source: cavecrew/SKILL.md
created: 2026-06-13
---

# cavecrew

> [!info] What it does
> Decision guide for delegating to caveman-style subagents. Tells the main thread WHEN to spawn `cavecrew-investigator` (locate code), `cavecrew-builder` (1-2 file edit), or `cavecrew-reviewer` (diff review) instead of doing the work inline or using vanilla `Explore`. Subagent output is caveman-compressed so the tool-result injected back into main context is ~60% smaller — main context lasts longer across long sessions. Trigger: "delegate to subagent", "use cavecrew", "spawn investigator/builder/reviewer", "save context", "compressed agent output".

**Source:** [cavecrew/SKILL.md](cavecrew/SKILL.md)  ·  **Domain:** [Reasoning, Ideation & Decision](maps/reasoning-ideation.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [review](review.md) — Review the changes since a fixed point (commit, branch, tag, or merge-base) along two axes — Standards (does the code follow this repo's documented coding standards?) and Spec (does...

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
