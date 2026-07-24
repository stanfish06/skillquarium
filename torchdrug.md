---
title: torchdrug
tags:
  - skill
  - domain/drug-discovery-chem
domain: drug-discovery-chem
status: untried
source: torchdrug/SKILL.md
created: 2026-06-09
---

# torchdrug

> [!info] What it does
> PyTorch-native graph neural networks for molecules and proteins. Use when building custom GNN architectures for drug discovery, protein modeling, or knowledge graph reasoning. Best for custom model development, protein property prediction, retrosynthesis. For pre-trained models and diverse featurizers use deepchem; for benchmark datasets use pytdc.

**Source:** [torchdrug/SKILL.md](torchdrug/SKILL.md)  ·  **Domain:** [Drug Discovery, Cheminformatics & Structural Biology](maps/drug-discovery-chem.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [deepchem](deepchem.md) — Molecular ML with diverse featurizers and pre-built datasets
- [pytdc](pytdc.md) — Therapeutics Data Commons. AI-ready drug discovery datasets (ADME, toxicity, DTI), benchmarks, scaffold splits, molecular oracles, for therapeutic ML and pharmacological prediction

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

> [!warning] Vault audit 2026-07-24 — DEP-4 (deprecated)
> `torchdrug` is frozen — no PyPI release since 0.2.1 (Jul 2023), incompatible with Python ≥3.11 / PyTorch ≥2.1, so effectively uninstallable on current stacks. Prefer `deepchem` + `torch-geometric` for molecular ML / GNN work; treat this skill as archived.
> _Remote-managed skill — the durable fix belongs upstream; this wrapper note is the local record._
