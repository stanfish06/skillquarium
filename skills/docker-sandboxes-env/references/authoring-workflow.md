# Authoring workflow: create or update an sbxenv.yaml

Detailed procedure behind the "Create or update workflow" in `SKILL.md`.
Every kit name, tag, digest, arg, and credential comes from the bundled
`scripts/kits.py` in the current run; the kit references below are only
illustrations of the shape, not recommendations. Field rules are in
`env-schema-fields.md`.

In the commands below, `<skill-dir>` is the directory the skill's `SKILL.md`
was loaded from.

## Step 1: Decide what you are doing

| Found | Do |
|---|---|
| `./sbxenv.yaml` | Update (Step U). |
| `./.sbxenv.yaml` | It is not read from a project directory. Offer to rename it to `sbxenv.yaml`, then update. |
| The user names `~/.sbxenv.yaml` | Their personal defaults layer. Usually only bindings and `sandboxOptions`, never `name:`, and `workspace:` only as `${{ env.projectDir }}` or below it. |
| Nothing | Create (Step C). |

## Step C: Create

### C1. Read the workspace

Collect signals, then turn them into search terms. Read only what you need:
the file listing, manifest files, and the git remote.

| Signal | Search terms |
|---|---|
| `AGENTS.md`, `CLAUDE.md`, `.claude/`, `.codex/`, `GEMINI.md`, `.cursor/` | The agent it implies (`claude`, `codex`, `gemini`, `copilot`, …). Otherwise ask which agent. |
| git remote on github.com | `github`, `gh`. Add `ssh` if the remote is SSH or commits are signed. |
| `go.mod` | `go`, `golang` |
| `package.json`, `pnpm-lock.yaml`, `bun.lockb` | `node`, `pnpm`, `bun` |
| `pyproject.toml`, `requirements*.txt`, `uv.lock` | `python`, `uv` |
| `Cargo.toml` | `rust` |
| `pom.xml`, `build.gradle*` | `java`, `maven`, `gradle` |
| `Dockerfile`, `compose*.yaml` | `docker`, `buildx`, `compose` |
| `Taskfile.yaml`, `Makefile`, `justfile` | `task`, `make`, `just` |
| `*.tf`, `helm/`, `k8s/`, `kustomization.yaml` | `terraform`, `helm`, `kubectl` |
| Docs-heavy repository (`*.md`, `.vale.ini`) | `vale`, `markdown` |
| Local kit directories (`*.yaml` with `schemaVersion: "3"`, often under `kits/` or `.sbx/`) | None. Offer them as `./path` sources. |

```bash
python3 -I <skill-dir>/scripts/kits.py search <terms…>
python3 -I <skill-dir>/scripts/kits.py search      # whole catalog, to pick the agent
python3 -I <skill-dir>/scripts/kits.py describe <candidate refs…>
```

You need `kind` and `agent` from `describe` to tell agent workloads from
mixins. This first `describe` of an untagged candidate reads `latest`, which
can be a different release from the one you will write; use it only to
shortlist kits, never to configure them.

### C2. Propose a composition

- Exactly one workload. Either keep a built-in agent in `agent:` and add
  only mixins, or pick an agent workload kit (`kind: workload`,
  `agent: true`), list it under `kits:`, and set `agent:` to its `handle`.
- Pick mixins for the signals you found. A tool the workload already
  provides needs no mixin; check its `provides`.
- When both `X` and `X-mixin` exist, `X` is the workload and `X-mixin`
  layers that agent onto a different base. Use the mixin only when the user
  wants that different base.
- For each OCI kit you keep, run `kits.py update <org>/<name>` (no tag) and
  use `newestRelease` as the tag. Skip this for `./path` and `git+` sources.
- Then `describe` that exact reference (`<org>/<name>:<newestRelease>`).
  C3 and C4 use this descriptor, not the shortlist one: args, credentials,
  and host grants can differ between releases.

Present a short table (kit, kind, tag, why) and ask the user to confirm,
add, or remove kits.

### C3. Kit args and environment args

For every chosen kit, take `args` from the `describe` of the selected
release (C2):

- `required: true` → must be set; ask for the value.
- Optional → set only when the user wants a non-default value. Show the
  `description` and the `enum` or `pattern` the value must match.
- `buildArgs` (usually `version`) cannot be set on a published kit; choose a
  different tag. Read the installed release from `version`, not from a build
  arg's default.

Put the value directly in the kit entry's `args:` when it is a project
decision. Declare an environment arg and reference it as
`${{ env.args.<name> }}` when callers vary it per run, when one value feeds
several kits, or when a required kit arg has no sensible project-wide value
(declare it `required: true` so `sbx env` fails until `--env-arg` supplies
it).

`--env-arg` and `--kit-arg` are experimental flags; say so when you rely on
them. `buildSecrets` are consumed only while building source kits; published
images need no binding for them, and an environment file cannot set them.

### C4. Credentials, secrets, and bindings

For each entry in `credentials` from the selected release's `describe`:

1. **Mechanism.** If `mechanisms` has both `apiKey` and `oauth`, ask which
   one the user will use (subscription logins usually mean `oauth`; tokens
   mean `apiKey`). Write a `bindings.<service>` block with only that
   mechanism, copying its domains from `suggestedBinding`. An `apiKey` with
   only `apiKeyEnv` and no inject rules yields an empty domain list: the kit
   reads the key from an environment variable and nothing is injected
   outbound.
2. **Arg-dependent credentials.** A service or domain that references a kit
   arg resolves from the arg defaults. When the file sets that arg, rerun
   `describe REF --arg NAME=VALUE` with the same value. If `unresolved` is
   not empty, `suggestedBinding` is null: supply the missing arg, or for a
   `${{ kit.env.NAME }}` reference ask what the variable will hold. Never
   copy a `${{ … }}` expression into the file.
