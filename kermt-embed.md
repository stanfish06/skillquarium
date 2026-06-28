---
title: kermt-embed
aliases:
  - kermt embed
tags:
  - skill
  - domain/drug-discovery-chem
domain: drug-discovery-chem
status: untried
source: kermt-embed/SKILL.md
created: 2026-06-28
---

# kermt-embed

> [!info] What it does
> Extract per-molecule embeddings from any encoder-bearing KERMT checkpoint (grover_base / cmim / hybrid / finetuned). Writes one .npy per readout type (atom_from_atom, bond_from_atom, atom_from_bond, bond_from_bond) plus canonical_smiles.npy and validity.npy. Calls task/extract_embeddings.py (which featurizes SMILES on the fly — no pre-computed features needed).

**Source:** [kermt-embed/SKILL.md](kermt-embed/SKILL.md)  ·  **Domain:** [Drug Discovery, Cheminformatics & Structural Biology](maps/drug-discovery-chem.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

_None auto-detected. Add your own links here, e.g. `[scanpy](scanpy.md)`._

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

