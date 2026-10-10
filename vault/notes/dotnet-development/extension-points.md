---
title: extension-points
aliases:
  - extension points
  - buildTransitive
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: skills/extension-points/SKILL.md
created: 2026-07-21
---

# extension-points

> [!info] What it does
> Own MSBuild import and hook discovery. USE FOR: CustomBefore/CustomAfter hooks, ordered wildcard and NuGet auto-imports, control properties, build/buildTransitive packed layout, package ID and file-name matching, per-TFM forwarders, and tracing why assets or hooks are missing, broken, or replaced. An import guard remains in scope when it is one defect in a broader hook/import flow. DO NOT USE for a focused safety verdict on whether one specific Import needs Exists or is an intentionally unguarded package contract; use msbuild-antipatterns. NEVER INVOKE when imports and hook placement already work and the request is only target Inputs/Outputs, incremental skipping, or FileWrites clean tracking; use incremental-build or target-authoring. Exclude props-versus-targets placement and non-MSBuild systems.

**Source:** [skills/extension-points/SKILL.md](../../../skills/extension-points/SKILL.md)  ·  **Domain:** [.NET & C# Development](../../maps/dotnet-development.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [incremental-build](../../notes/dotnet-development/incremental-build.md) — Guide for optimizing MSBuild incremental builds
- [msbuild-antipatterns](../../notes/dotnet-development/msbuild-antipatterns.md) — DO NOT INVOKE when the primary request explicitly asks to convert, migrate, modernize, or rewrite a legacy/old-style project to SDK style
- [target-authoring](../../notes/dotnet-development/target-authoring.md) — Canonical patterns for writing custom MSBuild targets

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
