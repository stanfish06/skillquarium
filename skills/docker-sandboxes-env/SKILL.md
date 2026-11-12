---
name: docker-sandboxes-env
description: Use this skill when creating, updating, reviewing, planning, or running a declarative `sbxenv.yaml` file for Docker Sandboxes (`sbx env plan/create/run/exec/rm`), even if the user just says "check in a sandbox config", "set up this project for sbx env", "which kits should this project's sbxenv use", "bump or pin the kits in my sbxenv", or "run a setup script before the agent starts". Covers composing an agent workload and v3 mixin kits chosen from the live Docker Hub catalog with the bundled `scripts/kits.py` helper, kit and environment `args`, secrets/registries/bindings, workspace and mounts, `entrypoint`/`cmd`, ports, MCP servers, `sandboxOptions` (including `writableEnvFiles`), host `lifecycle` commands and the approval plan, multi-file merge, and the `~/.sbxenv.yaml` user defaults.
license: Apache-2.0
compatibility: Requires standalone sbx with experimental `sbx env` support and sbxenv.yaml schemaVersion "1"; help and docs checked against sbx v0.51.0. scripts/kits.py needs Python 3.9+ and anonymous HTTPS access to Docker Hub (PyYAML only for older YAML descriptors). Provenance is in references/sources.md.
---

# Docker Sandboxes: Declarative sbxenv.yaml Environments

## Overview

`sbxenv.yaml` (schemaVersion `"1"`, EXPERIMENTAL) declares one local or cloud
sandbox environment: the agent, the kits composed onto it, workspace mounts,
environment variables, secrets/registries/bindings to provision, MCP servers,
ports, launch command, and host-side lifecycle commands. `sbx env
plan|create|run|exec|rm` stand it up and tear it down reproducibly instead of a
long flag invocation. This skill owns that file end to end: authoring it from
the project's signals, refreshing its kit references, and explaining how it is
applied and approved. Decoding is strict — an unknown key anywhere is an error
— so check `references/env-schema-fields.md` before writing a field you are
not sure about.

## When to use this skill

Activate this skill when:
- The user wants a checked-in, reproducible sandbox environment instead of a
  long `sbx create`/`sbx run` command line, or asks to scaffold, create, or
  review an `sbxenv.yaml` or `~/.sbxenv.yaml`.
- The user wants kits suggested for a project's `sbxenv.yaml`, or wants the
  kit references in an existing `sbxenv.yaml` upgraded, bumped, or pinned to
  digests.
- The user wants host-side setup or teardown commands (cloning a repo,
  seeding fixtures, archiving state) tied to the environment's lifecycle.
- The user wants to parameterize a shared environment file with named
  arguments (`args:` + `--env-arg`).
- The user is debugging why `sbx env create`/`run` asks for approval, or why a
  declared change did not take effect on an existing sandbox.

## Do not use this skill when

Do not use this skill when:
- The task is the underlying `sbx create`/`run`/`rm` flag-based workflow with
  no `sbxenv.yaml` involved — use `docker-sandboxes-lifecycle`.
- The task is choosing network policy or storing a secret/registry credential
  independent of any environment file — use
  `docker-sandboxes-network-credentials`. This file's `secrets:`/
  `registries:`/`bindings:` provision into that same store; do not redefine
  its rules here.
- The task is authoring, building, publishing, or signing the kit descriptor
  a `kits:` entry references, or composing kits with `sbx run --kit` flags
  and no environment file — use `docker-sandboxes-kits`. This skill only
  selects, configures, and pins kits inside an `sbxenv.yaml`.

## Core guidance

### Ground rules when writing or updating a file

- **Look up kits live, every time.** Kits, tags, and digests change daily.
  Take every kit name, tag, digest, arg, and credential from
  `scripts/kits.py` in the current run — never from memory, an earlier
  conversation, or the examples in this skill. If Docker Hub is unreachable
  the helper exits nonzero; say so and stop suggesting kits rather than
  guessing.
