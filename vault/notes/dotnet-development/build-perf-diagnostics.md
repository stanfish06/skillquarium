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
> Diagnose MSBuild build performance bottlenecks using binary log analysis. USE FOR: identifying why builds are slow by analyzing binlog performance summaries, detecting ResolveAssemblyReference (RAR) taking >5s, Roslyn analyzers consuming >30% of Csc time, single targets dominating >50% of build time, node utilization below 80%, excessive Copy tasks, NuGet restore running every build. Covers timeline analysis, Target/Task Performance Summary interpretation, and 7 common bottleneck categories. Use after build-perf-baseline has established measurements. DO NOT USE FOR: establishing initial baselines (use build-perf-baseline first), fixing incremental build issues (use incremental-build), parallelism tuning (use build-parallelism), non-MSBuild build systems.

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
