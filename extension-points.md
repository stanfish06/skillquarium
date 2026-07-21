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
source: extension-points/SKILL.md
created: 2026-07-21
---

# extension-points

> [!info] What it does
> Guide for MSBuild extensibility: CustomBefore/CustomAfter hooks, wildcard imports with alphabetic ordering, import gating with control properties, NuGet package build extension layout (build/buildTransitive), and the MicrosoftCommonPropsHasBeenImported guard. USE FOR: diagnosing and fixing MSBuild import and hook patterns, reviewing and fixing extension point anti-patterns in Directory.Build files, fixing missing Exists() guards on imports that break fresh clones, fixing NuGet package hooks being silently dropped instead of appended, making build targets extensible for other projects, injecting custom logic into the build pipeline, creating NuGet packages that extend the build, conditionally disabling imports. DO NOT USE FOR: target authoring patterns (use target-authoring), props vs targets placement (use directory-build-organization), general anti-patterns (use msbuild-antipatterns), non-MSBuild build systems.

**Source:** [extension-points/SKILL.md](extension-points/SKILL.md)  ·  **Domain:** [.NET & C# Development](maps/dotnet-development.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [directory-build-organization](directory-build-organization.md) — Guide for organizing MSBuild infrastructure with Directory.Build.props, Directory.Build.targets, Directory.Packages.props, and Directory.Build.rsp
- [msbuild-antipatterns](msbuild-antipatterns.md) — Detect and fix MSBuild anti-patterns in project and build files
- [target-authoring](target-authoring.md) — Canonical patterns for writing custom MSBuild targets

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

