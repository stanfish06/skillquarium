---
title: detect-static-dependencies
aliases:
  - detect static dependencies
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: skills/detect-static-dependencies/SKILL.md
created: 2026-07-21
---

# detect-static-dependencies

> [!info] What it does
> ACTIVATION PREREQUISITE: the request or discovered target must explicitly identify C#, .NET, `.cs`, or `.csproj`; otherwise stay dormant without invoking this skill. USE FOR: locating System.DateTime.Now/UtcNow, System.IO.File/Directory, System.Environment, HttpClient, Console, or Process usage in C#; auditing C# code for hard-to-test framework dependencies; or verifying those C# calls are already abstracted. DO NOT USE FOR: any target lacking the activation prerequisite; generating wrappers (use generate-testability-wrappers); migrating code (use migrate-static-to-wrapper); or general code review.

**Source:** [skills/detect-static-dependencies/SKILL.md](../../../skills/detect-static-dependencies/SKILL.md)  ·  **Domain:** [.NET & C# Development](../../maps/dotnet-development.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [generate-testability-wrappers](../../notes/dotnet-development/generate-testability-wrappers.md) — DO NOT USE when the target already consumes an injected interface or built-in abstraction such as IFileSystem or TimeProvider, even if the request says "generate a wrapper"
- [migrate-static-to-wrapper](../../notes/dotnet-development/migrate-static-to-wrapper.md) — Use when asked to migrate, replace, or make testable existing C# static calls with a named wrapper or built-in abstraction: DateTime.UtcNow/Now or DateTimeOffset.UtcNow to...

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
