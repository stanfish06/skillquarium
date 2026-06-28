---
title: complexa-sweep
aliases:
  - complexa sweep
tags:
  - skill
  - domain/drug-discovery-chem
domain: drug-discovery-chem
status: untried
source: complexa-sweep/SKILL.md
created: 2026-06-28
---

# complexa-sweep

> [!info] What it does
> Use this skill whenever the user wants to run a parameter sweep over a Proteina-Complexa design pipeline — cartesian-product hyperparameter scans, Pareto search over generation/reward/evaluation knobs, or any "compare configurations" workflow. Trigger phrases include "sweep beam width", "sweep nsteps", "hyperparameter sweep", "parameter scan", "scan beam_width and temperature", "compare configurations", "find the best generation params", "what's the optimal nsteps", "Pareto search for binder quality vs wall-clock", "complexa sweep", "tune Complexa", "ablate the reward weights", "configs/sweeps", "--sweeper", "run beam_width.yaml". This is the only skill that owns sweeper YAML authoring, cartesian-product expansion, and per-config result ranking. For cluster submission mechanics see the `complexa-slurm` skill.

**Source:** [complexa-sweep/SKILL.md](complexa-sweep/SKILL.md)  ·  **Domain:** [Drug Discovery, Cheminformatics & Structural Biology](maps/drug-discovery-chem.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [complexa-slurm](complexa-slurm.md) — Launch Proteina-Complexa pipelines on a remote SLURM cluster — binder search, LaProteina monomer design, or multi-node distributed training

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

