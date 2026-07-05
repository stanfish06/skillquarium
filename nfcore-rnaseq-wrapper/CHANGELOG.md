# nfcore-rnaseq-wrapper — Changelog

All notable changes to the `nfcore-rnaseq-wrapper` ClawBio skill are documented
here. The format roughly follows [Keep a Changelog](https://keepachangelog.com)
and the wrapper version is tracked in `SKILL.md` YAML frontmatter.

## [Unreleased] — 0.1.0

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

- **Detected Java/Nextflow versions preserve zero-padded components in reports.**
  The version string shown in `report.md` and `result.json` was reconstructed from
  the integer comparison tuple, so `int("04") = 4` turned `26.04.3` into `26.4.3` —
  not a real Nextflow release, and inconsistent with `manifest.json`, which kept the
  correct string. `_check_java`/`_check_nextflow` now record the version exactly as
  reported by the tool (via `_detected_version_string`) for display, using the
  integer tuple only for the minimum-version comparison. Parity with
  nfcore-scrnaseq-wrapper (which already did this) and nfcore-sarek-wrapper.
- **Config-parse failures now point at `NXF_OFFLINE`.** On Nextflow 26.x the
  nf-core `nextflow.config`'s `includeConfig ... ? <url> : '/dev/null'` line fails
  to parse when the remote `nfcore_custom.config` cannot be fetched. The executor's
  `EXECUTION_FAILED` fix now detects `Unable to parse config file` /
  `ConfigParseException` and suggests `NXF_OFFLINE=true` for a fully local run (or
  confirming outbound HTTPS/DNS). Shared verbatim across the three wrappers.

- **`EXPECTED_OUTPUTS_NOT_FOUND` now explains an all-skipped run.** nf-core/rnaseq
  drops samples below `min_trimmed_reads` (schema default 10000) before
  quantification, so a run with only tiny inputs completes "successfully" yet
  produces no merged count matrix — which the wrapper correctly flags. When the
  captured log shows nf-core "completed with skipped sample(s)", the error fix now
  points at `--min-trimmed-reads` (and the MultiQC/pipeline_info skipped-sample
  report) instead of leaving the cause unexplained. Diagnosed from the actual log
  signal, so it only appears when relevant.
- **`result.json` carries the shared `ok`/`status` contract.** A successful run's
  envelope now includes `status: "ok"` and `ok: true`, and a failed run includes
  `status: "error"` alongside the existing `ok: false` — a minimal discriminator
  shared with nfcore-sarek/scrnaseq. Implemented via opt-in `status`/`ok`
  parameters on the shared `clawbio.common.report.write_result_json` helper, so
  the ~40 other skills that use it are unaffected (the keys appear only when a
  caller passes them).

- **`clawbio run rnaseq-pipeline` now forwards `-c`/`--config` Nextflow config
  files.** The launcher (`clawbio/cli.py`) accepted `-c`/`--config` but forwarded
  only `--nextflow-config`, silently dropping configs supplied with the short or
  `--config` spelling. The three spellings are now a single repeatable option and
  every entry is forwarded as `--nextflow-config` (which the wrapper accepts as an
  alias), so config files reach Nextflow regardless of spelling.
- **`--timeout-hours` and `--allow-pipeline-version-override` are now forwardable.**
  Both are real wrapper flags (and were already exposed for the sibling pipelines)
  but were absent from the launcher allowlist, so the extra-args filter dropped
  them before they reached the wrapper. `--allow-pipeline-version-override` is also
  recorded as value-free so the filter cannot consume the following token.
- **Output directory inside the repository now raises the dedicated
  `OUTPUT_DIR_INSIDE_REPO` code** instead of the misleading
  `OUTPUT_DIR_NOT_WRITABLE` (which implied a permissions problem), matching
  nfcore-sarek and nfcore-scrnaseq.
- **`--demo` under `NXF_OFFLINE` now fails fast with a clear message.** Demo mode
  runs nf-core's upstream `-profile test`, whose FASTQs and references are remote
  GitHub URLs; on an offline/sandboxed host the nf-schema plugin previously aborted
  with a cryptic `does not exist`. Preflight now detects `NXF_OFFLINE` + demo and
  raises `DEMO_REQUIRES_NETWORK` with an actionable fix. Docs (SKILL.md, AGENTS.md)
  clarify that `--demo` downloads only nf-core public test data — no user/genetic
  data is uploaded — so it is compatible with the local-first guarantee.
- **macOS + Docker `/tmp` guard is now accurate and robust (demo-mode parity).**
  The preflight warning previously said output under `/tmp` "may be slow or
  unreliable due to VirtioFS behavior", which mis-describes the actual failure:
  Colima does not share `/tmp` into its VM, so a `/tmp` work-dir hard-fails with
  `.command.run: No such file or directory`. The warning now states the real
  cause and fix (move `--output` under HOME), uses a resolve-based
  `is_under_tmp` check (shared in `schemas.py`) instead of a brittle string
  prefix, and the executor appends the same actionable hint to `EXECUTION_FAILED`
  — matching nfcore-sarek and nfcore-scrnaseq.
- **nf-core-native snake_case flag spellings are now accepted via the launcher.**
  nf-core parameters are snake_case (`--gene_bed`, `--transcript_fasta`, …) while
  the wrapper exposes them as hyphenated flags. A user copying an upstream nf-core
  command previously had the token silently dropped by the launcher's INT-001
  allowlist filter, which matches exact (hyphenated) tokens. `clawbio run
  rnaseq-pipeline` now canonicalises `_`↔`-` when matching the allowlist and
  forwards the wrapper's canonical hyphen spelling (which its parser already
  accepts). Scoped to the three nf-core pipeline skills; other skills keep
  exact-match filtering.

