---
title: cutadapt
aliases:
  - FASTQ
  - FASTA
tags:
  - skill
  - domain/sequence-phylogenetics
domain: sequence-phylogenetics
status: untried
source: skills/cutadapt/SKILL.md
created: 2026-07-20
---

# cutadapt

> [!info] What it does
> Adapter, primer, and poly-A/T trimming for high-throughput sequencing reads (FASTQ/FASTA). Use for ATAC-seq (Nextera adapter removal), ChIP-seq/CUT&RUN, small RNA-seq (preserving reads as short as ~18 nt), and amplicon/primer trimming where exact or linked adapter sequences matter more than fastp's heuristic auto-detection. Covers 3'/5'/linked adapters, IUPAC wildcards, paired-end synchronization, quality/length filtering, and demultiplexing by barcode.

**Source:** [skills/cutadapt/SKILL.md](../../../skills/cutadapt/SKILL.md)  ·  **Domain:** [Sequence Analysis, NGS & Phylogenetics](../../maps/sequence-phylogenetics.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [alterlab-qiime2-amplicon](../../notes/sequence-phylogenetics/alterlab-qiime2-amplicon.md) — Runs 16S/ITS amplicon (microbiome) analysis with the QIIME 2 amplicon distribution (2026.1
- [atac-seq](../../notes/single-cell-rnaseq/atac-seq.md) — ATAC-seq processing with assay QC, MACS3 peak calling, consensus peak matrices, differential accessibility, and motif or footprint follow-up
- [chip-seq](../../notes/single-cell-rnaseq/chip-seq.md) — ChIP-seq peak calling and downstream interpretation with MACS3, signal track export, annotation, motif analysis, and differential binding review
- [ngs-amplicon-microbiome](../../notes/sequence-phylogenetics/ngs-amplicon-microbiome.md) — Kick off public 16S, 18S, ITS, COI, or other marker-gene amplicon microbiome workflows using nf-core/ampliseq, QIIME2, DADA2, and Cutadapt
- [ngs-fastq-qc](../../notes/sequence-phylogenetics/ngs-fastq-qc.md) — Validate FASTQ inputs, run local FastQC/MultiQC QC, interpret QC signals, and optionally execute fastp or Cutadapt trimming branches without overwriting raw reads

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
