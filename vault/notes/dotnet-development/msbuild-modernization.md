---
title: msbuild-modernization
aliases:
  - msbuild modernization
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: skills/msbuild-modernization/SKILL.md
created: 2026-07-21
---

# msbuild-modernization

> [!info] What it does
> Guide for modernizing and migrating MSBuild project files to SDK-style format. USE FOR: converting legacy .csproj/.vbproj with verbose XML to SDK-style, migrating packages.config to PackageReference, removing Properties/AssemblyInfo.cs in favor of auto-generation, eliminating explicit Compile Include lists via implicit globbing, consolidating shared settings into Directory.Build.props. Indicators of legacy projects: ToolsVersion attribute, an Import of Microsoft.CSharp.targets via $(MSBuildToolsPath), .csproj files over 50 lines for simple projects. DO NOT USE FOR: projects already in SDK-style format, non-.NET build systems (npm, Maven, CMake), .NET Framework projects that cannot move to SDK-style.

**Source:** [skills/msbuild-modernization/SKILL.md](../../../skills/msbuild-modernization/SKILL.md)  ·  **Domain:** [.NET & C# Development](../../maps/dotnet-development.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [msbuild-antipatterns](../../notes/dotnet-development/msbuild-antipatterns.md) — DO NOT INVOKE when the primary request explicitly asks to convert, migrate, modernize, or rewrite a legacy/old-style project to SDK style

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
