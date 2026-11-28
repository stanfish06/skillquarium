---
title: k6-browser-test
aliases:
  - k6 browser test
tags:
  - skill
  - domain/cloud-devops
domain: cloud-devops
status: untried
source: skills/k6-browser-test/SKILL.md
created: 2026-11-28
---

# k6-browser-test

> [!info] What it does
> Generate a working k6 browser test (k6/browser) from a plain-language description of a user journey — no CSS selectors or technical detail needed. Explores the LIVE target site with a throwaway k6/browser session to discover real, verified selectors (getByRole/getByLabel/getByText, etc.), dismisses cookie/consent banners, then writes a functional or load test using expect() from k6-testing (Web-Vitals thresholds for load). Looks up k6/browser APIs via `k6 x docs`; validates with `k6 run`. Use when the user wants to write, author, or generate a k6 browser/UI or load test with a real browser, or says things like "write a browser test for…", "test this login/checkout/search flow with k6", "click through my site and verify…", or describes navigating a site in prose. For a full multi-test performance suite use k6-perf-test-website; for HTTP/protocol (non-browser) tests use the general k6 skills; for browser or scripted checks in Grafana Cloud Synthetic Monitoring, use synthetic-monitoring-checks.

**Source:** [skills/k6-browser-test/SKILL.md](../../../skills/k6-browser-test/SKILL.md)  ·  **Domain:** [Cloud, Infra & MLOps](../../maps/cloud-devops.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [k6](../../notes/cloud-devops/k6.md) — Generate, validate, and review k6 test scripts — load, stress, spike, soak, smoke, breakpoint, functional, and protocol
- [k6-perf-test-website](../../notes/cloud-devops/k6-perf-test-website.md) — Use when the user wants to performance-test, load-test, or stress-test a public website end-to-end with k6
- [k6-test-maintenance](../../notes/cloud-devops/k6-test-maintenance.md) — Maintain and improve existing k6 test scripts
- [synthetic-monitoring-checks](../../notes/cloud-devops/synthetic-monitoring-checks.md) — Author Grafana Cloud Synthetic Monitoring checks, with deep coverage of k6 scripted and browser checks: SM's single-VU/single-iteration execution model, assertions that actually fail...

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
