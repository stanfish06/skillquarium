---
title: copy-to-output-directory
aliases:
  - copy to output directory
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: copy-to-output-directory/SKILL.md
created: 2026-07-21
---

# copy-to-output-directory

> [!info] What it does
> Choosing an MSBuild CopyToOutputDirectory / CopyToPublishDirectory mode: Never, PreserveNewest, Always, and IfDifferent (MSBuild 17.13+), plus $(SkipUnchangedFilesOnCopyAlways). USE FOR: removing the per-build Always copy perf hit; resetting output files mutated between builds. DO NOT USE FOR: general incremental-build diagnosis (use incremental-build); non-MSBuild build systems.

**Source:** [copy-to-output-directory/SKILL.md](copy-to-output-directory/SKILL.md)  ·  **Domain:** [.NET & C# Development](maps/dotnet-development.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [incremental-build](incremental-build.md) — Guide for optimizing MSBuild incremental builds

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

