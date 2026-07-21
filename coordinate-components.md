---
title: coordinate-components
aliases:
  - coordinate components
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: coordinate-components/SKILL.md
created: 2026-07-21
---

# coordinate-components

> [!info] What it does
> Share state between components that don't have a direct parent-child parameter relationship, using cascading values, scoped services with change events, or CascadingValueSource via DI. USE WHEN the user needs a CascadingParameter or CascadingValue that works across render mode boundaries, a shopping cart or notification count accessible from multiple pages, a theme or user preference cascaded app-wide, or when components in different parts of the tree must react when shared data changes. Also USE WHEN cascading values aren't reaching interactive children in per-page interactivity mode, or when the user needs to understand scoped vs singleton service lifetime for state on Blazor Server. DO NOT USE for direct parent-child parameter passing or EventCallback (see author-component), for persisting state across prerender-to-interactive transitions (see support-prerendering), or for service abstractions for data fetching in Auto/WebAssembly (see fetch-and-send-data).

**Source:** [coordinate-components/SKILL.md](coordinate-components/SKILL.md)  ·  **Domain:** [.NET & C# Development](maps/dotnet-development.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [author-component](author-component.md) — Create or review Blazor components (.razor files) with correct architecture
- [configure-auth](configure-auth.md) — Add authentication and authorization to a Blazor Web App, accounting for the app's render mode
- [fetch-and-send-data](fetch-and-send-data.md) — Call APIs, load data into components, and handle the async lifecycle in Blazor
- [support-prerendering](support-prerendering.md) — Make interactive Blazor components work correctly with prerendering

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

