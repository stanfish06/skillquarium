---
title: pufferlib
tags:
  - skill
  - domain/ml-ai
domain: ml-ai
status: untried
source: skills/pufferlib/SKILL.md
created: 2026-06-09
---

# pufferlib

> [!info] What it does
> Version-aware guidance for PufferLib reinforcement-learning environments, vectorization, policies, PuffeRL training, evaluation, and safe checkpoint review. Covers the native 5.0 build and environment API, published 3.0.0 Gymnasium/PettingZoo adaptation, and a pinned historical 4.0 profile.

**Source:** [skills/pufferlib/SKILL.md](../../../skills/pufferlib/SKILL.md)  ·  **Domain:** [Machine Learning & AI](../../maps/ml-ai.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [pufferlib-v2](../../notes/ml-ai/pufferlib-v2.md) — PufferLib 2.x reinforcement learning workflows for the Dec 2024 API generation
- [pufferlib-v3](../../notes/ml-ai/pufferlib-v3.md) — PufferLib 3.x reinforcement learning workflows for the Jun 2025 API generation

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

> [!warning] Vault audit 2026-07-24 — DEP-12 (deprecated API)
> This skill teaches the v1 top-level PuffeRL API, but its `uv pip install pufferlib` (SKILL.md ~L425) is unpinned and installs 3.x, which `pufferlib-v2`/`pufferlib-v3` flag as a different/deprecated API — a broken combination. Pin `pufferlib==1.0.0` to match this skill, or use `pufferlib-v3` for current PufferLib.
> _Remote-managed skill — the durable fix belongs upstream; this wrapper note is the local record._
