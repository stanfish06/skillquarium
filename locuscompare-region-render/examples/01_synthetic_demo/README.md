# Example 01 — Synthetic offline demo

A 200-variant synthetic locus where exposure and outcome share a known
co-localizing causal variant at chr1:500000:A>T. No network calls; no external
data dependencies; runs in seconds. Used for `--demo` smoke-tests and CI.

## Run

```bash
# Via the ClawBio runner (uses 02 as the default; pick 01 explicitly via the skill CLI):
python skills/locuscompare-region-render/cli.py --demo 01_synthetic_demo --output /tmp/locuscompare_demo

# Or equivalently:
python skills/locuscompare-region-render/cli.py --input examples/01_synthetic_demo/config.json --output /tmp/locuscompare_demo
```

## What's bundled

- `config.json` — the skill's config pointing at the local fixture files.
- `exposure.tsv` — synthetic exposure sumstats slice in canonical INPUT_SCHEMA TSV format.
- `outcome.tsv` — synthetic outcome sumstats slice with a deliberately injected co-localizing signal.
- `ld_matrix.tsv` — synthetic pairwise r² matrix between the lead and every other variant.
- `genes.tsv` — synthetic gene track (3 protein-coding genes spanning the window).
- `generate_synthetic_fixtures.py` — deterministic regenerator (seed=20260524); re-run after schema changes.

## What you should see

A 4-panel PNG where:
- Both Manhattans peak at chr1:500000.
- The cross-trait `-log10p` scatter shows a tight diagonal correlation.
- The effect-size scatter shows a clean positive slope.
- LD coloring shows an orange (high) → blue (low) gradient radiating from the lead.

The synthetic generator is deterministic (fixed RNG seed); the produced figure
is byte-stable across runs and used as a golden-parity offline smoke check.
