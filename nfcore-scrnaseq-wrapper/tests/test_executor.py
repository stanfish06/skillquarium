from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from errors import SkillError
from executor import execute_nextflow


class _MockProc:
    """Minimal Popen replacement that avoids spawning a real process."""

    def __init__(
        self,
        returncode: int = 0,
        timeout_on_first_wait: bool = False,
        keyboard_interrupt_on_first_wait: bool = False,
    ):
        self._rc = returncode
        self._timeout_on_first = timeout_on_first_wait
        self._keyboard_interrupt_on_first = keyboard_interrupt_on_first_wait
        self._wait_calls = 0
        self.killed = False
        self.pid = 1234

    def wait(self, timeout=None):
        self._wait_calls += 1
        if self._timeout_on_first and self._wait_calls == 1:
            raise subprocess.TimeoutExpired(cmd=["nextflow"], timeout=timeout or 1)
        if self._keyboard_interrupt_on_first and self._wait_calls == 1:
            raise KeyboardInterrupt
        return self._rc

    def kill(self):
        self.killed = True


def test_execute_nextflow_creates_log_files_on_success(tmp_path, monkeypatch):
    proc = _MockProc(returncode=0)
    monkeypatch.setattr(subprocess, "Popen", lambda *a, **kw: proc)
    result = execute_nextflow(
        ["nextflow", "run", "test"],
        cwd=tmp_path,
        output_dir=tmp_path,
        timeout_seconds=60,
    )
    assert result["exit_code"] == 0
    assert (tmp_path / "logs" / "stdout.txt").exists()
    assert (tmp_path / "logs" / "stderr.txt").exists()


def test_execute_nextflow_raises_on_nonzero_exit(tmp_path, monkeypatch):
    proc = _MockProc(returncode=1)
    monkeypatch.setattr(subprocess, "Popen", lambda *a, **kw: proc)
    with pytest.raises(SkillError) as exc:
        execute_nextflow(
            ["nextflow", "run", "test"],
            cwd=tmp_path,
            output_dir=tmp_path,
            timeout_seconds=60,
        )
    assert exc.value.error_code == "EXECUTION_FAILED"
    assert exc.value.details["exit_code"] == 1


def _record_taskkill(monkeypatch) -> list[list[str]]:
    """Stub subprocess.run so the win32 ``taskkill /T`` tree-kill is recorded
    instead of spawning a real process (audit F-7)."""
    calls: list[list[str]] = []

    def fake_run(args, *a, **kw):
        calls.append(list(args))
        return subprocess.CompletedProcess(args, 0)

    monkeypatch.setattr(subprocess, "run", fake_run)
    return calls


def test_execute_nextflow_kills_process_on_timeout(tmp_path, monkeypatch):
    proc = _MockProc(returncode=0, timeout_on_first_wait=True)
    monkeypatch.setattr(subprocess, "Popen", lambda *a, **kw: proc)
    monkeypatch.setattr(sys, "platform", "win32")
    taskkill_calls = _record_taskkill(monkeypatch)
    with pytest.raises(SkillError) as exc:
        execute_nextflow(
            ["nextflow", "run", "test"],
            cwd=tmp_path,
            output_dir=tmp_path,
            timeout_seconds=1,
        )
    assert exc.value.error_code == "EXECUTION_FAILED"
    assert proc.killed, "Process must be killed on timeout"
    # The whole child tree is terminated via taskkill /T, not just the parent.
    assert ["taskkill", "/F", "/T", "/PID", "1234"] in taskkill_calls


def test_execute_nextflow_kills_process_on_keyboard_interrupt(tmp_path, monkeypatch):
    proc = _MockProc(returncode=0, keyboard_interrupt_on_first_wait=True)
    monkeypatch.setattr(subprocess, "Popen", lambda *a, **kw: proc)
    monkeypatch.setattr(sys, "platform", "win32")
    taskkill_calls = _record_taskkill(monkeypatch)

    with pytest.raises(KeyboardInterrupt):
        execute_nextflow(
            ["nextflow", "run", "test"],
            cwd=tmp_path,
            output_dir=tmp_path,
            timeout_seconds=60,
        )

    assert proc.killed, "Process must be killed when the wrapper is interrupted"
    assert ["taskkill", "/F", "/T", "/PID", "1234"] in taskkill_calls


def test_execute_nextflow_result_contains_log_paths(tmp_path, monkeypatch):
    proc = _MockProc(returncode=0)
    monkeypatch.setattr(subprocess, "Popen", lambda *a, **kw: proc)
    result = execute_nextflow(
        ["nextflow", "run", "test"],
        cwd=tmp_path,
        output_dir=tmp_path,
        timeout_seconds=60,
    )
    assert "stdout_path" in result
    assert "stderr_path" in result
    assert Path(result["stdout_path"]).name == "stdout.txt"
    assert Path(result["stderr_path"]).name == "stderr.txt"


def test_execute_nextflow_cleans_up_empty_logs_on_popen_failure(tmp_path, monkeypatch):
    """Empty log files must be removed when Popen itself fails."""

    def raise_os_error(*args, **kwargs):
        raise OSError("nextflow: command not found")

    monkeypatch.setattr(subprocess, "Popen", raise_os_error)
    with pytest.raises(SkillError) as exc:
        execute_nextflow(
            ["nextflow", "run", "test"],
            cwd=tmp_path,
            output_dir=tmp_path,
            timeout_seconds=60,
        )
    assert exc.value.error_code == "EXECUTION_FAILED"
    assert not (tmp_path / "logs" / "stdout.txt").exists()
    assert not (tmp_path / "logs" / "stderr.txt").exists()


def test_macos_tmp_failure_hint_added_under_tmp(monkeypatch):
    """On macOS, an EXECUTION_FAILED for an --output under /tmp must include the
    actionable Colima/Docker hint (audit Hallazgo 2)."""
    import executor
    from pathlib import Path

    monkeypatch.setattr(executor.sys, "platform", "darwin")
    hint = executor._macos_tmp_failure_hint(Path("/tmp/scrnaseq_run"))
    assert "/tmp" in hint and "HOME" in hint


def test_macos_tmp_failure_hint_empty_under_home(monkeypatch):
    import executor
    from pathlib import Path

    monkeypatch.setattr(executor.sys, "platform", "darwin")
    assert executor._macos_tmp_failure_hint(Path.home() / "scrnaseq_run") == ""


def test_macos_tmp_failure_hint_empty_on_linux(monkeypatch):
    import executor
    from pathlib import Path

    monkeypatch.setattr(executor.sys, "platform", "linux")
    assert executor._macos_tmp_failure_hint(Path("/tmp/scrnaseq_run")) == ""
