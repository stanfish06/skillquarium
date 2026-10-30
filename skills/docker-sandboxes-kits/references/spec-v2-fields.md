# v2 kit spec.yaml field reference

Schema-verified against the vendored spec package at docker/sandboxes commit
df5c96ba60484fa2c375469dbac912c205da6c37
(`vendor/github.com/docker/sbx-kits-contrib/spec/types.go`,
`vendor/github.com/docker/sbx-kits-contrib/spec/v2.go`) and
`vendor/github.com/docker/sbx-kits-contrib/spec/SPEC-v2.md`. Kept here so the
full field list does not have to be re-read from source on every lookup;
SPEC-v2.md §6 ("Validation summary") is the authoritative enforcement list —
consult it for exactly which of the rules below are checked by
`ValidateArtifact` vs. enforced only by the engine at composition/runtime.

## Common top-level fields (both kinds)

| Field | Required | Notes |
|---|---|---|
| `schemaVersion` | REQUIRED | Must be `"2"` for this grammar. |
| `kind` | REQUIRED | `sandbox` or `mixin`. |
| `name` | REQUIRED | `^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$`, unique across a composition. |
| `version` | optional | Source for the OCI kit-version annotation. |
| `displayName` | optional | Human-readable label. |
| `description` | optional | Short description. |
| `sourceURL` | optional | Source for the OCI `image.source` annotation. |
| `licenses` | optional | SPDX identifiers, non-empty, no duplicates. |
| `locked` | optional | Dotted paths child kits may not override; well-formedness only. |
| `security.privileged` | optional | Immutable at runtime once set. |
| `args` | optional | See below. |
| `agentInstructions` | optional | Shared block; see below. |
| `permissions.network` | optional | Shared block; see below. |
| `ports` | optional | Shared block; see below. |
| `credentials` | optional | Shared block; see below. |
| `environment` | optional | Shared block; see below. |
| `setup` | optional | Shared block; see below. |
| `volumes` | optional | Shared block; see below. |
| `files/` tree | optional | `files/home/` and `files/workspace/` only. |

## `kind: sandbox`-only fields

| Field | Required | Notes |
|---|---|---|
| `sandbox` | **REQUIRED** (unless `extends` supplies it) | `image`/`build`, `entrypoint`, `command`, `resources`. |
| `extends` | optional | Built-in agent name only at this pinned release; remote parents fail resolution. |
| `mixins` | optional | Author-declared; forward-compat, not yet applied at runtime. |
| `agentInstructions.filename` | optional | Meaningful only here — the AI profile this sandbox owns. |

`sandbox.entrypoint`: flat string array, `entrypoint[0]` = binary. `command`:
polymorphic — a bare list sets `default` (interactive falls back to it), or a
`{default, interactive}` mapping. `sandbox.resources`: `cpu` (float, cores),
`memory` (byte-size string, e.g. `4096m`/`8g`), `gpu` (opaque selector
string). `sandbox.build` is forward-compat only (schema-accepted, not built
by the runtime this release) and requires `image:` alongside it.

## `kind: mixin`-only fields

| Field | Allowed | Notes |
|---|---|---|
| `sandbox` | **FORBIDDEN** | Hard error if present. |
| `extends` | **FORBIDDEN** | Mixins cannot inherit. |
| `mixins` | **FORBIDDEN** | Mixins cannot compose other mixins. |
| `requires.agent` | optional | Base-agent affinity; rejected on `kind: sandbox`. |
| `agentInstructions.filename` | ignored (warning) | A mixin does not own an AI profile filename. |
| `volumes` | applies at create time only | `sbx kit add` skips volume changes. |

## `args` (v2 only)

Map keyed by argument name (`^[A-Za-z_][A-Za-z0-9_-]*$`). Each entry: exactly
one of `default` (string, `""` counts as real) or `required: true`; optional
`description`; `enum` (list, no duplicates) XOR `pattern` (RE2, matched
against the whole value). Referenced as `${{ kit.args.NAME }}`, substituted
before decode; every reference must be declared or the kit fails to load.

## `agentInstructions`

```yaml
agentInstructions:
  filename: CLAUDE.md      # sandbox-only; ignored (warning) for a mixin
  content: |
    Markdown appended to (sandbox) or filed alongside (mixin) the AI profile.
```

## `permissions.network`

```yaml
permissions:
  network:
    allow: ["*.anthropic.com", "api.example.com:443"]
    deny: ["telemetry.example.com"]
```
Enforced: exact host, exact host+port, single-label wildcard (`*.example.com`),
multi-label wildcard (`**.example.com`), and CIDR prefixes. Port ranges are
not supported by the runtime matcher; use separate exact ports. Deny wins
within domain rules or within CIDR rules, but a decisive domain decision
precedes CIDR evaluation: a domain allow can bypass a CIDR deny for its
resolved IP. `allow` lists are **additive across composition** — a sandbox's effective allow set is the union of every
composed kit's `allow`, plus whatever the global/per-sandbox network policy
independently permits (see `docker-sandboxes-network-credentials`). Removing
a host from one kit's `allow` does NOT by itself prove that host is
blocked. All-egress-declared: every `credentials[].apiKey.inject[].domain`
should be declared in the kit's allow list for reproducibility. Omitting an
entry does not necessarily block it: global/per-sandbox policy can grant
access independently. `sbx kit validate` never checks reachability
(schema-only). Confirm the real effective decision with
`sbx policy check network --sandbox <name> <host>` against an actual
sandbox.

