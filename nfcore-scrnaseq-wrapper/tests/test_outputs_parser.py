from __future__ import annotations

from pathlib import Path
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from errors import SkillError
from outputs_parser import (
    detect_cellbender_outputs,
    parse_outputs,
    select_preferred_h5ad,
    validate_expected_outputs,
)


def test_parse_outputs_prefers_cellbender_combined(tmp_path):
    upstream = tmp_path / "upstream" / "results"
    (upstream / "pipeline_info").mkdir(parents=True)
    (upstream / "multiqc" / "simpleaf").mkdir(parents=True)
    (upstream / "multiqc" / "simpleaf" / "multiqc_report.html").write_text(
        "ok", encoding="utf-8"
    )
    preferred = (
        upstream
        / "simpleaf"
        / "mtx_conversions"
        / "combined_cellbender_filter_matrix.h5ad"
    )
    preferred.parent.mkdir(parents=True)
    preferred.write_text("h5ad", encoding="utf-8")
    raw = upstream / "simpleaf" / "mtx_conversions" / "combined_raw_matrix.h5ad"
    raw.write_text("h5ad", encoding="utf-8")
    result = parse_outputs(tmp_path)
    assert result["preferred_h5ad"] == str(preferred)
    assert result["handoff_available"] is True
    assert result["cellbender_used"] is True


def test_parse_outputs_exposes_official_output_manifest(tmp_path):
    upstream = tmp_path / "upstream" / "results"
    (upstream / "pipeline_info").mkdir(parents=True)
    (upstream / "multiqc").mkdir()
    (upstream / "multiqc" / "multiqc_report.html").write_text(
        "<html></html>", encoding="utf-8"
    )
    fastqc = upstream / "fastqc" / "sample"
    fastqc.mkdir(parents=True)
    (fastqc / "sample_fastqc.html").write_text("<html></html>", encoding="utf-8")
    (fastqc / "sample_fastqc.zip").write_text("zip", encoding="utf-8")
    (upstream / "reference_genome").mkdir()
    mtx = upstream / "simpleaf" / "mtx_conversions"
    mtx.mkdir(parents=True)
    (mtx / "combined_filtered_matrix.h5ad").write_text("h5ad", encoding="utf-8")

    result = parse_outputs(tmp_path)
    manifest = result["official_outputs"]

    assert manifest["pipeline_info"]["present"] is True
    assert manifest["multiqc"]["present"] is True
    assert "fastqc" in manifest
    assert manifest["fastqc"]["html_reports"] == [str(fastqc / "sample_fastqc.html")]
    assert manifest["fastqc"]["zip_reports"] == [str(fastqc / "sample_fastqc.zip")]
    assert manifest["reference_genome"]["present"] is True
    assert manifest["aligner_outputs"]["simpleaf"]["present"] is True
    assert "cellbender_removebackground" in manifest
    assert manifest["mtx_conversions"] == [str(mtx)]
    assert "fastqc" in manifest["documented_families"]
    assert "pipeline_info" in manifest["required_contract"]
    # FastQC is a required output for every aligner unless --skip-fastqc (audit H-02).
    assert "fastqc_unless_skip_fastqc" in manifest["required_contract"]
    assert "cellranger_family_fastqc" not in manifest["optional_contract"]


def test_parse_outputs_no_canonical_h5ad_when_multiple_samples(tmp_path):
    upstream = tmp_path / "upstream" / "results"
    upstream.mkdir(parents=True)
    for sample_name in ("sampleA", "sampleB"):
        p = (
            upstream
            / "star"
            / "mtx_conversions"
            / f"{sample_name}_filtered_matrix.h5ad"
        )
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text("h5ad", encoding="utf-8")
    result = parse_outputs(tmp_path)
    assert result["preferred_h5ad"] == ""
    assert result["handoff_available"] is False
    assert len(result["h5ad_candidates"]) == 2


