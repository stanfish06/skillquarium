"""Reusable fixtures for preflight tests."""
from __future__ import annotations

from typing import Any


def make_params(**overrides: Any) -> dict[str, Any]:
    """Return a minimal valid params dict; override fields as needed."""
    base: dict[str, Any] = {
        "step": "mapping",
        "aligner": "bwa-mem",
        "profile": "docker",
        "tools": [],
        "skip_tools": [],
        "genome": "GATK.GRCh38",
        "igenomes_ignore": False,
        "fasta": None,
        "wes": False,
        "joint_germline": False,
        "joint_mutect2": False,
        "use_gatk_spark": None,
        "save_output_as_bam": False,
        "save_mapped": False,
        "umi_read_structure": None,
        "build_only_index": False,
        "input": "samplesheet.csv",
        "intervals": None,
        "no_intervals": False,
        "filter_vcfs": False,
        "snv_consensus_calling": False,
        "vep_dbnsfp": False,
        "vep_loftee": False,
        "pon": None,
        "email": None,
        "email_on_fail": None,
        "download_cache": False,
        "outdir_cache": None,
    }
    base.update(overrides)
    return base


def make_samplesheet(
    *,
    analysis_mode: str = "germline",
    rows_by_patient: dict | None = None,
    **extra: Any,
) -> dict[str, Any]:
    base: dict[str, Any] = {
        "analysis_mode": analysis_mode,
        "rows_by_patient": rows_by_patient or {},
        "sample_count": 1,
        "sample_names": ["S1"],
        "patient_names": ["P1"],
    }
    base.update(extra)
    return base


def make_pipeline_source(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "source_kind": "remote_repo",
        "source_ref": "nf-core/sarek",
        "resolved_version": "3.8.1",
        "branch": "",
        "dirty": False,
    }
    base.update(overrides)
    return base
