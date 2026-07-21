---
title: binlog-generation
aliases:
  - binlog generation
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: binlog-generation/SKILL.md
created: 2026-07-21
---

# binlog-generation

> [!info] What it does
> Generate MSBuild binary logs (binlogs) for build diagnostics and analysis. USE FOR: adding /bl:{} to any dotnet build, test, pack, publish, or restore command to capture a full build execution trace, prerequisite for binlog-failure-analysis and build-perf-diagnostics skills, enabling post-build investigation of errors or performance. Requires MSBuild 17.8+ / .NET 8 SDK+ for {} placeholder; PowerShell needs -bl:{{}}. DO NOT USE FOR: non-MSBuild build systems (npm, Maven, CMake), analyzing an existing binlog (use binlog-failure-analysis instead).

**Source:** [binlog-generation/SKILL.md](binlog-generation/SKILL.md)  ·  **Domain:** [.NET & C# Development](maps/dotnet-development.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [binlog-failure-analysis](binlog-failure-analysis.md) — Analyze MSBuild binary logs to diagnose build failures
- [build-perf-diagnostics](build-perf-diagnostics.md) — Diagnose MSBuild build performance bottlenecks using binary log analysis

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

