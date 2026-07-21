---
title: migrate-mstest-v3-to-v4
aliases:
  - migrate mstest v3 to v4
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: migrate-mstest-v3-to-v4/SKILL.md
created: 2026-07-21
---

# migrate-mstest-v3-to-v4

> [!info] What it does
> Fix build errors and breaking changes after upgrading MSTest from v3 to v4, or plan a complete MSTest v3-to-v4 migration. Use when user says "upgrade to MSTest v4", "MSTest 4 migration", "MSTest v4 breaking changes", "tests don't compile after upgrading MSTest", or has errors CS0507, CS0103, CS1061, CS1615 after updating MSTest packages from 3.x to 4.x. USE FOR: Execute to ExecuteAsync, CallerInfo constructor on TestMethodAttribute, sealed custom attributes, ClassCleanupBehavior removal, TestContext.Properties Contains to ContainsKey, Assert.ThrowsException to ThrowsExactly, Assert.IsInstanceOfType out parameter removal, ExpectedExceptionAttribute removal, TestTimeout enum removal, [TestMethod("name")] to DisplayName syntax, TreatDiscoveryWarningsAsErrors, TestContext.TestName in ClassInitialize, MSTest.Sdk MTP changes, dropped TFMs (net6.0/net7.0 to net8.0+). DO NOT USE FOR: migrating from MSTest v1/v2 to v3 (use migrate-mstest-v1v2-to-v3 first), migrating between test frameworks, or general .NET upgrades.

**Source:** [migrate-mstest-v3-to-v4/SKILL.md](migrate-mstest-v3-to-v4/SKILL.md)  ·  **Domain:** [.NET & C# Development](maps/dotnet-development.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [migrate-mstest-v1v2-to-v3](migrate-mstest-v1v2-to-v3.md) — Migrate MSTest v1 or v2 test projects to MSTest v3

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

