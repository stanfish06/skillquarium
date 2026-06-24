# nfcore-scrnaseq-wrapper — demo

```bash
python clawbio.py run scrnaseq-pipeline --demo --output /tmp/scrnaseq_demo
```

Uses the upstream nf-core/scrnaseq `-profile test` dataset (no local files
required; no real patient or sample data is bundled in this repository).
Requires Docker (running) + Nextflow >=25.04.0.
