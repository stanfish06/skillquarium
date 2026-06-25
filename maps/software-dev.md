---
title: Software Development & Engineering
tags:
  - skill-map
created: 2026-06-13
---

# Software Development & Engineering

> [!abstract] Scope
> General software-engineering methodology and tooling: TDD, debugging, code review, planning, git worktrees, source-grounded implementation, plus core app primitives (pytest, Docker, FastAPI, CI).

[Back to Skill Index](../index.md)

**Related maps:** [Vault, Skills & Workflow Meta](vault-meta.md) | [Security & Auditing](security-auditing.md) | [Cloud, Infra & MLOps](cloud-devops.md) | [Reasoning, Ideation & Decision](reasoning-ideation.md)

## Skills (97)

- [api-and-interface-design](../api-and-interface-design.md) — Guides stable API and interface design. Use when designing APIs, module boundaries, or any public interface
- [brainstorming](../brainstorming.md) — You MUST use this before any creative work - creating features, building components, adding functionality, or modifying behavior
- [cavekit-design-system](../cavekit-design-system.md) — How to write and maintain DESIGN.md as the visual specification layer for Cavekit projects
- [cavekit-methodology](../cavekit-methodology.md) — Cavekit specification-driven development methodology — the Hunt lifecycle (Draft → Architect → Build → Inspect → Monitor) and how to apply it
- [cavekit-revision](../cavekit-revision.md) — Trace bugs and manual fixes back to kits and prompts
- [cavekit-validation-first](../cavekit-validation-first.md) — Validation-first design for Cavekit — every kit requirement must be automatically verifiable
- [check-pr](../check-pr.md) — Checks a GitHub, GitLab, or Perforce (p4) pull request (or merge request, or shelved changelist) for unresolved review comments, failing status checks, and incomplete PR descriptions
- [code-review-and-quality](../code-review-and-quality.md) — Conducts multi-axis code review. Use before merging any change
- [code-simplification](../code-simplification.md) — Simplifies code for clarity. Use when refactoring code for clarity without changing behavior
- [context-engineering](../context-engineering.md) — Optimizes agent context setup. Use when starting a new session, when agent output quality degrades, when switching between tasks, or when you need to configure rules files and context...
- [debugging-and-error-recovery](../debugging-and-error-recovery.md) — Guides systematic root-cause debugging. Use when tests fail, builds break, behavior doesn't match expectations, or you encounter any unexpected error
- [deprecation-and-migration](../deprecation-and-migration.md) — Manages deprecation and migration. Use when removing old systems, APIs, or features
- [dispatching-parallel-agents](../dispatching-parallel-agents.md) — Use when facing 2+ independent tasks that can be worked on without shared state or sequential dependencies
- [docker](../docker.md) — Containerizing and shipping applications with Docker — writing efficient Dockerfiles (multi-stage builds, layer caching, small/secure images), docker compose for multi-service local...
- [documentation-and-adrs](../documentation-and-adrs.md) — Records decisions and documentation. Use when making architectural decisions, changing public APIs, shipping features, or when you need to record context that future engineers and...
- [doubt-driven-development](../doubt-driven-development.md) — Subjects every non-trivial decision to a fresh-context adversarial review before it stands
- [executing-plans](../executing-plans.md) — Use when you have a written implementation plan to execute in a separate session with review checkpoints
- [fastapi](../fastapi.md) — Building HTTP/JSON APIs in Python with FastAPI — path/query/body params, Pydantic v2 models, async endpoints, dependency injection, the lifespan startup/shutdown pattern, error...
- [finishing-a-development-branch](../finishing-a-development-branch.md) — Use when implementation is complete, all tests pass, and you need to decide how to integrate the work - guides completion of development work by presenting structured options for...
- [git-workflow-and-versioning](../git-workflow-and-versioning.md) — Structures git workflow practices. Use when making any code change
- [github-actions-ci](../github-actions-ci.md) — Authoring GitHub Actions CI/CD workflows — workflow/job/step structure, triggers, build-test matrices, dependency caching, secrets and least-privilege permissions, reusable workflows...
- [greploop](../greploop.md) — Iteratively improves a PR (GitHub), MR (GitLab), or shelved changelist (Perforce) until Greptile gives it a 5/5 confidence score with zero unresolved comments
- [gstack](../gstack.md) — Fast headless browser for QA testing and site dogfooding
- [gstack/autoplan](../gstack-autoplan.md) — Auto-review pipeline — reads the full CEO, design, eng, and DX review skills from disk and runs them sequentially with auto-decisions using 6 decision principles
- [gstack/benchmark](../gstack-benchmark.md) — Performance regression detection using the browse daemon
- [gstack/benchmark-models](../gstack-benchmark-models.md) — Cross-model benchmark for gstack skills
- [gstack/browse](../gstack-browse.md) — Fast headless browser for QA testing and site dogfooding
- [gstack/canary](../gstack-canary.md) — Post-deploy canary monitoring. (gstack)
- [gstack/careful](../gstack-careful.md) — Safety guardrails for destructive commands
- [gstack/codex](../gstack-codex.md) — OpenAI Codex CLI wrapper — three modes. (gstack)
- [gstack/connect-chrome](../gstack-connect-chrome.md) — Launch GStack Browser — AI-controlled Chromium with the sidebar extension baked in
- [gstack/context-restore](../gstack-context-restore.md) — Restore working context saved earlier by /context-save
- [gstack/context-save](../gstack-context-save.md) — Save working context. (gstack)
- [gstack/cso](../gstack-cso.md) — Chief Security Officer mode. (gstack)
- [gstack/design-consultation](../gstack-design-consultation.md) — Design consultation: understands your product, researches the landscape, proposes a complete design system (aesthetic, typography, color, layout, spacing, motion), and generates...
- [gstack/design-html](../gstack-design-html.md) — Design finalization: generates production-quality Pretext-native HTML/CSS
- [gstack/design-review](../gstack-design-review.md) — Designer's eye QA: finds visual inconsistency, spacing issues, hierarchy problems, AI slop patterns, and slow interactions — then fixes them
- [gstack/design-shotgun](../gstack-design-shotgun.md) — Design shotgun: generate multiple AI design variants, open a comparison board, collect structured feedback, and iterate
- [gstack/devex-review](../gstack-devex-review.md) — Live developer experience audit. (gstack)
- [gstack/diagram](../gstack-diagram.md) — Turn an English description (or mermaid source) into a diagram triplet: the source, an editable .excalidraw file you can open (gstack)
- [gstack/document-generate](../gstack-document-generate.md) — Generate missing documentation from scratch for a feature, module, or entire project
- [gstack/document-release](../gstack-document-release.md) — Post-ship documentation update. (gstack)
- [gstack/freeze](../gstack-freeze.md) — Restrict file edits to a specific directory for the session
- [gstack/gstack-upgrade](../gstack-gstack-upgrade.md) — Upgrade gstack to the latest version
- [gstack/guard](../gstack-guard.md) — Full safety mode: destructive command warnings + directory-scoped edits
- [gstack/health](../gstack-health.md) — Code quality dashboard. (gstack)
- [gstack/investigate](../gstack-investigate.md) — Systematic debugging with root cause investigation
- [gstack/ios-clean](../gstack-ios-clean.md) — Remove the DebugBridge SPM package and all #if DEBUG wiring from an iOS app
- [gstack/ios-design-review](../gstack-ios-design-review.md) — Visual design audit for iOS apps on real hardware
- [gstack/ios-fix](../gstack-ios-fix.md) — Autonomous iOS bug fixer. (gstack)
- [gstack/ios-qa](../gstack-ios-qa.md) — Live-device iOS QA for SwiftUI apps. (gstack)
- [gstack/ios-sync](../gstack-ios-sync.md) — Regenerate the iOS debug bridge against the latest upstream gstack templates
- [gstack/land-and-deploy](../gstack-land-and-deploy.md) — Land and deploy workflow. (gstack)
- [gstack/landing-report](../gstack-landing-report.md) — Read-only queue dashboard for workspace-aware ship
- [gstack/learn](../gstack-learn.md) — Manage project learnings
- [gstack/make-pdf](../gstack-make-pdf.md) — Turn any markdown file into a publication-quality PDF
- [gstack/office-hours](../gstack-office-hours.md) — YC Office Hours — two modes. (gstack)
- [gstack/open-gstack-browser](../gstack-open-gstack-browser.md) — Launch GStack Browser — AI-controlled Chromium with the sidebar extension baked in
- [gstack/pair-agent](../gstack-pair-agent.md) — Pair a remote AI agent with your browser
- [gstack/plan-ceo-review](../gstack-plan-ceo-review.md) — CEO/founder-mode plan review. (gstack)
- [gstack/plan-design-review](../gstack-plan-design-review.md) — Designer's eye plan review — interactive, like CEO and Eng review
- [gstack/plan-devex-review](../gstack-plan-devex-review.md) — Interactive developer experience plan review
- [gstack/plan-eng-review](../gstack-plan-eng-review.md) — Eng manager-mode plan review. (gstack)
- [gstack/plan-tune](../gstack-plan-tune.md) — Self-tuning question sensitivity + developer psychographic for gstack (v1: observational)
- [gstack/qa](../gstack-qa.md) — Systematically QA test a web application and fix bugs found
- [gstack/qa-only](../gstack-qa-only.md) — Report-only QA testing. (gstack)
- [gstack/retro](../gstack-retro.md) — Weekly engineering retrospective. (gstack)
- [gstack/review](../gstack-review.md) — Pre-landing PR review. (gstack)
- [gstack/scrape](../gstack-scrape.md) — Pull data from a web page. (gstack)
- [gstack/setup-browser-cookies](../gstack-setup-browser-cookies.md) — Import cookies from your real Chromium browser into the headless browse session
- [gstack/setup-deploy](../gstack-setup-deploy.md) — Configure deployment settings for /land-and-deploy
- [gstack/setup-gbrain](../gstack-setup-gbrain.md) — Set up gbrain for this coding agent: install the CLI, initialize a local PGLite or Supabase brain, register MCP, capture per-remote trust policy
- [gstack/ship](../gstack-ship.md) — Ship workflow: detect + merge base branch, run tests, review diff, bump VERSION, update CHANGELOG, commit, push, create PR
- [gstack/skillify](../gstack-skillify.md) — Codify the most recent successful /scrape flow into a permanent browser-skill on disk
- [gstack/spec](../gstack-spec.md) — Turn vague intent into a precise, executable spec in five phases
- [gstack/sync-gbrain](../gstack-sync-gbrain.md) — Keep gbrain current with this repo's code and refresh agent search guidance in CLAUDE.md
- [gstack/unfreeze](../gstack-unfreeze.md) — Clear the freeze boundary set by /freeze, allowing edits to all directories again
- [incremental-implementation](../incremental-implementation.md) — Delivers changes incrementally. Use when implementing any feature or change that touches more than one file
- [jest](../jest.md) — JavaScript testing with Jest — unit tests, mocks, spies, snapshot testing, code coverage, and configuration
- [linear](../linear.md) — Linear project management — create and manage issues, projects, cycles, and roadmaps via the Linear API, MCP server, or web browser
- [opensrc](../opensrc.md) — Give coding agents the actual source code of any dependency
- [planning-and-task-breakdown](../planning-and-task-breakdown.md) — Breaks work into ordered tasks. Use when you have a spec or clear requirements and need to break work into implementable tasks
- [pytest](../pytest.md) — Testing Python code with pytest — fixtures, parametrization, markers, mocking, coverage, and configuration
- [receiving-code-review](../receiving-code-review.md) — Use when receiving code review feedback, before implementing suggestions, especially if feedback seems unclear or technically questionable - requires technical rigor and verification...
- [requesting-code-review](../requesting-code-review.md) — Use when completing tasks, implementing major features, or before merging to verify work meets requirements
- [source-driven-development](../source-driven-development.md) — Grounds every implementation decision in official documentation
- [spec-driven-development](../spec-driven-development.md) — Creates specs before coding. Use when starting a new project, feature, or significant change and no specification exists yet
- [subagent-driven-development](../subagent-driven-development.md) — Use when executing implementation plans with independent tasks in the current session
- [systematic-debugging](../systematic-debugging.md) — Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes
- [test-driven-development](../test-driven-development.md) — Use when implementing any feature or bugfix, before writing implementation code
- [using-agent-skills](../using-agent-skills.md) — Discovers and invokes agent skills. Use when starting a session or when you need to discover which skill applies to the current task
- [using-git-worktrees](../using-git-worktrees.md) — Use when starting feature work that needs isolation from current workspace or before executing implementation plans - ensures an isolated workspace exists via native tools or git...
- [using-superpowers](../using-superpowers.md) — Use when starting any conversation - establishes how to find and use skills, requiring Skill tool invocation before ANY response including clarifying questions
- [verification-before-completion](../verification-before-completion.md) — Use when about to claim work is complete, fixed, or passing, before committing or creating PRs - requires running verification commands and confirming output before making any success...
- [vitest](../vitest.md) — JavaScript/TypeScript unit testing with Vitest — fast Vite-native test runner with Jest-compatible API
- [writing-plans](../writing-plans.md) — Use when you have a spec or requirements for a multi-step task, before touching code
- [writing-skills](../writing-skills.md) — Use when creating new skills, editing existing skills, or verifying skills work before deployment
