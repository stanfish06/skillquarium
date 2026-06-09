---
name: vmd-mdanalysis-viz
description: >
  Headless molecular visualization and trajectory analysis with VMD, MDAnalysis, and GROMACS. Use this skill when Claude needs to:
  (1) Render proteins/molecules (cartoon, licorice, VDW, surface) headlessly via vmd-python or VMD text mode,
  (2) Analyze MD trajectories (RMSD, RMSF, radius of gyration, hydrogen bonds, SASA, secondary structure, contacts),
  (3) Work with PDB/GRO/PSF/XTC/DCD/TRR structure and trajectory formats,
  (4) Drive GROMACS command-line analysis tools and parse XVG output.
---

# VMD + MDAnalysis + GROMACS Headless Visualization & Analysis

Execute all molecular visualization and trajectory analysis tasks headlessly — **never open a GUI** in any tool.

- **VMD tasks**: use `vmd-python` (`import vmd`) for molecule loading, analysis, and scene export. For CLI-based VMD (if `vmd` binary is on PATH), use `vmd -dispdev text -e script.tcl`
- **MDAnalysis tasks**: Python scripts using `MDAnalysis` universe, analysis modules, and matplotlib
- **GROMACS tasks**: command-line tools (`gmx rms`, `gmx rmsf`, `gmx gyrate`, `gmx hbond`, `gmx dssp`, etc.) — version 2026.1

## Rules

1. **Never open a GUI** — VMD uses vmd-python or `-dispdev text`; MDAnalysis uses matplotlib with `Agg` backend; GROMACS is CLI-only
2. **Prefer vmd-python** (`import vmd`) over CLI VMD — it is installed and works headlessly as a Python library
3. In vmd-python, use `vmd.evaltcl()` to run TCL commands; use `vmd.molecule`, `vmd.atomsel`, `vmd.molrep` for Python API
4. If using CLI VMD, always add `exit` at the end of every TCL script
5. **Rendering in vmd-python**: `TachyonInternal` is **not available**; available renderers are: `Tachyon` (writes scene file, needs external `tachyon` binary), `PostScript`, `Wavefront`, `STL`, `snapshot`. For image output, prefer `PostScript` → convert with PIL, or export geometry + render with other tools
6. If CLI VMD with TachyonInternal is available, force render update: `display update; display update ui; render TachyonInternal output.tga`
7. In MDAnalysis/matplotlib, set `matplotlib.use('Agg')` before importing `pyplot` to prevent GUI
8. After generating output, use the Read tool to view images and verify correctness
9. For visual matching tasks, iterate up to 5 times: render → assess → adjust → re-render
10. Use `python` (not `python3`) to run scripts
11. In VMD TCL, quote simple selections with `"..."` but use braces for compound selections: `mol selection {protein and name CA}`
12. **GROMACS 2026**: use `gmx dssp` (not `gmx do_dssp`); `gmx hbond` uses `-r`/`-t` selection syntax (not piped index groups)

## vmd-python API (Primary VMD Interface)

vmd-python (v3.1.7) provides VMD as a Python importable library. No CLI binary needed.

### Loading Molecules

```python
import vmd
from vmd import molecule, atomsel, molrep, evaltcl, display

# Load structure
mol_id = molecule.load('pdb', 'structure.pdb')

# Load structure + trajectory
mol_id = molecule.load('gro', 'topology.gro')
molecule.read(mol_id, 'xtc', 'trajectory.xtc', waitfor=-1)

# Load PSF + DCD
mol_id = molecule.load('psf', 'structure.psf')
molecule.read(mol_id, 'dcd', 'trajectory.dcd', waitfor=-1)

# Query
print(f"Atoms: {molecule.numatoms(mol_id)}")
print(f"Frames: {molecule.numframes(mol_id)}")
```

### Atom Selections (Python API)

```python
from vmd import atomsel

sel = atomsel('protein', molid=mol_id)
sel = atomsel('protein and name CA', molid=mol_id)
sel = atomsel('not protein and not water', molid=mol_id)

# Properties
sel.name        # list of atom names
sel.resname     # list of residue names
sel.resid       # list of residue IDs
sel.x, sel.y, sel.z  # coordinate arrays
sel.mass        # masses
sel.chain       # chain IDs
```

### TCL via evaltcl (for commands without Python bindings)

