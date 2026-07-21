---
title: migrate-mstest-v1v2-to-v3
aliases:
  - migrate mstest v1v2 to v3
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: migrate-mstest-v1v2-to-v3/SKILL.md
created: 2026-07-21
---

# migrate-mstest-v1v2-to-v3

> [!info] What it does
> Migrate MSTest v1 or v2 test projects to MSTest v3. Use when the user asks to upgrade MSTest and the project has QualityTools assembly references, MSTest.TestFramework/TestAdapter 1.x-2.x, .testsettings, or migration errors after changing those packages to 3.x. USE FOR: upgrading from MSTest v1 assembly references (Microsoft.VisualStudio.QualityTools.UnitTestFramework) or MSTest v2 NuGet (MSTest.TestFramework 1.x-2.x) to MSTest v3, fixing assertion overload errors (AreEqual/AreNotEqual), updating DataRow constructors, replacing .testsettings with .runsettings, timeout behavior changes, target framework compatibility (.NET 5 dropped -- use .NET 6+; .NET Fx older than 4.6.2 dropped), adopting MSTest.Sdk while moving from v1/v2. First step toward MSTest v4 -- after this, use migrate-mstest-v3-to-v4. DO NOT USE FOR: migrating to MSTest v4 (use migrate-mstest-v3-to-v4), projects already on MSTest v3+, migrating between test frameworks, generic test modernization, or .NET upgrades unrelated to MSTest.

**Source:** [migrate-mstest-v1v2-to-v3/SKILL.md](migrate-mstest-v1v2-to-v3/SKILL.md)  ·  **Domain:** [.NET & C# Development](maps/dotnet-development.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [migrate-mstest-v3-to-v4](migrate-mstest-v3-to-v4.md) — Fix build errors and breaking changes after upgrading MSTest from v3 to v4, or plan a complete MSTest v3-to-v4 migration

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