def test_find_h5ad_includes_per_sample_nested_matrices_with_combined(tmp_path):
    """nf-core/scrnaseq 4.1.0 conf/modules.config nests per-sample matrices under
    ``mtx_conversions/<sample>/`` (saveAs `${meta.id}/${filename}`) while the
    concatenated matrix sits directly in ``mtx_conversions/``. A depth-1-only glob
    drops the per-sample files whenever a combined matrix co-exists, emptying
    samples_detected and the checksum manifest. Both depths must be detected
    (audit F-1)."""
    upstream = tmp_path / "upstream" / "results"
    mtx = upstream / "star" / "mtx_conversions"
    combined = mtx / "combined_filtered_matrix.h5ad"
    combined.parent.mkdir(parents=True)
    combined.write_text("h5ad", encoding="utf-8")
    sample_a = mtx / "sampleA" / "sampleA_filtered_matrix.h5ad"
    sample_a.parent.mkdir(parents=True)
    sample_a.write_text("h5ad", encoding="utf-8")
    sample_b = mtx / "sampleB" / "sampleB_filtered_matrix.h5ad"
    sample_b.parent.mkdir(parents=True)
    sample_b.write_text("h5ad", encoding="utf-8")

    result = parse_outputs(tmp_path)

    # The concatenated matrix still wins the handoff selection.
    assert Path(result["preferred_h5ad"]).name == "combined_filtered_matrix.h5ad"
    assert result["handoff_available"] is True
    # …but the nested per-sample matrices are no longer dropped from the inventory.
    assert str(sample_a) in result["h5ad_candidates"]
    assert str(sample_b) in result["h5ad_candidates"]
    assert result["samples_detected"] == ["sampleA", "sampleB"]


def test_detect_cellbender_from_nested_per_sample_matrix(tmp_path):
    """CellBender per-sample matrices live at ``mtx_conversions/<sample>/`` in 4.1.0,
    so cellbender_used must still be True even when only the nested per-sample
    cellbender matrix exists alongside a non-cellbender combined matrix (audit F-1)."""
    upstream = tmp_path / "upstream" / "results"
    mtx = upstream / "star" / "mtx_conversions"
    combined = mtx / "combined_filtered_matrix.h5ad"
    combined.parent.mkdir(parents=True)
    combined.write_text("h5ad", encoding="utf-8")
    cb = mtx / "sampleA" / "sampleA_cellbender_filter_matrix.h5ad"
    cb.parent.mkdir(parents=True)
    cb.write_text("h5ad", encoding="utf-8")

    result = parse_outputs(tmp_path)

    assert result["cellbender_used"] is True


def test_find_h5ad_still_ignores_nested_stray_outside_mtx_conversions(tmp_path):
    """The deeper glob must not re-introduce the audit H-1 regression: a nested
    .h5ad that is NOT under a ``mtx_conversions/`` directory (e.g. a CellBender
    working copy under ``<sample>/cellbender_removebackground/``) must stay out of
    the candidate list when canonical matrices exist."""
    upstream = tmp_path / "upstream" / "results"
    mtx = upstream / "star" / "mtx_conversions"
    combined = mtx / "combined_filtered_matrix.h5ad"
    combined.parent.mkdir(parents=True)
    combined.write_text("h5ad", encoding="utf-8")
    stray = upstream / "star" / "sampleA" / "cellbender_removebackground" / "raw.h5ad"
    stray.parent.mkdir(parents=True)
    stray.write_text("h5ad", encoding="utf-8")

    result = parse_outputs(tmp_path)

    assert str(stray) not in result["h5ad_candidates"]


def test_parse_outputs_raises_when_upstream_dir_missing(tmp_path):
    with pytest.raises(SkillError) as exc:
        parse_outputs(tmp_path)
    assert exc.value.error_code == "EXPECTED_OUTPUTS_NOT_FOUND"


def test_parse_outputs_detects_multiqc_and_pipeline_info(tmp_path):
    upstream = tmp_path / "upstream" / "results"
    info = upstream / "pipeline_info"
    info.mkdir(parents=True)
    mqc = upstream / "multiqc" / "star" / "multiqc_report.html"
    mqc.parent.mkdir(parents=True)
    mqc.write_text("report", encoding="utf-8")
    result = parse_outputs(tmp_path)
    assert result["multiqc_report"] == str(mqc)
    assert result["pipeline_info_dir"] == str(info)


