---
name: phylogenetics-builder
description: Build maximum-likelihood phylogenetic trees from aligned FASTA data using IQ-TREE 2.
license: MIT
metadata:
  openclaw:
    requires:
      bins:
      - python3
    always: false
    emoji: 🌳
    homepage: https://github.com/ClawBio/ClawBio
    os:
    - darwin
    - linux
    install:
    - kind: conda
      package: bioconda::iqtree
    trigger_keywords:
    - phylogeny
    - phylogenetic tree
    - iqtree
    - maximum likelihood tree
    - fasta alignment
    - build tree
  author: Dr. Babajan Banaganapalli
  demo_data:
  - path: demo_alignment.fasta
    description: Synthetic 5-taxon DNA sequence alignment
  dependencies:
    python: '>=3.10'
    packages:
    - pandas>=2.0
    - biopython>=1.80
    - matplotlib>=3.5
  domain: genomics
  endpoints:
    cli: python skills/phylogenetics-builder/phylogenetics_builder.py --input {input_file} --output {output_dir}
  inputs:
  - name: input_file
    type: file
    format:
    - fasta
    - fa
    - aln
    - phy
    description: Aligned DNA or protein sequences
    required: true
  outputs:
  - name: report
    type: file
    format:
    - md
    description: Analysis report
  - name: result
    type: file
    format:
    - json
    description: Machine-readable results
  - name: phylo_tree
    type: file
    format:
    - nwk
    description: Newick format phylogenetic tree
  version: 0.1.0
---

# 🦖 Phylogenetics Builder

You are **Phylogenetics Builder**, a specialised ClawBio agent for genomics. Your role is to build maximum-likelihood phylogenetic trees from aligned FASTA sequences.

## Trigger

**Fire this skill when the user says any of:**
- "build a phylogenetic tree"
- "run phylogeny analysis on this alignment"
- "build maximum likelihood tree using iq-tree"
- "run iqtree on my aligned fasta"
- "infer evolutionary tree"

**Do NOT fire when:**
- The input is a raw, unaligned FASTA (use a sequence aligner first)
- The user asks for fast k-mer / distance-based tree building (use `fastreer` instead)
- The user is analysing genomic distances without sequence alignments (use `fastreer` instead)

## Why This Exists

Phylogenetic tree inference is a cornerstone of evolutionary biology. However, standard maximum-likelihood tools are complex to install, configure, and parse.

- **Without it**: Users must manually install IQ-TREE, run it from command line, locate logs, parse the selected substitution model, parse branch support values, and write custom scripts to render the tree.
- **With it**: One command automates alignment validation, substitution model selection, maximum-likelihood tree search, UFBoot bootstrap support, parsing, tabulating branch statistics, and rendering a high-quality tree image.
- **Why ClawBio**: Integrates industry-standard IQ-TREE 2 with automated reports and reproducible environment capture local-first.

## Core Capabilities

1. **Alignment Verification**: Parses and validates FASTA alignment format, checking for sequence count, sequence length equality, and character alphabet validity.
2. **Maximum-Likelihood Search**: Runs IQ-TREE 2 with ModelFinder to auto-select the best-fit substitution model and UltraFast Bootstrap (UFBoot2) to calculate branch support values.
3. **Phylogram Rendering**: Generates a high-quality proportional phylogram using matplotlib and Bio.Phylo.
4. **Offline Demo Fallback**: Automatically falls back to a pre-computed Newick tree if IQ-TREE is not installed locally, ensuring demo functionality is always operational.

## Scope

**One skill, one task.** This skill infers a maximum-likelihood phylogenetic tree from an aligned sequence file and nothing else. It does not perform sequence alignment itself.

## Input Formats

| Format | Extension | Required Fields | Example |
|--------|-----------|-----------------|---------|
| Aligned FASTA | `.fasta`, `.fa`, `.aln`, `.phy` | Equal length DNA or amino acid sequences | `demo_alignment.fasta` |

## Workflow

When the user asks for tree building:

1. **Validate**: Read the input FASTA file, verify that it contains at least 3 sequences, and check that all sequences are of equal length.
2. **Detect Environment**: Check if `iqtree` or `iqtree2` is available on the system PATH.
3. **Execute Core Analysis**:
    - If `iqtree` is found: Run a child process calling IQ-TREE with automated model selection (`-m TEST`) and 1000 bootstrap replicates (`-B 1000`).
    - If `iqtree` is not found (or in demo mode without the binary): Fall back to the pre-computed tree topology matching the demo dataset.
4. **Parse Output**: Extract the best substitution model and parse the generated Newick tree string. Parse branch lengths and bootstrap values.
5. **Render Graph**: Draw the phylogram using Bio.Phylo and save it to the output figures folder.
6. **Generate Report**: Write the summary `report.md` (with disclaimer), structured `result.json`, and reproducibility bundle to the output directory.

**Freedom level guidance:**
- The invocation of IQ-TREE 2 and parsing of the Newick tree string must be strictly prescriptive.
- The narrative description of the evolutionary findings can be composed flexibly by the agent.

## CLI Reference

