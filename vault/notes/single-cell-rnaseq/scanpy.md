---
title: scanpy
aliases:
  - single cell
  - scRNA-seq
tags:
  - skill
  - domain/single-cell-rnaseq
domain: single-cell-rnaseq
status: untried
source: skills/scanpy/SKILL.md
created: 2026-06-09
---

# scanpy

> [!info] What it does
> Performs Scanpy single-cell RNA-seq QC, normalization, HVG selection, PCA/UMAP/t-SNE, clustering, exploratory marker ranking, pseudobulk preparation, visualization, and Seurat or SingleCellExperiment RDS conversion to h5ad. Applies to established exploratory scRNA-seq workflows with explicit count and expression provenance; complementary skills cover scvi-tools models and AnnData format details.

**Source:** [skills/scanpy/SKILL.md](../../../skills/scanpy/SKILL.md)  ·  **Domain:** [Single-Cell, RNA-seq & Functional Genomics](../../maps/single-cell-rnaseq.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [adjusttext](../../notes/data-science-compute/adjusttext.md) — Use the Python adjustText package to automatically move matplotlib text labels so they do not overlap each other, points, or other artists
- [anndata](../../notes/single-cell-rnaseq/anndata.md) — Handles annotated matrices in single-cell analysis, .h5ad and Zarr files, and integration with the scverse ecosystem
- [bulk-rnaseq](../../notes/single-cell-rnaseq/bulk-rnaseq.md) — End-to-end bulk RNA-seq orchestrator — takes raw FASTQ reads through QC and trimming (FastQC, fastp/Trim Galore), alignment and quantification (STAR, Salmon, featureCounts), assembles...
- [cellxgene-census](../../notes/single-cell-rnaseq/cellxgene-census.md) — Query the CZ CELLxGENE Census programmatically for versioned public single-cell and spatial transcriptomics data
- [harmonypy](../../notes/single-cell-rnaseq/harmonypy.md) — Harmony batch correction for single-cell data in scanpy workflows, with scvi-tools as the heavier alternative
- [pathway-enrichment](../../notes/single-cell-rnaseq/pathway-enrichment.md) — Run pathway and gene-set enrichment analysis on gene lists or ranked gene data, then interpret the results
- [scirpy-immune-repertoire](../../notes/single-cell-rnaseq/scirpy-immune-repertoire.md) — Single-cell immune receptor analysis with Scirpy for scanpy, anndata, and scvi-tools projects
- [scrna-orchestrator](../../notes/single-cell-rnaseq/scrna-orchestrator.md) — Local Scanpy pipeline for single-cell RNA-seq QC, optional doublet detection, clustering, marker discovery, optional CellTypist annotation, optional latent downstream mode from...
- [scrna-preprocessing-clustering](../../notes/single-cell-rnaseq/scrna-preprocessing-clustering.md) — Standard scRNA-seq preprocessing and clustering with Scanpy
- [scvelo](../../notes/single-cell-rnaseq/scvelo.md) — Performs RNA velocity analysis with scVelo from spliced and unspliced single-cell RNA counts
- [scvi-tools](../../notes/single-cell-rnaseq/scvi-tools.md) — Fits probabilistic models for single-cell omics, including scVI batch integration, scANVI annotation, totalVI CITE-seq, MultiVI RNA/ATAC integration, and posterior differential...
- [seurat](../../notes/single-cell-rnaseq/seurat.md) — Single-cell RNA-seq analysis in R with Seurat v5 — QC, normalization (LogNormalize or SCTransform), dimensionality reduction, clustering, marker detection, integration of multiple...
- [spatialdata-squidpy](../../notes/single-cell-rnaseq/spatialdata-squidpy.md) — Spatial omics workflows with SpatialData and Squidpy alongside scanpy, anndata, and napari-viz

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
