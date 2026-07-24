---
title: assertion-quality
aliases:
  - assertion quality
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: assertion-quality/SKILL.md
created: 2026-07-21
---

# assertion-quality

> [!info] What it does
> Analyzes the variety and depth of assertions across test suites in any language. Use when the user asks to evaluate assertion quality, find shallow tests, identify assertion-free tests (no assertions or only trivial ones like Assert.IsNotNull / toBeTruthy()), flag self-referential or tautological assertions, measure assertion diversity, or audit whether tests verify different facets of behavior. Polyglot: .NET, Python, TS/JS, Java, Go, Ruby, Rust, Swift, Kotlin, PowerShell, C++. DO NOT USE FOR: writing new tests (use code-testing-agent / writing-mstest-tests), mutation reasoning about whether tests would catch a bug (use test-gap-analysis), or a general severity-ranked anti-pattern audit (use test-anti-patterns), fixing or rewriting assertions, or writing, fixing, or modernizing MSTest tests, assertions, or attributes (use writing-mstest-tests).

**Source:** [assertion-quality/SKILL.md](assertion-quality/SKILL.md)  ·  **Domain:** [.NET & C# Development](maps/dotnet-development.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [code-testing-agent](code-testing-agent.md) — Generates and writes new unit tests for any programming language — scaffolds test projects and configures coverage tooling (coverlet, pytest-cov, @vitest/coverage-v8) as part of test...
- [find-untested-sources](find-untested-sources.md) — Parse-only static analysis that pairs source files with the tests referencing them and emits JSON listing untested files ordered by API surface, each with a suggested_test_path
- [test-analysis-extensions](test-analysis-extensions.md) — Provides file paths to language-specific reference files for the test ANALYSIS skills (assertion-quality, test-anti-patterns, test-gap-analysis, test-smell-detection, test-tagging)
- [test-anti-patterns](test-anti-patterns.md) — Audits an existing test file or suite in any language for anti-patterns and quality issues — produces a severity-ranked report (Critical/Warning/Info)
- [test-gap-analysis](test-gap-analysis.md) — Performs pseudo-mutation analysis on production code in any language to find gaps in existing tests
- [writing-mstest-tests](writing-mstest-tests.md) — Write, create, modernize, or fix comprehensive MSTest unit tests with MSTest 3.x/4.x APIs

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

> [!note] Vault audit 2026-07-24 — USE-19
> Use this for language-agnostic assertion-quality analysis across any test suite (.NET, Python, TS/JS, Java, Go, Ruby, Rust, …); it is filed under the .NET map but is not .NET-specific, and for MSTest-specific authoring use `writing-mstest-tests`. Distinguishing axis: polyglot test analysis vs .NET-only authoring.

