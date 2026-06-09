"""Audit round 4 — external-audit findings.

* #1 --pipeline-version must match the pinned 4.1.0 contract unless explicitly
      overridden (the wrapper's validations/params/outputs are 4.1.0-specific).
* #2 -c/--config files that set params.* are blocked unless --trust-config-params
      (a config can otherwise silently override the audited params.yaml).
* #3 cellrangerarc/cellrangermulti reference requirements match the docs: genome
      alone is not a documented build path; VDJ mkvdjref needs fasta+gtf or a
      prebuilt vdj index.
* #6 output validation also checks the documented pipeline_info/ and multiqc/
      core files (software_versions.yml, params.json, multiqc_data/).
"""

from __future__ import annotations

from argparse import Namespace
from pathlib import Path
import sys

import pytest

_SKILL_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_SKILL_DIR))
sys.path.insert(0, str(_SKILL_DIR.parent.parent))

import nfcore_scrnaseq_wrapper as wrapper
import preflight
from errors import SkillError
from nfcore_4_1_0_contract import (
    INTENTIONALLY_UNSUPPORTED_PARAMS,
    INTENTIONALLY_UNSUPPORTED_REASONS,
    NFCORE_SCRNASEQ_VERSION,
)
from outputs_parser import validate_expected_outputs
from schemas import PRESET_REQUIREMENTS


# ── #1: pipeline version gate ─────────────────────────────────────────────────


def test_contract_version_passes():
    wrapper._check_pipeline_version_supported(
        Namespace(pipeline_version=NFCORE_SCRNASEQ_VERSION, allow_pipeline_version_override=False)
    )  # must not raise


def test_other_version_is_blocked_by_default():
    with pytest.raises(SkillError) as exc:
        wrapper._check_pipeline_version_supported(
            Namespace(pipeline_version="4.0.0", allow_pipeline_version_override=False)
        )
    assert exc.value.error_code == "PIPELINE_SOURCE_INVALID"
    assert exc.value.details["contract_version"] == NFCORE_SCRNASEQ_VERSION


def test_other_version_allowed_with_override(capsys):
    wrapper._check_pipeline_version_supported(
        Namespace(pipeline_version="dev", allow_pipeline_version_override=True)
    )
    assert "4.1.0" in capsys.readouterr().err


def test_allow_version_override_flag_exists():
    parsed = wrapper.build_parser().parse_args(
        ["--output", "/tmp/x", "--allow-pipeline-version-override"]
    )
    assert parsed.allow_pipeline_version_override is True


# ── #2: -c config params.* lint ───────────────────────────────────────────────


def _write_config(tmp_path: Path, body: str) -> str:
    p = tmp_path / "site.config"
    p.write_text(body, encoding="utf-8")
    return str(p)


def test_config_with_params_dot_override_is_blocked(tmp_path):
    cfg = _write_config(tmp_path, "params.aligner = 'star'\nprocess.cpus = 4\n")
    args = Namespace(extra_config=[cfg], trust_config_params=False)
    with pytest.raises(SkillError) as exc:
        preflight._check_config_param_overrides(args)
    assert exc.value.error_code == "INVALID_PRESET_CONFIGURATION"
    assert any("params.aligner" in o for o in exc.value.details["overrides"])


def test_config_with_params_block_is_blocked(tmp_path):
    cfg = _write_config(tmp_path, "params {\n  outdir = '/elsewhere'\n}\n")
    args = Namespace(extra_config=[cfg], trust_config_params=False)
    with pytest.raises(SkillError):
        preflight._check_config_param_overrides(args)


def test_config_without_params_is_allowed(tmp_path):
    cfg = _write_config(tmp_path, "process {\n  cpus = 8\n  memory = '32 GB'\n}\n")
    args = Namespace(extra_config=[cfg], trust_config_params=False)
    preflight._check_config_param_overrides(args)  # must not raise


def test_commented_params_line_is_ignored(tmp_path):
    cfg = _write_config(tmp_path, "// params.aligner = 'star'\nprocess.cpus = 4\n")
    args = Namespace(extra_config=[cfg], trust_config_params=False)
    preflight._check_config_param_overrides(args)  # must not raise


