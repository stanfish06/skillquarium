---
title: property-patterns
aliases:
  - property patterns
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: property-patterns/SKILL.md
created: 2026-07-21
---

# property-patterns

> [!info] What it does
> MSBuild property definition patterns: conditional defaults, composition/concatenation, path normalization, trailing-slash handling, TFM detection helpers, and evaluation order. USE FOR: diagnosing and fixing property definition issues and shared-property anti-patterns in .props/.csproj; DefineConstants or NoWarn overwritten instead of appended; unconditional assignments that block project-level overrides; unquoted conditions that fail on empty properties; hardcoded paths that break cross-platform builds; setting overridable defaults; property evaluation order and last-write-wins semantics. DO NOT USE FOR: props vs targets placement (use directory-build-organization), item operations (use item-management), target structure (use target-authoring), general anti-patterns (use msbuild-antipatterns), non-MSBuild build systems.

**Source:** [property-patterns/SKILL.md](property-patterns/SKILL.md)  ·  **Domain:** [.NET & C# Development](maps/dotnet-development.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [directory-build-organization](directory-build-organization.md) — Guide for organizing MSBuild infrastructure with Directory.Build.props, Directory.Build.targets, Directory.Packages.props, and Directory.Build.rsp
- [item-management](item-management.md) — Patterns for managing MSBuild item groups: Include/Remove/Update semantics, item metadata, batching with %(Metadata), transforms, per-item filtering, and cross-product batching pitfalls
- [msbuild-antipatterns](msbuild-antipatterns.md) — Detect and fix MSBuild anti-patterns in project and build files
- [target-authoring](target-authoring.md) — Canonical patterns for writing custom MSBuild targets

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

