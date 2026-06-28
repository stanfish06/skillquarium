---
title: kermt-setup
aliases:
  - kermt setup
tags:
  - skill
  - domain/drug-discovery-chem
domain: drug-discovery-chem
status: untried
source: kermt-setup/SKILL.md
created: 2026-06-28
---

# kermt-setup

> [!info] What it does
> Bootstrap the KERMT agent environment — verify host docker + nvidia-container-toolkit, build the kermt:latest image from the repo's Dockerfile if it doesn't yet exist, and run a GPU smoke test inside the container. Every other kermt-* skill depends on this; invoke it first.

**Source:** [kermt-setup/SKILL.md](kermt-setup/SKILL.md)  ·  **Domain:** [Drug Discovery, Cheminformatics & Structural Biology](maps/drug-discovery-chem.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [docker](docker.md) — Containerizing and shipping applications with Docker — writing efficient Dockerfiles (multi-stage builds, layer caching, small/secure images), docker compose for multi-service local...

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