```python
from vmd import evaltcl

# Measure center
center = evaltcl('measure center [atomselect top all]')

# RMSD
evaltcl('set sel [atomselect top "protein and name CA"]')
evaltcl('set ref [atomselect top "protein and name CA" frame 0]')
rmsd = evaltcl('measure rmsd $sel $ref')

# Contacts
evaltcl('set contacts [measure contacts 3.5 $sel1 $sel2]')

# SASA
sasa = evaltcl('measure sasa 1.4 [atomselect top "protein"]')
```

### Representations (Python API)

```python
from vmd import molrep, evaltcl

# Delete default rep and add custom
molrep.delrep(0, mol_id)

# Use evaltcl for representation setup (more flexible)
evaltcl('mol representation NewCartoon')
evaltcl('mol color SecondaryStructure')
evaltcl('mol selection {protein}')
evaltcl('mol material AOChalky')
evaltcl('mol addrep top')

# Add second rep for ligand
evaltcl('mol representation Licorice 0.3 12 12')
evaltcl('mol color Name')
evaltcl('mol selection {not protein and not water}')
evaltcl('mol addrep top')
```

### Display & Rendering

```python
from vmd import display, evaltcl

# Camera setup
evaltcl('display resetview')
evaltcl('display resize 1024 768')
evaltcl('display projection Orthographic')
evaltcl('display depthcue off')
evaltcl('color Display Background white')
evaltcl('display aoambient 0.8')
evaltcl('display aodirect 0.3')

# Force display update
display.update()
display.update_ui()

# Available renderers (no TachyonInternal in vmd-python):
# PostScript, Tachyon (scene file), Wavefront, STL, snapshot

# Render PostScript → convert to PNG
evaltcl('render PostScript output.ps')
# Then convert: ps2pdf + convert, or use PIL if EPS

# Render Tachyon scene file (if external tachyon is installed)
evaltcl('render Tachyon output.dat')
# Then: tachyon output.dat -o output.tga

# Export geometry as Wavefront OBJ
evaltcl('render Wavefront output.obj')
```

### Coordinate Export

```python
from vmd import molecule

# Write coordinates to file
molecule.write(mol_id, 'pdb', 'output.pdb')
molecule.write(mol_id, 'gro', 'output.gro')
```

### Frame Navigation

```python
from vmd import molecule

molecule.set_frame(mol_id, 0)       # go to frame 0
nframes = molecule.numframes(mol_id)
for i in range(nframes):
    molecule.set_frame(mol_id, i)
    # ... per-frame work
```

### Cleanup

```python
from vmd import molecule
molecule.delete(mol_id)
```

## VMD TCL Script Template (CLI VMD — if `vmd` binary is available)

```tcl
# Run with: vmd -dispdev text -e script.tcl
mol new structure.pdb waitfor all
mol addfile trajectory.xtc waitfor all

# Delete default rep, add custom
mol delrep 0 top
mol representation NewCartoon
mol color Chain
mol selection {protein}
mol material AOChalky
mol addrep top

# Camera and display
display resetview
display resize 1024 768
display projection Orthographic
display depthcue off
color Display Background white
display aoambient 0.8
display aodirect 0.3

# Render (TachyonInternal only available in full VMD, not vmd-python)
display update
display update ui
render TachyonInternal output.tga
exit
```

Convert TGA to PNG (run after VMD):
```python
from PIL import Image
Image.open("output.tga").save("output.png")
print("Saved output.png")
```

## VMD TCL API Reference

### Representations

| Style | Description |
|-------|-------------|
| `NewCartoon` | Ribbon/cartoon for proteins |
| `Licorice` | Stick model (params: bond_radius resolution_cylinder resolution_sphere) |
| `VDW` | Van der Waals spheres (params: sphere_scale resolution) |
| `Surf` | Solvent-accessible surface |
| `QuickSurf` | Fast approximate surface (params: radius_scale density_isovalue grid_spacing) |
| `CPK` | Ball-and-stick (params: sphere_scale bond_radius resolution_sphere resolution_bond) |
| `Lines` | Simple line bonds |
| `Tube` | Smooth tube through backbone |
| `Trace` | CA-trace line |

| Color Method | Description |
|--------------|-------------|
| `Chain` | By chain ID |
| `Residue` | By residue index |
| `ResType` | By residue type (charged/polar/nonpolar) |
| `SecondaryStructure` | By helix/sheet/coil |
| `Name` | By atom name (CPK convention) |
| `Element` | By element |
| `ColorID 1` | Solid color by index (0=blue, 1=red, 3=orange, 4=yellow, 7=green, 10=cyan, 11=purple) |

