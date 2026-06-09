---
name: pybedtools
description: Python genomic interval arithmetic with BEDTools, complementing pysam, polars, and query for downstream tables. Use when intersecting, merging, subtracting, shuffling, finding closest features, computing coverage, or converting BED, GFF, GTF, VCF, BAM, and pandas DataFrames into interval operations.
---

# pybedtools

Use this skill for genome interval set operations from Python. It wraps BEDTools and is appropriate for ATAC-seq peaks, ChIP-seq peaks, blacklist filtering, enhancer/gene overlap, GWAS locus annotation, VCF region filtering, BAM coverage, and closest-feature queries.

## Setup

`pybedtools` requires both the Python package and the `bedtools` binary.

```bash
conda install -c bioconda bedtools pybedtools
```

Use `pip install pybedtools` only when `bedtools` is already available on `PATH`.

## Common Patterns

```python
import pybedtools

peaks = pybedtools.BedTool("peaks.bed").sort()
genes = pybedtools.BedTool("genes.gtf").sort()

overlap = peaks.intersect(genes, wa=True, wb=True)
merged = peaks.merge()
nearest = peaks.closest(genes, d=True)
coverage = genes.coverage(peaks)
```

DataFrame integration:

```python
bt = pybedtools.BedTool.from_dataframe(df[["chrom", "start", "end", "name"]])
out = bt.intersect("targets.bed", wa=True, wb=True).to_dataframe()
```

## Decision Rules

- Use `pysam` for low-level BAM/VCF reading and writing.
- Use `pybedtools` for set algebra over genomic intervals.
- Use `duckdb` or `polars` for large tabular aggregation after intervals are computed.
- Sort inputs before operations where BEDTools expects sorted data.

## Pitfalls

- BED is 0-based half-open; GFF/GTF/VCF are usually 1-based. Convert deliberately.
- Chromosome naming must match (`chr1` vs `1`).
- Temporary files can accumulate in long sessions; call `pybedtools.cleanup()` when appropriate.
- For reproducible randomization, set genome files and seeds explicitly in shuffle workflows.
