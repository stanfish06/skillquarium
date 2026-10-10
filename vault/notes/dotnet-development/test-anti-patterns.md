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
source: skills/test-anti-patterns/SKILL.md
created: 2026-07-21
---

# test-anti-patterns

> [!info] What it does
> Audit a test file or suite; produce a severity-ranked diagnostic report. Use for tests that verify nothing, missing/tautological assertions, swallowed/broad exceptions, flaky/order-dependent tests, duplication, or magic values. Polyglot. DO NOT USE for direct edits: writing-mstest-tests owns supplied MSTest assertions/attributes/lifecycle; code-testing owns new tests. Exclude running tests, migration, assertion metrics (assertion-quality), raw .NET coverage collection (run-tests), non-.NET coverage collection/analysis (native tooling), project-wide .NET coverage/CRAP (coverage-analysis), named-target .NET CRAP (crap-score), behavioral/pseudo-mutation gaps (test-gap-analysis), test-mix/ happy-vs-error classification and trait distributions (test-tagging), or the testsmells.org catalog (test-smell-detection).

**Source:** [skills/test-anti-patterns/SKILL.md](../../../skills/test-anti-patterns/SKILL.md)  ·  **Domain:** [.NET & C# Development](../../maps/dotnet-development.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [assertion-quality](../../notes/dotnet-development/assertion-quality.md) — Analyze assertion quality, depth, variety, and false confidence in existing tests
- [coverage-analysis](../../notes/security-auditing/coverage-analysis.md) — Measures and interprets what a fuzzing campaign actually reaches, using llvm-cov, lcov, or a fuzzer's own coverage output
- [crap-score](../../notes/dotnet-development/crap-score.md) — Calculates CRAP (Change Risk Anti-Patterns) for a named .NET method, class, or file
- [dotnet-coverage-analysis](../../notes/dotnet-development/dotnet-coverage-analysis.md) — Project-wide code coverage and CRAP (Change Risk Anti-Patterns) score analysis for .NET projects
- [exp-test-maintainability](../../notes/dotnet-development/exp-test-maintainability.md) — Detects duplicate boilerplate, copy-paste tests, and structural maintainability issues across .NET test suites
- [grade-tests](../../notes/dotnet-development/grade-tests.md) — Grade a curated list of individual tests for readiness, A-F quality, and concrete improvements
- [run-tests](../../notes/dotnet-development/run-tests.md) — Use before running .NET tests or answering with a test command or flags
- [test-analysis-extensions](../../notes/dotnet-development/test-analysis-extensions.md) — Provides file paths to language-specific reference files for the test ANALYSIS skills (assertion-quality, test-anti-patterns, test-gap-analysis, test-smell-detection, test-tagging)
- [test-gap-analysis](../../notes/dotnet-development/test-gap-analysis.md) — Pseudo-mutation analysis ONLY: answer whether tests would catch a bug if production code changed, which meaningful changes would still pass, or which caller-visible mutations existing...
- [test-smell-detection](../../notes/dotnet-development/test-smell-detection.md) — Audits existing tests in any language using formal, research-backed test smell names and the testsmells.org 19-smell academic taxonomy
- [test-tagging](../../notes/dotnet-development/test-tagging.md) — Classifies existing tests by standard traits and reports their distribution
- [writing-mstest-tests](../../notes/dotnet-development/writing-mstest-tests.md) — Use when asked to fix, rewrite, update, improve, modernize, show corrected code for, or explain existing MSTest tests or MSTest-specific configuration

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

> [!note] Vault audit 2026-07-24 — USE-19
> Use this for language-agnostic test anti-pattern audits across any suite; it is filed under the .NET map but is not .NET-specific — for .NET/MSTest authoring use `writing-mstest-tests` and for .NET coverage/CRAP use `dotnet-coverage-analysis`. Distinguishing axis: polyglot test analysis vs .NET-only tooling.
