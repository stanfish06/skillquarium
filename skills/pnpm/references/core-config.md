---
name: pnpm-configuration
description: Configuring pnpm via pnpm-workspace.yaml, global config.yaml, and npm-compatible registry, auth, and certificate settings
---

# pnpm Configuration

pnpm settings are split into **two** categories. Knowing where each goes is the single most important config concept in current pnpm:

| Category | Stored in | Format |
|----------|-----------|--------|
| **All pnpm/install settings** (`nodeLinker`, `hoistPattern`, `autoInstallPeers`, `overrides`, `catalog`, …) | `pnpm-workspace.yaml` (project) and `config.yaml` (global) | YAML, **camelCase** keys |
| **Registry credentials and TLS** (`_authToken`, `cert`, `key`, …) | Project `.npmrc` for literal settings; user-level `auth.ini`/`~/.npmrc` for interpolated auth; global `config.yaml` for `_auth` | INI or structured YAML |

> **Important changes:** pnpm no longer reads settings from the `pnpm` field of `package.json`. Put pnpm/install settings in `pnpm-workspace.yaml`; `.npmrc` still supports registry/authentication and certificate settings, plus legacy network settings for compatibility. Keys in YAML are **camelCase** (e.g. `nodeLinker`), not the kebab-case used by old `.npmrc` files.

> The upstream settings reference is now split into pages by area — `settings/build`, `settings/cli`, `settings/dependency-resolution`, `settings/network`, `settings/node-modules`, `settings/store`, `settings/peer-dependencies`, `settings/versioning`, `settings/other` — but they are all the same camelCase keys in `pnpm-workspace.yaml`.

## pnpm-workspace.yaml (primary config)

Place at the workspace/project root. Even a single-package project uses this file for pnpm settings.

```yaml title="pnpm-workspace.yaml"
# Workspace packages (omit for a single-package repo)
packages:
  - 'packages/*'
  - 'apps/*'
  - '!**/test/**'

# Common install settings (camelCase)
nodeLinker: isolated          # isolated (default) | hoisted | pnp
autoInstallPeers: true
strictPeerDependencies: false
savePrefix: '^'
saveExact: false
hoistPattern:
  - '*eslint*'
  - '*babel*'
publicHoistPattern: []
shamefullyHoist: false
dedupeDirectDeps: false
resolutionMode: highest       # highest | time-based | lowest-direct

# Centralized version management
catalog:
  react: ^18.2.0

# Force dependency versions (root only)
overrides:
  lodash: ^4.17.21
  'foo@^1.0.0>bar': ^2.0.0

# Extend/patch broken package manifests
packageExtensions:
  react-redux:
    peerDependencies:
      react-dom: '*'

# Peer dependency rules
peerDependencyRules:
  ignoreMissing:
    - '@babel/*'
  allowedVersions:
    react: '17 || 18'
```

## Global configuration (config.yaml)

User-level non-auth settings live in a global YAML `config.yaml`:

- `$XDG_CONFIG_HOME/pnpm/config.yaml` (if set)
- Linux: `~/.config/pnpm/config.yaml`
- macOS: `~/Library/Preferences/pnpm/config.yaml`
- Windows: `~/AppData/Local/pnpm/config/config.yaml`

The companion `auth.ini` in the same directory holds user-level INI auth settings written by `pnpm config set`. Since pnpm v12.1, `pnpm login` saves tokens in the global `config.yaml` under `_auth`. The legacy global `rc` file remains readable for registry/auth compatibility.

## Per-project settings in a workspace (packageConfigs)

There are no per-subproject `.npmrc` files anymore. Set per-package config via `packageConfigs` in the root `pnpm-workspace.yaml`:

```yaml title="pnpm-workspace.yaml"
packageConfigs:
  # Map form: keyed by package name
  project-1:
    saveExact: true
  project-2:
    savePrefix: '~'
  # Array form: pattern-matched rules
  # - match: ['project-1', 'project-2']
  #   modulesDir: node_modules
  #   saveExact: true
```

## .npmrc — registry, authentication, and certificates

Keep secret values out of git. Project `.npmrc` files can contain literal auth settings and non-secret registry URLs, but pnpm ignores interpolated credentials there. Auth files, highest priority first:

1. `<workspace root>/.npmrc` (project; gitignore files containing secrets)
2. `<pnpm config>/auth.ini` (written by `pnpm config set` for auth keys)
3. `~/.npmrc` (user-level fallback for npm compatibility)

Put environment-variable token references in a user-level auth file:

```ini title="~/.npmrc (user-level auth)"
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
//npm.myorg.com/:_authToken=${MYORG_TOKEN}
```

Non-secret static registry routing can remain in a project `.npmrc`:

