---
title: kermt-setup
aliases:
  - kermt setup
tags:
  - skill
  - domain/drug-discovery-chem
domain: drug-discovery-chem
status: untried
source: skills/kermt-setup/SKILL.md
created: 2026-06-28
---

# kermt-setup

> [!info] What it does
> Bootstrap the KERMT agent environment — verify host docker + nvidia-container-toolkit, build the kermt:latest image from the repo's Dockerfile if it doesn't yet exist, and run a GPU smoke test inside the container. Every other kermt-* skill depends on this; invoke it first.

**Source:** [skills/kermt-setup/SKILL.md](../../../skills/kermt-setup/SKILL.md)  ·  **Domain:** [Drug Discovery, Cheminformatics & Structural Biology](../../maps/drug-discovery-chem.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [bootstrap](../../notes/web-automation-frontend/bootstrap.md) — Project bootstrapping orchestrator for repos that depend on Vercel-linked resources (databases, auth, and managed integrations)
- [docker](../../notes/software-dev/docker.md) — Containerizing and shipping applications with Docker — writing efficient Dockerfiles (multi-stage builds, layer caching, small/secure images), docker compose for multi-service local...

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
