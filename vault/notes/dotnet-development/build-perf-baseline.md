---
title: build-perf-baseline
aliases:
  - build perf baseline
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: skills/build-perf-baseline/SKILL.md
created: 2026-07-21
---

# build-perf-baseline

> [!info] What it does
> Establish MSBuild/.NET baselines before optimizing. USE FOR: unranked slow builds; cold/warm/incremental/no-op measurements; before/after comparisons; CI caching; static graph, artifacts output, dependency graph trimming. DO NOT USE FOR: measured bottlenecks (build-perf-diagnostics), known repeated restores (eliminate-redundant-restores), within-build duplicate calls (find-repeated-work-within-one-build), non-MSBuild builds.

**Source:** [skills/build-perf-baseline/SKILL.md](../../../skills/build-perf-baseline/SKILL.md)  ·  **Domain:** [.NET & C# Development](../../maps/dotnet-development.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [build-perf-diagnostics](../../notes/dotnet-development/build-perf-diagnostics.md) — Diagnose MSBuild bottlenecks from binlog timelines and Target/Task Performance Summaries after baseline measurements
- [incremental-build](../../notes/dotnet-development/incremental-build.md) — Fix MSBuild incremental/no-op builds: 'nothing changed but it rebuilds anyway'

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