| Material | Description |
|----------|-------------|
| `Opaque` | Default solid |
| `AOChalky` | Ambient-occluded matte (good for publication) |
| `AOEdgy` | AO with edge darkening |
| `AOShiny` | AO with specular |
| `Glossy` | High specular |
| `Transparent` | Semi-transparent |
| `Glass1` / `Glass2` / `Glass3` | Varying transparency levels |

### TCL Analysis Commands

```tcl
set sel [atomselect top "protein and name CA"]
set ref [atomselect top "protein and name CA" frame 0]
set nf  [molinfo top get numframes]

# RMSD over trajectory
set outfile [open "rmsd.dat" w]
for {set i 0} {$i < $nf} {incr i} {
    $sel frame $i
    puts $outfile "$i [measure rmsd $sel $ref]"
}
close $outfile

# Contacts
set contacts [measure contacts 3.5 $sel1 $sel2]
puts "Number of contacts: [llength [lindex $contacts 0]]"

# SASA
set sasa [measure sasa 1.4 $sel]
puts "SASA: $sasa"

# Fit / alignment
set transform [measure fit $sel $ref]
$sel move $transform
```

## MDAnalysis Python Template

```python
import matplotlib
matplotlib.use('Agg')  # must be before pyplot import
import matplotlib.pyplot as plt
import numpy as np
import MDAnalysis as mda
from MDAnalysis.analysis import align
from MDAnalysis.analysis.rms import RMSD

u   = mda.Universe('topology.gro', 'trajectory.xtc')
ref = mda.Universe('topology.gro')

R = RMSD(u, ref, select='backbone')
R.run()

time = R.results.rmsd[:, 1]
rmsd = R.results.rmsd[:, 2]

plt.figure(figsize=(8, 4))
plt.plot(time, rmsd)
plt.xlabel('Time (ps)')
plt.ylabel('RMSD (Å)')
plt.title('Backbone RMSD')
plt.tight_layout()
plt.savefig('rmsd.png', dpi=150)
print("Saved rmsd.png")
```

## MDAnalysis Python API Reference

### Loading Data

```python
# Topology + trajectory
u = mda.Universe('topology.gro', 'trajectory.xtc')
u = mda.Universe('structure.pdb', 'traj.dcd')   # PDB + DCD
u = mda.Universe('structure.psf', 'traj.dcd')   # PSF + DCD
u = mda.Universe('structure.pdb')               # single structure

# Reference structure (frame 0)
ref = mda.Universe('topology.gro')
```

Supported formats — topology: PDB, GRO, PSF, XYZ, MOL2 | trajectory: XTC, DCD, TRR

### Atom Selections

```python
protein   = u.select_atoms('protein')
backbone  = u.select_atoms('backbone')
ca        = u.select_atoms('name CA')
resid_sel = u.select_atoms('resid 1:100')
shell     = u.select_atoms('around 3.5 resname LIG')
ligand    = u.select_atoms('not protein and not resname WAT SOL')
combined  = u.select_atoms('protein or resname LIG')
```

### Properties

```python
ag = u.select_atoms('protein')
ag.positions          # (N, 3) array of XYZ coords
ag.masses             # (N,) array of masses
ag.n_atoms            # atom count
ag.residues           # ResidueGroup
ag.residues.resids    # array of residue IDs
ag.center_of_mass()   # (3,) center of mass
ag.radius_of_gyration()  # scalar Rg (Å)
```

### Analysis Modules

