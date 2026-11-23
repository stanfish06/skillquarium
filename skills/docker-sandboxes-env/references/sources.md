# Sources

| Source | Version / date | Used for |
|---|---|---|
| [Docker Docs: Sandbox environment files](https://docs.docker.com/ai/sandboxes/configuration/environment-files/) | Retrieved 2026-11-10 | Primary public reference: commands, file placement and protection, merging and user defaults, directory and argument expansion, every field table, lifecycle timing and variables, plan symbols and approval, `--force`, `--skip-host-commands`, `env.rememberHostCommands`, `env exec` creation, update/recreate rules, removal, cloud limits, `kit.allowedSources`. |
| Installed `sbx env`, `env create/run/plan/exec/rm --help` | sbx v0.51.0 (`7d55286de0c775148b985ed349f760f1eba06203`) | Flags (`-f/--force`, `-d/--detach`, `--skip-host-commands` on plan/create/run/rm, `--prune-bindings`, `--no-input`, `--cloud`), `env exec` exit status 125, derived name, list concatenation. |
| docker/sandboxes `sandboxlib/sbxenv/types.go`, `sandboxlib/kit/git.go` (internal repository, not publicly verifiable) | `7d55286de0c775148b985ed349f760f1eba06203` (the v0.51.0 build) | Cross-check of the complete key set, `sandboxOptions` disk-size and `nested` keys, `<agent>-<workspace-basename>` default, and the `git+…#ref=…&dir=…` kit source shape. |
| [docker/sandbox-kit-spec `skills/sbxenv`](https://github.com/docker/sandbox-kit-spec/tree/75b2696a80163497b0d0d1cd73d3fb7ccaa050fe/skills/sbxenv) | `75b2696a80163497b0d0d1cd73d3fb7ccaa050fe` | Adapted authoring workflow (`references/authoring-workflow.md`), kit handle rules, and `scripts/kits.py`, copied from SHA-256 `1ca05d5ff22734f7d7c8e07bf6e26ede2d1fd9f0f9e99f425eb8116fba0e05b8` with one local change: `pin` and pinned `update` fail when the registry returns no digest instead of reporting an unpinned reference. |

## Limitations

- `sbx env` and schemaVersion `"1"` are experimental; no stable schema is
  claimed.
- `scripts/kits.py` was exercised against live Docker Hub on 2026-11-10
  (`search`, `describe`, `update`, `pin`, missing-repository and
  connection-failure exits) with Python 3.9. Its output depends on the live
  catalog; nothing in this skill pins kit versions. Offline release-order,
  pin, and failure-exit behavior is tested by `scripts/test_kits_helper.py`.
- Known helper limits, inherited from the source: it does not
  check the scheme of server-provided URLs (auth realm, pagination,
  redirects); it classifies any reference ending in `.zip` as local; and
  date-style numeric tags would outrank dotted releases.
- The `checks/verification.md` runbook was run once on sbx v0.51.0, macOS
  arm64 (results in `checks/runtime-results.md`); repository validation does
  not execute it. The live scenario `evals/scaffold-pin-plan.yaml` runs in CI.
