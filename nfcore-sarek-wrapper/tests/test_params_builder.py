"""Regression tests for Sarek params.yaml construction."""
from __future__ import annotations

import argparse

from params_builder import build_effective_params, write_params_yaml


def test_params_yaml_written_with_lf_line_endings(tmp_path):
    """Cross-OS: params.yaml is written LF-only (never CRLF) so the repro bundle
    is byte-stable and checksums match across operating systems."""
    path = write_params_yaml(
        {"step": "mapping", "genome": "GATK.GRCh38", "tools": "haplotypecaller"},
        output_dir=tmp_path,
    )
    data = path.read_bytes()
    assert b"\r" not in data
    assert data.endswith(b"\n")


def _args(**overrides):
    base = {
        "demo": False,
        "_noinput": False,
        "build_only_index": False,
        "input": "samplesheet.csv",
        "step": "mapping",
        "aligner": "bwa-mem",
        "params_file": None,
        "extra_param": [],
        "_extras": {},
    }
    base.update(overrides)
    return argparse.Namespace(**base)


def test_split_fastq_below_250_rejected(tmp_path):
    import pytest
    from errors import SkillError
    with pytest.raises(SkillError):
        build_effective_params(
            _args(split_fastq=100),
            normalized_samplesheet=tmp_path / "samplesheet.valid.csv",
            output_dir=tmp_path,
        )


def test_split_fastq_zero_and_large_ok(tmp_path):
    for value in (0, 250, 50000000):
        params = build_effective_params(
            _args(split_fastq=value),
            normalized_samplesheet=tmp_path / "samplesheet.valid.csv",
            output_dir=tmp_path,
        )
        assert params["split_fastq"] == value


def test_umi_length_below_one_rejected(tmp_path):
    import pytest
    from errors import SkillError
    with pytest.raises(SkillError):
        build_effective_params(
            _args(umi_length=0),
            normalized_samplesheet=tmp_path / "samplesheet.valid.csv",
            output_dir=tmp_path,
        )


def test_vqsr_fields_remain_labels_not_paths(tmp_path):
    params = build_effective_params(
        _args(dbsnp_vqsr="dbsnp", known_indels_vqsr="known_indels", known_snps_vqsr="known_snps"),
        normalized_samplesheet=tmp_path / "samplesheet.valid.csv",
        output_dir=tmp_path,
    )

    assert params["dbsnp_vqsr"] == "dbsnp"
    assert params["known_indels_vqsr"] == "known_indels"
    assert params["known_snps_vqsr"] == "known_snps"


def test_extra_param_unknown_key_is_written_to_params(tmp_path):
    params = build_effective_params(
        _args(_extras={"novel_key": "hello"}),
        normalized_samplesheet=tmp_path / "samplesheet.valid.csv",
        output_dir=tmp_path,
    )

    assert params["novel_key"] == "hello"


def test_extra_param_preserves_numeric_looking_strings(tmp_path):
    params = build_effective_params(
        _args(_extras={"vep_cache_version": "110", "custom_threshold": "30"}),
        normalized_samplesheet=tmp_path / "samplesheet.valid.csv",
        output_dir=tmp_path,
    )

    assert params["vep_cache_version"] == "110"
    assert params["custom_threshold"] == "30"


def test_params_file_is_merged_before_wrapper_params(tmp_path):
    user_params = tmp_path / "user_params.yaml"
    user_params.write_text("tools: freebayes\ncustom_flag: kept\nstep: annotate\n", encoding="utf-8")

    params = build_effective_params(
        _args(params_file=user_params.as_posix(), step="variant_calling", tools="mutect2"),
        normalized_samplesheet=tmp_path / "samplesheet.valid.csv",
        output_dir=tmp_path,
    )

    assert params["custom_flag"] == "kept"
    assert params["step"] == "variant_calling"
    assert params["tools"] == "mutect2"


def test_bcftools_header_lines_is_resolved_as_path(tmp_path, monkeypatch):
    header = tmp_path / "headers.txt"
    header.write_text("##INFO=<ID=TEST,Number=1,Type=String,Description=\"test\">\n", encoding="utf-8")
    work = tmp_path / "work"
    work.mkdir()
    monkeypatch.chdir(work)

    params = build_effective_params(
        _args(bcftools_header_lines="../headers.txt"),
        normalized_samplesheet=tmp_path / "samplesheet.valid.csv",
        output_dir=tmp_path,
    )

    assert params["bcftools_header_lines"] == header.resolve().as_posix()
