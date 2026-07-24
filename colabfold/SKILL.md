---
name: colabfold
description: Fast AlphaFold2/ColabFold protein structure prediction. Use when predicting monomer or multimer protein structures from FASTA, running colabfold_batch, interpreting pLDDT/PAE, or preparing predicted structures for docking, molecular dynamics, or publication figures.
---

# ColabFold

> [!note] Vault audit 2026-07-24 — USE-11
> Use this for local/batch AlphaFold2-style monomer or multimer folding from FASTA; for the hosted OpenFold NIMs use `openfold2-nim` (monomer) / `openfold3-nim` (complex), for local Boltz-2 use `struct-predictor`, and to just retrieve existing/AlphaFold DB structures use `structural-biology`. Local AF2 predict vs hosted NIM vs retrieve is the routing axis.

Use this skill for local or batch AlphaFold2-style protein structure prediction with ColabFold. It is especially useful when users need a familiar reference workflow, multimer predictions, or many FASTA sequences processed consistently.

## Routing

- Use `struct-predictor` when the task is about the vault's Boltz-oriented structure workflow.
- Use this skill when the user asks for AlphaFold2, ColabFold, `colabfold_batch`, pLDDT, PAE, MSA generation, or protein complex prediction.
- Use `diffdock` after structure prediction when the next step is ligand docking.
- Use `molecular-dynamics` when the next step is relaxation, simulation, or trajectory analysis.

## Batch Pattern

Input FASTA:

```text
>protein_a
MSEQUENCE...
```

Run:

```bash
colabfold_batch input.fasta colabfold_out
```

For multimers, encode chains with `:` in the sequence or use the format supported by the installed ColabFold version.

## Interpretation

- pLDDT: local confidence. Treat low-confidence loops/tails cautiously.
- PAE: domain-domain and chain-chain placement confidence.
- Ranking score: useful for triage, not a substitute for biological validation.
- Multimer interfaces require special scrutiny; inspect PAE and interface contacts.

## Practical Checks

- Remove signal peptides, tags, or low-complexity tails only when biologically justified.
- Use the same FASTA identifiers across prediction, docking, and MD outputs.
- Keep all JSON/PAE outputs, not just the top PDB.
- For publications, report ColabFold version, model preset, database/MSA mode, and whether templates were used.

