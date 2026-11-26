---
title: assertion-quality
aliases:
  - assertion quality
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: skills/assertion-quality/SKILL.md
created: 2026-07-21
---

# assertion-quality

> [!info] What it does
> Analyze weak, shallow, trivial, self-referential, assertion-free, or presence-only assertions; Contains fragments or totals replacing predictable generated code, JSON, CLI, report, or protocol output. Supports MSTest, Jest, pytest, and Go. DO NOT USE for direct assertion fixes (writing-mstest-tests for MSTest, code-testing for other frameworks), new cases (code-testing), missing scenarios or identified production changes (test-gap-analysis), or general severity-ranked audits (test-anti-patterns).

**Source:** [skills/assertion-quality/SKILL.md](../../../skills/assertion-quality/SKILL.md)  ·  **Domain:** [.NET & C# Development](../../maps/dotnet-development.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [jest](../../notes/software-dev/jest.md) — JavaScript testing with Jest — unit tests, mocks, spies, snapshot testing, code coverage, and configuration
- [pytest](../../notes/software-dev/pytest.md) — Testing Python code with pytest — fixtures, parametrization, markers, mocking, coverage, and configuration
- [test-analysis-extensions](../../notes/dotnet-development/test-analysis-extensions.md) — Provides file paths to language-specific reference files for the test ANALYSIS skills (assertion-quality, test-anti-patterns, test-gap-analysis, test-smell-detection, test-tagging)
- [test-anti-patterns](../../notes/dotnet-development/test-anti-patterns.md) — Audit a test file or suite; produce a severity-ranked diagnostic report
- [test-gap-analysis](../../notes/dotnet-development/test-gap-analysis.md) — Find caller-visible production changes existing tests would miss through pseudo-mutation analysis
- [writing-mstest-tests](../../notes/dotnet-development/writing-mstest-tests.md) — Use when asked to fix, rewrite, update, improve, modernize, show corrected code for, or explain existing MSTest tests or MSTest-specific configuration

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

> [!note] Vault audit 2026-07-24 — USE-19
> Use this for language-agnostic assertion-quality analysis across any test suite (.NET, Python, TS/JS, Java, Go, Ruby, Rust, …); it is filed under the .NET map but is not .NET-specific, and for MSTest-specific authoring use `writing-mstest-tests`. Distinguishing axis: polyglot test analysis vs .NET-only authoring.
