---
title: rnaseq-de
aliases:
  - DESeq2
  - edgeR
  - rnaseq de
tags:
  - skill
  - domain/single-cell-rnaseq
domain: single-cell-rnaseq
status: untried
source: rnaseq-de/SKILL.md
created: 2026-06-09
---

# rnaseq-de

> [!info] What it does
> Differential expression analysis for bulk RNA-seq and pseudo-bulk count matrices with QC, PCA, and contrast testing.

**Source:** [rnaseq-de/SKILL.md](rnaseq-de/SKILL.md)  ·  **Domain:** [Single-Cell, RNA-seq & Functional Genomics](maps/single-cell-rnaseq.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

_None auto-detected. Add your own links here, e.g. `[scanpy](scanpy.md)`._

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

> [!warning] Vault audit 2026-07-24 — DEP-9 (overlaps `pydeseq2`)
> Overlaps heavily with `pydeseq2` and `differential-expression` (all do bulk/pseudo-bulk DESeq2). Prefer `pydeseq2` as the canonical DE step; use this skill only for its orchestration around that step. Kept (not deleted) because `pydeseq2` is remote-managed and its unique pipeline content can't be folded upstream.
