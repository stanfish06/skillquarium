---
title: Drug Discovery, Cheminformatics & Structural Biology
tags:
  - skill-map
created: 2026-06-13
---

# Drug Discovery, Cheminformatics & Structural Biology

> [!abstract] Scope
> Small-molecule and protein modeling: cheminformatics, docking, structure prediction, and target validation.

[Back to Skill Index](../index.md)

**Related maps:** [Proteomics & Metabolomics](proteomics-metabolomics.md) | [Sequence Analysis, NGS & Phylogenetics](sequence-phylogenetics.md) | [Bio Databases, Lab & Cloud Platforms](bio-databases-platforms.md) | [Machine Learning & AI](ml-ai.md)

## Skills (48)

- [adaptyv](../adaptyv.md) — How to use the Adaptyv Bio Foundry API and Python SDK for protein experiment design, submission, and results retrieval
- [boltz2-nim](../boltz2-nim.md) — Use Boltz2 NIM for biomolecular structure prediction and binding affinity
- [cobrapy](../cobrapy.md) — Constraint-based metabolic modeling (COBRA)
- [colabfold](../colabfold.md) — Fast AlphaFold2/ColabFold protein structure prediction
- [complexa-design](../complexa-design.md) — End-to-end Proteina-Complexa design pipeline driver
- [complexa-evaluate-pdbs](../complexa-evaluate-pdbs.md) — Standalone evaluation of an existing PDB directory with Proteina-Complexa
- [complexa-setup](../complexa-setup.md) — First-time setup, environment configuration, and model-weight installation for Proteina-Complexa
- [complexa-slurm](../complexa-slurm.md) — Launch Proteina-Complexa pipelines on a remote SLURM cluster — binder search, LaProteina monomer design, or multi-node distributed training
- [complexa-sweep](../complexa-sweep.md) — Use this skill whenever the user wants to run a parameter sweep over a Proteina-Complexa design pipeline — cartesian-product hyperparameter scans, Pareto search over...
- [complexa-target](../complexa-target.md) — Use this skill whenever the user wants to add, register, edit, list, show, or validate a Proteina-Complexa design target for any pipeline — protein binder (default), ligand binder, or...
- [crispr-screen-triage](../crispr-screen-triage.md) — Deterministic CRISPR screen hit ranking from local guide-level count tables
- [datamol](../datamol.md) — Pythonic wrapper around RDKit with simplified interface and sensible defaults
- [deepchem](../deepchem.md) — Molecular ML with diverse featurizers and pre-built datasets
- [depmap](../depmap.md) — Query the Cancer Dependency Map (DepMap) for cancer cell line gene dependency scores (CRISPR Chronos), drug sensitivity data, and gene effect profiles
- [diffdock](../diffdock.md) — DiffDock and DiffDock-L molecular docking
- [diffdock-nim](../diffdock-nim.md) — Run DiffDock molecular docking via NVIDIA NIM to predict small-molecule binding poses against protein targets
- [drug-discovery-pipeline](../drug-discovery-pipeline.md) — Run a complete computational drug discovery pipeline using NVIDIA BioNeMo NIMs: generate drug-like molecules with GenMol, dock them to a protein target with DiffDock, then predict...
- [drug-repurposing-screen](../drug-repurposing-screen.md) — Objective-driven pooled viability screen analysis: QC, hit calling, context-selectivity, biomarker sweep, and ranked repurposing candidates
- [esm](../esm.md) — Use when working directly with the `esm` Python SDK, ESM3 or ESMC model IDs, Forge/Biohub inference clients, or ESMFold2 folding workflows
- [genmol-nim](../genmol-nim.md) — Generate novel drug-like molecules using the GenMol NIM microservice
- [kermt-add-cmim-pretrain](../kermt-add-cmim-pretrain.md) — Convert a grover_base checkpoint (encoder-only or encoder + vocab heads) into a hybrid checkpoint by adding a randomly-initialized cMIM decoder + latent_dist, then continue pretraining...
- [kermt-continue-pretrain](../kermt-continue-pretrain.md) — Continue pretraining from an existing KERMT checkpoint
- [kermt-embed](../kermt-embed.md) — Extract per-molecule embeddings from any encoder-bearing KERMT checkpoint (grover_base / cmim / hybrid / finetuned)
- [kermt-finetune](../kermt-finetune.md) — Finetune a pretrained KERMT encoder on a labeled CSV
- [kermt-infer](../kermt-infer.md) — Run predictions with a finetuned KERMT checkpoint on a SMILES-only CSV
- [kermt-monitor](../kermt-monitor.md) — Check progress for a detached KERMT run (pretrain, finetune, or any kermt_run_detached invocation)
- [kermt-pretrain-scratch](../kermt-pretrain-scratch.md) — Pretrain a fresh KERMT model from scratch on a user-provided corpus
- [kermt-setup](../kermt-setup.md) — Bootstrap the KERMT agent environment — verify host docker + nvidia-container-toolkit, build the kermt:latest image from the repo's Dockerfile if it doesn't yet exist, and run a GPU...
- [medchem](../medchem.md) — Medicinal chemistry filters for compound triage
- [molecular-docking](../molecular-docking.md) — Classical, physics-based protein-ligand docking with AutoDock Vina (and smina, plus GNINA for CNN-rescoring)
- [molecular-dynamics](../molecular-dynamics.md) — Run and analyze molecular dynamics simulations with OpenMM and MDAnalysis
- [molfeat](../molfeat.md) — Molecular featurization for ML (100+ featurizers)
- [molmim-nim](../molmim-nim.md) — Use this skill for MolMIM, NVIDIA's BioNeMo NIM microservice for small-molecule latent-space generation and optimization
- [nvmolkit-usage](../nvmolkit-usage.md) — Write code that calls the installed nvMolKit Python API for GPU-accelerated, batched RDKit-style operations - Morgan fingerprints, Tanimoto/cosine similarity, ETKDG conformer...
- [omics-target-evidence-mapper](../omics-target-evidence-mapper.md) — Aggregate public target-level evidence across omics and translational sources for research triage
- [openfold2-nim](../openfold2-nim.md) — Use this skill for OpenFold2, NVIDIA's BioNeMo NIM microservice for monomer protein structure prediction
- [openfold3-nim](../openfold3-nim.md) — Use this skill for OpenFold3, NVIDIA's BioNeMo NIM microservice for biomolecular structure prediction
- [proteinmpnn-nim](../proteinmpnn-nim.md) — Run ProteinMPNN inverse folding via NVIDIA NIM to design protein sequences for a target backbone
- [pymol](../pymol.md) — Visualize, analyze, and render protein and molecular structures using PyMOL
- [pytdc](../pytdc.md) — Therapeutics Data Commons. AI-ready drug discovery datasets (ADME, toxicity, DTI), benchmarks, scaffold splits, molecular oracles, for therapeutic ML and pharmacological prediction
- [rdkit](../rdkit.md) — Cheminformatics toolkit for fine-grained molecular control
- [rfdiffusion-nim](../rfdiffusion-nim.md) — Run RFDiffusion protein backbone design via NVIDIA NIM
- [rowan](../rowan.md) — Rowan is a cloud-native molecular modeling and medicinal-chemistry workflow platform with a Python API
- [struct-predictor](../struct-predictor.md) — Protein structure prediction with Boltz-2
- [structural-biology](../structural-biology.md) — Structure retrieval, confidence-aware AlphaFold DB usage, coordinate download, PAE and pLDDT interpretation, and structure-guided biological annotation
- [target-validation-scorer](../target-validation-scorer.md) — Evidence-grounded target validation scoring with GO/NO-GO decisions for drug discovery campaigns
- [torchdrug](../torchdrug.md) — PyTorch-native graph neural networks for molecules and proteins
- [vmd-mdanalysis-viz](../vmd-mdanalysis-viz.md) — Headless molecular visualization and trajectory analysis with VMD, MDAnalysis, and GROMACS
