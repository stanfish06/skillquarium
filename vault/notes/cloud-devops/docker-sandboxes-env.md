---
title: docker-sandboxes-env
aliases:
  - docker sandboxes env
tags:
  - skill
  - domain/cloud-devops
domain: cloud-devops
status: untried
source: skills/docker-sandboxes-env/SKILL.md
created: 2026-09-25
---

# docker-sandboxes-env

> [!info] What it does
> Use this skill when authoring, planning, or running a declarative `sbxenv.yaml` file for Docker Sandboxes (`sbx env create/run/plan/exec/rm`), even if the user just says they want to "check in a sandbox config", "make onboarding reproducible for a sandbox", "run a setup script before the agent starts", or "define arguments for a shared sandbox environment". Covers the sbxenv.yaml schema (schemaVersion, agent, kits, workspace/additionalWorkspaces, args, env, secrets, registries, bindings, mcp, ports, sandboxOptions), host `lifecycle:` commands (initialize/postCreate/preRemove) and their approval-plan model, multi-file merge (`-f`-style deep merge and the user-level `.sbxenv.yaml` base layer), and file-write-protection (`sandboxOptions.writableEnvFiles`).

**Source:** [skills/docker-sandboxes-env/SKILL.md](../../../skills/docker-sandboxes-env/SKILL.md)  ·  **Domain:** [Cloud, Infra & MLOps](../../maps/cloud-devops.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [docker](../../notes/software-dev/docker.md) — Containerizing and shipping applications with Docker — writing efficient Dockerfiles (multi-stage builds, layer caching, small/secure images), docker compose for multi-service local...
- [setup](../../notes/vault-meta/setup.md) — Verify Daloopa MCP connection and show available skills

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
