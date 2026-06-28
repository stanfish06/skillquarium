---
title: kermt-add-cmim-pretrain
aliases:
  - kermt add cmim pretrain
tags:
  - skill
  - domain/drug-discovery-chem
domain: drug-discovery-chem
status: untried
source: kermt-add-cmim-pretrain/SKILL.md
created: 2026-06-28
---

# kermt-add-cmim-pretrain

> [!info] What it does
> Convert a grover_base checkpoint (encoder-only or encoder + vocab heads) into a hybrid checkpoint by adding a randomly-initialized cMIM decoder + latent_dist, then continue pretraining on the user's corpus as hybrid (vocab + contrast). Effectively kermt-continue-pretrain with a one-time ckpt-conversion step prepended.

**Source:** [kermt-add-cmim-pretrain/SKILL.md](kermt-add-cmim-pretrain/SKILL.md)  ·  **Domain:** [Drug Discovery, Cheminformatics & Structural Biology](maps/drug-discovery-chem.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [kermt-continue-pretrain](kermt-continue-pretrain.md) — Continue pretraining from an existing KERMT checkpoint

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

