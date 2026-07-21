---
title: directory-build-organization
aliases:
  - directory build organization
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: directory-build-organization/SKILL.md
created: 2026-07-21
---

# directory-build-organization

> [!info] What it does
> Guide for organizing MSBuild infrastructure with Directory.Build.props, Directory.Build.targets, Directory.Packages.props, and Directory.Build.rsp. USE FOR: structuring multi-project repos, centralizing build settings, implementing NuGet Central Package Management (CPM) with ManagePackageVersionsCentrally, consolidating duplicated properties across .csproj files, setting up multi-level Directory.Build hierarchy with GetPathOfFileAbove, understanding evaluation order (Directory.Build.props → SDK .props → .csproj → SDK .targets → Directory.Build.targets). Critical pitfall: $(TargetFramework) conditions in .props silently fail for single-targeting projects — must use .targets. DO NOT USE FOR: non-MSBuild build systems, migrating legacy projects to SDK-style (use msbuild-modernization), single-project solutions with no shared settings.

**Source:** [directory-build-organization/SKILL.md](directory-build-organization/SKILL.md)  ·  **Domain:** [.NET & C# Development](maps/dotnet-development.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [extension-points](extension-points.md) — Guide for MSBuild extensibility: CustomBefore/CustomAfter hooks, wildcard imports with alphabetic ordering, import gating with control properties, NuGet package build extension layout...
- [msbuild-modernization](msbuild-modernization.md) — Guide for modernizing and migrating MSBuild project files to SDK-style format
- [property-patterns](property-patterns.md) — MSBuild property definition patterns: conditional defaults, composition/concatenation, path normalization, trailing-slash handling, TFM detection helpers, and evaluation order

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

