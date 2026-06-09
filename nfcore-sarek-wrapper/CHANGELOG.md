# nfcore-sarek-wrapper — Changelog

All notable changes to the `nfcore-sarek-wrapper` ClawBio skill are documented
here. The format roughly follows [Keep a Changelog](https://keepachangelog.com)
and the wrapper version is tracked in `SKILL.md` YAML frontmatter.

## [Unreleased] — 0.1.0

### Added

- `result.json` now carries a `samples_detected` field (the samples parsed from
  the actual upstream outputs) alongside the existing input-derived `samples`.
  In `--demo` the `test` profile supplies the samplesheet remotely, so `samples`
  is `[]` while the run still produces sample `test`; surfacing both keeps the
  machine-readable marker honest about what was actually processed.
- `remap_paths.py` now remaps reference/index paths in `params.yaml`
  (`--refs-old/--refs-new`), not just `commands.sh`. For nf-core/sarek the
  references (`--fasta`, `--dbsnp`, `--pon`, …) live in `params.yaml`, so this
  makes a bundle fully portable across machines/OSes in one command (data via
  `--old/--new`, references via `--refs-old/--refs-new`, then `--verify`). URIs,
  the `false` disable sentinel, and glob patterns are left untouched; `--verify`
  now also checks the params.yaml reference paths. The key list is kept in sync
  with `provenance.REFERENCE_PATH_PARAMS` by a parity test.

### Fixed

- Preflight now validates cheap, environment-independent input (step, aligner,
  enumerated params, required-tools-for-step, and unknown `--tools` tokens) BEFORE
  probing the container backend. Previously a typo'd `--step`/`--tools`/enum with the
  backend down surfaced `BACKEND_UNAVAILABLE` instead of the actionable input error.
  The unknown-tools check was extracted to `_check_tools_known` (called early and still
  self-guarded inside `_check_tools_against_pairing`); the backend probe still runs for
  valid input.
- The `mutect` profile is now rejected outside `--demo`. In 3.8.1 it only pulls in
  `conf/test_mutect2.config`, whose sole effect is forcing Mutect2's
  `--normal-sample normal` — a value valid only for the upstream test dataset. The
  wrapper previously exposed `--mutect-profile` (and the `mutect` token in `--profile`)
  as a general modifier with no guard, so a real somatic paired run whose normal was
  not named `normal` would be silently mislabelled. `_validate_wrapper_flags` now
  raises `INVALID_FLAG_COMBINATION` when `mutect` is composed without `--demo`; the
  CLI help and the `schemas.py` profile-token comment now describe it as test-data-only.
- The report's annotation table now links snpEff's stats HTML. In sarek 3.8.1
  the snpEff module runs `-csvStats <prefix>.csv` but passes no `-stats <prefix>`,
  so snpEff emits its summary under the default constant name `snpEff_summary.html`
  (in `reports/snpeff/<caller>/<sample>/`). The parser previously searched only for
  `<stem>_snpEff.html` / `<stem>_snpEff.ann.summary.html`, leaving the HTML column
  blank; it now also matches `snpEff_summary.html`, scoped to the per-sample report
  directory so it never leaks across samples. Verified on a live `--tools strelka,snpeff` run.
- The report's per-caller "Variant count" no longer counts all-sites gVCF /
  genome VCF records. When a caller emits both a called-variants VCF and a gVCF
  (Strelka `genome.vcf.gz`; HaplotypeCaller/DeepVariant/Sentieon `.g.vcf.gz`),
  `_best_variant_count` now deprioritises the gVCF — preferring a filtered call
  set, then the raw called VCF — so e.g. Strelka reports its 8 called variants
  instead of the 190 gVCF reference blocks. Falls back to the gVCF only when no
  other VCF is present.
- Execution logs (`stdout.txt`/`stderr.txt`) are now written under
  `reproducibility/logs/` instead of a stray top-level `logs/` directory, so the
  output root keeps to exactly two children (`upstream/`, `reproducibility/`) as
  documented. The whole `reproducibility/` tree is excluded from
  `checksums.sha256`, so logs no longer leak into the manifest.
- The macOS Docker compatibility config is now written to
  `reproducibility/macos_docker.config` (previously the output root).
- On error, the `result.json` marker is now written to
  `reproducibility/result.json` (falling back to the output root only if the
  bundle directory cannot be created), so the output root keeps to two children
  on failure paths too.
- `--demo` now also clears a user-supplied `--igenomes-ignore` (and any
  reference-path/genome keys passed through the `--extra-param` escape hatch).
  Previously `igenomes_ignore=true` (a boolean flag) and reference extras could
  leak into `params.yaml` in demo mode and break the upstream `test` profile,
  contradicting the "demo clears all reference flags" contract.
- Output-structure docs clarified: besides the two ClawBio children
  (`upstream/`, `reproducibility/`), Nextflow itself writes hidden `.nextflow/`
  and `.nextflow.log` in the launch dir (`= output_dir`, required so relative
  `input`/`outdir` resolve). Both are excluded from `checksums.sha256`. Verified
  against a live `--demo` run.
- Documentation flag-count corrected to a consistent **173** (154 Sarek
  passthrough + 19 wrapper controls) in README.md and CLAUDE.md; SKILL.md's
  "154 passthrough" was already correct. A regression test now locks these counts.
- A bare `--profile test` (no `--demo`, no `--input`) is recognised as a demo
  run before the input requirement is enforced, so it no longer fails with
  `MISSING_INPUT`. Profile-flag syncing now runs before wrapper-flag validation.
- `remap_paths.py._regenerate_checksums` now mirrors
  `provenance.py._iter_checksum_paths` exactly (excluding `work/`, `.nextflow/`,
  `reproducibility/`, `logs/`, and `.log` files), so `sha256sum -c` still
  verifies after a cross-machine remap. It previously hashed a divergent file
  set and referenced the removed top-level `logs/` and `provenance/` paths.

### Added

- Initial release of the wrapper around nf-core/sarek 3.8.1.
- 6-step orchestration: `mapping → markduplicates → prepare_recalibration →
  recalibrate → variant_calling → annotate`.
- Coverage for germline, tumor-only, and somatic paired analyses across the
  28 `--tools` tokens (variant/CNV/SV/MSI callers plus SnpEff / VEP / bcftools /
  merge annotation).
- Strict preflight (Java 17+, Nextflow >=25.10.2, profile composition,
  reference-path existence, annotation cache layout, flag compatibility,
  resume-manifest drift).
- 25 profiles supported (containers + arm64 + gpu + spark + mutect + 10 test
  variants).
- Reproducibility bundle: `params.yaml`, `samplesheet.valid.csv`,
  `commands.sh`, `manifest.json`, `checksums.sha256`, `environment.yml`,
  `pipeline_source.json`, `parameters.json`, `samplesheet.json`,
  `outputs.json`, `tool_versions.json`, `compatibility_policy.json`,
  `remap_paths.py`.
- Opt-in downstream handoff (`--run-downstream --downstream-skill <name>`)
  for `clinical-variant-reporter`, `clinical-trial-finder`,
  `omics-target-evidence-mapper`, `wes-clinical-report-en`,
  `wes-clinical-report-es`.
- The runtime floor now matches Sarek 3.8.1's official
  `manifest.nextflowVersion = '!>=25.10.2'` requirement.
- Provenance collects tool versions from the workflow-emitted
  `nf_core_sarek_software_mqc_versions.yml`, retaining compatibility with the
  generic `software_versions.yml` name shown in rendered output documentation.
- `varlociraptor` now requires a selected variant caller that supplies its
  candidate-variant input stream, as required by Sarek post-variant processing.
- Annotation routes now reject tools that `VCF_ANNOTATE_ALL` cannot execute at
  `--step annotate`, and require an upstream VCF-producing caller when
  annotators are selected from an earlier processing step.
- The preflight snapshot now carries direct CLI values for
  `only_paired_variant_calling`, `normalize_vcfs`, `concatenate_vcfs`, ASCAT
  purity/ploidy and `vep_custom_args`, so validations operate on the same
  effective parameters that are emitted to `params.yaml`.
- `varlociraptor` is now rejected with `filter_vcfs`, `normalize_vcfs`,
  `snv_consensus_calling`, or `concatenate_vcfs`, because upstream
  `POST_VARIANTCALLING` executes the Varlociraptor branch instead of those
  bcftools transformations when it is selected.
- `filter_vcfs` / `normalize_vcfs` now require at least one official
  `small_variantcallers` source, and `concatenate_vcfs` requires an effective
  germline VCF stream; requests that would publish no transformed output are
  rejected before execution.
- ClawBio integration: `python clawbio.py run sarek-pipeline ...` with full
  per-skill allowlist for 154 sarek passthrough flags + wrapper-only modifiers
  (174 long flags total).

### Verified aligned with nf-core/sarek 3.8.1

- All 25 profile names match `nextflow.config` verbatim.
- All 6 `--step` enum values match `nextflow_schema.json`.
- All 28 `--tools` and 15 `--skip-tools` enum tokens match the upstream regex.
- 5 `--aligner` choices match.
- 42 `--genome` (iGenomes) keys exact-mirror `conf/igenomes.config`.
- 47 reference-path params validated in preflight.
- Samplesheet schema fields (patient, sample, sex, status, lane, fastq_1/2,
  spring_1/2, bam, bai, cram, crai, table, vcf, variantcaller, contamination)
  match `assets/schema_input.json`.
- `--bcftools-filter-criteria` accepts free-form bcftools expressions
  (matches upstream default `-f PASS,.`).
- `--cf-window` accepts decimal values (upstream type `number`).
- `--freebayes-filter` typed as a string vcflib/vcffilter expression (upstream
  type `string`, default `"30"`) — accepts expressions like `QUAL > 20`.
- Output discovery mirrors all documented paths under
  `<outdir>/preprocessing/`, `<outdir>/variant_calling/`,
  `<outdir>/annotation/`, `<outdir>/reports/`, `<outdir>/pipeline_info/`,
  plus the documented `<outdir>/csv/` handoff (5 CSVs including
  `markduplicates_no_table.csv`), with legacy `<outdir>/preprocessing/csv/`
  fallback support.
- ASCAT auxiliary outputs (`metrics.txt`, `_tumourBAF.txt`,
  `_tumourLogR.txt`) captured.
- Mutect2 auxiliary outputs (`contamination.table`, `segmentation.table`,
  `pileups.table`, `artifactprior.tar.gz`, unfiltered VCF) captured.
- Manta tumor-only output (`tumor_sv.vcf.gz`) captured.
- MSIsensorPro output directory matched to `variant_calling/msisensorpro/`.
- Sentieon caller filename suffix (`.haplotyper`, `.dnascope`, `.tnscope`)
  resolved via `_VCF_SUFFIX`.
- ASCAT manual-purity override now enforces the official
  `ascat_purity`-requires-`ascat_ploidy` dependency before execution.
- Strelka pairing validation follows the executable `3.8.1` workflow
  (`STRELKA_GERMLINE` plus somatic Strelka); the usage-page caller matrix
  omits its executable germline branch.

### Documented gotchas

- ASCAT for WES emits the upstream warning recommending custom alleles/loci/loci_gc/loci_rt resources.
- Mutect2 without `--pon` (any mode) or `--germline_resource` produces unreliable calls (warning).
- GATK MarkDuplicates Spark cannot perform header/positional UMI deduplication
  (`--umi-in-read-header` or `--umi-location`).
- iGenomes auto-fills `genome: 'GATK.GRCh38'` unless `--igenomes-ignore` is set.
- Somatic mode requires same-`patient` rows with `status=0` AND `status=1`.
- `--demo` clears every reference flag; `--profile test*` / `test_full*`
  trigger demo cleanup automatically.
- `--resume` is rejected on manifest drift (step, aligner, tools, profile,
  arm/gpu/spark, params/samplesheet checksums).
- `arm64` profile implicitly enables Wave (needs outbound network).
- Sentieon callers/aligner need `SENTIEON_LICENSE` env var.

### Fixed (schema/output alignment audit)

- Samplesheet validation no longer rejects cross-row `sex` / `status` /
  `contamination` differences for one sample beyond Sarek's documented and
  executable checks; pairing inference now deduplicates by `(sample, status)`
  exactly as `samplesheet_to_channel/main.nf` does.
- Omitted `genome` now resolves to Sarek's official `GATK.GRCh38` default in
  preflight, while explicit `--genome null` / YAML-null custom-reference
  configurations still disable iGenomes.
- Azure `az://` resource and samplesheet URIs are now treated as remote paths,
  matching Sarek's official annotation-cache URI recognition; unsupported
  `azure://` is no longer accepted as a remote-path alias.
- `bbsplit` mapping runs now require either a pre-built index or FASTA list,
  and `ngscheckmate` runs require its SNP BED unless an official iGenomes
  bundle supplies it, matching the channels consumed by Sarek 3.8.1.
- iGenomes-backed warnings now report Sarek's effective default genome
  (`GATK.GRCh38`) instead of an omitted wrapper parameter.
- ASCAT preflight retains the `ascat_genome` requirement described by the
  official schema and consumed as `genomeVersion` by the ASCAT module, in
  addition to the archive checks in `samplesheet_to_channel`.
- Spark output compatibility now rejects only the executable conflict
  (`save_mapped` together with `save_output_as_bam`), and VCF filtering accepts
  the official omitted `bcftools_filter_criteria` default (`-f PASS,.`).
- Provenance, reports, output parsing and resume drift now record/compare the
  effective upstream defaults `step=mapping` and `aligner=bwa-mem` when those
  optional parameters are omitted from `params.yaml`.
- Partial iGenomes reference overrides remain allowed: Sarek's official usage
  guide documents replacing an individual reference file while keeping the
  selected `--genome` bundle. Passing `--fasta` no longer implicitly forces
  `--igenomes-ignore`; wholly custom runs still use the documented
  `--genome null --igenomes-ignore --fasta` form.
- The official `false` reference sentinel is preserved for first-class
  reference flags and is not incorrectly restored from iGenomes during
  preflight; `--extra-param` now overrides a supplied base `--params-file`.
- Mutect2 preflight now evaluates effective inherited PON/germline resources;
  `GATK.GRCh38` reports the bundled generic PON recommendation rather than
  incorrectly reporting that no PON exists.
- Downstream runs without `--input` now resolve Sarek's official CSV handoffs
  (`mapped.csv` through `variantcalled.csv`), validate them, and submit the
  normalized sheet as `input`; explicit `input_restart` is handled the same
  way because Sarek v3.8.1 overwrites that schema field internally.
- Steps and tools supplied by `--params-file` or `--extra-param` are resolved
  before input validation, so downstream handoff retrieval is not incorrectly
  rejected as an input-less `mapping` run.
- Remote `--input` samplesheets are now staged with `nextflow fs cp` before
  wrapper validation, matching the HTTPS samplesheets used by Sarek's official
  `test_full*` profiles while retaining cloud URI support through Nextflow.
- `freebayes_filter` retyped from integer to string (vcflib/vcffilter expression).
- `cf_ploidy` reclassified as a string param (schema type `string`, default `"2"`)
  so comma-separated ploidy lists like `"2,3,4"` are preserved.
- Strelka no longer forced to tumor mode — runs germline (single sample) and
  somatic (tumor/normal pair), matching upstream.
- `--genome null`/`none` sentinels no longer counted as an active iGenomes genome.
- `step`/`tools` supplied via `--params-file` now reach samplesheet validation
  (previously validated as `mapping`).
- `patient-sample-status-lane` uniqueness now enforced for every step (sarek
  validates it before step branching), not just `mapping`.
- `--snv-consensus-calling` maps the public `mpileup` tool token to its emitted
  `bcftools` VCF caller and includes `sentieon_tnscope`; only the internal
  `samtools` pileup stream used by ControlFREEC is excluded upstream.
- `--vep-phenotypes` permits VEP's automatic data download and only requires an
  index for a supplied gzipped phenotype file; `bcftools_columns` is validated
  as a path.
- LoFreq output discovery accepts both the rendered output-guide form
  `lofreq/<sample>/<tumorsample>.vcf.gz` and the executable
  `conf/modules/lofreq.config` form `<tumorsample>.lofreq.vcf.gz`; CNVkit files globbed by sample prefix so tumor/normal pairs and the
  plain `.cns` vs `.call.cns`/`.bintest.cns` variants are not missed/misclassified;
  Strelka germline `genome.vcf.gz` captured.
- Tool×mode validation is now evaluated against the SET of per-patient modes
  present, not a single global mode: mixed samplesheets (germline-only patients
  + tumor/normal pairs) are accepted, with each tool allowed when at least one
  patient matches its required mode (matches sarek's per-patient processing).
- `snpeff`/`merge` require `--snpeff_db` when an iGenomes genome is not active;
  with iGenomes selected, the database may be sourced from its genome config.
- SnpEff database validation also applies to `--download_cache` /
  `--build_only_index`, because the upstream cache download consumes
  `snpeff_db`.
- Interval validation follows the published `v3.8.1` parameter schema:
  `.bed` or `.interval_list` are accepted, with WES remaining BED-only.
- Output discovery now records the documented Parabricks preprocessing
  directory and the executable `sentieon_consensus` directory emitted when
  Sentieon consensus deduplication is enabled.
- Pair reporting follows Sarek's tumor/normal `cross()` behavior, and output
  discovery records the BAM/CRAM conversion directories published by its configs.
- MuSE result parsing now preserves its documented `.MuSE.txt` call table in
  addition to the compressed VCF.
- User-supplied `varlociraptor_scenario_*` inputs are resolved, validated, and
  included in provenance because Sarek consumes them with `Channel.fromPath`.
- Local `outdir_cache` values are converted to absolute paths before launch so
  Nextflow's output-directory working directory cannot redirect cache output.
- Relative resource paths loaded through `--params-file` are canonicalised
  before launch because this wrapper executes Nextflow from its output directory.
- `known_indels`/`known_indels_tbi` now honour their official
  `file-path-pattern` contract, including deterministic provenance for matches;
  existing reference/cache directories are no longer labelled as missing.
- Mapping-specific UMI incompatibility checks are no longer applied to restart
  runs from later steps, matching `samplesheet_to_channel/main.nf`.
- Joint germline runs now surface Sarek's non-blocking warning when VQSR
  resources or required intervals are absent.
- `--snv-consensus-calling` now requires `--normalize-vcfs`, matching the
  upstream workflow guard.
- Germline callers accept tumor/normal cohorts because Sarek routes the normal
  member through germline calling; they are rejected only when no normal
  sample is present.
- `mpileup` accepts tumor/normal cohorts for that same executable reason:
  Sarek calls its normal member through `BAM_VARIANT_CALLING_GERMLINE_ALL`.
- Sex checks for ASCAT, ControlFREEC and Varlociraptor mirror Sarek's
  `input_sample.map` guard and reject `NA` on every supplied sample row when
  any of those tools is selected.
- ASCAT validation now includes its required `ascat_genome`, while
  MSIsensorPro no longer requires a precomputed scan because Sarek generates
  one from the FASTA when absent; an iGenomes-supplied scan is now reported as
  inherited instead of incorrectly reported as newly generated.
- Mutect2 now warns about a missing `--pon` in ANY mode (not only tumor-only)
  and additionally warns about a missing `--germline_resource`, matching sarek.
- `indexcov` is rejected when combined with `--wes`: both variant-calling
  workflows guard it with `params.wes == false`, so accepting that combination
  would request an output Sarek never executes.
- `merge` annotation output suffix corrected to `_snpEff_VEP` (was `_merge`) and
  `bcfann` to `_BCF` (was `_bcf`); annotation suffixes are matched longest-first
  so a merge VCF is not mis-detected as a plain VEP output.
- Annotation outputs are now discovered recursively under
  `annotation/<variantcaller>/<sample_or_pair>/` (the real sarek 3.8.1 layout),
  not just one level below `annotation/`.
- SnpSift annotation output (`_snpSift.ann`) is now parsed and validated
  (`snpsift` added to the annotator set).
- VEP cache layout check corrected to `${vep_species}${suffix}/${vep_cache_version}_${vep_genome}`
  (where `${suffix}` is `_merged` or `_refseq` when requested), per the Sarek
  cache-initialisation workflow and usage documentation — no more
  false "cache layout" warnings.
- `lane` is validated against the schema pattern `^\S+$` (whitespace rejected).
- `--umi_read_structure` is validated against fgbio read-structure grammar at
  preflight (e.g. `8M2S+T`, `+T +T`), instead of failing late in Nextflow.
- DragMap aligner without `baserecalibrator` in `--skip_tools` now emits sarek's
  recommended warning.
- Enumerated pass-through params are validated at preflight: `--umi-location`,
  `--group-by-umi-strategy`, `--vep-out-format`, `--ascat-genome`,
  `--publish-dir-mode`, and `--use-gatk-spark` tokens.
- SnpEff QC reports discovered at `reports/snpeff/` (lowercase, per
  conf/modules/annotate.config) — the previous `reports/SnpEff/` lookup missed
  them on case-sensitive filesystems; the capitalised variant is still accepted
  as a fallback. Added `reports/sentieon_dedup/` to the QC report inventory.
- Preprocessing parsing now captures the `mapped/` CRAM/BAM index
  (`.sorted.cram.crai`) and the BQSR recalibration tables under
  `preprocessing/recal_table/<sample>/<sample>.recal.table`.
- Mapped BAM/CRAM discovery follows
  `conf/modules/{aligner,markduplicates}.config`: outputs are captured when
  `--save-mapped` is enabled and also when `--skip-tools markduplicates`
  makes mapped files the published deliverable, including the default CRAM
  route when `--save-output-as-bam` is omitted (except when
  `sentieon_dedup` takes over that route).
- Generic nf-core parameters supplied through `--extra-param` retain their
  official schema types: institutional string values such as
  `custom_config_version=false` are no longer serialized as booleans, while
  documented generic boolean fields remain validated booleans.
- `--only-paired-variant-calling` now rejects germline-only callers (and
  paired-only `mpileup`) when all available normals are matched and are
  therefore removed from Sarek's germline input channel; mixed cohorts that
  still supply a runnable germline or tumor-only input remain valid.
- Handoff-derived sample detection now uses the most advanced CSV available
  (`variantcalled.csv` back to `mapped.csv`) instead of accidentally preferring
  the earliest intermediate sheet.
- Reference output discovery is enabled for `--build-only-index` as well as
  `--save-reference`, matching the `PREPARE_GENOME` and `PREPARE_INTERVALS`
  publication conditions in Sarek.
- Reference discovery now captures non-empty files published directly under
  `reference/` as well as files inside named subdirectories, matching index
  publication paths in `conf/modules/prepare_genome.config`.
- Root-level `indexcov` artefacts are now catalogued as cohort outputs rather
  than inferred as a biological sample named `indexcov`, matching its official
  non-sample-subdirectory publication layout.
- `--build-only-index` follows Sarek's empty-samplesheet execution path:
  row/mode and caller-output checks are suppressed while upstream global
  resource guards (including BQSR on preprocessing start steps) and cache
  validation stay active.
- Resume drift detection now compares the complete effective params checksum
  and reference fingerprints already stored in the manifest, preventing cached
  work reuse after a scientifically material parameter or reference change.
- Manifest reference fingerprints record Sarek's official `false` reference
  sentinel as `<disabled>` instead of incorrectly labelling it as a missing
  local path.
- Local reference/index/cache directories are fingerprinted recursively from
  relative file names and contents, so `--resume` cannot reuse cached work
  after silent directory-content changes.
- `--input false` (sarek's no-samplesheet sentinel, used with
  `--build-only-index`; cache download may be layered on that run) is normalised to "no input" instead
  of being validated as a path literally named "false".
- Strelka is now rejected in tumor-only mode; Sarek's executable routing calls
  it in germline and somatic-paired workflows. `freebayes`/`cnvkit` remain
  available in every supported analysis mode.
- `spring_2` without `spring_1` is rejected (schema dependency `spring_2 -> spring_1`).
- Mapping-step BAM input now captures the optional `bai` (sarek emits
  `[meta, bam, bai]`).
- MarkDuplicatesSpark + UMI rule corrected: incompatible only with header/
  positional UMIs (`umi_in_read_header`/`umi_location`), NOT with
  `umi_read_structure` (fgbio consensus runs upstream).
- Mutect2 warns when the default GATK Panel-of-Normals (`1000g_pon.hg38.vcf.gz`)
  is used, matching sarek.
- VEP/merge annotation outputs in `json`/`tab` format (`*.ann.json.gz`,
  `*.ann.tab.gz`) are now discovered, not only `*.ann.vcf.gz`.
- `step_completed` recognises a SnpSift-only annotation run.
- Numeric params are bounds-checked before launch (schema minimums): `split_fastq`
  (0 or >=250), `umi_length`>=1, `umi_base_skip`>=0, `ascat_*`/`cf_*` mins, etc.
- Integrated `clawbio.py run sarek-pipeline --help` delegates to the wrapper's
  schema-derived parser, and shared parser flags are forwarded without being lost.
- `commands.sh` now replays the captured, path-remapped Nextflow argv directly,
  preserving custom configs, work directory and resume state.
- The macOS Docker compatibility config no longer replaces Sarek's official
  `docker`/`gpu`/`spark` run options with a platform-only value: AMD64
  emulation now retains UID/GID mapping and GPU access where the selected
  profile defines them.
- `--extra-param` now uses one effective value throughout samplesheet
  validation, preflight and `params.yaml`: exposed numeric/boolean Sarek
  parameters retain their schema types, final overrides cannot be shadowed by
  earlier dedicated flags, and unknown native pass-through keys cannot toggle
  wrapper-only controls such as `--demo` or `--resume`.
- `--extra-param` cannot replace wrapper-managed `input`, `input_restart`, or
  `outdir`, preventing a validated normalized samplesheet or the tracked
  results tree from being silently bypassed after preflight.
- Relative `igenomes_base` paths loaded through `--params-file` are now
  resolved before the wrapper changes Nextflow's launch directory, matching
  the already-normalised CLI path behaviour.
- Cache downloads accept supported remote `--outdir-cache` targets (`s3://`,
  `gs://`, `az://`) without misapplying local filesystem writability checks;
  local targets remain checked before launch.

### Test suite

- 258 focused pytest tests covering every module (preflight, samplesheet,
  params builder, command builder, executor, outputs parser, provenance,
  reporting, orchestrator, remap paths).
- Audit-driven regression tests for every issue caught during the alignment
  reviews against nf-core/sarek 3.8.1 official docs.
