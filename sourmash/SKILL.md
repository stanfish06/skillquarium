---
name: sourmash
description: MinHash/FracMinHash sketching for alignment-free comparison of genomes and metagenomes. Use for fast all-vs-all genome similarity and ANI estimation across thousands of genomes without alignment, taxonomic classification of metagenomes against GTDB/NCBI reference databases (sourmash gather/tax), and sequencing-cohort QC (contamination or duplicate detection). Complements upstream assembly/QC pipelines (snakemake-workflow-engine, nextflow) and feeds downstream phylogenetics; distinct from alignment-based tools like BLAST or mash-style exact-num MinHash by supporting scaled (FracMinHash) sketches that compare well across very different dataset sizes.
license: BSD-3-Clause
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
compatibility: Requires Python 3.11+ and sourmash 4.x (current 4.9.4). The core is a Rust extension distributed as prebuilt wheels via pip/conda; building from source requires a Rust toolchain. sourmash itself is single-threaded — for parallel/faster search-at-scale, pair it with the separate `sourmash_plugin_branchwater` plugin (`pip install sourmash_plugin_branchwater`).
metadata: {"version": "1.0", "skill-author": "community"}
---

# sourmash

## Overview

sourmash computes **FracMinHash sketches** — a scaled generalization of MinHash — from DNA, RNA, or protein sequences, then compares those sketches instead of the raw sequences. Because sketches are tiny relative to the underlying sequence, sourmash can do in seconds what alignment-based comparison would take hours or days to do: all-vs-all genome distance across thousands of genomes, alignment-free ANI (average nucleotide identity) estimation, and combinatorial metagenome decomposition against a reference database (`sourmash gather`).

Unlike classic (fixed-size, `--num`) MinHash such as `mash`, sourmash's default **scaled** sketches (`--scaled`) let you meaningfully compare a small genome against a huge metagenome, or datasets sketched at different times, because the fraction of k-mers retained is fixed rather than the sketch size — this is the core reason to reach for sourmash over `mash` when dataset sizes vary widely.

## Installation

```bash
# Recommended (handles the Rust extension + native deps cleanly)
conda create -n sourmash_env -c conda-forge sourmash-minimal
conda activate sourmash_env

# pip alternative
uv pip install sourmash

# Optional: faster parallel search/sketching at scale
uv pip install sourmash_plugin_branchwater
```

Check version: `sourmash --version` (targets the 4.9.x series).

## When to Use

- Deciding which reference genome(s) to use for read mapping, by sketching candidate references and your sample and comparing containment.
- Clustering hundreds/thousands of genomes by similarity without a multiple-sequence alignment.
- Taxonomically classifying a metagenome against GTDB or NCBI without assembly (`sourmash gather` + `sourmash tax`).
- QC-ing a sequencing cohort for cross-sample contamination or accidental duplicate submissions.
- Searching a query against the public Sequence Read Archive's precomputed sketch database (branchwater/sourmash's SRA search).

Not a fit for base-pair-resolution comparisons (SNP calling, exact breakpoints) — sourmash is a fast *triage/search* layer; follow up with alignment-based tools once candidates are narrowed down.

## Core Concepts

- **Sketch / signature (`.sig`, `.sig.zip`)**: a compressed set of hashed k-mers representing a sequence or sample, tagged with its k-mer size(s) and scaling factor.
- **`k` (k-mer size)**: shorter k (e.g., 21) is more sensitive/less specific (good for species-level comparison); longer k (e.g., 31, 51) is more specific (good for strain-level). Sketches with different `k` cannot be compared to each other.
- **`--scaled N`**: keep roughly 1/N of all k-mer hashes (default sourmash mode). Two sketches must share the same `scaled` value to be compared directly (sourmash will downsample the finer one automatically when needed via `compare`/`gather`, but explicit control avoids surprises).
- **Containment vs. Jaccard**: Jaccard similarity penalizes size differences between two sequences; **containment** ("how much of A is inside B") is usually the right metric when comparing a small genome against a large metagenome.

## Quick Start: Sketching and Comparing

```bash
# Sketch every genome/read file in a directory (one .sig per input)
sourmash sketch dna -p k=31,scaled=1000 *.fa.gz

# All-vs-all comparison of a set of signatures
sourmash compare *.sig -o distances.cmp -k 31

# Visualize as a clustered heatmap/dendrogram
sourmash plot distances.cmp
```

