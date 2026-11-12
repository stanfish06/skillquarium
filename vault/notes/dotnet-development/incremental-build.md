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
> Fix MSBuild incremental/no-op builds: 'nothing changed but it rebuilds anyway'. USE FOR: targets re-executing on subsequent builds, missing Inputs/Outputs or FileWrites, volatile output paths, untracked writes, glob changes, Visual Studio Fast Up-to-Date Check (FUTDC); 'Building target completely' vs 'Skipping target' in binlog. DO NOT USE FOR: within-build duplicates (find-repeated-work-within-one-build), first-build slowness (build-perf-baseline), parallelism (build-parallelism), slow evaluation (eval-performance), non-MSBuild systems.

**Source:** [skills/incremental-build/SKILL.md](../../../skills/incremental-build/SKILL.md)  ·  **Domain:** [.NET & C# Development](../../maps/dotnet-development.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [build-parallelism](../../notes/dotnet-development/build-parallelism.md) — Analyze MSBuild scheduling across at least two distinct projects in a solution/filter/Build.proj
- [build-perf-baseline](../../notes/dotnet-development/build-perf-baseline.md) — Establish MSBuild/.NET baselines before optimizing
- [build-perf-diagnostics](../../notes/dotnet-development/build-perf-diagnostics.md) — Diagnose MSBuild bottlenecks from binlog timelines and Target/Task Performance Summaries after baseline measurements
- [copy-to-output-directory](../../notes/dotnet-development/copy-to-output-directory.md) — Choosing an MSBuild CopyToOutputDirectory / CopyToPublishDirectory mode: Never, PreserveNewest, Always, and IfDifferent (MSBuild 17.13+), plus $(SkipUnchangedFilesOnCopyAlways)
- [eval-performance](../../notes/dotnet-development/eval-performance.md) — Diagnose measured MSBuild evaluation cost before targets run
- [extension-points](../../notes/dotnet-development/extension-points.md) — Own MSBuild import and hook discovery. USE FOR: CustomBefore/CustomAfter hooks, ordered wildcard and NuGet auto-imports, control properties, build/buildTransitive packed layout...
- [target-authoring](../../notes/dotnet-development/target-authoring.md) — Canonical patterns for writing custom MSBuild targets

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
