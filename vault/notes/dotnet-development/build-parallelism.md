---
title: build-parallelism
aliases:
  - build parallelism
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: skills/build-parallelism/SKILL.md
created: 2026-07-21
---

# build-parallelism

> [!info] What it does
> Analyze MSBuild scheduling across at least two distinct projects in a solution/filter/Build.proj. USE FOR: measured idle workers, -m not scaling, serial ProjectReference critical paths, graph builds, MSBuild Projects-list scheduling. DO NOT USE FOR: duplicate executions or invariant-generation races (find-repeated-work-within-one-build), non-MSBuild systems.

**Source:** [skills/build-parallelism/SKILL.md](../../../skills/build-parallelism/SKILL.md)  ·  **Domain:** [.NET & C# Development](../../maps/dotnet-development.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [build-perf-diagnostics](../../notes/dotnet-development/build-perf-diagnostics.md) — Diagnose MSBuild bottlenecks from binlog timelines and Target/Task Performance Summaries after baseline measurements
- [incremental-build](../../notes/dotnet-development/incremental-build.md) — Fix MSBuild incremental/no-op builds: 'nothing changed but it rebuilds anyway'
- [target-authoring](../../notes/dotnet-development/target-authoring.md) — Canonical patterns for writing custom MSBuild targets

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
