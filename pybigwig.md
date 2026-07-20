---
title: pybigwig
tags:
  - skill
  - domain/single-cell-rnaseq
domain: single-cell-rnaseq
status: untried
source: pybigwig/SKILL.md
created: 2026-07-20
---

# pybigwig

> [!info] What it does
> Fast Python I/O for BigWig (continuous genome signal) and BigBed (interval annotation) files via libBigWig. Use for random-access signal queries at specific genomic coordinates (bw.values, bw.stats), computing per-region summary statistics (mean/max/coverage) over a BED file of regions, writing custom BigWig tracks from numpy arrays, and loading ChIP-seq/ATAC-seq/RNA-seq/methylation coverage tracks (e.g. produced by deeptools bamCoverage) into pandas/numpy for downstream analysis or ML feature extraction. Complements deeptools (which generates BigWig files) and chip-seq/atac-seq workflows.

**Source:** [pybigwig/SKILL.md](pybigwig/SKILL.md)  ·  **Domain:** [Single-Cell, RNA-seq & Functional Genomics](maps/single-cell-rnaseq.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [atac-seq](atac-seq.md) — ATAC-seq processing with assay QC, MACS3 peak calling, consensus peak matrices, differential accessibility, and motif or footprint follow-up
- [chip-seq](chip-seq.md) — ChIP-seq peak calling and downstream interpretation with MACS3, signal track export, annotation, motif analysis, and differential binding review
- [deeptools](deeptools.md) — NGS analysis toolkit. BAM to bigWig conversion, QC (correlation, PCA, fingerprints), heatmaps/profiles (TSS, peaks), for ChIP-seq, RNA-seq, ATAC-seq visualization

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

