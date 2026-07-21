---
title: item-management
aliases:
  - item management
  - Metadata
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: item-management/SKILL.md
created: 2026-07-21
---

# item-management

> [!info] What it does
> Patterns for managing MSBuild item groups: Include/Remove/Update semantics, item metadata, batching with %(Metadata), transforms, per-item filtering, and cross-product batching pitfalls. USE FOR: diagnosing and fixing item group anti-patterns in .csproj files, reviewing item management for correctness, fixing CS2002 duplicate file warnings from SDK globbing, fixing targets that run more times than expected due to cross-product batching, fixing Include vs Update misuse on SDK-globbed items, fixing FileWrites registration for generated file clean support, moving generated files to IntermediateOutputPath. DO NOT USE FOR: target chain architecture (use target-authoring), property patterns (use property-patterns), incrementality (use incremental-build), general anti-patterns (use msbuild-antipatterns), non-MSBuild build systems.

**Source:** [item-management/SKILL.md](item-management/SKILL.md)  ·  **Domain:** [.NET & C# Development](maps/dotnet-development.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [incremental-build](incremental-build.md) — Guide for optimizing MSBuild incremental builds
- [msbuild-antipatterns](msbuild-antipatterns.md) — Detect and fix MSBuild anti-patterns in project and build files
- [property-patterns](property-patterns.md) — MSBuild property definition patterns: conditional defaults, composition/concatenation, path normalization, trailing-slash handling, TFM detection helpers, and evaluation order
- [target-authoring](target-authoring.md) — Canonical patterns for writing custom MSBuild targets

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

