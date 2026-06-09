---
name: nfcore-sarek-wrapper
description: ClawBio wrapper around nf-core/sarek 3.8.1 covering mapping through annotation for germline, tumor-only, and somatic paired analyses.
license: MIT
metadata:
  version: "0.1.0"
  author: ClawBio
  domain: genomics
  tags:
    - sarek
    - variant-calling
    - germline
    - somatic
    - tumor-only
    - wes
    - wgs
    - nextflow
    - nf-core
  inputs:
    - name: samplesheet
      type: file
      format:
        - csv
        - tsv
        - yaml
        - yml
        - json
      description: >
        nf-core/sarek samplesheet. Accepted formats: .csv, .tsv, .yaml, .yml,
        .json. Always-required columns: patient, sample. Step-dependent columns:
        for mapping, lane plus one input mode — fastq_1 + fastq_2,
        OR spring_1 (+ optional spring_2), OR bam (uBAM); for markduplicates/
        prepare_recalibration/variant_calling, bam+bai or cram+crai; for
        recalibrate, additionally table; for annotate, vcf (+ optional
        variantcaller). Optional metadata columns: sex (XX/XY/NA), status
        (0=normal, 1=tumor), contamination (varlociraptor). A row may not mix
        FASTQ, BAM/CRAM, and VCF input modes.
      required: true
  outputs:
    - name: report
      type: file
      format:
        - md
      description: Wrapper run summary, per-tool VCF inventory, and downstream handoff recommendations
    - name: result
      type: file
      format:
        - json
      description: Structured result payload with detected CRAMs, per-tool VCFs, MultiQC HTML, and provenance
  dependencies:
    python: ">=3.11"
    packages: []
  demo_data:
    - path: demo/README.md
      description: Demo mode uses the upstream nf-core/sarek -profile test dataset rather than bundled FASTQs
  endpoints:
    cli: python clawbio.py run sarek-pipeline --input {samplesheet} --output {output_dir}
  openclaw:
    requires:
      bins:
        - python3
        - nextflow
        - java
      env: []
      config: []
    always: false
    emoji: 🧬
    homepage: https://github.com/ClawBio/ClawBio
    os:
      - darwin
      - linux
    install: []
    trigger_keywords:
      - sarek
      - germline variant calling
      - somatic variant calling
      - tumor-normal pair
      - mutect2
      - strelka
      - haplotypecaller
      - ascat
      - WES variant calling
      - WGS variant calling
      - VEP annotation
      - SnpEff
      - GATK pipeline
      - nf-core
      - Nextflow
---

# nfcore-sarek-wrapper

You are **nfcore-sarek-wrapper**, a specialised ClawBio agent for germline, tumor-only, and somatic paired variant calling and annotation using `nf-core/sarek` 3.8.1.

## Trigger

**Fire when:**
- User wants to run `nf-core/sarek`
- User asks for germline variant calling from FASTQ, BAM, or CRAM
- User asks for somatic / tumor-normal paired variant calling
- User asks for tumor-only variant calling
- User mentions GATK HaplotypeCaller, Mutect2, Strelka, ASCAT, ControlFREEC, Manta, TIDDIT, MSIsensor2, MSIsensor-pro, FreeBayes, DeepVariant, or Sentieon (TNscope, Haplotyper, DNAscope)
- User wants WES or WGS variant calling with strict preflight, reproducibility outputs, and downstream handoff
- User asks to annotate VCFs with VEP or SnpEff
- User mentions UMI consensus calling with fgbio for germline/somatic variants

**Do NOT fire when:**
- User has FASTQ for bulk RNA-seq → route to `nfcore-rnaseq-wrapper`
- User has FASTQ for single-cell RNA-seq → route to `nfcore-scrnaseq-wrapper`
- User already has an annotated VCF and wants ACMG/AMP interpretation → route to `clinical-variant-reporter`
- User wants a clinical PDF report from a WES markdown summary → route to `wes-clinical-report-en` or `wes-clinical-report-es`
- User asks about PharmGx, PRS, methylation, or pharmacogenomics

## Scope

One skill, one task: orchestrate `nf-core/sarek` 3.8.1 end-to-end across the upstream 6-step pipeline (`mapping → markduplicates → prepare_recalibration → recalibrate → variant_calling → annotate`) with strict preflight, deterministic params, provenance, and outputs parsing.

