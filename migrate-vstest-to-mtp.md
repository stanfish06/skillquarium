---
title: migrate-vstest-to-mtp
aliases:
  - migrate vstest to mtp
  - MTP
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: migrate-vstest-to-mtp/SKILL.md
created: 2026-07-21
---

# migrate-vstest-to-mtp

> [!info] What it does
> Migrates .NET test projects from VSTest to Microsoft.Testing.Platform (MTP). Use when user asks to "migrate to MTP", "switch from VSTest", "enable Microsoft.Testing.Platform", "use MTP runner", set OutputType=Exe only for test projects in Directory.Build.props, or mentions EnableMSTestRunner, EnableNUnitRunner, or UseMicrosoftTestingPlatformRunner. USE FOR: MTP behavioral differences vs VSTest (exit code 8, zero tests discovered, --ignore-exit-code, TESTINGPLATFORM_EXITCODE_IGNORE); centralizing MTP properties and OutputType=Exe on test projects via MSBuildProjectName, not IsTestProject. Supports MSTest, NUnit, xUnit.net v2 (via YTest.MTP.XUnit2), and xUnit.net v3. Covers runner enablement, CLI argument and filter translation (--filter-class/--filter-trait/--filter-query), global.json config, CI/CD updates, and extension packages. DO NOT USE FOR: migrating between test frameworks (MSTest/xUnit/NUnit), xUnit.net v2 to v3 API migration, MSTest version upgrades, TFM upgrades, or UWP/WinUI test projects.

**Source:** [migrate-vstest-to-mtp/SKILL.md](migrate-vstest-to-mtp/SKILL.md)  ·  **Domain:** [.NET & C# Development](maps/dotnet-development.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [filter-syntax](filter-syntax.md) — Reference data for test filter syntax across all platform and framework combinations: VSTest --filter expressions, MTP filters for MSTest/NUnit/xUnit v3/TUnit, and VSTest-to-MTP filter...
- [migrate-xunit-to-xunit-v3](migrate-xunit-to-xunit-v3.md) — Migrates .NET test projects from xUnit.net v2 to xUnit.net v3
- [platform-detection](platform-detection.md) — Reference data for detecting the test platform (VSTest vs Microsoft.Testing.Platform) and test framework (MSTest, xUnit, NUnit, TUnit) from project files

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

