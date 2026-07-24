---
title: cell-detection
aliases:
  - cell detection
tags:
  - skill
  - domain/imaging-signals
domain: imaging-signals
status: untried
source: cell-detection/SKILL.md
created: 2026-06-09
---

# cell-detection

> [!info] What it does
> Cell segmentation in fluorescence microscopy images. Supports Cellpose/cpsam (Cellpose 4.0) with additional backends planned. Produces segmentation masks, per-cell morphology metrics (area, diameter, centroid, eccentricity), overlay figures, and a report.md.

**Source:** [cell-detection/SKILL.md](cell-detection/SKILL.md)  ·  **Domain:** [Imaging, Microscopy & Biosignals](maps/imaging-signals.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

_None auto-detected. Add your own links here, e.g. `[scanpy](scanpy.md)`._

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

> [!warning] Vault audit 2026-07-24 — DEP-10 (superseded by `cellpose-cell-segmentation`)
> Narrow Cellpose 4.0 cpsam wrapper (v0.1.0) superseded by `cellpose-cell-segmentation` (v1.1, Cellpose 4.2.x) — prefer that. Kept (not deleted) for its distinct report.md / reproducibility CLI, which `cellpose-cell-segmentation` (remote-managed) can't absorb upstream.
