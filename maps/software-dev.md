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

**Related maps:** [Vault, Skills & Workflow Meta](vault-meta.md) | [Security & Auditing](security-auditing.md) | [Cloud, Infra & MLOps](cloud-devops.md) | [Reasoning, Ideation & Decision](reasoning-ideation.md) | [.NET & C# Development](dotnet-development.md)

## Skills (65)

- [api-and-interface-design](../api-and-interface-design.md) — Guides stable API and interface design. Use when designing APIs, module boundaries, or any public interface
- [brainstorming](../brainstorming.md) — You MUST use this before any creative work - creating features, building components, adding functionality, or modifying behavior
- [cavekit-design-system](../cavekit-design-system.md) — How to write and maintain DESIGN.md as the visual specification layer for Cavekit projects
- [cavekit-methodology](../cavekit-methodology.md) — Cavekit specification-driven development methodology — the Hunt lifecycle (Draft → Architect → Build → Inspect → Monitor) and how to apply it
- [cavekit-revision](../cavekit-revision.md) — Trace bugs and manual fixes back to kits and prompts
- [cavekit-validation-first](../cavekit-validation-first.md) — Validation-first design for Cavekit — every kit requirement must be automatically verifiable
- [check-pr](../check-pr.md) — Checks a GitHub, GitLab, or Perforce (p4) pull request (or merge request, or shelved changelist) for unresolved review comments, failing status checks, and incomplete PR descriptions
- [code-review-and-quality](../code-review-and-quality.md) — Conducts multi-axis code review. Use before merging any change
- [code-simplification](../code-simplification.md) — Simplifies code for clarity. Use when refactoring code for clarity without changing behavior
- [codebase-design](../codebase-design.md) — Shared vocabulary for designing deep modules
- [context-engineering](../context-engineering.md) — Optimizes agent context setup. Use when starting a new session, when agent output quality degrades, when switching between tasks, or when you need to configure rules files and context...
- [debugging-and-error-recovery](../debugging-and-error-recovery.md) — Guides systematic root-cause debugging. Use when tests fail, builds break, behavior doesn't match expectations, or you encounter any unexpected error
- [deprecation-and-migration](../deprecation-and-migration.md) — Manages deprecation and migration. Use when removing old systems, APIs, or features
- [diagnosing-bugs](../diagnosing-bugs.md) — Diagnosis loop for hard bugs and performance regressions
- [dispatching-parallel-agents](../dispatching-parallel-agents.md) — Use when facing 2+ independent tasks that can be worked on without shared state or sequential dependencies
- [docker](../docker.md) — Containerizing and shipping applications with Docker — writing efficient Dockerfiles (multi-stage builds, layer caching, small/secure images), docker compose for multi-service local...
- [documentation-and-adrs](../documentation-and-adrs.md) — Records decisions and documentation. Use when making architectural decisions, changing public APIs, shipping features, or when you need to record context that future engineers and...
- [domain-modeling](../domain-modeling.md) — Build and sharpen a project's domain model
- [doubt-driven-development](../doubt-driven-development.md) — Subjects every non-trivial decision to a fresh-context adversarial review before it stands
- [executing-plans](../executing-plans.md) — Use when you have a written implementation plan to execute in a separate session with review checkpoints
- [fastapi](../fastapi.md) — Building HTTP/JSON APIs in Python with FastAPI — path/query/body params, Pydantic v2 models, async endpoints, dependency injection, the lifespan startup/shutdown pattern, error...
- [finishing-a-development-branch](../finishing-a-development-branch.md) — Use when implementation is complete, all tests pass, and you need to decide how to integrate the work - guides completion of development work by presenting structured options for...
- [git-guardrails-claude-code](../git-guardrails-claude-code.md) — Set up Claude Code hooks to block dangerous git commands (push, reset --hard, clean, branch -D, etc.) before they execute
- [git-workflow-and-versioning](../git-workflow-and-versioning.md) — Structures git workflow practices. Use when making any code change
- [github-actions-ci](../github-actions-ci.md) — Authoring GitHub Actions CI/CD workflows — workflow/job/step structure, triggers, build-test matrices, dependency caching, secrets and least-privilege permissions, reusable workflows...
- [greploop](../greploop.md) — Iteratively improves a PR (GitHub), MR (GitLab), or shelved changelist (Perforce) until Greptile gives it a 5/5 confidence score with zero unresolved comments
- [gstack](../gstack.md) — Fast headless browser for QA testing and site dogfooding
- [handoff](../handoff.md) — Compact the current conversation into a handoff document for another agent to pick up
- [implement](../implement.md) — Implement a piece of work based on a PRD or set of issues
- [improve-codebase-architecture](../improve-codebase-architecture.md) — Scan a codebase for deepening opportunities, present them as a visual HTML report, then grill through whichever one you pick
- [incremental-implementation](../incremental-implementation.md) — Delivers changes incrementally. Use when implementing any feature or change that touches more than one file
- [jest](../jest.md) — JavaScript testing with Jest — unit tests, mocks, spies, snapshot testing, code coverage, and configuration
- [linear](../linear.md) — Linear project management — create and manage issues, projects, cycles, and roadmaps via the Linear API, MCP server, or web browser
- [migrate-to-shoehorn](../migrate-to-shoehorn.md) — Migrate test files from `as` type assertions to @total-typescript/shoehorn
- [modern-typescript](../modern-typescript.md) — Modern TypeScript 5.x idioms — strict tsconfig (strict, noUncheckedIndexedAccess), the type system (unions/intersections, generics + constraints, narrowing, discriminated unions...
- [opensrc](../opensrc.md) — Give coding agents the actual source code of any dependency
- [planning-and-task-breakdown](../planning-and-task-breakdown.md) — Breaks work into ordered tasks. Use when you have a spec or clear requirements and need to break work into implementable tasks
- [prototype](../prototype.md) — Build a throwaway prototype to flesh out a design — a runnable terminal app for state/business-logic questions, or several radically different UI variations toggleable from one route
- [pytest](../pytest.md) — Testing Python code with pytest — fixtures, parametrization, markers, mocking, coverage, and configuration
- [qa](../qa.md) — Interactive QA session where user reports bugs or issues conversationally, and the agent files GitHub issues
- [receiving-code-review](../receiving-code-review.md) — Use when receiving code review feedback, before implementing suggestions, especially if feedback seems unclear or technically questionable - requires technical rigor and verification...
- [request-refactor-plan](../request-refactor-plan.md) — Create a detailed refactor plan with tiny commits via user interview, then file it as a GitHub issue
- [requesting-code-review](../requesting-code-review.md) — Use when completing tasks, implementing major features, or before merging to verify work meets requirements
- [resolving-merge-conflicts](../resolving-merge-conflicts.md) — Use when you need to resolve an in-progress git merge/rebase conflict
- [review](../review.md) — Review the changes since a fixed point (commit, branch, tag, or merge-base) along two axes — Standards (does the code follow this repo's documented coding standards?) and Spec (does...
- [scaffold-exercises](../scaffold-exercises.md) — Create exercise directory structures with sections, problems, solutions, and explainers that pass linting
- [setup-pre-commit](../setup-pre-commit.md) — Set up Husky pre-commit hooks with lint-staged (Prettier), type checking, and tests in the current repo
- [source-driven-development](../source-driven-development.md) — Grounds every implementation decision in official documentation
- [spec-driven-development](../spec-driven-development.md) — Creates specs before coding. Use when starting a new project, feature, or significant change and no specification exists yet
- [subagent-driven-development](../subagent-driven-development.md) — Use when executing implementation plans with independent tasks in the current session
- [systematic-debugging](../systematic-debugging.md) — Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes
- [tdd](../tdd.md) — Test-driven development. Use when the user wants to build features or fix bugs test-first, mentions "red-green-refactor", or wants integration tests
- [teach](../teach.md) — Teach the user a new skill or concept, within this workspace
- [test-driven-development](../test-driven-development.md) — Use when implementing any feature or bugfix, before writing implementation code
- [to-issues](../to-issues.md) — Break a plan, spec, or PRD into independently-grabbable issues on the project issue tracker using tracer-bullet vertical slices
- [to-prd](../to-prd.md) — Turn the current conversation into a PRD and publish it to the project issue tracker — no interview, just synthesis of what you've already discussed
- [triage](../triage.md) — Move issues and external PRs through a state machine of triage roles — categorise, verify, grill if needed, and write agent-ready briefs
- [ubiquitous-language](../ubiquitous-language.md) — Extract a DDD-style ubiquitous language glossary from the current conversation, flagging ambiguities and proposing canonical terms
- [using-agent-skills](../using-agent-skills.md) — Discovers and invokes agent skills. Use when starting a session or when you need to discover which skill applies to the current task
- [using-git-worktrees](../using-git-worktrees.md) — Use when starting feature work that needs isolation from current workspace or before executing implementation plans - ensures an isolated workspace exists via native tools or git...
- [using-superpowers](../using-superpowers.md) — Use when starting any conversation - establishes how to find and use skills, requiring Skill tool invocation before ANY response including clarifying questions
- [verification-before-completion](../verification-before-completion.md) — Use when about to claim work is complete, fixed, or passing, before committing or creating PRs - requires running verification commands and confirming output before making any success...
- [vitest](../vitest.md) — JavaScript/TypeScript unit testing with Vitest — fast Vite-native test runner with Jest-compatible API
- [writing-plans](../writing-plans.md) — Use when you have a spec or requirements for a multi-step task, before touching code
- [writing-skills](../writing-skills.md) — Use when creating new skills, editing existing skills, or verifying skills work before deployment
