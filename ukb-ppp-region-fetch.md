---
title: ukb-ppp-region-fetch
tags:
  - skill
  - domain/genomics-variants
source: ukb-ppp-region-fetch/SKILL.md
created: 2026-06-09
---

# ukb-ppp-region-fetch

> [!info] What it does
> Fetch a regional slice of plasma pQTL summary statistics from the UK Biobank Pharma Proteomics Project (UKB-PPP; Sun 2023 Nature) for a specific (protein, ancestry) measurement. Use when an agent needs per-variant beta / SE / p-value around a coloc-lead variant for downstream colocalisation, Mendelian randomisation, or regional plotting against a pQTL exposure. The canonical use case is the cis-window around the protein's coding gene TSS, but UKB-PPP releases full-genome summary stats per protein so any GRCh38 window (including trans loci) is supported when the user supplies an explicit (chromosome, start_bp, end_bp). Input: protein_label (HGNC or UniProt), ancestry, chromosome, start_bp, end_bp. Output: harmonised TSV slice + manifest + human-readable report.

**Source:** [ukb-ppp-region-fetch/SKILL.md](ukb-ppp-region-fetch/SKILL.md)  ·  **Domain:** [Genomics, Variants & Population Genetics](maps/genomics-variants.md)  ·  **Index:** [Skills Index](index.md)

## Related skills

_None auto-detected. Add your own links here, e.g. `[scanpy](scanpy.md)`._

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
