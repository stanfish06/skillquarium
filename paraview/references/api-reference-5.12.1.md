# ParaView Python API Reference (v5.12.1)

> **Version Warning**: This documentation is for ParaView 5.12.1. If you are using a different version, some APIs may not be available or may have different signatures. Check your version with:
> ```python
> from paraview.simple import GetParaViewVersion
> print(GetParaViewVersion())
> ```

## Table of Contents
- [Module Overview](#module-overview)
- [paraview.simple](#paraviewsimple)
- [paraview.servermanager](#paraviewservermanager)
- [paraview.selection](#paraviewselection)
- [paraview.util](#paraviewutil)
- [Custom Algorithm Decorators](#custom-algorithm-decorators)

---

## Module Overview

| Module | Purpose |
|--------|---------|
| `paraview.simple` | High-level API for most operations (recommended) |
| `paraview.servermanager` | Low-level proxy and session management |
| `paraview.selection` | Selection operations |
| `paraview.util` | Utility functions |
| `paraview.vtk.util.numpy_support` | NumPy/VTK array conversion |

---

## paraview.simple

The main module for scripting ParaView. Import with:
```python
from paraview.simple import *
```

### Data Loading & File Operations

| Function | Description |
|----------|-------------|
| `OpenDataFile(filename)` | Creates appropriate reader based on file extension |
| `LoadState(filename, ...)` | Load PVSM state files with optional data directory mapping |
| `SaveState(filename)` | Persist current session state to file |
| `LoadLookupTable(filename)` | Import transfer function presets (JSON/XML) |
| `LoadPlugin(filename)` | Load ParaView plugins |
| `LoadCustomFilters(filename)` | Load custom filter XML definitions |
| `ReloadFiles(proxy)` | Refresh reader data |
| `ExtendFileSeries(proxy)` | Detect new files in series |
| `ReplaceReaderFileName(reader, files)` | Update reader file references |

### Data Export & Writing

| Function | Description |
|----------|-------------|
| `SaveData(filename, proxy=None, ...)` | Write pipeline output to file |
| `CreateWriter(filename, proxy)` | Generate writer proxy for specific formats |
| `SaveScreenshot(filename, view, ...)` | Render views to image (PNG, JPG, etc.) |
| `SaveAnimation(filename, ...)` | Export animations as movies/image sequences |
| `ExportView(filename, view, ...)` | Save view rendering to file |
| `ExportTransferFunction(ctf, filename)` | Export transfer function to JSON |
| `WriteAnimationGeometry(filename, view)` | Save animation geometry as PVD |

### Pipeline & Source Management

| Function | Description |
|----------|-------------|
| `GetActiveSource()` | Get currently active pipeline object |
| `SetActiveSource(proxy)` | Set pipeline object as active |
| `Delete(proxy)` | Remove pipeline object from session |
| `FindSource(name)` | Locate proxy by registration name |
| `GetSources()` | Return dict of all registered source proxies |
| `RenameSource(newname, proxy)` | Modify proxy registration name |
| `FetchData(proxy, ...)` | Fetch data from server for local processing |
| `UpdatePipeline(time=None, proxy=None)` | Execute pipeline to specified time |

### View Creation & Management

| Function | Description |
|----------|-------------|
| `CreateView(type)` | Create view by type name |
| `CreateRenderView()` | Standard 3D rendering view |
| `Create2DRenderView()` | 3D view with 2D interaction mode |
| `CreateBarChartView()` | Bar chart view |
| `CreateXYPlotView()` | XY plot view |
| `CreateComparativeRenderView()` | Multi-view comparison |
| `GetActiveView()` | Get current view |
| `SetActiveView(view)` | Set view as active |
| `GetRenderView()` | Get first render view |
| `GetRenderViews()` | Get all render views |
| `FindView(name)` | Locate view by name |
| `FindViewOrCreate(name, type)` | Find or create view |
| `GetViews(type=None)` | List all views |

### Layout Management

| Function | Description |
|----------|-------------|
| `CreateLayout(name)` | Generate new empty layout |
| `GetLayout(view)` | Get layout containing view |
| `GetLayouts()` | Get all layouts |
| `GetLayoutByName(name)` | Find layout by name |
| `AssignViewToLayout(view, layout, hint)` | Place view in layout |
| `GetViewsInLayout(layout)` | List views in layout |
| `RemoveLayout(layout)` | Delete layout |

### Display & Representation

| Function | Description |
|----------|-------------|
| `Show(proxy, view, ...)` | Show proxy in view |
| `Hide(proxy, view)` | Hide proxy in view |
| `ShowAll(view)` | Show all sources in view |
| `HideAll(view)` | Hide all sources in view |
| `GetDisplayProperties(proxy, view)` | Get representation properties |
| `SetDisplayProperties(proxy, view, ...)` | Set representation properties |
| `GetRepresentation(proxy, view)` | Get representation for proxy/view |
| `ColorBy(rep, value)` | Set scalar coloring (auto-setup color maps) |

### Transfer Functions & Color Mapping

| Function | Description |
|----------|-------------|
| `GetColorTransferFunction(arrayname)` | Get/create color mapping |
| `GetOpacityTransferFunction(arrayname)` | Get/create opacity mapping |
| `GetTransferFunction2D(arrayname)` | Get 2D transfer function |
| `CreateLookupTable(...)` | Generate lookup table |
| `MakeBlueToRedLT(min, max)` | Create blue-to-red color scale |
| `GetLookupTableNames()` | List available presets |
| `AssignLookupTable(array, presetname)` | Apply preset to array |
| `ImportPresets(filename)` | Load transfer function presets |
| `LoadPalette(name)` | Apply color palette |

### Scalar Bars

| Function | Description |
|----------|-------------|
| `GetScalarBar(ctf, view)` | Get/create scalar bar for CTF |
| `HideScalarBarIfNotNeeded(ctf, view)` | Conditionally hide scalar bar |
| `HideUnusedScalarBars(view)` | Hide all unused scalar bars |
| `UpdateScalarBars(view)` | Sync scalar bar visibility |
| `UpdateScalarBarsComponentTitle(ctf, rep)` | Update component titles |

### Selection

| Function | Description |
|----------|-------------|
| `SelectPoints(query, proxy)` | Query-based point selection |
| `SelectCells(query, proxy)` | Query-based cell selection |
| `ClearSelection(proxy)` | Remove active selections |
| `AddSelectionLink(name, proxy1, proxy2)` | Link selections between proxies |

### Animation

| Function | Description |
|----------|-------------|
| `GetAnimationScene()` | Get global animation controller |
| `GetAnimationTrack(property, ...)` | Get/create keyframe track |
| `GetCameraTrack(view)` | Get camera animation track |
| `GetTimeTrack()` | Get time control track |
| `AnimateReader(reader, view)` | Animate over reader time steps |
| `GetTimeKeeper()` | Get time management proxy |

### Lighting

| Function | Description |
|----------|-------------|
| `AddLight(view)` | Create and add light to view |
| `CreateLight()` | Generate detached light object |
| `RemoveLight(view, light)` | Remove light from view |
| `GetLight(index, view)` | Get light by index |

### Camera Control

| Function | Description |
|----------|-------------|
| `GetActiveCamera()` | Get current view camera |
| `ResetCamera(view)` | Reset camera to include whole scene |
| `ResetCameraToDirection(...)` | Orient camera to position/direction |
| `Interact()` | Enable interactive camera manipulation |

### Connection Management

| Function | Description |
|----------|-------------|
| `Connect(host, port, ...)` | Connect to remote server |
| `Disconnect()` | Close active session |
| `ReverseConnect(port)` | Listen for server connection |
| `SetActiveConnection(conn)` | Switch between connections |

### Rendering

| Function | Description |
|----------|-------------|
| `Render(view)` | Execute view rendering |
| `RenderAllViews()` | Render all views |

### Utilities

| Function | Description |
|----------|-------------|
| `GetParaViewVersion()` | Get ParaView version tuple |
| `GetParaViewSourceVersion()` | Get full version string |
| `ResetSession()` | Return session to initial state |
| `GetAllSettings()` | List settings proxies |
| `GetSettingsProxy(name)` | Get settings by type name |

---

## paraview.servermanager

Low-level module for proxy and session management.

### Key Classes

#### Connection
```python
# Python representation of a session/connection
conn = servermanager.ActiveConnection
conn.IsRemote()  # Check if remote
conn.GetNumberOfDataPartitions()  # Get partition count
```

#### Proxy
```python
# Base class wrapping vtkSMProxy
proxy.GetProperty('PropertyName')
proxy.SetProperty('PropertyName', value)
proxy.UpdateVTKObjects()
```

#### SourceProxy
```python
# Extends Proxy with data access
source.GetDataInformation()
source.PointData  # FieldDataInformation
source.CellData   # FieldDataInformation
source.UpdatePipeline()
```

#### DataInformation
```python
info = source.GetDataInformation()
bounds = info.GetBounds()  # [xmin, xmax, ymin, ymax, zmin, zmax]
info.GetNumberOfPoints()
info.GetNumberOfCells()
```

#### FieldDataInformation
```python
pd = source.PointData
num_arrays = pd.GetNumberOfArrays()
array = pd.GetArray('name')  # or pd.GetArray(index)
min_val, max_val = array.GetRange()
array.GetNumberOfComponents()
```

### Key Functions

| Function | Description |
|----------|-------------|
| `Connect(host, port)` | Create new session |
| `Disconnect(session)` | Terminate connection |
| `CreateProxy(group, name)` | Create proxy from XML |
| `CreateRenderView(session)` | Create render view |
| `Fetch(proxy)` | Transfer data to client |
| `LoadState(filename)` | Load state file |
| `SaveState(filename)` | Save state file |

---

## paraview.selection

Selection operations for identifying data elements.

### Query-Based Selection

```python
from paraview.selection import *

# Select by query expression
QuerySelect(QueryString='id > 100', FieldType='POINT', Source=source)
QuerySelect(QueryString='pressure < 0.5', FieldType='CELL')
```

### Surface Selection

| Function | Description |
|----------|-------------|
| `SelectSurfaceCells(Rectangle, View)` | Select visible cells in rectangle |
| `SelectSurfacePoints(Rectangle, View)` | Select visible points in rectangle |
| `SelectSurfaceBlocks(Rectangle, View)` | Select visible blocks in rectangle |

### Through Selection (ignore visibility)

| Function | Description |
|----------|-------------|
| `SelectCellsThrough(Rectangle, View)` | Select all cells in rectangle |
| `SelectPointsThrough(Rectangle, View)` | Select all points in rectangle |

### ID-Based Selection

| Function | Description |
|----------|-------------|
| `SelectIDs(IDs, FieldType)` | Select by (process, ID) pairs |
| `SelectGlobalIDs(IDs, FieldType)` | Select by global IDs |
| `SelectCompositeDataIDs(IDs, FieldType)` | Select by (block, process, ID) |
| `SelectPedigreeIDs(IDs, FieldType)` | Select by (domain, ID) pairs |

### Attribute-Based Selection

| Function | Description |
|----------|-------------|
| `SelectLocation(Locations)` | Select points by x,y,z coordinates |
| `SelectThresholds(Thresholds, ArrayName)` | Select by array value thresholds |

### Utility

| Function | Description |
|----------|-------------|
| `ClearSelection(Source)` | Clear selection on source |
| `CreateSelection(proxyname, name)` | Create selection source proxy |

---

## paraview.util

Utility functions for common operations.

| Function | Description |
|----------|-------------|
| `Glob(path, rootDir)` | Glob filenames in directory |
| `IntegrateCell(dataset, cellId)` | Calculate cell length/area/volume |
| `SetOutputWholeExtent(algorithm, extent)` | Set extent for programmable filters |
| `ReplaceDollarVariablesWithEnvironment(text)` | Replace ${VAR} with env values |

---

## Custom Algorithm Decorators

Create custom sources, filters, readers, and writers using decorators from `paraview.util.vtkAlgorithm`.

### smproxy Decorators

```python
from paraview.util.vtkAlgorithm import smproxy, smproperty

@smproxy.source(name="MySource", label="My Custom Source")
class MySource(VTKPythonAlgorithmBase):
    pass

@smproxy.filter(name="MyFilter", label="My Custom Filter")
class MyFilter(VTKPythonAlgorithmBase):
    pass

@smproxy.reader(name="MyReader", extensions="myext", file_description="My Files")
class MyReader(VTKPythonAlgorithmBase):
    pass

@smproxy.writer(name="MyWriter", extensions="myext", file_description="My Files")
class MyWriter(VTKPythonAlgorithmBase):
    pass
```

### smproperty Decorators

```python
@smproperty.intvector(name="Count", default_values=10)
def SetCount(self, count):
    self._count = count
    self.Modified()

@smproperty.doublevector(name="Scale", default_values=1.0)
def SetScale(self, scale):
    self._scale = scale

@smproperty.stringvector(name="FileName")
@smdomain.filelist()
def SetFileName(self, filename):
    self._filename = filename

@smproperty.input(name="Input", port_index=0)
@smdomain.datatype(dataTypes=["vtkDataSet"])
def SetInputConnection(self, input):
    pass
```

### smdomain Decorators

| Decorator | Description |
|-----------|-------------|
| `@smdomain.intrange(min, max)` | Integer range constraint |
| `@smdomain.doublerange(min, max)` | Double range constraint |
| `@smdomain.filelist()` | File selection domain |
| `@smdomain.datatype(dataTypes=[...])` | Input data type constraint |
| `@smdomain.xml(...)` | Custom domain XML |

---

## Common Patterns

### Get Data Range
```python
source = GetActiveSource()
pd = source.PointData
array = pd.GetArray('fieldName')
min_val, max_val = array.GetRange()
```

### Get Bounds
```python
source = GetActiveSource()
bounds = source.GetDataInformation().GetBounds()
# [xmin, xmax, ymin, ymax, zmin, zmax]
```

### Iterate Over Arrays
```python
source = GetActiveSource()
pd = source.PointData
for i in range(pd.GetNumberOfArrays()):
    array = pd.GetArray(i)
    print(f"{array.Name}: {array.GetRange()}")
```

### Fetch Data to Client
```python
from paraview import servermanager
client_data = servermanager.Fetch(source)
# client_data is now a VTK object
num_points = client_data.GetNumberOfPoints()
```

---

## Version Compatibility Notes

### 5.12.1 Specific
- `GetTransferFunction2D()` for 2D transfer functions
- Enhanced `SaveScreenshot()` with async support via `WaitForScreenshot()`
- `CreateSteerableParameters()` for Catalyst steering

### Deprecated in 5.12.1
- `Show3DWidgets()` / `Hide3DWidgets()` - use `ShowInteractiveWidgets()` / `HideInteractiveWidgets()`
- `GetLookupTableForArray()` - use `GetColorTransferFunction()`

### Check Your Version
```python
from paraview.simple import GetParaViewVersion
major, minor = GetParaViewVersion()
print(f"ParaView {major}.{minor}")
if (major, minor) < (5, 12):
    print("Warning: Some APIs may not be available")
```
