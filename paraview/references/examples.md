# ParaView Example Scripts

## Table of Contents
- [Volume Rendering (DVR)](#volume-rendering-dvr)
- [Isosurface Visualization](#isosurface-visualization)
- [Streamlines with Glyphs](#streamlines-with-glyphs)
- [Slice and Isosurface Combination](#slice-and-isosurface-combination)
- [Points, Surface, and Clip](#points-surface-and-clip)

## Volume Rendering (DVR)

Direct volume rendering of a scalar field with custom transfer functions:

```python
from paraview.simple import *

# Read the input data
data = LegacyVTKReader(registrationName='volume.vtk',
                       FileNames=['/path/to/volume.vtk'])

# Get range of scalar field
source = GetActiveSource()
pd = source.PointData
min_val, max_val = pd.GetArray(0).GetRange()

# Color transfer function (blue-white-red)
lut = GetColorTransferFunction('var0')
lut.RGBPoints = [min_val, 0.0, 0.0, 0.75,
                 (min_val + max_val) / 2.0, 0.75, 0.75, 0.75,
                 max_val, 0.75, 0.0, 0.0]

# Opacity transfer function
pwf = GetOpacityTransferFunction('var0')
pwf.Points = [min_val, 0.0, 0.5, 0.0,
              (min_val + max_val) / 2.0, 0.5, 0.5, 0.0,
              max_val, 1.0, 0.5, 0.0]

# Create render view with isometric camera
renderView = CreateView('RenderView')
renderView.ViewSize = [1920, 1080]
renderView.CameraPosition = [3.86, 3.86, 3.86]
renderView.CameraViewUp = [-0.408, 0.816, -0.408]

# Create layout
layout = CreateLayout(name='Layout')
layout.AssignView(0, renderView)

# Display as volume
display = Show(data, renderView)
display.Representation = 'Volume'
display.ColorArrayName = ['POINTS', 'var0']
display.LookupTable = lut
display.ScalarOpacityFunction = pwf

# Save screenshot
SaveScreenshot('/path/to/dvr-screenshot.png', renderView,
               ImageResolution=[1920, 1080])
```

## Isosurface Visualization

Extract and display an isosurface:

```python
from paraview.simple import *

# Read the input data
data = LegacyVTKReader(registrationName='volume.vtk',
                       FileNames=['/path/to/volume.vtk'])

# Create isosurface
contour = Contour(registrationName='Contour1', Input=data)
contour.ContourBy = ['POINTS', 'var0']
contour.Isosurfaces = [0.5]
contour.PointMergeMethod = 'Uniform Binning'

# Create render view
renderView = CreateView('RenderView')
renderView.ViewSize = [1920, 1080]

# Create layout
layout = CreateLayout(name='Layout')
layout.AssignView(0, renderView)

# Show the isosurface
display = Show(contour, renderView)

# Save screenshot
SaveScreenshot('/path/to/iso-screenshot.png', renderView,
               ImageResolution=[1920, 1080])
```

## Streamlines with Glyphs

Visualize vector field with streamlines and direction glyphs:

```python
from paraview.simple import *

# Read the input data
data = IOSSReader(registrationName='disk.ex2',
                  FileName=['/path/to/disk.ex2'])
data.UpdatePipeline()

# Get data range for camera setup
bounds = data.GetDataInformation().GetBounds()
length = [bounds[1] - bounds[0], bounds[3] - bounds[2], bounds[5] - bounds[4]]
center = [(bounds[0] + bounds[1]) / 2.0,
          (bounds[2] + bounds[3]) / 2.0,
          (bounds[4] + bounds[5]) / 2.0]

# Create stream tracer
streamTracer = StreamTracer(registrationName='StreamTracer1',
                            Input=data, SeedType='Point Cloud')
streamTracer.Vectors = ['POINTS', 'V']
streamTracer.MaximumStreamlineLength = 20.0
streamTracer.SeedType.Center = [0.0, 0.0, center[2]]
streamTracer.SeedType.Radius = 2.0

# Create glyphs for direction indication
glyph = Glyph(registrationName='Glyph1', Input=streamTracer, GlyphType='Cone')
glyph.OrientationArray = ['POINTS', 'V']
glyph.ScaleArray = ['POINTS', 'V']
glyph.ScaleFactor = 0.06
glyph.GlyphTransform = 'Transform2'

# Create tubes for streamline visibility
tube = Tube(registrationName='Tube1', Input=streamTracer)
tube.Scalars = ['POINTS', 'AngularVelocity']
tube.Vectors = ['POINTS', 'Normals']
tube.Radius = 0.075

# Create render view with +X view direction
renderView = CreateView('RenderView')
renderView.ViewSize = [1920, 1080]
renderView.CameraPosition = [center[0] - 1.5 * max(length[1], length[2]),
                             center[1], center[2]]
renderView.CameraFocalPoint = center
renderView.CameraViewUp = [0.0, 0.0, 1.0]

# Create layout
layout = CreateLayout(name='Layout')
layout.AssignView(0, renderView)

# Show tubes and glyphs
tubeDisplay = Show(tube, renderView)
glyphDisplay = Show(glyph, renderView)

# Color by temperature
ColorBy(tubeDisplay, ('POINTS', 'Temp'))
ColorBy(glyphDisplay, ('POINTS', 'Temp'))
tubeDisplay.RescaleTransferFunctionToDataRange(True)
glyphDisplay.RescaleTransferFunctionToDataRange(True)

# Save screenshot
SaveScreenshot('/path/to/streamline-screenshot.png', renderView,
               ImageResolution=[1920, 1080])
```

## Slice and Isosurface Combination

Combine slice and isosurface visualizations:

```python
from paraview.simple import *

# Read the input data
data = LegacyVTKReader(registrationName='volume.vtk',
                       FileNames=['/path/to/volume.vtk'])

# Get data bounds
bounds = data.GetDataInformation().GetBounds()
center = [(bounds[0] + bounds[1]) / 2.0,
          (bounds[2] + bounds[3]) / 2.0,
          (bounds[4] + bounds[5]) / 2.0]

# Create slice through center
slice_filter = Slice(registrationName='Slice1', Input=data)
slice_filter.SliceType = 'Plane'
slice_filter.SliceType.Origin = center
slice_filter.SliceType.Normal = [0.0, 0.0, 1.0]

# Create isosurface
contour = Contour(registrationName='Contour1', Input=data)
contour.ContourBy = ['POINTS', 'var0']
contour.Isosurfaces = [0.5]

# Create render view
renderView = CreateView('RenderView')
renderView.ViewSize = [1920, 1080]

# Create layout
layout = CreateLayout(name='Layout')
layout.AssignView(0, renderView)

# Show both
sliceDisplay = Show(slice_filter, renderView)
contourDisplay = Show(contour, renderView)

# Color slice by scalar
ColorBy(sliceDisplay, ('POINTS', 'var0'))
sliceDisplay.RescaleTransferFunctionToDataRange(True)

# Make isosurface semi-transparent
contourDisplay.Opacity = 0.5
contourDisplay.DiffuseColor = [1.0, 0.0, 0.0]

# Save screenshot
SaveScreenshot('/path/to/slice-iso-screenshot.png', renderView,
               ImageResolution=[1920, 1080])
```

## Points, Surface, and Clip

Point cloud to surface with clipping:

```python
from paraview.simple import *

# Read point data
points = CSVReader(FileName='/path/to/points.csv')

# Convert to points
tableToPoints = TableToPoints(Input=points)
tableToPoints.XColumn = 'x'
tableToPoints.YColumn = 'y'
tableToPoints.ZColumn = 'z'

# Create surface from points (Delaunay triangulation)
delaunay = Delaunay3D(Input=tableToPoints)

# Clip the surface
clip = Clip(registrationName='Clip1', Input=delaunay)
clip.ClipType = 'Plane'
clip.ClipType.Origin = [0.0, 0.0, 0.0]
clip.ClipType.Normal = [1.0, 0.0, 0.0]

# Create render view
renderView = CreateView('RenderView')
renderView.ViewSize = [1920, 1080]

# Create layout
layout = CreateLayout(name='Layout')
layout.AssignView(0, renderView)

# Show the clipped surface
display = Show(clip, renderView)
display.SetRepresentationType('Surface With Edges')

# Save screenshot
SaveScreenshot('/path/to/clip-screenshot.png', renderView,
               ImageResolution=[1920, 1080],
               OverrideColorPalette='WhiteBackground')
```

## Script Template

Basic template for new ParaView scripts:

```python
from paraview.simple import *

# ============= Configuration =============
INPUT_FILE = '/path/to/input.vtk'
OUTPUT_FILE = '/path/to/screenshot.png'
IMAGE_SIZE = [1920, 1080]

# ============= Load Data =============
data = LegacyVTKReader(FileNames=[INPUT_FILE])
# data = IOSSReader(FileName=[INPUT_FILE])
# data.UpdatePipeline()  # Required for EXODUS

# ============= Get Data Info =============
bounds = data.GetDataInformation().GetBounds()
center = [(bounds[0]+bounds[1])/2, (bounds[2]+bounds[3])/2, (bounds[4]+bounds[5])/2]

# ============= Create Filters =============
# Add your filters here

# ============= Create View =============
renderView = CreateView('RenderView')
renderView.ViewSize = IMAGE_SIZE

layout = CreateLayout(name='Layout')
layout.AssignView(0, renderView)

# ============= Display =============
display = Show(data, renderView)
# Configure display properties

# ============= Save Output =============
SaveScreenshot(OUTPUT_FILE, renderView,
               ImageResolution=IMAGE_SIZE,
               OverrideColorPalette='WhiteBackground')
```
