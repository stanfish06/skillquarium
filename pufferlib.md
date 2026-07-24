---
title: pufferlib
tags:
  - skill
  - domain/ml-ai
domain: ml-ai
status: untried
source: pufferlib/SKILL.md
created: 2026-06-09
---

# pufferlib

> [!info] What it does
> High-performance reinforcement learning framework optimized for speed and scale. Use when you need fast parallel training, vectorized environments, multi-agent systems, or integration with game environments (Atari, Procgen, NetHack). Achieves 2-10x speedups over standard implementations. For quick prototyping or standard algorithm implementations with extensive documentation, use stable-baselines3 instead.

**Source:** [pufferlib/SKILL.md](pufferlib/SKILL.md)  ·  **Domain:** [Machine Learning & AI](maps/ml-ai.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [pufferlib-v2](pufferlib-v2.md) — PufferLib 2.x reinforcement learning workflows for the Dec 2024 API generation
- [pufferlib-v3](pufferlib-v3.md) — PufferLib 3.x reinforcement learning workflows for the Jun 2025 API generation
- [stable-baselines3](stable-baselines3.md) — Production-ready reinforcement learning algorithms (PPO, SAC, DQN, TD3, DDPG, A2C) with scikit-learn-like API

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

> [!warning] Vault audit 2026-07-24 — DEP-12 (deprecated API)
> This skill teaches the v1 top-level PuffeRL API, but its `uv pip install pufferlib` (SKILL.md ~L425) is unpinned and installs 3.x, which `pufferlib-v2`/`pufferlib-v3` flag as a different/deprecated API — a broken combination. Pin `pufferlib==1.0.0` to match this skill, or use `pufferlib-v3` for current PufferLib.
> _Remote-managed skill — the durable fix belongs upstream; this wrapper note is the local record._
