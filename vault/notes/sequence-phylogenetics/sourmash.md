---
title: sourmash
tags:
  - skill
  - domain/sequence-phylogenetics
domain: sequence-phylogenetics
status: untried
source: skills/sourmash/SKILL.md
created: 2026-07-20
---

# sourmash

> [!info] What it does
> MinHash/FracMinHash sketching for alignment-free comparison of genomes and metagenomes. Use for fast all-vs-all genome similarity and ANI estimation across thousands of genomes without alignment, taxonomic classification of metagenomes against GTDB/NCBI reference databases (sourmash gather/tax), and sequencing-cohort QC (contamination or duplicate detection). Complements upstream assembly/QC pipelines (snakemake-workflow-engine, nextflow) and feeds downstream phylogenetics; distinct from alignment-based tools like BLAST or mash-style exact-num MinHash by supporting scaled (FracMinHash) sketches that compare well across very different dataset sizes.

**Source:** [skills/sourmash/SKILL.md](../../../skills/sourmash/SKILL.md)  ·  **Domain:** [Sequence Analysis, NGS & Phylogenetics](../../maps/sequence-phylogenetics.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [nextflow](../../notes/cloud-devops/nextflow.md) — Build, run, and debug Nextflow data pipelines and nf-core workflows end to end
- [phylogenetics](../../notes/sequence-phylogenetics/phylogenetics.md) — Build and analyze phylogenetic trees using MAFFT (multiple alignment), IQ-TREE 2 (maximum likelihood), and FastTree (fast NJ/ML)
- [snakemake-workflow-engine](../../notes/cloud-devops/snakemake-workflow-engine.md) — Python-based workflow manager for reproducible, scalable pipelines

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