def test_config_params_allowed_with_trust_flag_records_overrides(tmp_path, capsys):
    cfg = _write_config(tmp_path, "params.outdir = '/x'\n")
    args = Namespace(extra_config=[cfg], trust_config_params=True)
    preflight._check_config_param_overrides(args)  # must not raise
    assert "params" in capsys.readouterr().err.lower()
    assert any("params.outdir" in o for o in getattr(args, "config_param_overrides", []))


def test_config_reading_params_in_conditional_is_not_blocked(tmp_path):
    # Reading params (a comparison) is legitimate and common in site configs; only
    # *assigning* params.* must be blocked (no false positive on `==`).
    cfg = _write_config(
        tmp_path,
        "if (params.aligner == 'cellranger') {\n  process.container = 'x'\n}\n",
    )
    args = Namespace(extra_config=[cfg], trust_config_params=False)
    preflight._check_config_param_overrides(args)  # must not raise


def test_config_reading_params_on_rhs_is_not_blocked(tmp_path):
    cfg = _write_config(tmp_path, "process.cpus = params.max_cpus\n")
    args = Namespace(extra_config=[cfg], trust_config_params=False)
    preflight._check_config_param_overrides(args)  # must not raise


def test_config_nested_params_assignment_is_blocked(tmp_path):
    cfg = _write_config(tmp_path, "params.genomes.GRCh38.fasta = '/x.fa'\n")
    args = Namespace(extra_config=[cfg], trust_config_params=False)
    with pytest.raises(SkillError):
        preflight._check_config_param_overrides(args)


def test_config_params_assignment_without_spaces_is_blocked(tmp_path):
    cfg = _write_config(tmp_path, "params.aligner='star'\n")
    args = Namespace(extra_config=[cfg], trust_config_params=False)
    with pytest.raises(SkillError):
        preflight._check_config_param_overrides(args)


def test_trust_config_params_flag_exists():
    parsed = wrapper.build_parser().parse_args(
        ["--output", "/tmp/x", "--trust-config-params"]
    )
    assert parsed.trust_config_params is True


# ── #3: ARC/Multi reference requirements ──────────────────────────────────────


def test_genome_remains_a_valid_reference_path_for_arc_and_multi():
    # --genome (iGenomes) resolves to fasta+gtf, so it IS a documented build path
    # for ARC/Multi; the real gap is a GEX-only cellranger_index that cannot build
    # a VDJ reference (enforced in _check_cellrangermulti_vdj_reference_policy).
    for preset in ("cellrangerarc", "cellrangermulti"):
        groups = PRESET_REQUIREMENTS[preset]["requires_any"]
        assert ("genome",) in groups, preset
        assert ("cellranger_index",) in groups, preset
        assert ("fasta", "gtf") in groups, preset


def test_genome_still_valid_for_plain_cellranger():
    assert ("genome",) in PRESET_REQUIREMENTS["cellranger"]["requires_any"]


def _multi_args(**over) -> Namespace:
    base = dict(
        preset="cellrangermulti",
        skip_cellrangermulti_vdjref=False,
        cellranger_vdj_index=None,
        genome=None,
        fasta=None,
        gtf=None,
    )
    base.update(over)
    return Namespace(**base)


def test_vdj_build_with_gex_index_only_is_rejected():
    # cellranger_index (GEX) alone, no genome/fasta+gtf/vdj_index → mkvdjref can't build.
    args = _multi_args(cellranger_index="/refs/gex")
    with pytest.raises(SkillError) as exc:
        preflight._check_cellrangermulti_vdj_reference_policy(args, {"vdj", "gex"})
    assert exc.value.error_code == "INVALID_PRESET_CONFIGURATION"


def test_vdj_build_with_fasta_gtf_is_accepted():
    args = _multi_args(fasta="/refs/g.fa", gtf="/refs/g.gtf")
    preflight._check_cellrangermulti_vdj_reference_policy(args, {"vdj", "gex"})


def test_vdj_build_with_genome_is_accepted():
    args = _multi_args(genome="GRCh38")
    preflight._check_cellrangermulti_vdj_reference_policy(args, {"vdj", "gex"})


def test_vdj_build_with_prebuilt_vdj_index_is_accepted():
    args = _multi_args(cellranger_vdj_index="/refs/vdj")
    preflight._check_cellrangermulti_vdj_reference_policy(args, {"vdj"})


def test_vdj_skip_still_requires_vdj_index():
    args = _multi_args(skip_cellrangermulti_vdjref=True)
    with pytest.raises(SkillError):
        preflight._check_cellrangermulti_vdj_reference_policy(args, {"vdj"})


