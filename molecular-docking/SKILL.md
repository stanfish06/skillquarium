---
name: molecular-docking
description: Classical, physics-based protein-ligand docking with AutoDock Vina (and smina, plus GNINA for CNN-rescoring). Use for receptor/ligand prep (Meeko, OpenBabel, RDKit), defining the search box (center + size), running docking, interpreting affinity scores, pose analysis, virtual screening, and rescoring DiffDock poses with GNINA. Trigger terms: "docking", "AutoDock Vina", "smina", "GNINA", "protein-ligand", "virtual screening", "binding pose", "PDBQT", "dock this ligand", "rescore poses".
license: MIT
metadata: {"version": "1.0", "skill-author": "vault-audit"}
---

# Molecular Docking (Vina / smina / GNINA)

## Overview

Classical, physics-based docking searches for the pose (position + orientation + torsions) of a
small-molecule ligand in a protein pocket and scores it with an empirical/knowledge-based function.
Use this skill for **AutoDock Vina** and its relatives: **smina** (a Vina fork with flexible box
handling and custom scoring) and **GNINA** (smina + convolutional-neural-net rescoring). These give
you a *binding-affinity estimate* (kcal/mol) — the piece that deep-learning pose generators like
DiffDock deliberately do not provide. A common pattern is: generate poses with DiffDock, then
**rescore them here** with GNINA or a Vina local-optimize.

**Current baseline (checked 2026-07):**
- AutoDock Vina **1.2.7** (Feb 2025); 1.2.x line — Python bindings, Vinardo + AD4 scoring, multi-ligand docking.
- GNINA **1.3.3** — PyTorch-backed CNN scoring, `--cnn=fast` distilled model for screening, covalent docking.
- Meeko **0.6.x** — `mk_prepare_ligand.py` / `mk_prepare_receptor.py` for PDBQT prep.

## Installation

```bash
# Vina: CLI binary + Python bindings
conda install -c conda-forge vina          # or: pip install vina  (numpy required)
# Ligand/receptor prep
pip install meeko                           # 0.6.x; pulls RDKit, prody
conda install -c conda-forge openbabel      # obabel: format conversion, protonation, 3D
# smina (single static binary) and GNINA
conda install -c conda-forge smina
# GNINA: prefer the official prebuilt binary or Docker (needs libmolgrid + CUDA for GPU)
docker pull gnina/gnina                     # or download the release binary and `chmod +x`
gnina --version
```

GNINA and smina read plain PDB/SDF/MOL2 directly (they convert internally via OpenBabel), so
**PDBQT is only strictly required for Vina itself.**

## Core workflow

### 1. Receptor prep (protein -> PDBQT)

Start from a clean PDB: remove waters/heteroatoms you do not want, keep or model missing residues,
add hydrogens at the target pH, and assign charges. Two supported routes:

```bash
# Meeko (recommended for Vina 1.2; also emits a Vina box config, see step 3)
mk_prepare_receptor.py --read_with_prody receptor.pdb -o receptor -p   # -> receptor.pdbqt
# ADFR suite alternative
prepare_receptor -r receptor.pdb -o receptor.pdbqt
```

Add hydrogens first if the PDB lacks them (e.g. `reduce receptor.pdb > receptor_H.pdb`, or via
PyMOL/OpenBabel). For a flexible-sidechain run, Meeko takes `-f <chain:resid,...>` and writes a
separate `_flex.pdbqt`.

### 2. Ligand prep (2D/SMILES -> 3D, protonated -> PDBQT)

Meeko requires input with **explicit hydrogens and 3D coordinates**, so build those first with RDKit
or OpenBabel, then convert:

```python
# RDKit: SMILES -> protonated 3D SDF
from rdkit import Chem
from rdkit.Chem import AllChem
mol = Chem.AddHs(Chem.MolFromSmiles("CC(=O)Oc1ccccc1C(=O)O"))
AllChem.EmbedMolecule(mol, randomSeed=0xf00d)
AllChem.MMFFOptimizeMolecule(mol)
Chem.SDWriter("ligand.sdf").write(mol)
```

```bash
# OR OpenBabel: generate 3D + set protonation for pH 7.4
obabel "smi:CC(=O)Oc1ccccc1C(=O)O" -O ligand.sdf --gen3d -p 7.4
# Then convert to PDBQT (needs 3D + explicit H already present)
mk_prepare_ligand.py -i ligand.sdf -o ligand.pdbqt
# Many ligands from one SDF:
mk_prepare_ligand.py -i library.sdf --multimol_outdir pdbqt_out/
```

### 3. Define the search box (center + size)

