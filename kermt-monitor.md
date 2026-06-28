---
title: kermt-monitor
aliases:
  - kermt monitor
tags:
  - skill
  - domain/drug-discovery-chem
domain: drug-discovery-chem
status: untried
source: kermt-monitor/SKILL.md
created: 2026-06-28
---

# kermt-monitor

> [!info] What it does
> Check progress for a detached KERMT run (pretrain, finetune, or any kermt_run_detached invocation). Reads run.json, queries docker for container state, tails the pretrain/finetune log, and parses progress lines (epoch, step, val loss).

**Source:** [kermt-monitor/SKILL.md](kermt-monitor/SKILL.md)  ·  **Domain:** [Drug Discovery, Cheminformatics & Structural Biology](maps/drug-discovery-chem.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [docker](docker.md) — Containerizing and shipping applications with Docker — writing efficient Dockerfiles (multi-stage builds, layer caching, small/secure images), docker compose for multi-service local...

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

