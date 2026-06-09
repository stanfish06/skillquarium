"""Tests for gi-splice. Marked ``integration`` — hits the real GI API."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

SKILL_DIR = Path(__file__).resolve().parents[1]
SCRIPT = SKILL_DIR / "gi_splice.py"
DEMO_INPUT = SKILL_DIR / "example_data" / "splice_hbb.fa"


def test_demo_input_exists():
    assert DEMO_INPUT.exists()
    assert DEMO_INPUT.stat().st_size > 500


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
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--demo", "--output", str(tmp_path)],
        capture_output=True, text=True, timeout=60,
    )
    assert result.returncode == 0, f"stderr: {result.stderr}"
    assert (tmp_path / "report.md").exists()
    assert (tmp_path / "result.json").exists()
    body = json.loads((tmp_path / "result.json").read_text())
    assert body["summary"]["task"] == "splice"
    assert "g0-splice" in (body["summary"]["model"] or "")
    # Headline number must be populated (regression guard for runner ↔ API key drift).
    assert (body["summary"].get("sites_found") or 0) >= 1, body["summary"]
    assert "**None**" not in (tmp_path / "report.md").read_text()
