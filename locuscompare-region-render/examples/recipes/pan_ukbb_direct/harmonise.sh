#!/usr/bin/env bash
# Harmonise a Pan-UKBB phenotype TSV (bgz) into the canonical locuscompare
# schema, selecting one ancestry's columns.
#
# Usage:
#   ./harmonise.sh <PAN_UKBB_TSV_BGZ> <ANCESTRY> <OUTPUT_TSV>
#   ANCESTRY ∈ {meta, EUR, AFR, AMR, CSA, EAS, MID}

set -euo pipefail

INPUT="${1:?first arg: input pan-ukbb tsv.bgz}"
ANC="${2:?second arg: ancestry code (meta|EUR|AFR|AMR|CSA|EAS|MID)}"
OUTPUT="${3:?third arg: output tsv}"

BETA_COL="beta_${ANC}"
SE_COL="se_${ANC}"
P_COL="pval_${ANC}"
AF_COL="af_${ANC}"

printf "# locuscompare-schema-version: 1.0\n# source: pan_ukbb_direct\n# ancestry: %s\n" "${ANC}" > "${OUTPUT}"
printf "variant_id\tchromosome\tposition_bp\tallele_a\tallele_b\tbeta\tse\tp\teaf\n" >> "${OUTPUT}"

zcat "${INPUT}" \
  | awk -v B="${BETA_COL}" -v S="${SE_COL}" -v P="${P_COL}" -v A="${AF_COL}" '
      BEGIN { FS="\t"; OFS="\t" }
      NR == 1 { for (i=1; i<=NF; i++) col[$i] = i; next }
      {
        chrom = $col["chr"]; sub(/^chr/, "", chrom)
        pos   = $col["pos"]
        a     = $col["ref"]
        b     = $col["alt"]
        beta  = $col[B]
        se    = $col[S]
        p     = $col[P]
        eaf   = $col[A]
        if (beta == "NA" || se == "NA" || p == "NA") next
        if (eaf == "0" || eaf == "1") next
        variant_id = chrom "_" pos "_" a "_" b
        print variant_id, chrom, pos, a, b, beta, se, p, eaf
      }' >> "${OUTPUT}"

sort -k2,2V -k3,3n "${OUTPUT}" > "${OUTPUT}.sorted"
mv "${OUTPUT}.sorted" "${OUTPUT}"
bgzip -f "${OUTPUT}"
tabix -s 2 -b 3 -e 3 "${OUTPUT}.gz"

echo "harmonised TSV written to ${OUTPUT}.gz (+ .tbi)"
