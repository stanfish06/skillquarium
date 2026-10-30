# sbxenv.yaml: kits, additionalWorkspaces, mcp, ports, sandboxOptions

Schema-verified against `sandboxlib/sbxenv/types.go` at docker/sandboxes
commit df5c96ba60484fa2c375469dbac912c205da6c37, and against the narrative
description in the captured `sbx_env.txt` / `docs/yml/sbx_env.yaml` help.

## `kits:`

Each entry is either a bare reference or a mapping carrying that kit's own
arguments:

```yaml
kits:
  - ./mixins/base
  - source: ./mixins/tool
    args:
      version: ${{ env.args.channel }}
```

A source written as an explicit relative path (`./…`, `../…`, `.`, `..`, or
one ending in `.zip`) resolves against the **directory of the file that
declares it** — the same anchoring rule as `workspace:` — so a checked-in
file reaches the same kits from wherever `sbx` is run. A bare `kits/tool` is
left exactly as written and is a registry reference, not a directory, even
if a directory of that name sits beside the file.

`--kit-arg name=value` (every kit) or `--kit-arg kitname.name=value` (one
kit) overrides a kit's `args:` per invocation on the command line; see
`docker-sandboxes-kits` for what a kit itself may declare under `args:`.

## `additionalWorkspaces:`

A list of `{path, readOnly}` entries, each **additional to** the primary
`workspace:` — a file that declares `additionalWorkspaces:` without a
`workspace:` fails validation (there is nothing for the extra mount to be
additional to).

```yaml
workspace: .
additionalWorkspaces:
  - path: /path/to/docs
    readOnly: true
```

This is the `sbxenv.yaml` equivalent of `sbx run`'s extra positional
workspace arguments with a `:ro` suffix — see `docker-sandboxes-lifecycle`
for the flag form and the single-file read-only-carve-out behavior.

## `mcp:`

`mcp.servers:` lists MCP servers this environment registers on the host
(the same resolve + policy-check + persist steps `sbx mcp add` performs)
and adds to the sandbox's fixed (static) MCP set at `sbx env create` time.
Each entry needs a `name:` and **exactly one** of `url:` (remote HTTP/SSE
server or registry/OCI reference) or `command:`+`args:` (local stdio
server).

```yaml
mcp:
  servers:
    - name: fetch
      url: https://registry.modelcontextprotocol.io/v0/servers/fetch-mcp/versions/latest
```

This requires the hosted MCP control plane to be configured. Registrations
are host-global and are intentionally **left in place** by `sbx env rm` —
they are not sandbox-scoped resources this environment tears down.

## `ports:`

Pins explicit host-port bindings for container ports the sandbox
(typically a kit) exposes — the `sbxenv.yaml` equivalent of
`sbx ports --publish`. Each entry needs `sandbox:` (1–65535, required);
`host:` (omit for an ephemeral port), `protocol:` (`tcp`/`tcp4`/`tcp6`/
`udp`/`udp4`/`udp6`), and `hostIP:` are optional.

```yaml
ports:
  - sandbox: 8080
    host: 3000
```

Publishing happens at `sbx env create`/`sbx env run` and is torn down
automatically when `sbx env rm` deletes the sandbox. A binding that cannot
be published (e.g. the host port is already taken) fails the create and
rolls it back, rather than leaving the sandbox up unpublished.

## `sandboxOptions:`

Beyond `writableEnvFiles` (covered in the main SKILL.md), `sandboxOptions:`
maps directly onto `sbx create` flags: `template` (image override),
`memory`, `cpus`, `pullPolicy` (`always`/`missing`/`never`), `profile`
(governance profile), and `skills` (`off`/`readonly`/`readwrite`, the
shared skills store mode). See `docker-sandboxes-lifecycle` for what each
corresponds to on the plain `sbx create`/`sbx run` command line.

```yaml
sandboxOptions:
  memory: 8g
  cpus: 4
  skills: readonly
```
