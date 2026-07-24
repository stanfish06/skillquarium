---
title: openfold2-nim
aliases:
  - openfold2 nim
tags:
  - skill
  - domain/drug-discovery-chem
domain: drug-discovery-chem
status: untried
source: openfold2-nim/SKILL.md
created: 2026-06-28
---

# openfold2-nim

> [!info] What it does
> Use this skill for OpenFold2, NVIDIA's BioNeMo NIM microservice for monomer protein structure prediction. Invoke whenever the user mentions OpenFold2, AlphaFold2-like monomer folding, protein sequence-to-structure prediction, A3M MSAs, mmCIF templates, hosted NVIDIA API calls, or local Docker deployment.

**Source:** [openfold2-nim/SKILL.md](openfold2-nim/SKILL.md)  ·  **Domain:** [Drug Discovery, Cheminformatics & Structural Biology](maps/drug-discovery-chem.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [docker](docker.md) — Containerizing and shipping applications with Docker — writing efficient Dockerfiles (multi-stage builds, layer caching, small/secure images), docker compose for multi-service local...

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

> [!note] Vault audit 2026-07-24 — USE-11
> Use this for the hosted NVIDIA OpenFold2 NIM (AlphaFold2-like monomer folding only); for monomer-or-complex prediction use `openfold3-nim`, and for local AF2 folding use `colabfold`. Hosted monomer NIM vs complex-capable NIM vs local is the routing axis.

