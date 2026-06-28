---
title: kermt-finetune
aliases:
  - kermt finetune
tags:
  - skill
  - domain/drug-discovery-chem
domain: drug-discovery-chem
status: untried
source: kermt-finetune/SKILL.md
created: 2026-06-28
---

# kermt-finetune

> [!info] What it does
> Finetune a pretrained KERMT encoder on a labeled CSV. The skill validates the input checkpoint (must be a pretrain ckpt — grover_base / cmim / hybrid), validates the labeled CSV, prepares the data (clean + features + optional split), then launches main.py finetune inside the kermt container (detached for hours-scale runs). Hyperparameters come from agent/config/defaults_finetune.json with per-flag CLI override.

**Source:** [kermt-finetune/SKILL.md](kermt-finetune/SKILL.md)  ·  **Domain:** [Drug Discovery, Cheminformatics & Structural Biology](maps/drug-discovery-chem.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [kermt-infer](kermt-infer.md) — Run predictions with a finetuned KERMT checkpoint on a SMILES-only CSV

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