```ini title=".npmrc (project; no secrets)"
@myorg:registry=https://npm.myorg.com/
```

In CI, use a user-level auth file or the structured authentication environment variable below. Do not move interpolated token lines into the project file.

### Structured `_auth` (v11.10+, for CI)

An alternative to many `//host/:_authToken=…` lines, keyed by registry URL. Honored **only** from the global `config.yaml` and the `pnpm_config__auth` (or `PNPM_CONFIG__AUTH`) env var — **ignored** in a project `.npmrc`/`pnpm-workspace.yaml`, so a checked-out repo cannot define this structured credential map. `pnpm login` writes this shape since v12.1.

```yaml title="config.yaml (global only)"
_auth:
  https://registry.npmjs.org:
    "@":         { authToken: npm-token }   # @ = registry-wide/default
    "@org":      { authToken: org-token }   # scope-bound on the same host
```

```sh
export pnpm_config__auth='{"https://registry.npmjs.org":{"@":{"authToken":"npm-token"}}}'
```

Configure registries themselves (non-secret) in `pnpm-workspace.yaml`:

```yaml title="pnpm-workspace.yaml"
registries:
  default: https://registry.npmjs.org/
  '@my-org': https://private.example.com/
# Named registry aliases usable as a prefix, e.g. `pnpm add work:@corp/lib`
namedRegistries:
  work: https://npm.work.example.com/
```

> Security: since v11, env-variable expansion is disabled for registry/proxy URLs and credential keys in the **project** `.npmrc` (to stop a malicious repo from leaking secrets). Put dynamic-token lines in the user-level auth file instead.

## The `pnpm config` command

```bash
# Writes settings to global config.yaml; INI auth keys go to auth.ini
pnpm config set nodeVersion 22.0.0
pnpm config set --location=project nodeVersion 22.0.0   # writes pnpm-workspace.yaml

# JSON values create arrays/objects
pnpm config set --location=project --json allowBuilds '{"react": true}'

# get/list print JSON (no longer INI) since v11
pnpm config get nodeLinker
pnpm config get 'allowBuilds.react'
pnpm config list
```

## Environment variables

Use `pnpm_config_*` (or `PNPM_CONFIG_*`). pnpm **no longer reads `npm_config_*`**.

```bash
pnpm_config_save_exact=true pnpm add foo
```

## Notable settings that changed names

| Old (removed) | Replacement | Notes |
|---------------|-------------|-------|
| `onlyBuiltDependencies`, `neverBuiltDependencies`, `ignoredBuiltDependencies`, `onlyBuiltDependenciesFile` | `allowBuilds: { name: true\|false }` | Single map controlling build-script approval. See supply-chain-security. |
| `managePackageManagerVersions`, `packageManagerStrict`, `packageManagerStrictVersion`, `COREPACK_ENABLE_STRICT` | `pmOnFail: download\|ignore\|warn\|error` | Behavior when running pnpm version ≠ declared one. |
| `useNodeVersion` | `devEngines.runtime` (in `package.json`) | Runtime pinning. |
| `auditConfig.ignoreCves` | `auditConfig.ignoreGhsas` | Use GHSA IDs. |
| `allowNonAppliedPatches` | `allowUnusedPatches` | `ignorePatchFailures` removed (patches now always throw). |
| `package.json#pnpm` field | `pnpm-workspace.yaml` | No longer read at all. |

## Package Manager / Runtime pinning (package.json)

```json
{
  "packageManager": "pnpm@12.11.2",
  "devEngines": {
    "packageManager": { "name": "pnpm", "version": ">=12.0.0 <13.0.0", "onFail": "download" },
    "runtime": { "name": "node", "version": "22.x", "onFail": "download" }
  }
}
```

`devEngines.packageManager` supports ranges (resolved version stored in lockfile); `packageManager` requires an exact version. Override `onFail` without editing the manifest via `pmOnFail` / `runtimeOnFail` settings.

## Key Points

- Put pnpm settings in `pnpm-workspace.yaml` (camelCase) or global `config.yaml`; retain supported registry/auth, certificate, and legacy network settings in INI files when needed.
- `package.json#pnpm` and `npm_config_*` env vars are no longer read.
- Use `packageConfigs` for per-package settings inside a workspace.
- Build-script approval is now one `allowBuilds` map; package-manager strictness is one `pmOnFail` setting.
- `pnpm config get`/`list` output JSON, and `--location=project` writes to `pnpm-workspace.yaml`.

<!--
Source references:
- https://pnpm.io/settings
- https://pnpm.io/configuring
- https://pnpm.io/npmrc
- https://pnpm.io/pnpm-workspace_yaml
- https://pnpm.io/package_json
- https://pnpm.io/cli/config
-->
