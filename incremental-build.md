---
title: incremental-build
aliases:
  - incremental build
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: incremental-build/SKILL.md
created: 2026-07-21
---

# incremental-build

> [!info] What it does
> Guide for optimizing MSBuild incremental builds. USE FOR: builds slower than expected on subsequent runs, 'nothing changed but it rebuilds anyway', diagnosing why targets re-execute unnecessarily, fixing broken no-op builds. Covers 8 common causes: missing Inputs/Outputs on custom targets, volatile properties in output paths (timestamps/GUIDs), file writes outside tracked Outputs, missing FileWrites registration, glob changes, Visual Studio Fast Up-to-Date Check (FUTDC) issues. Key diagnostic: look for 'Building target completely' vs 'Skipping target' in binlog. DO NOT USE FOR: first-time build slowness (use build-perf-baseline), parallelism issues (use build-parallelism), evaluation-phase slowness (use eval-performance), non-MSBuild build systems.

**Source:** [incremental-build/SKILL.md](incremental-build/SKILL.md)  ·  **Domain:** [.NET & C# Development](maps/dotnet-development.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [build-parallelism](build-parallelism.md) — Diagnose and fix under-parallelized MSBuild builds
- [build-perf-baseline](build-perf-baseline.md) — Establish build performance baselines and apply systematic optimization techniques
- [build-perf-diagnostics](build-perf-diagnostics.md) — Diagnose MSBuild build performance bottlenecks using binary log analysis
- [copy-to-output-directory](copy-to-output-directory.md) — Choosing an MSBuild CopyToOutputDirectory / CopyToPublishDirectory mode: Never, PreserveNewest, Always, and IfDifferent (MSBuild 17.13+), plus $(SkipUnchangedFilesOnCopyAlways)
- [eval-performance](eval-performance.md) — Guide for diagnosing and improving MSBuild project evaluation performance
- [item-management](item-management.md) — Patterns for managing MSBuild item groups: Include/Remove/Update semantics, item metadata, batching with %(Metadata), transforms, per-item filtering, and cross-product batching pitfalls
- [target-authoring](target-authoring.md) — Canonical patterns for writing custom MSBuild targets

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

