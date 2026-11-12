---
title: check-bin-obj-clash
aliases:
  - check bin obj clash
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: skills/check-bin-obj-clash/SKILL.md
created: 2026-07-21
---

# check-bin-obj-clash

> [!info] What it does
> Find OutputPath/IntermediateOutputPath collisions between distinct projects or required property/TFM variants. USE FOR: missing/overwritten bin/obj or project.assets.json, parallel 'Cannot create a file when that file already exists' or 'file is being used by another process', shared paths, missing AppendTargetFrameworkToOutputPath, PublishReadyToRun, SetTargetFramework on single-target references. DO NOT USE FOR: duplicates or invariant-generation races (find-repeated-work-within-one-build), OS locking, single-instance builds, non-MSBuild systems.

**Source:** [skills/check-bin-obj-clash/SKILL.md](../../../skills/check-bin-obj-clash/SKILL.md)  ·  **Domain:** [.NET & C# Development](../../maps/dotnet-development.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

_None auto-detected. Add your own links here, e.g. `[[scanpy]]`._

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
