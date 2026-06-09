---
title: Single-cell RNA-seq
tags:
  - recipe
  - domain/single-cell-rnaseq
created: 2026-06-09
---

# Single-cell RNA-seq

> [!abstract] Goal
> Go from single-cell counts to QC'd, batch-integrated, annotated clusters with marker genes.

[Back to Recipes](index.md)  ·  [Skill Index](../index.md)

## Pipeline

```mermaid
flowchart LR
  A[Counts / h5ad] --> B[QC + doublets] --> C[Integrate / embed] --> D[Cluster] --> E[Annotate] --> F[Markers + figures]
```

## Steps

1. **[scrna-orchestrator](../scrna-orchestrator.md)** — QC, doublet detection, clustering, marker discovery (Scanpy pipeline). Lower-level: **[scanpy](../scanpy.md)**.
2. **[scvi-tools](../scvi-tools.md)** — batch-aware integration and latent embedding. Alternative: **[scrna-embedding](../scrna-embedding.md)**.
3. Annotation — CellTypist (within `scrna-orchestrator`); compare to a reference atlas via **[cellxgene-census](../cellxgene-census.md)**.
4. **[scientific-visualization](../scientific-visualization.md)** — UMAPs, dotplots, marker heatmaps.

## Related

- Data format: **[anndata](../anndata.md)** — the `.h5ad` structure used throughout.
- Upstream (FASTQ → counts): **[nfcore-scrnaseq-wrapper](../nfcore-scrnaseq-wrapper.md)**.
- Trajectories: **[scvelo](../scvelo.md)** — RNA velocity / latent time.