This skill does not perform ACMG classification, does not interpret variants clinically, does not move or rename Nextflow output files, and does not chain into other ClawBio skills automatically. Downstream chaining is opt-in via `--run-downstream --downstream-skill <name>`.

## Why This Exists

- **Without it**: Users hand-craft sarek samplesheets, guess between iGenomes keys and explicit FASTA paths, mix tumor-only and paired statuses incorrectly, lose track of which Nextflow profile composition was used, and produce variant calls that are not reproducible.
- **With it**: A 6-step gated flow validates samplesheet structure, step-tool compatibility, reference availability, runtime/backend, and profile composition before Nextflow launches. Every run emits `params.yaml`, `commands.sh`, `manifest.json`, and a checksums bundle.
- **Why ClawBio**: Local-first, pinned to nf-core/sarek 3.8.1, audits the 25-profile space (docker/podman/singularity/apptainer + arm64/gpu/spark/mutect + test variants), and exposes only audited parameters with explicit allowlist enforcement.

## Core Capabilities

1. **Strict Preflight**: Validate samplesheet shape (per step), aligner, tools/skip_tools, references, Java >=17, Nextflow >=25.10.2, backend, UMI options, and resume-state drift.
2. **Profile Composition**: Compose docker/singularity/etc. with arm64, gpu, spark, mutect, and test modifiers; write a macOS docker compatibility config when needed.
3. **Audited Execution**: Run `nf-core/sarek` 3.8.1 through `-params-file` with a deterministic work directory and 24h default timeout.
4. **Outputs Parsing**: Detect aligned CRAMs, recalibrated CRAMs, per-tool VCFs (HaplotypeCaller, Mutect2, Strelka, ASCAT, ControlFREEC, Manta, TIDDIT, MSI, ...), annotated VCFs (SnpEff, VEP, merge, bcftools, SnpSift), and MultiQC.
5. **Reproducibility Bundle**: Write `commands.sh`, `params.yaml`, `manifest.json`, checksums, `environment.yml`, and provenance JSON under `reproducibility/`.
6. **Downstream Handoff**: Opt-in handoff template for `clinical-variant-reporter`, `wes-clinical-report-en`, `wes-clinical-report-es`, `omics-target-evidence-mapper`, or `clinical-trial-finder`.

## Steps

| `--step` | Inputs required | Best for |
|---|---|---|
| `mapping` (default) | `lane` plus one of: `fastq_1`+`fastq_2`, `spring_1`(+ optional `spring_2`), or `bam` (uBAM) | Standard FASTQ/Spring/uBAM-to-VCF runs |
| `markduplicates` | Aligned `bam`+`bai` or `cram`+`crai` | Restart from alignment |
| `prepare_recalibration` | Deduplicated BAM/CRAM | Pre-BQSR restart |
| `recalibrate` | BAM/CRAM + `table` | Restart at BQSR apply |
| `variant_calling` | Recalibrated BAM/CRAM | Tool re-run without realignment |
| `annotate` | `vcf` (+ optional `variantcaller`) | Annotate existing variant calls |

## Input Formats

The samplesheet may be `.csv`, `.tsv`, `.yaml`, `.yml`, or `.json` (CSV/TSV are
delimited; YAML/JSON are a top-level list of row records). File-column values may
be local paths or remote URLs (`https://`, `s3://`, `gs://`, `ftp://`, …).

| Mode | Required Fields | Example |
|--------|-----------------|---------|
| Mapping (FASTQ) | `patient`, `sample`, `lane`, `fastq_1`, `fastq_2` | `samplesheet.csv` |
| Mapping (Spring) | `patient`, `sample`, `lane`, `spring_1` (+ optional `spring_2`) | `samplesheet_spring.csv` |
| Mapping (uBAM) | `patient`, `sample`, `lane`, `bam` | `samplesheet_ubam.csv` |
| BAM/CRAM restart | `patient`, `sample`, plus `bam`+`bai` or `cram`+`crai` | `samplesheet_bam.csv` |
| Recalibrate restart | above plus `table` | `samplesheet_recal.csv` |
| Annotate | `patient`, `sample`, `vcf` (+ optional `variantcaller`) | `samplesheet_vcf.csv` |
| Demo mode | none | `python clawbio.py run sarek-pipeline --demo` |

