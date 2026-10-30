# Sources

## Local pinned source (vendored spec package in repository docker/sandboxes, commit df5c96ba60484fa2c375469dbac912c205da6c37)

Paths below are relative to the repository root.

- `vendor/github.com/docker/sbx-kits-contrib/spec/types.go` — `Manifest`,
  `Security`, `MountSpec`/`MountType`, `Resources`, `BuildConfig`,
  `NetworkPolicy` (v1 legacy), `PublishedPort`, `Credential`/`ApiKey`/
  `ApiKeyInject` (including `Scheme` sugar field and its doc comment),
  `Requires`, `KitArg`, `EnvironmentPolicy`, `CommandsPolicy`/
  `InstallCommand`/`StartupCommand`/`InitFile`, `ArtifactFile`, `Artifact`
  (canonical model), `OAuth`/`OAuthTokenEndpoint`/`OAuthSentinels`/
  `OAuthCredentialFile`, `SchemaVersion` constant ("1" default) and
  `SupportedSchemaVersions` (`["1","2"]`), `KindSandbox`/`KindAgent`/
  `KindMixin` constants, `TargetHome`/`TargetWorkspace`.
- `vendor/github.com/docker/sbx-kits-contrib/spec/v2.go` — `specFileV2`
  (clean v2 grammar), `sandboxBlockV2`, `agentInstructionsBlockV2`,
  `permissionsBlockV2`/`networkBlockV2`, `resourcesV2`, `setupBlockV2`,
  `commandFieldV2` (polymorphic decode), `toArtifact` (v2 -> canonical
  Artifact mapping, including the `sandbox.build` requires-image
  actionable-error path and the `mixins:` not-implemented warning),
  `expandCredentialSchemes` (the `scheme: bearer`/`basic` sugar expansion
  and its mutual-exclusivity-with-`format` check).
- `vendor/github.com/docker/sbx-kits-contrib/spec/validate.go` —
  `ValidateManifest`/`validateManifest` (name pattern, template-required
  for sandbox unless `inheritsImage`), `ValidateArtifact` (full enforcement
  order: security, volumes, requires, mixin-must-not-extends-on-v2,
  locked, licenses, args, publishedPorts, environment, commands,
  credentials service-required, oauth structural checks, files
  target/path-escape checks) — note `ValidateArtifact` never checks
  cross-kit composition (duplicate services, effective network policy);
  it validates one artifact's own schema only. `ValidateRequires`
  (mixin-only, rejected on sandbox), `ValidateArgs`/`KitArg.ValidateValue`
  (enum XOR pattern, whole-value pattern anchoring), `ValidateOAuth`
  (sentinels required unless passthrough).
- `vendor/github.com/docker/sbx-kits-contrib/spec/SPEC-v2.md` — normative
  v2 grammar reference: §2 common fields + `args`, §3 `kind: sandbox`
  (sandbox block, entrypoint/command effective-argv table, extends,
  mixins, complete example), §4 `kind: mixin` (field table, agent
  instructions progressive-disclosure model, `requires`, complete
  examples), §5 shared blocks (agentInstructions, permissions.network
  entry-format enforcement table and all-egress-declared rule, ports,
  credentials apiKey/oauth including scheme sugar table, environment
  reserved prefixes, setup command-shape table and user-model defaults,
  volumes and the ext4 sizing rationale, files/ directory rules), §6
  validation summary, §7 composition & distribution (the immutable-pinning
  MUST is stated for `extends:`/`mixins:`/`--kit` remote references at the
  spec-document level; whether the CLI's own reference parser enforces it
  is a separate, implementation-level question — see
  `sandboxlib/kit/resolve.go` below), §9 runtime environment (user model,
  write surface, tool floor, architectures, injected env vars, lifecycle).
- `sandboxlib/kitpolicy/kitpolicy.go` (NOT `sandboxlib/kit/kitpolicy/
  kitpolicy.go` — corrected path) — `kit.allowedSources`,
  `kit.allowLocalKits`, `kit.requireSignature`, `kit.trustedSigners`,
  `kit.ignoreTransparencyLog`, `kit.allowExtractedAgents` settings that
  govern which kit sources/signatures a daemon accepts.
