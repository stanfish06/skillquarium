---
title: pydeseq2
aliases:
  - DESeq2
tags:
  - skill
  - domain/single-cell-rnaseq
domain: single-cell-rnaseq
status: untried
source: skills/pydeseq2/SKILL.md
created: 2026-06-09
---

# pydeseq2

> [!info] What it does
> Performs bulk RNA-seq differential expression analysis with PyDESeq2, including count validation, formula designs, explicit contrasts, Wald tests, FDR correction, coefficient-matched LFC shrinkage, and result visualization. Use for PyDESeq2 or Python DESeq2 workflows with biological replicates.

**Source:** [skills/pydeseq2/SKILL.md](../../../skills/pydeseq2/SKILL.md)  ·  **Domain:** [Single-Cell, RNA-seq & Functional Genomics](../../maps/single-cell-rnaseq.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [bulk-rnaseq](../../notes/single-cell-rnaseq/bulk-rnaseq.md) — End-to-end bulk RNA-seq orchestrator — takes raw FASTQ reads through QC and trimming (FastQC, fastp/Trim Galore), alignment and quantification (STAR, Salmon, featureCounts), assembles...
- [pathway-enrichment](../../notes/single-cell-rnaseq/pathway-enrichment.md) — Run pathway and gene-set enrichment analysis on gene lists or ranked gene data, then interpret the results
- [validation](../../notes/software-dev/validation.md) — Use when Codex is already in the validation phase of a security scan or the user explicitly asks to determine whether one or more candidate security findings are valid

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

> [!info] Vault audit 2026-07-24 — DEP-9 (canonical bulk DE)
> Canonical bulk/pseudo-bulk DESeq2 differential-expression skill. `rnaseq-de` and `differential-expression` overlap heavily — prefer `pydeseq2` for the DE step. (All three now use the PyDESeq2 0.5.x formulaic `design="~..."` API.)
