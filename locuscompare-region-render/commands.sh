#!/usr/bin/env bash
# Reproducibility bundle for locuscompare runs.
#
# Each invocation of `locuscompare.py --input <config> --output <dir>` writes
# a copy of THIS file to `<dir>/reproducibility/commands.sh` with the actual
# arguments substituted. Re-running the saved file reproduces the analysis
# byte-for-byte (modulo network-fetched data; cached artefacts are SHA-256-
# pinned in `<dir>/reproducibility/checksums.sha256`).

set -euo pipefail

# Run the bundled offline demo:
python skills/locuscompare-region-render/cli.py --demo --output /tmp/locuscompare_demo

# Or run with a real config:
# python skills/locuscompare-region-render/cli.py \
#     --input <CONFIG_PATH> \
#     --output <OUTPUT_DIR>
