---
title: docker-sandboxes-network-credentials
aliases:
  - docker sandboxes network credentials
tags:
  - skill
  - domain/cloud-devops
domain: cloud-devops
status: untried
source: skills/docker-sandboxes-network-credentials/SKILL.md
created: 2026-09-25
---

# docker-sandboxes-network-credentials

> [!info] What it does
> Use this skill when configuring what a Docker Sandboxes (`sbx`) sandbox can reach on the network or which credentials it authenticates with, even if the user just says they want to "let the agent call an internal API", "block all network access", "give the agent a GitHub token", or "use a private registry image for a sandbox". Covers `sbx policy init/allow/deny/ls/inspect/log/check/rm network` (global and per-sandbox egress rules, deny-over-allow precedence) and `sbx secret set/set-custom/ls/rm/import` (service secrets, dynamic secrets via --ref/--command, and registry pull credentials with their host-pulls-only-by-default injection scope).

**Source:** [skills/docker-sandboxes-network-credentials/SKILL.md](../../../skills/docker-sandboxes-network-credentials/SKILL.md)  ·  **Domain:** [Cloud, Infra & MLOps](../../maps/cloud-devops.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [docker](../../notes/software-dev/docker.md) — Containerizing and shipping applications with Docker — writing efficient Dockerfiles (multi-stage builds, layer caching, small/secure images), docker compose for multi-service local...
- [github](../../notes/software-dev/github.md) — Triage and orient GitHub repository, pull request, and issue work through the connected GitHub app

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