- **Pick the highest version tag, not the one pushed last.** Hub lists tags by
  last update, and a republished old release or a moving tag (`latest`,
  `edge`) can sit on top. Use `newestRelease`/`suggested` from `kits.py
  update`, which ranks dotted versions numerically. Do not write a bare
  untagged reference or `:latest` when a release tag exists.
- **Prefer v3 kits.** Search results are v3-only by default. If a file uses a
  v2 kit (often a `-kit` suffix) and a v3 sibling exists, offer the move.
- **Never write secret values.** Use `ref:` or `command:`, even if asked for a
  literal: the file is meant to be committed. A binding approves a
  credential; it never contains one.
- **Guide, don't interrogate.** Recommend a concrete choice with a one-line
  reason at each step, batch related questions, and skip what the workspace
  already answers.
- **When updating, edit in place.** Keep the user's comments, ordering, and
  formatting; change only what the user agreed to.

### The `scripts/kits.py` helper

`scripts/kits.py` ships in this skill's directory; substitute the path this
`SKILL.md` was loaded from for `<skill-dir>`. It uses only the standard
library, prints JSON, reads public repositories anonymously, and must be run
with `python3 -I`. A nonzero exit means at least one lookup failed: that entry
carries `error`, and the other entries remain valid.

| Command | Use |
|---|---|
| `kits.py search [TERM …] [--orgs a,b] [--include-v2]` | v3 kits under `sbx/` and `docker/`, ranked by pulls. Each term is a separate Hub search; no term lists the whole catalog for those orgs. |
| `kits.py describe REF … [--arg [HANDLE.]NAME=VALUE …] [--platform OS/ARCH]` | From the live descriptor: `kind`, `agent`, `handle` (what `agent:` uses), `version`, create-phase `args`, `buildArgs`, `buildSecrets`, `credentials` with a `suggestedBinding`, and `hostGrants`. Pass `--platform` for the machine that runs `sbx` if it differs from this one. |
| `kits.py update REF … [--pin]` | `suggested` = the highest version release tag (or the same moving tag), with a fresh digest when REF was pinned or `--pin` is given; also `newestRelease` and notes such as major bumps. Local and git sources are skipped. |
| `kits.py pin REF …` | `TAG@DIGEST` for the tag as written. Never changes the release. Pin a tagged reference: an untagged one comes back digest-only for whatever `latest` points to. |
| `kits.py tags REF` | Every tag with its digest, in Hub last-updated order. Inspect only; never pick a release from the top of this list. |

```bash
python3 -I <skill-dir>/scripts/kits.py search go github
python3 -I <skill-dir>/scripts/kits.py update sbx/playwright
```

### Create or update workflow

1. **Decide the mode.** `./sbxenv.yaml` exists → update. A project-level
   `./.sbxenv.yaml` is **not read** (that name is only the home-directory
   defaults file); offer to rename it to `sbxenv.yaml`. `~/.sbxenv.yaml` is
   the user's personal defaults — usually bindings and `sandboxOptions`, not
   project kits. Nothing exists → create.
2. **Create:** read only the file listing, manifests, and git remote; turn
   signals into search terms; `search` and `describe` candidates to
   shortlist; resolve each kit's `newestRelease` and `describe` that exact
   reference before configuring it; propose a composition table (kit, kind,
   tag, why); set kit and environment args from that descriptor;
   add bindings/secrets per credential; set workspace and options; ask tags
   vs tag+digest; write the file with a prerequisites header; then run the
   checks.
3. **Update:** list every `kits:` source and `agent:`; run `kits.py update`
   on all OCI references in one call; present current → suggested with
   notes; for each accepted change, `describe` old and new and reconcile
   args, credentials, host grants, `kind`, and `handle`; apply only accepted
   edits in place.

The step-by-step procedure, the workspace-signal table, credential and host
grant handling, and the final checklist are in
`references/authoring-workflow.md`. Follow it rather than improvising.

### Composition: `agent:` and `kits:`

