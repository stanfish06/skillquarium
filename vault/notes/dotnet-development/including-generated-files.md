---
title: including-generated-files
aliases:
  - including generated files
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: skills/including-generated-files/SKILL.md
created: 2026-07-21
---

# including-generated-files

> [!info] What it does
> Own MSBuild generated-artifact integration. USE FOR: a target that creates or should create source, Content, None, or another physical file but the artifact is missing from compilation or output; target timing; evaluation-time glob misses; $(IntermediateOutputPath) placement; and FileWrites clean tracking. The prompt may describe the generated artifact without naming the producing task. DO NOT USE when the primary defect is general Include/Remove/Update semantics, item metadata or batching, duplicate/overlapping declarations, or a generated-item identity relationship; use item-management. Exclude Roslyn source-generator internals and non-MSBuild systems.

**Source:** [skills/including-generated-files/SKILL.md](../../../skills/including-generated-files/SKILL.md)  ·  **Domain:** [.NET & C# Development](../../maps/dotnet-development.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [item-management](../../notes/dotnet-development/item-management.md) — Own concrete MSBuild ItemGroup and item-expression questions

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
