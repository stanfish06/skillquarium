# Example 02 — eQTL Catalogue × GWAS Catalog (canonical chain)

The headline real-data path. Bundled fetchers handle all data retrieval; you
supply only the dataset ids and the lead variant.

## The biology

**SORT1 × cholesterol-VLDL** is the canonical 1p13.3 LDL/CHD locus from
Musunuru et al. 2010 *Nature*: minor allele at rs646776 → increased hepatic
SORT1 expression → reduced plasma LDL/VLDL. One of the most-cited cis-eQTL ×
trait colocalizations in the post-GWAS era.

This example uses the GTEx minor-salivary-gland eQTL (the strongest h4 hit in
Open Targets 26.03 standard-tier coloc rows for SORT1 × VLDL-chol). Liver
would be the textbook tissue but the OT h4-retention threshold drops the
liver row in the current release. The biology is interpretable either way:
SORT1 expression direction is what matters.

## Run

```bash
python skills/locuscompare-region-render/cli.py \
    --input examples/02_eqtl_catalogue_x_gwas_catalog/config.yaml \
    --output runs/sort1_vldl/
```

Network requirements (all public, no auth):
- eQTL Catalogue FTP — for the QTD000276 SORT1 region slice
- GWAS Catalog FTP — for the GCST90269602 region slice
- 1000G FTP — for the chr1 region VCF (LD compute)
- Ensembl REST or GENCODE FTP — for the gene track

Total bytes fetched per run: ~10-50 MB (cached after first run).

## What you should see

- Top panel: cholesterol-VLDL Manhattan with a sharp peak around chr1:109274968.
- Middle panel: SORT1 minor-salivary-gland eQTL Manhattan, peak co-localizing.
- Gene track: SORT1, PSRC1, CELSR2, MYBPHL spanning the window.
- Cross-trait `-log10p` scatter: tight diagonal at the top-right (lead variant).
- Effect-size scatter: negative slope (β_eQTL > 0, β_GWAS < 0 = inverse SORT1↑→LDL↓).

Manifest will record `n_pairs ~1100`, `n_palindromic_excluded ~150`, `h4=0.998`
(if h4 supplied via Open Targets).

## License + citation notes

- eQTL Catalogue data: CC-BY 4.0. Cite Kerimov 2021 Nat Genet.
- GWAS Catalog data: open-access. Cite Sollis 2023 NAR.
- 1000G data: open-access. Cite 1000G Consortium 2015 Nature.
- GENCODE: open-access. Cite Frankish 2021 NAR.