### Added

- **Environment post-failure hints on `EXECUTION_FAILED`.** When a run fails, the
  executor scans the captured Nextflow logs and appends an actionable hint if it
  finds a known environment signature — diagnosed from the actual error text, so no
  resource thresholds are invented. `Process requirement exceeds available memory`
  (nf-core's default request larger than the host, e.g. `MAKE_TRANSCRIPTS_FASTA`)
  yields a hint to cap resources via a `-c` config using `process.resourceLimits`;
  `Network is unreachable` / a Java connection exception (common on IPv6-only /
  NAT64 hosts, where the JVM prefers IPv4) yields a hint to verify outbound
  DNS/HTTPS and to set `NXF_OPTS='-Djava.net.preferIPv6Addresses=true'`. Shared
  verbatim across the three wrappers.
- **`--allow-remote-inputs` opt-in (local-first by default).** Remote samplesheet
  inputs and reference paths (`s3://`, `gs://`, `https://`, `ftp://`, …) are now
  rejected at preflight (`REMOTE_INPUT_NOT_ALLOWED`) unless the flag is passed, in
  which case a runtime warning names every path fetched over the network. The
  object-store `--work-dir` is not gated. Shared verbatim with
  `nfcore-scrnaseq/sarek`.
- **Control-flag parity with the sibling wrappers.** Added `--work-dir` (Nextflow
  work directory override; accepts a local path or an object-store URI for cloud
  executors; was hardcoded to `<output>/upstream/work`) and `-c`/`--config` as
  aliases of `--nextflow-config`. The executor/command-builder now accept a
  `Path | str` work dir so remote URIs pass through verbatim.

### Changed

- **`--timeout-hours 0` now disables the wall-clock cap** (was rejected at
  preflight). The default still applies a 12h cap; `0` is an explicit opt-out for
  long HPC/cloud runs — parity with `nfcore-scrnaseq/sarek`. `_resolve_timeout_seconds`
  returns `int | None`, the executor accepts `None`, negative values are still
  rejected, and the macOS compatibility config falls back to the default ceiling
  when the cap is disabled. A `[provenance]` stage log was added so all three
  wrappers share the identical stage-prefix set.

### Added

- **Order-independent test suite (shared mechanism).** `tests/conftest.py` now
  also carries the canonical-object bare-module isolation block shared verbatim
  with the sibling wrappers (in addition to this skill's existing per-file
  guards), so the cross-skill isolation mechanism is identical across all three.
- **Converged CLI presentation with the sibling wrappers.** Added a startup
  banner (`--no-banner`), `-v/--verbose`, and sarek-style staged progress logs
  (`[preflight]`/`[execute]`/`[outputs]`/`[report]`/`[done]`) plus a
  human-readable boxed error on stdout — while keeping the machine-readable JSON
  error on stderr and `result.json` on disk. `--verbose`/`--no-banner` are
  registered in the `clawbio.py` runner allowlist and the replay-drift guards.
- **Robust `main()` entrypoint.** `main()` now returns exit code `130` on
  `KeyboardInterrupt` (the SIGINT convention) instead of letting the interrupt
  propagate as a traceback. Matches `nfcore-sarek-wrapper` and
  `nfcore-scrnaseq-wrapper`.

### Notes

- This wrapper is the reference implementation for the cross-wrapper
  **input-readability policy**: the launcher never pre-checks FASTQ/BAM
  readability (`os.access(R_OK)`) because Nextflow reads the data in the true
  execution context (often a root container under the default Docker profile),
  where a launcher-side probe would false-block valid runs. Existence is
  validated (`MISSING_FASTQ`); readability is deferred to Nextflow staging. The
  rationale is documented inline in `errors.py`.
