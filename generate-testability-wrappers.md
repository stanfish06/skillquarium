---
title: generate-testability-wrappers
aliases:
  - generate testability wrappers
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: generate-testability-wrappers/SKILL.md
created: 2026-07-21
---

# generate-testability-wrappers

> [!info] What it does
> Generate wrapper interfaces and DI registration for hard-to-test static dependencies in C#, when the abstraction does NOT exist yet. Produces IFileSystem, IEnvironmentProvider, IConsole, IProcessRunner wrappers, or guides first-time adoption of TimeProvider and IHttpClientFactory and registering them in DI. USE FOR: generate wrapper for static, create IFileSystem wrapper, wrap DateTime.Now, make static testable, make class testable, create abstraction for File.*, generate DI registration, set up/adopt TimeProvider when it is not registered yet, IHttpClientFactory setup, testability wrapper, create the right abstraction to mock, what abstraction for Environment, how to make statics injectable, adopt System.IO.Abstractions. DO NOT USE FOR: detecting statics (use detect-static-dependencies), migrating call sites or replacing existing DateTime.*/File.* usages once the wrapper is created or already registered in DI (use migrate-static-to-wrapper), general interface design.

**Source:** [generate-testability-wrappers/SKILL.md](generate-testability-wrappers/SKILL.md)  ·  **Domain:** [.NET & C# Development](maps/dotnet-development.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [detect-static-dependencies](detect-static-dependencies.md) — Scan C# source files for hard-to-test static dependencies — DateTime.Now/UtcNow, File.*, Directory.*, Environment.*, HttpClient, Console.*, Process.*, and other untestable statics
- [migrate-static-to-wrapper](migrate-static-to-wrapper.md) — Replace existing static dependency call sites with a wrapper or built-in abstraction that already exists or is registered in DI

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

