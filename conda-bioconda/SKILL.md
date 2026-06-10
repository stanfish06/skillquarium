---
name: conda-bioconda
description: Reproducible Conda/Mamba/micromamba environment management for bioinformatics, with correct Bioconda channel setup, environment files, version pinning, and lockfiles. Use when installing bioinformatics tools (samtools, bwa, GATK, STAR, etc.), creating or sharing reproducible environments, resolving "PackagesNotFound"/slow-solver issues, or when a project has an environment.yml. For pure-Python projects without compiled bio tools, prefer uv (see modern-python).
---

# Conda / Bioconda environment management

## Overview

Most command-line bioinformatics tools (aligners, variant callers, samtools/bcftools,
QC tools, R/Bioconductor stacks) are distributed through **Bioconda**, not PyPI. Conda
manages binary, non-Python dependencies and isolated environments. This skill covers
reproducible environment creation with the fast `mamba`/`micromamba` solver.

**When to use Conda vs uv:** use Conda/Bioconda for anything that pulls compiled binaries
or R packages (samtools, bwa, GATK, STAR, salmon, bcftools, Bioconductor). Use `uv`
(see [[modern-python]]) for pure-Python projects — it is far faster and lighter.

## Install the fast solver first

The classic `conda` solver is slow. Use **micromamba** (no base env needed) or `mamba`:

```bash
# micromamba: single static binary, recommended for CI and containers
curl -Ls https://micro.mamba.pm/install.sh | bash
# or, in an existing conda install, the modern conda (>=23.10) uses the libmamba
# solver by default; verify:
conda config --show solver   # should say libmamba
```

Use `micromamba` / `mamba` as a drop-in for `conda` in all commands below.

## Channel setup — order matters

Bioconda **requires** this exact channel priority. Get it wrong and you get broken or
missing packages:

```bash
conda config --add channels bioconda
conda config --add channels conda-forge
conda config --set channel_priority strict
# resulting priority (top wins): conda-forge > bioconda > defaults
```

`strict` priority is essential — it prevents mixing incompatible builds and dramatically
speeds up solving. Prefer setting channels per-environment in the YAML (below) over
mutating global config.

## Create environments declaratively

Never hand-install into `base`. Define an `environment.yml` and pin versions:

```yaml
name: align
channels:
  - conda-forge
  - bioconda
dependencies:
  - python=3.12
  - samtools=1.21
  - bcftools=1.21
  - bwa-mem2=2.2.1
  - star=2.7.11b
  - multiqc=1.25
  - pip
  - pip:
      - some-pypi-only-package==1.2.3
```

```bash
micromamba create -f environment.yml -y
micromamba activate align
```

One environment per project (or per pipeline stage). Keep them small — large kitchen-sink
environments are slow to solve and fragile.

## Reproducibility: pin and lock

`environment.yml` records intent; a **lockfile** records the exact solved build for
byte-reproducibility across machines/OSes.

```bash
# Quick, same-platform reproduction (records exact builds, not cross-platform):
micromamba env export -n align > env.lock.yml

# Cross-platform, hash-pinned lockfiles (recommended for shared/CI work):
pip install conda-lock
conda-lock lock -f environment.yml -p linux-64 -p osx-arm64
conda-lock install --name align conda-lock.yml
```

Commit `environment.yml` (human-edited) **and** the lockfile (machine-generated). Treat the
lockfile like `package-lock.json`: regenerate it deliberately, review the diff.

## Common operations

```bash
micromamba env list                       # list environments
micromamba list -n align                  # packages in an env
micromamba install -n align fastp         # add a tool
micromamba run -n align samtools --version  # run without activating (great for scripts)
micromamba env remove -n align
micromamba clean --all                    # reclaim disk from package cache
```

In scripts and pipelines, prefer `micromamba run -n <env> <cmd>` over `activate` — it is
non-interactive and composes cleanly with Snakemake/Nextflow per-rule environments.

## Gotchas

- **Slow/hanging solve** → you forgot `channel_priority: strict` or are using the classic
  solver. Switch to micromamba/libmamba and strict priority.
- **`PackagesNotFoundError`** → tool isn't on your channels (add `bioconda`), or you pinned
  a build/version that doesn't exist for your platform. Search: `micromamba search -c bioconda bwa-mem2`.
- **Apple Silicon (osx-arm64):** many bio tools lack arm64 builds. Create an x86 env with
  `CONDA_SUBDIR=osx-64 micromamba create ...` (runs under Rosetta).
- **Don't mix `pip install` into base/conda envs carelessly** — install pip deps via the
  `pip:` block in the YAML so they're captured in the environment definition.
- **R/Bioconductor:** install via `bioconda`/`conda-forge` (`r-base`, `bioconductor-deseq2`)
  for a managed stack; see [[bioconductor-bridge]] for the container-based alternative.

## Related

Pairs with [[modern-python]] (uv for pure-Python), [[devcontainer-setup]] and
[[nextflow]]/[[snakemake-workflow-engine]] (per-rule conda envs), and underpins the CLI
tools in [[ngs-cli-toolkit]].
