---
title: wgs-prs
aliases:
  - wgs prs
tags:
  - skill
  - domain/genomics-variants
domain: genomics-variants
status: untried
source: wgs-prs/SKILL.md
created: 2026-06-09
---

# wgs-prs

> [!info] What it does
> End-to-end WGS to polygenic risk score pipeline. Takes paired-end FASTQ files (or a pre-existing VCF) through nf-core/sarek for variant calling, applies VCF QC (normalisation, hard filtering, Ti/Tv and Het/Hom checks), then computes polygenic risk scores via the PGS Catalog. Fills the FASTQ to VCF gap upstream of the gwas-prs skill.

**Source:** [wgs-prs/SKILL.md](wgs-prs/SKILL.md)  ·  **Domain:** [Genomics, Variants & Population Genetics](maps/genomics-variants.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [gwas-prs](gwas-prs.md) — Calculate polygenic risk scores from DTC genetic data using the PGS Catalog

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
