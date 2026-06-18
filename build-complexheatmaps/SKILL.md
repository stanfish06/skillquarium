---
name: build-complexheatmaps
description: Build, debug, and polish ComplexHeatmap figures in R, including HeatmapList sizing, unequal-row multi-panel layouts, row and column annotations, anno_mark labels, shared legends, title decoration, spacing, and vector or raster export. Use when creating or fixing ComplexHeatmap heatmaps, especially publication figures with multiple matrices, variable row counts, annotated genes, or compressed panels.
---

# Build ComplexHeatmaps

## Overview

Create source-grounded ComplexHeatmap figures whose data semantics, panel geometry, annotations, legends, and exported dimensions remain correct. Diagnose layout problems from the package's row model and grid viewport behavior before tuning cosmetic parameters.

## Start With The Contract

Before editing code, identify and preserve:

- input objects and the unit of each row and column
- filters, thresholds, sorting, split order, and maximum-row rules
- labels, titles, sample counts, and statistical terminology
- global versus panel-specific color scales
- required output formats and final physical dimensions

Do not silently change these decisions while fixing layout. If the user says values are tuned, treat them as locked.

Check the runtime before promising a render:

```bash
command -v Rscript || command -v R
```

If R is unavailable, edit and inspect R code but state that the figure was not rendered. Do not replace the R workflow with a Python approximation.

## Ground The API In Source

Inspect the installed or fetched ComplexHeatmap version when behavior is unfamiliar. Prefer the source matching `packageVersion("ComplexHeatmap")`; otherwise state that the checked source may differ.

```bash
src="$(opensrc path jokergoo/ComplexHeatmap)"
rg -n "nrow.*all heatmaps|anno_mark =|GLOBAL_PADDING|decorate_column_title|packLegend" "$src/R"
```

Use [references/layout-and-annotations.md](references/layout-and-annotations.md) for the relevant source files, failure modes, and implementation patterns.

## Choose The Layout Architecture

Make this decision before styling:

| Data relationship | Architecture |
| --- | --- |
| Matrices share the same rows in the same order | One horizontal `HeatmapList` |
| Per-panel matrices have different filtered rows or row counts | Independent `HeatmapList` panels in `grid` viewports |
| A title spans several heatmaps inside one panel | An outer title viewport, or a deliberately reserved title viewport plus decoration |
| All panels share scales | Standalone legends in a dedicated outer layout column |

ComplexHeatmap rejects a horizontal list whose heatmaps and row annotations have different observation counts. Do not pad independently ranked gene lists merely to satisfy this constraint: padding invents row correspondence. Render them independently instead.

## Build In This Order

1. Prepare each panel's data independently.
   Filter, sort, cap rows, and form split factors before constructing any `Heatmap` object. Preserve metadata needed for titles before filtering.

2. Define scales once.
   Use shared color functions when cross-panel comparison is intended. Use panel-local scales only when explicitly requested and label them accordingly.

3. Construct one panel at a time.
   Give every heatmap a unique internal `name`. Disable clustering when row order is meaningful. Set split order explicitly with a factor.

4. Add annotations with matching observations.
   Build each row annotation from that panel's final row order. For `anno_mark()` used as a row annotation, always set `which = "row"` explicitly.

5. Assemble the outer grid.
   Use null units for flexible panel bodies, measured text widths for annotation columns, explicit gaps, and a dedicated legend column. Vary panel viewport height only when row counts should be represented by height.

6. Draw directly on the target device.
   `anno_mark()` depends on physical device dimensions. Use a reusable render function and call it separately for SVG, PDF, and raster output rather than relying on the RStudio Zoom or Export pane.

7. Inspect the actual export.
   Check clipping, panel widths, label legibility, legend placement, and final-size typography. Read [references/export-and-qa.md](references/export-and-qa.md) before final delivery.

## Core Construction Rules

Use these defaults unless the figure requires otherwise:

```r
Heatmap(
  mat,
  name = unique_name,
  width = unit(1, "null"),
  cluster_rows = FALSE,
  cluster_columns = FALSE,
  column_names_centered = TRUE,
  column_names_rot = 45,
  row_split = factor(direction, levels = c("Up", "Down")),
  cluster_row_slices = FALSE,
  row_gap = unit(0.8, "mm"),
  border_gp = gpar(col = "grey45", lwd = 0.5),
  show_heatmap_legend = FALSE
)
```

Keep plot typography and marked-label typography as separate parameters. `anno_mark(labels_gp = ...)` accepts vectorized graphical parameters, so emphasized labels can be colored without changing the heatmap data.

Reserve only measured annotation space. `anno_mark()` computes row width from `link_width + max_text_width(labels)`. Large hard-coded annotation widths create apparent gaps between panels.

Treat titles, annotations, and legends as layout components:

- unique heatmap names are required for reliable viewport decoration
- `column_names_centered = TRUE` centers individual column labels, not a title spanning multiple heatmaps
- multiline titles require deliberate vertical space; increasing device height alone does not reserve it
- automatic legends attached to one panel can compress that panel; use `Legend()` and `packLegend()` in a separate column for multi-panel figures
- `draw()` has nonzero default padding; reduce it deliberately when the outer layout already supplies margins

## Diagnose Before Tuning

Map symptoms to structural causes:

- `anno_mark` says it is being used as a row annotation: set `which = "row"`.
- A horizontal list reports unequal `nrow` or `nobs`: use independent panels or restore genuine row alignment.
- The last panel is narrower: move legends out of that panel and give all panel bodies equivalent null widths.
- Large gaps remain: inspect outer grid gaps, `draw(padding = ...)`, annotation widths, and title or row-title reservations.
- A cell-type title is off-center: center it in the enclosing panel viewport, not one component heatmap.
- A title is clipped: reserve a title row or multiline title viewport before drawing it.
- Labels move between preview and export: draw directly on a device with the final dimensions.
- Repeated viewport or decoration failures: assign unique internal heatmap names.

Do not solve structural problems by repeatedly increasing canvas size. Determine which component owns the unwanted width or height.

## Final Response

Report which files changed, the architecture chosen, and what was verified. If rendering was unavailable, say so explicitly. Do not claim publication readiness without inspecting an export at its intended physical size.
