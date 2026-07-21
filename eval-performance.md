---
title: eval-performance
aliases:
  - eval performance
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: eval-performance/SKILL.md
created: 2026-07-21
---

# eval-performance

> [!info] What it does
> Guide for diagnosing and improving MSBuild project evaluation performance. USE FOR: builds slow before any compilation starts, high evaluation time in binlog analysis, expensive glob patterns walking large directories (node_modules, .git, bin/obj), deep import chains (>20 levels), preprocessed output >10K lines indicating heavy evaluation, property functions with file I/O ($([System.IO.File]::ReadAllText(...))), multiple evaluations per project. Covers the 5 MSBuild evaluation phases, glob optimization via DefaultItemExcludes, import chain analysis with /pp preprocessing. DO NOT USE FOR: compilation-time slowness (use build-perf-diagnostics), incremental build issues (use incremental-build), non-MSBuild build systems.

**Source:** [eval-performance/SKILL.md](eval-performance/SKILL.md)  ·  **Domain:** [.NET & C# Development](maps/dotnet-development.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [build-perf-diagnostics](build-perf-diagnostics.md) — Diagnose MSBuild build performance bottlenecks using binary log analysis
- [incremental-build](incremental-build.md) — Guide for optimizing MSBuild incremental builds

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