```python
from MDAnalysis.analysis.rms import RMSD, RMSF
from MDAnalysis.analysis import align
from MDAnalysis.analysis.hydrogenbonds.hbond_analysis import HydrogenBondAnalysis
from MDAnalysis.analysis.dssp import DSSP
from MDAnalysis.analysis.contacts import Contacts

# RMSD
R = RMSD(u, ref, select='backbone')
R.run()
# results: R.results.rmsd — shape (n_frames, 3): [frame_index, time, rmsd]

# RMSF (per-residue flexibility) — MUST align trajectory first
align.AlignTraj(u, ref, select='backbone', in_memory=True).run()
ca = u.select_atoms('protein and name CA')
rmsf = RMSF(ca)
rmsf.run()
# results: rmsf.results.rmsf — shape (n_atoms,)

# Hydrogen bonds (with configuration)
# Params: donors_sel, hydrogens_sel, acceptors_sel, between,
#         d_h_cutoff, d_a_cutoff, d_h_a_angle_cutoff, update_selections
hbonds = HydrogenBondAnalysis(
    u,
    donors_sel='protein',
    hydrogens_sel='protein',
    acceptors_sel='protein',
    d_a_cutoff=3.0,             # donor-acceptor distance Å
    d_h_a_angle_cutoff=150,     # D-H...A angle degrees
)
hbonds.run()
# results: hbonds.results.hbonds — shape (n, 6): [frame, donor_ix, hydrogen_ix, acceptor_ix, distance, angle]
n_per_frame = hbonds.count_by_time()

# Secondary structure (DSSP)
dssp = DSSP(u)
dssp.run()

# Native contacts
# Params: u, select, refgroup, method, radius, pbc
nc = Contacts(u, select=('protein and segid A', 'protein and segid B'),
              refgroup=None, radius=4.5, method='soft_cut')
nc.run()
# results: nc.results.timeseries — shape (n_frames, 2): [time, fraction]
```

### Alignment

```python
from MDAnalysis.analysis import align

# Align trajectory to reference (required before RMSF)
align.AlignTraj(u, ref, select='backbone', in_memory=True).run()

# Align single frame
align.alignto(u, ref, select='backbone')
```

### Trajectory Iteration

```python
for ts in u.trajectory:
    frame = ts.frame
    time  = u.trajectory.time   # in ps
    pos   = u.select_atoms('protein').positions
    # ... per-frame analysis
```

### Radius of Gyration

```python
rg_values = []
for ts in u.trajectory:
    rg_values.append(u.select_atoms('protein').radius_of_gyration())
```

## GROMACS Command-Line Tools (v2026.1)

Common analysis commands. `gmx rms`, `gmx rmsf`, `gmx gyrate` use **piped index-group** selection. `gmx hbond`, `gmx dssp` use **`-r`/`-t`/`-sel` selection** syntax (GROMACS 2026+).

```bash
# RMSD (piped index groups: group 1 = Protein for fit + calc)
echo "1 1" | gmx rms -s topol.tpr -f traj.xtc -o rmsd.xvg

# RMSF (per-residue)
echo "1" | gmx rmsf -s topol.tpr -f traj.xtc -o rmsf.xvg -res

# Radius of gyration
echo "1" | gmx gyrate -s topol.tpr -f traj.xtc -o gyrate.xvg

# Hydrogen bonds (GROMACS 2026 — uses -r/-t selections, NOT piped groups)
gmx hbond -s topol.tpr -f traj.xtc -num hbnum.xvg \
    -r 'group "Protein"' -t 'group "Protein"'

# Secondary structure (GROMACS 2026 — `gmx dssp`, NOT `gmx do_dssp`)
gmx dssp -s topol.tpr -f traj.xtc -o ss.dat -num ss.xvg

# Distance
gmx distance -s topol.tpr -f traj.xtc -oall dist.xvg \
    -select 'com of group "Protein" plus com of group "LIG"'

# SASA
echo "1" | gmx sasa -s topol.tpr -f traj.xtc -o sasa.xvg

# Energy
echo "Potential" | gmx energy -f ener.edr -o energy.xvg
```

### Reading GROMACS XVG Files

```python
import numpy as np

def read_xvg(filepath):
    """Read GROMACS .xvg file, skipping comment/header lines."""
    data = []
    with open(filepath) as f:
        for line in f:
            if line.startswith(('#', '@')):
                continue
            values = [float(x) for x in line.split()]
            if values:
                data.append(values)
    return np.array(data)

# Usage
data = read_xvg('rmsd.xvg')
time, rmsd = data[:, 0], data[:, 1]
```

## Common Workflow Patterns

### Protein Visualization (vmd-python)
```python
import vmd
from vmd import molecule, molrep, evaltcl, display

mol_id = molecule.load('pdb', 'protein.pdb')
molrep.delrep(0, mol_id)
evaltcl('mol representation NewCartoon')
evaltcl('mol color SecondaryStructure')
evaltcl('mol selection {protein}')
evaltcl('mol material AOChalky')
evaltcl('mol addrep top')
evaltcl('display resetview')
evaltcl('display resize 1024 768')
evaltcl('display depthcue off')
evaltcl('color Display Background white')
display.update()
display.update_ui()
evaltcl('render PostScript cartoon.ps')
molecule.delete(mol_id)
# Convert PS to PNG with Ghostscript or other tool
```

