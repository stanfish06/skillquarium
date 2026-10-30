---
name: migration-to-pnpm
description: Migrating from npm or Yarn to pnpm with minimal friction
---

# Migration to pnpm

Guide for migrating existing projects from npm or Yarn to pnpm, plus upgrading pnpm v10 → v11 and v11 → v12.

## Upgrading pnpm v11 → v12

pnpm 12 is a **Rust rewrite** and is stable. It keeps v11's commands, flags, settings, and lockfile format — upgrading is not a migration. Only these differ (six change a result, one fails outright):

- **`pnpm install --resolution-only` is removed** and errors. Use `pnpm peers check` (reads issues from the lockfile). Grep CI scripts for it before switching.
- **Git dependency resolution:** GitHub/GitLab/Bitbucket specifiers resolve via the host's HTTPS URL and pnpm never records an SSH URL — one lockfile works with or without SSH keys. Run `pnpm update <pkg>` once to re-resolve an old `git@…` entry. For private SSH, use `git config --global url."git@github.com:".insteadOf https://github.com/`.
- **Naming a package manager** installs the tool, not the npm package: `pnpm add -g yarn` installs Yarn (not the Classic `yarn` package), `pnx node@22` runs that Node.js release. A specifier like `yarn@npm:yarn@1.22.22` still installs the package.
- **Project-aware global bins:** a global `node`/`deno`/`bun` runs the version the current project pins.
- **`packageImportMethod: auto` hardlinks first on Linux** (was clone-first). Use `clone`/`clone-or-copy` if you edit files in `node_modules`.
- **Cyclic dependency graphs** produce deterministic lockfiles; the first re-resolving install rewrites cyclic peer variants (one-time diff).
- **`engineStrict`** now fails when a package depends through regular `dependencies` on an incompatible engine even under an `optionalDependencies` subtree.

> pnpm 12 is the current release line, and npm's `latest` tag points to it. Pin the exact version used to generate your project's lockfile.

## Upgrading pnpm v10 → v11

v11 changes how configuration is read. Most of it is mechanical — run the codemod:

```bash
cd /path/to/project
pnpx codemod run pnpm-v10-to-v11
```

The codemod automatically:

- **Moves `package.json#pnpm` settings into `pnpm-workspace.yaml`** (the `pnpm` field is no longer read).
- **Splits `.npmrc`**: pnpm/install settings move to `pnpm-workspace.yaml` as **camelCase** (e.g. `node-linker` → `nodeLinker`). Registry/authentication and certificate settings remain supported in INI files; check legacy network settings before migrating. Per-subproject pnpm settings become `packageConfigs["<name>"]`.
- **Consolidates build settings** (`onlyBuiltDependencies`, `neverBuiltDependencies`, `ignoredBuiltDependencies`, `onlyBuiltDependenciesFile`) into one `allowBuilds: { name: true|false }` map.
- **Replaces** `managePackageManagerVersions`/`packageManagerStrict`/`packageManagerStrictVersion` with `pmOnFail: download|ignore|warn|error`.
- **Renames** `allowNonAppliedPatches` → `allowUnusedPatches`, `auditConfig.ignoreCves` → `auditConfig.ignoreGhsas`.
- **Converts** `useNodeVersion` → `devEngines.runtime`, and bumps `packageManager`.

Manual follow-ups (not automatable):

- Convert `CVE-…` IDs to `GHSA-…` in `auditConfig.ignoreGhsas`.
- `ignorePatchFailures` removed — failed patches now always throw.
- `npm_config_*` env vars → `pnpm_config_*` (CI, shell profiles, Docker).
- `pnpm link <name>` → use a path (`pnpm link ./foo`); `pnpm link --global` → `pnpm add -g .`.
- `pnpm install -g` (no args) and `pnpm server` removed.
- A `package.json` script named `clean`/`setup`/`deploy`/`rebuild` now shadows the built-in — use `pnpm pm <name>` for the built-in.

## Migrating from npm / Yarn

## Quick Migration

### From npm

```bash
# Remove npm lockfile and node_modules
rm -rf node_modules package-lock.json

# Install with pnpm
pnpm install
```

### From Yarn

```bash
# Remove yarn lockfile and node_modules
rm -rf node_modules yarn.lock

# Install with pnpm
pnpm install
```

### Import Existing Lockfile

pnpm can import existing lockfiles:

```bash
# Import from npm or yarn lockfile
pnpm import

# This creates pnpm-lock.yaml from:
# - package-lock.json (npm)
# - yarn.lock (yarn)
# - npm-shrinkwrap.json (npm)
```

## Handling Common Issues

### Phantom Dependencies

pnpm is strict about dependencies. If code imports a package not in `package.json`, it will fail.

**Problem:**
```js
// Works with npm (hoisted), fails with pnpm
import lodash from 'lodash' // Not in dependencies, installed by another package
```

**Solution:** Add missing dependencies explicitly:
```bash
pnpm add lodash
```

