# /// script
# requires-python = ">=3.11"
# dependencies = ["inspect-ai==0.3.283"]
# ///
"""Run an offline two-sample Inspect eval and verify persisted passing/failing scores."""

import argparse
import json
from pathlib import Path

from inspect_ai import Task, eval, task
from inspect_ai.dataset import Sample
from inspect_ai.log import read_eval_log
from inspect_ai.model import ModelOutput, get_model
from inspect_ai.scorer import match
from inspect_ai.solver import generate


@task
def arithmetic() -> Task:
    return Task(
        dataset=[
            Sample(
                id="pass",
                input="What is 2 + 2? Reply with the number only.",
                target="4",
            ),
            Sample(
                id="fail",
                input="What is 2 + 3? Reply with the number only.",
                target="5",
            ),
        ],
        solver=generate(),
        scorer=match(location="exact"),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--log-dir", type=Path, default=Path("inspect-smoke-logs"))
    args = parser.parse_args()
    model = get_model(
        "mockllm/model",
        custom_outputs=[
            ModelOutput.from_content(model="mockllm", content="4"),
            ModelOutput.from_content(model="mockllm", content="incorrect"),
        ],
    )
    # Serialize samples so mock responses are assigned deterministically.
    logs = eval(arithmetic(), model=model, max_samples=1, log_dir=str(args.log_dir))
    assert len(logs) == 1 and logs[0].status == "success", logs
    saved = read_eval_log(logs[0].location)
    assert saved.samples is not None and len(saved.samples) == 2
    scores = {
        str(sample.id): next(iter(sample.scores.values())).value
        for sample in saved.samples
        if sample.scores
    }
    assert scores == {"pass": "C", "fail": "I"}, scores
    assert saved.results is not None
    accuracy = saved.results.scores[0].metrics["accuracy"].value
    assert accuracy == 0.5, accuracy
    print(
        json.dumps(
            {
                "status": saved.status,
                "scores": scores,
                "accuracy": accuracy,
                "log": logs[0].location,
            },
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
