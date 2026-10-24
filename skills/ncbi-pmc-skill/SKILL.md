---
name: ncbi-pmc-skill
description: Explain and migrate legacy PMC OA Web Service calls when an old workflow invokes ncbi_pmc.py or oa.fcgi. The service is retired; route current PMC retrieval to paper-lookup or ncbi-entrez-skill.
---

# Retired PMC OA Web Service

NCBI withdrew the PMC OA Web Service (`oa.fcgi`) on **2026-08-25**. Its old
article-availability and FTP-file-link response has no compatible replacement.
Do not retry the retired endpoint, treat its failure as zero matching articles,
or use it to infer a paper's license or retraction status.

## Choose the supported workflow

- For a specific paper's eligible full text, use `paper-lookup` and its
  [PMC guide](../paper-lookup/references/pmc.md). It covers E-utilities, BioC,
  Europe PMC, identifier conversion, and metadata-only responses. Confirm that
  the response contains article text before claiming full-text retrieval.
- For PMC search, identifiers, or metadata, use `ncbi-entrez-skill` with
  `db=pmc`. Do not substitute metadata for unavailable article text.
- For bulk access, consult [PMC Article Datasets](https://pmc.ncbi.nlm.nih.gov/tools/textmining/)
  and the [PMC Cloud Service](https://pmc.ncbi.nlm.nih.gov/tools/cloud/).

## Legacy script behavior

`scripts/ncbi_pmc.py` remains for callers using the old package path. It needs
only Python's standard library, makes no network requests, and never writes a
raw response file. Any JSON object returns `ok=false`, `error.code=service_retired`,
and the supported skill routes, with exit code **1**. Malformed JSON or a
non-object input returns `invalid_json` or `invalid_input`, with exit code **2**.
Legacy options such as `save_raw` do not reactivate the service.

```bash
printf '%s\n' '{"params":{"id":"PMC3257301"}}' | python3 scripts/ncbi_pmc.py
# Expected: structured service_retired error; exit status 1.
```

The folder and source provenance are retained so old references receive an
actionable migration result. Current article lookups belong in the workflows above.

Source: [NCBI service retirement notice](https://pmc.ncbi.nlm.nih.gov/tools/oa-service/).