- A composition has **exactly one workload** and any number of mixins.
  `agent:` is either a built-in agent (`claude`, `codex`, `shell`, …) or the
  name of the agent workload kit listed under `kits:` — its `handle` as
  `kits.py describe` reports it. To add tools to a built-in agent, keep the
  built-in name in `agent:` and list only mixins.
- When both `X` and `X-mixin` exist, the plain kit is the workload and the
  `-mixin` layers that agent onto another workload. Use the mixin only when
  the user wants a different base.
- A mixin's `requires` can under-declare what it needs from the workload:
  `sbx/playwright` reports `requires: []` but its install step needs Node, so
  on the bare `shell` agent creation fails (`env: 'node': No such file or
  directory`). Only a disposable `sbx env create` proves a composition; say
  so when you hand over a file you could not create.
- An entry is a bare reference or `{source, args}`. Explicit relative paths
  (`./…`, `../…`, `.`, `..`, or ending in `.zip`) resolve against the
  **declaring file's directory**; a bare `org/kit` is always a registry
  reference. Git sources use `git+https://` or `git+ssh://`; pin them for
  reproducibility with `#ref=<commit>` (plus `&dir=<subdir>` when needed).
- A published (OCI) kit accepts only its **create-phase** args. `buildArgs`
  (typically `version`) were fixed at publish time — choose another tag
  instead. `buildSecrets` are build inputs, never runtime credentials.
- Remote kit sources must match the `kit.allowedSources` setting; Docker Hub
  is allowed by default. Setting it replaces the whole allowlist.
- `--kit-arg`/`--kit-args-file` and `--env-arg`/`--env-args-file` are
  experimental flags; mention that when you rely on them.

### File resolution, merging, and user defaults

- From a directory, `sbx env` reads exactly `sbxenv.yaml`. Each `PATH`
  argument is a directory (→ `<PATH>/sbxenv.yaml`) or the file itself.
- Several paths deep-merge in order, `docker compose -f`-style: mappings merge
  by key, later scalars win, lists concatenate — **except `entrypoint` and
  `cmd`, which later files replace**, and `kits` entries naming the same
  source, which fold into one entry with their `args` merged. Each file must
  be valid on its own; a later file cannot repair an invalid earlier value.
  ```bash
  sbx env run base.sbxenv.yaml local.sbxenv.yaml
  ```
- With **no `PATH`**, `~/.sbxenv.yaml` is merged underneath the project file;
  naming any `PATH` skips it. It may not set `name:`, and its `workspace:`
  must be `${{ env.projectDir }}` or a subdirectory of it.
