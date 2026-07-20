---
title: Security & Auditing
tags:
  - skill-map
created: 2026-06-13
---

# Security & Auditing

> [!abstract] Scope
> Secure development, code auditing, static analysis, SARIF, fuzzing, agent security, supply-chain risk, and smart-contract review helpers.

[Back to Skill Index](../index.md)

**Related maps:** [Cloud, Infra & MLOps](cloud-devops.md) | [Vault, Skills & Workflow Meta](vault-meta.md) | [Analytics Engineering & LLM Operations](analytics-engineering.md) | [Web Automation, Frontend & Design](web-automation-frontend.md)

## Skills (36)

- [aflpp](../aflpp.md) — AFL++ is a fork of AFL with better fuzzing performance and advanced features
- [agentic-actions-auditor](../agentic-actions-auditor.md) — Audits GitHub Actions workflows for security vulnerabilities in AI agent integrations including Claude Code Action, Gemini CLI, OpenAI Codex, and GitHub AI Inference
- [atheris](../atheris.md) — Atheris is a coverage-guided Python fuzzer based on libFuzzer
- [audit-context-building](../audit-context-building.md) — Enables ultra-granular, line-by-line code analysis to build deep architectural context before vulnerability or bug finding
- [audit-prep-assistant](../audit-prep-assistant.md) — Prepares codebases for security review using Trail of Bits' checklist
- [c-review](../c-review.md) — Performs comprehensive C/C++ security review for memory corruption, integer overflows, race conditions, and platform-specific vulnerabilities
- [cargo-fuzz](../cargo-fuzz.md) — cargo-fuzz is the de facto fuzzing tool for Rust projects using Cargo
- [code-maturity-assessor](../code-maturity-assessor.md) — Systematic code maturity assessment using Trail of Bits' 9-category framework
- [codeql](../codeql.md) — Scans a codebase for security vulnerabilities using CodeQL's interprocedural data flow and taint tracking analysis
- [constant-time-analysis](../constant-time-analysis.md) — Detects timing side-channel vulnerabilities in cryptographic code
- [constant-time-testing](../constant-time-testing.md) — Constant-time testing detects timing side channels in cryptographic code
- [coverage-analysis](../coverage-analysis.md) — Coverage analysis measures code exercised during fuzzing
- [differential-review](../differential-review.md) — Performs security-focused differential review of code changes (PRs, commits, diffs)
- [entry-point-analyzer](../entry-point-analyzer.md) — Analyzes smart contract codebases to identify state-changing entry points for security auditing
- [fp-check](../fp-check.md) — Systematically verifies suspected security bugs to eliminate false positives, producing a TRUE POSITIVE or FALSE POSITIVE verdict with documented evidence for each
- [fuzzing-dictionary](../fuzzing-dictionary.md) — Fuzzing dictionaries guide fuzzers with domain-specific tokens
- [fuzzing-obstacles](../fuzzing-obstacles.md) — Techniques for patching code to overcome fuzzing obstacles
- [gh-cli](../gh-cli.md) — Enforces authenticated gh CLI workflows over unauthenticated curl/WebFetch patterns
- [guidelines-advisor](../guidelines-advisor.md) — Smart contract development advisor based on Trail of Bits' best practices
- [harness-writing](../harness-writing.md) — Techniques for writing effective fuzzing harnesses across languages
- [insecure-defaults](../insecure-defaults.md) — Detects fail-open insecure defaults (hardcoded secrets, weak auth, permissive security) that allow apps to run insecurely in production
- [libfuzzer](../libfuzzer.md) — Coverage-guided fuzzer built into LLVM for C/C++ projects
- [llm-agent-security-redteam](../llm-agent-security-redteam.md) — LLM and agent security red teaming with agentic-actions-auditor, supply-chain-risk-auditor, semgrep, codeql, and sarif-parsing
- [ossfuzz](../ossfuzz.md) — OSS-Fuzz provides free continuous fuzzing for open source projects
- [property-based-testing](../property-based-testing.md) — Provides guidance for property-based testing across multiple languages and smart contracts
- [sarif-parsing](../sarif-parsing.md) — Parses and processes SARIF files from static analysis tools like CodeQL, Semgrep, or other scanners
- [secure-workflow-guide](../secure-workflow-guide.md) — Guides through Trail of Bits' 5-step secure development workflow
- [security-and-hardening](../security-and-hardening.md) — Hardens code against vulnerabilities. Use when handling user input, authentication, data storage, or external integrations
- [semgrep](../semgrep.md) — Run Semgrep static analysis scan on a codebase using parallel subagents
- [semgrep-rule-creator](../semgrep-rule-creator.md) — Creates custom Semgrep rules for detecting security vulnerabilities, bug patterns, and code patterns
- [sharp-edges](../sharp-edges.md) — Identifies error-prone APIs, dangerous configurations, and footgun designs that enable security mistakes
- [spec-to-code-compliance](../spec-to-code-compliance.md) — Verifies code implements exactly what documentation specifies for blockchain audits
- [supply-chain-risk-auditor](../supply-chain-risk-auditor.md) — Identifies dependencies at heightened risk of exploitation or takeover
- [token-integration-analyzer](../token-integration-analyzer.md) — Token integration and implementation analyzer based on Trail of Bits' token integration checklist
- [variant-analysis](../variant-analysis.md) — Find similar vulnerabilities and bugs across codebases using pattern-based analysis
- [zeroize-audit](../zeroize-audit.md) — Detects missing zeroization of sensitive data in source code and identifies zeroization removed by compiler optimizations, with assembly-level analysis, and control-flow verification
