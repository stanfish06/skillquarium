---
name: pnpm-ci-cd-setup
description: Optimizing pnpm for continuous integration and deployment workflows
---

# pnpm CI/CD Setup

Best practices for using pnpm in CI/CD environments for fast, reliable builds.

> **CI auto-behaviors:** When pnpm detects a CI environment it switches to **frozen-lockfile** mode automatically and (since v11) **fails on an incompatible lockfile** written by a newer pnpm major instead of rewriting it — keep the CI pnpm version in sync with the one that generated the lockfile. The global virtual store is auto-disabled in CI (no warm cache).

## Pin the project version

The examples below require a committed `packageManager` field matching the pnpm version that generated `pnpm-lock.yaml`. For example:

```json
{ "packageManager": "pnpm@12.11.2" }
```

Use your project's tested exact version. GitHub Actions reads this pin, and GitLab prepares that same version instead of resolving `latest`.

## Installing pnpm in CI

Outside GitHub Actions (which has its own action), the docs now recommend the **standalone install script** over Corepack:

```sh
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

- **No Node.js needed** — pnpm is self-contained and can install a runtime afterwards (`pnpm runtime set node lts -g`).
- **Follows the project's version** — after bootstrap, pnpm switches to the `packageManager`/`devEngines.packageManager` pin on first use, so you don't pin twice.
- The script sets `PNPM_HOME` and edits a shell profile CI never reloads — export `PNPM_HOME` and put `$PNPM_HOME/bin` on `PATH` yourself.

> Corepack installs a JS shim, so every `pnpm` call starts Node.js to run the shim first — a cost paid on each of CI's many invocations. Installing pnpm itself avoids it.

### Cache the metadata cache too

Since v11.22.0, `pnpm cache path` prints pnpm's metadata cache directory. Caching it (alongside the store) also caches the lockfile verification log, letting a job skip re-checking an unchanged lockfile against supply-chain policies — the dominant install cost once the store is warm.

## GitHub Actions

### Basic Setup

```yaml
name: CI

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile   # or: pnpm ci
      - run: pnpm test
      - run: pnpm build
```

> `pnpm ci` (aliases `clean-install`, `install-clean`) = `pnpm clean` + `pnpm install --frozen-lockfile`, ideal for fully reproducible CI builds.

### With Store Caching

For larger projects, cache the pnpm store:

```yaml
- uses: pnpm/action-setup@v4

- name: Get pnpm store directory
  shell: bash
  run: |
    echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_ENV

- uses: actions/cache@v4
  name: Setup pnpm cache
  with:
    path: ${{ env.STORE_PATH }}
    key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
    restore-keys: |
      ${{ runner.os }}-pnpm-store-

- run: pnpm install --frozen-lockfile
```

> **Trust:** only cache/restore the pnpm store and cache dir between *trusted* jobs. A store an untrusted job can write to must not be reused by trusted jobs — it is part of pnpm's trust domain.

### Matrix Testing

```yaml
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
```

## GitLab CI

```yaml
image: node:24

stages:
  - install
  - test
  - build

variables:
  PNPM_HOME: /root/.local/share/pnpm
  PATH: $PNPM_HOME/bin:$PATH

before_script:
  - corepack enable
  - corepack prepare "$(node -p 'require("./package.json").packageManager')" --activate

cache:
  key: ${CI_COMMIT_REF_SLUG}
  paths:
    - .pnpm-store

install:
  stage: install
  script:
    - pnpm install --frozen-lockfile --store-dir .pnpm-store

test:
  stage: test
  script:
    - pnpm install --frozen-lockfile --store-dir .pnpm-store
    - pnpm test

build:
  stage: build
  script:
    - pnpm install --frozen-lockfile --store-dir .pnpm-store
    - pnpm build
