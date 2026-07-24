---
title: pydeseq2
aliases:
  - DESeq2
tags:
  - skill
  - domain/single-cell-rnaseq
domain: single-cell-rnaseq
status: untried
source: pydeseq2/SKILL.md
created: 2026-06-09
---

# pydeseq2

> [!info] What it does
> Differential gene expression analysis for bulk RNA-seq with PyDESeq2, including formulaic designs, Wald tests, FDR correction, LFC shrinkage, and result visualization.

**Source:** [pydeseq2/SKILL.md](pydeseq2/SKILL.md)  ·  **Domain:** [Single-Cell, RNA-seq & Functional Genomics](maps/single-cell-rnaseq.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [bulk-rnaseq](bulk-rnaseq.md) — End-to-end bulk RNA-seq orchestrator — takes raw FASTQ reads through QC and trimming (FastQC, fastp/Trim Galore), alignment and quantification (STAR, Salmon, featureCounts), assembles...
- [pathway-enrichment](pathway-enrichment.md) — Run pathway and gene-set enrichment analysis on gene lists or ranked gene data, then interpret the results

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

> [!info] Vault audit 2026-07-24 — DEP-9 (canonical bulk DE)
> Canonical bulk/pseudo-bulk DESeq2 differential-expression skill. `rnaseq-de` and `differential-expression` overlap heavily — prefer `pydeseq2` for the DE step. (All three now use the PyDESeq2 0.5.x formulaic `design="~..."` API.)
