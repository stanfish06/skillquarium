# Example 03 - Open Targets follow-up (LDLR × fatty-acid composition coloc)

You found this in an Open Targets `target.colocalisation` query:

```
left_studyId:  GCST90499945  (Saturated fatty acids to total fatty acids %; Zoodsma 2025)
right_studyId: gtex_tx_skin_sun_exposed_enst00000559340
h4:            0.965
numberColocalisingVariants: 31
colocalisationMethod:       COLOC_PIP_ECAVIAR
lead_variant:  19_11113815_A_G  (in the LDLR locus, chr19:11.1 Mb)
```

LDLR (low-density lipoprotein receptor) is the cell-surface receptor that
clears LDL particles from circulation; it is the canonical target of statin
therapy (statins upregulate LDLR by inhibiting HMGCR) and of PCSK9
inhibitors (which prevent LDLR degradation). LDLR also influences broader
plasma lipid composition via lipoprotein-turnover machinery: an OT coloc
between LDLR cis-eQTL and a fatty-acid-composition GWAS at the LDLR locus
provides mechanistic evidence for LDLR's regulatory reach across lipid
fractions.

## OT studyId -> fetcher args resolution

This is the operational recipe an agent (or human) applies to turn an OT row
into a locuscompare config:

| OT field | OT value | Resolves to |
|---|---|---|
| `right_studyId` (the QTL credible set) | `gtex_tx_skin_sun_exposed_enst00000559340` | `eqtl_catalogue.dataset_id = QTD000318`; `molecular_trait_id = ENSG00000130164` (LDLR parent ENSG) |
| `left_studyId` (the GWAS credible set) | `GCST90499945` | `gwas_catalog.accession = GCST90499945` (already in OT-native form) |
| `lead_variant` | `19_11113815_A_G` | `lead.variant_id` |

The eQTL Catalogue REST API resolves the GTEx tissue-quant_method tuple to a
dataset_id (`QTS000015` for the GTEx study, `QTD000318` for skin/tx). For
tx-quant studies that name a specific transcript in the OT studyId tail, we
pass the parent ENSG (LDLR = `ENSG00000130164`) so the fetcher returns all
variants tested against any LDLR transcript in the cis-window.

GWAS Catalog accessions starting with `GCST` are already in OT-native form;
no resolution needed.

## Run

```bash
python skills/locuscompare-region-render/cli.py \
    --demo 03_open_targets_followup \
    --output runs/03_open_targets_followup/
```

Or via explicit input:

```bash
python skills/locuscompare-region-render/cli.py \
    --input skills/locuscompare-region-render/examples/03_open_targets_followup/config.yaml \
    --output runs/03_open_targets_followup/
```

## What you should see

A 4-panel PNG anchored at chr19:11113815 (lead = `19_11113815_A_G`, in
the LDLR locus):

- GWAS Manhattan: Zoodsma 2025 fatty-acid signal peaking at the lead
- LDLR-tx Manhattan: the gtex_tx skin-sun-exposed signal peaking at the
  same lead
- Gene track: LDLR rendered bold-red as the focal gene (per the focal-gene
  highlight from `spec.exposure_gene_symbol`)
- LocusCompare scatter: clean diagonal supports H4 (matching the OT
  h4=0.965)
- Effect-size scatter: slope direction reflects the regulatory relationship
  (LDLR expression -> altered lipid-fraction composition); see manifest for
  sign-check

The manifest captures the OT-followup provenance under `provenance.ot_*`
keys plus the `tx` quant-method caveat (the fetcher uses `.cc.tsv.gz`
credible-set-filtered sumstats for tx/sQTL/exon quant methods, so the
rendered window is sparser than a full nominal-pass `ge` run; sufficient for
visual coloc confirmation, see the `eqtl-catalogue-region-fetch` SKILL.md
for details).
