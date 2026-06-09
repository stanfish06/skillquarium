---
name: napari-viz
description: >
  Headless bioimage and microscopy visualization with napari. Use this skill when Claude needs to:
  (1) Visualize 2D/3D/multi-channel microscopy or bioimage data (TIFF, label maps, points/shapes/surfaces),
  (2) Render 3D volumes (MIP, iso, attenuated MIP) and capture viewport-only screenshots,
  (3) Configure colormaps, contrast limits, blending, scale bars, and camera in napari,
  (4) Run napari headlessly (no visible GUI) from self-contained Python scripts.
---

# Napari Headless Visualization

Execute all napari tasks via self-contained Python scripts run with Bash. Use headless mode (`napari.Viewer(show=False)`) and never leave a GUI visible.

## Rules

1. Use `napari.Viewer(show=False)` — never let the GUI stay visible
2. Always wrap in `try/finally` with `viewer.close()`
3. **Before screenshotting**, force a render cycle (show/processEvents/hide) — without this, screenshots are black
4. **Platform-specific QT_QPA_PLATFORM handling:**
   - On **macOS**: Do NOT set `QT_QPA_PLATFORM=offscreen` (crashes due to no offscreen OpenGL)
   - On **Linux**: Try WITHOUT setting `QT_QPA_PLATFORM=offscreen` first. Only set it if you encounter GUI window issues. In many environments, offscreen mode prevents proper OpenGL rendering, resulting in black screenshots. Rely on `show=False` + show/hide render cycle for headless operation.
5. Prerequisites assumed installed: napari, numpy, tifffile, Pillow, PyQt5
6. For visual matching tasks, iterate with: screenshot → assess → adjust → re-screenshot
7. After taking a screenshot, use the Read tool to view the image and relying on the model's vision capability to understand whether the code accompolished the goal.
8. Use `python` (not `python3`) to run scripts
9. General visualization strategy, optimized for the color/opacity mapping first, don't change view or rotation unless really necessary, it need to be well-motivated.

## Canonical Script Template

```python
import sys, platform
import napari
import numpy as np
import tifffile
from PIL import Image
from pathlib import Path
from qtpy.QtWidgets import QApplication
import time

# Note: Do NOT set QT_QPA_PLATFORM=offscreen unless absolutely necessary
# In many Linux environments, offscreen mode prevents OpenGL rendering

viewer = napari.Viewer(show=False)
try:
    # === Load data ===
    # data = tifffile.imread("input.tif")
    # viewer.add_image(data, name="my_image", colormap="gray")
    # -- or --
    # viewer.open("input.tif")

    # === Configure layers ===
    # (set colormaps, contrast_limits, blending, etc.)

    # === Set camera / dims ===
    # viewer.reset_view()
    # viewer.camera.zoom = 2.0

    # === Force render (required for non-black screenshots) ===
    app = QApplication.instance()
    viewer.window._qt_window.show()
    for _ in range(5):
        app.processEvents()
        time.sleep(0.1)
    viewer.window._qt_window.hide()

    # === Capture ===
    img = viewer.screenshot(canvas_only=True)
    Image.fromarray(img).save("output.png")
    print("Saved output.png")
finally:
    viewer.close()
```

## napari Python API Reference

### Layer Types

| Method | Key Parameters |
|--------|---------------|
| `viewer.add_image(data)` | `name, colormap, contrast_limits, gamma, opacity, blending, rendering, iso_threshold, interpolation2d, interpolation3d, visible, scale, translate, rgb` |
| `viewer.add_labels(data)` | `name, opacity, visible, scale` |
| `viewer.add_points(coords)` | `name, properties, size, face_color, edge_color, symbol, visible` |
| `viewer.add_shapes(data)` | `name, shape_type` (`rectangle`, `ellipse`, `polygon`, `line`, `path`), `edge_color, face_color, edge_width` |
| `viewer.add_surface((verts, faces))` | `name, colormap, opacity` |
| `viewer.add_vectors(data)` | `name, edge_color, edge_width` |

### File I/O

```python
# Read with tifffile (preferred for multi-channel)
data = tifffile.imread("file.tif")  # shape: (C, Z, Y, X) or (Z, Y, X) etc.

# Read with viewer (auto-detects format)
viewer.open("file.tif")

# Multi-channel split
for i, cmap in enumerate(["red", "green", "blue"]):
    viewer.add_image(data[i], name=f"ch{i}", colormap=cmap, blending="additive")
```

### Colormaps

