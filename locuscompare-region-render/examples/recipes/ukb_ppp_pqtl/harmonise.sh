#!/usr/bin/env bash
# Harmonise a UKB-PPP cis-pQTL TSV into the canonical locuscompare schema.
# Yellow-license source; output carries a `# license: yellow ukb_ppp` header.

set -euo pipefail

INPUT="${1:?first arg: input UKB-PPP tsv.gz}"
OUTPUT="${2:?second arg: output tsv}"

printf "# locuscompare-schema-version: 1.0\n# source: ukb_ppp_pqtl\n# license: yellow ukb_ppp\n" > "${OUTPUT}"
printf "variant_id\tchromosome\tposition_bp\tallele_a\tallele_b\tbeta\tse\tp\tn\n" >> "${OUTPUT}"

zcat "${INPUT}" \
  | awk 'BEGIN { FS="\t"; OFS="\t" }
         NR == 1 { for (i=1; i<=NF; i++) col[$i] = i; next }
         {
           chrom = $col["CHROM"]; sub(/^chr/, "", chrom)
           pos   = $col["POS"]
           ref   = $col["REF"]
           alt   = $col["ALT"]
           a1    = $col["A1"]
           beta  = $col["BETA"]
           se    = $col["SE"]
           p     = $col["P"]
           n     = $col["OBS_CT"]
           if (a1 != alt) { beta = -beta }
           variant_id = chrom "_" pos "_" ref "_" alt
           print variant_id, chrom, pos, ref, alt, beta, se, p, n
         }' >> "${OUTPUT}"

sort -k2,2V -k3,3n "${OUTPUT}" > "${OUTPUT}.sorted"
mv "${OUTPUT}.sorted" "${OUTPUT}"
bgzip -f "${OUTPUT}"
tabix -s 2 -b 3 -e 3 "${OUTPUT}.gz"

echo "harmonised TSV written to ${OUTPUT}.gz (+ .tbi)"
