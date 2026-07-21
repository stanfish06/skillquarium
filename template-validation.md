---
title: template-validation
aliases:
  - template validation
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: template-validation/SKILL.md
created: 2026-07-21
---

# template-validation

> [!info] What it does
> Validates custom dotnet new templates for correctness before publishing. Catches missing fields, parameter bugs, shortName conflicts, constraint issues, and common authoring mistakes that cause templates to fail silently. USE FOR: checking template.json files for errors before publishing or testing, diagnosing why a template doesn't appear after installation, reviewing template parameter definitions for type mismatches and missing defaults, finding shortName conflicts with dotnet CLI commands, validating post-action and constraint configuration. DO NOT USE FOR: finding or using existing templates (use template-discovery), creating projects from templates (use template-instantiation), creating templates from existing projects (use template-authoring).

**Source:** [template-validation/SKILL.md](template-validation/SKILL.md)  ·  **Domain:** [.NET & C# Development](maps/dotnet-development.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [template-authoring](template-authoring.md) — Guides creation and validation of custom dotnet new templates from existing projects
- [template-comparison](template-comparison.md) — Compares two or more dotnet new templates side by side to help users choose between them based on parameters, feature support, frameworks, and classifications
- [template-discovery](template-discovery.md) — Helps find, inspect, and compare (at a high level) .NET project templates
- [template-instantiation](template-instantiation.md) — Creates .NET projects from templates with validated parameters, smart defaults, Central Package Management adaptation, and latest NuGet version resolution
- [template-smart-defaults](template-smart-defaults.md) — Applies cross-parameter default rules when creating .NET projects with dotnet new, filling gaps consistently without overriding values the user set explicitly

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