3. **Secret source (`apiKey` only).** Ask the user to run `sbx secret ls` on
   the host. If the service is already in the global store, the binding is
   enough. Otherwise add `secrets.<service>` with `ref:` (for example
   `op://Vault/item/field`) or `command:` (for example `gh auth token`). If
   neither fits, the user stores it with `sbx secret set` and the binding
   alone approves it. Do not write a `value:` entry, even on request.
4. **OAuth.** No `secrets:` entry; the user signs in once on the host.
5. **Required vs optional.** A non-optional credential without a binding
   makes create fail; an optional one degrades silently. Say which it is.

For `hostGrants`:

- `ssh-agent@1` (not optional) → add a prerequisite comment: an SSH agent
  must be running with a key loaded (`ssh-add -l`).
- `host-port@1`, `host-mount@1`, `privileged@1`, `dockerd@1` → explain what
  the user will be asked to approve. A `host-mount@1` path is bound with a
  top-level `mounts:` entry.
- A kit that publishes ports (`port@1`) → offer a `ports:` entry to pin the
  host port; otherwise it gets an ephemeral one.

Private kits or images need a `registries:` entry.

### C5. Workspace and options

- Prefer placing the file beside the project and writing
  `workspace: ./<project>`; if the file must live in the project, write
  `workspace: .` so it sits at the mount root. Leaving `workspace` out
  mounts nothing. Offer `{path: ., clone: true}` when the user wants a
  private clone (the directory must be a git repository, not a worktree).
- Add `env:` only for values no kit sets.
- `sandboxOptions`: `pullPolicy` defaults to `always`; add `memory`/`cpus`
  only when asked or the project is heavy.
- Add `lifecycle` only for host-side steps, and note that they run on the
  host with the user's privileges.

### C6. Pin or not

Ask: **tags only** or **tag + digest**? Tag + digest is reproducible and can
be refreshed later. To pin, run `kits.py pin <each OCI ref>` and use
`suggested`. `pin` keeps the tag you already inspected.

Do not use `update` here: it moves to the highest release and can undo a
version chosen on purpose (for example to satisfy another kit's
`requires`). If `update` shows a higher version, offer it separately and
`describe` the new reference before adopting it.

### C7. Write, then check

- A header comment with prerequisites (sign-in, secrets that must exist, SSH
  agent) and the commands (`sbx env plan`, `sbx env run`, `sbx env rm`).
- A short comment above each kit, arg, and binding saying why it is there.
- Run the checklist below, then ask the user to run `sbx env plan` on the
  host to preview.

## Step U: Update

1. **Read** the file. List every `kits:` source (bare strings and `source:`
   values) and `agent:`.
2. **Refresh** all OCI references in one call: `kits.py update <refs…>`.
   Pinned refs (`@sha256:`) come back with new digests.
3. **Present** a table: current → suggested, with notes. Flag major version
   jumps. For moving tags (`latest`, `edge`), show `newestRelease` and offer
   to switch to that fixed release. For unpinned refs, offer `--pin`.
4. **Diff what changes.** For each accepted kit, `describe` old and new:
   - **args:** an arg the file sets that the new version no longer declares
     must be removed; a new `required` arg must be set; a tightened
     `enum`/`pattern` must still accept the file's value.
   - **credentials:** a new service, mechanism, or domain needs a binding
     change; a removed one can be pruned.
   - **hostGrants** and `kind`: a new required grant (such as `ssh-agent@1`)
     needs a prerequisite note; a changed `handle` or kind may require
     changing `agent:`.
5. **Review the rest.** Credentials without bindings, v2 kits with v3
   siblings (`search <name>`), a project `.sbxenv.yaml`, and a missing
   `schemaVersion: "1"`. Offer any new kit the workspace signals now suggest.
6. **Apply** only what the user accepted, with in-place edits, and update
   comments that mention versions. Changed kits, secrets, bindings, ports,
   workspaces, and `sandboxOptions` reach an existing sandbox only after
   `sbx env rm` and a new create; say so.

## Final checklist

- `schemaVersion: "1"` is present and `agent:` is set.
- `agent:` is a built-in or the `handle` of exactly one workload under
  `kits:`.
- Every `kits` entry is a string or `{source, args}`, and every arg name is a
  create-phase arg that kit declares.
- Every `${{ env.args.x }}` has a matching `args.x`. Required environment
  args are documented in the header with an `--env-arg` example.
- Each `secrets.*` entry has exactly one of `value`/`ref`/`command`, and no
  literal secret is written.
- Every non-optional credential has a binding naming only the chosen
  mechanism.
- `additionalWorkspaces` and `workspace.clone` both have a `workspace`.
- The YAML parses. Use any available parser (`yq`, `python3 -c 'import
  yaml'`, `ruby -ryaml`); if none is available, say so rather than claiming
  the file is valid.
- Every OCI kit reference written to the file was described in this run at
  that exact tag (or digest), and its args, bindings, and prerequisites match
  that descriptor. A `kits.py pin` result proves only that the tag exists.
  `sbx env plan` does not check that kits exist, so a clean plan alone does
  not prove the references are valid.
- If `sbx` is on `PATH`, run `sbx env plan`; otherwise ask the user to run it
  on the host and share any errors. A clean plan does not prove the
  composition installs: a mixin can depend on a runtime its `requires` does
  not declare. If the user agrees, prove it with a disposable `sbx env create`
  (reviewed plan, no `--force`) and `sbx env rm`; otherwise report the
  composition as unverified.

Then report what changed and what the user still has to do on the host
(create secrets, `sbx login`, start an SSH agent, OAuth sign-in).
