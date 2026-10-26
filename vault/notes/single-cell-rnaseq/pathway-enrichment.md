---
title: pathway-enrichment
aliases:
  - pathway enrichment
tags:
  - skill
  - domain/single-cell-rnaseq
domain: single-cell-rnaseq
status: untried
source: skills/pathway-enrichment/SKILL.md
created: 2026-06-09
---

# pathway-enrichment

> [!info] What it does
> Run pathway and gene-set enrichment analysis on gene lists or ranked gene data, then interpret the results. Use whenever the user has a set of genes (differentially expressed genes from PyDESeq2/Scanpy, CRISPR-screen hits, cluster marker genes, proteomics hits) and wants to know which biological pathways, GO terms, or gene sets are over-represented or enriched. Covers over-representation analysis (ORA / Enrichr / Fisher / hypergeometric), ranked Gene Set Enrichment Analysis (GSEA / preranked), single-sample scoring (ssGSEA/GSVA), and functional profiling via gseapy, g:Profiler, Enrichr libraries, MSigDB, GO, KEGG, Reactome, and WikiPathways — plus gene-ID mapping, choosing the right background universe, multiple-testing correction, redundancy reduction, dotplots/enrichment maps, and publication-ready tables. Use this for "pathway analysis", "enrichment analysis", "GO enrichment", "KEGG/Reactome pathways", "GSEA", "over-representation", "functional annotation", or "what pathways are my genes in".

**Source:** [skills/pathway-enrichment/SKILL.md](../../../skills/pathway-enrichment/SKILL.md)  ·  **Domain:** [Single-Cell, RNA-seq & Functional Genomics](../../maps/single-cell-rnaseq.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [bulk-rnaseq](../../notes/single-cell-rnaseq/bulk-rnaseq.md) — End-to-end bulk RNA-seq orchestrator — takes raw FASTQ reads through QC and trimming (FastQC, fastp/Trim Galore), alignment and quantification (STAR, Salmon, featureCounts), assembles...
- [proteomics](../../notes/proteomics-metabolomics/proteomics.md) — Mass spectrometry proteomics QC, quantification, comparative analysis, and export for DDA, DIA, and protein-level result tables
- [pydeseq2](../../notes/single-cell-rnaseq/pydeseq2.md) — Performs bulk RNA-seq differential expression analysis with PyDESeq2, including count validation, formula designs, explicit contrasts, Wald tests, FDR correction, coefficient-matched...
- [scanpy](../../notes/single-cell-rnaseq/scanpy.md) — Performs Scanpy single-cell RNA-seq QC, normalization, HVG selection, PCA/UMAP/t-SNE, clustering, exploratory marker ranking, pseudobulk preparation, visualization, and Seurat or...

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

> [!info] Vault audit 2026-07-24 — DEP-8 (canonical)
> Canonical pathway / gene-set enrichment skill (v1.0: ORA + GSEA + preranked + ssGSEA/GSVA). Supersedes `pathway-enricher` (Enrichr-only ORA, v0.1.0).
