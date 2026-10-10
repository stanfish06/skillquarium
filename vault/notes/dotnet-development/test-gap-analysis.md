---
title: test-gap-analysis
aliases:
  - test gap analysis
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: skills/test-gap-analysis/SKILL.md
created: 2026-07-21
---

# test-gap-analysis

> [!info] What it does
> Pseudo-mutation analysis ONLY: answer whether tests would catch a bug if production code changed, which meaningful changes would still pass, or which caller-visible mutations existing assertions would miss; verify candidates when requested, then optionally close verified gaps. Includes explicit read-only per-test composition for grading. Activate for behavioral blind spots tied to production behavior. Polyglot. DO NOT USE FOR: suite taxonomy, metadata, or distribution reports (test-tagging); .NET line-vs-branch or Cobertura interpretation, arithmetic, plateaus, project-wide coverage gaps, or coverage-backed test/CRAP priorities (coverage-analysis; use native coverage tooling outside .NET); named-target CRAP (crap-score); new suites (code-testing); assertion/smell audits; or mutation tools.

**Source:** [skills/test-gap-analysis/SKILL.md](../../../skills/test-gap-analysis/SKILL.md)  ·  **Domain:** [.NET & C# Development](../../maps/dotnet-development.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [assertion-quality](../../notes/dotnet-development/assertion-quality.md) — Analyze assertion quality, depth, variety, and false confidence in existing tests
- [coverage-analysis](../../notes/security-auditing/coverage-analysis.md) — Measures and interprets what a fuzzing campaign actually reaches, using llvm-cov, lcov, or a fuzzer's own coverage output
- [crap-score](../../notes/dotnet-development/crap-score.md) — Calculates CRAP (Change Risk Anti-Patterns) for a named .NET method, class, or file
- [test-analysis-extensions](../../notes/dotnet-development/test-analysis-extensions.md) — Provides file paths to language-specific reference files for the test ANALYSIS skills (assertion-quality, test-anti-patterns, test-gap-analysis, test-smell-detection, test-tagging)
- [test-anti-patterns](../../notes/dotnet-development/test-anti-patterns.md) — Audit a test file or suite; produce a severity-ranked diagnostic report
- [test-tagging](../../notes/dotnet-development/test-tagging.md) — Classifies existing tests by standard traits and reports their distribution

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