```bash
# Standard usage
python skills/phylogenetics-builder/phylogenetics_builder.py \
  --input <alignment_file> --output <output_dir>

# Demo mode (synthetic data, no external binary required)
python skills/phylogenetics-builder/phylogenetics_builder.py --demo --output /tmp/phylo_demo

# Via ClawBio runner
python clawbio.py run phylo --demo
python clawbio.py run phylo --input <alignment_file> --output <output_dir>
```

## Demo

To verify the skill works:

```bash
python clawbio.py run phylo --demo
```

Expected output: A report containing the selected substitution model (e.g., GTR+G), taxon counts, Newick tree string, parsed branch support table, and a tree diagram at `figures/phylogram.png`.

## Algorithm / Methodology

1. **Model Selection**: IQ-TREE's ModelFinder calculates likelihoods under various substitution models (e.g., JC, HKY, GTR for DNA) and chooses the model with the minimum Bayesian Information Criterion (BIC).
2. **Tree Search**: Performs stochastic hill-climbing to find the tree that maximizes the probability of observing the alignment.
3. **Branch Support**: Calculates UltraFast Bootstrap (UFBoot2) values. Support values range from 0 to 100, where values >= 95 are considered highly reliable.

## Example Queries

- "Build a maximum likelihood tree for these aligned sequences"
- "Run phylogenetic tree inference on alignment.fasta"
- "Run iqtree2 on my FASTA file"

## Example Output

```markdown
# Phylogenetics Builder Report

**Input**: demo_alignment.fasta
**Taxa Count**: 5
**Substitution Model**: GTR+F+I+G4 (Selected via ModelFinder)

| Node | Ancestor | Descendant | Length | UFBoot Support |
|------|----------|------------|--------|----------------|
| Node1| Root     | SpeciesA   | 0.045  | 100            |
| Node2| Root     | SpeciesB   | 0.052  | 98             |

## Tree Visualization

Proportional phylogram image generated at `figures/phylogram.png`.

## Summary
The maximum-likelihood tree search has converged. Taxa are clustered according to evolutionary distances.

*ClawBio is a research and educational tool. It is not a medical device and does not provide clinical diagnoses. Consult a healthcare professional before making any medical decisions.*
```

## Output Structure

```
output_directory/
├── report.md                  # Primary markdown report
├── result.json                # Machine-readable results
├── phylo_tree.nwk             # Newick format tree file
├── figures/
│   └── phylogram.png          # Matplotlib tree rendering
├── tables/
│   └── branch_support.csv     # Parsed branch lengths and support values
└── reproducibility/
    ├── commands.sh            # Reproduction commands
    └── environment.yml        # Conda environment definition
```

## Dependencies

**Required**:
- `pandas` >= 2.0; tabular data handling
- `biopython` >= 1.80; FASTA parsing and Bio.Phylo tree parsing
- `matplotlib` >= 3.5; drawing phylogram figures

**Optional**:
- `iqtree` or `iqtree2` binary; for running actual tree inferences rather than falling back to demo files.

## Gotchas

- **Gotcha 1**: The model will want to align sequences before building the tree. Do not do this. This skill assumes input sequences are pre-aligned and of equal length. Reject unaligned inputs with clear warnings.
- **Gotcha 2**: When sequences have unequal length, IQ-TREE will fail. The script must preemptively validate length equality and raise a clear ValueError before calling subprocesses.
- **Gotcha 3**: Model names are case-sensitive in IQ-TREE. Ensure you let ModelFinder select the model automatically rather than hardcoding incorrect case-sensitive models.
- **Gotcha 4**: Bio.Phylo drawing requires a non-interactive matplotlib backend (e.g. Agg) in headless environments. Make sure matplotlib uses the correct backend to prevent GUI errors.
- **Gotcha 5**: Empty taxon names or duplicate names can cause parsing errors. Always clean and assert uniqueness of sequence headers before passing to IQ-TREE.

## Safety

- **Local-first**: IQ-TREE runs entirely locally on patient data.
- **Disclaimer**: Every report includes the ClawBio medical disclaimer.
- **Audit trail**: Subprocess calls are recorded in the reproducibility bundle.
- **No hallucinated science**: Models and distances are calculated directly from local data.

## Agent Boundary

The agent (LLM) dispatches and explains. The skill (Python) executes. The agent must NOT invent tree branch support values or override model selections.

## Integration with Bio Orchestrator

**Trigger conditions**: the orchestrator routes here when:
- The input is a FASTA file (`.fasta`, `.fa`, `.aln`) and the user mentions "tree", "phylogeny", or "iqtree".

**Chaining partners**: this skill connects with:
- `profile-report`: Adds evolutionary tree findings to patient profiles.

## Maintenance

- **Review cadence**: Re-evaluate this skill bi-annually.
- **Staleness signals**: Deprecation of IQ-TREE 2 commands or Bio.Phylo APIs.
- **Deprecation**: Archive if superseded by more modern tools.

## Citations

- [IQ-TREE 2 Paper](https://doi.org/10.1093/molbev/msaa015); Nguyen et al., 2020.
- [Bio.Phylo Module](https://doi.org/10.1186/1471-2105-13-209); Talevich et al., 2012.
