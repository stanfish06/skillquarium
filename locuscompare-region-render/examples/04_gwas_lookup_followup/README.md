# Example 05 — gwas-lookup follow-up

You ran `gwas-lookup rs<id>`, saw a striking GWAS + eQTL pair in its CSV
tables, and want to visualize the regional pattern around that variant.

## Workflow

```bash
# 1. Look up the rsID across 9 databases
python clawbio.py run gwas-lookup --rsid rs646776 --output runs/gwas_lookup/

# 2. Inspect what gwas-lookup found
cat runs/gwas_lookup/tables/gwas_associations.csv | head
cat runs/gwas_lookup/tables/eqtl_associations.csv | head

# Example outputs:
# gwas_associations.csv:  GCST90269602, "cholesterol in medium VLDL", p=2e-50, beta=-0.0627
# eqtl_associations.csv:  QTD000276, SORT1, "minor salivary gland", p=8e-30, beta=+0.602

# 3. Pick the strongest co-localizing (GWAS accession, eQTL dataset) pair, encode
#    in a locuscompare config, render the regional plot
python skills/locuscompare-region-render/cli.py \
    --input examples/04_gwas_lookup_followup/config.yaml \
    --output runs/locuscompare_rs646776/
```

## Translation: gwas-lookup output → locuscompare config

`gwas-lookup`'s CSV columns map directly to locuscompare's bundled-fetcher
config blocks:

| gwas-lookup column | locuscompare config field |
|---|---|
| `eqtl_associations.csv: dataset` | `exposure.fetch.dataset_id` |
| `eqtl_associations.csv: gene_id` | `exposure.fetch.molecular_trait_id` |
| `eqtl_associations.csv: tissue` | `exposure.trait_label` (decorative) |
| `gwas_associations.csv: study_accession` | `outcome.fetch.accession` |
| `gwas_associations.csv: traits` | `outcome.trait_label` (decorative) |
| `resolved_variant.json: chr_pos` | `lead.chromosome`, `lead.position_bp` |
| `resolved_variant.json: alleles` | `lead.variant_id` (`<chr>_<pos>_<ref>_<alt>`) |

## What you gain

- `gwas-lookup`'s output is per-variant: it tells you THIS variant matters in
  these N studies, but not whether two specific studies have a co-localizing
  signal at that variant.
- `locuscompare`'s output is regional: it shows whether the GWAS and eQTL
  signals share the same causal architecture across the whole locus.

The combination is more informative than either alone.

## Notes

- gwas-lookup's eQTL Catalogue calls return per-rsID rows, NOT regional sumstats;
  locuscompare's bundled fetcher pulls the actual region (~3K variants) via
  tabix-on-FTP. The two skills hit the same source via different access
  patterns. See the project root's `docs/` for the architectural rationale.
- If you want to inspect multiple co-localizing pairs from one gwas-lookup run,
  write one config per pair and render them in a loop.
