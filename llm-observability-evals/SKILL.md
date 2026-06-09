---
name: llm-observability-evals
description: LLM and agent observability, tracing, and evaluation workflows with langfuse, phoenix-cli, and phoenix-evals. Use when instrumenting Langfuse, Phoenix, OpenTelemetry GenAI traces, eval datasets, prompt experiments, latency/cost debugging, trace scoring, or regression testing agent behavior.
---

# LLM Observability + Evals

Use this skill to make LLM and agent behavior measurable. It routes across installed observability skills and provides the evaluation loop that connects traces, datasets, scorers, and regressions.

## Routing

- Use `langfuse` for Langfuse tracing, prompt management, datasets, and production observability.
- Use `phoenix-cli` and `phoenix-evals` for Phoenix tracing/evaluation workflows.
- Use this skill when deciding what to instrument, how to score behavior, or how to turn traces into tests.

## Workflow

1. Define the behavior to measure:
   - task success
   - factuality
   - tool correctness
   - latency
   - cost
   - refusal/guardrail behavior
2. Instrument traces around meaningful spans:
   - user request
   - planner/router decisions
   - retrieval
   - tool calls
   - model calls
   - final answer
3. Capture inputs, outputs, model/provider, token counts, latency, tool arguments, and error states.
4. Build eval datasets from:
   - known regression cases
   - sampled production traces
   - synthetic adversarial cases
   - golden examples from domain experts
5. Add scorers:
   - deterministic checks for schemas, citations, or tool outcomes
   - LLM-as-judge only with rubrics and calibration examples
   - human review for high-risk workflows
6. Run evals before prompt, model, tool, or retrieval changes.

## Reporting

Report pass rate, cost, latency, sample size, scorer definitions, confidence limits where relevant, and the exact prompt/model/tool versions under test.
