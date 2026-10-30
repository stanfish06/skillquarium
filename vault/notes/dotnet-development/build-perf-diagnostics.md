---
title: build-perf-diagnostics
aliases:
  - build perf diagnostics
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: skills/build-perf-diagnostics/SKILL.md
created: 2026-07-21
---

# build-perf-diagnostics

> [!info] What it does
> Diagnose MSBuild bottlenecks from binlog timelines and Target/Task Performance Summaries after build-perf-baseline establishes measurements. USE FOR: unknown build slowness, RAR >5s, analyzers >30% of Csc, one target >50% of build time, node utilization <80%, excessive Copy tasks, finding restore overhead. DO NOT USE FOR: known repeated-restore fixes (use eliminate-redundant-restores), initial baselines (use build-perf-baseline), incremental rebuilds (use incremental-build), parallelism tuning (use build-parallelism), non-MSBuild builds.

**Source:** [skills/build-perf-diagnostics/SKILL.md](../../../skills/build-perf-diagnostics/SKILL.md)  ·  **Domain:** [.NET & C# Development](../../maps/dotnet-development.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [binlog-generation](../../notes/dotnet-development/binlog-generation.md) — Generate MSBuild binary logs (binlogs) for build diagnostics and analysis
- [build-parallelism](../../notes/dotnet-development/build-parallelism.md) — Analyze an MSBuild solution, solution filter, or Build.proj that schedules multiple project files
- [build-perf-baseline](../../notes/dotnet-development/build-perf-baseline.md) — Establish MSBuild/.NET build performance baselines before optimizing
- [eval-performance](../../notes/dotnet-development/eval-performance.md) — Guide for diagnosing and improving MSBuild project evaluation performance
- [incremental-build](../../notes/dotnet-development/incremental-build.md) — Guide for optimizing MSBuild incremental builds
- [resolve-project-references](../../notes/dotnet-development/resolve-project-references.md) — Guide for interpreting ResolveProjectReferences time in MSBuild performance summaries

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
