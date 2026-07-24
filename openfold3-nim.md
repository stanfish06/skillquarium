---
title: openfold3-nim
aliases:
  - openfold3 nim
tags:
  - skill
  - domain/drug-discovery-chem
domain: drug-discovery-chem
status: untried
source: openfold3-nim/SKILL.md
created: 2026-06-28
---

# openfold3-nim

> [!info] What it does
> Use this skill for OpenFold3, NVIDIA's BioNeMo NIM microservice for biomolecular structure prediction. Invoke whenever the user mentions OpenFold3 or needs protein, protein-ligand, protein-DNA/RNA, or multi-chain complex prediction with the hosted NVIDIA API or local Docker NIM. Covers endpoint choice, auth, request payloads, output artifacts, confidence scores, and local container setup.

**Source:** [openfold3-nim/SKILL.md](openfold3-nim/SKILL.md)  ·  **Domain:** [Drug Discovery, Cheminformatics & Structural Biology](maps/drug-discovery-chem.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [docker](docker.md) — Containerizing and shipping applications with Docker — writing efficient Dockerfiles (multi-stage builds, layer caching, small/secure images), docker compose for multi-service local...

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

> [!note] Vault audit 2026-07-24 — USE-11
> Use this for the hosted NVIDIA OpenFold3 NIM covering protein, protein-ligand, protein-DNA/RNA, and multi-chain complexes; for monomer-only folding use `openfold2-nim`, and for local AF2 use `colabfold`. Complex-capable NIM vs monomer NIM vs local is the routing axis.

