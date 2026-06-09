# 06. sQTL × GWAS: SORT1 transcript usage in GTEx liver × cholesterol-VLDL

**v1.3 multi-modality demo, family 2 of 4**. Shows that the regional
LocusCompare orchestrator renders splicing-QTLs (eQTL Catalogue non-ge
quant methods) end-to-end alongside the bulk ge-eQTL renders. No auth
required.

## What this demo proves

> Any OT coloc row referencing an eQTL Catalogue sQTL study (txrev / tx /
> exon / leafcutter quant methods) is renderable today, no auth required.

## Quant-method choice: `txrev`, not `leafcutter`

The folder name on `main` before 2026-05-15 was `06_sqtl_sort1_liver_leafcutter`
and the config pointed at `QTD000270` (GTEx liver leafcutter). Build verified
that the fetcher patch lands rows for QTD000270's region, but those rows
belong to *neighbouring* genes' leafcutter clusters (GSTM1, LAMTOR5-AS1).
SORT1 itself has no leafcutter credible-set hit in GTEx liver, so
filtering by `gene_id=ENSG00000134243` against `QTD000270.cc.tsv.gz`
returns zero rows.

Three other GTEx liver sQTL quant methods do retain a SORT1 credible-set:

| Quant method | eQTL Cat dataset | SORT1 rows in ±500 kb of lead |
|---|---|---|
| `exon` | `QTD000267` | 2,877 (one exon trait) |
| `tx`   | `QTD000268` | 5,754 (two transcripts) |
| `txrev` (this demo) | `QTD000269` | 2,877 (one transcript-usage trait, ENST00000483508) |
| `leafcutter` | `QTD000270` | 0 (no SORT1 cluster in credible-set file) |

`txrev` (proportional transcript usage) is the canonical eQTL Catalogue
splicing-QTL semantic, so it stays the default for the SORT1 demo. The
other three quant methods are available via the same orchestrator path
by swapping `dataset_id` in `config.yaml`.

## Source-file choice: `.cc.tsv.gz`

eQTL Catalogue ships two per-variant FTP files for each dataset:

- `<QTD>.all.tsv.gz`: full nominal-pass sumstats. Available **only** for
  `ge` and `microarray` quant methods.
- `<QTD>.cc.tsv.gz`: credible-set-filtered sumstats. Retains the strongest
  molecular trait per fine-mapped signal (same trait the eQTL Catalogue
  used for upstream coloc). ~98% size reduction relative to `.all.tsv.gz`
  while keeping almost all significant loci.

The fetcher picks the suffix from the dataset's `quant_method` metadata
(`ge`/`microarray` → `.all.tsv.gz`; everything else → `.cc.tsv.gz`).
For coloc/LocusCompare use cases this is lossless: the trait kept in
`.cc.tsv.gz` is exactly the one Open Targets called the coloc on.

For background on the FTP layout audit and the official eQTL Catalogue
endorsement of `.cc.tsv.gz` for coloc workflows, see the eqtl-catalogue-
region-fetch skill's SKILL.md.

## OT coloc row resolved

| Field | Value |
|-------|-------|
| OT studyId (exposure) | `gtex_txrev_liver_ensg00000134243` |
| OT studyId (outcome) | `GCST90269602` |
| Pattern | `<study>_<quant>_<sample>_<ensg>` (the canonical OT QTL studyId form) |
| Mapping row | `study_id_mappings.yaml` (caller-supplied, see `load_study_id_mappings`) |

## Upstream studies

- **Exposure**: eQTL Catalogue v7+ dataset `QTD000269` (GTEx liver
  txrev / transcript-usage QTL). Verified live against
  https://www.ebi.ac.uk/eqtl/api/v2/datasets/?size=1000 on 2026-05-15.
- **Outcome**: GWAS Catalog harmonised `GCST90269602`
  (cholesterol in medium VLDL).
- **LD**: 1000G Phase 3 GRCh38, super-pop EUR.

## How to run

```bash
python skills/locuscompare-region-render/cli.py \
    --input skills/locuscompare-region-render/examples/05_sqtl_sort1_liver_txrev/config.yaml \
    --output runs/sqtl_sort1_liver_txrev/
```

No auth required; both exposure (eQTL Catalogue) and outcome
(GWAS Catalog) tabix-on-FTP paths are anonymous. The 1000G region VCF
(~5-50 MB) downloads on first run and caches.

Expected output (committed at `expected_output/`): `manifest.yaml` plus
`1_109274968_G_T_full_locuscompare.png`. Captured 2026-05-15 with
`n_pairs=2648, n_palindromic_excluded=349` (no plink on the dev box,
so the run uses the documented `ld_panel: none` fallback; install plink 1.9
for LD-coloured points).

## Caveats

- `txrev` β is per-ALT-allele change in the *fraction* of expression
  captured by that transcript, not abundance. The β cannot be compared
  directly against a `ge` β at the parent gene; they measure different
  things (isoform switch vs total expression).
- The SORT1 transcript-usage signal at this locus is biologically
  distinct from the ge-eQTL signal in minor salivary gland (example 02).
  A coloc/LocusCompare match between the two is evidence the LDL/CHD
  lead variant alters BOTH expression and splicing, not redundant.
