# ComplexHeatmap Layout And Annotation Reference

Use this reference for multi-panel composition, `anno_mark()`, spacing, title alignment, and legend ownership.

## Source Map

Inspect source matching the installed package version when possible.

| Concern | ComplexHeatmap source |
| --- | --- |
| Horizontal and vertical list compatibility | `R/HeatmapList-class.R` |
| Null-unit body sizing and component alignment | `R/HeatmapList-draw_component.R` |
| Heatmap and list component widths | `R/HeatmapList-layout.R` |
| `rowAnnotation()` construction | `R/HeatmapAnnotation-class.R` |
| `anno_mark()` sizing and drawing | `R/AnnotationFunction-function.R` |
| Title and annotation viewport decoration | `R/decorate.R` |
| Default outer padding | `R/global.R` |
| `Legend()` and `packLegend()` | `R/grid.Legend.R` |

Useful checks:

```bash
rg -n 'nrow.*all heatmaps|nobs.*annotations' R/HeatmapList-class.R
rg -n 'total_fixed_width|unit_per_null' R/HeatmapList-draw_component.R
rg -n '^anno_mark =|max_text_width' R/AnnotationFunction-function.R
rg -n '^decorate_title =|^decorate_column_title' R/decorate.R
rg -n 'GLOBAL_PADDING' R/global.R
```

Source-backed behavior:

- A horizontal `HeatmapList` requires equal `nrow` for heatmaps and equal `nobs` for annotations.
- `rowAnnotation(...)` is a wrapper around `HeatmapAnnotation(..., which = "row")`.
- `anno_mark()` defaults through `which = c("column", "row")`; when no row-annotation context has been established, it selects the first value. Set `which = "row"` explicitly.
- Empty `anno_mark()` inputs return `anno_empty()`.
- Row-oriented `anno_mark()` width is `link_width + max_text_width(labels, labels_gp)`.
- ComplexHeatmap distributes remaining viewport width among heatmap bodies expressed as null units after subtracting fixed components.
- `decorate_column_title()` finds a viewport derived from the heatmap name and title slice, so names must be unique.
- Default `draw()` padding is 5.5 points on every side. The order is bottom, left, top, right.

## Shared Rows: One HeatmapList

Concatenate heatmaps only when row position has the same meaning across components.

```r
library(ComplexHeatmap)
library(grid)

ht <- Heatmap(
  expression_mat,
  name = "panel_expression",
  width = unit(2, "null"),
  cluster_rows = FALSE,
  cluster_columns = FALSE,
  column_names_centered = TRUE,
  column_names_rot = 45,
  show_heatmap_legend = FALSE
) + Heatmap(
  logfc_mat,
  name = "panel_logfc",
  width = unit(1, "null"),
  cluster_rows = FALSE,
  cluster_columns = FALSE,
  show_heatmap_legend = FALSE
)
```

The first heatmap normally controls row order and splitting for the horizontal list. Do not independently sort a later heatmap and assume the list will retain both orders.

## Different Rows: Independent Panels

Independently filtered or ranked matrices need independent lists. Assemble them with `grid`, not `+`.

```r
draw_panel <- function(ht, height_fraction = 1) {
  pushViewport(viewport(
    y = unit(1, "npc"),
    height = unit(height_fraction, "npc"),
    just = c("center", "top")
  ))
  draw(
    ht,
    newpage = FALSE,
    show_heatmap_legend = FALSE,
    show_annotation_legend = FALSE,
    padding = unit(c(0, 0, 0, 0), "mm")
  )
  upViewport()
}

render_panels <- function(panels, panel_heights, packed_legend, legend_width) {
  grid.newpage()
  n <- length(panels)
  pushViewport(viewport(layout = grid.layout(
    nrow = 1,
    ncol = n + 1,
    widths = unit.c(rep(unit(1, "null"), n), legend_width)
  )))

  for (i in seq_len(n)) {
    pushViewport(viewport(layout.pos.col = i))
    draw_panel(panels[[i]], panel_heights[[i]])
    upViewport()
  }

  pushViewport(viewport(layout.pos.col = n + 1))
  draw(packed_legend, x = unit(0, "npc"), just = "left")
  upViewport(2)
}
```

For variable heights, derive `panel_heights` from row counts, with a documented minimum so small panels remain readable:

```r
row_counts <- vapply(panel_data, nrow, integer(1))
panel_heights <- pmax(0.18, row_counts / max(row_counts))
```

If height should not encode row count, set every height to 1. Do not introduce visual encoding accidentally.

## Marked Row Labels

Construct mark indices after final filtering, sorting, and splitting so indices match displayed row order.

