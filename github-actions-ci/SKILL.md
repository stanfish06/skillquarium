---
name: github-actions-ci
description: Authoring GitHub Actions CI/CD workflows — workflow/job/step structure, triggers, build-test matrices, dependency caching, secrets and least-privilege permissions, reusable workflows, and common Python/Node CI recipes. Use when creating or fixing .github/workflows/*.yml, setting up CI for tests/lint/build, adding a release or deploy pipeline, or speeding up/securing existing workflows. To audit agentic (AI-in-CI) workflows for injection, see agentic-actions-auditor.
---

# GitHub Actions — CI/CD workflows

## Overview

GitHub Actions runs automation on repo events (push, PR, schedule). A **workflow**
(`.github/workflows/*.yml`) contains **jobs** (run in parallel on fresh runners) made of
**steps**. This skill authors workflows; to *audit* AI-agent-in-CI workflows for prompt
injection see [[agentic-actions-auditor]], and for `gh` CLI usage see [[gh-cli]].

> Action versions below are current as of mid-2026 (`@v6` for the core setup actions, which
> run on Node 24). Always check the action's releases page and pin a major (or a SHA for
> security-sensitive third-party actions).

## Anatomy — a Python test workflow

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read          # least privilege at the top; widen per-job only as needed

concurrency:              # cancel superseded runs on the same ref
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        python-version: ["3.11", "3.12", "3.13"]
    steps:
      - uses: actions/checkout@v6
      - uses: astral-sh/setup-uv@v6          # or actions/setup-python@v6
        with:
          python-version: ${{ matrix.python-version }}
      - run: uv sync --frozen
      - run: uv run ruff check .
      - run: uv run pytest --cov
```

Key pieces: `on` (triggers), `permissions` (lock down the `GITHUB_TOKEN`), `concurrency`
(kill stale runs), `strategy.matrix` (fan out across versions/OSes).

## Caching for speed

`setup-*` actions cache dependencies for you:

```yaml
- uses: actions/setup-node@v6
  with:
    node-version: 22
    cache: npm            # caches ~/.npm keyed on package-lock.json
- run: npm ci             # ci (not install) for reproducible, lockfile-exact installs
```

For anything else, `actions/cache@v4` with a content-hashed key:

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.cache/pip
    key: pip-${{ hashFiles('**/requirements*.txt') }}
    restore-keys: pip-
```

A good cache key changes only when inputs change; `restore-keys` provides partial-hit
fallbacks.

## Secrets, contexts & expressions

```yaml
    steps:
      - run: ./deploy.sh
        env:
          TOKEN: ${{ secrets.DEPLOY_TOKEN }}     # never echo secrets
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
```

Store secrets in repo/environment settings; reference via `${{ secrets.* }}`. Use
`${{ github.* }}` context for event data, and `if:` for conditional steps/jobs. Job outputs
(`needs.<job>.outputs.*`) pass data between jobs declared with `needs:`.

## Reusable & manual workflows

```yaml
on:
  workflow_dispatch:                 # manual "Run workflow" button (+ optional inputs)
  workflow_call:                     # callable from other workflows
    inputs:
      environment: { type: string, required: true }
```

Factor shared CI into a `workflow_call` file and invoke it with `uses:
owner/repo/.github/workflows/shared.yml@main` to avoid copy-paste across repos.

## Security checklist

- **Least privilege:** set top-level `permissions: contents: read`; grant more only where
  needed (e.g. `pull-requests: write` on a commenting job).
- **Pin third-party actions to a full commit SHA**, not a mutable tag, and review them.
- **Never** use `pull_request_target` with checkout of untrusted PR code + secrets — the
  classic exfiltration footgun.
- **Don't interpolate untrusted input** (`${{ github.event.issue.title }}`) directly into
  `run:` shell — pass via `env:` and quote. See [[agentic-actions-auditor]] for the
  AI-agent variant of this.
- Add a least-privilege default and `concurrency` to every workflow.

## Gotchas

- **YAML `on` quoting:** some linters fold `on:` to boolean `true`; if triggers act weird,
  quote keys or verify indentation.
- **Matrix explosion:** each combination is a billable job — use `include`/`exclude` to trim.
- **`npm install` vs `npm ci`:** use `ci` in CI for lockfile-exact, reproducible builds.
- **Default branch only:** scheduled (`on: schedule`) workflows run from the default branch.
- **Debugging:** re-run with debug logging (`ACTIONS_STEP_DEBUG=true` secret) or add a
  `tmate` step; check `actions/runner` annotations on the run summary.

## Related

Audit AI-in-CI workflows with [[agentic-actions-auditor]]; `gh` CLI in [[gh-cli]]; build
images in CI with [[docker]]; run [[pytest]] suites; Python tooling in [[modern-python]].
