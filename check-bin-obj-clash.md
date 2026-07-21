---
title: check-bin-obj-clash
aliases:
  - check bin obj clash
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: check-bin-obj-clash/SKILL.md
created: 2026-07-21
---

# check-bin-obj-clash

> [!info] What it does
> Detects MSBuild projects with conflicting OutputPath or IntermediateOutputPath. USE FOR: builds failing with 'Cannot create a file when that file already exists', 'The process cannot access the file because it is being used by another process', intermittent build failures that succeed on retry, or missing/overwritten outputs in multi-project or multi-targeting builds where bin/obj (or project.assets.json) collide. Common causes: shared OutputPath, missing AppendTargetFrameworkToOutputPath, extra global properties (e.g. PublishReadyToRun), or SetTargetFramework on a ProjectReference to a single-targeting project. DO NOT USE FOR: file access errors unrelated to MSBuild (OS-level locking), single-project single-TFM builds, non-MSBuild build systems.

**Source:** [check-bin-obj-clash/SKILL.md](check-bin-obj-clash/SKILL.md)  ·  **Domain:** [.NET & C# Development](maps/dotnet-development.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

_None auto-detected. Add your own links here, e.g. `[scanpy](scanpy.md)`._

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

