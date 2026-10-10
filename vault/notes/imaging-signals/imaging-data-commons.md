---
title: imaging-data-commons
aliases:
  - imaging data commons
tags:
  - skill
  - domain/imaging-signals
domain: imaging-signals
status: untried
source: skills/imaging-data-commons/SKILL.md
created: 2026-06-09
---

# imaging-data-commons

> [!info] What it does
> Queries and downloads public cancer imaging data from NCI Imaging Data Commons. Supports IDC collection discovery, DICOM access, radiology (CT, MR, PET) and pathology AI datasets, metadata SQL, visualization, licensing, and citations. Uses public metadata and download routes without authentication; optional BigQuery and Google Healthcare routes require Google credentials.

**Source:** [skills/imaging-data-commons/SKILL.md](../../../skills/imaging-data-commons/SKILL.md)  ·  **Domain:** [Imaging, Microscopy & Biosignals](../../maps/imaging-signals.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [citations](../../notes/literature-discovery/citations.md) — Canonical rules and HTML/CSS contract for inline `[n]` citation references, end-of-document Citations blocks, and optional per-section citation recaps used across Moody's Agentic...

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

> [!warning] Vault audit 2026-07-24 — MNT-5
> Version self-contradiction: frontmatter/intro say idc-index 0.12.3 / IDC data v24, but the version-check code, "Tested with", and Best Practices say v23 / 0.11.14. Treat idc-index 0.12.3 / data v24 as current and disregard the stale v23/0.11.14 mentions until upstream reconciles.
> _Remote-managed skill — the durable fix belongs upstream; this wrapper note is the local record._
