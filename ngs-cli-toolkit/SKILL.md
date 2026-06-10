---
name: ngs-cli-toolkit
description: The core command-line NGS workhorses for going from raw reads to variants — bwa-mem2/minimap2/bowtie2 (alignment), samtools (BAM sort/index/stats/view), bcftools (VCF call/filter/normalize/query), GATK4 (BQSR, HaplotypeCaller, best practices), and plink2 (genotype QC, PCA, GWAS). Use for read alignment, BAM/CRAM manipulation, variant calling and VCF wrangling on the command line. For Python-native BAM/VCF access use pysam; for full managed pipelines use the nf-core wrappers.
---

# NGS command-line toolkit

## Overview

The aligners and variant tools that pipelines like [[nfcore-sarek-wrapper]] orchestrate,
used directly. Install everything via [[conda-bioconda]] (`samtools bcftools bwa-mem2
minimap2 bowtie2 gatk4 plink2`). For programmatic access from Python use [[pysam]]; for
interval arithmetic use [[pybedtools]]. This skill is the hands-on CLI layer.

Canonical short-read DNA flow: **FASTQ → (bwa-mem2) → sorted BAM → (GATK) → VCF → (bcftools)
→ filtered VCF**. Always work on a sorted, indexed, **reference-matched** BAM.

## Alignment

```bash
# Short reads (DNA): bwa-mem2 is the drop-in faster BWA-MEM
bwa-mem2 index ref.fa
bwa-mem2 mem -t 8 -R '@RG\tID:s1\tSM:sample1\tPL:ILLUMINA\tLB:lib1' \
    ref.fa r1.fq.gz r2.fq.gz | samtools sort -@4 -o s1.bam -
samtools index s1.bam

# Long reads (ONT/PacBio): minimap2 with the right preset
minimap2 -ax map-ont  ref.fa reads.fq.gz | samtools sort -o ont.bam -   # nanopore
minimap2 -ax map-hifi ref.fa hifi.fq.gz  | samtools sort -o hifi.bam -  # PacBio HiFi
# RNA short reads -> use STAR/HISAT2 (see bulk-rnaseq), not bwa.
```

The **`@RG` read group with `SM` is mandatory** for GATK — without it HaplotypeCaller and
joint genotyping fail or mislabel samples.

## samtools — BAM/CRAM workhorse

```bash
samtools sort -@8 -o sorted.bam in.bam        # coordinate sort (needed for index/calling)
samtools index sorted.bam                      # .bai
samtools view -b -q 20 -f 2 -F 0x900 in.bam    # MAPQ>=20, proper pairs, drop secondary/suppl.
samtools flagstat sorted.bam                    # quick mapping summary
samtools stats sorted.bam | grep ^SN            # detailed metrics (feed to MultiQC)
samtools markdup -@8 fixmate.bam dedup.bam      # dedup (run samtools fixmate -m first)
samtools depth -a sorted.bam | awk '{s+=$3} END{print s/NR}'   # mean depth
samtools faidx ref.fa                            # .fai index (needed by many tools)
# CRAM (smaller, reference-based) — always keep the matching reference:
samtools view -T ref.fa -C -o out.cram sorted.bam
```

## bcftools — VCF/BCF workhorse

```bash
# Lightweight calling (mpileup model) — fine for simple germline / quick looks:
bcftools mpileup -f ref.fa -a AD,DP sorted.bam | bcftools call -mv -Oz -o calls.vcf.gz
bcftools index calls.vcf.gz

# ALWAYS left-align + split multiallelics before annotating/comparing:
bcftools norm -f ref.fa -m -both -Oz -o norm.vcf.gz calls.vcf.gz

bcftools filter -e 'QUAL<30 || INFO/DP<10' -Oz -o filt.vcf.gz norm.vcf.gz
bcftools view -f PASS -r chr1:1-1000000 filt.vcf.gz
bcftools query -f '%CHROM\t%POS\t%REF\t%ALT[\t%GT]\n' filt.vcf.gz   # tabular extraction
bcftools stats filt.vcf.gz                      # ts/tv, counts (feed to MultiQC)
bcftools isec -p out_dir a.vcf.gz b.vcf.gz      # compare two callsets
```

`bcftools norm -m -both` (split multiallelics + left-align) is the single most important
hygiene step — skipping it causes silent mismatches in [[variant-annotation]] and merges.

## GATK4 — best-practices germline (short variants)

```bash
gatk MarkDuplicates -I s1.bam -O dedup.bam -M dup_metrics.txt
gatk BaseRecalibrator -I dedup.bam -R ref.fa --known-sites known.vcf.gz -O recal.table
gatk ApplyBQSR -I dedup.bam -R ref.fa --bqsr-recal-file recal.table -O recal.bam
gatk HaplotypeCaller -I recal.bam -R ref.fa -O s1.g.vcf.gz -ERC GVCF   # per-sample GVCF
# Joint genotyping across a cohort:
gatk CombineGVCFs -R ref.fa -V s1.g.vcf.gz -V s2.g.vcf.gz -O cohort.g.vcf.gz
gatk GenotypeGVCFs -R ref.fa -V cohort.g.vcf.gz -O cohort.vcf.gz
```

The reference needs a `.fai` (`samtools faidx`) **and** a `.dict`
(`gatk CreateSequenceDictionary`). For somatic calling use `Mutect2`; for whole pipelines
prefer [[nfcore-sarek-wrapper]].

## plink2 — genotype QC, PCA, association

```bash
plink2 --vcf cohort.vcf.gz --make-pgen --out cohort           # import to plink2 format
plink2 --pfile cohort --geno 0.05 --mind 0.1 --maf 0.01 \
       --hwe 1e-6 --make-pgen --out qc                        # standard QC filters
plink2 --pfile qc --pca 10 --out pca                          # ancestry PCs (covariates)
plink2 --pfile qc --glm --pheno pheno.txt --covar pca.eigenvec --out gwas   # association
```

For downstream GWAS region work and PRS see [[gwas-pipeline]], [[gwas-prs]], and
[[fine-mapping]].

## Gotchas

- **Reference consistency:** the *same* `ref.fa` (and contig naming — `chr1` vs `1`) must be
  used for alignment, calling, and annotation. Mixed conventions are the #1 silent failure.
- **Sort before index/call.** Most "could not retrieve index" errors mean an unsorted or
  un-indexed BAM.
- **Normalize VCFs** (`bcftools norm -m -both -f ref.fa`) before annotate/merge/compare.
- **Read groups:** set `@RG` at alignment time; retrofitting later is painful.
- **bgzip + tabix**, not plain gzip, for any region-queryable VCF/BED.
- **QC everything:** route `samtools stats` / `bcftools stats` / fastp logs through
  [[multiqc-reporter]].

## Related

CLI layer beneath [[nfcore-sarek-wrapper]] and [[bulk-rnaseq]]; Python equivalents in
[[pysam]] and [[pybedtools]]; environments via [[conda-bioconda]]; annotation via
[[variant-annotation]]/[[vcf-annotator]].
