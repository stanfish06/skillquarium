"""Tests for gi-annotation. Marked ``integration`` — hits the real GI API (async ~20 s)."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

SKILL_DIR = Path(__file__).resolve().parents[1]
SCRIPT = SKILL_DIR / "gi_annotation.py"
DEMO_INPUT = SKILL_DIR / "example_data" / "annotation_tp53.fa"


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
def test_demo_mode_end_to_end(tmp_path):
    """Async submit → poll → terminal. Takes ~20 s; allow 5 min for cold-start."""
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--demo", "--output", str(tmp_path)],
        capture_output=True, text=True, timeout=300,
    )
    assert result.returncode == 0, f"stderr: {result.stderr}"
    body = json.loads((tmp_path / "result.json").read_text())
    assert body["summary"]["task"] == "annotation"
    assert body["summary"].get("transcripts_found", 0) >= 1
