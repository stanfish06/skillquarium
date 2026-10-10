---
title: incremental-build
aliases:
  - incremental build
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: skills/incremental-build/SKILL.md
created: 2026-07-21
---

# incremental-build

> [!info] What it does
> Guide for optimizing MSBuild incremental builds. USE FOR: builds slower than expected on subsequent runs, 'nothing changed but it rebuilds anyway', diagnosing why targets re-execute unnecessarily, fixing broken no-op builds. Covers 8 common causes: missing Inputs/Outputs on custom targets, volatile properties in output paths (timestamps/GUIDs), file writes outside tracked Outputs, missing FileWrites registration, glob changes, Visual Studio Fast Up-to-Date Check (FUTDC) issues. Key diagnostic: look for 'Building target completely' vs 'Skipping target' in binlog. DO NOT USE FOR: first-time build slowness (use build-perf-baseline), parallelism issues (use build-parallelism), evaluation-phase slowness (use eval-performance), non-MSBuild build systems.

**Source:** [skills/incremental-build/SKILL.md](../../../skills/incremental-build/SKILL.md)  ·  **Domain:** [.NET & C# Development](../../maps/dotnet-development.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [build-parallelism](../../notes/dotnet-development/build-parallelism.md) — Analyze an MSBuild solution, solution filter, or Build.proj that schedules multiple project files
- [build-perf-baseline](../../notes/dotnet-development/build-perf-baseline.md) — Establish MSBuild/.NET build performance baselines before optimizing
- [build-perf-diagnostics](../../notes/dotnet-development/build-perf-diagnostics.md) — Diagnose MSBuild build performance bottlenecks using binary log analysis
- [copy-to-output-directory](../../notes/dotnet-development/copy-to-output-directory.md) — Choosing an MSBuild CopyToOutputDirectory / CopyToPublishDirectory mode: Never, PreserveNewest, Always, and IfDifferent (MSBuild 17.13+), plus $(SkipUnchangedFilesOnCopyAlways)
- [eval-performance](../../notes/dotnet-development/eval-performance.md) — Guide for diagnosing and improving MSBuild project evaluation performance
- [extension-points](../../notes/dotnet-development/extension-points.md) — Own MSBuild import and hook discovery. USE FOR: CustomBefore/CustomAfter hooks, ordered wildcard and NuGet auto-imports, control properties, build/buildTransitive packed layout...
- [target-authoring](../../notes/dotnet-development/target-authoring.md) — Canonical patterns for writing custom MSBuild targets

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