### Protein + Ligand (vmd-python)
```python
import vmd
from vmd import molecule, molrep, evaltcl, display

mol_id = molecule.load('pdb', 'complex.pdb')
molrep.delrep(0, mol_id)
# Cartoon for protein
evaltcl('mol representation NewCartoon')
evaltcl('mol color Chain')
evaltcl('mol selection {protein}')
evaltcl('mol material AOChalky')
evaltcl('mol addrep top')
# Licorice for ligand
evaltcl('mol representation Licorice 0.3 12 12')
evaltcl('mol color Name')
evaltcl('mol selection {not protein and not water}')
evaltcl('mol addrep top')
evaltcl('display resetview')
evaltcl('display resize 1024 768')
evaltcl('display depthcue off')
evaltcl('color Display Background white')
display.update()
display.update_ui()
evaltcl('render PostScript complex.ps')
molecule.delete(mol_id)
```

### VMD Analysis via Python (RMSD over trajectory)
```python
import vmd
from vmd import molecule, evaltcl
import numpy as np

mol_id = molecule.load('gro', 'topology.gro')
molecule.read(mol_id, 'xtc', 'traj.xtc', waitfor=-1)

nframes = molecule.numframes(mol_id)
evaltcl('set ref [atomselect top "protein and name CA" frame 0]')
evaltcl('set sel [atomselect top "protein and name CA"]')

rmsd_data = []
for i in range(nframes):
    evaltcl(f'$sel frame {i}')
    rmsd = float(evaltcl('measure rmsd $sel $ref'))
    rmsd_data.append(rmsd)

molecule.delete(mol_id)

# Plot with matplotlib
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
plt.plot(rmsd_data)
plt.xlabel('Frame'); plt.ylabel('RMSD (Å)')
plt.savefig('rmsd_vmd.png', dpi=150); print("Saved rmsd_vmd.png")
```

### RMSD Over Trajectory (MDAnalysis)
```python
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
import MDAnalysis as mda
from MDAnalysis.analysis.rms import RMSD

u   = mda.Universe('topology.gro', 'traj.xtc')
ref = mda.Universe('topology.gro')
R   = RMSD(u, ref, select='backbone'); R.run()

plt.figure(figsize=(8, 4))
plt.plot(R.results.rmsd[:, 1], R.results.rmsd[:, 2])
plt.xlabel('Time (ps)'); plt.ylabel('RMSD (Å)')
plt.tight_layout()
plt.savefig('rmsd.png', dpi=150); print("Saved rmsd.png")
```

### RMSF Per Residue (MDAnalysis)
```python
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
import MDAnalysis as mda
from MDAnalysis.analysis import align
from MDAnalysis.analysis.rms import RMSF

u   = mda.Universe('topology.gro', 'traj.xtc')
ref = mda.Universe('topology.gro')

# Alignment is required before RMSF
align.AlignTraj(u, ref, select='backbone', in_memory=True).run()

ca = u.select_atoms('protein and name CA')
rmsf = RMSF(ca); rmsf.run()

plt.figure(figsize=(8, 4))
plt.plot(ca.resids, rmsf.results.rmsf)
plt.xlabel('Residue'); plt.ylabel('RMSF (Å)')
plt.tight_layout()
plt.savefig('rmsf.png', dpi=150); print("Saved rmsf.png")
```

### Radius of Gyration (MDAnalysis)
```python
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
import MDAnalysis as mda

u  = mda.Universe('topology.gro', 'traj.xtc')
rg = [u.select_atoms('protein').radius_of_gyration() for ts in u.trajectory]

plt.figure(figsize=(8, 4))
plt.plot(rg); plt.xlabel('Frame'); plt.ylabel('Rg (Å)')
plt.tight_layout()
plt.savefig('rg.png', dpi=150); print("Saved rg.png")
```

