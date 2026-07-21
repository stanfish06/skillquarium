---
title: template-discovery
aliases:
  - template discovery
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: template-discovery/SKILL.md
created: 2026-07-21
---

# template-discovery

> [!info] What it does
> Helps find, inspect, and compare (at a high level) .NET project templates. Resolves natural-language project descriptions to ranked template matches with pre-filled parameters. USE FOR: finding the right dotnet new template for a task, inspecting a template's parameters and constraints, understanding what a template produces before creating a project, resolving intent like "web API with auth" to concrete template + parameters. DO NOT USE FOR: actually creating projects (use template-instantiation), authoring custom templates (use template-authoring), producing a detailed side-by-side comparison (use template-comparison), choosing cross-parameter defaults during creation (use template-smart-defaults), MSBuild or build issues (use dotnet-msbuild plugin), NuGet package management unrelated to template packages.

**Source:** [template-discovery/SKILL.md](template-discovery/SKILL.md)  ·  **Domain:** [.NET & C# Development](maps/dotnet-development.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [template-authoring](template-authoring.md) — Guides creation and validation of custom dotnet new templates from existing projects
- [template-comparison](template-comparison.md) — Compares two or more dotnet new templates side by side to help users choose between them based on parameters, feature support, frameworks, and classifications
- [template-instantiation](template-instantiation.md) — Creates .NET projects from templates with validated parameters, smart defaults, Central Package Management adaptation, and latest NuGet version resolution
- [template-smart-defaults](template-smart-defaults.md) — Applies cross-parameter default rules when creating .NET projects with dotnet new, filling gaps consistently without overriding values the user set explicitly
- [template-validation](template-validation.md) — Validates custom dotnet new templates for correctness before publishing

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

