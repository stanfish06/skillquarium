# nfcore-scrnaseq-wrapper — Changelog

All notable changes to the `nfcore-scrnaseq-wrapper` ClawBio skill are documented
here. The format roughly follows [Keep a Changelog](https://keepachangelog.com)
and the wrapper version is tracked in `SKILL.md` YAML frontmatter.

## [Unreleased] — 0.1.0

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