- `${{ env.projectDir }}` (directory of the first `PATH`, or cwd) and
  `${{ env.fileDir }}` (the declaring file's directory) plus
  `${{ env.args.NAME }}` are the only expansions. A bare `$` is literal, so
  `PATH: $PATH:/opt/bin` reaches the sandbox unchanged; `$${{ … }}` escapes.
  References cannot appear in field names or inside the `args:` block.

### Naming and workspace

- Without `name:` or `--name`, the sandbox is named
  `<agent>-<workspace-basename>`, so any two environments with the same agent
  and the same workspace directory name collide — even in different parent
  directories. Give each environment an explicit `name:` when that can
  happen. If you pass `--name`, pass the same value to every `sbx env`
  command for that environment.
- `workspace:` is the primary mount (read/write in bind mode); **omitting it
  mounts nothing**, so an agent would start without the project. The object
  form `{path: ., clone: true}` mounts the path read-only and runs the agent
  on a private clone (`--clone`/`--clone=false` override it per
  invocation). `additionalWorkspaces:` require a primary `workspace:`.

### Where the environment file lives (write protection)

- **Prefer keeping `sbxenv.yaml` outside every directory you mount** — the
  primary workspace and each `additionalWorkspaces` entry — for example beside
  the project directory with `workspace: ./web-app`. The file decides which
  lifecycle, secret, and MCP commands run on the host, so the agent must not
  be able to change it.
- If it must live inside a mount, put it **directly at the mount root**.
  `sbx` mounts env files read-only by default, but a file in a
  **subdirectory** can still be replaced: the sandbox renames the writable
  parent directory and recreates the path. `sbx env plan` calls this out;
  never claim the rename creates no gap. (One sbx v0.51.0 macOS test refused
  that rename — see `checks/runtime-results.md` — but the plan and docs
  still treat the file as unprotected, so do not rely on it.)
- `sandboxOptions.writableEnvFiles: true` lets the sandbox write its own env
  files (local only). It is a deliberate security downgrade the plan reports;
  use it only when the agent is meant to change what future invocations run
  on the host.

### `args:` — parameterizing a shared file

- Each argument needs exactly one of `default` or `required: true`, plus
  optional `description` and either `enum` or `pattern` (RE2, whole value).
- Values come only from `--env-arg NAME=VALUE` or `--env-args-file FILE`; the
  host environment is never read. An undeclared reference, missing required
  value, unknown supplied name, or failed `enum`/`pattern` is an error.
- An unquoted reference is re-read as YAML after substitution (`cpus:
  ${{ env.args.cpus }}` becomes an integer); quote it to keep a string.
- Use an environment arg for values callers vary (model, target repo, branch)
  or one value that feeds several kits; pin a project decision directly in
  the kit entry's `args:`.

### Secrets, registries, and bindings

- `secrets:` and `registries:` provision into the **same credential store** as
  `sbx secret set`, at this sandbox's scope, so `sbx env rm` removes them.
  Each source sets exactly one of `value`/`ref`/`command`; see
  `docker-sandboxes-network-credentials` for runtime semantics.
- Secret `command:` sources run on the host from a fresh temporary directory
  and run whenever the secret is needed, even with `--skip-host-commands`.
  Use absolute helper paths and keep helpers outside writable mounts.
- `bindings:` merge into the user's **global** `credentials.yaml` and survive
  `sbx env rm` unless `--prune-bindings` is passed — which deletes the whole
  global entry for each declared service, possibly affecting other sandboxes.
  Bind only the mechanism (`apiKey` or `oauth`) the user will actually use.
- A literal `value:` appears only as a `sha256:` digest in the plan and state,
  but the file itself still holds the plaintext. Use `ref:` or `command:`;
  the plan shows where such a secret comes from, never its resolved value.
  ```yaml
  # OPTIONAL fragment — add only if this environment needs the credential.
  secrets:
    anthropic:
      ref: op://Private/Anthropic/api-key   # never a literal `value:`
      refresh: 55m
  ```

### `lifecycle:` — host commands

- Commands run **on the host, outside the sandbox, with your privileges**,
  through the user's shell, from the project directory unless `workdir:` is
  set. Within a phase they run in order and stop at the first failure. They
  receive `SBX_LIFECYCLE_PHASE`, `SBX_ENV_FILE(S)`, `SBX_ENV_DIR`,
  `SBX_SANDBOX_NAME`, `SBX_AGENT`, and `SBX_WORKSPACE`, but **not** the file's
  `env:` values or resolved secrets.
  - **`initialize`** — before anything else, on **every** `create` and `run`,
    including a run that attaches to an existing sandbox. It must be
    idempotent.
  - **`postCreate`** — once, after a new sandbox is created and before
    attachment; not on reattach.
  - **`preRemove`** — after removal is approved, before deletion. A failure is
    only a warning. Afterwards `sbx` rebuilds the destroy plan and stops if the
    commands introduced changes the approval did not cover.
  ```yaml
  lifecycle:
    initialize:
      - command: test -d app || git clone https://github.com/acme/app
    postCreate:
      - command: ./scripts/seed-fixtures.sh
  ```
- Kits own what runs inside the sandbox; use `lifecycle` only for host-side
  preparation and teardown.

### The plan and approval

- `sbx env plan [PATH...]` prints what applying would change outside the
  sandbox — host commands, credentials, bindings, MCP registrations,
  directories, kits, ports, options, and variables — compared with what was
  last applied and approved. **It changes, approves, and records nothing.**
  It also does not resolve kit references: an invented kit or a missing tag
  plans cleanly. `describe` every OCI reference at the exact tag you write
  before trusting a clean plan.
  Margin symbols: `+` add, `~` change, `-` destroy, `>` run a host command
  again, `!` stop tracking without deleting.
- `create`, `run`, and `rm` show their plan and ask for approval. Interactive
  approval is recorded; a later plan with no host commands applies silently
  until something changes or a resource is missing.
- Plans with lifecycle commands, credential command sources, or local MCP
  commands are asked about on **every** invocation by default, even when
  unchanged. `sbx settings set env.rememberHostCommands true` asks again only
  when the commands change — never enable it for commands you have not
  reviewed.
- `-f`/`--force` approves one `create`/`run` without recording consent (on
  `rm` it also deletes a sandbox in use). Use it for reviewed, trusted files
  in automation only — **never for untrusted pull-request content**, because
  the plan's host commands run with the runner's privileges.
- `--skip-host-commands` skips lifecycle commands and disables the
  environment's local MCP commands until a later `env run` without it;
  credential command sources still run.
- If `sbx env run` reports a sandbox that "agrees with everything this
  environment declares" but "nothing was done", its environment state was
  lost. Rerun `sbx env run` interactively with the same paths and name and
  confirm adoption only for the intended sandbox; `--force` never confirms
  adoption, so automation needs this done interactively first.

### `env exec` and updating an existing environment

- `sbx env exec [PATH...] -- COMMAND` runs no lifecycle commands for an
  existing sandbox. If the sandbox is missing, it offers to create it only in
  an interactive terminal (with the normal approval and lifecycle); with
  non-interactive stdin or `--no-input` it fails (exit 125) — run
  `sbx env create` first.
- On an existing sandbox, `sbx env run` applies changed `env` values and
  reconciles MCP servers, and `entrypoint`/`cmd` take effect on each run.
  Changes to workspaces, kits, kit host mounts, ports, secrets, bindings, and
  `sandboxOptions` apply only on the next creation: `sbx env rm`, then create
  again.

### `mounts:`, `ports:`, `mcp:`, `entrypoint`/`cmd`, and `sandboxOptions:`

These map onto kit host mounts, `sbx ports --publish`, MCP gateway
registrations, the agent launch argv, and `sbx create` options. Exact field
shapes, defaults, and what `sbx env rm` leaves behind for each are in
`references/env-schema-fields.md`.

## Related skills

- For the `sbx create`/`run`/`rm` flag-based workflow this file wraps, use
  `docker-sandboxes-lifecycle`.
- For what `secrets:`/`registries:`/`bindings:` mean at runtime, and for
  network policy independent of any environment file, use
  `docker-sandboxes-network-credentials`.
- For authoring, building, publishing, or signing the v3 kit descriptor a
  `kits:` entry references, use `docker-sandboxes-kits`.

## References

- `references/authoring-workflow.md` — step-by-step create and update
  procedure, workspace-signal table, credential and host-grant handling, and
  the final checklist.
- `references/env-schema-fields.md` — every top-level field, its shape and
  defaults, with YAML examples.
- `references/sources.md` — provenance for the rules above.

## Assets

- `assets/sbxenv.yaml` — a complete, minimal, safe example: a `shell` agent
  mounting the declaring file's own directory, one static env var, and no
  credentials — it validates and plans without onboarding authentication.
  It sits at its mount root; for real projects prefer a file outside the
  mounts.

## Scripts

- `scripts/kits.py` — live Docker Hub kit search, descriptor summary,
  version-ordered update, and digest pinning for `kits:` entries. Run with
  `python3 -I`; it only reads public registries.

## Checks

- `checks/verification.md` — verification runbook for the helper and
  `sbx env` behavior (run manually with an isolated, uniquely named
  `--app-name` signed in for the run, never with real secret values or
  untrusted lifecycle commands force-approved).
- `checks/runtime-results.md` — recorded results of that runbook on sbx
  v0.51.0 (macOS arm64), including what the plan does not check.
