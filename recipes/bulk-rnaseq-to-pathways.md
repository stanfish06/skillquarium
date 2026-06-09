---
title: Bulk RNA-seq → pathways
tags:
  - recipe
  - domain/single-cell-rnaseq
created: 2026-06-09
---

# Bulk RNA-seq → pathways

> [!abstract] Goal
> Take raw bulk RNA-seq reads through QC and quantification to differentially expressed genes, enriched pathways, and a publication-ready figure.

[Back to Recipes](index.md)  ·  [Skill Index](../index.md)

## Pipeline

```mermaid
flowchart LR
  A[FASTQ reads] --> B[QC + align + quantify] --> C[Counts matrix] --> D[Differential expression] --> E[Pathway enrichment] --> F[Figure]
```

## Steps

1. **[bulk-rnaseq](../bulk-rnaseq.md)** — orchestrate FASTQ → counts (QC, trimming, alignment, quantification). Alternative: **[nfcore-rnaseq-wrapper](../nfcore-rnaseq-wrapper.md)**.
2. **[pydeseq2](../pydeseq2.md)** — differential expression on the counts matrix. Alternative: **[rnaseq-de](../rnaseq-de.md)**.
3. **[pathway-enrichment](../pathway-enrichment.md)** — GSEA / over-representation on the DE gene list. Alternative: **[pathway-enricher](../pathway-enricher.md)**.
4. **[scientific-visualization](../scientific-visualization.md)** — volcano / heatmap / enrichment figures. Alternative: **[diff-visualizer](../diff-visualizer.md)**.

## Add-ons

- **[multiqc-reporter](../multiqc-reporter.md)** — aggregate QC across samples.
- **[de-summary](../de-summary.md)** — narrative summary of the DE results.
