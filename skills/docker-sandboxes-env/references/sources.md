# Sources

## Local pinned source (repository docker/sandboxes, commit df5c96ba60484fa2c375469dbac912c205da6c37)

Paths below are relative to the repository root.

- `sandboxlib/sbxenv/types.go` — `Config` struct: `SchemaVersion` (only
  `"1"` supported — `SupportedSbxEnvVersions`), `Name`, `Args`, `Agent`,
  `Kits`/`KitEntry`, `Workspace`/`WorkspaceSpec` (bare-string-or-mapping
  shorthand, `clone`, the `declared` flag distinguishing "omitted" from
  "blank"), `AdditionalWorkspaces`, `Env`, `SandboxOptions` (including
  `WritableEnvFiles` doc comment: "Each file a mount would otherwise hand
  over read-write is bound read-only at its own path instead..."),
  `Secrets`/`SecretSource` (exactly one of value/ref/command),
  `Bindings`, `Registries`/`RegistrySource`, `MCP`/`MCPServer`,
  `Ports`/`PortBinding`, `Lifecycle`. `Validate()`/`validateWorkspaces()` —
  confirms omitting `workspace:` mounts nothing, a blank path is rejected,
  and `additionalWorkspaces` requires a primary `workspace:`.
- `sandboxlib/sbxenv/loader.go` — `DefaultFileName` (`sbxenv.yaml`, the only
  name read from a directory), `UserBaseFileName` (`.sbxenv.yaml`, home-only
  base layer), `LoadMergedWithOptions` doc comment (docker-compose `-f`
  merge semantics: mappings merge key-by-key, sequences concatenate,
  scalars overridden by the last file), `rejectProjectIdentity`/
  `rejectEscapedUserBaseWorkspace` (base layer may not set `name:`, and its
  `workspace:` must resolve at-or-below the project directory),
  `anchorWorkspacePaths`/`anchorKitSources` (relative workspace and kit
  paths resolve against the **declaring file's own directory**), `${{
  env.projectDir }}` / `${{ env.fileDir }}` expansion.
- `sandboxlib/sbxenv/lifecycle.go` — `LifecyclePhase` constants
  (`initialize`, `postCreate`, `preRemove`) and their doc comments: phase
  ordering, "initialize runs before anything is resolved... on both a
  create and an attach... must be idempotent", `postCreate` "runs once the
  sandbox exists", `preRemove` "runs before sbx env rm deletes the
  sandbox... sbx env exec runs no commands at all"; `LifecycleCommand`
  (`Name`, `Command` run via `sh -c`/`cmd /c`, `Workdir` default =
  project directory, `Timeout`).
- `cli-plugin/commands/env_lifecycle.go` — `envContext.teardown` warns on
  a failed `preRemove`, then calls `recheckDestroy` and `recheckSandbox`
  before deletion. The failure itself is not fatal; drift from the approved
  destroy plan or replacement of the sandbox is.
- `cli-plugin/commands/env_plan_test.go` —
  `TestTeardown_ACommandThatFailedIsNotADeadEnd` verifies warning-only hook
  failure; `TestRecheckDestroy_SomethingThatAppearedAfterTheAnswer`,
  `TestTeardown_WhatAPreRemoveCommandLeftBehind`, and
  `TestTeardown_ASandboxReplacedWhileTheCommandsRan` verify the
  post-approval credential/binding/identity guards stop deletion.
- `sandboxlib/sbxenv/args.go` — `Args` map, `argNamePattern`, the
  distinction between author bugs (`ErrArgSyntax`, `ErrArgUndeclared`) and
  caller errors (`ErrArgUnresolved`, `ErrArgInvalid`, `ErrArgUnused`); "A
  bare `name` with no `=` is rejected rather than resolved from the host
  environment the way `--env-file` does" (confirms args never read the
  ambient host environment implicitly).
- `cli-plugin/commands/env_plan.go` — `valueFingerprint` and
  `secretSourceFields` replace literal secret values with full `sha256:`
  digests in both the displayed plan and recorded state.
- `cli-plugin/commands/env_plan.go` — `reachedEnvFile` (`root` field:
  whether the file sits directly at the mount's own directory, "where a
  read-only bind of it cannot be worked around: the mount point is the one
  directory in the tree the sandbox cannot rename"), `envFileMounts`
  (excludes only a file that is both read-only AND at the mount root — a
  file protected read-only in a *subdirectory* is still reported, because
  "Nothing in the sandbox can rename a mount point" is true only at the
  root), `envContext.lifecycleResources` and `planOptions.unspoken` (a
  lifecycle-declaring file's commands are named in the plan every
  invocation that reaches them).
- `cli-plugin/commands/env_plan_render.go` — `renderWritableFiles`/
  `renderEnvFileReach` (exact two-case wording: "mounted read-write into
  the sandbox... an agent in it can change what a later invocation of this
  environment runs here" vs. "mounted read-only, inside a directory the
  sandbox can rename: ... renaming it puts the file back where an agent
  can change what a later invocation runs here" — the read-only-at-root
  case is not rendered at all, since `envFileMounts` excludes it),
  `renderHostCodeNotice` (`askedAgain` case: "nothing in this env plan has
  changed but commands run on this machine, outside the sandbox, with your
  own privileges which requires explicit approval on each run" — confirms
  declared lifecycle commands are asked about every invocation regardless
  of whether anything changed; the non-`askedAgain`, no-host-code path
  implies a plan with nothing to add and no lifecycle commands has nothing
  new to say).

## Captured standalone CLI help, cross-checked against an older installed build

Installed `sbx` reports `v0.42.0-503-g951b7f6d7` (commit
`951b7f6d7f6bb260fac15077b607109ffe8ae012`), older than the pinned source
HEAD. Verified with `sbx <cmd> --help` under an isolated `--app-name`, no
daemon started. The generated help text is long-form prose and matches the
pinned-source doc comments above closely enough that no source-only schema
difference was found for the fields this skill covers.

- `sbx env --help` (matches `docs/yml/sbx_env.yaml` at the pinned commit) —
  full narrative description: file resolution rules, `kits:` bare-vs-mapping
  shorthand and relative-path anchoring, `workspace:` resolution and naming
  derivation, the complete `lifecycle:` phase description, the full
  environment-plan rendering model (`+`/`~`/`-`/`>`/`!` margin symbols,
  literal `value:` secrets rendered as `sha256:` digests in state),
  `sandboxOptions.writableEnvFiles`, `--auto-approve`/`-y`,
  `env.rememberHostCommands` setting.
- `sbx env create --help`/`sbx env run --help`/`sbx env plan --help`/
  `sbx env exec --help`/`sbx env rm --help` — per-command flags:
  `--env-arg`, `--env-args-file`, `--kit-arg`, `--kit-args-file`, `--name`,
  `--skip-host-commands`, `--clone` (create/run/plan only, overrides
  `workspace.clone`), `-d/--detached` (`env run` ONLY — `env create` and
  `env plan` do not have this flag), `--prune-bindings` (rm only); `env
  exec`'s `[PATH...] -- COMMAND` argument-splitting rule, and its own text
  stating the sandbox "must already exist" — `env exec` never creates one.

## Not verified / explicitly excluded

- No claim is made about a stable, non-experimental future schema version;
  at the pinned commit `schemaVersion: "1"` is the only supported value
  (`sandboxlib/sbxenv/types.go`, `SupportedSbxEnvVersions`).
- No docs.docker.com URL beyond the canonical product page
  (https://docs.docker.com/ai/sandboxes/) is cited here: this review did
  not independently fetch a dedicated `sbxenv.yaml` docs page, so no more
  specific URL is asserted as a source for any rule above. Every rule above
  traces to a repository path and/or a captured `--help` output.
