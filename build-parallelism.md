---
title: build-parallelism
aliases:
  - build parallelism
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: build-parallelism/SKILL.md
created: 2026-07-21
---

# build-parallelism

> [!info] What it does
> Diagnose and fix under-parallelized MSBuild builds. USE WHEN a multi-project solution build is slower than expected, doesn't speed up when you add cores, pegs a single core while others idle, or you want to know why `-m` isn't helping. Note: `/maxcpucount` default is 1 (sequential) — always pass `-m` for parallel builds. Covers finding the critical path (longest serial ProjectReference chain), graph build (`/graph`), BuildInParallel, and solution filters (`.slnf`). DO NOT USE FOR: single-project builds, incremental issues (use incremental-build), compilation slowness inside one project (use build-perf-diagnostics), non-MSBuild build systems.

**Source:** [build-parallelism/SKILL.md](build-parallelism/SKILL.md)  ·  **Domain:** [.NET & C# Development](maps/dotnet-development.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [build-perf-baseline](build-perf-baseline.md) — Establish build performance baselines and apply systematic optimization techniques
- [build-perf-diagnostics](build-perf-diagnostics.md) — Diagnose MSBuild build performance bottlenecks using binary log analysis
- [incremental-build](incremental-build.md) — Guide for optimizing MSBuild incremental builds
- [target-authoring](target-authoring.md) — Canonical patterns for writing custom MSBuild targets

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

