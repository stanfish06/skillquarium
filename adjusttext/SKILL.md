---
name: adjusttext
description: Use the Python adjustText package to automatically move matplotlib text labels so they do not overlap each other, points, or other artists. Use for crowded scatter plots, volcano plots, PCA/UMAP labels, line-end annotations, maps, and publication figures that need readable labels with optional arrows. Pairs with matplotlib, seaborn, scanpy, and scientific-visualization workflows.
---

# adjustText

## Overview

`adjustText` iteratively adjusts `matplotlib.text.Text` artists after a plot is otherwise complete. Use it when labels are useful but manual nudging would be tedious or fragile.

The source-grounded API here targets `adjustText` 1.4.0. Prefer current names such as `objects`, `force_static`, `expand`, `target_x`, `target_y`, `time_lim`, and `iter_lim`; older examples may mention legacy names such as `add_objects`, `force_points`, `force_objects`, `expand_text`, or `lim`.

`ggrepel` is included as a search/discovery alias because adjustText is the Python/matplotlib analogue. For R or ggplot2 code, use `ggrepel::geom_text_repel()`/`geom_label_repel()` instead; this skill covers only Python workflows.

## Core Workflow

1. Build the complete plot first: data, axis limits, scales, legends, colorbars, aspect ratio, and layout.
2. Create labels with `ax.text(...)` and keep the returned `Text` objects in a list.
3. Call `adjust_text(texts, ax=ax, ...)` as the last plot-positioning step.
4. Save the figure after adjustment. If using `tight_layout()`, call it before `adjust_text`; if using `constrained_layout`, enable it when creating the figure.

```python
import matplotlib.pyplot as plt
from adjustText import adjust_text

fig, ax = plt.subplots(figsize=(4, 3), constrained_layout=True)
ax.scatter(df["log2fc"], df["neg_log10_p"], s=14, alpha=0.45)

top = df.nlargest(20, "neg_log10_p")
texts = [
    ax.text(row.log2fc, row.neg_log10_p, row.gene, fontsize=7)
    for row in top.itertuples()
]

adjust_text(
    texts,
    x=df["log2fc"],
    y=df["neg_log10_p"],
    ax=ax,
    arrowprops={"arrowstyle": "-", "lw": 0.5, "color": "0.35"},
    time_lim=1,
)

fig.savefig("volcano_labeled.pdf")
```

## Common Patterns

**Repel labels from all plotted points**

Pass the underlying point coordinates as `x=` and `y=`. With `avoid_self=True` (default), labels also repel from their original text positions.

```python
adjust_text(texts, x=x_values, y=y_values, ax=ax)
```

**Use arrows pointing to original data locations**

When labels are initialized at the point they label, arrows use those original positions. If labels start elsewhere, pass `target_x` and `target_y` in the same order as `texts`.

```python
adjust_text(
    texts,
    target_x=top["x"],
    target_y=top["y"],
    ax=ax,
    min_arrow_len=3,
    arrowprops={"arrowstyle": "->", "mutation_scale": 6, "lw": 0.6},
)
```

**Avoid other artists**

Use `objects=` for bars, scatter collections, patches, or explicit bounding boxes that labels should avoid.

```python
scatter = ax.scatter(x, y, s=sizes)
texts = [ax.text(xi, yi, name) for xi, yi, name in labeled_points]
adjust_text(texts, objects=[scatter], ax=ax)
```

**Handle subplots**

Call `adjust_text` separately for each `Axes`; do not pass labels from multiple subplots into one call.

```python
for ax, group in zip(axes.flat, groups):
    texts = []
    ax.scatter(group["x"], group["y"])
    for row in group.nlargest(8, "score").itertuples():
        texts.append(ax.text(row.x, row.y, row.label, fontsize=7))
    adjust_text(texts, x=group["x"], y=group["y"], ax=ax, time_lim=0.5)
```

## Tuning

Start with better figure geometry before force tuning: slightly larger figure, smaller font, fewer labels, or selective labels usually beats extreme forces.

- `time_lim` / `iter_lim`: Bound runtime. If both are omitted, current adjustText sets `time_lim=1`. Use one explicit limit for reproducible batch jobs.
- `force_text`: Repulsion among labels. Increase when labels still overlap each other.
- `force_static`: Repulsion from `x`/`y` points and `objects`.
- `force_pull`: Pull back toward original or target locations. Decrease when labels need freedom; increase when labels drift too far.
- `force_explode`: Initial separation force before iterative adjustment.
- `expand`: Multiplier for label bounding boxes during collision checks. Increase the y component for tall fonts or dense vertical labels.
- `max_move`: Per-iteration movement limit in display units. Use `None` for unconstrained movement only when needed.
- `explode_radius`: Radius for initial nearby-object search; `"auto"` uses mean text size.
- `min_arrow_len`: Minimum display-space distance between adjusted text and target before drawing an arrow. Lower it to draw short arrows; raise it to suppress arrows for nearby labels.
- `only_move`: Restrict movement globally with a string (`"x"`, `"y"`, `"x+"`, `"y-"`) or per phase with keys `"text"`, `"static"`, `"explode"`, and `"pull"`.
- `prevent_crossings`: Keep enabled for arrowed plots unless it causes unstable placements; it is marked experimental upstream.
- `ensure_inside_axes` / `expand_axes`: Keep labels inside axes by default, or set `expand_axes=True` when labels should be allowed to enlarge the axes limits before adjustment.

## Pitfalls

- Do not call `adjust_text` before changing axis limits, scale, aspect, colorbars, legends, or layout; it depends on final rendered axes dimensions.
- Do not use it to label every point in a very large plot. Select important points first, then repel from the full coordinate arrays with `x=` and `y=`.
- Do not mix labels from different axes in one call.
- For log, polar, map, or custom transforms, check the saved output; arrows may fall back to annotations when `FancyArrowPatch` cannot support the transform.
- For seaborn or scanpy outputs, get the underlying `Axes` and pass `ax=ax`; create labels yourself with matplotlib text artists.
- If labels appear clipped, try `expand_axes=True`, larger limits before adjustment, or `ensure_inside_axes=False` plus `bbox_inches="tight"` on save.

## Installation

```bash
uv add adjustText
```

Imports:

```python
from adjustText import adjust_text
```
