---
title: pptx
tags:
  - skill
  - domain/documents-office
domain: documents-office
status: untried
source: skills/pptx/SKILL.md
created: 2026-06-09
---

# pptx

> [!info] What it does
> Presentation toolkit (.pptx). Create/edit slides, layouts, content, speaker notes, comments, for programmatic presentation creation and modification.

**Source:** [skills/pptx/SKILL.md](../../../skills/pptx/SKILL.md)  ·  **Domain:** [Documents, Office & Media](../../maps/documents-office.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [morph-ppt](../../notes/documents-office/morph-ppt.md) — Use this skill when the user wants a .pptx with smooth cross-slide animation — PowerPoint Morph transitions, Keynote-style continuous motion, shapes that grow / move / rotate as the...
- [nature-paper2ppt](../../notes/academic-pipelines/nature-paper2ppt.md) — Build a complete Nature-style Chinese PPTX presentation from a scientific paper, preprint, PDF, article text, figure legends, or reading notes
- [officecli](../../notes/documents-office/officecli.md) — Create, analyze, proofread, and modify Office documents (.docx, .xlsx, .pptx) using the officecli CLI tool
- [officecli-pitch-deck](../../notes/documents-office/officecli-pitch-deck.md) — Use this skill when the user is building a fundraising / investor pitch deck — seed, Series A / B / C, convertible note, SAFE round, strategic raise
- [officecli-pptx](../../notes/documents-office/officecli-pptx.md) — Use this skill any time a .pptx file is involved -- as input, output, or both
- [pptx-posters](../../notes/research-writing/pptx-posters.md) — Creates and audits editable scientific posters in macro-free PowerPoint (.pptx) from author-approved local content and assets
- [sharepoint-powerpoint](../../notes/comms-productivity/sharepoint-powerpoint.md) — Create, edit, restyle, and review PowerPoint `.pptx` files fetched from SharePoint, with emphasis on style preservation, slide cloning, theme-aware updates, and rendered visual QA

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

> [!note] Vault audit 2026-07-24 — USE-1
> Use this as the raw-OOXML fallback — low-level .pptx inspection and text extraction; for authoring or richly formatting slide decks use the canonical `officecli-pptx` (scene layers: `officecli-pitch-deck`, `morph-ppt`). Distinguishing axis: raw OOXML processing vs officecli deck generation.

> [!note] Vault audit 2026-07-24 — MNT-8
> The "Visual Enhancement with Scientific Schematics" block in the source skill (hardcoded `scripts/generate_schematic.py` path) is copy-pasted across docx/pptx/xlsx/pdf and can drift; for schematic/diagram generation cross-reference the `scientific-schematics` skill rather than relying on the duplicated block.
