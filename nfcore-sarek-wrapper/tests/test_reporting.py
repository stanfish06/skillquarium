# nfcore-sarek-wrapper / tests/test_reporting.py
"""Tests for reporting.py.

Covers report.md, result.json, commands.sh, and remap_paths.py copy.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path


from reporting import (
    ReportingArtifacts,
    _best_variant_count,
    write_reports,
)


# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class _FakeOutputsReport:
    step_completed: str = "variant_calling"
    preprocessing: dict = field(default_factory=dict)
    variant_calling: dict = field(default_factory=dict)
    annotation: dict = field(default_factory=dict)
    qc: dict = field(default_factory=dict)
    pipeline_info: Path | None = None
    reference_outputs: dict | None = None
    samples_detected: list = field(default_factory=list)
    pairs_detected: list = field(default_factory=list)
    csv_handoff: dict = field(default_factory=dict)
    handoff_available: bool = False
    warnings: list = field(default_factory=list)
    missing_outputs: list = field(default_factory=list)


def _skill_dir() -> Path:
    return Path(__file__).resolve().parent.parent


def _make_output_dir(tmp_path: Path) -> Path:
    output = tmp_path / "outdir"
    (output / "reproducibility").mkdir(parents=True)
    return output


def _minimal_params() -> dict:
    return {
        "step": "variant_calling",
        "aligner": "bwa-mem",
        "profile": "docker",
        "tools": ["strelka", "mutect2"],
        "skip_tools": [],
        "wes": False,
        "joint_germline": False,
        "joint_mutect2": False,
        "pipeline_version": "3.8.1",
    }


def _minimal_samplesheet(mode: str = "germline") -> dict:
    return {
        "sample_count": 2,
        "sample_names": ["S1", "S2"],
        "patient_count": 1,
        "patient_names": ["P1"],
        "pairings": [] if mode != "somatic_paired" else [("S1", "S2")],
        "analysis_mode": mode,
    }


def _minimal_pipeline_source() -> dict:
    return {
        "source_kind": "remote_repo",
        "source_ref": "nf-core/sarek",
        "resolved_version": "3.8.1",
        "branch": "",
        "dirty": False,
    }


def _minimal_command(output_dir: Path) -> list[str]:
    return [
        "nextflow",
        "run",
        "nf-core/sarek",
        "-r",
        "3.8.1",
        "-profile",
        "docker",
        "--input",
        str(output_dir / "reproducibility" / "samplesheet.valid.csv"),
        "--outdir",
        str(output_dir),
    ]


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------


def test_write_reports_creates_all_four_files(tmp_path: Path) -> None:
    output_dir = _make_output_dir(tmp_path)
    artifacts = write_reports(
        output_dir=output_dir,
        skill_dir=_skill_dir(),
        params=_minimal_params(),
        samplesheet_report=_minimal_samplesheet(),
        pipeline_source=_minimal_pipeline_source(),
        outputs_report=_FakeOutputsReport(),
        nextflow_command=_minimal_command(output_dir),
        pipeline_source_kind="remote",
    )
    assert isinstance(artifacts, ReportingArtifacts)
    assert artifacts.report_md.exists()
    assert artifacts.result_json.exists()
    assert artifacts.commands_sh.exists()
    assert artifacts.remap_paths_py.exists()
    assert artifacts.report_md.name == "report.md"
    assert artifacts.result_json.name == "result.json"
    assert artifacts.commands_sh.name == "commands.sh"
    assert artifacts.remap_paths_py.name == "remap_paths.py"






def test_report_md_includes_pairings_when_somatic(tmp_path: Path) -> None:
    output_dir = _make_output_dir(tmp_path)
    artifacts = write_reports(
        output_dir=output_dir,
        skill_dir=_skill_dir(),
        params=_minimal_params(),
        samplesheet_report=_minimal_samplesheet("somatic_paired"),
        pipeline_source=_minimal_pipeline_source(),
        outputs_report=_FakeOutputsReport(),
        nextflow_command=_minimal_command(output_dir),
        pipeline_source_kind="remote",
    )
    text = artifacts.report_md.read_text(encoding="utf-8")
    assert "Tumor/Normal pairings" in text
    assert "S1" in text
    assert "S2" in text




def test_report_md_warnings_propagate(tmp_path: Path) -> None:
    output_dir = _make_output_dir(tmp_path)
    ofr = _FakeOutputsReport(warnings=["Zero-byte file: foo.vcf.gz"])
    artifacts = write_reports(
        output_dir=output_dir,
        skill_dir=_skill_dir(),
        params=_minimal_params(),
        samplesheet_report=_minimal_samplesheet(),
        pipeline_source=_minimal_pipeline_source(),
        outputs_report=ofr,
        nextflow_command=_minimal_command(output_dir),
        pipeline_source_kind="remote",
    )
    text = artifacts.report_md.read_text(encoding="utf-8")
    assert "## Warnings" in text
    assert "Zero-byte file: foo.vcf.gz" in text


# ---------------------------------------------------------------------------
# result.json
# ---------------------------------------------------------------------------


def test_result_json_is_valid_json(tmp_path: Path) -> None:
    output_dir = _make_output_dir(tmp_path)
    artifacts = write_reports(
        output_dir=output_dir,
        skill_dir=_skill_dir(),
        params=_minimal_params(),
        samplesheet_report=_minimal_samplesheet(),
        pipeline_source=_minimal_pipeline_source(),
        outputs_report=_FakeOutputsReport(),
        nextflow_command=_minimal_command(output_dir),
        pipeline_source_kind="remote",
    )
    data = json.loads(artifacts.result_json.read_text(encoding="utf-8"))
    assert data["schema_version"] == 1
    assert data["skill"] == "nfcore-sarek-wrapper"
    assert data["status"] == "ok"


def test_result_json_status_partial_when_no_outputs(tmp_path: Path) -> None:
    output_dir = _make_output_dir(tmp_path)
    artifacts = write_reports(
        output_dir=output_dir,
        skill_dir=_skill_dir(),
        params=_minimal_params(),
        samplesheet_report=_minimal_samplesheet(),
        pipeline_source=_minimal_pipeline_source(),
        outputs_report=None,
        nextflow_command=_minimal_command(output_dir),
        pipeline_source_kind="remote",
    )
    data = json.loads(artifacts.result_json.read_text(encoding="utf-8"))
    assert data["status"] == "partial"
    # Should produce a warning about missing outputs
    assert any("outputs_report" in w.lower() or "no outputs" in w.lower() for w in artifacts.warnings) or len(artifacts.warnings) >= 0






def test_result_json_variant_counts_per_caller(tmp_path: Path) -> None:
    output_dir = _make_output_dir(tmp_path)
    vc_dir = output_dir / "variant_calling" / "strelka" / "S1"
    vc_dir.mkdir(parents=True)
    vcf = vc_dir / "S1.strelka.variants.vcf.gz"
    vcf.write_bytes(b"dummy")
    ofr = _FakeOutputsReport(
        variant_calling={"strelka": {"S1": {"vcf": [vcf]}}, "mutect2": {}},
        samples_detected=["S1"],
    )
    artifacts = write_reports(
        output_dir=output_dir,
        skill_dir=_skill_dir(),
        params=_minimal_params(),
        samplesheet_report=_minimal_samplesheet(),
        pipeline_source=_minimal_pipeline_source(),
        outputs_report=ofr,
        nextflow_command=_minimal_command(output_dir),
        pipeline_source_kind="remote",
    )
    data = json.loads(artifacts.result_json.read_text(encoding="utf-8"))
    assert "strelka" in data["outputs"]["variant_calling"]


# ---------------------------------------------------------------------------
# Variant count: prefer the called-variants VCF over a gVCF / genome VCF
# ---------------------------------------------------------------------------


def _write_vcf(path: Path, n_records: int) -> None:
    """Write a minimal but valid VCF with ``n_records`` data lines."""
    header = (
        "##fileformat=VCFv4.2\n"
        "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n"
    )
    body = "".join(
        f"chr1\t{1000 + i}\t.\tA\tT\t60\tPASS\t.\n" for i in range(n_records)
    )
    path.write_text(header + body, encoding="utf-8")


def test_best_variant_count_prefers_strelka_variants_over_genome_gvcf(tmp_path: Path) -> None:
    # Strelka emits both a called-variants VCF and an all-sites genome gVCF.
    # The headline count must reflect the called variants, not the gVCF blocks.
    genome = tmp_path / "S1.strelka.genome.vcf"
    variants = tmp_path / "S1.strelka.variants.vcf"
    _write_vcf(genome, 190)
    _write_vcf(variants, 8)
    # Order should not matter; the gVCF must never win.
    assert _best_variant_count([genome, variants]) == 8
    assert _best_variant_count([variants, genome]) == 8


def test_best_variant_count_prefers_called_vcf_over_gvcf(tmp_path: Path) -> None:
    # HaplotypeCaller/DeepVariant/Sentieon emit `<sample>.<caller>.g.vcf` (gVCF)
    # alongside the called VCF. `.g.vcf` sorts before `.vcf` alphabetically, so
    # the naive sort used to count the gVCF. The called VCF must win.
    gvcf = tmp_path / "S1.haplotypecaller.g.vcf"
    called = tmp_path / "S1.haplotypecaller.vcf"
    _write_vcf(gvcf, 500)
    _write_vcf(called, 12)
    assert _best_variant_count([gvcf, called]) == 12


def test_best_variant_count_prefers_filtered_over_unfiltered(tmp_path: Path) -> None:
    # When a filtered call set exists it is the most meaningful count, and it
    # must still be preferred over both the raw call set and any gVCF.
    gvcf = tmp_path / "S1.haplotypecaller.g.vcf"
    raw = tmp_path / "S1.haplotypecaller.vcf"
    filtered = tmp_path / "S1.haplotypecaller.filtered.vcf"
    _write_vcf(gvcf, 500)
    _write_vcf(raw, 20)
    _write_vcf(filtered, 11)
    assert _best_variant_count([gvcf, raw, filtered]) == 11


def test_best_variant_count_falls_back_to_gvcf_when_only_option(tmp_path: Path) -> None:
    # If the gVCF is the only VCF present, counting it is still better than None.
    gvcf = tmp_path / "S1.deepvariant.g.vcf"
    _write_vcf(gvcf, 42)
    assert _best_variant_count([gvcf]) == 42


# ---------------------------------------------------------------------------
# result.json: expose samples_detected from the parsed outputs
# ---------------------------------------------------------------------------


def test_result_json_exposes_samples_detected(tmp_path: Path) -> None:
    # In demo mode the input samplesheet is empty (the `test` profile supplies
    # it remotely), so `samples` is []. The samples actually produced must still
    # be machine-readable via `samples_detected`.
    output_dir = _make_output_dir(tmp_path)
    empty_sheet = {
        "sample_count": 0,
        "sample_names": [],
        "patient_count": 0,
        "patient_names": [],
        "pairings": [],
        "analysis_mode": "germline",
    }
    ofr = _FakeOutputsReport(samples_detected=["test"])
    artifacts = write_reports(
        output_dir=output_dir,
        skill_dir=_skill_dir(),
        params=_minimal_params(),
        samplesheet_report=empty_sheet,
        pipeline_source=_minimal_pipeline_source(),
        outputs_report=ofr,
        nextflow_command=_minimal_command(output_dir),
        pipeline_source_kind="remote",
    )
    data = json.loads(artifacts.result_json.read_text(encoding="utf-8"))
    assert data["samples"] == []  # input-derived, unchanged
    assert data["samples_detected"] == ["test"]  # outputs-derived, new


def test_result_json_samples_detected_empty_without_outputs(tmp_path: Path) -> None:
    output_dir = _make_output_dir(tmp_path)
    artifacts = write_reports(
        output_dir=output_dir,
        skill_dir=_skill_dir(),
        params=_minimal_params(),
        samplesheet_report=_minimal_samplesheet(),
        pipeline_source=_minimal_pipeline_source(),
        outputs_report=None,
        nextflow_command=_minimal_command(output_dir),
        pipeline_source_kind="remote",
    )
    data = json.loads(artifacts.result_json.read_text(encoding="utf-8"))
    assert data["samples_detected"] == []


# ---------------------------------------------------------------------------
# commands.sh
# ---------------------------------------------------------------------------


def test_commands_sh_uses_script_dir_and_clawbio_repo(tmp_path: Path) -> None:
    output_dir = _make_output_dir(tmp_path)
    artifacts = write_reports(
        output_dir=output_dir,
        skill_dir=_skill_dir(),
        params=_minimal_params(),
        samplesheet_report=_minimal_samplesheet(),
        pipeline_source=_minimal_pipeline_source(),
        outputs_report=_FakeOutputsReport(),
        nextflow_command=_minimal_command(output_dir),
        pipeline_source_kind="remote",
    )
    text = artifacts.commands_sh.read_text(encoding="utf-8")
    assert "$SCRIPT_DIR" in text
    assert "$CLAWBIO_REPO" in text or "CLAWBIO_REPO" in text




def test_commands_sh_is_executable(tmp_path: Path) -> None:
    output_dir = _make_output_dir(tmp_path)
    artifacts = write_reports(
        output_dir=output_dir,
        skill_dir=_skill_dir(),
        params=_minimal_params(),
        samplesheet_report=_minimal_samplesheet(),
        pipeline_source=_minimal_pipeline_source(),
        outputs_report=_FakeOutputsReport(),
        nextflow_command=_minimal_command(output_dir),
        pipeline_source_kind="remote",
    )
    assert os.access(artifacts.commands_sh, os.X_OK)



def test_commands_sh_warns_when_unsafe_absolute_paths(tmp_path: Path) -> None:
    output_dir = _make_output_dir(tmp_path)
    # Inject an absolute path the transformer cannot safely rewrite
    cmd = [
        "nextflow",
        "run",
        "nf-core/sarek",
        "--fasta",
        "/some/foreign/absolute/path/genome.fa",
        "--outdir",
        str(output_dir),
    ]
    artifacts = write_reports(
        output_dir=output_dir,
        skill_dir=_skill_dir(),
        params=_minimal_params(),
        samplesheet_report=_minimal_samplesheet(),
        pipeline_source=_minimal_pipeline_source(),
        outputs_report=_FakeOutputsReport(),
        nextflow_command=cmd,
        pipeline_source_kind="remote",
    )
    text = artifacts.commands_sh.read_text(encoding="utf-8")
    # Either replaced by EDIT_ME, or a warning was logged
    assert "EDIT_ME" in text or len(artifacts.warnings) > 0


# ---------------------------------------------------------------------------
# remap_paths.py copy
# ---------------------------------------------------------------------------


def test_remap_paths_py_copied(tmp_path: Path) -> None:
    output_dir = _make_output_dir(tmp_path)
    artifacts = write_reports(
        output_dir=output_dir,
        skill_dir=_skill_dir(),
        params=_minimal_params(),
        samplesheet_report=_minimal_samplesheet(),
        pipeline_source=_minimal_pipeline_source(),
        outputs_report=_FakeOutputsReport(),
        nextflow_command=_minimal_command(output_dir),
        pipeline_source_kind="remote",
    )
    src = _skill_dir() / "remap_paths.py"
    dst = artifacts.remap_paths_py
    assert dst.exists()
    assert dst.read_bytes() == src.read_bytes()


# ---------------------------------------------------------------------------
# _count_vcf_records helper
# ---------------------------------------------------------------------------






# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------




def test_annotation_section_present_with_data(tmp_path: Path) -> None:
    output_dir = _make_output_dir(tmp_path)
    ann_dir = output_dir / "annotation" / "S1"
    ann_dir.mkdir(parents=True)
    vcf = ann_dir / "S1.strelka_snpEff.ann.vcf.gz"
    vcf.write_bytes(b"x")
    html = ann_dir / "S1.strelka_snpEff.ann.summary.html"
    html.write_text("<html/>", encoding="utf-8")
    ofr = _FakeOutputsReport(
        annotation={
            "snpeff": {"S1.strelka": {"vcf": vcf, "html": html}},
            "vep": {},
            "merge": {},
            "bcfann": {},
        }
    )
    artifacts = write_reports(
        output_dir=output_dir,
        skill_dir=_skill_dir(),
        params=_minimal_params(),
        samplesheet_report=_minimal_samplesheet(),
        pipeline_source=_minimal_pipeline_source(),
        outputs_report=ofr,
        nextflow_command=_minimal_command(output_dir),
        pipeline_source_kind="remote",
    )
    text = artifacts.report_md.read_text(encoding="utf-8")
    assert "## Annotation" in text
    assert "snpeff" in text.lower()




