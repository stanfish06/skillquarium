#!/usr/bin/env bash
# Harmonise a GTEx v10 cis-eQTL allpairs.tsv.bgz into the canonical schema,
# filtering to one gene of interest.
#
# Usage:
#   ./harmonise.sh <ALLPAIRS_BGZ> <ENSG_VERSIONED> <OUTPUT_TSV>
#   ENSG_VERSIONED e.g. ENSG00000134243.16

set -euo pipefail

INPUT="${1:?first arg: input GTEx allpairs.tsv.bgz}"
GENE="${2:?second arg: ENSG.version (e.g. ENSG00000134243.16)}"
OUTPUT="${3:?third arg: output tsv}"

printf "# locuscompare-schema-version: 1.0\n# source: gtex_v10_direct\n# molecular_trait_id: %s\n" "${GENE}" > "${OUTPUT}"
printf "variant_id\tchromosome\tposition_bp\tallele_a\tallele_b\tbeta\tse\tp\tmolecular_trait_id\n" >> "${OUTPUT}"

zcat "${INPUT}" \
  | awk -v G="${GENE}" '
      BEGIN { FS="\t"; OFS="\t" }
      NR == 1 { for (i=1; i<=NF; i++) col[$i] = i; next }
      $col["phenotype_id"] != G { next }
      {
        v = $col["variant_id"]
        # parse chr1_500000_A_T_b38 -> chrom, pos, ref, alt
        n = split(v, parts, "_")
        if (n < 5) next
        chrom = parts[1]; sub(/^chr/, "", chrom)
        pos   = parts[2]
        a     = parts[3]
        b     = parts[4]
        beta  = $col["slope"]
        se    = $col["slope_se"]
        p     = $col["pval_nominal"]
        if (beta == "NaN" || se == "NaN" || p == "NaN") next
        variant_id = chrom "_" pos "_" a "_" b
        print variant_id, chrom, pos, a, b, beta, se, p, G
      }' >> "${OUTPUT}"

sort -k2,2V -k3,3n "${OUTPUT}" > "${OUTPUT}.sorted"
mv "${OUTPUT}.sorted" "${OUTPUT}"
bgzip -f "${OUTPUT}"
tabix -s 2 -b 3 -e 3 "${OUTPUT}.gz"

echo "harmonised TSV written to ${OUTPUT}.gz (+ .tbi)"
