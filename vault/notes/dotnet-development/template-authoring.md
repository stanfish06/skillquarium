---
title: template-authoring
aliases:
  - template authoring
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: skills/template-authoring/SKILL.md
created: 2026-07-21
---

# template-authoring

> [!info] What it does
> Guides creation and validation of custom dotnet new templates from existing projects. Generates a .template.config/template.json that preserves the source project's conventions. USE FOR: creating a reusable dotnet new template from an existing project, bootstrapping .template.config/template.json with correct identity, shortName, parameters, and post-actions, adding parameters or conditional content to a template you are authoring, validating the template.json you are authoring before publishing, packaging templates as NuGet packages for distribution. DO NOT USE FOR: validating an existing template.json as a standalone task (use template-validation), finding or using existing templates (use template-discovery and template-instantiation), MSBuild project file issues unrelated to template authoring, NuGet package publishing (only template packaging structure).

**Source:** [skills/template-authoring/SKILL.md](../../../skills/template-authoring/SKILL.md)  ·  **Domain:** [.NET & C# Development](../../maps/dotnet-development.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [template](../../notes/vault-meta/template.md) — Canonical rules and HTML/CSS contract for the page chrome (head boilerplate, cover, table of contents, section block, sources-section wrapper, footer, outlook-badge, design tokens)...
- [template-comparison](../../notes/dotnet-development/template-comparison.md) — Compares two or more dotnet new templates side by side to help users choose between them based on parameters, feature support, frameworks, and classifications
- [template-discovery](../../notes/dotnet-development/template-discovery.md) — Helps find, inspect, and compare (at a high level) .NET project templates
- [template-instantiation](../../notes/dotnet-development/template-instantiation.md) — Creates .NET projects from templates with validated parameters, smart defaults, Central Package Management adaptation, and latest NuGet version resolution
- [template-smart-defaults](../../notes/dotnet-development/template-smart-defaults.md) — Applies cross-parameter default rules when creating .NET projects with dotnet new, filling gaps consistently without overriding values the user set explicitly
- [template-validation](../../notes/dotnet-development/template-validation.md) — Validates custom dotnet new templates for correctness before publishing
- [validation](../../notes/software-dev/validation.md) — Use when Codex is already in the validation phase of a security scan or the user explicitly asks to determine whether one or more candidate security findings are valid

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
