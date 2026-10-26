---
title: migrate-static-to-wrapper
aliases:
  - migrate static to wrapper
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: skills/migrate-static-to-wrapper/SKILL.md
created: 2026-07-21
---

# migrate-static-to-wrapper

> [!info] What it does
> Use when asked to migrate, replace, or make testable existing C# static calls with a named wrapper or built-in abstraction: DateTime.UtcNow/Now or DateTimeOffset.UtcNow to TimeProvider/IClock, File.* to IFileSystem or an existing store such as ITextFileStore, and Environment.* to an existing reader such as IEnvironmentReader. Covers scoped files/projects, constructor injection, replacing temp-file or process-environment tests with fakes, "already registered" abstractions, and static classes whose callers/signatures must stay unchanged. Preserves DateTimeKind and call count. DO NOT USE for finding statics (detect-static-dependencies), choosing/designing a new wrapper (generate-testability-wrappers), behavior tests with no chosen seam (testability-obstacle), or test-framework migration.

**Source:** [skills/migrate-static-to-wrapper/SKILL.md](../../../skills/migrate-static-to-wrapper/SKILL.md)  ·  **Domain:** [.NET & C# Development](../../maps/dotnet-development.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [detect-static-dependencies](../../notes/dotnet-development/detect-static-dependencies.md) — ACTIVATION PREREQUISITE: the request or discovered target must explicitly identify C#, .NET, `.cs`, or `.csproj`
- [generate-testability-wrappers](../../notes/dotnet-development/generate-testability-wrappers.md) — DO NOT USE when the target already consumes an injected interface or built-in abstraction such as IFileSystem or TimeProvider, even if the request says "generate a wrapper"

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