Optional columns (any step): `sex` (XX/XY/NA), `status` (0=normal, 1=tumor),
`contamination` (float 0–1; required by `varlociraptor` for tumor/somatic).

Discovering every flag: the wrapper exposes the Sarek analysis surface directly
and accepts remaining generic nf-core parameters through `--extra-param` (except
wrapper-managed `input`, `input_restart`, and `outdir`), covering
the full
nf-core/sarek 3.8.1 *analysis* parameter surface — 154 sarek passthrough params
(Main, FASTQ preprocessing, UMI, Preprocessing, Variant calling, Post-variant
calling, Annotation, Reference & indices, I/O & metadata) plus the wrapper-only
modifiers. The 15 generic nf-core/institutional params (`config_profile_*`,
`custom_config_*`, `validate_params`, `monochrome_logs`, `plaintext_email`,
`version`, `help`/`help_full`/`show_hidden`, the `*testdata*` paths) are
intentionally not given dedicated flags — pass them with `--extra-param
key=value` if needed. `python clawbio.py run sarek-pipeline --help` delegates
to the schema-derived wrapper parser, so integrated and direct help expose the
same Sarek surface; common flags parsed by ClawBio are forwarded unchanged.

## Workflow

1. **Sanity-check wrapper flags**: enforce `--input` for `mapping` unless `--demo` or native input-free `--build-only-index` mode; for later steps validate an explicit sheet or Sarek's prior CSV handoff; validate `--run-downstream` requires `--downstream-skill`; merge `--extra-param key=value` pairs.
2. **Compose profile**: merge user backend (docker/singularity/...) with `--arm`, `--gpu`, `--spark-profile`, `--mutect-profile`, and `--demo` (`test`) tokens.
3. **Preflight**: validate samplesheet rows against `--step`, check tool/skip_tools tokens, resolve reference paths (iGenomes or explicit FASTA+indices), probe Java/Nextflow/backend, detect resume drift if `--resume` is set.
4. **Build params**: assemble the effective `params.yaml` from CLI flags + extras + step-dependent defaults; clear all reference flags when `--demo` is set.
5. **Execute Nextflow**: launch with composed profile, `-params-file params.yaml`, deterministic `-work-dir`, streamed stdout/stderr.
6. **Parse outputs**: detect aligned/recalibrated CRAMs, per-tool VCFs (§1–§6 layout), annotated VCFs, MultiQC, and pipeline_info.
7. **Write provenance + report**: under `reproducibility/`, emit `report.md`, `result.json`, `commands.sh`, `params.yaml`, the normalized samplesheet, `environment.yml`, `checksums.sha256`, and seven JSON files (`manifest.json`, `parameters.json`, `samplesheet.json`, `pipeline_source.json`, `tool_versions.json`, `outputs.json`, `compatibility_policy.json`).

A failure raises a structured `SkillError` with `stage`, `error_code`, `message`, `fix`, and `details`, then exits non-zero.

## CLI Reference

```bash
# Preflight only; no Nextflow execution
python clawbio.py run sarek-pipeline \
  --input samplesheet.csv --output ./sarek_check --check \
  --genome GATK.GRCh38 --tools haplotypecaller

# Demo mode using upstream -profile test
python clawbio.py run sarek-pipeline --demo --output /tmp/sarek_demo

# Germline WES with custom targeted reference resources
python clawbio.py run sarek-pipeline \
  --input samplesheet.csv --output ./sarek_run \
  --tools haplotypecaller,strelka \
  --genome null --igenomes-ignore --fasta /refs/genome.fa \
  --known-indels /refs/known_indels.vcf.gz \
  --wes --intervals exome_targets.bed

# Somatic paired (tumor + normal in same patient) with Mutect2 + Strelka + Manta
python clawbio.py run sarek-pipeline \
  --input samplesheet_paired.csv --output ./sarek_somatic \
  --tools mutect2,strelka,manta,vep \
  --genome GATK.GRCh38

# Tumor-only with Mutect2 + PON
python clawbio.py run sarek-pipeline \
  --input samplesheet_tumor_only.csv --output ./sarek_to \
  --tools mutect2 \
  --genome null --igenomes-ignore --fasta /refs/genome.fa \
  --known-indels /refs/known_indels.vcf.gz \
  --pon /refs/pon.vcf.gz --pon-tbi /refs/pon.vcf.gz.tbi \
  --germline-resource /refs/af-only.vcf.gz --germline-resource-tbi /refs/af-only.vcf.gz.tbi

# Explicit FASTA reference (non-default genome build)
python clawbio.py run sarek-pipeline \
  --input samplesheet.csv --output ./sarek_run \
  --genome null --igenomes-ignore \
  --fasta /refs/genome.fa --fasta-fai /refs/genome.fa.fai --dict /refs/genome.dict \
  --bwa /refs/bwa/

# ARM (Apple M-series, AWS Graviton) — composes -profile docker,arm64
python clawbio.py run sarek-pipeline \
  --input samplesheet.csv --output ./sarek_arm \
  --profile docker --arm --genome GATK.GRCh38

# Opt-in downstream handoff to clinical-variant-reporter
python clawbio.py run sarek-pipeline \
  --input samplesheet.csv --output ./sarek_run \
  --tools haplotypecaller,vep \
  --genome GATK.GRCh38 \
  --run-downstream --downstream-skill clinical-variant-reporter
```

