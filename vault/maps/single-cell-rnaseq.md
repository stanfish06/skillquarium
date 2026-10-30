---
title: Single-Cell, RNA-seq & Functional Genomics
tags:
  - skill-map
created: 2026-06-13
---

# Single-Cell, RNA-seq & Functional Genomics

> [!abstract] Scope
> scRNA-seq and bulk RNA-seq pipelines, differential expression, and pathway/network analysis.

[Back to Skill Index](../index.md)

**Related maps:** [Genomics, Variants & Population Genetics](genomics-variants.md) | [Proteomics & Metabolomics](proteomics-metabolomics.md) | [Sequence Analysis, NGS & Phylogenetics](sequence-phylogenetics.md) | [Bio Databases, Lab & Cloud Platforms](bio-databases-platforms.md)

## Skills (42)

- [anndata](../notes/single-cell-rnaseq/anndata.md) — Handles annotated matrices in single-cell analysis, .h5ad and Zarr files, and integration with the scverse ecosystem
- [arboreto](../notes/single-cell-rnaseq/arboreto.md) — Infers candidate gene regulatory networks from bulk or single-cell expression data using AertsLab Arboreto GRNBoost2 and GENIE3
- [atac-seq](../notes/single-cell-rnaseq/atac-seq.md) — ATAC-seq processing with assay QC, MACS3 peak calling, consensus peak matrices, differential accessibility, and motif or footprint follow-up
- [bgee-skill](../notes/single-cell-rnaseq/bgee-skill.md) — Submit compact Bgee SPARQL requests for healthy wild-type expression metadata and ontology-aware lookup patterns
- [bulk-rnaseq](../notes/single-cell-rnaseq/bulk-rnaseq.md) — End-to-end bulk RNA-seq orchestrator — takes raw FASTQ reads through QC and trimming (FastQC, fastp/Trim Galore), alignment and quantification (STAR, Salmon, featureCounts), assembles...
- [cell-annotation](../notes/single-cell-rnaseq/cell-annotation.md) — Automated and marker-guided single-cell cell type annotation using CellTypist, marker review, reference transfer, and confidence-aware label curation
- [cell-communication](../notes/single-cell-rnaseq/cell-communication.md) — Cell-cell / ligand-receptor communication analysis for single-cell data using LIANA+ (recommended consensus default), CellPhoneDB, CellChat (R), and squidpy's ligrec
- [cellxgene-census](../notes/single-cell-rnaseq/cellxgene-census.md) — Query the CZ CELLxGENE Census programmatically for versioned public single-cell and spatial transcriptomics data
- [chip-seq](../notes/single-cell-rnaseq/chip-seq.md) — ChIP-seq peak calling and downstream interpretation with MACS3, signal track export, annotation, motif analysis, and differential binding review
- [de-summary](../notes/single-cell-rnaseq/de-summary.md) — Summarise pre-computed differential expression results with ranked gene lists, biological themes, and publication-ready interpretation
- [deeptools](../notes/single-cell-rnaseq/deeptools.md) — NGS analysis toolkit. BAM to bigWig conversion, QC (correlation, PCA, fingerprints), heatmaps/profiles (TSS, peaks), for ChIP-seq, RNA-seq, ATAC-seq visualization
- [diff-visualizer](../notes/single-cell-rnaseq/diff-visualizer.md) — Rich downstream visualisation and reporting for bulk RNA-seq differential expression and scRNA marker/contrast outputs
- [differential-expression](../notes/single-cell-rnaseq/differential-expression.md) — Bulk transcriptomics differential expression with count-aware modeling, design validation, contrast handling, thresholded exports, and publication-ready DE figures
- [encode-skill](../notes/single-cell-rnaseq/encode-skill.md) — Submit compact ENCODE REST API requests for object lookups, portal-style search, and metadata retrieval
- [harmonypy](../notes/single-cell-rnaseq/harmonypy.md) — Harmony batch correction for single-cell data in scanpy workflows, with scvi-tools as the heavier alternative
- [mofaplus-multi-omics](../notes/single-cell-rnaseq/mofaplus-multi-omics.md) — Multi-Omics Factor Analysis v2 (MOFA+) with mofapy2
- [muon-multiomics-singlecell](../notes/single-cell-rnaseq/muon-multiomics-singlecell.md) — Multi-modal single-cell analysis with muon/MuData
- [nfcore-rnaseq-wrapper](../notes/single-cell-rnaseq/nfcore-rnaseq-wrapper.md) — Wrapper skill for running nf-core/rnaseq bulk RNA-seq preprocessing from FASTQ or BAM inputs with strict preflight, reproducibility outputs, and downstream handoff to ClawBio bulk...
- [nfcore-scrnaseq-wrapper](../notes/single-cell-rnaseq/nfcore-scrnaseq-wrapper.md) — Wrapper skill for running nf-core/scrnaseq 4.1.0 upstream single-cell RNA-seq preprocessing from FASTQ with strict preflight, reproducibility outputs, and downstream handoff to ClawBio...
- [ngs-atacseq-peaks-qc](../notes/single-cell-rnaseq/ngs-atacseq-peaks-qc.md) — Run or plan ATAC-seq QC, alignment, TSS enrichment, fragment-size, blacklist, peak-calling, consensus peak, and differential accessibility workflows
- [ngs-bulk-rnaseq](../notes/single-cell-rnaseq/ngs-bulk-rnaseq.md) — Dispatch bulk RNA-seq requests to FASTQ-to-count QC or count-matrix differential-expression skills using nf-core/rnaseq, STAR, Salmon, featureCounts, MultiQC, and R/Bioconductor...
- [ngs-bulk-rnaseq-counts-qc](../notes/single-cell-rnaseq/ngs-bulk-rnaseq-counts-qc.md) — Run or plan bulk RNA-seq FASTQ-to-count processing with sample-sheet, strandedness, genome annotation, alignment or pseudoalignment, MultiQC, and count-matrix QC checks
- [ngs-bulk-rnaseq-differential-expression](../notes/single-cell-rnaseq/ngs-bulk-rnaseq-differential-expression.md) — Run or plan bulk RNA-seq differential-expression analysis from count matrices with replicate, design formula, contrast, batch, normalization, QC plot, and result-table checks
- [ngs-chip-cutrun-peaks-qc](../notes/single-cell-rnaseq/ngs-chip-cutrun-peaks-qc.md) — Run or plan ChIP-seq, CUT&RUN, or CUT&Tag QC, control handling, spike-in, peak calling, broad-vs-narrow target selection, replicate, bigWig, and differential binding workflows
- [ngs-epigenomics-peaks](../notes/single-cell-rnaseq/ngs-epigenomics-peaks.md) — Dispatch ATAC-seq, ChIP-seq, CUT&RUN, or CUT&Tag requests to assay-specific QC, alignment, signal-track, peak-calling, consensus, and differential peak workflows
- [ngs-scrna-seq](../notes/single-cell-rnaseq/ngs-scrna-seq.md) — Route single-cell or single-nucleus RNA-seq FASTQs to public count-generation workflows and defer post-count matrix QC, annotation, clustering, and UMAP analysis to the embedded...
- [pathway-enricher](../notes/single-cell-rnaseq/pathway-enricher.md) — Gene-set pathway enrichment analysis using Enrichr — queries KEGG, GO (BP/MF/CC), Reactome, WikiPathways, MSigDB, and Disease Ontology
- [pathway-enrichment](../notes/single-cell-rnaseq/pathway-enrichment.md) — Run pathway and gene-set enrichment analysis on gene lists or ranked gene data, then interpret the results
- [pybigwig](../notes/single-cell-rnaseq/pybigwig.md) — Fast Python I/O for BigWig (continuous genome signal) and BigBed (interval annotation) files via libBigWig
- [pydeseq2](../notes/single-cell-rnaseq/pydeseq2.md) — Performs bulk RNA-seq differential expression analysis with PyDESeq2, including count validation, formula designs, explicit contrasts, Wald tests, FDR correction, coefficient-matched...
- [rare-disease-rnaseq](../notes/single-cell-rnaseq/rare-disease-rnaseq.md) — Blood RNA-seq expression-outlier detection for rare-disease diagnostics
- [rnaseq-de](../notes/single-cell-rnaseq/rnaseq-de.md) — Differential expression analysis for bulk RNA-seq and pseudo-bulk count matrices with QC, PCA, and contrast testing
- [scanpy](../notes/single-cell-rnaseq/scanpy.md) — Performs Scanpy single-cell RNA-seq QC, normalization, HVG selection, PCA/UMAP/t-SNE, clustering, exploratory marker ranking, pseudobulk preparation, visualization, and Seurat or...
- [scirpy-immune-repertoire](../notes/single-cell-rnaseq/scirpy-immune-repertoire.md) — Single-cell immune receptor analysis with Scirpy for scanpy, anndata, and scvi-tools projects
- [scrna-embedding](../notes/single-cell-rnaseq/scrna-embedding.md) — Local scVI/scANVI-based single-cell latent embedding and batch-aware integration from raw-count .h5ad or 10x Matrix Market input, with stable integrated AnnData export for downstream...
- [scrna-orchestrator](../notes/single-cell-rnaseq/scrna-orchestrator.md) — Local Scanpy pipeline for single-cell RNA-seq QC, optional doublet detection, clustering, marker discovery, optional CellTypist annotation, optional latent downstream mode from...
- [scrna-preprocessing-clustering](../notes/single-cell-rnaseq/scrna-preprocessing-clustering.md) — Standard scRNA-seq preprocessing and clustering with Scanpy
- [scrna-seq-qc](../notes/single-cell-rnaseq/scrna-seq-qc.md) — Process, quality-control, annotate, and visualize single-cell or single-nucleus RNA-seq datasets across tissues and species
- [scvelo](../notes/single-cell-rnaseq/scvelo.md) — Performs RNA velocity analysis with scVelo from spliced and unspliced single-cell RNA counts
- [scvi-tools](../notes/single-cell-rnaseq/scvi-tools.md) — Fits probabilistic models for single-cell omics, including scVI batch integration, scANVI annotation, totalVI CITE-seq, MultiVI RNA/ATAC integration, and posterior differential...
- [seurat](../notes/single-cell-rnaseq/seurat.md) — Single-cell RNA-seq analysis in R with Seurat v5 — QC, normalization (LogNormalize or SCTransform), dimensionality reduction, clustering, marker detection, integration of multiple...
- [spatialdata-squidpy](../notes/single-cell-rnaseq/spatialdata-squidpy.md) — Spatial omics workflows with SpatialData and Squidpy alongside scanpy, anndata, and napari-viz
