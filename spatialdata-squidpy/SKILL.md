---
name: spatialdata-squidpy
description: Spatial omics workflows with SpatialData and Squidpy alongside scanpy, anndata, and napari-viz. Use when working with Visium, Xenium, CosMx, MERFISH, Slide-seq, spatial transcriptomics, spatial proteomics, tissue images linked to AnnData, spatial neighbor graphs, spatial autocorrelation, ligand-receptor proximity, image features, or napari-spatialdata.
---

# SpatialData + Squidpy

Use this skill for spatial omics analysis in the scverse ecosystem. Prefer it when a task combines expression matrices, spatial coordinates, segmentation labels, microscopy/pathology images, or platform-specific outputs from 10x Visium/Xenium, NanoString CosMx, Vizgen MERFISH, Slide-seq, or related assays.

## Routing

- Use `scanpy` for ordinary scRNA-seq preprocessing and clustering.
- Use `anndata` when the main issue is object structure, layers, backed mode, or h5ad I/O.
- Use this skill when spatial coordinates, images, regions, or spatial statistics matter.
- Use `napari-viz` for headless rendering/inspection of microscopy volumes or labels.

## Core Workflow

1. Identify the data model first:
   - `AnnData` with `.obsm["spatial"]` and `.uns["spatial"]` for classic Squidpy/Visium-style workflows.
   - `SpatialData` for multi-table, multi-region, image-plus-shapes projects.
2. Preserve raw coordinates and platform metadata before filtering.
3. Run normal single-cell or spot-level preprocessing with Scanpy:
   - QC, normalization, HVGs, PCA, neighbors, UMAP, clustering.
4. Build spatial neighborhoods with Squidpy:
   - `sq.gr.spatial_neighbors(adata, coord_type=...)`
   - Use grid-like coordinates for Visium-style spots; generic coordinates for cell-resolved platforms.
5. Compute spatial statistics:
   - Moran's I / Geary's C: `sq.gr.spatial_autocorr(...)`
   - Co-occurrence: `sq.gr.co_occurrence(...)`
   - Neighborhood enrichment: `sq.gr.nhood_enrichment(...)`
   - Ligand-receptor spatial proximity when cell labels and expression are reliable.
6. Integrate images only after confirming scale, coordinate orientation, and crop bounds.
7. Export both analysis objects and interpretable figures:
   - `.h5ad` or SpatialData Zarr for data.
   - Spatial scatter plots, image overlays, and ranked spatial-feature tables.

## Quality Checks

- Confirm whether coordinates are pixels, microns, array indices, or platform-specific units.
- Check image origin and axis orientation before overlaying labels or points.
- Keep tissue masks and segmentation labels versioned; most downstream errors come from silent coordinate or mask mismatch.
- Stratify spatial statistics by sample/slide; do not pool slides unless batch and geometry are comparable.
- Report neighborhood graph parameters because they strongly affect spatial-enrichment calls.
