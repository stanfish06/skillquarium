"""Tests for executor.py — log placement and process handling."""
from __future__ import annotations

from pathlib import Path

from executor import execute_nextflow


def test_logs_written_under_reproducibility(tmp_path: Path):
    """Run logs must live inside reproducibility/, not as a stray top-level dir.

    SKILL.md guarantees the output directory has exactly two children
    (``upstream/`` and ``reproducibility/``); the executor's stdout/stderr
    capture therefore belongs under ``reproducibility/logs/``.
    """
    output_dir = tmp_path / "out"
    output_dir.mkdir()

    result = execute_nextflow(
        ["sh", "-c", "echo hello; echo oops 1>&2"],
        cwd=output_dir,
        output_dir=output_dir,
        timeout_seconds=30,
    )

    logs = output_dir / "reproducibility" / "logs"
    assert (logs / "stdout.txt").exists()
    assert (logs / "stderr.txt").exists()
    # No stray top-level logs/ directory.
    assert not (output_dir / "logs").exists()
    assert result["exit_code"] == 0
    assert (logs / "stdout.txt").read_text().strip() == "hello"
    assert (logs / "stderr.txt").read_text().strip() == "oops"
    # Reported paths point inside reproducibility/.
    assert "reproducibility/logs/stdout.txt" in Path(str(result["stdout_path"])).as_posix()