## Demo

```bash
python clawbio.py run sarek-pipeline --demo --output /tmp/sarek_demo
```

Expected output: upstream `nf-core/sarek -profile test` outputs (synthetic small dataset) under `upstream/results/`, plus the ClawBio `reproducibility/` bundle (`report.md`, `result.json`, params/commands/samplesheet snapshots, provenance JSON, `environment.yml`, `checksums.sha256`).

## Algorithm / Methodology

Key methods:
- Local data paths inside a samplesheet are resolved against its directory and
  written as absolute POSIX paths; remote data URLs are passed through unchanged.
  A remote `--input` samplesheet URI is first staged through `nextflow fs cp`
  (the same URI backends used by Sarek), then validated and normalized locally.
- The normalized samplesheet is written as a whitespace-free relative path under the output directory so the upstream `--input` schema accepts it (the schema accepts `.csv`, `.tsv`, `.yaml`, `.yml`, `.json`).
- Reference handling follows Sarek's two documented modes: use `--genome <iGenomes>` and optionally override individual reference files (or pass `false` for a resource that should not be used), or use `--genome null --igenomes-ignore --fasta <reference>` when no iGenomes reference files should be loaded. Optional FASTA indices and tool resources may be supplied in either mode when appropriate.
- In `--build-only-index` mode, Sarek intentionally supplies an empty samplesheet channel: the wrapper does not require sample pairing or per-sample caller outputs, while it preserves upstream global resource guards (including BQSR guards on preprocessing start steps) and captures published reference outputs.
- Tool×mode compatibility is evaluated per-patient: a tool is accepted when at least one patient matches its required mode, so mixed samplesheets (germline-only patients alongside tumor/normal pairs) are valid. Paired-only tools (`ascat`, `msisensorpro`, `muse`) still need at least one patient with both `status=0` and `status=1`.
- Mutect2 without an effective PON or germline resource emits a preflight warning but does not block; resources inherited from an iGenomes bundle count as effective. The bundled `GATK.GRCh38` PON still emits a recommendation to use a project-specific PON.
- Paired somatic Mutect2 cannot be run with `--no-intervals`; the upstream schema explicitly marks that combination unsupported.
- `--snv-consensus-calling` requires `--normalize-vcfs`, as enforced by the upstream workflow before post-variant processing.
- `--use-gatk-spark markduplicates` is incompatible with header/positional UMI dedup (`--umi-in-read-header` or `--umi-location`); it is fine with `--umi-read-structure` (fgbio consensus runs upstream).
- ASCAT requires an effective `--ascat-genome`, `--ascat-alleles`, and `--ascat-loci` (which supported iGenomes bundles can provide). With `--wes`, custom `--ascat-alleles`, `--ascat-loci`, `--ascat-loci-gc`, and `--ascat-loci-rt` resources are recommended; the wrapper warns because Sarek documents its iGenomes ASCAT resources as unsuitable for WES.

## Example Queries

- "Run nf-core/sarek for germline variant calling on these WES FASTQs"
- "Call somatic variants from this tumor-normal pair with Mutect2 and Strelka"
- "Annotate this VCF with VEP using sarek"
- "Tumor-only Mutect2 with PON for our WES cohort"
- "Restart sarek at the recalibration step"

## Example Output