`gray`, `viridis`, `plasma`, `inferno`, `magma`, `hot`, `cool`, `red`, `green`, `blue`, `cyan`, `magenta`, `yellow`, `turbo`, `twilight`, `hsv`

### Blending Modes

`opaque`, `translucent`, `translucent_no_depth`, `additive`, `minimum`

### Camera Control

```python
viewer.reset_view()
viewer.camera.center = (z, y, x)    # center point
viewer.camera.zoom = 2.0            # zoom level
viewer.camera.angles = (elev, azim, roll)  # 3D rotation (degrees)
```

Rotation notes:
- Rotation only affects 3D renders: set `viewer.dims.ndisplay = 3` and use a 3D-capable layer (volume or surface).
- Use rotation for exploratory viewing / figure framing; avoid it for near-planar volumes (few slices), or when you need quantitative Z localization (use slicing/orthogonal views).
- If voxels are anisotropic, set `layer.scale` (physical spacing) before rotating to avoid misleading geometry.

### 3D Rendering

```python
viewer.dims.ndisplay = 3
layer.rendering = "mip"          # maximum intensity projection
# Options: "mip", "iso", "attenuated_mip", "minip", "average"
layer.iso_threshold = 0.5        # for iso-surface rendering
```

### Dimensions & Time Series

```python
viewer.dims.current_step          # tuple of current position per dim
viewer.dims.set_current_step(axis, value)
viewer.dims.ndim                  # number of dimensions
viewer.dims.nsteps                # steps per dimension
viewer.dims.axis_labels = ["t", "z", "y", "x"]
```

### Scale Bar

```python
viewer.scale_bar.visible = True
viewer.scale_bar.unit = "um"
```

### Analysis via NumPy

```python
data = layer.data
print(f"Shape: {data.shape}, dtype: {data.dtype}")
print(f"Min: {data.min()}, Max: {data.max()}, Mean: {data.mean():.2f}, Std: {data.std():.2f}")
```

## Common Workflow Patterns

### Multi-Channel Overlay
```python
channels = tifffile.imread("multi_ch.tif")  # (C, Y, X)
cmaps = ["red", "green", "blue"]
for i, cmap in enumerate(cmaps):
    viewer.add_image(channels[i], name=f"ch{i}", colormap=cmap, blending="additive")
```

### 3D Volume Exploration (camera + rendering)
```python
vol = tifffile.imread("volume.tif")  # (Z, Y, X)
layer = viewer.add_image(vol, name="volume", colormap="inferno", rendering="mip")  # or "iso"
# layer.scale = (z_um, y_um, x_um)  # set physical spacing if known
viewer.dims.ndisplay = 3
viewer.reset_view()
```

Notes: for projection renderings (mip/average/minip/attenuated_mip), rotation changes the projection direction; for iso, rotation changes occlusion/shading cues.

### Iterative Visual Refinement
```python
# Step 1: Initial render with defaults
img = viewer.screenshot(canvas_only=True)
Image.fromarray(img).save("attempt_1.png")
# Step 2: Read screenshot, assess, adjust contrast/colormap/camera
# Step 3: Re-screenshot, repeat up to 5 times
```

## Debugging & Error Handling

- **Blank/black screenshot?** → Ensure you included the show/processEvents/hide render cycle before screenshotting. Also call `viewer.reset_view()`, check `layer.visible`, verify `contrast_limits` bracket actual data range
- **Rotation not changing the view?** → Ensure `viewer.dims.ndisplay = 3`, the layer is actually 3D, and the volume is not effectively 2D (single/few slices).
- **macOS OpenGL crash with offscreen?** → Do NOT set `QT_QPA_PLATFORM=offscreen` on macOS. Use `show=False` + show/hide render cycle instead
- **Dask array?** → Call `layer.data.compute()` before analysis
- **Large data?** → Use `tifffile.imread(file, key=slice_range)` to load subsets
- **Print diagnostics:**
  ```python
  for layer in viewer.layers:
      print(f"{layer.name}: shape={layer.data.shape}, dtype={layer.data.dtype}, visible={layer.visible}")
      if hasattr(layer, 'contrast_limits'):
          print(f"  contrast_limits={layer.contrast_limits}")
  ```

## Task Execution

When given $ARGUMENTS:
1. Parse the task from the arguments
2. Write a self-contained Python script following the template above
3. Execute it with Bash
4. Read the output image to verify correctness
5. If the result needs adjustment, try iterate
6. Report the result to the user
