---
title: property-patterns
aliases:
  - property patterns
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: skills/property-patterns/SKILL.md
created: 2026-07-21
---

# property-patterns

> [!info] What it does
> Diagnose and fix concrete MSBuild property defects in projects and existing shared-file hierarchies. USE FOR: conditions, defaults, append versus overwrite, last-write-wins values, OS/TFM checks, portable paths, normalization, and reviews centered on those property defects. Property defects in Directory.Build.* remain in scope, including overwritten values across parent/child imports and conditions that run before TargetFramework is set, even when the fix changes import order or moves a property group to .targets. DO NOT USE FOR: placement-only or import-only requests with no concrete property defect, such as discovering shared files or choosing which file owns a target or customization (use directory-build-organization); item operations; target structure; broad reviews without a concrete property defect; non-MSBuild work.

**Source:** [skills/property-patterns/SKILL.md](../../../skills/property-patterns/SKILL.md)  ·  **Domain:** [.NET & C# Development](../../maps/dotnet-development.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [directory-build-organization](../../notes/dotnet-development/directory-build-organization.md) — USE ONLY for (1) two or more projects with repeated MSBuild policy, targets, or package versions, or (2) an existing Directory.Build.props/targets/rsp hierarchy with an import...
- [msbuild-antipatterns](../../notes/dotnet-development/msbuild-antipatterns.md) — DO NOT INVOKE when the primary request explicitly asks to convert, migrate, modernize, or rewrite a legacy/old-style project to SDK style

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
