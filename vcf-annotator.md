---
title: vcf-annotator
aliases:
  - VEP
  - vcf annotator
tags:
  - skill
  - domain/genomics-variants
domain: genomics-variants
status: untried
source: vcf-annotator/SKILL.md
created: 2026-06-09
---

# vcf-annotator

> [!info] What it does
> Annotate VCF variants with Ensembl VEP, ClinVar, and gnomAD. Ranks variants by impact (HIGH/MODERATE/LOW/MODIFIER) and generates a reproducible report.

**Source:** [vcf-annotator/SKILL.md](vcf-annotator/SKILL.md)  ·  **Domain:** [Genomics, Variants & Population Genetics](maps/genomics-variants.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

_None auto-detected. Add your own links here, e.g. `[scanpy](scanpy.md)`._

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

> [!warning] Vault audit 2026-07-24 — DEP-5 (deprecated → `variant-annotation`)
> Near-total duplicate of `variant-annotation` (same VEP/ClinVar/gnomAD annotator) and the inferior implementation. Use `variant-annotation` — the canonical partner of `clinical-variant-reporter`. NOT deleted: `vcf-annotator` is still cross-referenced by ~8 other skills' SKILL.md, so clean removal needs a coordinated reference sweep first.
