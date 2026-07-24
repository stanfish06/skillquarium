---
title: database-lookup
aliases:
  - database lookup
tags:
  - skill
  - domain/bio-databases-platforms
domain: bio-databases-platforms
status: untried
source: database-lookup/SKILL.md
created: 2026-06-09
---

# database-lookup

> [!info] What it does
> Query documented public database APIs with explicit endpoints, filters, pagination, and provenance. Use when a scientific, regulatory, financial, or other database-backed fact must be retrieved reproducibly from a named source rather than inferred from general knowledge.

**Source:** [database-lookup/SKILL.md](database-lookup/SKILL.md)  ·  **Domain:** [Bio Databases, Lab & Cloud Platforms](maps/bio-databases-platforms.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

_None auto-detected. Add your own links here, e.g. `[scanpy](scanpy.md)`._

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

> [!note] Vault audit 2026-07-24 — USE-6
> Use this as the explicit FALLBACK for a documented database that has NO dedicated skill; when one exists, defer to it (`query-uniprot`, `query-pdb`, `query-ensembl`, `query-clinvar`, `query-opentarget`, … the `query-*` family, plus `clinpgx` for PGx). Distinguishing axis: dedicated `query-*` skill vs generic fallback.