`sourmash sketch dna` is for nucleotide input; use `sourmash sketch protein` for protein FASTA and `sourmash sketch translate` to six-frame-translate nucleotide reads into protein k-mer space (useful for viral/divergent-sequence search).

## Genome Comparison and ANI

```bash
sourmash compare genome1.sig genome2.sig --estimate-ani -o ani_results.csv
```

`--estimate-ani` converts the Jaccard/containment estimate into an average nucleotide identity figure with confidence intervals — this is the standard alignment-free ANI workflow (comparable in spirit to fastANI, but derived from the same sketches you already built for search/clustering).

## Metagenome Classification

```bash
# Build (or download) a reference database of genome signatures, e.g. GTDB
sourmash gather metagenome.sig gtdb-rs214-k31.zip -o gather_results.csv

# Assign taxonomy using gather results + a taxonomy lineage file
sourmash tax metagenome -g gather_results.csv -t gtdb-rs214-taxonomy.csv -o taxonomy_summary
```

`sourmash gather` does *combinatorial* decomposition: it finds the minimal set of reference genomes that explains the metagenome's k-mer content (greedy containment-based), which is more accurate for mixed-community samples than naively reporting the single best match per k-mer.

## Building and Searching a Database

```bash
sourmash sketch dna -p k=31,scaled=1000 reference_genomes/*.fa.gz
sourmash index my_database.sbt.zip *.sig     # build a searchable index (SBT or, more commonly now, a zip manifest)

sourmash search query.sig my_database.sbt.zip -o search_results.csv --containment
```

Precomputed reference databases (GTDB genomes, RefSeq, NCBI viral genomes) are published on https://sourmash.readthedocs.io/en/latest/databases.html — download the matching `k` value for your sketches rather than re-sketching millions of genomes yourself.

## Sequencing-Cohort QC Pattern

```bash
sourmash sketch dna -p k=31,scaled=1000 sample*.fq.gz
sourmash compare sample*.sig -o cohort_distances.cmp --csv cohort_distances.csv
```

Near-identical distances between supposedly independent samples flag cross-contamination or accidental resubmission; this is far cheaper than a full alignment-based cross-check across a large cohort.

## Scaling Up: branchwater

Base sourmash runs single-threaded. For large-scale search (many query genomes against huge databases, or SRA-scale metagenome search), install `sourmash_plugin_branchwater`, which adds Rust-parallelized commands (`sourmash scripts fastgather`, `fastmultigather`, `manysketch`) that are drop-in-compatible with sourmash's `.sig`/database formats.

## Common Pitfalls

- **Comparing sketches with different `k` or `scaled` values.** sourmash will refuse or silently give a meaningless answer; keep a consistent `k`/`scaled` policy across a project (commonly `k=21,31,51` sketched together via `-p k=21,k=31,k=51,scaled=1000`, so you can pick the right specificity later without re-sketching).
- **Using `--num` (fixed-size, mash-style) sketches then comparing against `--scaled` sketches, or against datasets of very different sizes.** This is the exact failure mode scaled sketching was designed to avoid — default to `--scaled` unless you specifically need mash-compatible fixed-size sketches.
- **Jaccard similarity on very different-sized inputs.** A small genome will show a spuriously low Jaccard similarity against a large metagenome even if fully contained; use `--containment` (or `--estimate-ani`, which is containment-based) instead.
- **Re-sketching public reference genomes from scratch.** This is slow and error-prone at scale (GTDB alone is 100k+ genomes) — download the prebuilt signature databases instead.
- **Assuming multi-threading.** Base `sourmash compare`/`gather` is single-core; large all-vs-all jobs that seem to hang are often just CPU-bound on one core — switch to the branchwater plugin rather than assuming a bug.

## Resources

- Docs: https://sourmash.readthedocs.io/
- Databases: https://sourmash.readthedocs.io/en/latest/databases.html
- Source: https://github.com/sourmash-bio/sourmash
- branchwater plugin: https://github.com/sourmash-bio/sourmash_plugin_branchwater
- Citation: sourmash is published on JOSS, DOI: 10.21105/joss.06830
