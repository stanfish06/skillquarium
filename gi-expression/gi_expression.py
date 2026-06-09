#!/usr/bin/env python3
"""gi-expression: tissue expression prediction via Genomic Intelligence /v1/tasks/expression/predict."""

from __future__ import annotations

import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SKILL_DIR.parent.parent))

from clawbio.gi.gi_runner import run_skill


def main() -> int:
    # The expression model requires a cell-type / assay context. The
    # default matches the bundled K562 fixture; pass --description to
    # override for other tissues / assays.
    return run_skill(
        task="expression",
        demo_path=SKILL_DIR / "example_data" / "expression_hbb_k562.fa",
        default_options={
            "description": (
                "assay term name is polyA plus RNA-seq. "
                "biosample summary is Homo sapiens K562."
            ),
        },
    )


if __name__ == "__main__":
    sys.exit(main())
