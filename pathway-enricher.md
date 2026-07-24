---
title: pathway-enricher
aliases:
  - pathway enricher
  - BP
  - MF
  - CC
tags:
  - skill
  - domain/single-cell-rnaseq
domain: single-cell-rnaseq
status: untried
source: pathway-enricher/SKILL.md
created: 2026-06-09
---

# pathway-enricher

> [!info] What it does
> Gene-set pathway enrichment analysis using Enrichr — queries KEGG, GO (BP/MF/CC), Reactome, WikiPathways, MSigDB, and Disease Ontology. Produces ranked pathway tables, interactive bubble charts, and a reproducible Markdown report.

**Source:** [pathway-enricher/SKILL.md](pathway-enricher/SKILL.md)  ·  **Domain:** [Single-Cell, RNA-seq & Functional Genomics](maps/single-cell-rnaseq.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

_None auto-detected. Add your own links here, e.g. `[scanpy](scanpy.md)`._

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

> [!warning] Vault audit 2026-07-24 — DEP-8 (superseded → `pathway-enrichment`)
> Enrichr-only ORA (v0.1.0) superseded by `pathway-enrichment` (v1.0: ORA + GSEA + preranked + ssGSEA/GSVA, with background handling). Prefer `pathway-enrichment`. Kept for its bubble-chart / report-bundle output (`pathway_enricher.py`) until that is folded into `pathway-enrichment`.
