---
title: etetoolkit
aliases:
  - ETE
tags:
  - skill
  - domain/sequence-phylogenetics
domain: sequence-phylogenetics
status: untried
source: etetoolkit/SKILL.md
created: 2026-06-09
---

# etetoolkit

> [!info] What it does
> Phylogenetic tree toolkit (ETE). Tree manipulation (Newick/NHX), evolutionary event detection, orthology/paralogy, NCBI taxonomy, visualization (PDF/SVG), for phylogenomics.

**Source:** [etetoolkit/SKILL.md](etetoolkit/SKILL.md)  ·  **Domain:** [Sequence Analysis, NGS & Phylogenetics](maps/sequence-phylogenetics.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [pdf](pdf.md) — PDF manipulation toolkit. Extract text/tables, create PDFs, merge/split, fill forms, for programmatic document processing and analysis

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

> [!warning] Vault audit 2026-07-24 — DEP-11 (deprecated)
> Built entirely on the dead `ete3` package (last release May 2023); every example uses `from ete3 import Tree`. Migrate to the maintained successor `ete4` (incompatible API — different traversal/rendering).
> _Remote-managed skill — the durable fix belongs upstream; this wrapper note is the local record._
