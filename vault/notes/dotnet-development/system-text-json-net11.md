---
title: system-text-json-net11
aliases:
  - system text json net11
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: skills/system-text-json-net11/SKILL.md
created: 2026-07-21
---

# system-text-json-net11

> [!info] What it does
> Imperative guidance for the System.Text.Json APIs added in .NET 11: the built-in `JsonNamingPolicy.PascalCase` naming policy, and the strongly-typed generic `JsonSerializerOptions.GetTypeInfo` and `JsonSerializerOptions.TryGetTypeInfo` metadata accessors (generic overloads that return a typed `JsonTypeInfo`). USE ONLY when the user is targeting net11.0 or later and needs PascalCase JSON property or dictionary-key names without writing a custom naming policy, a strongly-typed generic `JsonTypeInfo` instead of the non-generic `JsonTypeInfo`, or a no-throw way to probe whether a type's serialization metadata is resolved. DO NOT USE when the target is earlier than net11.0, the requested behavior uses an established pre-net11 naming policy, or the user explicitly selected another JSON library.

**Source:** [skills/system-text-json-net11/SKILL.md](../../../skills/system-text-json-net11/SKILL.md)  ·  **Domain:** [.NET & C# Development](../../maps/dotnet-development.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

_None auto-detected. Add your own links here, e.g. `[[scanpy]]`._

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
