---
title: generate-testability-wrappers
aliases:
  - generate testability wrappers
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: skills/generate-testability-wrappers/SKILL.md
created: 2026-07-21
---

# generate-testability-wrappers

> [!info] What it does
> DO NOT USE when the target already consumes an injected interface or built-in abstraction such as IFileSystem or TimeProvider, even if the request says "generate a wrapper"; no new wrapper is needed. Use only when C# source calls an ambient/static dependency and no injectable seam exists: first-time TimeProvider, IHttpClientFactory, or System.IO.Abstractions adoption; minimal Environment/Console/Process wrappers; IProcessRunner; DI registration; or an ambient seam that preserves a static API. Exclude static detection (detect-static-dependencies), migration to an existing/registered abstraction (migrate-static-to-wrapper), one blocked behavior plus deterministic tests (testability-obstacle), and general interface design.

**Source:** [skills/generate-testability-wrappers/SKILL.md](../../../skills/generate-testability-wrappers/SKILL.md)  ·  **Domain:** [.NET & C# Development](../../maps/dotnet-development.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [detect-static-dependencies](../../notes/dotnet-development/detect-static-dependencies.md) — ACTIVATION PREREQUISITE: the request or discovered target must explicitly identify C#, .NET, `.cs`, or `.csproj`
- [migrate-static-to-wrapper](../../notes/dotnet-development/migrate-static-to-wrapper.md) — Use when asked to migrate, replace, or make testable existing C# static calls with a named wrapper or built-in abstraction: DateTime.UtcNow/Now or DateTimeOffset.UtcNow to...

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