```r
make_mark_annotation <- function(genes, mark, highlight, font_size, width = NULL) {
  at <- which(mark)
  labels <- genes[at]
  label_col <- ifelse(labels %in% highlight, "#B2182B", "grey15")

  rowAnnotation(
    mark = anno_mark(
      at = at,
      labels = labels,
      which = "row",
      side = "right",
      link_width = unit(1.5, "mm"),
      padding = unit(0.6, "mm"),
      link_gp = gpar(col = "grey60", lwd = 0.45),
      labels_gp = gpar(
        col = if (length(label_col)) label_col else "grey15",
        fontsize = font_size
      )
    ),
    width = width
  )
}
```

The scalar fallback for `label_col` avoids passing a zero-length color vector to `gpar()` when no rows qualify. `anno_mark()` itself handles an empty `at` by producing an empty annotation.

For regular-expression marker sets, anchor patterns when exact symbols are intended:

```r
is_highlight <- function(symbols, patterns) {
  Reduce(`|`, lapply(patterns, grepl, x = symbols, perl = TRUE), init = FALSE)
}
```

Decide whether link lines should inherit highlight colors. Usually only the text should be emphasized; keep `link_gp` neutral unless colored links encode something.

## Annotation Width And Panel Gaps

Measure the labels actually used across panels:

```r
all_mark_labels <- unlist(mark_labels_by_panel, use.names = FALSE)
mark_gp <- gpar(fontsize = mark_font_size)
mark_width <- if (length(all_mark_labels)) {
  unit(1.5, "mm") + max_text_width(all_mark_labels, gp = mark_gp)
} else {
  unit(0, "mm")
}
```

Measure after opening the target graphics device, or inside the render function, because text metrics depend on the device and font backend.

Use a common measured width when equal heatmap-body widths matter. If a panel has no labels, choose deliberately between reserving the common alignment width and omitting the annotation to reclaim space.

When gaps remain, inspect these independently:

1. Outer `grid.layout()` spacer columns or margins.
2. `draw(..., padding = ...)` around each independent list.
3. Internal `draw(..., ht_gap = ...)` or `HeatmapList` gaps.
4. Row-annotation widths and `anno_mark(link_width = ...)`.
5. Row-title and heatmap-name components.
6. The fixed-width legend column.

Null units control flexible heatmap bodies. Absolute units are appropriate for text, links, legends, and known gaps. Avoid fixing all panel widths in millimeters unless the final device dimensions are also fixed and tested.

## Titles Spanning Components

`column_names_centered = TRUE` centers each column label over its cell. It does not center a panel title over several adjacent heatmaps.

Prefer an outer title row that spans the complete panel viewport:

```r
pushViewport(viewport(layout = grid.layout(
  nrow = 2,
  ncol = 1,
  heights = unit.c(unit(2.5, "lines"), unit(1, "null"))
)))
pushViewport(viewport(layout.pos.row = 1))
grid.text(panel_title, x = 0.5, y = 0.5, gp = gpar(fontface = "bold"))
upViewport()
pushViewport(viewport(layout.pos.row = 2))
draw(ht, newpage = FALSE, padding = unit(0, "mm"))
upViewport(2)
```

When maintaining an existing ComplexHeatmap title workflow, reserve the title viewport first, then decorate it:

```r
Heatmap(
  mat,
  name = unique_name,
  column_title = " \n ",
  column_title_gp = gpar(col = "transparent")
)

decorate_column_title(unique_name, {
  grid.text(panel_title, gp = gpar(fontface = "bold"))
})
```

Decoration targets a single heatmap title viewport. To span multiple component heatmaps, use an outer viewport or compute coordinates in the enclosing panel; `x = 0.5` inside one heatmap's title viewport cannot span its neighbors.

## Shared Legends Without Panel Compression

Disable automatic legends in every independent panel and create one packed legend object:

```r
lgd_expression <- Legend(
  title = "mean log1p",
  col_fun = expression_col_fun,
  title_gp = gpar(fontface = "bold", fontsize = plot_font_size),
  labels_gp = gpar(fontsize = plot_font_size)
)

lgd_logfc <- Legend(
  title = "log2FC",
  col_fun = logfc_col_fun,
  title_gp = gpar(fontface = "bold", fontsize = plot_font_size),
  labels_gp = gpar(fontsize = plot_font_size)
)

packed_legend <- packLegend(
  lgd_expression,
  lgd_logfc,
  direction = "vertical",
  gap = unit(2, "mm")
)
```

Draw this object in the dedicated final column of the outer grid. Attaching all legends to the final panel makes that panel's available body width smaller and creates the appearance of uneven compression.
