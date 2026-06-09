# Recipe — FinnGen direct download

Convert a FinnGen R12+ phenotype TSV into the canonical locuscompare schema.

## Source

FinnGen direct download: <https://finngen.gitbook.io/documentation/data-download>

- **Format**: tab-separated values, bgzip + tabix
- **Coordinate system**: GRCh38 (since R6 onwards)
- **License**: open-access for sumstats since FinnGen R12; check the current
  release's data-use agreement at <https://www.finngen.fi/en/access_results>
- **Auth**: none for sumstats (was registration-gated until R11; relaxed in R12)
- **Why use direct over GWAS Catalog**: more recent releases, bigger N, FinnGen
  often catches Finnish-enriched signals (HLA-DR3, SLC22A12, etc.) that don't
  appear in Pan-UKBB.

## Quick start

```bash
# 1. Download a phenotype (e.g. heart failure I9_HEARTFAIL)
wget https://storage.googleapis.com/finngen-public-data-r12/summary_stats/finngen_R12_I9_HEARTFAIL.gz

# 2. Harmonise to canonical schema
bash skills/locuscompare-region-render/examples/recipes/finngen_direct/harmonise.sh \
    finngen_R12_I9_HEARTFAIL.gz \
    finngen_R12_I9_HEARTFAIL.canonical.tsv

# 3. Drop in to a locuscompare config
# outcome:
#   trait_label: "heart failure (FinnGen R12 I9_HEARTFAIL)"
#   sumstats_path: "finngen_R12_I9_HEARTFAIL.canonical.tsv.gz"
```

## Caveats

- **Ancestry**: FinnGen is Finnish-EUR. If using 1000G EUR for LD compute,
  expect minor LD discrepancies on common variants (Locke 2019: ~0.05 r² on
  average); on rare variants, the discrepancy can be larger. Surface this
  caveat in your locuscompare config's `caveats:` block or via the
  `provenance:` block — it'll show up in the rendered plot's caveats panel.
- **`af_alt_cases` vs `af_alt_controls`**: this recipe uses `af_alt`
  (population pooled). For balanced trait phenotypes that's fine; for highly
  imbalanced (case fraction < 5%), prefer `af_alt_controls` as the maf
  estimate. Edit the awk mapping accordingly.
- **`rsids`**: FinnGen ships comma-separated rsids when a position is multi-
  mapped in dbSNP. This recipe takes the first; the join key is `variant_id`
  (chr_pos_ref_alt), so this is informational only.

## Sign-check status

FinnGen R12 sumstats are sign-checked against the alt allele as the effect
allele (matches our canonical convention). No flip needed.

## Citation

> Kurki et al. (2023) *FinnGen provides genetic insights from a well-phenotyped
> isolated population.* Nature 613, 508-518. doi:10.1038/s41586-022-05473-8
