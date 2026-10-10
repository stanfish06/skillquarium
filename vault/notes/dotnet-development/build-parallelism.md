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
> Analyze an MSBuild solution, solution filter, or Build.proj that schedules multiple project files. USE FOR: measured idle worker nodes, `-m` that does not scale, a serial ProjectReference critical path, graph builds, or an MSBuild task that builds a Projects list. Requires at least two distinct project files whose scheduling or throughput must be analyzed. DO NOT USE for non-MSBuild build systems.

**Source:** [skills/build-parallelism/SKILL.md](../../../skills/build-parallelism/SKILL.md)  ·  **Domain:** [.NET & C# Development](../../maps/dotnet-development.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [build-perf-baseline](../../notes/dotnet-development/build-perf-baseline.md) — Establish MSBuild/.NET build performance baselines before optimizing
- [build-perf-diagnostics](../../notes/dotnet-development/build-perf-diagnostics.md) — Diagnose MSBuild build performance bottlenecks using binary log analysis
- [incremental-build](../../notes/dotnet-development/incremental-build.md) — Guide for optimizing MSBuild incremental builds
- [target-authoring](../../notes/dotnet-development/target-authoring.md) — Canonical patterns for writing custom MSBuild targets

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