### Hydrogen Bond Analysis (MDAnalysis)
```python
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
import MDAnalysis as mda
from MDAnalysis.analysis.hydrogenbonds.hbond_analysis import HydrogenBondAnalysis

u = mda.Universe('topology.gro', 'traj.xtc')
hbonds = HydrogenBondAnalysis(u, donors_sel='protein', acceptors_sel='protein',
                               d_a_cutoff=3.0, d_h_a_angle_cutoff=150)
hbonds.run()
counts = hbonds.count_by_time()

plt.figure(figsize=(8, 4))
plt.plot(counts[:, 0], counts[:, 1])
plt.xlabel('Time (ps)'); plt.ylabel('H-bonds')
plt.tight_layout()
plt.savefig('hbonds.png', dpi=150); print("Saved hbonds.png")
```

### Multi-Frame Movie (VMD CLI — if TachyonInternal available)
```tcl
mol new topology.gro type gro waitfor all
mol addfile traj.xtc type xtc waitfor all
mol delrep 0 top
mol representation NewCartoon
mol color Chain
mol selection {protein}
mol material AOChalky
mol addrep top
display resize 1024 768
display depthcue off
color Display Background white

set nf [molinfo top get numframes]
for {set i 0} {$i < $nf} {incr i} {
    animate goto $i
    display update; display update ui
    render TachyonInternal movie_$i.tga
}
exit
```
Then assemble frames: `ffmpeg -framerate 24 -i movie_%d.tga -c:v libx264 -pix_fmt yuv420p movie.mp4`

## Debugging & Error Handling

- **VMD CLI binary not found**: use vmd-python (`import vmd`) instead — it is installed in this environment
- **`TachyonInternal` not available in vmd-python**: use `PostScript`, `Tachyon` (scene file), `Wavefront` (OBJ), or `snapshot` renderers. For raster images, render PostScript and convert, or use VMD for analysis only and matplotlib for plotting
- **vmd-python atomsel**: use `atomsel('selection', molid=mol_id)` — do NOT use `atomsel.atomsel()`
- **vmd-python molecule.read**: use `waitfor=-1` to load all frames: `molecule.read(mol_id, 'xtc', 'traj.xtc', waitfor=-1)`
- **Blank render / black image (CLI VMD)**: ensure `display update; display update ui` precedes `render`; also check `color Display Background white` and `display depthcue off`
- **TGA → PNG conversion**:
  ```python
  from PIL import Image
  Image.open("output.tga").save("output.png")
  ```
- **VMD compound selections**: use braces, not quotes, for multi-word selections in TCL: `mol selection {protein and name CA}`
- **VMD exits with error**: check stderr; common cause is wrong file type — add `type xtc` / `type gro` explicitly to `mol new` / `mol addfile`
- **MDAnalysis topology mismatch**: topology and trajectory must have identical atom counts; check with `u.atoms.n_atoms`
- **RMSF gives wrong values**: trajectory must be aligned first — run `align.AlignTraj(u, ref, select='backbone', in_memory=True).run()` before RMSF
- **Periodic boundary artifacts**: call `u.atoms.wrap()` or `atomgroup.unwrap()` before analysis
- **matplotlib GUI attempt**: always `import matplotlib; matplotlib.use('Agg')` before `import matplotlib.pyplot`
- **MDAnalysis import error**: ensure installed: `pip install MDAnalysis`
- **GROMACS `do_dssp` not found**: use `gmx dssp` (GROMACS 2026+)
- **GROMACS `hbond` piped groups fail**: use `-r`/`-t` selection syntax in GROMACS 2026+
- **GROMACS XVG parsing**: skip lines starting with `#` or `@`; see `read_xvg()` helper above

## Task Execution

When given $ARGUMENTS:
1. Parse the task — determine whether it requires VMD (visualization/analysis), MDAnalysis (trajectory analysis/plotting), GROMACS (command-line analysis), or a combination
2. **For VMD tasks**: write a Python script using `import vmd` (vmd-python) for molecule loading, analysis, and scene export. Use `evaltcl()` for TCL commands. If CLI VMD is available and TachyonInternal rendering is needed, write a `.tcl` script and run with `vmd -dispdev text -e script.tcl`
3. **For MDAnalysis tasks**: write a self-contained Python script with `matplotlib.use('Agg')`, run with `python`
4. **For GROMACS tasks**: run `gmx` commands directly via Bash; use piped index groups for `rms`/`rmsf`/`gyrate`, use `-r`/`-t` selections for `hbond`/`dssp`
5. Read the output image with the Read tool to verify correctness
6. If the result needs adjustment, iterate (max 5 rounds)
7. Report the result to the user