- `sandboxlib/kit/resolve.go` — `ResolveReference` (the actual `--kit`/
  `sbx kit *` reference parser): resolves a directory, ZIP, `oci://`
  prefix, bare `registry/repo:tag`, or `git+https://`/`git+ssh://` URL with
  an optional `#ref=...&dir=...` fragment. **No pinning is enforced by this
  parser** — a mutable OCI tag or an unpinned git ref/branch resolves the
  same as a digest- or SHA-pinned one; the "MUST be pinned" language lives
  only in SPEC-v2.md §7 for the `extends:`/`mixins:` fields inside
  `spec.yaml` itself.
- `sandboxlib/kit/allowlist.go` — `AllowlistConfig.Check`/`Vouches` (the
  daemon-side allowlist gate on remote/local kit sources — a separate
  concern from spec-level pinning; it restricts WHICH remote hosts a kit
  may come from, not whether the reference is pinned).
- `sandboxlib/kit/inject.go` — `InjectKit`/`injectArtifactContent`
  (environment/files/install/init-files/startup order for `sbx kit add`),
  warning printed for a kit whose `security.privileged`/`volumes` cannot
  apply to a running container ("Recreate the sandbox with this mixin at
  creation time to apply these settings"); `injectInitFiles`/
  `buildInitFileShellCmd` confirm `commands.initFiles`/`setup.files` are
  written via shell exec — a mechanism distinct from the static `files/`
  tree's `injectFiles` (base64/atomic-rename write, not a shell command).
- `sandboxlib/kit/kitargs.go` — `--kit-arg`/`kit.name=value` scoping syntax,
  `ErrKitArgUndeclared`/`ErrKitArgUnused` distinction (author bug vs.
  caller error).
- `sandboxlib/agentkits/agents/claude/spec.yaml` — real-world v2 sandbox
  kit example: `permissions.network.allow` full list, block volumes with
  explicit `size:` and the same ext4-sizing rationale comment, `apiKey`
  (explicit `header`/`format`, no scheme sugar) + `oauth` (with
  `template:` credentialFile, not `structure:`) on the same `anthropic`
  credential, `setup.install`/`setup.startup` ordering and idempotency
  comments, `agentInstructions.filename: CLAUDE.md` + `content`.
- `sandboxlib/agentkits/agents/shell/spec.yaml`,
  `sandboxlib/agentkits/agents/docker-agent/spec.yaml`,
  `sandboxlib/agentkits/agents/opencode/spec.yaml` — confirmed each
  declares its own `credentials: - service: github` entry, which is the
  concrete evidence for this skill's duplicate-service composition-failure
  rule: a mixin re-declaring `service: github` would collide with any of
  these three built-in base agents.

## Reviewer's throwaway schema harness (this session, no source modifications, no stateful sbx commands)

- The reviewer built a `-tags filestore` schema-loading harness against the
  pinned source to check both original example kit YAMLs structurally. Both
  loaded and validated (schema-only), but composing the ORIGINAL
  `spec-mixin.yaml` (which declared its own `service: github` credential)
  against the `shell` base agent failed with a duplicate-service
  composition error — demonstrating exactly why `sbx kit validate`/schema
  loading is not sufficient evidence of composability, which is why this
  skill now states that distinction explicitly and the shipped mixin asset
  declares no credentials at all.

## Captured standalone CLI help, cross-checked against an older installed build

Installed `sbx` reports `v0.42.0-503-g951b7f6d7` (commit
`951b7f6d7f6bb260fac15077b607109ffe8ae012`), older than the pinned source
HEAD. Verified with `sbx <cmd> --help` under an isolated `--app-name`, no
daemon started. No source-only CLI-flag differences were found for the
`sbx kit` commands this skill covers.

- `sbx kit --help` — EXPERIMENTAL banner, subcommand list.
- `sbx kit add --help` — recreate-aware label requirement, volume/workspace
  preservation across the swap container, `--kit-arg`/`--kit-args-file`.
- `sbx kit inspect --help` — decoded-artifact preview, `--kit-arg`
  substitution preview.
- `sbx kit pack --help` — directory-to-ZIP packaging, requires a valid
  `spec.yaml`.
- `sbx kit validate --help` — directory/ZIP/git reference validation,
  required-argument `--kit-arg` requirement.
- `sbx kit pull --help`/`sbx kit push --help` — schemaVersion-to-artifact-
  format mapping (`"1"` -> legacy ZIP, `"2"` -> OCI tar+gzip layer +
  manifest-config metadata), authentication precedence (sbx registry
  secrets over Docker credential store), provenance attachment on every
  push.
- `sbx kit sign --help`/`sbx kit verify --help` — keyless (Fulcio+Rekor)
  vs. key-based signing, `--identity-token-file` preferred over
  `--identity-token`, `--tlog-upload=false` for private kits requiring a
  timestamp authority, `.sig.bundle` sidecar for local directories.
- `sbx kit provenance --help` — SLSA provenance attachment as an OCI
  referrer, UNSIGNED-by-default reporting, keyless/key-based verification
  flags.

## Not verified / explicitly excluded

- No claim is made that `mixins:` (author-time composition) is applied by
  the runtime this release — the vendored source (`v2.go`'s `toArtifact`,
  the `w.notImplemented("mixins", ...)` warning) and `SPEC-v2.md` §3.5 both
  state it is schema-accepted only; this skill states that explicitly
  rather than implying it works.
- `SPEC-v2.md`'s network enforcement table is stale for CIDR and `**.`
  wildcards. The runtime implementation below takes precedence. Port
  ranges are not matched as ranges; exact ports are supported.
- No docs.docker.com URL beyond the canonical product page
  (https://docs.docker.com/ai/sandboxes/) is cited here: this review did
  not independently fetch a dedicated kit-spec docs page, so no more
  specific URL is asserted as a source for any rule above. Every rule
  above traces to a repository path and/or a captured `--help` output.

## Runtime implementation cross-checks

At docker/sandboxes commit `df5c96ba60484fa2c375469dbac912c205da6c37`:
- `sandboxd/pkg/server/options_governance.go` — `ApplyKitNetworkPolicyScoped`
  passes kit entries to `local.NetworkRule` without filtering CIDR or globs.
- `vendor/github.com/docker/governor-lib/internal/authorization/v2/rule_spec.go`
  — `lowerSpec` detects CIDR prefixes; other entries become domain rules.
- `vendor/github.com/docker/governor-lib/internal/authorization/definitions/allowlist/v0/matching.go`
  — `MatchDomain` supports multi-label `**` globs; `matchCIDR` checks prefix
  containment; `portsEqual` compares exact ports, not ranges.
- `sandboxd/pkg/proxy/engine_governance.go` — the `net:endpoint` request
  carries domain then resolved-IP identifiers. A decisive domain allow
  precedes a CIDR deny, as documented in `docs/yml/sbx_policy_deny.yaml`.
- `sandboxlib/kit/resolve.go` — artifact references, not built-in agent names.
- `sandboxlib/agentkits/resolver.go` and `sandboxlib/kitpolicy/kitpolicy.go` — built-in-only parent resolver; remote `extends` is not implemented.
- `sandboxlib/kit/compose.go` — additive routing-only credentials, duplicate definitions, and rejection of mixin OAuth.
- `sandboxlib/kit/signing/keys.go` — `loadPrivateKey`/`loadPublicKey`
  require ECDSA P-256 PEM keys; `readSecretFile` rejects private keys
  accessible to group/others. The local signing eval generates ephemeral
  keys outside the artifact with `umask 077`.
- `sandboxlib/kit/signing/signing.go` — `signWithKey`/`verifyWithKey` use
  the supplied keys without Fulcio, Rekor, or an OIDC token; key-based
  verification checks the signed artifact against the bundle.
- `AGENTS.md` — OpenAI OAuth precedence during provisioning; no universal API-key-first rule.
