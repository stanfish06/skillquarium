---
title: literature-review
aliases:
  - systematic review
  - literature review
tags:
  - skill
  - domain/literature-discovery
domain: literature-discovery
status: untried
source: skills/literature-review/SKILL.md
created: 2026-06-09
---

# literature-review

> [!info] What it does
> Conducts systematic, scoping, and narrative literature reviews using PubMed, arXiv, bioRxiv, Semantic Scholar, and other appropriate sources. Use for research synthesis, reproducible literature searches, screening, citation checking, or preparing Markdown and PDF reviews. Tracks search coverage, records versus studies, and evidence limitations; supports meta-analysis planning but does not supply a meta-analysis engine.

**Source:** [skills/literature-review/SKILL.md](../../../skills/literature-review/SKILL.md)  ·  **Domain:** [Literature Search & Knowledge Discovery](../../maps/literature-discovery.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [pdf](../../notes/documents-office/pdf.md) — PDF manipulation toolkit. Extract text/tables, create PDFs, merge/split, fill forms, for programmatic document processing and analysis
- [research](../../notes/software-dev/research.md) — Investigate a question against high-trust primary sources and capture the findings as a Markdown file in the repo

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

> [!warning] Vault audit 2026-07-24 — MNT-6
> `gget search pubmed` / `gget search biorxiv` (SKILL.md ~L97–98, 304, 322) don't exist — `gget search` is Ensembl-gene-only and has no bioRxiv module, so those commands fail. Use the `paper-lookup` skill / NCBI Entrez / the bioRxiv API for literature search instead.
> _Remote-managed skill — the durable fix belongs upstream; this wrapper note is the local record._
