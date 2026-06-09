#!/usr/bin/env python3
"""gi-enhancer: enhancer activity prediction via Genomic Intelligence /v1/tasks/enhancer/predict."""

from __future__ import annotations

import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SKILL_DIR.parent.parent))

from clawbio.gi.gi_runner import run_skill


def main() -> int:
    return run_skill(
        task="enhancer",
        demo_path=SKILL_DIR / "example_data" / "enhancer_eve.fa",
    )


if __name__ == "__main__":
    sys.exit(main())
