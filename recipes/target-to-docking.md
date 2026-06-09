---
title: Protein target → docking
tags:
  - recipe
  - domain/drug-discovery-chem
created: 2026-06-09
---

# Protein target → docking

> [!abstract] Goal
> From a protein target to a predicted structure and ranked small-molecule poses.

[Back to Recipes](index.md)  ·  [Skill Index](../index.md)

## Pipeline

```mermaid
flowchart LR
  A[Target sequence] --> B[Predict structure] --> C[Dock ligands] --> D[Filter library] --> E[Ranked candidates]
```

## Steps

1. **[struct-predictor](../struct-predictor.md)** — predict the 3D structure (Boltz-2). Sequence embeddings / design: **[esm](../esm.md)**.
2. **[diffdock](../diffdock.md)** — protein–ligand pose prediction / docking.
3. **[medchem](../medchem.md)** — triage the library (drug-likeness rules, structural alerts).
4. **[rdkit](../rdkit.md)** / **[datamol](../datamol.md)** — parse, standardize, and featurize molecules.

## Triage & refine

- **[target-validation-scorer](../target-validation-scorer.md)** + **[depmap](../depmap.md)** — is the target worth pursuing?
- **[molecular-dynamics](../molecular-dynamics.md)** — refine / validate binding with MD.
- Cloud batch chemistry: **[rowan](../rowan.md)**.
