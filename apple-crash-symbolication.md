---
title: apple-crash-symbolication
aliases:
  - apple crash symbolication
  - iOS
  - tvOS
  - macOS
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: apple-crash-symbolication/SKILL.md
created: 2026-07-21
---

# apple-crash-symbolication

> [!info] What it does
> Symbolicate .NET runtime frames in Apple platform .ips crash logs (iOS, tvOS, Mac Catalyst, macOS). Extracts UUIDs and addresses from the native backtrace, locates dSYM debug symbols, and runs atos to produce function names with source file and line numbers. Automatically downloads .dwarf symbols from the Microsoft symbol server using Mach-O UUIDs. USE FOR triaging a .NET MAUI or Mono app crash from an .ips file on any Apple platform, resolving native backtrace frames in libcoreclr or libmonosgen-2.0 to .NET runtime source code, retrieving .ips crash logs from a connected iOS device or iPhone, or investigating EXC_CRASH, EXC_BAD_ACCESS, SIGABRT, or SIGSEGV originating from the .NET runtime. DO NOT USE FOR pure Swift/Objective-C crashes with no .NET components, or Android tombstone files. INVOKES Symbolicate-Crash.ps1 script, atos, dwarfdump, idevicecrashreport.

**Source:** [apple-crash-symbolication/SKILL.md](apple-crash-symbolication/SKILL.md)  ·  **Domain:** [.NET & C# Development](maps/dotnet-development.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

_None auto-detected. Add your own links here, e.g. `[scanpy](scanpy.md)`._

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

