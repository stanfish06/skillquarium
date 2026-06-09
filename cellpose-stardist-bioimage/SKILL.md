---
name: cellpose-stardist-bioimage
description: Bioimage cell and nucleus segmentation routing with cellpose-cell-segmentation, Cellpose, StarDist, napari-viz, and monai-medical-imaging-ai. Use when choosing or comparing segmentation models for microscopy, nuclei, cells, 2D/3D images, masks, overlays, fine-tuning, and segmentation quality control.
---

# Cellpose + StarDist Bioimage Segmentation

Use this skill when the task is not just "run Cellpose", but choose, compare, or validate modern bioimage segmentation workflows.

## Model Choice

- Use `cellpose-cell-segmentation` for generalist cell/nucleus segmentation across diverse microscopy images.
- Use StarDist when objects are approximately star-convex, especially nuclei in fluorescence or histology images.
- Use classical thresholding/watershed only for simple, high-contrast images or as a baseline.
- Use supervised fine-tuning when acquisition conditions differ strongly from pretrained examples.

## Segmentation Workflow

1. Inspect representative images across batches, channels, magnifications, and staining conditions.
2. Decide target objects:
   - nuclei
   - whole cells
   - tissue regions
   - organelles or colonies
3. Normalize channels and intensity consistently.
4. Run a baseline model on a small representative subset.
5. Validate masks with overlays, object-size distributions, and boundary errors.
6. Tune diameter, flow/probability thresholds, tiling, and stitching for 3D or large images.
7. Export masks in a downstream-friendly format:
   - labeled TIFF
   - OME-Zarr labels
   - tables with object measurements

## Quality Checks

- Check undersegmentation and oversegmentation separately.
- Evaluate per batch or imaging run; global quality can hide failed plates/slides.
- Preserve pixel size and channel metadata.
- Report model name/version, parameters, and any manual correction or fine-tuning.
