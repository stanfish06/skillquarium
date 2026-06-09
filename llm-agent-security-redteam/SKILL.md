---
name: llm-agent-security-redteam
description: LLM and agent security red teaming with agentic-actions-auditor, supply-chain-risk-auditor, semgrep, codeql, and sarif-parsing. Use for prompt injection, tool misuse, data exfiltration, excessive agency, insecure output handling, supply-chain risk, retrieval poisoning, and OWASP LLM Top 10 style threat modeling.
---

# LLM Agent Security Red Team

Use this skill when an LLM or agent can read untrusted content, call tools, access private data, modify files, browse the web, or run code. The goal is to identify realistic misuse paths and reduce authority before deployment.

## Routing

- Use `agentic-actions-auditor` for GitHub Actions workflows that run AI agents.
- Use `supply-chain-risk-auditor` for dependency and package takeover risk.
- Use `semgrep`, `codeql`, and `sarif-parsing` for static-analysis backed findings.
- Use this skill for the LLM-specific threat model and adversarial test plan.

## Threat Model

1. List assets:
   - secrets, tokens, credentials
   - private files and repositories
   - customer/user data
   - write-capable tools and deployment paths
2. List untrusted inputs:
   - web pages, docs, PDFs, issues, PR comments, emails, tickets, chat messages
   - retrieved chunks and tool outputs
3. List agent powers:
   - filesystem writes
   - shell/code execution
   - network calls
   - browser actions
   - GitHub/Slack/Drive mutations
4. Test failures:
   - prompt injection
   - cross-tool data exfiltration
   - overbroad tool arguments
   - hidden instructions in retrieved content
   - unsafe generated code or config
   - output that causes downstream execution

## Controls

- Least privilege for tools and tokens.
- Explicit trust boundaries between user instructions, system instructions, retrieved content, and tool output.
- Allowlist tool targets and file paths where possible.
- Human approval for irreversible or external mutations.
- Structured output validation before passing data to downstream tools.
- Regression tests for known attacks.

## Deliverable

Produce a concise risk register with attack path, preconditions, impact, likelihood, evidence, and mitigation. Mark false positives explicitly.
