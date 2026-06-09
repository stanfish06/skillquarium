# 07: sceQTL × GWAS: SORT1 in OneK1K CD14+ monocytes × cholesterol-VLDL

**v1.3 multi-modality demo, family 3 of 4**: shows that the same
locuscompare orchestrator that handles bulk-tissue eQTL renders also
handles single-cell eQTL studies. eQTL Catalogue v7+ harmonised the
OneK1K, Perez_2022, Nathan_2022, and Randolph_2021 single-cell cohorts
into the same `ge`-quant schema as bulk GTEx, so the orchestrator
needs no new code path; only a new YAML mapping row.

## What this demo proves

> Any OT coloc row referencing a single-cell eQTL study (OneK1K,
> Perez_2022, Nathan_2022, Randolph_2021) is renderable today, no
> auth required.

## OT coloc row resolved

| Field | Value |
|-------|-------|
| OT studyId (exposure) | `onek1k_ge_cd14_mono_ensg00000134243` |
| OT studyId (outcome) | `GCST90269602` |
| Pattern | `<study>_<quant>_<sample>_<ensg>` |
| Mapping row | `study_id_mappings.yaml` (caller-supplied, see `load_study_id_mappings`) |

## Upstream studies

- **Exposure**: eQTL Catalogue v7+ dataset `QTD000609` (OneK1K CD14+
  monocytes ge-sceQTL). CD14+ monocyte was chosen among the 24
  OneK1K PBMC cell-type datasets because monocytes have non-trivial
  baseline SORT1 expression. Verified live against
  https://www.ebi.ac.uk/eqtl/api/v2/datasets/?size=1000 on
  2026-05-15.
- **Outcome**: GWAS Catalog harmonised `GCST90269602`
  (cholesterol in medium VLDL).
- **LD**: 1000G Phase 3 GRCh38, super-pop EUR.

## How to run

```bash
python skills/locuscompare-region-render/cli.py \
    --input skills/locuscompare-region-render/examples/06_sceqtl_sort1_onek1k_cd14_mono/config.yaml \
    --output runs/sceqtl_sort1_onek1k/
```

No auth required.

## Caveats

- Single-cell eQTL signals are often weaker than bulk-tissue signals
  at the same locus because per-cell-type sample sizes are smaller
  (OneK1K's CD14+ monocyte cohort is ~50× smaller than GTEx liver).
  The renderer may degrade to Tier-1 (CS-only) if fewer than 5
  joinable variants emerge.
- CD14+ monocyte is not the SORT1 textbook tissue (hepatocytes are).
  Picked for renderability + cell-type granularity, not biological
  canonicality.
