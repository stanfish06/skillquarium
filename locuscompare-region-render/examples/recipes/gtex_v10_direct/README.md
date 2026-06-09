# Recipe — GTEx v10 cis-eQTL direct

Convert a GTEx v10 per-tissue cis-eQTL nominal-pass bgz into the canonical
locuscompare schema.

## Source

GTEx v10: <https://gtexportal.org/home/datasets>

- **Format**: bgzip-compressed TSV per (tissue × molecular feature)
- **Coordinate system**: GRCh38, GENCODE v39
- **License**: open-access; cite per <https://gtexportal.org/home/license>
- **Auth**: none for the bulk cis-eQTL files
- **Why use direct over eQTL Catalogue**: eQTL Cat indexes a curated subset
  of GTEx v10 datasets; direct GTEx download gives access to tissues / quant
  methods not in eQTL Cat's index (rare-tissue datasets, allelic-specific
  expression, sQTL leafcutter, etc.).

## Native columns

GTEx v10 ships per-tissue all-pairs files at:
`gs://adult-gtex/bulk-qtl/v10/single-tissue-cis-qtl/all_pairs/<tissue>/<tissue>.allpairs.tsv.bgz`

Columns:
```
phenotype_id  variant_id  start_distance  pval_nominal  slope  slope_se
```

Where `variant_id` is `chr<N>_<pos>_<ref>_<alt>_b38` (GTEx-native format with
the `b38` suffix). The recipe strips the `chr` prefix and `_b38` suffix to
match locuscompare's canonical convention.

## Quick start

```bash
# Pull a tissue's allpairs (small example: minor salivary gland)
gsutil cp gs://adult-gtex/bulk-qtl/v10/single-tissue-cis-qtl/all_pairs/Minor_Salivary_Gland/Minor_Salivary_Gland.allpairs.tsv.bgz .

# Harmonise (slice to one gene region)
bash skills/locuscompare-region-render/examples/recipes/gtex_v10_direct/harmonise.sh \
    Minor_Salivary_Gland.allpairs.tsv.bgz \
    ENSG00000134243.16 \
    sort1_minor_salivary_gland.canonical.tsv

# Drop into config:
# exposure:
#   trait_label: "SORT1 expression — minor salivary gland (GTEx v10)"
#   sumstats_path: "sort1_minor_salivary_gland.canonical.tsv.gz"
```

## Column mapping

| GTEx v10 column | locuscompare canonical |
|---|---|
| `variant_id` (chr1_500000_A_T_b38) | parsed → `variant_id` (1_500000_A_T), `chromosome`, `position_bp`, `allele_a`, `allele_b` |
| `slope` | `beta` |
| `slope_se` | `se` |
| `pval_nominal` | `p` |
| `phenotype_id` | `molecular_trait_id` (per-row, since allpairs file mixes traits) |

## Caveats

- **Per-feature filter**: the allpairs file is hundreds of GB; you almost
  always want to filter to the gene-of-interest (`phenotype_id`) at extraction.
  The recipe takes ENSG (with version, e.g. `ENSG00000134243.16`) as an
  argument and emits only matching rows.
- **Tissue naming**: GTEx uses `Minor_Salivary_Gland` (capitalized,
  underscores); eQTL Catalogue uses `minor_salivary_gland` (lowercase). Map
  yourself; the recipe does not.
- **Effect-allele convention**: GTEx v10 `slope` is per-copy of the alt
  allele, matching locuscompare's `allele_b is effect` convention. No flip
  needed.
- **No SE for some QTLs**: very rare cis-eQTLs may have SE listed as `NaN`;
  the recipe drops those rows.

## Sign-check status

GTEx v10 cis-eQTL slope is sign-checked against ALT as the effect allele.

## Citation

> GTEx Consortium. (2025) *The Genotype-Tissue Expression (GTEx) project: V10.*
> (Update DOI when published.)