The box is a rectangular grid: three center coordinates and three edge lengths (Angstroms).
**Targeted** docking centers on a known pocket (e.g. a co-crystallized ligand's centroid); a box of
~20-25 A per side comfortably covers a drug-like ligand plus wiggle room. **Blind** docking sizes the
box to the whole protein (accept lower accuracy). Helpers:

```bash
# Meeko: derive a Vina box config that envelops a reference ligand + padding
mk_prepare_receptor.py --read_with_prody receptor.pdb -o receptor -p \
    -v --box_enveloping crystal_ligand.sdf --padding 5     # -> receptor.box.txt (Vina config)
# smina/gnina: skip manual coords, auto-box from a reference ligand
smina -r receptor.pdbqt -l ligand.pdbqt --autobox_ligand crystal_ligand.sdf --autobox_add 4 -o out.sdf
```

Get a centroid manually from a reference ligand SDF/PDB by averaging its heavy-atom coordinates.

### 4. Run docking

**Vina CLI:**

```bash
vina --receptor receptor.pdbqt --ligand ligand.pdbqt \
     --center_x 11.0 --center_y 22.5 --center_z 7.3 \
     --size_x 22 --size_y 22 --size_z 22 \
     --exhaustiveness 32 --num_modes 20 \
     --out docked.pdbqt
# A --config box.txt file can supply center/size instead of the six flags.
# Alternative scoring:  --scoring vinardo   (or --scoring ad4 with AD4 maps)
```

**Vina Python API** (scriptable, good for screening loops):

```python
from vina import Vina
v = Vina(sf_name="vina")                    # or "vinardo" / "ad4"
v.set_receptor("receptor.pdbqt")
v.set_ligand_from_file("ligand.pdbqt")
v.compute_vina_maps(center=[11.0, 22.5, 7.3], box_size=[22, 22, 22])
v.dock(exhaustiveness=32, n_poses=20)
v.write_poses("docked.pdbqt", n_poses=9, overwrite=True)
print(v.energies())                         # per-pose scores (kcal/mol)
```

### 5. Analyze poses and scores

Vina writes poses to a multi-model PDBQT, best (most negative) first; each `REMARK VINA RESULT`
line holds the affinity in kcal/mol. Convert to SDF/PDB for viewing (see the `pymol` skill):

```bash
obabel docked.pdbqt -O docked.sdf -m        # split models to separate SDF files
```

Interpretation: Vina affinity is a **rough empirical estimate** — trust the *ranking* far more than
the absolute number. Drug-like hits often land around -7 to -11 kcal/mol, but this is
target-dependent; always inspect the top pose for chemical sensibility (H-bonds, no clashes,
buried hydrophobics) before believing a score.

### 6. GNINA rescoring (and DiffDock hand-off)

GNINA re-scores an existing pose with a CNN, giving `CNNscore` (pose quality, 0-1) and `CNNaffinity`
(predicted pKd/pKi, higher = stronger); `minimizedAffinity` is the Vina-style kcal/mol.

```bash
# Score a pose in place (no re-docking)
gnina -r receptor.pdb -l pose.sdf --score_only
# Local-optimize the pose, then score (recommended for imported poses)
gnina -r receptor.pdb -l pose.sdf --minimize -o pose_min.sdf
# Full GNINA docking with CNN rescoring
gnina -r receptor.pdb -l ligand.sdf --autobox_ligand crystal_ligand.sdf \
      --cnn_scoring rescore -o gnina_docked.sdf
```

**Rescoring DiffDock output** (the `diffdock` skill generates `rankN.sdf` poses but scores confidence,
not affinity — this fills that gap):

```bash
for pose in diffdock_out/complex_0/rank*.sdf; do
    gnina -r receptor.pdb -l "$pose" --minimize --score_only 2>/dev/null \
        | awk -v f="$pose" '/CNNaffinity/{print f, $2}'
done | sort -k2 -rn        # re-rank DiffDock poses by predicted affinity
```

For higher-accuracy affinity, follow with MM/GBSA (AmberTools `MMPBSA.py`, `gmx_MMPBSA`) or FEP after
energy minimization — beyond this skill's scope.

## Gotchas / best practices

- **Protonation & tautomers dominate results.** Dock the *biologically relevant* protonation state at
  target pH; a wrong charge on an amine/carboxylate or the wrong tautomer changes both pose and score.
  Enumerate tautomers/protomers upstream (OpenBabel `-p`, RDKit, or Dimorphite) rather than trusting a default.
- **Box too small silently clips poses** — the ligand cannot exit the pocket or sample its real
  binding mode. Box too large wastes sampling and *lowers* accuracy; scale to ligand + pocket, not the whole protein unless doing blind docking.
- **Scoring functions are approximate.** Vina/Vinardo ignore explicit waters, polarization, and
  entropy; they rank far better than they predict absolute ΔG. Do not over-interpret a 0.3 kcal/mol gap. GNINA CNN scores help re-rank but are not calibrated affinities.
- **Raise `--exhaustiveness`** (8 default -> 16-32) for flexible ligands or large boxes, and dock a
  few independent replicates; pose scatter across runs signals an under-sampled or poorly defined pocket.
- **Validate by redocking** the co-crystal ligand: RMSD < ~2 A to the crystal pose confirms your box,
  prep, and parameters before you trust novel ligands.
- **Blind vs targeted:** prefer targeted docking whenever a pocket is known (from a co-crystal, DiffDock,
  or a pocket-finder); reserve blind docking for genuine unknown-site cases and treat it as hypothesis-generation.
- **Rigid receptor by default** — Vina keeps the protein rigid. For known induced-fit sites, use
  flexible sidechains (Meeko `-f`) or dock to an ensemble of conformations.

## Use this vs related skills

Use **`diffdock`** for deep-learning pose *generation* (then rescore poses here); **`rdkit`** for
cheminformatics ligand prep (3D embedding, protonation, SMILES handling); **`pymol`** to visualize
receptor/poses; **`molecular-dynamics`** for downstream relaxation/MM-GBSA. `cobrapy` (metabolic flux)
and other systems-biology skills are unrelated to docking.
