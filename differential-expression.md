---
title: differential-expression
aliases:
  - differential expression
tags:
  - skill
  - domain/single-cell-rnaseq
domain: single-cell-rnaseq
status: untried
source: differential-expression/SKILL.md
created: 2026-06-17
---

# differential-expression

> [!info] What it does
> Bulk transcriptomics differential expression with count-aware modeling, design validation, contrast handling, thresholded exports, and publication-ready DE figures.

**Source:** [differential-expression/SKILL.md](differential-expression/SKILL.md)  ·  **Domain:** [Single-Cell, RNA-seq & Functional Genomics](maps/single-cell-rnaseq.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [bulk-rnaseq](bulk-rnaseq.md) — End-to-end bulk RNA-seq orchestrator — takes raw FASTQ reads through QC and trimming (FastQC, fastp/Trim Galore), alignment and quantification (STAR, Salmon, featureCounts), assembles...

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

> [!warning] Vault audit 2026-07-24 — DEP-7 / DEP-9 (overlaps `pydeseq2`)
> Overlaps `pydeseq2` and `rnaseq-de` (bulk DESeq2). Prefer `pydeseq2` as canonical. The SKILL.md deprecated `design_factors=[...]` API has been updated in-place to the formulaic `design="~condition"` form (PyDESeq2 0.5.x).
