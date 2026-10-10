---
title: pdf
tags:
  - skill
  - domain/documents-office
domain: documents-office
status: untried
source: skills/pdf/SKILL.md
created: 2026-06-09
---

# pdf

> [!info] What it does
> PDF manipulation toolkit. Extract text/tables, create PDFs, merge/split, fill forms, for programmatic document processing and analysis.

**Source:** [skills/pdf/SKILL.md](../../../skills/pdf/SKILL.md)  ·  **Domain:** [Documents, Office & Media](../../maps/documents-office.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [academic-paper](../../notes/academic-pipelines/academic-paper.md) — 12-agent academic paper writing pipeline
- [cite-check](../../notes/literature-discovery/cite-check.md) — Cite-checks a brief, motion, or memo (PDF/Word): verifies each cited case is real, supports the proposition, is good law, and quoted accurately
- [exa-search](../../notes/literature-discovery/exa-search.md) — Searches scientific and technical web content with Exa and extracts page or PDF text from URLs in batches
- [firecrawl-parse](../../notes/web-automation-frontend/firecrawl-parse.md) — Convert a local file (PDF, DOCX, XLSX, HTML, …) to markdown, or answer questions about its content
- [latex-posters](../../notes/research-writing/latex-posters.md) — Creates research posters in LaTeX using beamerposter, tikzposter, or baposter
- [liteparse](../../notes/documents-office/liteparse.md) — Local document and PDF parsing with spatial text and bounding boxes
- [literature-review](../../notes/literature-discovery/literature-review.md) — Conducts systematic, scoping, and narrative literature reviews using PubMed, arXiv, bioRxiv, Semantic Scholar, and other appropriate sources
- [markitdown](../../notes/documents-office/markitdown.md) — Converts heterogeneous documents and selected URIs to Markdown with Microsoft MarkItDown for text analysis, search, and LLM/RAG ingestion
- [matplotlib](../../notes/data-science-compute/matplotlib.md) — Creates and customizes scientific plots with Matplotlib
- [nature-figure](../../notes/academic-pipelines/nature-figure.md) — Create, revise, audit, and export submission-grade scientific figures for Nature-family and other high-impact venues in Python (matplotlib/seaborn) or R...
- [nature-paper2ppt](../../notes/academic-pipelines/nature-paper2ppt.md) — Build a complete Nature-style Chinese PPTX presentation from a scientific paper, preprint, PDF, article text, figure legends, or reading notes
- [nature-reader](../../notes/academic-pipelines/nature-reader.md) — Build full-paper Chinese-English side-by-side, figure/table-aware, source-grounded Markdown readers for journal or conference papers from PDF, DOI, arXiv, publisher HTML, or pasted text
- [neo4j-import-skill](../../notes/analytics-engineering/neo4j-import-skill.md) — Import structured data into Neo4j — LOAD CSV, CALL IN TRANSACTIONS, neo4j-admin database import full (offline bulk), apoc.load.csv/json, apoc.periodic.iterate, driver batch writes
- [paper-2-web](../../notes/research-writing/paper-2-web.md) — Use when converting academic papers into promotional and presentation formats including interactive websites (Paper2Web), presentation videos (Paper2Video), and conference posters...
- [paper-lookup](../../notes/literature-discovery/paper-lookup.md) — Searches 18 scholarly APIs for papers, preprints, citations, open-access full text, repository records, and journal OA status, and returns results with reproducible provenance
- [pyzotero](../../notes/research-writing/pyzotero.md) — Manages Zotero reference libraries using the pyzotero Python client: retrieves, creates, updates, and deletes items, collections, tags, and attachments via the Zotero Web API v3 or...
- [report-template](../../notes/documents-office/report-template.md) — Publication-quality PDF report generation using Typst templates
- [sec-report](../../notes/proteomics-metabolomics/sec-report.md) — SEC (size-exclusion chromatography) analysis with peak detection, oligomer classification, and publication-quality PDF report generation via Typst templates
- [twilio-enterprise-knowledge](../../notes/saas-platforms/twilio-enterprise-knowledge.md) — Use when building Twilio Enterprise Knowledge workflows for AI or human agents, including provisioning a knowledge base, adding website, PDF, or text sources, semantic search, or...
- [venue-templates](../../notes/research-writing/venue-templates.md) — Prepares journal manuscripts, conference papers, research posters, and grant documents using venue-specific formatting guidance and bundled LaTeX scaffolds
- [wes-clinical-report-en](../../notes/clinical-medical/wes-clinical-report-en.md) — Generates professional clinical PDF reports in English from WES (Whole Exome Sequencing) data with clinical interpretation summary, pharmacogenomic alerts, and follow-up recommendations
- [wes-clinical-report-es](../../notes/clinical-medical/wes-clinical-report-es.md) — Generates professional clinical PDF reports in Spanish from WES (Whole Exome Sequencing) data with clinical interpretation, pharmacogenomic alerts, and follow-up recommendations

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

> [!note] Vault audit 2026-07-24 — USE-1
> Use this for PDF-specific work — extract text/tables, merge/split, fill forms, create PDFs programmatically (no officecli PDF equivalent exists); for authoring .docx/.pptx/.xlsx use the canonical `officecli` family. Distinguishing axis: PDF manipulation vs officecli Office-document generation.

> [!note] Vault audit 2026-07-24 — MNT-8
> The "Visual Enhancement with Scientific Schematics" block in the source skill (hardcoded `scripts/generate_schematic.py` path) is copy-pasted across docx/pptx/xlsx/pdf and can drift; for schematic/diagram generation cross-reference the `scientific-schematics` skill rather than relying on the duplicated block.
