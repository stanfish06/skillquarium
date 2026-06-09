---
title: Systematic literature review
tags:
  - recipe
  - domain/literature-discovery
created: 2026-06-09
---

# Systematic literature review

> [!abstract] Goal
> Turn a research question into a synthesized, properly cited literature review.

[Back to Recipes](index.md)  ·  [Skill Index](../index.md)

## Pipeline

```mermaid
flowchart LR
  A[Question] --> B[Search] --> C[Screen] --> D[Synthesize] --> E[Cite] --> F[Write]
```

## Steps

1. **[research-lookup](../research-lookup.md)** / **[paper-lookup](../paper-lookup.md)** — search across PubMed, arXiv, Crossref, Semantic Scholar, etc.
2. **[lit-synthesizer](../lit-synthesizer.md)** — synthesize results into a structured report with a citation graph. Full pipeline: **[literature-review](../literature-review.md)**.
3. **[citation-management](../citation-management.md)** / **[pyzotero](../pyzotero.md)** — verify and manage references (BibTeX/Zotero).
4. **[scientific-writing](../scientific-writing.md)** — write the review in flowing prose.

## Ingest & summarize

- **[defuddle](../defuddle.md)**, **[markitdown](../markitdown.md)**, **[liteparse](../liteparse.md)** — pull clean text from web pages and PDFs.
- **[pubmed-summariser](../pubmed-summariser.md)** — quick briefings for a gene or disease term.
