---
title: eval-performance
aliases:
  - eval performance
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: skills/eval-performance/SKILL.md
created: 2026-07-21
---

# eval-performance

> [!info] What it does
> Diagnose measured MSBuild evaluation cost before targets run. USE FOR: evaluation-only repeats under global-property variants, expensive node_modules/.git/bin/obj globs, import depth >20, /pp >10K lines, file-I/O property functions, five-phase evaluation. DO NOT USE FOR: duplicate executions (find-repeated-work-within-one-build), execution bottlenecks (build-perf-diagnostics), incremental rebuilds (incremental-build), non-MSBuild systems.

**Source:** [skills/eval-performance/SKILL.md](../../../skills/eval-performance/SKILL.md)  ·  **Domain:** [.NET & C# Development](../../maps/dotnet-development.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [build-perf-diagnostics](../../notes/dotnet-development/build-perf-diagnostics.md) — Diagnose MSBuild bottlenecks from binlog timelines and Target/Task Performance Summaries after baseline measurements
- [incremental-build](../../notes/dotnet-development/incremental-build.md) — Fix MSBuild incremental/no-op builds: 'nothing changed but it rebuilds anyway'

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
