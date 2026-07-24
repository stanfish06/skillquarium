---
title: paper-lookup
aliases:
  - paper lookup
tags:
  - skill
  - domain/literature-discovery
domain: literature-discovery
status: untried
source: paper-lookup/SKILL.md
created: 2026-06-09
---

# paper-lookup

> [!info] What it does
> Search 10 academic literature APIs for papers, preprints, citations, and open-access full text, and return results with reproducible provenance. Covers PubMed, PMC (full text), bioRxiv, medRxiv, arXiv, OpenAlex, Crossref, Semantic Scholar, CORE, Unpaywall. Use when searching for papers, citations, DOI/PMID/arXiv lookups, abstracts, full text, open-access PDFs, preprints, citation graphs, author publications, or any scholarly literature query. Triggers on mentions of any supported database or requests like "find papers on X", "look up this DOI", "who cites this paper", or "get me the PDF".

**Source:** [paper-lookup/SKILL.md](paper-lookup/SKILL.md)  ·  **Domain:** [Literature Search & Knowledge Discovery](maps/literature-discovery.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [pdf](pdf.md) — PDF manipulation toolkit. Extract text/tables, create PDFs, merge/split, fill forms, for programmatic document processing and analysis

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

> [!note] Vault audit 2026-07-24 — USE-4
> Use this for a multi-DB scholarly search across 10 APIs (PubMed, PMC, bioRxiv, arXiv, OpenAlex, Crossref…) with DOI/PMID/citation-graph lookups; for a single PubMed query use `pubmed-search`, and for a synthesized briefing/report use `pubmed-summariser` or `lit-synthesizer`. Distinguishing axis: single query vs multi-DB lookup vs synthesized report.
