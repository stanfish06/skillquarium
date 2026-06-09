from __future__ import annotations

import shutil
from pathlib import Path
import subprocess
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pipeline_source
from errors import ErrorCode, SkillError
from pipeline_source import resolve_pipeline_source

_requires_git = pytest.mark.skipif(
    shutil.which("git") is None, reason="git not on PATH"
)


def test_resolves_to_remote_when_no_local_dir(tmp_path):
    absent = tmp_path / "nonexistent_scrnaseq"
    result = resolve_pipeline_source(
        requested_version="4.1.0",
        local_pipeline_dir=absent,
    )
    assert result["source_kind"] == "remote_repo"
    assert result["resolved_version"] == "4.1.0"
    assert result["source_ref"] == "nf-core/scrnaseq"
    assert result["dirty"] is False


def test_raises_when_local_dir_missing_required_files(tmp_path):
    local = tmp_path / "scrnaseq"
    local.mkdir()
    (local / "main.nf").write_text("// main", encoding="utf-8")
    with pytest.raises(SkillError) as exc:
        resolve_pipeline_source(
            requested_version="4.1.0",
            local_pipeline_dir=local,
        )
    assert exc.value.error_code == "PIPELINE_SOURCE_INVALID"
    assert "missing_files" in exc.value.details


def _make_valid_local_checkout(path: Path) -> None:
    """Create a minimal valid scrnaseq checkout at *path*."""
    path.mkdir(parents=True, exist_ok=True)
    (path / "main.nf").write_text("// main", encoding="utf-8")
    (path / "nextflow.config").write_text("// config", encoding="utf-8")
    assets = path / "assets"
    assets.mkdir()
    (assets / "schema_input.json").write_text("{}", encoding="utf-8")


def test_falls_back_to_remote_when_local_path_has_spaces(tmp_path, capsys):
    local = tmp_path / "my scrnaseq checkout"
    _make_valid_local_checkout(local)
    result = resolve_pipeline_source(
        requested_version="4.1.0",
        local_pipeline_dir=local,
    )
    assert result["source_kind"] == "remote_repo", (
        "Expected remote fallback when local path contains spaces"
    )
    assert result["resolved_version"] == "4.1.0"
    captured = capsys.readouterr()
    assert "whitespace" in captured.err.lower() or "space" in captured.err.lower(), (
        "Expected a warning about whitespace in the local path"
    )


def test_local_checkout_version_mismatch_raises(tmp_path, monkeypatch):
    local = tmp_path / "scrnaseq"
    _make_valid_local_checkout(local)

    def fake_git_stdout(path: Path, args: list[str]) -> str:
        assert path == local.resolve()
        if args == ["describe", "--tags", "--exact-match"]:
            return "4.0.0"
        if args == ["rev-parse", "HEAD"]:
            return "abc123"
        if args == ["branch", "--show-current"]:
            return "main"
        return ""

    monkeypatch.setattr(pipeline_source, "_git_stdout", fake_git_stdout)

    with pytest.raises(SkillError) as exc:
        resolve_pipeline_source(
            requested_version="4.1.0",
            local_pipeline_dir=local,
        )

    assert exc.value.error_code == ErrorCode.PIPELINE_SOURCE_INVALID
    assert exc.value.details["requested_version"] == "4.1.0"
    assert exc.value.details["detected_tag"] == "4.0.0"
    assert exc.value.details["detected_commit"] == "abc123"


def test_local_checkout_matching_tag_is_accepted(tmp_path, monkeypatch):
    local = tmp_path / "scrnaseq"
    _make_valid_local_checkout(local)

    def fake_git_stdout(path: Path, args: list[str]) -> str:
        assert path == local.resolve()
        if args == ["describe", "--tags", "--exact-match"]:
            return "4.1.0"
        if args == ["rev-parse", "HEAD"]:
            return "abc123"
        if args == ["branch", "--show-current"]:
            return "main"
        return ""

    monkeypatch.setattr(pipeline_source, "_git_stdout", fake_git_stdout)

    result = resolve_pipeline_source(
        requested_version="4.1.0",
        local_pipeline_dir=local,
    )

    assert result["source_kind"] == "local_checkout"
    assert result["resolved_version"] == "abc123"
    assert result["commit"] == "abc123"
    assert result["tag"] == "4.1.0"


@_requires_git
def test_local_checkout_dirty_is_rejected_by_default(tmp_path):
    local = tmp_path / "scrnaseq"
    _make_valid_local_checkout(local)
    subprocess.run(
        ["git", "init"], cwd=local, check=True, capture_output=True, text=True
    )
    subprocess.run(
        ["git", "config", "user.email", "test@example.com"],
        cwd=local,
        check=True,
    )
    subprocess.run(["git", "config", "user.name", "Test User"], cwd=local, check=True)
    subprocess.run(
        ["git", "add", "main.nf", "nextflow.config", "assets/schema_input.json"],
        cwd=local,
        check=True,
    )
    subprocess.run(
        ["git", "commit", "-m", "initial"],
        cwd=local,
        check=True,
        capture_output=True,
        text=True,
    )
    commit = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=local,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    (local / "untracked.config").write_text("// local override", encoding="utf-8")
    with pytest.raises(SkillError) as exc:
        resolve_pipeline_source(
            requested_version=commit,
            local_pipeline_dir=local,
        )
    assert exc.value.error_code == ErrorCode.PIPELINE_SOURCE_INVALID
    assert exc.value.details["dirty"] is True


@_requires_git
def test_local_checkout_dirty_can_be_explicitly_allowed(tmp_path):
    local = tmp_path / "scrnaseq"
    _make_valid_local_checkout(local)
    subprocess.run(
        ["git", "init"], cwd=local, check=True, capture_output=True, text=True
    )
    subprocess.run(
        ["git", "config", "user.email", "test@example.com"],
        cwd=local,
        check=True,
    )
    subprocess.run(["git", "config", "user.name", "Test User"], cwd=local, check=True)
    subprocess.run(
        ["git", "add", "main.nf", "nextflow.config", "assets/schema_input.json"],
        cwd=local,
        check=True,
    )
    subprocess.run(
        ["git", "commit", "-m", "initial"],
        cwd=local,
        check=True,
        capture_output=True,
        text=True,
    )
    commit = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=local,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    (local / "untracked.config").write_text("// local override", encoding="utf-8")
    result = resolve_pipeline_source(
        requested_version=commit,
        local_pipeline_dir=local,
        allow_dirty=True,
    )
    assert result["source_kind"] == "local_checkout"
    assert result["resolved_version"] == commit
    assert result["dirty"] is True
