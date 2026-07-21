---
title: test-analysis-extensions
aliases:
  - test analysis extensions
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: test-analysis-extensions/SKILL.md
created: 2026-07-21
---

# test-analysis-extensions

> [!info] What it does
> Provides file paths to language-specific reference files for the test ANALYSIS skills (assertion-quality, test-anti-patterns, test-gap-analysis, test-smell-detection, test-tagging). Call this skill to discover available extension files (e.g., dotnet.md for .NET/MSTest/xUnit/NUnit/TUnit, python.md for pytest/unittest, typescript.md for Jest/Vitest/Mocha, java.md for JUnit/TestNG, etc.). Do not use directly — invoked by the test-quality-auditor agent and polyglot analysis skills that need framework-specific lookup tables (test markers, assertion APIs, skip annotations, sleep patterns, mystery guest indicators, integration markers, setup/teardown, tag-support capability).

**Source:** [test-analysis-extensions/SKILL.md](test-analysis-extensions/SKILL.md)  ·  **Domain:** [.NET & C# Development](maps/dotnet-development.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [assertion-quality](assertion-quality.md) — Analyzes the variety and depth of assertions across test suites in any language
- [jest](jest.md) — JavaScript testing with Jest — unit tests, mocks, spies, snapshot testing, code coverage, and configuration
- [pytest](pytest.md) — Testing Python code with pytest — fixtures, parametrization, markers, mocking, coverage, and configuration
- [test-anti-patterns](test-anti-patterns.md) — Audits an existing test file or suite in any language for anti-patterns and quality issues — produces a severity-ranked report (Critical/Warning/Info)
- [test-gap-analysis](test-gap-analysis.md) — Performs pseudo-mutation analysis on production code in any language to find gaps in existing tests
- [test-smell-detection](test-smell-detection.md) — Deep-dive audit using the full testsmells.org 19-smell academic catalog for tests in any language
- [test-tagging](test-tagging.md) — Analyzes test suites in any language and tags each test with standardized traits (positive, negative, critical-path, boundary, smoke, regression, integration, performance, security)
- [vitest](vitest.md) — JavaScript/TypeScript unit testing with Vitest — fast Vite-native test runner with Jest-compatible API

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

