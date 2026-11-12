# sbxenv.yaml field reference

`sbxenv.yaml` describes one sandbox environment for `sbx env
plan|create|run|exec|rm`. Its `schemaVersion: "1"` belongs to environment
files and is unrelated to a kit descriptor's `schemaVersion: "3"`. Decoding is
strict: an unknown key anywhere is an error. Keys are lowerCamelCase.
Provenance is in `sources.md`.

## Files and merging

| File | Role |
|---|---|
| `<project>/sbxenv.yaml` | The project file; the only name read from a directory. |
| `~/.sbxenv.yaml` | Personal defaults merged beneath the project file when no `PATH` is given. Cannot set `name:`; `workspace:` must be `${{ env.projectDir }}` or below it. |
| Any other path | Read only when passed explicitly, e.g. `sbx env run path/to/file.yaml`. |

- Several paths merge in order: mappings by key, later scalars win, lists
  concatenate (so base-layer lifecycle commands run first) — except
  `entrypoint` and `cmd`, which later files replace, and `kits` entries with
  the same source, which fold into one entry whose `args` merge key by key.
- A project-level `.sbxenv.yaml` (leading dot) is not read.
- Relative paths (`workspace`, local kit sources, `additionalWorkspaces`,
  `mounts` host paths) resolve against the directory of the declaring file.

## Top-level keys

