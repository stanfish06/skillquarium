---
title: test-anti-patterns
aliases:
  - test anti patterns
  - Critical
  - Warning
  - Info
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: test-anti-patterns/SKILL.md
created: 2026-07-21
---

# test-anti-patterns

> [!info] What it does
> Audits an existing test file or suite in any language for anti-patterns and quality issues — produces a severity-ranked report (Critical/Warning/Info). INVOKE whenever asked to audit or review tests, find what's wrong with a suite, judge whether tests are any good, or check for: tests that pass but verify nothing, missing assertions, swallowed exceptions, self-comparing / tautological assertions, coverage-touching tests, broad exceptions, flaky or order-dependent tests (Thread.Sleep, DateTime.Now, shared state), duplicated tests, or magic values — in .NET, Python/pytest, TS/Jest, Java, Go, Ruby or C++. DO NOT USE FOR: writing new tests (use code-testing-agent, or writing-mstest-tests for MSTest); running tests (use run-tests); migration; assertion-diversity metrics (use assertion-quality); coverage/CRAP metrics (use coverage-analysis); the testsmells.org academic catalog (use test-smell-detection); fixing or modernizing MSTest tests, assertions, attributes, or lifecycle (use writing-mstest-tests).

**Source:** [test-anti-patterns/SKILL.md](test-anti-patterns/SKILL.md)  ·  **Domain:** [.NET & C# Development](maps/dotnet-development.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [assertion-quality](assertion-quality.md) — Analyzes the variety and depth of assertions across test suites in any language
- [code-testing-agent](code-testing-agent.md) — Generates and writes new unit tests for any programming language — scaffolds test projects and configures coverage tooling (coverlet, pytest-cov, @vitest/coverage-v8) as part of test...
- [coverage-analysis](coverage-analysis.md) — Coverage analysis measures code exercised during fuzzing
- [dotnet-coverage-analysis](dotnet-coverage-analysis.md) — Project-wide code coverage and CRAP (Change Risk Anti-Patterns) score analysis for .NET projects
- [exp-test-maintainability](exp-test-maintainability.md) — Detects duplicate boilerplate, copy-paste tests, and structural maintainability issues across .NET test suites
- [grade-tests](grade-tests.md) — Grades a specified set of test methods individually and produces a concise table mapping each test (fully-qualified name) to a letter grade (A–F), a score band, and a one-line note —...
- [jest](jest.md) — JavaScript testing with Jest — unit tests, mocks, spies, snapshot testing, code coverage, and configuration
- [pytest](pytest.md) — Testing Python code with pytest — fixtures, parametrization, markers, mocking, coverage, and configuration
- [review](review.md) — Review the changes since a fixed point (commit, branch, tag, or merge-base) along two axes — Standards (does the code follow this repo's documented coding standards?) and Spec (does...
- [run-tests](run-tests.md) — Recommend or run the exact `dotnet test` command
- [test-analysis-extensions](test-analysis-extensions.md) — Provides file paths to language-specific reference files for the test ANALYSIS skills (assertion-quality, test-anti-patterns, test-gap-analysis, test-smell-detection, test-tagging)
- [test-gap-analysis](test-gap-analysis.md) — Performs pseudo-mutation analysis on production code in any language to find gaps in existing tests
- [test-smell-detection](test-smell-detection.md) — Deep-dive audit using the full testsmells.org 19-smell academic catalog for tests in any language
- [writing-mstest-tests](writing-mstest-tests.md) — Write, create, modernize, or fix comprehensive MSTest unit tests with MSTest 3.x/4.x APIs

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

