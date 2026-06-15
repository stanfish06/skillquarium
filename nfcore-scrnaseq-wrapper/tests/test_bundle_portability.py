"""Cross-OS portability guard for the reproducibility bundle.

Generates a full bundle via the real writers and asserts every text artifact is
LF-only (no CR), so a bundle is byte-identical and bash/checksum-safe regardless
of the OS that produced it. This is the regression guard for the write_text_lf
routing and the csv lineterminator fixes.
"""

import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

_SKILL_DIR = Path(__file__).resolve().parent.parent
if str(_SKILL_DIR) not in sys.path:
    sys.path.insert(0, str(_SKILL_DIR))

import params_builder
import provenance
import reporting
from samplesheet_builder import validate_and_normalize_samplesheet

# Text artifacts that must be LF-only on every OS.
_TEXT_ARTIFACTS = (
    "commands.sh",
    "params.yaml",
    "samplesheet.valid.csv",
    "checksums.sha256",
    "environment.yml",
    "manifest.json",
    "runtime.json",
    "inputs.json",
    "outputs.json",
    "invocation.json",
    "skill.json",
    "preflight.json",
    "upstream.json",
    "macos_docker.config",
)


def _build_full_bundle(tmp_path: Path) -> Path:
    out = tmp_path / "run"
    (out / "reproducibility").mkdir(parents=True)
    (out / "upstream" / "results").mkdir(parents=True)

    refs = tmp_path / "refs"
    refs.mkdir()
    fa = refs / "genome.fa"
    fa.write_text(">chr1\nACGT\n")
    gtf = refs / "genes.gtf"
    gtf.write_text("# gtf\n")

    data = tmp_path / "data"
    data.mkdir()
    r1 = data / "s1_R1.fastq.gz"
    r1.write_bytes(b"\x1f\x8b")
    r2 = data / "s1_R2.fastq.gz"
    r2.write_bytes(b"\x1f\x8b")

    raw_ss = tmp_path / "input.csv"
    raw_ss.write_text(
        f"sample,fastq_1,fastq_2,expected_cells\ns1,{r1},{r2},5000\n",
        encoding="utf-8",
    )
    normalized = out / "reproducibility" / "samplesheet.valid.csv"
    validate_and_normalize_samplesheet(raw_ss, normalized, preset="star")

    args = SimpleNamespace(
        preset="star",
        profile="docker",
        demo=False,
        resume=False,
        check=False,
        input=str(normalized),
        output=str(out),
        protocol="10XV3",
        pipeline_version="4.1.0",
        fasta=str(fa),
        gtf=str(gtf),
        star_index=None,
        run_downstream=False,
        email=None,
        multiqc_title=None,
        expected_cells=None,
    )
    params_path, params = params_builder.build_params_file(
        args, normalized_samplesheet=normalized, output_dir=out
    )

    pipeline_source = {
        "source_kind": "remote_revision",
        "source_ref": "nf-core/scrnaseq",
        "resolved_version": "4.1.0",
    }
    preflight = {
        "java": {"version": "17.0.10"},
        "nextflow": {"version": "24.10.1"},
        "references": {"fasta": str(fa), "gtf": str(gtf)},
    }
    reporting.write_repro_commands(out, args=args, pipeline_source=pipeline_source)

    stdout = out / "upstream" / "nextflow.stdout.log"
    stdout.write_text("ok\n")
    stderr = out / "upstream" / "nextflow.stderr.log"
    stderr.write_text("")
    h5ad = out / "upstream" / "results" / "x.h5ad"
    h5ad.write_bytes(b"H5AD")
    provenance.write_provenance_bundle(
        out,
        args=args,
        pipeline_source=pipeline_source,
        preflight_result=preflight,
        params_path=params_path,
        params_payload=params,
        normalized_samplesheet=normalized,
        samplesheet_summary={"sample_count": 1, "fastq_paths": [str(r1), str(r2)]},
        parsed_outputs={"h5ad_candidates": [str(h5ad)], "multiqc_report": None},
        execution_result={"stdout_path": str(stdout), "stderr_path": str(stderr)},
        command_str=f"cd {out.as_posix()} && nextflow run nf-core/scrnaseq -r 4.1.0",
    )
    return out / "reproducibility"


def test_all_bundle_text_artifacts_are_lf_only(tmp_path):
    repro = _build_full_bundle(tmp_path)
    offenders = []
    for name in _TEXT_ARTIFACTS:
        p = repro / name
        if not p.exists():
            continue
        if b"\r" in p.read_bytes():
            offenders.append(name)
    assert offenders == [], f"CRLF/CR found in bundle artifacts: {offenders}"


def test_commands_sh_is_pure_lf(tmp_path):
    repro = _build_full_bundle(tmp_path)
    # A CR anywhere in a bash script can corrupt variables / line continuations.
    assert b"\r" not in (repro / "commands.sh").read_bytes()


def test_samplesheet_in_bundle_is_lf(tmp_path):
    repro = _build_full_bundle(tmp_path)
    assert b"\r" not in (repro / "samplesheet.valid.csv").read_bytes()


# ── bundle actually verifies / replays (cross-OS) ──────────────────────────────


def test_checksums_manifest_is_self_verifiable_in_place(tmp_path):
    """Every label in checksums.sha256 must resolve relative to the output dir and
    match — i.e. `sha256sum -c` from the output dir must pass for the whole bundle."""
    repro = _build_full_bundle(tmp_path)
    output_dir = repro.parent
    lines = [
        ln for ln in (repro / "checksums.sha256").read_text().splitlines() if ln.strip()
    ]
    assert lines, "checksums.sha256 is empty"
    failures = []
    for ln in lines:
        digest, label = ln.split("  ", 1)
        target = output_dir / label
        if not target.exists():
            failures.append((label, "MISSING"))
        elif hashlib.sha256(target.read_bytes()).hexdigest() != digest:
            failures.append((label, "MISMATCH"))
    assert failures == [], f"checksums.sha256 not verifiable in place: {failures}"


