---
name: scirpy-immune-repertoire
description: Single-cell immune receptor analysis with Scirpy for scanpy, anndata, and scvi-tools projects. Use for TCR/BCR V(D)J import, clonotype definition, clonal expansion, repertoire overlap, immune receptor QC, MuData/AnnData integration, and Scanpy-linked immune repertoire visualization.
---

# Scirpy Immune Repertoire

Use this skill for TCR/BCR repertoire analysis in single-cell immune profiling projects. It complements `scanpy`, `anndata`, and `scvi-tools` by adding immune receptor chains, clonotypes, clonal expansion, and repertoire overlap.

## Workflow

1. Load gene expression data with Scanpy.
2. Load V(D)J annotations from 10x or AIRR-like outputs.
3. Merge receptor annotations with expression metadata.
4. Run receptor QC:
   - productive chains
   - chain pairing
   - multichain cells
   - missing receptor calls
5. Define clonotypes using CDR3 sequence, V/J genes, or distance-based criteria.
6. Quantify clonal expansion and repertoire overlap across samples, clusters, tissues, or conditions.
7. Visualize clonotypes on UMAP/spatial embeddings and summarize top clones.

## Common API Shape

```python
import scanpy as sc
import scirpy as ir

adata = sc.read_h5ad("gex.h5ad")
vdj = ir.io.read_10x_vdj("filtered_contig_annotations.csv")
ir.pp.merge_with_ir(adata, vdj)
ir.tl.chain_qc(adata)
ir.tl.define_clonotypes(adata)
ir.tl.clonal_expansion(adata)
```

## Checks

- Keep sample IDs and cell barcodes synchronized before merging.
- Decide whether alpha/beta or heavy/light chain pairing is required for the biological question.
- Do not compare raw clonotype counts across samples without accounting for cell recovery and sampling depth.
- Report clonotype definition criteria; conclusions can change substantially with different rules.
