---
title: research-lookup
aliases:
  - research lookup
tags:
  - skill
  - domain/literature-discovery
domain: literature-discovery
status: untried
source: skills/research-lookup/SKILL.md
created: 2026-06-09
---

# research-lookup

> [!info] What it does
> Compiles current scholarly evidence for a scientific manuscript or research brief when the user explicitly asks to gather literature, references, background evidence, competing findings, or a manuscript research packet. Uses Parallel Search by default, Parallel Extract for source retrieval, Parallel Research for explicitly deep/exhaustive work, optional explicit Parallel Chat, and optional Perplexity only when requested or allowed as a failure fallback.

**Source:** [skills/research-lookup/SKILL.md](../../../skills/research-lookup/SKILL.md)  ·  **Domain:** [Literature Search & Knowledge Discovery](../../maps/literature-discovery.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [infographics](../../notes/documents-office/infographics.md) — Create professional infographics using Nano Banana Pro AI with smart iterative refinement
- [research](../../notes/software-dev/research.md) — Investigate a question against high-trust primary sources and capture the findings as a Markdown file in the repo

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

> [!note] Vault audit 2026-07-24 — USE-4
> Explicit alias — this is a thin router over `parallel-web` (dispatching to parallel-cli search or the Parallel deep-research API); prefer `parallel-web` directly, use `exa-search` for Exa-backed scholarly filtering, and `paper-lookup` for a scholarly-DB paper hunt. Distinguishing axis: convenience wrapper, not a separate backend.
