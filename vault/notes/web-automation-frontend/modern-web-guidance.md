---
title: modern-web-guidance
aliases:
  - modern web guidance
tags:
  - skill
  - domain/web-automation-frontend
domain: web-automation-frontend
status: untried
source: skills/modern-web-guidance/SKILL.md
created: 2026-11-10
---

# modern-web-guidance

> [!info] What it does
> Search tool for modern web development best practices. Use for HTML/CSS and clientside JS tasks; web APIs evolve rapidly and training weights contain obsolete patterns. Triggers: modals/dialogs/popovers, tables, dark mode, anchor positioning, container queries, view transitions, scroll-driven animations, parallax/reveals, forms, validation, autofill, accessibility, custom selects, scrollbars, CWV (LCP, INP, CLS), content-visibility, fetch priority, image optimization, security, passkeys, HTML sanitization, web components, dates/timezones, built-in AI, WebAssembly, standard HTML/CSS/DOM in frameworks, etc. DO NOT trigger for: backend (SQL, ORMs, API routes), infra/scripts (CI/CD, Docker, Actions, Python/Go, Git), or tooling/trivial (Vite, tsconfig, ESLint, tests, copy/renames, 3P docs), etc.

**Source:** [skills/modern-web-guidance/SKILL.md](../../../skills/modern-web-guidance/SKILL.md)  ·  **Domain:** [Web Automation, Frontend & Design](../../maps/web-automation-frontend.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [docker](../../notes/software-dev/docker.md) — Containerizing and shipping applications with Docker — writing efficient Dockerfiles (multi-stage builds, layer caching, small/secure images), docker compose for multi-service local...
- [validation](../../notes/software-dev/validation.md) — Use when Codex is already in the validation phase of a security scan or the user explicitly asks to determine whether one or more candidate security findings are valid
- [vite](../../notes/web-automation-frontend/vite.md) — Vite build tool configuration, plugin API, SSR, and Vite 8 Rolldown migration

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

**Supply-chain risk, accepted (2026-11-12, #1320).** The skill runs `npx -y modern-web-guidance@latest search|retrieve`
(168 occurrences across 66 files) and is designed to: `@latest` is mutable and `-y` skips the install
prompt, so each lookup downloads and runs the newest npm release with the agent's permissions, and the
guidance it returns (including security topics such as passkeys and sanitization) is not reviewed here.
Not pinned via overrides: ~66 overrides on a repo that releases daily would quarantine the skill whenever
upstream renames a guide, and a pinned CLI would drift from the `--skill-version` the sync updates.
Mitigation: run agents with permission prompts on, or allowlist only `npx -y modern-web-guidance@<version>`.
