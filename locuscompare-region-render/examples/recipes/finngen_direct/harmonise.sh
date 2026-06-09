#!/usr/bin/env bash
# Harmonise a FinnGen direct-download phenotype TSV into the canonical
# locuscompare schema. See ../../INPUT_SCHEMA.md for the target format.
#
# Usage:
#   ./harmonise.sh <FINNGEN_PHENOTYPE_TSV_GZ> <OUTPUT_TSV>
#
# Requires: bash, awk, bgzip, tabix.

set -euo pipefail

INPUT_TSV_GZ="${1:?first arg: input FinnGen phenotype tsv.gz}"
OUTPUT_TSV="${2:?second arg: output tsv (will be bgzip-compressed)}"

# FinnGen R12 native columns (per https://finngen.gitbook.io/documentation/data-download):
#   #chrom  pos  ref  alt  rsids  nearest_genes  pval  mlogp  beta  sebeta  af_alt  af_alt_cases  af_alt_controls
#
# Mapping to locuscompare canonical:
#   #chrom        -> chromosome (strip "chr" if present)
#   pos           -> position_bp
#   ref           -> allele_a
#   alt           -> allele_b (effect allele in FinnGen)
#   beta          -> beta
#   sebeta        -> se
#   pval          -> p
#   af_alt        -> eaf (effect-allele frequency)
#   rsids         -> rsid (first id only if comma-separated)
#   <synthesised> -> variant_id = chrom_pos_ref_alt

# Header
printf "# locuscompare-schema-version: 1.0\n# source: finngen_direct\n" > "${OUTPUT_TSV}"
printf "variant_id\tchromosome\tposition_bp\tallele_a\tallele_b\tbeta\tse\tp\teaf\trsid\n" >> "${OUTPUT_TSV}"

# Body
zcat "${INPUT_TSV_GZ}" \
  | awk 'BEGIN { FS="\t"; OFS="\t" }
         NR == 1 { for (i=1; i<=NF; i++) col[$i] = i; next }
         {
           chrom  = $col["#chrom"]; sub(/^chr/, "", chrom)
           pos    = $col["pos"]
           a      = $col["ref"]
           b      = $col["alt"]
           beta   = $col["beta"]
           se     = $col["sebeta"]
           p      = $col["pval"]
           eaf    = $col["af_alt"]
           rsid   = $col["rsids"]; split(rsid, ra, ","); rsid = ra[1]
           variant_id = chrom "_" pos "_" a "_" b
           print variant_id, chrom, pos, a, b, beta, se, p, eaf, rsid
         }' >> "${OUTPUT_TSV}"

# Sort + bgzip + tabix
sort -k2,2V -k3,3n "${OUTPUT_TSV}" > "${OUTPUT_TSV}.sorted"
mv "${OUTPUT_TSV}.sorted" "${OUTPUT_TSV}"
bgzip -f "${OUTPUT_TSV}"
tabix -s 2 -b 3 -e 3 "${OUTPUT_TSV}.gz"

echo "harmonised TSV written to ${OUTPUT_TSV}.gz (+ .tbi)"
