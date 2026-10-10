---
title: phylogenetics
aliases:
  - IQ-TREE
  - MAFFT
tags:
  - skill
  - domain/sequence-phylogenetics
domain: sequence-phylogenetics
status: untried
source: skills/phylogenetics/SKILL.md
created: 2026-06-09
---

# phylogenetics

> [!info] What it does
> Builds and analyzes phylogenetic trees using MAFFT multiple sequence alignment, IQ-TREE maximum likelihood with ModelFinder and branch support, and FastTree approximate inference. Uses ETE3 for tree summaries and visualization. Applies to homologous nucleotide or protein sequences, microbial gene trees, protein families, and cautiously interpreted dated phylogenies.

**Source:** [skills/phylogenetics/SKILL.md](../../../skills/phylogenetics/SKILL.md)  ·  **Domain:** [Sequence Analysis, NGS & Phylogenetics](../../maps/sequence-phylogenetics.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [biopython](../../notes/sequence-phylogenetics/biopython.md) — Provides Biopython workflows for sequence manipulation, file parsing (FASTA/GenBank/PDB), phylogenetics, and programmatic NCBI/PubMed access (Bio.Entrez)
- [sourmash](../../notes/sequence-phylogenetics/sourmash.md) — MinHash/FracMinHash sketching for alignment-free comparison of genomes and metagenomes

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

> [!note] Vault audit 2026-07-24 — USE-8
> Use this as the library/tutorial toolkit for building and analyzing trees with step-by-step control (MAFFT, IQ-TREE 2, FastTree, ETE3); for a single end-to-end command that runs the whole ML pipeline use `phylogenetics-builder`. Toolkit/tutorial vs one-command runner is the distinguishing axis.