| Key | Required | Meaning |
|---|---|---|
| `schemaVersion` | yes | `"1"` (quoted string). |
| `name` | no | Sandbox name and the scope of provisioned secrets. Defaults to `<agent>-<workspace-basename>`; `--name` overrides it. |
| `args` | no | Environment arguments. See [Arguments](#arguments). |
| `agent` | yes | A built-in agent or the name (handle) of the agent workload kit under `kits`. |
| `entrypoint` | no | argv list replacing the agent's launch executable for `sbx env run`. Omitted/null inherits; `[]` clears. No shell parsing. |
| `cmd` | no | argv list appended to `entrypoint`; arguments after `--` on `sbx env run` replace it. |
| `kits` | no | Kits to install at creation. See [Kits](#kits). |
| `workspace` | no | Primary mount: a path string (read/write bind) or `{path, clone}` (`clone: true` mounts the path read-only and works on a private clone). Omit to mount nothing; a blank path is an error. |
| `additionalWorkspaces` | no | List of `{path, target?, readOnly?}`. Requires `workspace`. `target` is an absolute POSIX path in the sandbox. |
| `mounts` | no | Map of a kit-declared `host-mount@1` sandbox path → existing host directory (local only). |
| `env` | no | String map of variables set inside the sandbox. `$VAR` passes through literally. |
| `sandboxOptions` | no | Creation options. See [sandboxOptions](#sandboxoptions). |
| `secrets` | no | Sandbox-scoped service credentials. See [Secrets](#secrets). |
| `bindings` | no | Per-service credential approvals. See [Bindings](#bindings). |
| `registries` | no | Registry pull credentials keyed by hostname. See [Registries](#registries). |
| `mcp` | no | MCP servers. See [MCP](#mcp). |
| `ports` | no | Published ports. See [Ports](#ports). |
| `lifecycle` | no | Host commands. See [Lifecycle](#lifecycle). |

## Kits

Each entry is a bare reference string or a mapping with `source` and `args`.
The references below only illustrate shapes; resolve real names, tags, and
digests with `scripts/kits.py`.

```yaml
kits:
  - sbx/example:1.2.3                         # OCI, tag
  - sbx/example:1.2.3@sha256:<digest>         # OCI, tag + digest (pinned)
  - source: sbx/example-agent:4.5.6           # OCI with kit args
    args:
      model: ${{ env.args.model }}
  - ./kits/dev-tools                          # local directory, built on create
  - ./dist/tool.zip                           # local ZIP
  - git+https://github.com/org/repo.git#ref=<commit>&dir=kits/tool   # git, pinned
```

- **Handle.** A v3 kit's handle is the last path segment of its repository
  (`sbx/claude` → `claude`). For git sources it is the `dir=` basename; for a
  directory, the directory name. `agent:` names the workload kit by handle.
- **One workload.** Exactly one `kind: workload` kit (or a built-in agent) and
  zero or more `kind: mixin` kits.
- **Relative sources.** Only `./…`, `../…`, `.`, `..`, or a path ending in
  `.zip` are file paths. A bare `kits/tool` is a registry reference.
- **Kit args.** Keys are the bare names the kit declares. An undeclared arg is
  an error, and values must satisfy the kit's `enum`/`pattern`.
- **Published kits** accept only **create-phase** args. Build args were fixed
  at publish time; pick a different tag to change one (typically `version`).
  Local-directory and git sources build on create, so their build args apply.
- **Allowed sources.** Remote sources must match `kit.allowedSources`
  (Docker Hub by default). `sbx settings set kit.allowedSources '[...]'`
  replaces the whole list.
- `--kit-arg name=value` (all kits) or `--kit-arg kit.name=value` (one handle)
  overrides `args` for one invocation; `--kit-args-file` reads `name=value`
  lines. Both are experimental.

## Arguments

```yaml
args:
  channel:
    description: Release channel
    default: stable                 # or `required: true`; exactly one
    enum: [stable, beta]            # or `pattern:` (RE2, whole value); not both
env:
  RELEASE_CHANNEL: ${{ env.args.channel }}
```

- Names start with a letter or underscore and may contain letters, digits,
  underscores, and hyphens.
- Values come only from `--env-arg name=value` or `--env-args-file FILE`
  (later files win; `--env-arg` wins over all files). The host environment is
  never read.
- Undeclared references, missing required values, unknown supplied names, and
  values failing `enum`/`pattern` are errors.
- References are not allowed in field names or inside `args:`. An unquoted
  reference is re-read as YAML after substitution; quote it to keep a string.
  `$${{ env.args.NAME }}` yields the literal text.

## sandboxOptions

| Key | Meaning |
|---|---|
| `template` | Custom sandbox template image. |
| `memory` | Memory limit, e.g. `"8g"`. |
| `cpus` | CPU count (integer). `0` selects the host default. |
| `rootSize`, `dockerSize`, `clonedWorkspaceSize` | Disk sizes, e.g. `"40g"`. |
| `pullPolicy` | `always` (default), `missing`, or `never`. |
| `profile` | Governance profile name. |
| `skills` | Shared skills store: `off`, `readonly`, or `readwrite` (daemon default, normally `readonly`). |
| `display` | `true` provisions a display socket for graphical applications. |
| `fuse` | `false` disables FUSE for this sandbox (local only). |
| `gpu` | `true` passes the host GPU through. |
| `nested` | Nested virtualization (macOS Apple Silicon M3+). |
| `usb` | List of USB device selectors. |
| `writableEnvFiles` | `true` lets the sandbox write its shared env files (local only). A security downgrade; see `SKILL.md`. |

## Secrets

Keys are service names (a kit `credential@1` `service`). Each entry sets
exactly one source and is stored at the sandbox scope when the environment is
created; `sbx env rm` removes it.

| Field | Meaning |
|---|---|
| `ref` | Vault URI resolved on the host, e.g. `op://Vault/Item/field`. Preferred. |
| `command` | Host shell command whose stdout is the secret, run from a fresh temporary directory. Use absolute helper paths. |
| `value` | Literal. Never commit a real secret this way. |
| `refresh` | Re-resolution policy for `ref`/`command`, e.g. `on-demand`, `55m`. |
| `backend` | Resolver for `ref`: `sdk` or `cli`. |
| `noVerify` | Skip the one-time resolve check during provisioning. |
| `snapshot` | Resolve `ref`/`command` once after approval and store a literal. Cannot combine with `refresh` or `noVerify`; required for cloud dynamic sources. |

A credential already in the global store (`sbx secret ls`) needs no
`secrets:` entry; a binding alone approves its use.

## Bindings

A binding approves a credential mechanism for a service and the domains it may
be injected on. Bindings merge into the user's global `credentials.yaml` and
outlive `sbx env rm` unless `--prune-bindings` is passed, which deletes the
whole global entry for every declared service.

```yaml
bindings:
  github:
    apiKey:
      domains: [api.github.com]
```

- `apiKey` injects the stored secret into requests to `domains`; the kit's
  declared inject domains are the ceiling.
- `oauth` approves OAuth for the service; sign-in is a manual host step and
  needs no `secrets:` entry.
- A required `credential@1` without a binding fails create; an optional one is
  skipped. Bind only the mechanism the user will use. `kits.py describe`
  prints a `suggestedBinding` per credential.

## Registries

```yaml
registries:
  ghcr.io:
    secret:              # required; exactly one of value/ref/command
      command: gh auth token
    # username: {...}    # optional; omitted means token-only
```

Scoped to this sandbox and resolved at create.

## MCP

`mcp.servers` lists `{name, url}` or `{name, command, args}` — exactly one of
`url`/`command`. Servers register with the built-in MCP gateway.

- `url` servers are host-global and survive `sbx env rm`.
- `command` servers (local only) belong to this environment, run on the host
  whenever its gateway starts, and are removed by `sbx env rm`. Approval pins
  the resolved executable path, not file contents; keep those files outside
  writable mounts. If `initialize` creates the executable or changes its
  resolved path, a second approval is asked.

```yaml
mcp:
  servers:
    - name: fetch
      url: https://registry.modelcontextprotocol.io/v0/servers/fetch-mcp/versions/latest
```

## Ports

List of `{sandbox, host?, protocol?, hostIP?}`. `sandbox` is required
(1–65535); omitted `host` means ephemeral; `protocol` is `tcp`, `tcp4`
(default, or `tcp6` for an IPv6 `hostIP`), `tcp6`, `udp`, `udp4`, or `udp6`;
an unset `hostIP` binds loopback. Kit ports not listed get an ephemeral host
port. A port that cannot be published fails creation and removes the new
sandbox.

```yaml
ports:
  - sandbox: 3000
    host: 3000
```

## Lifecycle

```yaml
lifecycle:
  initialize:          # every create and run, including attach; make it idempotent
    - name: Fetch fixtures
      command: ./scripts/fetch-fixtures.sh
      workdir: ${{ env.fileDir }}   # default: project directory
      timeout: 5m                   # default: none
  postCreate: []       # once, after a new sandbox exists, before attach
  preRemove: []        # after removal approval, before deletion; failure warns
```

- Commands run through the user's shell, in order, stopping at the first
  failure in a phase.
- They receive `SBX_LIFECYCLE_PHASE`, `SBX_ENV_FILE`, `SBX_ENV_FILES`,
  `SBX_ENV_DIR`, `SBX_SANDBOX_NAME`, `SBX_AGENT`, and `SBX_WORKSPACE`, but not
  the file's `env:` values or resolved secrets.
- After `preRemove`, the destroy plan is rebuilt; removal stops if the
  commands introduced unapproved changes.

## Commands

| Command | Does |
|---|---|
| `sbx env plan` | Preview the plan; changes, approves, and records nothing. |
| `sbx env create` | Approve, provision secrets/bindings/MCP, create without attaching. |
| `sbx env run [-- ARG…]` | Create if needed, then attach. `-d`/`--detach` starts without attaching or running the launch command. |
| `sbx env exec [PATH…] -- CMD…` | Run a command; offers to create a missing sandbox only interactively. |
| `sbx env rm [--prune-bindings]` | Show a destroy plan, then remove the sandbox and the resources it names. |

Flags differ per command (sbx v0.51.0 help):

| Flag | plan | create | run | exec | rm |
|---|---|---|---|---|---|
| `--name`, `--env-arg`, `--env-args-file` | yes | yes | yes | yes | yes |
| `--kit-arg`, `--kit-args-file`, `--clone` | yes | yes | yes | no | no |
| `--skip-host-commands` | yes | yes | yes | no | yes |
| `-f`/`--force` | no | yes | yes | no | yes (also deletes in use) |
| `-d`/`--detach` | no | no | yes | not supported | no |
| `--prune-bindings` | no | no | no | no | yes |

Global `--no-input` never prompts; `--cloud` targets Docker Cloud
Sandboxes, which do not support host workspace mounts, host port bindings,
MCP definitions, registry credentials, or unsnapshotted dynamic secret
sources. Cloud-only `--ttl`/`--on-timeout` apply at creation.