```
output/                                       # the --output directory
├── .nextflow/                                # Nextflow cache/history (framework-created; excluded from checksums)
├── .nextflow.log                            # Nextflow launch log (framework-created; excluded from checksums)
├── upstream/
│   ├── results/                              # Nextflow --outdir
│   │   ├── csv/                              # handoff CSVs (mapped/markduplicates/recalibrated/variantcalled); legacy fallback: preprocessing/csv/
│   │   ├── preprocessing/
│   │   │   ├── mapped/                       # §1 aligned CRAMs (one per sample/lane)
│   │   │   ├── markduplicates/               # §2 deduplicated CRAMs
│   │   │   └── recalibrated/                 # §3 BQSR-recalibrated CRAMs
│   │   ├── variant_calling/
│   │   │   ├── haplotypecaller/              # §4 germline VCFs
│   │   │   ├── mutect2/                      # somatic / tumor-only VCFs
│   │   │   ├── strelka/                      # somatic + germline VCFs
│   │   │   ├── manta/                        # SV VCFs
│   │   │   ├── ascat/                        # CNV / purity / ploidy
│   │   │   ├── controlfreec/                 # CNV
│   │   │   ├── tiddit/                       # SV
│   │   │   ├── bcftools/                     # mpileup caller output
│   │   │   ├── msisensor2/                   # MSI
│   │   │   └── msisensorpro/                 # MSI (paired MSIsensorPro)
│   │   ├── annotation/<variantcaller>/<sample_or_pair>/   # §5 SnpEff/VEP/merge/bcftools/SnpSift annotated VCFs
│   │   ├── multiqc/                          # §6 MultiQC HTML + data
│   │   ├── pipeline_info/
│   │   └── reports/
│   └── work/                                 # Nextflow work directory
└── reproducibility/                          # all ClawBio artifacts land here
    ├── report.md                             # human-readable run summary
    ├── result.json                           # machine-readable run summary
    ├── samplesheet.valid.csv                 # or samplesheet.demo.csv in --demo mode
    ├── params.yaml
    ├── commands.sh
    ├── remap_paths.py
    ├── environment.yml
    ├── checksums.sha256
    ├── compatibility_policy.json
    ├── parameters.json
    ├── samplesheet.json
    ├── pipeline_source.json
    ├── tool_versions.json
    ├── outputs.json                          # omitted if outputs parsing was skipped
    ├── manifest.json
    ├── logs/                                 # Nextflow stdout.txt / stderr.txt (real runs only)
    ├── macos_docker.config                   # written only on macOS + docker backend
    └── sarek_downstream_handoff.{sh,json}    # written only when --run-downstream is set
```

## Output Structure

The wrapper writes exactly two child directories under the `output/` root: `upstream/` (the Nextflow `results/` tree plus its `work/` directory) and `reproducibility/` (every ClawBio artifact — `report.md`, `result.json`, the params/commands/samplesheet snapshots, the seven JSON provenance files, `environment.yml`, and `checksums.sha256`). Nextflow itself additionally writes its own hidden bookkeeping in the launch directory — `.nextflow/` (cache/history) and `.nextflow.log` — because the wrapper runs Nextflow with `cwd = output_dir` so the relative `input`/`outdir` paths resolve; both are excluded from `checksums.sha256` (`.nextflow` directory and any `.log` file are skipped). There is no separate top-level `provenance/` or `logs/` directory; all ClawBio bundle files are co-located in `reproducibility/`, including execution logs under `reproducibility/logs/` and the macOS Docker compatibility config (`reproducibility/macos_docker.config`, macOS + docker only). The whole `reproducibility/` tree is excluded from `checksums.sha256`, so execution logs never enter the manifest. The §1–§6 layout in `outputs_parser.py` corresponds to: §1 mapped, §2 markduplicates, §3 recalibrated, §4 per-tool variant calls, §5 annotation, §6 MultiQC.

**Cross-machine / cross-OS portability.** The bundle stores absolute data/reference paths (required by Nextflow) but ships a stdlib-only `remap_paths.py` to rebase them on any host: `--old/--new` rewrites samplesheet data paths, `--refs-old/--refs-new` rewrites reference/index paths in `params.yaml` (and `commands.sh` if any were added there), and `--verify` confirms every path resolves before replay. URIs (`s3://`, `https://`, …) and the `false` disable sentinel are preserved. All bundle files use POSIX paths and `utf-8`/`\n`, so macOS↔Linux replay is byte-stable. The recommended replay path is `commands.sh` (`CLAWBIO_REPO=… bash commands.sh`), which regenerates any host-specific config (e.g. the macOS Docker config) for the new machine.

