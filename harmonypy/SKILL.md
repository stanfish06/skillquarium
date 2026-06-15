---
name: harmonypy
description: Harmony batch correction for single-cell data in scanpy workflows, with scvi-tools as the heavier alternative. Use when integrating scRNA-seq or single-cell multi-sample embeddings across batches, donors, chemistries, or experiments using harmonypy or Scanpy's Harmony integration.
---

# harmonypy

Use this skill for fast exploratory batch correction of single-cell embeddings with Harmony. Harmony operates on a low-dimensional representation, usually PCA, and returns corrected coordinates for neighbor graph construction and visualization.

## When To Use

- Multi-sample scRNA-seq integration where batches dominate PCA/UMAP.
- Quick exploratory integration before deeper modeling.
- Scanpy pipelines that need a lightweight correction step between PCA and neighbors.

Prefer `scvi-tools` when the project needs a probabilistic model, covariates, transfer learning, or robust multi-modal integration.

## Scanpy Pattern

```python
import scanpy as sc
import scanpy.external as sce

sc.pp.normalize_total(adata)
sc.pp.log1p(adata)
sc.pp.highly_variable_genes(adata, batch_key="batch")
adata = adata[:, adata.var["highly_variable"]].copy()
sc.pp.scale(adata, max_value=10)
sc.tl.pca(adata)

sce.pp.harmony_integrate(adata, key="batch")
sc.pp.neighbors(adata, use_rep="X_pca_harmony")
sc.tl.umap(adata)
sc.tl.leiden(adata)
```

## Direct harmonypy Pattern

Current version: **harmonypy 2.0.0** (April 2026, C++ backend rewrite matching R harmony2). Pre-built wheels for Linux and macOS (Python 3.9–3.13); Windows is not supported.

```python
import harmonypy as hm

ho = hm.run_harmony(pca_matrix, metadata, vars_use=["batch"])
corrected = ho.Z_corr  # already cells × PCs since harmonypy 0.1.0 — do not transpose
```

## Checks

- Confirm that the correction variable is technical, not the biology of interest.
- Plot UMAPs colored by both batch and expected biological labels.
- Compare marker genes before and after correction to catch overcorrection.
- Do not run Harmony on raw counts; use PCA or another embedding.
- Keep uncorrected PCA and raw expression available for differential expression.
