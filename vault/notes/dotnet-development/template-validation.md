---
title: template-validation
aliases:
  - template validation
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: skills/template-validation/SKILL.md
created: 2026-07-21
---

# template-validation

> [!info] What it does
> Validates custom dotnet new templates for correctness before publishing. Catches missing fields, parameter bugs, shortName conflicts, constraint issues, and common authoring mistakes that cause templates to fail silently. USE FOR: checking template.json files for errors before publishing or testing, diagnosing why a template doesn't appear after installation, reviewing template parameter definitions for type mismatches and missing defaults, finding shortName conflicts with dotnet CLI commands, validating post-action and constraint configuration. DO NOT USE FOR: finding or using existing templates (use template-discovery), creating projects from templates (use template-instantiation), creating templates from existing projects (use template-authoring).

**Source:** [skills/template-validation/SKILL.md](../../../skills/template-validation/SKILL.md)  ·  **Domain:** [.NET & C# Development](../../maps/dotnet-development.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [template](../../notes/vault-meta/template.md) — Canonical rules and HTML/CSS contract for the page chrome (head boilerplate, cover, table of contents, section block, sources-section wrapper, footer, outlook-badge, design tokens)...
- [template-authoring](../../notes/dotnet-development/template-authoring.md) — Guides creation and validation of custom dotnet new templates from existing projects
- [template-comparison](../../notes/dotnet-development/template-comparison.md) — Compares two or more dotnet new templates side by side to help users choose between them based on parameters, feature support, frameworks, and classifications
- [template-discovery](../../notes/dotnet-development/template-discovery.md) — Helps find, inspect, and compare (at a high level) .NET project templates
- [template-instantiation](../../notes/dotnet-development/template-instantiation.md) — Creates .NET projects from templates with validated parameters, smart defaults, Central Package Management adaptation, and latest NuGet version resolution
- [template-smart-defaults](../../notes/dotnet-development/template-smart-defaults.md) — Applies cross-parameter default rules when creating .NET projects with dotnet new, filling gaps consistently without overriding values the user set explicitly

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
