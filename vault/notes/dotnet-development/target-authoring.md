---
title: target-authoring
aliases:
  - target authoring
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: skills/target-authoring/SKILL.md
created: 2026-07-21
---

# target-authoring

> [!info] What it does
> Canonical patterns for writing custom MSBuild targets. USE FOR: diagnosing and fixing custom target authoring anti-patterns; broken SDK target chains across files (e.g., Directory.Build.targets silently redefining SDK targets); targets that replace CompileDependsOn instead of extending it with $(CompileDependsOn); query targets returning stale results from Outputs vs Returns misuse; missing Inputs/Outputs causing unnecessary rebuilds; missing FileWrites registration. Covers DependsOnTargets vs BeforeTargets vs AfterTargets, the Build→CoreBuild three-level pattern, and the $(XxxDependsOn) chain-extension pattern. DO NOT USE FOR: incremental build tuning (use incremental-build), parallelization (use build-parallelism), general anti-patterns (use msbuild-antipatterns), non-MSBuild build systems.

**Source:** [skills/target-authoring/SKILL.md](../../../skills/target-authoring/SKILL.md)  ·  **Domain:** [.NET & C# Development](../../maps/dotnet-development.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [build-parallelism](../../notes/dotnet-development/build-parallelism.md) — Analyze an MSBuild solution, solution filter, or Build.proj that schedules multiple project files
- [extension-points](../../notes/dotnet-development/extension-points.md) — Own MSBuild import and hook discovery. USE FOR: CustomBefore/CustomAfter hooks, ordered wildcard and NuGet auto-imports, control properties, build/buildTransitive packed layout...
- [incremental-build](../../notes/dotnet-development/incremental-build.md) — Guide for optimizing MSBuild incremental builds
- [msbuild-antipatterns](../../notes/dotnet-development/msbuild-antipatterns.md) — DO NOT INVOKE when the primary request explicitly asks to convert, migrate, modernize, or rewrite a legacy/old-style project to SDK style

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
