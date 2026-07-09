# nfcore-scrnaseq-wrapper — Changelog

All notable changes to the `nfcore-scrnaseq-wrapper` ClawBio skill are documented
here. The format roughly follows [Keep a Changelog](https://keepachangelog.com)
and the wrapper version is tracked in `SKILL.md` YAML frontmatter.

## [Unreleased] — 0.1.0

### Added

- **Bundle `remap_paths.py` gains `--repair-bundle` (crash-recovery parity).** The
  shipped standalone `remap_paths.py` can now regenerate the three regenerable
  reproducibility-bundle files — `checksums.sha256` (recomputed from the current
  bundle contents), and post-hoc `manifest.json` / `environment.yml` stubs (marked
  `regenerated_post_hoc: true`) — if the wrapper crashed mid-post-processing and
  left them missing. This matches the `nfcore-rnaseq-wrapper` / `nfcore-sarek-wrapper`
  bundles, which already shipped `--repair-bundle`; scrnaseq was the only one
  without it. `checksums.sha256` is regenerated stdlib-only over **exactly the
  wrapper's original checksum allowlist** — the normalized samplesheet, `params.yaml`,
  `logs/stdout.txt` / `logs/stderr.txt`, the h5ad candidates (canonical
  `*/mtx_conversions/` matrices at both nesting depths, else a full-tree fallback),
  and the MultiQC report — reconstructed from the bundle on disk so a repaired manifest
  is byte-identical to one `provenance.write_reproducibility_checksums` would write. The
  `reproducibility/` provenance JSON tree, `commands.sh`, the `environment.yml` /
  `manifest.json` stubs, other `upstream/results` outputs, and non-`stdout/stderr` logs
  are deliberately excluded, matching the original manifest (labels are relative to the
  output directory so `sha256sum -c` passes). A self-contained `_write_text_lf`
  (mirroring the sibling bundles) keeps the regenerated files LF-only on every OS.
  Recompute is triggered **only when `checksums.sha256` itself is missing**, so an
  existing valid manifest is never silently overwritten when merely a stub is
  regenerated. `--output-dir` and the `--output`-based resume warning are deliberately
  **not** added: scrnaseq's `commands.sh` self-anchors to the bundle location via
  `BASH_SOURCE`, so the output path never needs patching.

### Documentation

- **`--allow-remote-inputs` semantics clarified.** SKILL.md now states explicitly
  that the flag relaxes only the wrapper's own local-first preflight check: remote
  FASTQ/reference URIs are written into the normalized samplesheet/`params.yaml`
  verbatim and staged natively by Nextflow at run time. The wrapper does not
  download them, so remote inputs require outbound network access and are
  incompatible with `NXF_OFFLINE` (under which Nextflow's own nf-schema file-existence
  validation still runs and fails on the remote paths). Shared wording across the
  three wrappers.

### Fixed

- **`save_align_intermeds` no longer carries an invented `default: true` in the
  contract.** nf-core/scrnaseq 4.1.0's `nextflow_schema.json` declares no default for
  `save_align_intermeds` (an opt-in boolean, false when unset — same as
  `save_reference`); the `OFFICIAL_PARAMS` contract wrongly recorded `default: True`.
  The annotation was reference-only (never emitted to `params.yaml`, which the wrapper
  writes only for user-supplied flags, and never used for validation), so no run was
  affected — but it misrepresented the upstream schema. Corrected to `{"type":
  "boolean"}` and the contract test now asserts the upstream reality (no `default` key).
- **`params.yaml` now carries the explanatory header the sibling wrappers emit.**
  `serialize_params_yaml` wrote a bare `yaml.dump`, so the bundled `params.yaml`
  lacked the three-line comment header that nfcore-rnaseq / nfcore-sarek prepend
  (noting that `input`/`outdir` are relative to the Nextflow launch directory and
  pointing at `reproducibility/commands.sh` for replay). It now emits the same header,
  adapted to nf-core/scrnaseq. YAML comments do not affect parsing, the reference-path
  remapper, or the bundle checksum round-trip.
- **A `protocol` samplesheet column is no longer flagged as unrecognised.**
  nf-core/scrnaseq 4.1.0's `schema_input.json` does not define a `protocol` column,
  but the pipeline's own example samplesheet (`assets/samplesheet.csv`) ships one,
  so a user copying it was warned that `protocol` is an unrecognised column. It is
  now recognised (and preserved as before). The effective protocol is still taken
  from the `--protocol` flag — a global pipeline parameter, not a per-sample column
  — and the "explicit protocol required" preflight error now says so explicitly, so
  a user with a `protocol` column knows to pass `--protocol` as well.
- **Config-parse failures now point at `NXF_OFFLINE`.** On Nextflow 26.x the
  nf-core `nextflow.config`'s `includeConfig … ? <url> : '/dev/null'` line fails to
  parse when the remote `nfcore_custom.config` cannot be fetched. The executor's
  `EXECUTION_FAILED` fix now detects `Unable to parse config file` /
  `ConfigParseException` and suggests `NXF_OFFLINE=true` for a fully local run (or
  confirming outbound HTTPS/DNS). Shared verbatim across the three wrappers.
- **Remote reference URIs are no longer corrupted in `params.yaml`.** With
  `--allow-remote-inputs`, a remote `--fasta`/`--gtf`/`--transcript-fasta`/index
  URI (`https://`, `s3://`, `gs://`, `ftp://`, …) was resolved as a local path by
  `params_builder`, collapsing the scheme and anchoring it to the working
  directory (`https://host/x` → `<cwd>/https:/host/x`), which nf-core then rejected
  during parameter validation. Reference fields now preserve URIs verbatim (via a
  new `_posix_or_uri` helper, mirroring `igenomes_base` and the FASTQ handling) and
  only resolve genuinely local paths. Remote references are still gated behind
  `--allow-remote-inputs` at preflight and staged by Nextflow.
- **CellBender failures now point at `--skip-cellbender`.** `CELLBENDER_REMOVEBACKGROUND`
  estimates ambient RNA from the droplet-count distribution and errors on very small
  or test datasets (`IndexError: index -100 is out of bounds`). When it is the
  failing process, the `EXECUTION_FAILED` fix now explains that CellBender is optional
  and can be skipped with `--skip-cellbender` so the rest of the pipeline finishes.
  Diagnosed from the actual log signal, so it only appears when relevant.
- **`--demo` no longer reports `Samples: 0`.** The reported sample count trusted a
  local samplesheet count of `0` instead of falling back to the samples detected
  in the outputs. Under `--demo` the upstream `-profile test` supplies samples
  remotely (so the local count is 0) while the run still produces real samples;
  the count now uses a positive local count when present and otherwise falls back
  to `samples_detected`.
- **`result.json` carries the shared `ok`/`status` contract.** A successful run's
  envelope now includes `status: "ok"` and `ok: true`, and a failed run includes
  `status: "error"` alongside the existing `ok: false` — a minimal discriminator
  shared with nfcore-sarek/rnaseq (via the opt-in `status`/`ok` parameters on the
  shared `write_result_json` helper).

- **`clawbio run scrnaseq-pipeline` now forwards `--nextflow-config`.** The launcher
  (`clawbio/cli.py`) forwarded only `-c`/`--config`, silently dropping configs
  supplied via `--nextflow-config`. All three spellings are now a single repeatable
  option, normalised and forwarded as `--nextflow-config` (the wrapper accepts them
  as aliases).
- **Output directory inside the ClawBio source tree is now rejected** at preflight
  with the dedicated `OUTPUT_DIR_INSIDE_REPO` code, matching nfcore-rnaseq and
  nfcore-sarek. Previously this wrapper alone permitted writing multi-gigabyte
  pipeline outputs into the repository checkout.
- **`--demo` under `NXF_OFFLINE` now fails fast with a clear message.** Demo mode
  runs nf-core's upstream `-profile test`, whose FASTQs and references are remote
  GitHub URLs; on an offline/sandboxed host the nf-schema plugin previously aborted
  with a cryptic `does not exist`. Preflight now detects `NXF_OFFLINE` + demo and
  raises `DEMO_REQUIRES_NETWORK` with an actionable fix. Docs (SKILL.md, AGENTS.md)
  clarify that `--demo` downloads only nf-core public test data — no user/genetic
  data is uploaded — so it is compatible with the local-first guarantee.
- **nf-core-native snake_case flag spellings are now accepted via the launcher.**
  nf-core parameters are snake_case while the wrapper exposes them as hyphenated
  flags. A user copying an upstream nf-core command previously had the token
  silently dropped by the launcher's INT-001 allowlist filter, which matches exact
  (hyphenated) tokens. `clawbio run scrnaseq-pipeline` now canonicalises `_`↔`-`
  when matching the allowlist and forwards the wrapper's canonical hyphen spelling
  (which its parser already accepts). Scoped to the three nf-core pipeline skills;
  other skills keep exact-match filtering.
- **Environment post-failure hints on `EXECUTION_FAILED`.** When a run fails, the
  executor scans the captured Nextflow logs and appends an actionable hint on a
  known environment signature — diagnosed from the actual error text, so no
  resource thresholds are invented. `Process requirement exceeds available memory`
  yields a hint to cap resources via a `-c` config using `process.resourceLimits`;
  `Network is unreachable` / a Java connection exception (common on IPv6-only /
  NAT64 hosts, where the JVM prefers IPv4) yields a hint to verify outbound
  DNS/HTTPS and set `NXF_OPTS='-Djava.net.preferIPv6Addresses=true'`. Shared
  verbatim across the three wrappers.

### Changed

- **Remote input/reference URIs are gated behind `--allow-remote-inputs`
  (local-first by default).** Samplesheet FASTQs and reference/index paths must
  be local unless the flag is passed; otherwise preflight rejects remote URIs
  (`s3://`, `gs://`, `https://`, `ftp://`, …) with `REMOTE_INPUT_NOT_ALLOWED`, so
  the "keeps processing local / prevents accidental cloud access" guarantee is
  enforced by the code. With `--allow-remote-inputs` (a flag shared by all three
  nf-core wrappers), remote values pass through verbatim — only the basename is
  validated, existence is deferred to Nextflow staging — and preflight emits a
  runtime warning naming every path fetched over the network. Local paths are
  always existence-checked (`MISSING_FASTQ` / `MISSING_REFERENCE`). Resolved FASTQ
  values are `Path | str` so remote URIs are written unchanged to the normalized
  samplesheet and provenance (no `Path().as_posix()` `//`-collapse).
- **SKILL.md frontmatter aligned to the canonical `SKILL-TEMPLATE` schema** so the
  machine catalog (`skills/catalog.json`) and the generator never drift: the
  `trigger_keywords` list now lives under `metadata.openclaw` (was a bare
  `metadata.trigger_keywords` key) and a `metadata.demo_data` entry was added.
  Matches `nfcore-sarek-wrapper` and `nfcore-rnaseq-wrapper`.
- **Validation philosophy unified with the sibling wrappers.** The launcher-side
  `os.access(R_OK)` FASTQ readability pre-check was removed: the wrapper never
  reads FASTQ data — Nextflow does, often inside a root container under the
  default Docker profile — so a launcher-side readability probe can false-block
  valid runs. Existence and regular-file type are still validated; readability is
  deferred to Nextflow's staging in the true execution context. A path that
  exists but is not a regular file now raises `MISSING_FASTQ` (was
  `FASTQ_NOT_READABLE`). Mirrors `nfcore-rnaseq-wrapper`'s documented policy.

### Changed

- **Logging consistency**: added a dedicated `[provenance]` stage line so all
  three wrappers emit the identical stage-prefix set.
- **Config-flag parity**: `--nextflow-config` is now accepted as an alias of
  `-c`/`--config`, so the same custom-config flag names work across all three
  wrappers.

### Added

- **Order-independent test suite.** `tests/conftest.py` now claims this skill's
  bare modules (`errors`, `schemas`, …) via a canonical-object cache — at
  collection and before each test — so a single `pytest` session that also
  collects the sibling wrapper suites (e.g. `make test`) no longer hits
  cross-skill module shadowing. Shared verbatim across all three wrappers.
- **Converged CLI presentation with the sibling wrappers.** Added a startup
  banner (`--no-banner`), `-v/--verbose`, and sarek-style staged progress logs
  (`[preflight]`/`[execute]`/`[outputs]`/`[report]`/`[done]`) plus a
  human-readable boxed error on stdout — while keeping the machine-readable JSON
  error on stderr (a robust fallback that survives a failed `result.json` write)
  and `result.json` on disk as the machine contract. `--verbose`/`--no-banner`
  are registered in the `clawbio.py` runner allowlist.
- **Robust `main()` entrypoint.** `main()` now accepts an explicit `argv` list
  (unit-testable without mutating `sys.argv`) and returns exit code `130` on
  `KeyboardInterrupt` (the SIGINT convention) instead of dumping a traceback.
  Matches `nfcore-sarek-wrapper` and `nfcore-rnaseq-wrapper`.

### Removed

- Dead `ErrorCode.FASTQ_NOT_READABLE` constant (no longer referenced after the
  readability-precheck removal) and the now-unused `import os` in
  `samplesheet_builder.py`.
