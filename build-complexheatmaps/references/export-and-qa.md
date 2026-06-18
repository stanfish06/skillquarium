# Export And Publication QA

Use a render function that recreates the complete grid scene. Direct rendering matters because `anno_mark()` calculates positions from the physical graphics device.

## Reusable Rendering

```r
render_figure <- function() {
  grid.newpage()
  # Push the outer layout, draw independent panels, draw shared legends,
  # add panel notes, then return to the root viewport.
}
```

Call the same function for each target device:

```r
svglite::svglite("figure.svg", width = width_in, height = height_in)
render_figure()
dev.off()

grDevices::cairo_pdf("figure.pdf", width = width_in, height = height_in)
render_figure()
dev.off()

ragg::agg_png(
  "figure.png",
  width = width_in,
  height = height_in,
  units = "in",
  res = 300,
  background = "white"
)
render_figure()
dev.off()
```

For TIFF submission:

```r
ragg::agg_tiff(
  "figure.tiff",
  width = width_in,
  height = height_in,
  units = "in",
  res = 600,
  compression = "lzw",
  background = "white"
)
render_figure()
dev.off()
```

Prefer SVG or PDF for editable text and vector line work. Rasterize dense heatmap bodies only when file size or renderer performance requires it; keep labels and legends vector when possible.

If a captured grob is necessary for downstream composition, capture and redraw the complete scene consistently:

```r
figure_grob <- grid.grabExpr(render_figure(), wrap = TRUE)
grid.newpage()
grid.draw(figure_grob)
```

Test the captured result because viewport-dependent decorations may behave differently from direct device rendering.

## Physical Size First

Choose final dimensions before finalizing fonts and mark spacing. A very large canvas shrunk during manuscript assembly also shrinks text, line widths, annotation links, and apparent gaps.

Record:

- width and height in inches or millimeters
- intended single-column, double-column, or full-page placement
- raster resolution if applicable
- font size at final placement
- whether the journal will rescale the asset

Increase figure height when titles or rotated column labels need more physical room, but reserve title and label rows in the layout as well. Device height alone does not prevent clipping inside a too-small viewport.

## Visual QA Checklist

Inspect the exported file, not only the notebook preview.

- Every panel title is complete, centered over its intended components, and not clipped.
- Rotated column labels are centered over columns and clear of titles.
- Heatmap bodies have intentional relative widths; no panel is compressed by legend ownership.
- Inter-panel gaps are consistent and no larger than needed for marked labels.
- Up/down or other row slices appear in the intended order.
- Mark links terminate at the correct displayed rows.
- Marked text is legible at final size and highlighted labels use the intended emphasis color.
- Legends are outside the data panels, ordered logically, and use the same scales as the heatmaps.
- A bottom or corner note is inside the device bounds and visually subordinate.
- Borders and separator lines remain visible but do not dominate the data.
- The background, transparency, and font embedding survive export.

## Semantic QA Checklist

- Filters and thresholds match the code and caption.
- Adjusted p-values are labeled as adjusted p-values or q-values, not raw p-values.
- Fold-change direction agrees with the control and perturbation definition.
- Sorting is performed after filtering and in the intended direction.
- Row caps are applied per panel when that is the stated rule.
- Sample counts in titles are taken from unfiltered metadata and use the correct group mapping.
- A displayed transformation such as log1p or `expm1` is stated accurately.
- Shared legends represent shared limits; panel-local limits are clearly disclosed.
- Highlighted gene patterns are anchored or intentionally broad.

## Technical QA

When R is available, run at least:

```r
stopifnot(
  all(vapply(panel_matrices, is.matrix, logical(1))),
  all(vapply(panel_matrices, nrow, integer(1)) >= 0L),
  length(unique(internal_heatmap_names)) == length(internal_heatmap_names)
)
```

For each panel, verify annotation indices after all row operations:

```r
stopifnot(
  all(mark_at >= 1L),
  all(mark_at <= nrow(panel_matrix)),
  identical(mark_labels, rownames(panel_matrix)[mark_at])
)
```

Then render every requested format and confirm each device closes successfully. Report unavailable packages or missing R rather than claiming visual verification.
