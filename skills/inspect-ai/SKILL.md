---
name: inspect-ai
description: Write, run and diagnose local LLM evaluations with Inspect AI using tasks, datasets, solvers, scorers and saved eval logs. Use for custom eval harnesses, deterministic mock checks, bounded model runs and comparing sample-level failures.
metadata:
  version: "1.0"
  last-reviewed: "2026-10-24"
---

# Inspect AI

Requires Python 3.11+. Examples target inspect-ai 0.3.283.

Use Inspect for executable evaluations expressed as datasets, solver behavior and
scoring rules. Start with the behavior and failure cases to measure. A successful
eval run means the harness completed; incorrect answers remain normal scored
samples, while provider/tool failures are errors that need separate diagnosis.

Commands referencing `scripts/` are relative to this skill's folder.

## Install and prove the harness locally

```bash
uv venv .venv
uv pip install --python .venv/bin/python 'inspect-ai==0.3.283'
.venv/bin/python scripts/smoke_eval.py --log-dir ./inspect-smoke-logs
```

The bundled task generates two deterministic mock responses. It verifies one
correct score (`C`), one incorrect score (`I`), accuracy `0.5`, and scores read back
from the persisted `.eval` log. It needs no API key, GPU, external dataset, or model
download. Alternatively run `uv run scripts/smoke_eval.py` using its pinned script
dependency. This tests installation, generation, scoring and log persistence,
not a real model's quality.

## Build the smallest task that measures the behavior

Use `scripts/smoke_eval.py` as a runnable task skeleton. Replace its `Sample`
records with representative cases and keep stable sample IDs. Its `main()`
contains mock verification; the decorated `arithmetic()` task is also discoverable
by the `inspect eval` CLI.

| Component | Decision |
| --- | --- |
| Dataset | `Sample(input=..., target=..., id=..., metadata=...)`; use `json_dataset`/`csv_dataset` with explicit field mappings for real files. Keep split/version and any exclusions. |
| Solver | `generate()` for a direct model response; compose a solver list when prompts, tool use or agent behavior are part of the experiment. |
| Scorer | `match(location="exact")` for exact answers; `choice()` for labelled multiple choice; write a custom scorer when outputs need parsing or structured checks. |
| Model grading | Use only when deterministic checks are inadequate; select and record the grader model, rubric and calibration examples separately. |

Keep references and answer labels out of model-visible input. Include negative,
ambiguous and failure cases as well as easy successes. Avoid tuning a solver or
rubric against the final held-out sample set.

See the official [task](https://inspect.aisi.org.uk/tasks.html),
[dataset](https://inspect.aisi.org.uk/datasets.html),
[solver](https://inspect.aisi.org.uk/solvers.html) and
[scorer](https://inspect.aisi.org.uk/scorers.html) guides for the chosen component.

## Run a bounded real evaluation

Choose the provider/model and budget from the user's environment; install only
the provider dependency it requires. Inspect does not automatically supply
credentials for a named provider. Check available flags before using a different
Inspect version:

```bash
.venv/bin/inspect eval --help
.venv/bin/inspect eval scripts/smoke_eval.py --model PROVIDER/MODEL \
  --limit 2 --max-connections 1 --max-tokens 64 --log-dir ./logs
```

Replace `PROVIDER/MODEL` with the selected supported model ID. The task's mock
`main()` does not run under this CLI command. `--max-tokens` limits generation;
sample `token_limit`, `message_limit`, `time_limit` and `cost_limit` bound broader
agent interactions. Confirm which limit applies before a large tool-using run.
Do not interpret a small smoke sample as an estimate of benchmark performance.

For an existing Hugging Face benchmark/backend workflow, use
`huggingface-community-evals`; use this skill to implement the custom task and
inspect its scoring/log behavior.

## Inspect results before reporting a score

```bash
.venv/bin/inspect view --log-dir ./logs
```

For scripted analysis, `read_eval_log(path)` returns the run specification,
sample transcripts, scores, results and errors. Read individual samples when a
metric changes; aggregate accuracy can conceal parse failures or systematic
errors on one slice. Keep provider errors and incomplete samples visible rather
than treating them as correct, zero-cost, or absent observations.

Report model/provider, task/dataset version, solver/scorer settings, sample count,
run status, metric, and log location. Compare runs on the same IDs and settings;
use enough cases/epochs and uncertainty estimates for the decision being made.
Logs can contain dataset content, model responses and tool output; choose their
storage and sharing location to match that data.

## Diagnose the layer that failed

| Symptom | Inspect |
| --- | --- |
| No tasks found | `@task`, module path/import errors and the selected environment. |
| Model/provider failure | Selected model ID, provider package, environment credentials, connectivity and logged retry/error detail. |
| Unexpected zero score | Actual completion, answer extraction, target formatting and scorer choice; add a known-correct and known-incorrect example. |
| Mock responses mismatch samples | Set `max_samples=1`, or use a callable mock keyed to each prompt. |
| Run never finishes | Sample/task limits, tool timeout, pending sandbox process and provider concurrency; inspect job status and current logs. |
| Need to rerun failed work | Use the documented retry/eval-set workflow while keeping original logs; record any model/config changes. |

Tool-using evaluations may execute untrusted generated code. Use Inspect's
[sandbox configuration](https://inspect.aisi.org.uk/sandboxing.html) when the task
needs execution; a plain `generate()` task does not need a sandbox. For custom
scorers and tools, exercise both success and failure paths before expanding a run.

Primary references: [model providers](https://inspect.aisi.org.uk/models.html),
[limits](https://inspect.aisi.org.uk/setting-limits.html),
[logs](https://inspect.aisi.org.uk/eval-logs.html), and
[source](https://github.com/UKGovernmentBEIS/inspect_ai).