def test_no_vdj_feature_needs_no_vdj_reference():
    args = _multi_args(cellranger_index="/refs/gex")
    preflight._check_cellrangermulti_vdj_reference_policy(args, {"gex"})


# ── #6: output validation of documented pipeline_info/multiqc core files ──────


def _results_tree(tmp_path: Path, *, with_versions=True, with_params=True, with_mqc_data=True) -> dict:
    results = tmp_path / "upstream" / "results"
    pinfo = results / "pipeline_info"
    pinfo.mkdir(parents=True)
    if with_versions:
        (pinfo / "software_versions.yml").write_text("x", encoding="utf-8")
    if with_params:
        (pinfo / "params_2026-01-01.json").write_text("{}", encoding="utf-8")
    mqc = results / "multiqc"
    mqc.mkdir()
    (mqc / "multiqc_report.html").write_text("<html>", encoding="utf-8")
    if with_mqc_data:
        (mqc / "multiqc_data").mkdir()
    (results / "star" / "mtx_conversions").mkdir(parents=True)
    h5ad = results / "star" / "mtx_conversions" / "combined_filtered_matrix.h5ad"
    h5ad.write_text("x", encoding="utf-8")
    (results / "fastqc").mkdir()
    return {
        "pipeline_info_dir": str(pinfo),
        "multiqc_report": str(mqc / "multiqc_report.html"),
        "h5ad_candidates": [str(h5ad)],
        "upstream_dir": str(results),
        "top_level_entries": ["pipeline_info", "multiqc", "star", "fastqc"],
        "official_outputs": {"fastqc": {"present": True, "html_reports": ["x"], "zip_reports": ["x"]}},
    }


def test_complete_pipeline_info_and_multiqc_pass(tmp_path):
    parsed = _results_tree(tmp_path)
    v = validate_expected_outputs(parsed, aligner="star", skip_multiqc=False, skip_fastqc=True)
    assert v["missing_required"] == []


def test_missing_software_versions_is_flagged(tmp_path):
    parsed = _results_tree(tmp_path, with_versions=False)
    v = validate_expected_outputs(parsed, aligner="star", skip_multiqc=False, skip_fastqc=True)
    assert any("software_versions" in m for m in v["missing_required"])


def test_missing_params_json_is_flagged(tmp_path):
    parsed = _results_tree(tmp_path, with_params=False)
    v = validate_expected_outputs(parsed, aligner="star", skip_multiqc=False, skip_fastqc=True)
    assert any("params" in m and "json" in m for m in v["missing_required"])


def test_missing_multiqc_data_is_flagged(tmp_path):
    parsed = _results_tree(tmp_path, with_mqc_data=False)
    v = validate_expected_outputs(parsed, aligner="star", skip_multiqc=False, skip_fastqc=True)
    assert any("multiqc_data" in m for m in v["missing_required"])


# ── #7: every intentionally-unsupported param has a documented reason ──────────


def test_every_unsupported_param_has_a_reason():
    assert set(INTENTIONALLY_UNSUPPORTED_REASONS) == INTENTIONALLY_UNSUPPORTED_PARAMS
    assert all(r.strip() for r in INTENTIONALLY_UNSUPPORTED_REASONS.values())


def test_check_summary_exposes_subset_mode_and_reasons():
    summary = wrapper._build_parameter_support_summary()
    assert summary["compatibility_mode"] == "clawbio_local_first_subset"
    assert set(summary["intentionally_unsupported_reasons"]) == INTENTIONALLY_UNSUPPORTED_PARAMS


def test_pipeline_info_content_not_checked_for_fake_paths():
    # Unit-style parsed dicts with non-existent paths must not trigger the new
    # filesystem content checks (guarded by real-dir existence).
    parsed = {
        "pipeline_info_dir": "/nonexistent/pipeline_info",
        "multiqc_report": "/nonexistent/multiqc/multiqc_report.html",
        "h5ad_candidates": ["/nonexistent/star/mtx_conversions/combined_filtered_matrix.h5ad"],
        "upstream_dir": "/nonexistent/results",
        "top_level_entries": ["pipeline_info", "multiqc", "star"],
    }
    v = validate_expected_outputs(parsed, aligner="star", skip_multiqc=False, skip_fastqc=True)
    assert not any("software_versions" in m for m in v["missing_required"])
