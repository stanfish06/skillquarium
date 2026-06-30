---
name: context-check
description: Use when the user explicitly asks whether the current conversation has mixed tasks, accumulated stale context, or should continue, start fresh, or delegate its next step.
---

# Skills to use if available

- context-engineering
- dispatching-parallel-agents
- other project related skills

# Goal

Give a fast, honest read on the health of THIS conversation's context so the user
can decide whether to keep going, hand work to subagents, or start a new session.
Assess the context you already hold in this session - do not parse transcript
files or spin up a separate model call to judge yourself.

# Boundaries

- Read-only and advisory. Do not edit files, start a new session, compact, or
  spawn subagents as part of this check - only recommend.
- Judge your own in-context history, not the repo. No `git`/`gh` needed unless a
  specific thread happens to be about them.
- Be concise and blunt. This is a quick gut-check, not a long report.
- If the context is actually clean, say so plainly and stop. Do not invent
  problems to look useful.

# Steps to follow

1. Inventory the distinct tasks/threads handled so far this session, one line each.
2. Judge cohesion: are these threads one coherent line of work, or have they
   diverged into unrelated tasks sharing a window by accident?
3. Estimate staleness: roughly how much of the context is now irrelevant to the
   current direction - abandoned approaches, large tool dumps no longer needed,
   resolved tangents, superseded plans.
4. Look ahead: is the likely next step context-heavy (broad file sweeps, log or
   transcript analysis, multi-repo reading, large search fan-out)? If so, flag it
   for subagent delegation so the main thread stays clean.
5. Give one clear, dominant recommendation.

# End with this shape

- `Threads`: the distinct tasks in play (bulleted, one line each).
- `Cohesion`: coherent / drifting / mixed - one sentence why.
- `Staleness`: rough share of context that is now noise, and the main culprits.
- `Verdict`: KEEP GOING / START FRESH / DELEGATE NEXT STEP - pick the dominant one.
- `If starting fresh`: a tight handoff - the few facts and decisions the next
  session must carry over. Omit this line unless recommending a fresh start.
- `Delegate?`: what (if anything) to hand to a subagent and why, else "not needed".
