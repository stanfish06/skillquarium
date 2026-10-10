---
title: msbuild-antipatterns
aliases:
  - msbuild antipatterns
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: skills/msbuild-antipatterns/SKILL.md
created: 2026-07-21
---

# msbuild-antipatterns

> [!info] What it does
> DO NOT INVOKE when the primary request explicitly asks to convert, migrate, modernize, or rewrite a legacy/old-style project to SDK style; use msbuild-modernization. Migration prompts often mention ToolsVersion, explicit Compile/Reference entries, packages.config, or Microsoft.CSharp.targets, but merely reviewing or auditing a file that contains those patterns remains in scope here. USE FOR broad review, audit, lint, or maintainability/correctness checks of project/build files, including custom targets; prioritized cross-cutting findings; discrete anti-patterns; F# ordering/FS0039; cross-platform paths; and focused Import safety verdicts. Review/audit is analysis-only unless fixes are requested. For concrete property/item defects use property-patterns/item-management; use target-authoring for implementation and extension-points for NuGet auto-import/layout discovery. Exclude non-MSBuild systems.

**Source:** [skills/msbuild-antipatterns/SKILL.md](../../../skills/msbuild-antipatterns/SKILL.md)  ·  **Domain:** [.NET & C# Development](../../maps/dotnet-development.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [extension-points](../../notes/dotnet-development/extension-points.md) — Own MSBuild import and hook discovery. USE FOR: CustomBefore/CustomAfter hooks, ordered wildcard and NuGet auto-imports, control properties, build/buildTransitive packed layout...
- [item-management](../../notes/dotnet-development/item-management.md) — Own concrete MSBuild ItemGroup and item-expression questions
- [msbuild-modernization](../../notes/dotnet-development/msbuild-modernization.md) — Guide for modernizing and migrating MSBuild project files to SDK-style format
- [property-patterns](../../notes/dotnet-development/property-patterns.md) — Diagnose and fix concrete MSBuild property defects in projects and existing shared-file hierarchies
- [target-authoring](../../notes/dotnet-development/target-authoring.md) — Canonical patterns for writing custom MSBuild targets

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
