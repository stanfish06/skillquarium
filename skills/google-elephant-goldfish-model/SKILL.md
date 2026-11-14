---
name: google-elephant-goldfish-model
description: Pointer to Google's Elephant-Goldfish Model (EGM) plugin, installed as a Claude Code or Codex plugin rather than copied into this vault. EGM drafts software design specs with full project context (Elephant) and reviews them with fresh-context subagents that never saw the conversation (Goldfish). Use when the user wants to brainstorm a feature into a design doc, draft a spec section by section, run a fresh-eyes review of a design doc, README, or PR plan against the code, check docs for drift from the code, bootstrap directory READMEs, or mentions EGM, egm-review, or elephant-goldfish.
---

# google-elephant-goldfish-model

EGM ([google/elephant-goldfish-model](https://github.com/google/elephant-goldfish-model), Apache-2.0,
site [egm.dev](https://egm.dev)) is a plugin of skills, reviewer persona prompts, and document standards. This vault does not copy it: the skills read `agents/`, `resources/`, and `docs/`
from the plugin root at run time, so a skills-only copy breaks. Install the whole plugin.

## What it does

- **Elephant** is the main session. It holds the project context and drafts the spec.
- **Goldfish** reviewers are subagents started with no parent conversation. Each reads one persona,
  the target document, the standards, and the source files the document cites, then reports gaps.
- **You** pick which findings to fix and approve the design before anyone implements it.

| Skill | Does |
| --- | --- |
| `egm-brainstorm` | Clarifying questions and Goldfish challenges on an idea; writes `concepts_brief.md` |
| `egm-draft` | Turns the brief (or notes) into `design_draft.md`, one section at a time with a pause for feedback |
| `egm-review` | Phased Goldfish review of a doc: overall picture, comprehension, design critique, implementation readiness |
| `egm-resolve` | Takes the reviewers' findings and applies the fixes you approve |
| `egm-review-loop` | Review-and-fix loop against standards you choose; works for docs other than software specs |
| `egm-drift-report` | Compares every design doc or README in a folder with the current code and reports divergence |
| `egm-bootstrap` | Creates or corrects directory `README.md` files across a repo subtree |

The usual flow is brainstorm → draft → review → resolve. `egm-review` and `egm-drift-report` also
work on existing docs with no EGM history.

## Install

Plugin installs write to the agent's own config directories, outside this vault. Show the user the
commands and let them run them. Start a new session afterwards.

Claude Code (needs a version with the `omitClaudeMd` agent option EGM uses to isolate reviewers; upstream
`docs/claude.md` names the minimum):

```sh
claude plugin marketplace add google/elephant-goldfish-model
claude plugin install egm@egm
claude plugin enable egm@egm        # if it installed disabled
```

Codex CLI:

```sh
codex plugin marketplace add google/elephant-goldfish-model
codex plugin add egm@egm
```

ChatGPT and Codex desktop apps install the
[published EGM plugin](https://chatgpt.com/plugins/plugins_6aeb90f47ec88191a3c107e01d3eb357) instead.
Antigravity, Claude Cowork, ChatGPT workspace import, omp, and Muse are covered in the upstream
[harness guide](https://github.com/google/elephant-goldfish-model/blob/main/docs/harnesses.md).

Update:

```sh
claude plugin marketplace update egm && claude plugin update egm@egm
codex plugin marketplace upgrade egm
```

## Run

Every EGM skill sets `disable-model-invocation: true`, so the agent does not start one on its own.
The user starts it:

- Claude Code: type the prefixed command, e.g. `/egm:egm-review docs/designs/webhooks.md`.
- Codex: pick the EGM skill from the skill picker; there is no `/egm:` prefix.

If the plugin is not installed yet, give the install commands above for the agent in use and stop.
Brainstorm and review need a session that can start subagents.

## Known limits

- In Codex, `fork_context: false` / `fork_turns: "none"` drops the parent turns but may not drop
  instruction files: [#237](https://github.com/google/elephant-goldfish-model/issues/237) reports
  project and user `AGENTS.md` reaching reviewers. Until that is fixed, a large `AGENTS.md`, like
  this vault's, reaches every Goldfish.
- Artifacts go to the working directory unless the prompt or `AGENTS.md` has a line
  `EGM artifact directory: <path>`.
- Per-harness details: [docs/claude.md](https://github.com/google/elephant-goldfish-model/blob/main/docs/claude.md),
  [docs/codex.md](https://github.com/google/elephant-goldfish-model/blob/main/docs/codex.md).
