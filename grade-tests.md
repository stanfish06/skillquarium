---
title: grade-tests
aliases:
  - grade tests
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: grade-tests/SKILL.md
created: 2026-07-21
---

# grade-tests

> [!info] What it does
> Grades a specified set of test methods individually and produces a concise table mapping each test (fully-qualified name) to a letter grade (A–F), a score band, and a one-line note — designed to be posted as a PR comment. Use when the caller wants per-test feedback on a curated list of methods (for example, the new or modified tests in a pull request), not a suite-wide audit. Polyglot: .NET, Python, TS/JS, Java, Go, Ruby, Rust, Swift, Kotlin, PowerShell, C++. Input is a list of test methods (or method bodies / file+line spans); output is a compact markdown table plus a short summary. DO NOT USE FOR: full suite audits (use test-quality-auditor agent or test-anti-patterns), writing new tests (use code-testing-generator agent or writing-mstest-tests), fixing failures, or measuring code coverage.

**Source:** [grade-tests/SKILL.md](grade-tests/SKILL.md)  ·  **Domain:** [.NET & C# Development](maps/dotnet-development.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [test-anti-patterns](test-anti-patterns.md) — Audits an existing test file or suite in any language for anti-patterns and quality issues — produces a severity-ranked report (Critical/Warning/Info)
- [writing-mstest-tests](writing-mstest-tests.md) — Write, create, modernize, or fix comprehensive MSTest unit tests with MSTest 3.x/4.x APIs

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