## Dependencies

**Required**
- Python >=3.11
- Java >=17
- Nextflow >=25.10.2
- One execution backend: Docker, Singularity, Apptainer, Podman, Conda/Mamba, Shifter, or Charliecloud

## Gotchas

- **ASCAT for WES should use custom resources.** Sarek allows `--wes --tools ascat` with iGenomes but warns that its default ASCAT resources are not suited for WES. The wrapper preserves that warning; for production WES runs, use `--genome null --igenomes-ignore` and provide target-appropriate `--ascat-genome`, `--ascat-alleles`, `--ascat-loci`, `--ascat-loci-gc`, and `--ascat-loci-rt`.
- **SnpEff needs a database identifier.** `snpeff` and `merge` require an effective `snpeff_db`: either pass `--snpeff-db` or use an iGenomes genome that supplies it. This is still required when downloading/building annotation caches because Sarek uses the database identifier to select/download the cache.
- **Mutect2 without PON or germline resource emits unreliable calls.** The model will want to skip the PON/germline resource for "simplicity". Do not. Mutect2 without a panel-of-normals returns the union of true somatic calls and recurrent technical artifacts, and without a germline resource no germline-based filtering is applied. The wrapper warns when neither explicit nor inherited resources are effective, and warns separately when the generic `GATK.GRCh38` PON is used; pass a technically matched `--pon`/`--pon-tbi` and appropriate `--germline-resource` for production runs.
- **MarkDuplicatesSpark cannot do UMI-based deduplication.** The model will want to set `--use-gatk-spark markduplicates` alongside header/positional UMIs (`--umi-in-read-header` or `--umi-location`) to "speed up dedup". Do not — MarkDuplicatesSpark cannot perform UMI-aware deduplication, so the wrapper rejects that combination (matching sarek). Note: `--use-gatk-spark markduplicates` IS compatible with `--umi-read-structure`, because fgbio collapses UMIs into consensus reads *before* deduplication.
- **iGenomes defaults to GATK.GRCh38.** For a wholly custom build, pass `--genome null --igenomes-ignore --fasta <reference>`; Sarek documents FASTA as the only required custom-reference file and can build missing indices. For a partial override, keep `--genome <iGenomes>` and pass only the replacement resource files, as described in the official usage guide.
- **Tool×mode pairing is inferred from the `status` column — there is no `--tumor-only` flag.** The model will want to write an all-`status=1` samplesheet and still ask for paired tools. Do not. The wrapper's preflight enforces each tool's supported modes against the samplesheet:
  - **Paired-only** (need both a `status=0` normal and a `status=1` tumor under the same `patient`): `ascat`, `msisensorpro`, `muse`.
  - **Tumor-only** (need a tumor; no normal required): `lofreq`, `msisensor2`.
  - **Tumor-only OR paired** (auto-routed): `mutect2`, `sentieon_tnscope`, `controlfreec`.
  - **Any mode** (germline + tumor-only + somatic): `manta`, `tiddit`, `cnvkit`, `freebayes`, `varlociraptor`.
  - **Germline, tumor-only, or paired-normal routing**: `mpileup`. **Germline or paired**: `strelka`. **WGS germline or paired only**: `indexcov` (`--wes` does not execute it upstream).
  - **Needs a normal/germline sample**: `haplotypecaller`, `deepvariant`, `sentieon_haplotyper`, `sentieon_dnascope`. These run on the normal sample of a tumor/normal pair as well as on standalone normals.
  - The check is **per-patient**, like sarek: a tool is accepted when *at least one* patient supplies its required input. Mixed samplesheets and paired cohorts are valid — for a paired patient, `haplotypecaller` runs on the normal while `mutect2` runs on the tumor/normal pair.
