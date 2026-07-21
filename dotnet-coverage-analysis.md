---
title: dotnet-coverage-analysis
aliases:
  - dotnet coverage analysis
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: dotnet-coverage-analysis/SKILL.md
created: 2026-07-21
---

# dotnet-coverage-analysis

> [!info] What it does
> Project-wide code coverage and CRAP (Change Risk Anti-Patterns) score analysis for .NET projects. Calculates CRAP scores per method and surfaces risk hotspots — complex code with low coverage that is dangerous to modify. Use to diagnose why coverage is stuck or plateaued, identify what methods block improvement, or get project-wide coverage analysis with risk ranking. USE FOR: coverage stuck, coverage plateau, can't increase coverage, what's blocking coverage, coverage gap, CRAP scores, risk hotspots, where to add tests, coverage analysis, coverage report. DO NOT USE FOR: targeted single-method CRAP analysis (use crap-score); auditing test code for coverage-touching or other anti-patterns (use test-anti-patterns); writing tests; running tests (use run-tests). Requires or produces coverage (Cobertura) and CRAP metrics.

**Source:** [dotnet-coverage-analysis/SKILL.md](dotnet-coverage-analysis/SKILL.md)  ·  **Domain:** [.NET & C# Development](maps/dotnet-development.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [crap-score](crap-score.md) — Calculates targeted CRAP (Change Risk Anti-Patterns) scores for a named .NET method, class, or single source file
- [run-tests](run-tests.md) — Recommend or run the exact `dotnet test` command
- [test-anti-patterns](test-anti-patterns.md) — Audits an existing test file or suite in any language for anti-patterns and quality issues — produces a severity-ranked report (Critical/Warning/Info)

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

