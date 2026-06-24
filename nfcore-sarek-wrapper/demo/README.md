# nfcore-sarek-wrapper — demo

```bash
python clawbio.py run sarek-pipeline --demo --output /tmp/sarek_demo
```

Uses the upstream nf-core/sarek `-profile test` dataset (no local files
required; no real patient or sample data is bundled in this repository).
Requires Docker (running) + Nextflow >=25.10.2. Takes ~5-10 minutes on a
workstation.
