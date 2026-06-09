---
name: monai-medical-imaging-ai
description: Medical imaging deep learning with MONAI, PyTorch, pydicom, pathml, histolab, and napari-viz. Use for segmentation, classification, registration, transforms, sliding-window inference, NIfTI/DICOM workflows, medical image datasets, and reproducible clinical imaging AI pipelines.
---

# MONAI Medical Imaging AI

Use this skill for deep-learning workflows on medical images. MONAI is most appropriate for 2D/3D segmentation, classification, registration, self-supervised pretraining, transforms, and inference over NIfTI, DICOM-derived, or similar medical imaging tensors.

## Routing

- Use `pydicom` for DICOM metadata and low-level DICOM file handling.
- Use `pathml` or `histolab` for pathology whole-slide workflows.
- Use this skill for PyTorch medical imaging model development and inference.

## Workflow

1. Define the clinical/image task and label source.
2. Audit data splits by patient, site, scanner, and time to avoid leakage.
3. Normalize orientation, spacing, intensity scaling, and crop strategy.
4. Build MONAI transforms for training and validation separately.
5. Use `CacheDataset` or persistent caching when transforms are expensive.
6. Select architecture:
   - `UNet`/`DynUNet`/`SwinUNETR` for segmentation.
   - DenseNet/ViT-style networks for classification.
7. Train with explicit metrics:
   - Dice/IoU/Hausdorff for segmentation.
   - AUROC/sensitivity/specificity/calibration for classification.
8. Run sliding-window inference for large 3D volumes.

## Implementation Notes

- Always record voxel spacing, orientation, and resampling choices.
- Keep transforms deterministic in validation/test pipelines.
- For clinical claims, report site split, patient count, label source, failure modes, and uncertainty.
- Save model weights, config, transform pipeline, and package versions together.