```

## Docker

> **PATH change (v11):** global pnpm binaries now live in `$PNPM_HOME/bin`. In Docker set `ENV PATH="$PNPM_HOME/bin:$PATH"` (not `$PNPM_HOME`). There is also an official image `ghcr.io/pnpm/pnpm:<version>` (Debian slim, pnpm only — choose Node yourself via `pnpm runtime set node <ver> -g` or `devEngines.runtime`).

### Multi-Stage Build

This example assumes a root app at `dist/index.js` plus workspace packages `core` and `api`, each building its runtime files into `dist/`. Include every workspace manifest and runtime asset your app needs; the explicit copies preserve package paths. Exclude `node_modules` from the build context with `.dockerignore`.

```dockerfile
# Build stage
FROM node:24-slim AS builder

# Enable corepack for pnpm
RUN corepack enable

WORKDIR /app

# Copy package files first for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json ./packages/core/
COPY packages/api/package.json ./packages/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm build

# Production stage
FROM node:24-slim AS runner

RUN corepack enable
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/api/package.json ./packages/api/
COPY --from=builder /app/packages/api/dist ./packages/api/dist

# Production install
RUN pnpm install --frozen-lockfile --prod

CMD ["node", "dist/index.js"]
```

### Optimized for Monorepos

```dockerfile
FROM node:24-slim AS builder
RUN corepack enable
WORKDIR /app

# Copy root and workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy all package.json files maintaining structure
COPY packages/core/package.json ./packages/core/
COPY packages/api/package.json ./packages/api/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build specific package
RUN pnpm --filter @myorg/api build
```

## Key CI Flags

### --frozen-lockfile

**Always use in CI.** Fails if `pnpm-lock.yaml` needs updates:

```bash
pnpm install --frozen-lockfile
```

### --prefer-offline

Use cached packages when available:

```bash
pnpm install --frozen-lockfile --prefer-offline
```

### --ignore-scripts

Skip lifecycle scripts for faster installs (use cautiously):

```bash
pnpm install --frozen-lockfile --ignore-scripts
```

## Pinning the pnpm version

Pin with `packageManager` (exact) or `devEngines.packageManager` (range, resolved version stored in the lockfile):

```json
{ "packageManager": "pnpm@12.11.2" }
```

The standalone install script and `pnpm/action-setup` both honor this pin. To skip the pin check when version management is external (asdf/mise/Volta), set `pmOnFail: ignore` in `pnpm-workspace.yaml`, or run a one-off with `pnpm with current <cmd>`.

> Corepack still works but is no longer the recommended CI path (it adds a Node.js shim to every `pnpm` call). Prefer the standalone script above.

## Monorepo CI Strategies

### Build Changed Packages Only

```yaml
- name: Build changed packages
  run: |
    pnpm --filter "...[origin/main]" build
```

### Parallel Jobs per Package

```yaml
jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      packages: ${{ steps.changes.outputs.packages }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - id: changes
        run: |
          echo "packages=$(pnpm --filter '...[origin/main]' list --json | jq -c '[.[].name]')" >> $GITHUB_OUTPUT

  test:
    needs: detect-changes
    if: needs.detect-changes.outputs.packages != '[]'
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package: ${{ fromJson(needs.detect-changes.outputs.packages) }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter ${{ matrix.package }} test
```

## Best Practices Summary

1. **Use `pnpm ci` or `--frozen-lockfile`** in CI
2. **Install via the standalone script** (`get.pnpm.io/install.sh`) rather than Corepack
3. **Cache the pnpm store and metadata cache** (`pnpm cache path`), only across trusted jobs
4. **Match the CI pnpm major** to the one that wrote the lockfile (CI fails on incompatible lockfiles)
5. **Pin `packageManager`** (or `devEngines.packageManager`) in package.json
6. **Use `--filter`** in monorepos to build only what changed
7. **Multi-stage Docker builds**; set `PATH=$PNPM_HOME/bin:$PATH`

<!--
Source references:
- https://pnpm.io/continuous-integration
- https://pnpm.io/docker
- https://pnpm.io/cli/ci
- https://pnpm.io/cli/cache-path
- https://github.com/pnpm/action-setup
-->

