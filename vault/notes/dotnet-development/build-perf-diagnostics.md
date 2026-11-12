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
> Diagnose MSBuild bottlenecks from binlog timelines and Target/Task Performance Summaries after baseline measurements. USE FOR: unknown build slowness, RAR >5s, analyzers >30% of Csc, a target >50% of build, node utilization below 80%, excessive Copy, restore overhead. DO NOT USE FOR: within-build duplicates (find-repeated-work-within-one-build), known repeated restores (eliminate-redundant-restores), initial baselines (build-perf-baseline), incremental rebuilds (incremental-build), parallelism tuning (build-parallelism), non-MSBuild builds.

**Source:** [skills/build-perf-diagnostics/SKILL.md](../../../skills/build-perf-diagnostics/SKILL.md)  ·  **Domain:** [.NET & C# Development](../../maps/dotnet-development.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [binlog-generation](../../notes/dotnet-development/binlog-generation.md) — Generate MSBuild binary logs (binlogs) for build diagnostics and analysis
- [build-parallelism](../../notes/dotnet-development/build-parallelism.md) — Analyze MSBuild scheduling across at least two distinct projects in a solution/filter/Build.proj
- [build-perf-baseline](../../notes/dotnet-development/build-perf-baseline.md) — Establish MSBuild/.NET baselines before optimizing
- [eval-performance](../../notes/dotnet-development/eval-performance.md) — Diagnose measured MSBuild evaluation cost before targets run
- [incremental-build](../../notes/dotnet-development/incremental-build.md) — Fix MSBuild incremental/no-op builds: 'nothing changed but it rebuilds anyway'
- [resolve-project-references](../../notes/dotnet-development/resolve-project-references.md) — Guide for interpreting ResolveProjectReferences time in MSBuild performance summaries

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
