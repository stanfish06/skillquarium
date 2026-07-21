---
title: template-smart-defaults
aliases:
  - template smart defaults
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: template-smart-defaults/SKILL.md
created: 2026-07-21
---

# template-smart-defaults

> [!info] What it does
> Applies cross-parameter default rules when creating .NET projects with dotnet new, filling gaps consistently without overriding values the user set explicitly. USE FOR: choosing which target framework to pair with native AOT, deciding whether to keep HTTPS when authentication is enabled, recognizing that controllers and minimal-API flags are mutually exclusive, filling unset related parameters during project creation, explaining why a default was applied and ensuring an explicit user value is never overridden. DO NOT USE FOR: creating the project itself (use template-instantiation), finding or comparing templates (use template-discovery and template-comparison), authoring or validating custom templates (use template-authoring and template-validation).

**Source:** [template-smart-defaults/SKILL.md](template-smart-defaults/SKILL.md)  ·  **Domain:** [.NET & C# Development](maps/dotnet-development.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [template-authoring](template-authoring.md) — Guides creation and validation of custom dotnet new templates from existing projects
- [template-comparison](template-comparison.md) — Compares two or more dotnet new templates side by side to help users choose between them based on parameters, feature support, frameworks, and classifications
- [template-discovery](template-discovery.md) — Helps find, inspect, and compare (at a high level) .NET project templates
- [template-instantiation](template-instantiation.md) — Creates .NET projects from templates with validated parameters, smart defaults, Central Package Management adaptation, and latest NuGet version resolution
- [template-validation](template-validation.md) — Validates custom dotnet new templates for correctness before publishing

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

