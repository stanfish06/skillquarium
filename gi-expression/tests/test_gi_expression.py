"""Tests for gi-expression. Marked ``integration`` — hits the real GI API."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

SKILL_DIR = Path(__file__).resolve().parents[1]
SCRIPT = SKILL_DIR / "gi_expression.py"
DEMO_INPUT = SKILL_DIR / "example_data" / "expression_hbb_k562.fa"


def test_demo_input_exists():
    assert DEMO_INPUT.exists()
    assert DEMO_INPUT.stat().st_size > 1000


def test_skill_module_imports():
    result = subprocess.run(
        [sys.executable, "-c", "import importlib.util as u, sys; "
         f"s=u.spec_from_file_location('m', r'{SCRIPT}'); m=u.module_from_spec(s); s.loader.exec_module(m); "
         "sys.exit(0 if hasattr(m, 'main') else 1)"],
        capture_output=True, text=True,
    )
    assert result.returncode == 0, f"import failed: {result.stderr}"


@pytest.mark.integration
def test_demo_mode_predicts_high_hbb_k562_expression(tmp_path):
    """HBB in K562 should report HIGH expression (gene-sense FASTA + K562 description).
    A regression here usually means the strand or description wiring broke."""
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--demo", "--output", str(tmp_path)],
        capture_output=True, text=True, timeout=60,
    )
    assert result.returncode == 0, f"stderr: {result.stderr}"
    body = json.loads((tmp_path / "result.json").read_text())
    log_tpm = body["summary"].get("log_tpm")
    assert log_tpm is not None and log_tpm > 2.0, (
        f"HBB-in-K562 should report log(TPM+1) > 2.0; got {log_tpm}. "
        "Check that the FASTA is RC'd to gene-sense and the default description is reaching the API."
    )
