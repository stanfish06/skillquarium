---
title: including-generated-files
aliases:
  - including generated files
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: including-generated-files/SKILL.md
created: 2026-07-21
---

# including-generated-files

> [!info] What it does
> Fix MSBuild targets that generate files during the build but those files are missing from compilation or output. USE FOR: generated source files not compiling (CS0246 for a type that should exist), custom build tasks that create files but they are invisible to subsequent targets, globs not capturing build-generated files because they expand at evaluation time before execution creates them, ensuring generated files are cleaned by the Clean target. Covers correct BeforeTargets timing (CoreCompile, BeforeBuild, AssignTargetPaths), adding to Compile/FileWrites item groups, using $(IntermediateOutputPath) instead of hardcoded obj/ paths. DO NOT USE FOR: C# source generators that already work via the Roslyn pipeline, T4 design-time generation that runs in Visual Studio, non-MSBuild build systems.

**Source:** [including-generated-files/SKILL.md](including-generated-files/SKILL.md)  ·  **Domain:** [.NET & C# Development](maps/dotnet-development.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

_None auto-detected. Add your own links here, e.g. `[scanpy](scanpy.md)`._

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

