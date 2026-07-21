---
title: target-authoring
aliases:
  - target authoring
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: target-authoring/SKILL.md
created: 2026-07-21
---

# target-authoring

> [!info] What it does
> Canonical patterns for writing custom MSBuild targets. USE FOR: diagnosing and fixing custom target authoring anti-patterns; broken SDK target chains across files (e.g., Directory.Build.targets silently redefining SDK targets); targets that replace CompileDependsOn instead of extending it with $(CompileDependsOn); query targets returning stale results from Outputs vs Returns misuse; missing Inputs/Outputs causing unnecessary rebuilds; missing FileWrites registration. Covers DependsOnTargets vs BeforeTargets vs AfterTargets, the Build→CoreBuild three-level pattern, and the $(XxxDependsOn) chain-extension pattern. DO NOT USE FOR: incremental build tuning (use incremental-build), parallelization (use build-parallelism), general anti-patterns (use msbuild-antipatterns), non-MSBuild build systems.

**Source:** [target-authoring/SKILL.md](target-authoring/SKILL.md)  ·  **Domain:** [.NET & C# Development](maps/dotnet-development.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [build-parallelism](build-parallelism.md) — Diagnose and fix under-parallelized MSBuild builds
- [extension-points](extension-points.md) — Guide for MSBuild extensibility: CustomBefore/CustomAfter hooks, wildcard imports with alphabetic ordering, import gating with control properties, NuGet package build extension layout...
- [incremental-build](incremental-build.md) — Guide for optimizing MSBuild incremental builds
- [item-management](item-management.md) — Patterns for managing MSBuild item groups: Include/Remove/Update semantics, item metadata, batching with %(Metadata), transforms, per-item filtering, and cross-product batching pitfalls
- [msbuild-antipatterns](msbuild-antipatterns.md) — Detect and fix MSBuild anti-patterns in project and build files
- [property-patterns](property-patterns.md) — MSBuild property definition patterns: conditional defaults, composition/concatenation, path normalization, trailing-slash handling, TFM detection helpers, and evaluation order

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

