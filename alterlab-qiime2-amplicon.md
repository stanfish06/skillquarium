---
title: alterlab-qiime2-amplicon
aliases:
  - alterlab qiime2 amplicon
tags:
  - skill
  - domain/sequence-phylogenetics
domain: sequence-phylogenetics
status: untried
source: alterlab-qiime2-amplicon/SKILL.md
created: 2026-07-09
---

# alterlab-qiime2-amplicon

> [!info] What it does
> Runs 16S/ITS amplicon (microbiome) analysis with the QIIME 2 amplicon distribution (2026.1; renamed to "qiime2" in 2026.4) in the correct order: manifest import, cutadapt trim-paired primer removal BEFORE dada2 denoise-paired (trunc-len chosen from the demux quality .qzv), feature-classifier classify-sklearn against a version-matched SILVA 138 or Greengenes2 classifier, and diversity core-metrics-phylogenetic — teaching the .qza/.qzv artifact-and-provenance model and the 2026.1 feature-table summarize change (the former summarize_plus). Use when the request mentions QIIME2, QIIME 2, qiime, 16S, 18S, ITS, amplicon, microbiome, ASV, DADA2 denoising, feature table, taxonomic classification, or core-metrics diversity. For downstream alpha/beta diversity, PCoA, and PERMANOVA on the exported feature table prefer alterlab-scikit-bio; this is conda-only (no pip install). Part of the AlterLab Academic Skills suite.

**Source:** [alterlab-qiime2-amplicon/SKILL.md](alterlab-qiime2-amplicon/SKILL.md)  ·  **Domain:** [Sequence Analysis, NGS & Phylogenetics](maps/sequence-phylogenetics.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [cutadapt](cutadapt.md) — Adapter, primer, and poly-A/T trimming for high-throughput sequencing reads (FASTQ/FASTA)

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