## `ports`

```yaml
ports:
  - container: 8080   # REQUIRED, 1-65535
    protocol: tcp      # "" (-> tcp) | tcp | udp
    name: web           # informational only
```
Host ports are always ephemeral on `127.0.0.1`; a kit cannot pin one — users
pin with `sbx ports --publish`.

## `credentials`

```yaml
credentials:
  - service: anthropic          # REQUIRED, identity for user-side bindings
    description: "..."
    required: false
    apiKey:
      name: ANTHROPIC_API_KEY   # REQUIRED; env var set to sentinel when wired
      proxyManaged: true
      inject:
        - domain: api.anthropic.com   # REQUIRED, must be allow-listed
          header: x-api-key           # explicit header+format ...
          format: "%s"                # ... exactly one %s
        - domain: api2.anthropic.com
          scheme: bearer               # ... OR scheme sugar (mutually exclusive with format)
    oauth:
      tokenEndpoint: {host: platform.claude.com, path: /v1/oauth/token}  # both REQUIRED
      resourceHosts: [api.anthropic.com]
      sentinels: {accessToken: "...", refreshToken: "..."}  # REQUIRED unless passthrough
      credentialFile: {path: "~/.claude/.credentials.json", structure: {...}}  # structure preferred over deprecated template
      passthrough: false            # true = security downgrade, real token reaches container
```
`scheme: bearer` -> `header: Authorization, format: "Bearer %s"` (no
`username`). `scheme: basic` -> username-driven Basic auth (`username`
REQUIRED, no `header` set automatically). An entry may declare both `apiKey`
and `oauth` on a sandbox kit. Do not infer universal credential precedence
from this schema: provisioning is service-specific (stored usable OpenAI
OAuth takes precedence over an API key). Mixins cannot declare OAuth.

A mixin redefining a base service with its own `apiKey.name` or
`proxyManaged` fails composition. Routing-only additions may merge: use
only `apiKey.inject`, no `name`/`proxyManaged`/`oauth`, and `required: false`.
Check the built-in base's source spec before authoring this extension;
`sbx kit inspect shell` is not a supported lookup. For a custom base, inspect
its directory/ZIP/OCI/git artifact reference instead.

## `environment`

```yaml
environment:
  variables:
    IS_SANDBOX: "1"     # keys must match ^[A-Za-z_][A-Za-z0-9_]*$
```
Reserved prefixes the runtime owns (kits SHOULD NOT set): `DASH_`, `SBX_`,
`DOCKER_`; runtime may also override `HOME`, `USER`, `SHELL`, `PATH`,
`LD_PRELOAD`, `LD_LIBRARY_PATH`.

## `setup`

```yaml
setup:
  install:                                    # string command, sh -c, runs once
    - command: "install -d -o agent -g agent /home/agent/.cfg"
      user: "0"                               # default "0" (root)
  startup:                                    # list<string> argv, runs every start
    - command: ["sh", "-c", "mkdir -p ~/.cfg"]
      user: "1000"                            # default "1000" (agent)
      background: false
  files:                                       # dynamic writes performed at startup via shell exec
    - path: /home/agent/.cfg/config.json       # REQUIRED, absolute
      content: '{"workdir": "${WORKDIR}"}'     # only ${WORKDIR} placeholder allowed
      mode: "0644"
      onlyIfMissing: true
```
`install` runs once per kit at creation, for every kit (built-in or not) —
guard with `command -v <bin>` for idempotency across recreate. `startup`
must be idempotent (fires on every container start). `files` (under
`setup:`) paths must be writable by uid 1000 — a root-owned target path
needs an `install` command instead. All three lists concatenate across
kits in `--kit` order.

**`setup.files` is a different mechanism from the static `files/` directory
tree (below).** `setup.files` entries are startup-time, `${WORKDIR}`-
substituted dynamic writes; the `files/` directory tree is packed
alongside `spec.yaml` and copied in at container-create time. It is
specifically `files/workspace/<path>` (not `setup.files`) that is written
after the workspace is populated (e.g. after an in-container `--clone` git
clone) — do not attribute that "after workspace population" timing to
`setup.files`.

## `volumes`

```yaml
volumes:
  - path: /workspace        # REQUIRED, absolute
    type: ""                 # "" (block, default) | tmpfs
    size: 10g                 # byte-size string
    mode: "0755"               # octal
```
Creation-time only (`sbx kit add` skips volume changes). Always set `size:`
on a block volume — an unsized one incurs ext4 inode-table zeroing at the
50 GiB default; 512 MiB is the practical floor.

## `files/` directory

`files/home/<path>` -> `/home/agent/<path>`; `files/workspace/<path>` ->
`<workspace>/<path>` (written after workspace population, e.g. after an
in-container `--clone` git clone). Relative paths only; `..` traversal and
symlinks escaping the artifact root are rejected.
