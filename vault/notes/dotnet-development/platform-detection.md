---
title: platform-detection
aliases:
  - platform detection
  - MSTest
  - xUnit
  - NUnit
  - TUnit
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: skills/platform-detection/SKILL.md
created: 2026-07-21
---

# platform-detection

> [!info] What it does
> Identify a .NET project's test platform, framework, command mode, and SDK-style vs classic project system. Use only for "which test platform/framework?", "VSTest or MTP?", or "what runner does this project use?", including bridge settings, UseVSTest opt-outs, and incompatible or conflicting VSTest/MTP configuration. Resolves global.json, project, packages.config, Directory.Build.props, and Directory.Packages.props precedence for MSTest/xUnit/NUnit/TUnit. DO NOT USE when the user asks to run/filter tests or for commands, flags, TRX/dumps, or test-command/filter errors; use run-tests directly. Do not route hot-reload or migration requests here as the entry skill; mtp-hot-reload may use this skill internally for platform detection.

**Source:** [skills/platform-detection/SKILL.md](../../../skills/platform-detection/SKILL.md)  ·  **Domain:** [.NET & C# Development](../../maps/dotnet-development.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [mtp-hot-reload](../../notes/dotnet-development/mtp-hot-reload.md) — Set up or recover MTP hot reload for a long-lived console-host edit/re-run loop in a Microsoft Testing Platform project
- [run-tests](../../notes/dotnet-development/run-tests.md) — Use before running .NET tests or answering with a test command or flags

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
