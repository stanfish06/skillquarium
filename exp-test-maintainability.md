---
title: exp-test-maintainability
aliases:
  - exp test maintainability
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: exp-test-maintainability/SKILL.md
created: 2026-07-21
---

# exp-test-maintainability

> [!info] What it does
> Detects duplicate boilerplate, copy-paste tests, and structural maintainability issues across .NET test suites. Use when the user asks to reduce repetition, consolidate similar test methods, convert copy-paste tests to data-driven parameterized tests, suggest a better test structure, or identify refactoring opportunities. Identifies repeated construction, assertion patterns, copy-paste methods convertible to DataRow/Theory/TestCase, redundant setup/teardown, and shared infrastructure. Produces an analysis report with concrete before/after suggestions. Works with MSTest, xUnit, NUnit, and TUnit. DO NOT USE FOR: writing new tests (use writing-mstest-tests), reviewing test quality or anti-patterns (use test-anti-patterns), or deep mock auditing (use exp-mock-usage-analysis).

**Source:** [exp-test-maintainability/SKILL.md](exp-test-maintainability/SKILL.md)  ·  **Domain:** [.NET & C# Development](maps/dotnet-development.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [exp-mock-usage-analysis](exp-mock-usage-analysis.md) — Audits .NET test mock usage by tracing each mock setup through the production code's execution path to find dead, unreachable, redundant, or replaceable mocks
- [test-anti-patterns](test-anti-patterns.md) — Audits an existing test file or suite in any language for anti-patterns and quality issues — produces a severity-ranked report (Critical/Warning/Info)
- [writing-mstest-tests](writing-mstest-tests.md) — Write, create, modernize, or fix comprehensive MSTest unit tests with MSTest 3.x/4.x APIs

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