def test_sha256sum_c_passes_from_output_dir(tmp_path):
    """If a sha256 CLI is available, `-c` must return 0 from the output dir."""
    tool = shutil.which("sha256sum")
    if not tool:
        pytest.skip("sha256sum not available")
    repro = _build_full_bundle(tmp_path)
    r = subprocess.run(
        [tool, "-c", "reproducibility/checksums.sha256"],
        cwd=str(repro.parent),
        capture_output=True,
        text=True,
    )
    assert r.returncode == 0, f"sha256sum -c failed:\n{r.stdout}\n{r.stderr}"


def test_reference_digests_recorded_in_inputs_json(tmp_path):
    """External reference file digests live in inputs.json (provenance), not in the
    self-verifiable checksums.sha256 manifest."""
    repro = _build_full_bundle(tmp_path)
    inputs = json.loads((repro / "inputs.json").read_text())
    assert "reference_checksums" in inputs
    assert set(inputs["reference_checksums"]) >= {"fasta", "gtf"}
    assert all(len(v) == 64 for v in inputs["reference_checksums"].values())
    # references must NOT appear as bare basenames in checksums.sha256
    chk = (repro / "checksums.sha256").read_text()
    assert "  genome.fa" not in chk and "  genes.gtf" not in chk


def test_commands_sh_passes_bash_syntax_check(tmp_path):
    bash = shutil.which("bash")
    if not bash:
        pytest.skip("bash not available")
    repro = _build_full_bundle(tmp_path)
    r = subprocess.run(
        [bash, "-n", str(repro / "commands.sh")], capture_output=True, text=True
    )
    assert r.returncode == 0, f"commands.sh has bash syntax errors:\n{r.stderr}"


def test_commands_sh_does_not_leak_generation_host_path(tmp_path):
    repro = _build_full_bundle(tmp_path)
    text = (repro / "commands.sh").read_text()
    # the portable replay script must self-anchor, never embed the generation abs path
    assert str(tmp_path) not in text


def test_demo_commands_sh_passes_bash_syntax_check(tmp_path):
    """The demo replay script (test,docker profile + macOS $EXTRA_CONFIG guard)
    must also be valid bash so the bundle replays on any POSIX OS."""
    bash = shutil.which("bash")
    if not bash:
        pytest.skip("bash not available")
    import reporting

    out = tmp_path / "demo_run"
    (out / "reproducibility").mkdir(parents=True)
    args = SimpleNamespace(preset="star", profile="docker", demo=True, resume=False)
    pipeline_source = {
        "source_kind": "remote_repo",
        "source_ref": "nf-core/scrnaseq",
        "resolved_version": "4.1.0",
    }
    reporting.write_repro_commands(
        out, args=args, pipeline_source=pipeline_source, nextflow_version="25.04.0"
    )
    cs = out / "reproducibility" / "commands.sh"
    r = subprocess.run([bash, "-n", str(cs)], capture_output=True, text=True)
    assert r.returncode == 0, f"demo commands.sh has bash syntax errors:\n{r.stderr}"
    text = cs.read_text()
    assert "test,docker" in text  # demo prepends the test profile
    assert 'EXTRA_CONFIG=""' in text  # safe under `set -u`


def test_bundle_remap_roundtrip_then_verifies(tmp_path):
    """Simulate replay on another machine: move the FASTQs, remap the bundle's
    samplesheet to the new prefix, then verify all paths resolve."""
    import remap_paths

    repro = _build_full_bundle(tmp_path)
    ss = repro / "samplesheet.valid.csv"

    # FASTQs were normalized to absolute, resolved paths under <tmp>/data.
    old_prefix = str((tmp_path / "data").resolve())
    moved = tmp_path / "relocated"
    shutil.move(str(tmp_path / "data"), str(moved))
    new_prefix = str(moved.resolve())

    # before remap, the (now-moved) paths must be reported missing
    assert remap_paths.verify_paths(ss), "expected missing paths before remap"

    changes = remap_paths.remap_csv(ss, old_prefix, new_prefix, dry_run=False)
    assert changes, "remap should have rewritten the FASTQ paths"
    # after remap, every FASTQ path must resolve on the 'new machine'
    assert remap_paths.verify_paths(ss) == [], "all paths must resolve after remap"


def test_bundle_remap_roundtrip_with_space_and_unicode_prefix(tmp_path):
    """Relocate the FASTQs to a NEW prefix containing a space AND a non-ASCII char
    (a realistic replay machine), then remap + re-verify. The samplesheet must stay
    LF-only afterwards. Parity with nfcore-sarek-wrapper's roundtrip guard, and the
    explicit spaces/unicode-in-paths portability case."""
    import remap_paths

    repro = _build_full_bundle(tmp_path)
    ss = repro / "samplesheet.valid.csv"

    old_prefix = str((tmp_path / "data").resolve())
    moved = tmp_path / "relocated café data"  # space + non-ASCII
    shutil.move(str(tmp_path / "data"), str(moved))
    new_prefix = str(moved.resolve())

    assert remap_paths.verify_paths(ss), "expected missing paths before remap"
    changes = remap_paths.remap_csv(ss, old_prefix, new_prefix, dry_run=False)
    assert changes, "remap should have rewritten the FASTQ paths"
    assert remap_paths.verify_paths(ss) == [], "all paths must resolve after remap"
    assert b"\r" not in ss.read_bytes(), "remap must preserve LF endings"