def test_parse_outputs_filtered_preferred_over_raw(tmp_path):
    """combined_filtered_matrix.h5ad must be preferred over combined_raw_matrix.h5ad."""
    upstream = tmp_path / "upstream" / "results"
    upstream.mkdir(parents=True)
    for name in ("combined_filtered_matrix.h5ad", "combined_raw_matrix.h5ad"):
        (upstream / name).write_text("h5ad", encoding="utf-8")
    result = parse_outputs(tmp_path)
    assert Path(result["preferred_h5ad"]).name == "combined_filtered_matrix.h5ad"
    assert result["handoff_available"] is True


def test_select_preferred_h5ad_prefers_cellbender_over_legacy_combined_matrix():
    legacy = "/out/simpleaf/mtx_conversions/combined_matrix.h5ad"
    cellbender = "/out/simpleaf/mtx_conversions/combined_cellbender_filter_matrix.h5ad"

    assert select_preferred_h5ad([legacy, cellbender]) == cellbender


def test_find_h5ad_ignores_stray_outside_mtx_conversions(tmp_path):
    """Stray .h5ad outside mtx_conversions must not pollute candidates when the
    canonical mtx_conversions matrices exist (audit H-1)."""
    upstream = tmp_path / "upstream" / "results"
    mtx = upstream / "star" / "mtx_conversions"
    mtx.mkdir(parents=True)
    canonical = mtx / "combined_filtered_matrix.h5ad"
    canonical.write_text("h5ad", encoding="utf-8")
    stray = upstream / "star" / "sampleA" / "cellbender" / "raw_intermediate.h5ad"
    stray.parent.mkdir(parents=True)
    stray.write_text("h5ad", encoding="utf-8")

    result = parse_outputs(tmp_path)

    assert result["h5ad_candidates"] == [str(canonical)]
    assert Path(result["preferred_h5ad"]).name == "combined_filtered_matrix.h5ad"


def test_find_h5ad_falls_back_to_full_tree_without_mtx_conversions(tmp_path):
    """When no mtx_conversions dir exists, fall back to a full-tree scan so
    unusual layouts are still detected rather than silently dropped (audit H-1)."""
    upstream = tmp_path / "upstream" / "results"
    stray = upstream / "star" / "combined_filtered_matrix.h5ad"
    stray.parent.mkdir(parents=True)
    stray.write_text("h5ad", encoding="utf-8")

    result = parse_outputs(tmp_path)

    assert result["h5ad_candidates"] == [str(stray)]


def test_select_preferred_h5ad_ranks_by_suffix_not_sample_name():
    """Filter level must come from the filename suffix, not a substring match on
    the sample name (audit H-2). A sample literally named 'prefiltered' with a
    raw and a plain matrix must prefer the plain one (raw is the lowest rank)."""
    raw = "/out/star/mtx_conversions/prefiltered_raw_matrix.h5ad"
    plain = "/out/star/mtx_conversions/prefiltered_matrix.h5ad"

    assert select_preferred_h5ad([raw, plain]) == plain


def test_select_preferred_h5ad_handles_cellbender_in_sample_name():
    """A sample name containing 'cellbender' must not collapse raw/filtered into
    the same rank (audit H-2): filtered must still win over raw."""
    raw = "/out/star/mtx_conversions/cellbender_donor_raw_matrix.h5ad"
    filtered = "/out/star/mtx_conversions/cellbender_donor_filtered_matrix.h5ad"

    assert select_preferred_h5ad([raw, filtered]) == filtered


def test_detect_cellbender_outputs_uses_suffix_token_not_substring():
    """cellbender_used must be driven by the cellbender_filter matrix suffix, not a
    substring scan of the path: a sample named 'cellbender_donor' with no actual
    CellBender output must report False (audit H-7)."""
    raw = "/out/star/mtx_conversions/cellbender_donor_raw_matrix.h5ad"
    assert detect_cellbender_outputs([raw]) is False

    real = "/out/star/mtx_conversions/combined_cellbender_filter_matrix.h5ad"
    assert detect_cellbender_outputs([real]) is True


