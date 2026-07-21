---
title: template-authoring
aliases:
  - template authoring
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: template-authoring/SKILL.md
created: 2026-07-21
---

# template-authoring

> [!info] What it does
> Guides creation and validation of custom dotnet new templates from existing projects. Generates a .template.config/template.json that preserves the source project's conventions. USE FOR: creating a reusable dotnet new template from an existing project, bootstrapping .template.config/template.json with correct identity, shortName, parameters, and post-actions, adding parameters or conditional content to a template you are authoring, validating the template.json you are authoring before publishing, packaging templates as NuGet packages for distribution. DO NOT USE FOR: validating an existing template.json as a standalone task (use template-validation), finding or using existing templates (use template-discovery and template-instantiation), MSBuild project file issues unrelated to template authoring, NuGet package publishing (only template packaging structure).

**Source:** [template-authoring/SKILL.md](template-authoring/SKILL.md)  ·  **Domain:** [.NET & C# Development](maps/dotnet-development.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [template-comparison](template-comparison.md) — Compares two or more dotnet new templates side by side to help users choose between them based on parameters, feature support, frameworks, and classifications
- [template-discovery](template-discovery.md) — Helps find, inspect, and compare (at a high level) .NET project templates
- [template-instantiation](template-instantiation.md) — Creates .NET projects from templates with validated parameters, smart defaults, Central Package Management adaptation, and latest NuGet version resolution
- [template-smart-defaults](template-smart-defaults.md) — Applies cross-parameter default rules when creating .NET projects with dotnet new, filling gaps consistently without overriding values the user set explicitly
- [template-validation](template-validation.md) — Validates custom dotnet new templates for correctness before publishing

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

