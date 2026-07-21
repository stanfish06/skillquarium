---
title: resolve-project-references
aliases:
  - resolve project references
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: resolve-project-references/SKILL.md
created: 2026-07-21
---

# resolve-project-references

> [!info] What it does
> Guide for interpreting ResolveProjectReferences time in MSBuild performance summaries. Activate when ResolveProjectReferences appears as the most expensive target and developers are trying to optimize it directly. Explains that the reported time includes wait time for dependent project builds and is misleading. Guides users to focus on task self-time instead. Do not activate for general build performance -- use build-perf-diagnostics instead.

**Source:** [resolve-project-references/SKILL.md](resolve-project-references/SKILL.md)  ·  **Domain:** [.NET & C# Development](maps/dotnet-development.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [build-perf-diagnostics](build-perf-diagnostics.md) — Diagnose MSBuild build performance bottlenecks using binary log analysis

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

