---
title: officecli-financial-model
aliases:
  - officecli financial model
tags:
  - skill
  - domain/documents-office
domain: documents-office
status: untried
source: officecli-financial-model/SKILL.md
created: 2026-07-11
---

# officecli-financial-model

> [!info] What it does
> Use this skill when the user wants to build a financial model — 3-statement model, DCF valuation, LBO, SaaS unit economics, sensitivity / scenario analysis, debt schedule, or fundraising projections — in Excel. Trigger on: 'financial model', '3-statement model', 'P&L + BS + CF', 'DCF', 'WACC', 'NPV', 'terminal value', 'LBO', 'debt schedule', 'cash sweep', 'MOIC', 'IRR / XIRR', 'sensitivity table', 'scenario analysis', 'ARR model', 'unit economics', 'CAC / LTV', 'cap table forecast'. Output is a single formula-driven .xlsx. This skill is a scene layer on top of officecli-xlsx — it inherits every xlsx v2 rule (4-color code, visual floor, number formats, cache-drift, Known Issues, Delivery Gate minimum cycle). DO NOT invoke for a simple budget tracker, CSV dump, or operational KPI sheet — route those to officecli-xlsx base.

**Source:** [officecli-financial-model/SKILL.md](officecli-financial-model/SKILL.md)  ·  **Domain:** [Documents, Office & Media](maps/documents-office.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

- [officecli-xlsx](officecli-xlsx.md) — Use this skill any time a .xlsx file is involved -- as input, output, or both
- [xlsx](xlsx.md) — Spreadsheet toolkit (.xlsx/.csv). Create/edit with formulas/formatting, analyze data, visualization, recalculate formulas, for spreadsheet processing and analysis

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

