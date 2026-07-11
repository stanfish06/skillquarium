---
title: officecli-word-form
aliases:
  - officecli word form
  - SDT
tags:
  - skill
  - domain/documents-office
domain: documents-office
status: untried
source: officecli-word-form/SKILL.md
created: 2026-07-11
---

# officecli-word-form

> [!info] What it does
> Use this skill to create fillable Word forms (.docx) with real Content Controls (SDT) + legacy FormField checkboxes + MERGEFIELD mail-merge placeholders + document protection. Trigger on: 'fillable form', 'form fields', 'content controls', 'SDT', 'word form', 'fill in', 'only editable fields', 'protect document', 'onboarding form', 'HR intake', 'survey template', 'contract / SOW template', 'mail-merge template', 'compliance checklist', 'medical intake questionnaire'. Output is a single .docx where specific fields are editable and the rest is locked. This skill is INDEPENDENT, not a scene layer on docx — payload is `<w:sdt>` + `<w:ffData>` + `<w:fldChar>` + `documentProtection`, none of which docx base skill covers. Do NOT trigger for regular reports, letters, memos, academic papers, pitch decks, or any document with no user-fillable fields — route those to officecli-docx or its scene layers.

**Source:** [officecli-word-form/SKILL.md](officecli-word-form/SKILL.md)  ·  **Domain:** [Documents, Office & Media](maps/documents-office.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [docx](docx.md) — Document toolkit (.docx). Create/edit documents, tracked changes, comments, formatting preservation, text extraction, for professional document processing
- [officecli-docx](officecli-docx.md) — Use this skill any time a .docx file is involved -- as input, output, or both

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

