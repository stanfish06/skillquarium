---
title: kermt-infer
aliases:
  - kermt infer
tags:
  - skill
  - domain/drug-discovery-chem
domain: drug-discovery-chem
status: untried
source: kermt-infer/SKILL.md
created: 2026-06-28
---

# kermt-infer

> [!info] What it does
> Run predictions with a finetuned KERMT checkpoint on a SMILES-only CSV. The skill validates that the input ckpt has task FFN heads (refuses pretrain ckpts with a redirect to kermt-finetune), validates the CSV, prepares the data (clean + rdkit_2d features), then launches main.py predict inside the kermt container (blocking, minutes-scale).

**Source:** [kermt-infer/SKILL.md](kermt-infer/SKILL.md)  ·  **Domain:** [Drug Discovery, Cheminformatics & Structural Biology](maps/drug-discovery-chem.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [kermt-finetune](kermt-finetune.md) — Finetune a pretrained KERMT encoder on a labeled CSV

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

