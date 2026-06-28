---
title: kermt-continue-pretrain
aliases:
  - kermt continue pretrain
tags:
  - skill
  - domain/drug-discovery-chem
domain: drug-discovery-chem
status: untried
source: kermt-continue-pretrain/SKILL.md
created: 2026-06-28
---

# kermt-continue-pretrain

> [!info] What it does
> Continue pretraining from an existing KERMT checkpoint. The skill validates the user's checkpoint and pretrain CSV, prepares the data into shard/vocab/features form, then launches pretrain_ddp.py inside the kermt container (detached for long runs). Auto-dispatches `--pretrain_mode` based on the checkpoint type (grover_base vocab-only, cmim, or hybrid).

**Source:** [kermt-continue-pretrain/SKILL.md](kermt-continue-pretrain/SKILL.md)  ·  **Domain:** [Drug Discovery, Cheminformatics & Structural Biology](maps/drug-discovery-chem.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [kermt-add-cmim-pretrain](kermt-add-cmim-pretrain.md) — Convert a grover_base checkpoint (encoder-only or encoder + vocab heads) into a hybrid checkpoint by adding a randomly-initialized cMIM decoder + latent_dist, then continue pretraining...
- [kermt-pretrain-scratch](kermt-pretrain-scratch.md) — Pretrain a fresh KERMT model from scratch on a user-provided corpus

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

