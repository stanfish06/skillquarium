# nfcore-rnaseq-wrapper — demo

```bash
python clawbio.py run rnaseq-pipeline --demo --output /tmp/rnaseq_demo
```

Uses the upstream nf-core/rnaseq `-profile test` dataset (no local files
required; no real patient or sample data is bundled in this repository).
Requires Docker (running) + Nextflow >=25.04.3.
