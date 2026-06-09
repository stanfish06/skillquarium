# Example 04 — fine-mapping chain (ClawBio-internal)

The natural statgen workflow. After running `fine-mapping` on each side of a
candidate colocalization, you want visual confirmation that the credible sets
overlap and the effect sizes line up. `fine-mapping` answers *what* variants
are causal for one signal; `locuscompare` answers *whether* two signals share
the same causal variant.

## Workflow

```bash
# 1. Fine-map the exposure locus
python clawbio.py run fine-mapping \
    --sumstats data/exposure_full_sumstats.tsv \
    --chr 1 --start 109000000 --end 110000000 \
    --ld data/ld_matrix_chr1_109_110.npy \
    --output runs/finemap_exposure/

# 2. Fine-map the outcome locus (same window)
python clawbio.py run fine-mapping \
    --sumstats data/outcome_full_sumstats.tsv \
    --chr 1 --start 109000000 --end 110000000 \
    --ld data/ld_matrix_chr1_109_110.npy \
    --output runs/finemap_outcome/

# 3. Render the regional LocusCompare from both fine-mapping outputs
python skills/locuscompare-region-render/cli.py \
    --input skills/locuscompare-region-render/examples/chains/finemapping_chain/config.yaml \
    --output runs/locuscompare_chain/
```

## What you should see

If the two credible sets co-localize:
- Tight diagonal in the cross-trait `-log10p` scatter
- Effect-size scatter aligned with the IVW slope from MR (if you ran it)
- The lead variants from both fine-mapping runs colocalize at the same position
- The locuscompare manifest reports the credible-set boundaries from both PIPs files

If they don't co-localize (a "false coloc" caught by the visualization):
- The `-log10p` scatter shows two separate clusters (one trait peaks, the other doesn't)
- The Manhattan peaks are at different positions despite high coloc.h4
- This is the canonical use case for the visual sanity check — sometimes high h4 is driven by background polygenic signal that fine-mapping localizes differently

## Why this is the most natural ClawBio chain

`fine-mapping` and `locuscompare` are complementary:
- `fine-mapping`: input is one trait's sumstats slice; output is credible sets + PIPs.
- `locuscompare`: input is two traits' sumstats slices; output is regional visual + harmonised pairs.

The TSV slices that `fine-mapping` consumes are exactly the canonical schema
that `locuscompare` consumes (per `INPUT_SCHEMA.md`). You do not need to
re-fetch or re-harmonise; just point at the same files.

## Notes

- Both fine-mapping runs MUST use the same window and the same coordinate
  build (GRCh38). The lead variant ID format must match across both sides.
- The `fine_mapping_outputs:` block in the config is optional. If supplied,
  locuscompare reads `pips.tsv` from each fine-mapping output and highlights
  credible-set members in the rendered figure.
