from __future__ import annotations

import os
import signal
import subprocess
import sys
from pathlib import Path

_SKILL_DIR = Path(__file__).resolve().parent
if str(_SKILL_DIR) in sys.path:
    sys.path.remove(str(_SKILL_DIR))
sys.path.insert(0, str(_SKILL_DIR))
sys.modules.pop("_isolated_imports", None)
from _isolated_imports import purge_foreign_bare_modules

purge_foreign_bare_modules("errors", "schemas")

from errors import ErrorCode, SkillError
from schemas import is_under_tmp

_PROCESS_TERMINATION_GRACE_SECONDS = 10


def execute_nextflow(
    command: list[str],
    *,
    cwd: Path,
    output_dir: Path,
    timeout_seconds: int | None,
) -> dict[str, object]:
    # timeout_seconds=None disables the wall-clock cap entirely (long HPC/cloud
    # runs whose walltime is enforced by the scheduler). Any positive int caps the
    # run and kills the process tree on expiry.
    logs_dir = output_dir / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    stdout_path = logs_dir / "stdout.txt"
    stderr_path = logs_dir / "stderr.txt"

    popen_kwargs: dict = {}
    if sys.platform != "win32":
        popen_kwargs["start_new_session"] = True

    with (
        stdout_path.open("w", encoding="utf-8") as stdout_fh,
        stderr_path.open("w", encoding="utf-8") as stderr_fh,
    ):
        try:
            proc = subprocess.Popen(
                command,
                cwd=str(cwd),
                stdout=stdout_fh,
                stderr=stderr_fh,
                **popen_kwargs,
            )
        except OSError as exc:
            for path in (stdout_path, stderr_path):
                path.unlink(missing_ok=True)
            raise SkillError(
                stage="preflight",
                error_code=ErrorCode.EXECUTION_FAILED,
                message=f"Could not launch Nextflow: {exc}",
                fix="Ensure nextflow is installed and available on PATH.",
                details={"command": command[0] if command else "", "error": str(exc)},
            ) from exc

        try:
            exit_code = proc.wait(timeout=timeout_seconds)
        except KeyboardInterrupt:
            _terminate_process_tree(proc)
            raise
        except subprocess.TimeoutExpired:
            _terminate_process_tree(proc)
            raise SkillError(
                stage="execution",
                error_code=ErrorCode.EXECUTION_FAILED,
                message="Nextflow execution timed out.",
                fix="Increase resources, inspect the pipeline, or retry with a smaller dataset.",
                details={"timeout_seconds": timeout_seconds},
            )

    if exit_code != 0:
        raise SkillError(
            stage="execution",
            error_code=ErrorCode.EXECUTION_FAILED,
            message="Nextflow execution failed.",
            fix=(
                "Inspect logs/stdout.txt and logs/stderr.txt, then correct the failing input or environment."
                + _macos_tmp_failure_hint(output_dir)
            ),
            details={
                "exit_code": exit_code,
                "stdout": str(stdout_path),
                "stderr": str(stderr_path),
            },
        )

    return {
        "exit_code": exit_code,
        "stdout_path": str(stdout_path),
        "stderr_path": str(stderr_path),
    }


def _macos_tmp_failure_hint(output_dir: Path) -> str:
    """Extra fix hint when a run fails with --output under /tmp on macOS.

    Colima/Docker on macOS does not share /tmp into the VM, a frequent cause of
    '.command.run: No such file or directory' mid-run. Preflight already WARNs about
    this; we repeat the actionable hint on failure so the cause is obvious. Empty
    string on other platforms or when --output is not under /tmp.
    """
    if sys.platform != "darwin":
        return ""
    if not is_under_tmp(output_dir):
        return ""
    return (
        " On macOS, --output is under /tmp, which Docker/Colima does not share into its VM; "
        "this commonly surfaces as '.command.run: No such file or directory'. "
        "Move --output to a path under your HOME directory and re-run."
    )


def _terminate_process_tree(proc: subprocess.Popen) -> None:
    if sys.platform == "win32":
        # Windows has no os.killpg; ``taskkill /T`` terminates the whole child tree
        # (Nextflow plus its spawned task processes) instead of orphaning them when
        # only the parent is killed. Best-effort and guarded: fall back to
        # proc.kill() if taskkill is unavailable. Native Windows is not officially
        # supported (preflight warns); WSL2 reports "linux" and takes the POSIX path
        # below (audit F-7).
        try:
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                capture_output=True,
                timeout=_PROCESS_TERMINATION_GRACE_SECONDS,
            )
        except (OSError, subprocess.SubprocessError):
            pass
        proc.kill()
        proc.wait()
        return
    try:
        pgid = os.getpgid(proc.pid)
        os.killpg(pgid, signal.SIGTERM)
        proc.wait(timeout=_PROCESS_TERMINATION_GRACE_SECONDS)
        return
    except (OSError, ProcessLookupError, subprocess.TimeoutExpired):
        pass
    try:
        pgid = os.getpgid(proc.pid)
        os.killpg(pgid, signal.SIGKILL)
        proc.wait()
        return
    except (OSError, ProcessLookupError):
        pass
    proc.kill()
    proc.wait()
