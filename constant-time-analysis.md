---
title: constant-time-analysis
aliases:
  - constant time analysis
tags:
  - skill
  - domain/security-auditing
domain: security-auditing
status: untried
source: constant-time-analysis/SKILL.md
created: 2026-06-09
---

# constant-time-analysis

> [!info] What it does
> Detects timing side-channel vulnerabilities in cryptographic code. Use when implementing or reviewing crypto code, encountering division on secrets, secret-dependent branches, or constant-time programming questions in C, C++, Go, Rust, Swift, Java, Kotlin, C#, PHP, JavaScript, TypeScript, Python, or Ruby.

**Source:** [constant-time-analysis/SKILL.md](constant-time-analysis/SKILL.md)  ·  **Domain:** [Security & Auditing](maps/security-auditing.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

_None auto-detected. Add your own links here, e.g. `[scanpy](scanpy.md)`._

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

> [!note] Vault audit 2026-07-24 — USE-9
> Use this for the runnable static-analysis pass that flags timing side-channels in crypto source; for the dynamic-statistical testing methodology / tool survey use `constant-time-testing`. Distinguishing axis: static analyzer vs testing methodology.
