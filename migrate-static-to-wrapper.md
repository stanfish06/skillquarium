---
title: migrate-static-to-wrapper
aliases:
  - migrate static to wrapper
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: migrate-static-to-wrapper/SKILL.md
created: 2026-07-21
---

# migrate-static-to-wrapper

> [!info] What it does
> Replace existing static dependency call sites with a wrapper or built-in abstraction that already exists or is registered in DI. Codemod-style bulk replacement of DateTime.Now/UtcNow to TimeProvider, File.ReadAllText to IFileSystem, and similar, across a bounded scope (file, project, namespace), adding constructor injection to affected classes and updating their unit tests to use a test double. USE FOR: replace DateTime.UtcNow/DateTime.Now with TimeProvider and add the constructor parameter, migrate static call sites to a wrapper already in DI, bulk replace File.* with IFileSystem, scoped migration of statics in only certain files, migrate a service to TimeProvider and update its unit tests to a controllable/fake time source, update test doubles when migrating off static DateTime/File calls. DO NOT USE FOR: detecting statics (use detect-static-dependencies), creating or registering the wrapper when it does not exist yet (use generate-testability-wrappers), migrating between test frameworks.

**Source:** [migrate-static-to-wrapper/SKILL.md](migrate-static-to-wrapper/SKILL.md)  ·  **Domain:** [.NET & C# Development](maps/dotnet-development.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [detect-static-dependencies](detect-static-dependencies.md) — Scan C# source files for hard-to-test static dependencies — DateTime.Now/UtcNow, File.*, Directory.*, Environment.*, HttpClient, Console.*, Process.*, and other untestable statics
- [generate-testability-wrappers](generate-testability-wrappers.md) — Generate wrapper interfaces and DI registration for hard-to-test static dependencies in C#, when the abstraction does NOT exist yet

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

