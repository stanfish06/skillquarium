# ParaView Operations Reference

## Table of Contents
- [Data Loading](#data-loading)
- [Filters](#filters)
- [Display Properties](#display-properties)
- [Transfer Functions](#transfer-functions)
- [Camera Control](#camera-control)
- [Pipeline Management](#pipeline-management)

## Data Loading

### File Readers

| File Type | Reader | Example |
|-----------|--------|---------|
| VTK Legacy | `LegacyVTKReader` | `LegacyVTKReader(FileNames=['file.vtk'])` |
| VTK XML | `XMLImageDataReader`, `XMLUnstructuredGridReader` | Auto-detected by `OpenDataFile()` |
| EXODUS | `IOSSReader` | `IOSSReader(FileName=['file.ex2'])` |
| RAW | `ImageReader` | See RAW loading section |
| CSV | `CSVReader` | `CSVReader(FileName='file.csv')` |
| NetCDF | `NetCDFReader` | `NetCDFReader(FileName=['file.nc'])` |

### RAW Volume Loading

RAW files require manual configuration:

```python
reader = OpenDataFile('volume_256x256x256_uint8.raw')
reader.DataExtent = [0, 255, 0, 255, 0, 255]  # [xmin, xmax, ymin, ymax, zmin, zmax]
reader.FileDimensionality = 3
reader.DataScalarType = 'unsigned char'  # Options: char, unsigned char, short, unsigned short, int, unsigned int, float, double
reader.DataByteOrder = 'LittleEndian'  # or 'BigEndian'
reader.NumberOfScalarComponents = 1
```

## Filters

### Contour (Isosurface)

```python
contour = Contour(Input=source)
contour.ContourBy = ['POINTS', 'fieldName']  # or ['CELLS', 'fieldName']
contour.Isosurfaces = [value1, value2, ...]
contour.PointMergeMethod = 'Uniform Binning'
```

### Slice

```python
slice_filter = Slice(Input=source)
slice_filter.SliceType = 'Plane'  # or 'Box', 'Sphere', 'Cylinder'
slice_filter.SliceType.Origin = [x, y, z]
slice_filter.SliceType.Normal = [nx, ny, nz]
slice_filter.SliceOffsetValues = [0.0]  # Multiple parallel slices
```

### Clip

```python
clip = Clip(Input=source)
clip.ClipType = 'Plane'
clip.ClipType.Origin = [x, y, z]
clip.ClipType.Normal = [nx, ny, nz]
clip.InsideOut = False  # Flip which side to keep
```

### Stream Tracer

```python
tracer = StreamTracer(Input=source, SeedType='Point Cloud')
tracer.Vectors = ['POINTS', 'velocityField']
tracer.IntegrationDirection = 'BOTH'  # 'FORWARD', 'BACKWARD', 'BOTH'
tracer.IntegratorType = 'Runge-Kutta 4-5'
tracer.InitialStepLength = 0.1
tracer.MaximumStreamlineLength = 50.0

# Point Cloud seed
tracer.SeedType.Center = [x, y, z]
tracer.SeedType.Radius = r
tracer.SeedType.NumberOfPoints = 100
```

### Tube

```python
tube = Tube(Input=streamlines)
tube.Scalars = ['POINTS', 'scalarField']
tube.Vectors = ['POINTS', 'Normals']
tube.Radius = 0.05
tube.NumberOfSides = 6
tube.VaryRadius = 'By Scalar'  # 'Off', 'By Scalar', 'By Vector', 'By Absolute Scalar'
```

### Glyph

```python
glyph = Glyph(Input=source, GlyphType='Arrow')  # Arrow, Cone, Sphere, Cylinder, etc.
glyph.OrientationArray = ['POINTS', 'vectorField']
glyph.ScaleArray = ['POINTS', 'scalarField']
glyph.ScaleFactor = 1.0
glyph.GlyphMode = 'Every Nth Point'
glyph.Stride = 10
```

### Warp By Vector

```python
warp = WarpByVector(Input=source)
warp.Vectors = ['POINTS', 'displacement']
warp.ScaleFactor = 1.0
```

### Integrate Variables

```python
integrate = IntegrateVariables(Input=surface)
integrate.UpdatePipeline()
# Access computed values via servermanager.Fetch()
```

### Plot Over Line

```python
plot = PlotOverLine(Input=source)
plot.Point1 = [x1, y1, z1]
plot.Point2 = [x2, y2, z2]
plot.Resolution = 100
```

## Display Properties

### Representation Types

```python
display = GetDisplayProperties(source, view)
display.SetRepresentationType('Surface')
# Options: 'Surface', 'Surface With Edges', 'Wireframe', 'Points', 'Volume', 'Outline'
```

### Coloring

```python
# Color by array
ColorBy(display, ('POINTS', 'fieldName'))  # or ('CELLS', 'fieldName')
display.RescaleTransferFunctionToDataRange(True)

# Solid color
ColorBy(display, None)
display.DiffuseColor = [1.0, 0.0, 0.0]  # RGB
```

### Opacity

```python
display.Opacity = 0.5  # 0.0 to 1.0
```

### Visibility

```python
display.Visibility = 1  # 1=visible, 0=hidden
```

## Transfer Functions

### Color Transfer Function

```python
lut = GetColorTransferFunction('fieldName')

# Set RGB points: [value1, R1, G1, B1, value2, R2, G2, B2, ...]
lut.RGBPoints = [0.0, 0.0, 0.0, 1.0,   # blue at 0
                 0.5, 1.0, 1.0, 1.0,   # white at 0.5
                 1.0, 1.0, 0.0, 0.0]   # red at 1

# Apply preset
from paraview.simple import ApplyPreset
ApplyPreset(lut, 'Cool to Warm', True)
# Presets: 'Blue-Red', 'Cool to Warm', 'Viridis', 'Plasma', 'Magma', 'Inferno', 'Rainbow', 'Grayscale'
```

### Opacity Transfer Function

```python
pwf = GetOpacityTransferFunction('fieldName')

# Set points: [value1, opacity1, midpoint1, sharpness1, value2, opacity2, ...]
pwf.Points = [0.0, 0.0, 0.5, 0.0,   # transparent at 0
              0.5, 0.5, 0.5, 0.0,   # semi-transparent at 0.5
              1.0, 1.0, 0.5, 0.0]   # opaque at 1
```

## Camera Control

### Camera Properties

```python
view = GetActiveView()
camera = view.GetActiveCamera()

# Rotation
camera.Azimuth(30)    # Rotate around vertical axis
camera.Elevation(15)  # Rotate around horizontal axis
camera.Roll(10)       # Rotate around view direction

# Position
view.CameraPosition = [x, y, z]
view.CameraFocalPoint = [fx, fy, fz]
view.CameraViewUp = [ux, uy, uz]
```

### Standard Views

```python
# Reset to fit all data
ResetCamera(view)

# Predefined views
view.ResetActiveCameraToPositiveX()
view.ResetActiveCameraToNegativeX()
view.ResetActiveCameraToPositiveY()
view.ResetActiveCameraToNegativeY()
view.ResetActiveCameraToPositiveZ()
view.ResetActiveCameraToNegativeZ()

# Isometric
view.ApplyIsometricView()
```

## Pipeline Management

### Source Management

```python
# Get all sources
sources = GetSources()  # Returns dict: {(name, id): proxy, ...}

# Get/set active source
source = GetActiveSource()
SetActiveSource(source)

# Find source by name
sources_dict = GetSources()
for (name, id), proxy in sources_dict.items():
    if name == 'Contour1':
        SetActiveSource(proxy)
```

### Data Information

```python
source = GetActiveSource()

# Get bounds
bounds = source.GetDataInformation().GetBounds()
# Returns: [xmin, xmax, ymin, ymax, zmin, zmax]

# Get arrays
data_info = source.GetDataInformation()
point_info = data_info.GetPointDataInformation()
cell_info = data_info.GetCellDataInformation()

for i in range(point_info.GetNumberOfArrays()):
    array = point_info.GetArrayInformation(i)
    name = array.GetName()
    components = array.GetNumberOfComponents()

# Get array range
pd = source.PointData
min_val, max_val = pd.GetArray('fieldName').GetRange()
```

### View and Layout

```python
# Create view
renderView = CreateView('RenderView')
renderView.ViewSize = [1920, 1080]

# Create layout
layout = CreateLayout(name='Layout')
layout.AssignView(0, renderView)

# Multiple views
view1 = CreateView('RenderView')
view2 = CreateView('RenderView')
layout.SplitViewHorizontal(view1, 0.5)
layout.AssignView(1, view2)
```

### Screenshots

```python
SaveScreenshot('output.png', renderView,
               ImageResolution=[1920, 1080],
               OverrideColorPalette='WhiteBackground')  # or 'PrintBackground', 'BlackBackground'
```

### Saving Data

```python
# Save as STL
SaveData('output.stl', proxy=surface)

# Save as VTK
SaveData('output.vtk', proxy=source)

# Save state
SaveState('state.pvsm')
```