### Missing Peer Dependencies

pnpm reports peer dependency issues by default.

**Option 1:** Let pnpm auto-install (default in v8+):
```yaml title="pnpm-workspace.yaml"
autoInstallPeers: true
```

**Option 2:** Install manually:
```bash
pnpm add react react-dom
```

**Option 3:** Suppress warnings if acceptable:
```yaml title="pnpm-workspace.yaml"
peerDependencyRules:
  ignoreMissing:
    - react
```

### Symlink Issues

Some tools don't work with symlinks. Use hoisted mode:

```yaml title="pnpm-workspace.yaml"
nodeLinker: hoisted
```

Or hoist specific packages:

```yaml title="pnpm-workspace.yaml"
publicHoistPattern:
  - '*eslint*'
  - '*babel*'
```

### Native Module Rebuilds

If native modules fail, try:

```bash
# Rebuild all native modules
pnpm rebuild

# Or reinstall
rm -rf node_modules
pnpm install
```

## Monorepo Migration

### From npm Workspaces

1. Create `pnpm-workspace.yaml`:
   ```yaml
   packages:
     - 'packages/*'
   ```

2. Update internal dependencies to use workspace protocol:
   ```json
   {
     "dependencies": {
       "@myorg/utils": "workspace:^"
     }
   }
   ```

3. Install:
   ```bash
   rm -rf node_modules packages/*/node_modules package-lock.json
   pnpm install
   ```

### From Yarn Workspaces

1. Remove Yarn-specific files:
   ```bash
   rm yarn.lock .yarnrc.yml
   rm -rf .yarn
   ```

2. Create `pnpm-workspace.yaml` matching `workspaces` in package.json:
   ```yaml
   packages:
     - 'packages/*'
   ```

3. Update `package.json` - remove Yarn workspace config if not needed:
   ```json
   {
     // Remove "workspaces" field (optional, pnpm uses pnpm-workspace.yaml)
   }
   ```

4. Convert workspace references:
   ```json
   // From Yarn
   "@myorg/utils": "*"
   
   // To pnpm
   "@myorg/utils": "workspace:*"
   ```

### From Lerna

pnpm can replace Lerna for most use cases:

```bash
# Lerna: run script in all packages
lerna run build

# pnpm equivalent
pnpm -r run build

# Lerna: run in specific package
lerna run build --scope=@myorg/app

# pnpm equivalent  
pnpm --filter @myorg/app run build

# Lerna: publish
lerna publish

# pnpm: use changesets instead
pnpm add -Dw @changesets/cli
pnpm changeset
pnpm changeset version
pnpm publish -r
```

## Configuration Migration

Put pnpm/install settings in `pnpm-workspace.yaml` (camelCase). Registry/authentication and certificate settings remain supported in INI files. Static non-secret registry URLs may stay in a project `.npmrc`; environment-variable credentials must use a user-level auth file or `pnpm_config__auth`. Keep secret values out of git.

```ini title="~/.npmrc (user-level auth)"
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
//npm.myorg.com/:_authToken=${MYORG_TOKEN}
```

```yaml title="pnpm-workspace.yaml"
registries:
  default: https://registry.npmjs.org/
  '@myorg': https://npm.myorg.com/
autoInstallPeers: true
strictPeerDependencies: false
```

### Scripts Migration

Most scripts work unchanged. Update pnpm-specific patterns:

Before (npm):

```json
{
  "scripts": {
    "build:all": "npm run build --workspaces",
    "dev:app": "npm run dev -w packages/app"
  }
}
```

After (pnpm):

```json
{
  "scripts": {
    "build:all": "pnpm -r run build",
    "dev:app": "pnpm --filter @myorg/app run dev"
  }
}
```

## CI/CD Migration

Update CI configuration:

```yaml
# Before (npm)
- run: npm ci

# After (pnpm)
- uses: pnpm/action-setup@v4
- run: pnpm install --frozen-lockfile   # or: pnpm ci
```

Pin the exact pnpm version used to generate the lockfile in `package.json` (12.11.2 is an example):

```json
{
  "packageManager": "pnpm@12.11.2"
}
```

## Gradual Migration

For large projects, migrate gradually:

1. **Start with CI**: Use pnpm in CI, keep npm/yarn locally
2. **Add pnpm-lock.yaml**: Run `pnpm import` to create lockfile
3. **Test thoroughly**: Ensure builds work with pnpm
4. **Update documentation**: Update README, CONTRIBUTING
5. **Remove old files**: Delete old lockfiles after team adoption

## Rollback Plan

If migration causes issues:

```bash
# Remove pnpm files
rm -rf node_modules pnpm-lock.yaml pnpm-workspace.yaml

# Restore npm
npm install

# Or restore Yarn
yarn install
```

Keep old lockfile in git history for easy rollback.

<!--
Source references:
- https://pnpm.io/migration
- https://pnpm.io/cli/import
- https://pnpm.io/configuring
-->

