---
title: get-available-resources
tags:
  - skill
  - domain/vault-meta
source: get-available-resources/SKILL.md
created: 2026-06-09
---

# get-available-resources

> [!info] What it does
> This skill should be used at the start of any computationally intensive scientific task to detect and report available system resources (CPU cores, GPUs, memory, disk space). It creates a JSON file with resource information and strategic recommendations that inform computational approach decisions such as whether to use parallel processing (joblib, multiprocessing), out-of-core computing (Dask, Zarr), GPU acceleration (PyTorch, JAX), or memory-efficient strategies. Use this skill before running analyses, training models, processing large datasets, or any task where resource constraints matter.

**Source:** [get-available-resources/SKILL.md](get-available-resources/SKILL.md)  ·  **Domain:** [Vault, Skills & Workflow Meta](maps/vault-meta.md)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [dask](dask.md) — Distributed computing for larger-than-RAM pandas/NumPy workflows

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
