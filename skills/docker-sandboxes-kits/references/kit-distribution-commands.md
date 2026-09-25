# Kit distribution and inspection commands: full reference

Source-verified against docker/sandboxes commit
`df5c96ba60484fa2c375469dbac912c205da6c37` and help captured from installed
`sbx v0.42.0-503-g951b7f6d7` (commit `951b7f6d7f6bb260fac15077b607109ffe8ae012`); no source-only
CLI-flag differences were found against the pinned-source `docs/yml/
sbx_kit_*.yaml` reference. `sbx kit` is EXPERIMENTAL.

## `sbx kit validate REFERENCE [flags]`

Validates a local directory, ZIP, or git repository; OCI references are
rejected. A kit with required
arguments needs the same `--kit-arg` values `sbx create` would need, or it
reports unresolved arguments rather than a false pass.

**This checks the kit's own schema well-formedness only** — it never
composes the kit against a base agent, so it cannot catch a
duplicate-service credential collision (see SKILL.md's `kind: sandbox` vs
`kind: mixin` section) or confirm any domain is actually reachable at
runtime; both require actual composition via `sbx create --kit`/`sbx run
--kit`, followed by a policy check. `kit inspect` never composes a mixin
against a base.

Flags: `--json`, `--kit-arg`, `--kit-args-file`.

## `sbx kit inspect REFERENCE [flags]`

Loads and prints the decoded artifact **before** composing it into any
sandbox: use it to confirm a kit's declared credentials, network rules, and
setup commands look right, or to preview how a parameterized kit resolves
with specific `--kit-arg` values (the output shows the substituted
content). For a local kit with `extends:`, inspection prints the declared
parent, not its resolved inherited image; create/run performs that resolution.

```bash
sbx kit inspect ./my-mixin/ --kit-arg version=1.2.3
```

Flags: `--json`, `--kit-arg`, `--kit-args-file`.

## `sbx kit pack DIRECTORY [flags]`

Packages a validated directory (with its `spec.yaml` and optional `files/`)
as a ZIP.

Flags: `-o`/`--output` (default `<name>.zip`).

## `sbx kit pull REFERENCE [flags]`

Pulls a kit artifact from an OCI registry and saves its raw layer payload to
a file (`.zip` for `schemaVersion: "1"`, `.tar.gz` for `"2"`) without
composing it into a sandbox — use it to inspect or archive a published
kit's exact bytes. Authentication prefers an `sbx secret set --registry`
credential, falling back to the Docker credential store.

```bash
sbx kit pull ghcr.io/org/my-mixin:1.0
```

Flags: `-o`/`--output`.

## `sbx kit push DIRECTORY REGISTRY/REPO:TAG [flags]`

Packages and pushes; every push also attaches an **unsigned-by-default**
SLSA provenance attestation naming the kit's content digests, declared
image, and source git commit. Pass `--sign` for a Sigstore-signed manifest
(keyless by default; `--key` for key-based).

Flags: `--sign`, `--key`, `--identity-token`, `--identity-token-file`,
`--tlog-upload` (default `true`).

## `sbx kit provenance REFERENCE [flags]`

Prints the SLSA provenance attestation `sbx kit push` attached to an OCI
kit. Printed as-is and marked **UNSIGNED** unless it was pushed with
`--sign` and you pass matching `--key` (key-based) or
`--certificate-identity`/`--certificate-oidc-issuer` (keyless) here — only
then is it reported **VERIFIED**. Use this before trusting an unfamiliar
published kit's declared source commit and image.

```bash
sbx kit provenance ghcr.io/org/my-mixin:1.0 \
  --certificate-identity user@example.com \
  --certificate-oidc-issuer https://accounts.google.com
```

Flags: `--json`, `--key`, `--certificate-identity`,
`--certificate-identity-regexp`, `--certificate-oidc-issuer`,
`--certificate-oidc-issuer-regexp`, `--insecure-ignore-tlog`.

## `sbx kit sign REFERENCE [flags]` / `sbx kit verify REFERENCE [flags]`

Sign or verify a local directory (writes/checks a `kit.sig.bundle`
sidecar) or an OCI kit (attaches/checks a Sigstore bundle as an OCI
referrer). Prefer `--identity-token-file` over `--identity-token` for
keyless signing — the latter is visible in process args and shell history.

Flags (sign): `--key`, `--identity-token`, `--identity-token-file`,
`--tlog-upload`.
Flags (verify): `--key`, `--certificate-identity`,
`--certificate-identity-regexp`, `--certificate-oidc-issuer`,
`--certificate-oidc-issuer-regexp`, `--insecure-ignore-tlog`, `--json`.

## `sbx kit add SANDBOX REFERENCE [flags]`

Injects a **mixin** (only) into an **existing** sandbox at runtime,
recreating its container while preserving kit-owned volumes and the
workspace mount/clone state. The sandbox must have been created with the
recreate-aware label set — an older sandbox is refused with a clear error,
not silently degraded. Container-immutable settings
(`security.privileged`, any `volumes:`) in the added kit cannot take effect
on a running container — recreate the sandbox with the mixin at creation
time instead.

Flags: `--kit-arg`, `--kit-args-file`.
