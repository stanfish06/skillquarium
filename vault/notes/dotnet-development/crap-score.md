---
title: crap-score
aliases:
  - crap score
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: skills/crap-score/SKILL.md
created: 2026-07-21
---

# crap-score

> [!info] What it does
> Calculates CRAP (Change Risk Anti-Patterns) for a named .NET method, class, or file. USE FOR: explicit CRAP calculation or coverage-and-complexity risk within that named target, including which tests to prioritize. DO NOT USE FOR: project-wide coverage/CRAP, plateaus, or project-wide blockers/priorities (coverage-analysis); behavioral/pseudo-mutation gaps (test-gap-analysis); writing tests; test runs without CRAP context.

**Source:** [skills/crap-score/SKILL.md](../../../skills/crap-score/SKILL.md)  ·  **Domain:** [.NET & C# Development](../../maps/dotnet-development.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [coverage-analysis](../../notes/security-auditing/coverage-analysis.md) — Measures and interprets what a fuzzing campaign actually reaches, using llvm-cov, lcov, or a fuzzer's own coverage output
- [dotnet-coverage-analysis](../../notes/dotnet-development/dotnet-coverage-analysis.md) — Project-wide code coverage and CRAP (Change Risk Anti-Patterns) score analysis for .NET projects
- [test-anti-patterns](../../notes/dotnet-development/test-anti-patterns.md) — Audit a test file or suite; produce a severity-ranked diagnostic report
- [test-gap-analysis](../../notes/dotnet-development/test-gap-analysis.md) — Pseudo-mutation analysis ONLY: answer whether tests would catch a bug if production code changed, which meaningful changes would still pass, or which caller-visible mutations existing...
- [test-tagging](../../notes/dotnet-development/test-tagging.md) — Classifies existing tests by standard traits and reports their distribution

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

> [!warning] Vault audit 2026-07-24 — MNT-11
> Its DO-NOT-USE-FOR redirect sends project-wide coverage to the generic `coverage-analysis`; for .NET projects route to `dotnet-coverage-analysis` instead.
> _Remote-managed skill — the durable fix belongs upstream; this wrapper note is the local record._
