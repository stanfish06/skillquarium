---
title: kermt-pretrain-scratch
aliases:
  - kermt pretrain scratch
tags:
  - skill
  - domain/drug-discovery-chem
domain: drug-discovery-chem
status: untried
source: skills/kermt-pretrain-scratch/SKILL.md
created: 2026-06-28
---

# kermt-pretrain-scratch

> [!info] What it does
> Pretrain a fresh KERMT model from scratch on a user-provided corpus. Builds a new vocabulary from the corpus, instantiates the model architecture from defaults, and launches pretrain_ddp.py inside the kermt container (detached for long runs). Unlike kermt-continue-pretrain, no starting checkpoint is loaded — the model is randomly initialized.

**Source:** [skills/kermt-pretrain-scratch/SKILL.md](../../../skills/kermt-pretrain-scratch/SKILL.md)  ·  **Domain:** [Drug Discovery, Cheminformatics & Structural Biology](../../maps/drug-discovery-chem.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [kermt-continue-pretrain](../../notes/drug-discovery-chem/kermt-continue-pretrain.md) — Continue pretraining from an existing KERMT checkpoint

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