- **`--demo` clears all reference flags.** The model will want to combine `--demo` with `--genome GATK.GRCh38` or `--fasta`. Do not. The `--demo` flag forces the upstream `-profile test` dataset, which ships its own tiny reference; the wrapper clears every reference-path flag (genome, igenomes_base, fasta, intervals, dbsnp, known_indels, known_snps, germline_resource, pon, ...) before they reach `params.yaml` and ignores `--input`.
- **`--resume` is rejected when the manifest drifts.** Changes to pipeline source, profile composition, step, aligner, tools, skip_tools, analysis_mode, wes, joint_germline, joint_mutect2, the complete emitted parameter checksum, reference fingerprints, or samplesheet checksum invalidate the Nextflow work directory. The wrapper refuses to resume in those cases — re-run with a fresh `--output` directory.
- **`arm64` profile implicitly enables Wave.** The model will want to use `--arm` on offline / air-gapped machines. Do not without preparation. Sarek's `arm64` profile sets `wave.enabled=true` + `wave.freeze=true` + `wave.strategy='conda,container'` so containers are rebuilt for arm via the upstream Wave service. If outbound traffic to `wave.seqera.io` is blocked, the run stalls. On offline Apple Silicon, instead build images once via Wave on a connected host, mirror to a local registry, and add a custom `-c` config pointing `process.container` to the mirror.
- **Sentieon callers and aligner require a license.** The model will want to use `--aligner sentieon-bwamem` or `--tools sentieon_haplotyper,sentieon_dnascope,sentieon_tnscope` without setting `SENTIEON_LICENSE` (or `SENTIEON_LICENSE_BASE64`) first. Do not. Sarek does not vendor a Sentieon license; the upstream task fails late with a cryptic Sentieon binary error. Export `SENTIEON_LICENSE=host:port` (server) or `SENTIEON_LICENSE_BASE64=...` (offline) before invoking `clawbio.py run sarek-pipeline`, and document the license source in your run notes.

## Safety

- No patient data is bundled.
- Demo mode uses upstream `-profile test` data.
- The wrapper does not upload data.
- The wrapper does not pass arbitrary unvalidated Nextflow parameters; unknown native keys via `--extra-param` are passed through but tracked in provenance, while `input`, `input_restart`, and `outdir` remain wrapper-managed so normalized input and output provenance cannot be bypassed.
- `--resume` is rejected on manifest drift (pipeline source, profile, step, aligner, tools, skip_tools, analysis_mode, wes, joint_germline, joint_mutect2, effective params checksum, reference fingerprints, samplesheet checksum).

> ClawBio is a research and educational tool. It is not a medical device and does not provide clinical diagnoses. Consult a healthcare professional before making any medical decisions.

## Agent Boundary

Agent dispatches and explains; skill executes Nextflow. The agent must not invent variant-calling thresholds, fabricate reference paths, or override `--resume` drift errors. If a flag combination is rejected by preflight, the agent should explain the failure and suggest the corrected invocation — never bypass the check.

## Chaining Partners

This skill emits a downstream handoff template (under `reproducibility/sarek_downstream_handoff.sh`) when invoked with `--run-downstream --downstream-skill <name>`. Supported partners:

- `clinical-variant-reporter`: ACMG/AMP classification from VEP-annotated VCFs.
- `wes-clinical-report-en`: render an English-language WES clinical PDF from this run's markdown report.
- `wes-clinical-report-es`: render a Spanish-language WES clinical PDF from this run's markdown report.
- `omics-target-evidence-mapper`: aggregate target-level evidence across multi-omic sources using the gene list from annotated VCFs.
- `clinical-trial-finder`: match variants/genes to ClinicalTrials.gov and EUCTR trials.

The handoff is opt-in. Without `--run-downstream`, no template is written and no follow-on skill is launched.

## Maintenance

- **Review cadence**: quarterly, or whenever upstream `nf-core/sarek` ships a new release.
- **Staleness signals**: new sarek release (3.8.x → 3.9.x), new caller added upstream, schema_input.json changes, container manifest changes, deprecated profile tokens, ASCAT or VEP cache version bumps.
- **Deprecation**: a sarek major version bump that breaks the schema (3.x → 4.x) requires a new wrapper branch with regenerated `_SAREK_PASSTHROUGH_PARAMS`, regenerated preflight rules, and full test re-baselining. Before bumping the pinned version, audit `nextflow.config`, `assets/schema_input.json`, `nextflow_schema.json`, `docs/output.md`, and changed module configs.

## Citations

- nf-core/sarek 3.8.1: https://github.com/nf-core/sarek
- GATK Best Practices: https://gatk.broadinstitute.org/hc/en-us/sections/360007226651-Best-Practices-Workflows
- VEP: https://www.ensembl.org/info/docs/tools/vep/index.html
