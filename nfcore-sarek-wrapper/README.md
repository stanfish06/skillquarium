# nfcore-sarek-wrapper

ClawBio wrapper around `nf-core/sarek` 3.8.1 covering mapping through annotation for germline, tumor-only, and somatic paired variant-calling analyses.

## Quick start

```bash
# See every supported flag (173-flag surface: 154 Sarek passthrough + 19 wrapper controls)
python skills/nfcore-sarek-wrapper/nfcore_sarek_wrapper.py --help

# Synthetic demo using the upstream -profile test dataset
python clawbio.py run sarek-pipeline --demo --output /tmp/sarek_demo
```

`clawbio.py run sarek-pipeline` promotes the common flags to first-class options; any other sarek parameter is passed through with `--extra-param key=value`.

See `SKILL.md` in this directory for trigger phrases, samplesheet schema per step, the full CLI reference, gotchas (ASCAT-WES, Mutect2 PON, GATK Spark + UMI, iGenomes default, somatic status pairing, `--demo` reference clearing), profile composition rules, downstream chaining, and the §1–§6 output layout.
