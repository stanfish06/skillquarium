# Recipe — Pan-UKBB direct

Convert a Pan-UKBB phenotype tabix-bgz into the canonical locuscompare schema.

## Source

Pan-UKBB FTP: <https://pan-dev.ukbb.broadinstitute.org/downloads>

- **Format**: tab-separated, bgzip + tabix; per-phenotype + per-ancestry files
- **Coordinate system**: GRCh38
- **License**: open-access; cite per <https://pan.ukbb.broadinstitute.org/>
- **Auth**: none for the bulk sumstats files
- **Why use direct over GWAS Catalog**: Pan-UKBB stratifies by ancestry (EUR,
  AFR, EAS, AMR, CSA, MID, undetermined). For non-EUR analyses or for ancestry-
  matched LD references, direct download is the right call.

## Native columns

```
chr  pos  ref  alt  af_meta  beta_meta  se_meta  pval_meta  af_EUR  beta_EUR  se_EUR  pval_EUR  ... <other ancestries>
```

For an EUR-ancestry analysis, use the `_EUR` columns; for trans-ancestry meta,
use `_meta`. Recipe defaults to EUR.

## Quick start

```bash
# Download (e.g. cholesterol biomarker 30760)
wget https://pan-ukb-us-east-1.s3.amazonaws.com/sumstats_release/biomarkers-30760-both_sexes-irnt.tsv.bgz
wget https://pan-ukb-us-east-1.s3.amazonaws.com/sumstats_release/biomarkers-30760-both_sexes-irnt.tsv.bgz.tbi

# Harmonise to canonical schema (EUR ancestry)
bash skills/locuscompare-region-render/examples/recipes/pan_ukbb_direct/harmonise.sh \
    biomarkers-30760-both_sexes-irnt.tsv.bgz \
    EUR \
    pan_ukbb_30760_irnt_eur.canonical.tsv
```

## Column mapping

| Pan-UKBB column | locuscompare canonical |
|---|---|
| `chr` | `chromosome` |
| `pos` | `position_bp` |
| `ref` | `allele_a` |
| `alt` | `allele_b` |
| `beta_<ANCESTRY>` | `beta` |
| `se_<ANCESTRY>` | `se` |
| `pval_<ANCESTRY>` | `p` |
| `af_<ANCESTRY>` | `eaf` |
| (synthesised) | `variant_id` = chr_pos_ref_alt |

## Caveats

- **Ancestry-matched LD reference**: If using EUR sumstats, use 1000G EUR for LD
  (matches locuscompare's default). For AFR/EAS/etc., use the matching 1000G
  super-pop or a dedicated reference. Pan-UKBB ships LD scores for each
  super-pop; locuscompare currently uses 1000G via plink 1.9.
- **`pval = NA`**: Pan-UKBB writes `NA` for variants where the test failed
  (Saige convergence issues). Recipe drops these rows.
- **`af = 0` or `af = 1`**: monomorphic in this ancestry — recipe drops.

## Sign-check status

Pan-UKBB's `beta_*` is per-copy of `alt` (the canonical convention). No flip needed.

## Citation

> Pan-UKB team. (2020). *Pan-UK Biobank.*
> <https://pan.ukbb.broadinstitute.org>
