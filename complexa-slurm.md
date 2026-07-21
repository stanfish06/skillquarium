---
title: complexa-slurm
aliases:
  - complexa slurm
tags:
  - skill
  - domain/drug-discovery-chem
domain: drug-discovery-chem
status: untried
source: complexa-slurm/SKILL.md
created: 2026-06-28
---

# complexa-slurm

> [!info] What it does
> Launch Proteina-Complexa pipelines on a remote SLURM cluster — binder search, LaProteina monomer design, or multi-node distributed training. Reach for this skill whenever the user says "launch on SLURM", "submit to the cluster", "submit binder search to SLURM", "kick off training on the cluster", "multi-node training", "cluster job", "sbatch", "remote GPU run", "complexa slurm", "launch_protein_binder_search.sh", "launch_laproteina_train.sh", "launch_laproteina_design_pipeline.sh", "launch on grizzly / polar", "--on-cluster", "run distributed training", "sweep on SLURM", "run all targets on the cluster", "kick off a multi-target binder search", "rsync to cluster", "submit a singleton requeue chain", or whenever a Hydra config / sweep needs to escape a single workstation. This skill drives the launcher scripts under `slurm_utils/`, **always previews with `--dry-run` first**, then submits, captures SLURM job IDs, and emits a replayable manifest. SLURM submission costs cluster time and is hard to reverse, so the dry-run gate is non-optional.

**Source:** [complexa-slurm/SKILL.md](complexa-slurm/SKILL.md)  ·  **Domain:** [Drug Discovery, Cheminformatics & Structural Biology](maps/drug-discovery-chem.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

_None auto-detected. Add your own links here, e.g. `[scanpy](scanpy.md)`._

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

