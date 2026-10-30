---
title: logfire-instrumentation
aliases:
  - logfire instrumentation
tags:
  - skill
  - domain/analytics-engineering
domain: analytics-engineering
status: untried
source: skills/logfire-instrumentation/SKILL.md
created: 2026-07-21
---

# logfire-instrumentation

> [!info] What it does
> Add Pydantic Logfire observability to application code — traces, logs, metrics, and AI/agent spans. Use when the user asks to add or configure Logfire, observability, tracing, logging, or monitoring; maximize useful telemetry; or understand what an app is doing. Supports Python, JavaScript/TypeScript, Rust, and major AI agent frameworks including Pydantic AI, OpenAI Agents SDK, Claude Agent SDK, LangChain, LangGraph, CrewAI, AutoGen, and Google ADK. For infrastructure-only monitoring (hosts, Docker, Kubernetes, databases, or cloud metrics with no app-code changes), use `logfire-infrastructure`. For evaluating AI/agent behavior against test datasets, use `logfire-evals`.

**Source:** [skills/logfire-instrumentation/SKILL.md](../../../skills/logfire-instrumentation/SKILL.md)  ·  **Domain:** [Analytics Engineering & LLM Operations](../../maps/analytics-engineering.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [crewai](../../notes/ml-ai/crewai.md) — Role-based multi-agent orchestration framework for building "Crews" of collaborating LLM agents (each with a role, goal, backstory, and optional tools) that execute sequential or...
- [docker](../../notes/software-dev/docker.md) — Containerizing and shipping applications with Docker — writing efficient Dockerfiles (multi-stage builds, layer caching, small/secure images), docker compose for multi-service local...
- [langgraph](../../notes/ml-ai/langgraph.md) — LangGraph is a low-level orchestration framework for building stateful LLM agents and workflows as explicit graphs — typed state with reducers, nodes/edges/conditional routing...
- [observability](../../notes/hosting-edge-platforms/observability.md) — Vercel Observability expert guidance — Drains (logs, traces, speed insights, web analytics), Web Analytics, Speed Insights, runtime logs, custom events, OpenTelemetry integration, and...
- [telemetry](../../notes/hosting-edge-platforms/telemetry.md) — Add and verify lightweight macOS runtime telemetry

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

> [!note] Vault audit 2026-07-24 — USE-7
> Use this only when the user explicitly wants Pydantic Logfire; for vendor-neutral "add observability/tracing/metrics/logging" with no backend chosen yet, use `observability-and-instrumentation`. Distinguishing axis: Logfire-specific vs vendor-neutral.
