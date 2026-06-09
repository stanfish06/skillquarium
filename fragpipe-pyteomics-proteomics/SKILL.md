---
name: fragpipe-pyteomics-proteomics
description: DDA/DIA mass-spectrometry proteomics workflows with FragPipe, MSFragger, IonQuant, DIA-NN, Pyteomics, pyopenms, matchms, polars, and query. Use when searching raw proteomics data, controlling peptide/protein FDR, parsing mzML/mzIdentML/mzTab/MGF, or prototyping downstream proteomics analysis in Python.
---

# FragPipe + Pyteomics Proteomics

Use this skill for bottom-up mass-spectrometry proteomics workflows where raw spectra need database searching, quantification, FDR control, or downstream Python parsing.

## Routing

- Use `pyopenms` for OpenMS-native algorithms and feature maps.
- Use `matchms` for metabolomics spectra and spectral similarity.
- Use this skill for FragPipe/MSFragger-style proteomics searches or lightweight Python parsing with Pyteomics.

## FragPipe Workflow

1. Collect inputs:
   - raw vendor files or converted `mzML`
   - FASTA database with contaminants/decoys
   - sample sheet and experimental design
2. Choose workflow:
   - DDA search with MSFragger and Philosopher.
   - Label-free quantification with IonQuant.
   - DIA analysis with DIA-NN when the experiment is DIA/SWATH-like.
3. Set search parameters deliberately:
   - enzyme, missed cleavages, precursor/fragment tolerance
   - fixed and variable modifications
   - isotope error and mass calibration
4. Validate outputs:
   - peptide-spectrum match FDR
   - peptide and protein FDR
   - missingness by run/sample
   - contaminant and decoy rates
5. Export clean tables for downstream analysis:
   - protein/peptide intensity matrices
   - annotation columns
   - QC summaries and parameter files

## Pyteomics Patterns

Use Pyteomics for parsing and quick analysis:

```python
from pyteomics import mzml, mgf, fasta

with mzml.read("run.mzML") as spectra:
    first_ms2 = next(s for s in spectra if s.get("ms level") == 2)
```

Good Pyteomics tasks:

- Inspect `mzML`, `MGF`, `mzIdentML`, `mzTab`, and FASTA files.
- Prototype peptide mass calculations and digestion logic.
- Join search outputs with metadata before using `polars`, `pandas`, or `duckdb`.

## Reporting

Always report database, enzyme, modifications, FDR thresholds, quantification method, normalization method, and software versions. These details are required for reproducible proteomics analysis.
