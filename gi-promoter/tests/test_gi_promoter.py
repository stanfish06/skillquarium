"""Tests for gi-promoter.

Marked ``integration`` because the demo hits the real GI API (https://api.genomicintelligence.ai).
Run with: ``pytest skills/gi-promoter/tests/ -v -m integration``
Deselect in air-gapped CI: ``pytest -m "not integration"``.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

SKILL_DIR = Path(__file__).resolve().parents[1]
SCRIPT = SKILL_DIR / "gi_promoter.py"
DEMO_INPUT = SKILL_DIR / "example_data" / "promoter_tp53.fa"


def test_demo_input_exists():
    """The bundled demo FASTA must ship with the skill."""
    assert DEMO_INPUT.exists(), f"missing demo fixture at {DEMO_INPUT}"
    assert DEMO_INPUT.stat().st_size > 1000, "demo fixture suspiciously small"


def test_skill_module_imports():
    """The skill's Python module must import cleanly (catches syntax / import errors)."""
    result = subprocess.run(
        [sys.executable, "-c", "import importlib.util as u, sys; "
         f"s=u.spec_from_file_location('m', r'{SCRIPT}'); m=u.module_from_spec(s); s.loader.exec_module(m); "
         "sys.exit(0 if hasattr(m, 'main') else 1)"],
        capture_output=True, text=True,
    )
    assert result.returncode == 0, f"import failed: {result.stderr}"


@pytest.mark.integration
def test_demo_mode_end_to_end(tmp_path):
    """Real call to api.genomicintelligence.ai/v1/tasks/promoter/predict."""
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--demo", "--output", str(tmp_path)],
        capture_output=True, text=True, timeout=60,
    )
    assert result.returncode == 0, f"stderr: {result.stderr}"
    assert (tmp_path / "report.md").exists()
    assert (tmp_path / "result.json").exists()
    assert (tmp_path / "reproducibility" / "command.sh").exists()
    body = json.loads((tmp_path / "result.json").read_text())
    assert body["summary"]["task"] == "promoter"
    assert body["summary"]["model"].startswith("g0-promoter")
    assert "total_windows" in body["summary"]["raw_summary"]
