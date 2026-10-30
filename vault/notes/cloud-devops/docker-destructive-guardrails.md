---
title: docker-destructive-guardrails
aliases:
  - docker destructive guardrails
tags:
  - skill
  - domain/cloud-devops
domain: cloud-devops
status: untried
source: skills/docker-destructive-guardrails/SKILL.md
created: 2026-09-25
---

# docker-destructive-guardrails

> [!info] What it does
> Use this skill before running, or recommending, any Docker command that deletes, wipes, resets, or otherwise irreversibly changes state — even if the user just says to "clean up", "clear the cache", "start fresh", "wipe everything", "nuke it", "reset", "force remove", or "tear down" Docker resources. Covers generic Docker CLI destructive operations not owned by a more specific skill — `docker rm`, `docker rm -f`, `docker container prune`, `docker kill`, `docker system prune`, `docker rmi`/`docker image rm`, `docker image prune -a`, `docker network rm`, `docker network prune`, `docker builder prune`, `docker buildx rm`, `docker context rm`, and standalone (non-Compose) `docker volume rm`/`docker volume prune`. Also indexes destructive commands owned by other Docker skills (Compose, sandbox, Desktop). Core rule — state exactly what will be lost and get explicit confirmation first, except narrow, low-friction Tier 1 container cleanup.

**Source:** [skills/docker-destructive-guardrails/SKILL.md](../../../skills/docker-destructive-guardrails/SKILL.md)  ·  **Domain:** [Cloud, Infra & MLOps](../../maps/cloud-devops.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [docker](../../notes/software-dev/docker.md) — Containerizing and shipping applications with Docker — writing efficient Dockerfiles (multi-stage builds, layer caching, small/secure images), docker compose for multi-service local...
- [start](../../notes/vault-meta/start.md) — Use when starting Zoom work

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
