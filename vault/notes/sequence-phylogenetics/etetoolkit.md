---
title: etetoolkit
aliases:
  - ETE
tags:
  - skill
  - domain/sequence-phylogenetics
domain: sequence-phylogenetics
status: untried
source: skills/etetoolkit/SKILL.md
created: 2026-06-09
---

# etetoolkit

> [!info] What it does
> Analyzes, manipulates, compares, annotates, and visualizes phylogenetic or other hierarchical trees with ETE 4. Supports Newick/Nexus tree I/O, topology edits and pattern matching, Robinson-Foulds comparisons, gene-tree evolutionary events and reconciliation, NCBI/GTDB taxonomy, SmartView exploration, and publication rendering. Applies to existing trees after alignment and phylogenetic inference, rather than inferring trees from raw sequences.

**Source:** [skills/etetoolkit/SKILL.md](../../../skills/etetoolkit/SKILL.md)  ·  **Domain:** [Sequence Analysis, NGS & Phylogenetics](../../maps/sequence-phylogenetics.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

_None auto-detected. Add your own links here, e.g. `[[scanpy]]`._

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

> [!warning] Vault audit 2026-07-24 — DEP-11 (deprecated)
> Built entirely on the dead `ete3` package (last release May 2023); every example uses `from ete3 import Tree`. Migrate to the maintained successor `ete4` (incompatible API — different traversal/rendering).
> _Remote-managed skill — the durable fix belongs upstream; this wrapper note is the local record._