def test_validate_expected_outputs_reports_missing_multiqc_when_not_skipped():
    parsed_outputs = {
        "pipeline_info_dir": "/out/upstream/results/pipeline_info",
        "multiqc_report": "",
        "h5ad_candidates": [
            "/out/upstream/results/simpleaf/mtx_conversions/combined_filtered_matrix.h5ad"
        ],
        "upstream_dir": "/out/upstream/results",
        "top_level_entries": ["pipeline_info", "simpleaf"],
    }

    validation = validate_expected_outputs(
        parsed_outputs, aligner="simpleaf", skip_multiqc=False, skip_fastqc=True
    )

    assert validation["missing_required"] == ["multiqc/multiqc_report.html"]


def test_validate_expected_outputs_reports_missing_aligner_dir():
    parsed_outputs = {
        "pipeline_info_dir": "/out/upstream/results/pipeline_info",
        "multiqc_report": "/out/upstream/results/multiqc/multiqc_report.html",
        "h5ad_candidates": [
            "/out/upstream/results/star/mtx_conversions/combined_filtered_matrix.h5ad"
        ],
        "upstream_dir": "/out/upstream/results",
        "top_level_entries": ["pipeline_info", "star", "multiqc"],
    }

    validation = validate_expected_outputs(
        parsed_outputs, aligner="simpleaf", skip_multiqc=False, skip_fastqc=True
    )

    assert validation["missing_required"] == ["simpleaf"]


def test_validate_expected_outputs_reports_missing_fastqc_when_not_skipped():
    parsed_outputs = {
        "pipeline_info_dir": "/out/upstream/results/pipeline_info",
        "multiqc_report": "/out/upstream/results/multiqc/multiqc_report.html",
        "h5ad_candidates": [
            "/out/upstream/results/simpleaf/mtx_conversions/combined_filtered_matrix.h5ad"
        ],
        "upstream_dir": "/out/upstream/results",
        "top_level_entries": ["pipeline_info", "simpleaf", "multiqc"],
    }

    validation = validate_expected_outputs(
        parsed_outputs, aligner="simpleaf", skip_multiqc=False
    )

    assert "fastqc" in validation["missing_required"]


def test_validate_expected_outputs_requires_fastqc_report_files_when_not_skipped():
    parsed_outputs = {
        "pipeline_info_dir": "/out/upstream/results/pipeline_info",
        "multiqc_report": "/out/upstream/results/multiqc/multiqc_report.html",
        "h5ad_candidates": [
            "/out/upstream/results/simpleaf/mtx_conversions/combined_filtered_matrix.h5ad"
        ],
        "upstream_dir": "/out/upstream/results",
        "top_level_entries": ["pipeline_info", "simpleaf", "multiqc", "fastqc"],
        "official_outputs": {
            "fastqc": {"present": True, "path": "/out/fastqc", "html_reports": [], "zip_reports": []}
        },
    }

    validation = validate_expected_outputs(
        parsed_outputs, aligner="simpleaf", skip_multiqc=False
    )

    assert "fastqc/**/*.html" in validation["missing_required"]
    assert "fastqc/**/*.zip" in validation["missing_required"]


def test_validate_expected_outputs_tolerates_malformed_manifest():
    parsed_outputs = {
        "pipeline_info_dir": "/out/upstream/results/pipeline_info",
        "multiqc_report": "/out/upstream/results/multiqc/multiqc_report.html",
        "h5ad_candidates": [
            "/out/upstream/results/simpleaf/mtx_conversions/combined_filtered_matrix.h5ad"
        ],
        "top_level_entries": ["pipeline_info", "simpleaf", "multiqc", "fastqc"],
        "official_outputs": None,
    }

    validation = validate_expected_outputs(
        parsed_outputs, aligner="simpleaf", skip_multiqc=False
    )

    assert "fastqc/**/*.html" in validation["missing_required"]
    assert "fastqc/**/*.zip" in validation["missing_required"]
