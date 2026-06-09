from __future__ import annotations

from argparse import Namespace
from pathlib import Path
import sys

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from params_builder import build_effective_params, build_params_file


def _base_args(tmp_path: Path, **overrides) -> Namespace:
    defaults = dict(
        demo=False,
        preset="star",
        protocol=None,
        email=None,
        email_on_fail=None,
        multiqc_title=None,
        multiqc_config=None,
        multiqc_logo=None,
        multiqc_methods_description=None,
        publish_dir_mode=None,
        trace_report_suffix=None,
        monochrome_logs=False,
        skip_cellbender=False,
        skip_fastqc=False,
        skip_emptydrops=False,
        skip_multiqc=False,
        fasta=None,
        gtf=None,
        transcript_fasta=None,
        txp2gene=None,
        simpleaf_index=None,
        kallisto_index=None,
        star_index=None,
        cellranger_index=None,
        barcode_whitelist=None,
        star_feature=None,
        star_ignore_sjdbgtf=False,
        seq_center=None,
        simpleaf_umi_resolution=None,
        kb_workflow=None,
        kb_t1c=None,
        kb_t2c=None,
        skip_cellranger_renaming=False,
        motifs=None,
        cellrangerarc_config=None,
        cellrangerarc_reference=None,
        cellranger_vdj_index=None,
        skip_cellrangermulti_vdjref=False,
        gex_frna_probe_set=None,
        gex_target_panel=None,
        gex_cmo_set=None,
        fb_reference=None,
        vdj_inner_enrichment_primers=None,
        gex_barcode_sample_assignment=None,
        cellranger_multi_barcodes=None,
        genome=None,
        save_reference=False,
        save_align_intermeds=None,
    )
    defaults.update(overrides)
    return Namespace(**defaults)


def test_build_params_file_standard(tmp_path):
    samplesheet = tmp_path / "reproducibility" / "samplesheet.valid.csv"
    samplesheet.parent.mkdir()
    samplesheet.write_text("sample,fastq_1,fastq_2\n", encoding="utf-8")
    args = _base_args(
        tmp_path,
        preset="standard",
        protocol="10XV2",
        fasta=str(tmp_path / "g.fa"),
        gtf=str(tmp_path / "g.gtf"),
    )
    path, payload = build_params_file(
        args, normalized_samplesheet=samplesheet, output_dir=tmp_path
    )
    loaded = yaml.safe_load(path.read_text(encoding="utf-8"))
    assert payload["aligner"] == "simpleaf"
    # Keep --input schema-safe even when the absolute output path contains whitespace.
    assert loaded["input"] == "reproducibility/samplesheet.valid.csv"
    assert loaded["protocol"] == "10XV2"


def test_input_path_is_relative_when_output_dir_contains_spaces(tmp_path):
    output_dir = tmp_path / "output with spaces"
    samplesheet = output_dir / "reproducibility" / "samplesheet.valid.csv"
    samplesheet.parent.mkdir(parents=True)
    samplesheet.write_text("sample,fastq_1,fastq_2\n", encoding="utf-8")
    args = _base_args(tmp_path, preset="star")

    path, _payload = build_params_file(
        args, normalized_samplesheet=samplesheet, output_dir=output_dir
    )

    loaded = yaml.safe_load(path.read_text(encoding="utf-8"))
    assert loaded["input"] == "reproducibility/samplesheet.valid.csv"
    assert " " not in loaded["input"]


def test_build_params_file_demo_omits_input(tmp_path):
    samplesheet = tmp_path / "samplesheet.valid.csv"
    samplesheet.write_text("sample,fastq_1,fastq_2\n", encoding="utf-8")
    args = _base_args(tmp_path, demo=True, preset="star")
    path, _payload = build_params_file(
        args, normalized_samplesheet=samplesheet, output_dir=tmp_path
    )
    loaded = yaml.safe_load(path.read_text(encoding="utf-8"))
    assert "input" not in loaded


def test_reference_paths_are_resolved_to_absolute(tmp_path):
    """Relative reference paths must be resolved to absolute before writing to params."""
    samplesheet = tmp_path / "samplesheet.valid.csv"
    samplesheet.write_text("sample,fastq_1,fastq_2\n", encoding="utf-8")
    fasta = tmp_path / "genome.fa"
    fasta.write_text(">c\nACGT\n", encoding="utf-8")
    args = _base_args(tmp_path, preset="star", fasta=str(fasta))
    path, _ = build_params_file(
        args, normalized_samplesheet=samplesheet, output_dir=tmp_path
    )
    loaded = yaml.safe_load(path.read_text(encoding="utf-8"))
    assert Path(loaded["fasta"]).is_absolute()


# ── skip flags ────────────────────────────────────────────────────────────────


def test_skip_emptydrops_is_deprecated_alias_for_skip_cellbender(tmp_path):
    """Upstream marks skip_emptydrops as deprecated in favour of skip_cellbender,
    so --skip-emptydrops must map to skip_cellbender and never emit the deprecated
    param itself."""
    samplesheet = tmp_path / "samplesheet.valid.csv"
    samplesheet.write_text("sample,fastq_1,fastq_2\n", encoding="utf-8")
    args = _base_args(tmp_path, skip_emptydrops=True)
    path, _ = build_params_file(
        args, normalized_samplesheet=samplesheet, output_dir=tmp_path
    )
    loaded = yaml.safe_load(path.read_text(encoding="utf-8"))
    assert loaded["skip_cellbender"] is True
    assert "skip_emptydrops" not in loaded


def test_skip_flags_absent_when_false(tmp_path):
    """Skip flags must not pollute params.yaml when not requested."""
    samplesheet = tmp_path / "samplesheet.valid.csv"
    samplesheet.write_text("sample,fastq_1,fastq_2\n", encoding="utf-8")
    args = _base_args(
        tmp_path,
        skip_cellbender=False,
        skip_fastqc=False,
        skip_emptydrops=False,
        skip_multiqc=False,
    )
    path, _ = build_params_file(
        args, normalized_samplesheet=samplesheet, output_dir=tmp_path
    )
    loaded = yaml.safe_load(path.read_text(encoding="utf-8"))
    assert "skip_cellbender" not in loaded
    assert "skip_fastqc" not in loaded
    assert "skip_emptydrops" not in loaded
    assert "skip_multiqc" not in loaded


# ── aligner tuning ────────────────────────────────────────────────────────────


# ── reference management ──────────────────────────────────────────────────────


def test_save_align_intermeds_false_written_only_when_explicit(tmp_path):
    samplesheet = tmp_path / "samplesheet.valid.csv"
    samplesheet.write_text("sample,fastq_1,fastq_2\n", encoding="utf-8")
    args = _base_args(tmp_path, save_align_intermeds=False)
    params = build_effective_params(
        args, normalized_samplesheet=samplesheet, output_dir=tmp_path
    )
    assert params["save_align_intermeds"] is False


# ── input/output metadata ─────────────────────────────────────────────────────


def test_generic_nfcore_params_are_written_when_supplied(tmp_path):
    samplesheet = tmp_path / "samplesheet.valid.csv"
    samplesheet.write_text("sample,fastq_1,fastq_2\n", encoding="utf-8")
    multiqc_config = tmp_path / "multiqc.yaml"
    multiqc_logo = tmp_path / "logo.png"
    methods = tmp_path / "methods.yaml"
    multiqc_config.write_text("title: Test\n", encoding="utf-8")
    multiqc_logo.write_bytes(b"png")
    methods.write_text("section: Test\n", encoding="utf-8")
    args = _base_args(
        tmp_path,
        email_on_fail="fail@example.com",
        multiqc_config=str(multiqc_config),
        multiqc_logo=str(multiqc_logo),
        multiqc_methods_description=str(methods),
        publish_dir_mode="copy",
        trace_report_suffix="batch42",
        monochrome_logs=True,
    )
    path, _ = build_params_file(
        args, normalized_samplesheet=samplesheet, output_dir=tmp_path
    )
    loaded = yaml.safe_load(path.read_text(encoding="utf-8"))
    assert loaded["email_on_fail"] == "fail@example.com"
    assert loaded["multiqc_config"] == multiqc_config.resolve().as_posix()
    assert loaded["multiqc_logo"] == multiqc_logo.resolve().as_posix()
    assert loaded["multiqc_methods_description"] == methods.resolve().as_posix()
    assert loaded["publish_dir_mode"] == "copy"
    assert loaded["trace_report_suffix"] == "batch42"
    assert loaded["monochrome_logs"] is True


# ── STARsolo additional options ───────────────────────────────────────────────


def test_star_ignore_sjdbgtf_written_as_string(tmp_path):
    """star_ignore_sjdbgtf schema type is 'string' — must be written as 'true', not boolean True,
    to pass nf-core JSON schema validation."""
    samplesheet = tmp_path / "samplesheet.valid.csv"
    samplesheet.write_text("sample,fastq_1,fastq_2\n", encoding="utf-8")
    args = _base_args(tmp_path, preset="star", star_ignore_sjdbgtf=True)
    path, _ = build_params_file(
        args, normalized_samplesheet=samplesheet, output_dir=tmp_path
    )
    loaded = yaml.safe_load(path.read_text(encoding="utf-8"))
    assert loaded["star_ignore_sjdbgtf"] == "true"
    assert not isinstance(loaded["star_ignore_sjdbgtf"], bool)


# ── Kallisto RNA velocity ─────────────────────────────────────────────────────


# ── CellRanger ────────────────────────────────────────────────────────────────


# ── CellRanger ARC ────────────────────────────────────────────────────────────


# ── CellRanger Multi ──────────────────────────────────────────────────────────


def test_cellranger_multi_path_params_appear_in_params(tmp_path):
    samplesheet = tmp_path / "samplesheet.valid.csv"
    samplesheet.write_text("sample,fastq_1,fastq_2\n", encoding="utf-8")
    vdj_index = tmp_path / "vdj_idx"
    vdj_index.mkdir()
    barcodes = tmp_path / "barcodes.csv"
    barcodes.write_text("sample,barcode\n", encoding="utf-8")
    cmo_set = tmp_path / "cmo.csv"
    cmo_set.write_text("id,sequence\n", encoding="utf-8")
    args = _base_args(
        tmp_path,
        preset="cellrangermulti",
        cellranger_vdj_index=str(vdj_index),
        cellranger_multi_barcodes=str(barcodes),
        gex_cmo_set=str(cmo_set),
    )
    path, _ = build_params_file(
        args, normalized_samplesheet=samplesheet, output_dir=tmp_path
    )
    loaded = yaml.safe_load(path.read_text(encoding="utf-8"))
    assert loaded["cellranger_vdj_index"] == vdj_index.resolve().as_posix()
    assert loaded["cellranger_multi_barcodes"] == barcodes.resolve().as_posix()
    assert loaded["gex_cmo_set"] == cmo_set.resolve().as_posix()


# ── igenomes_ignore suppression ───────────────────────────────────────────────


def test_igenomes_ignore_set_when_fasta_provided(tmp_path):
    samplesheet = tmp_path / "samplesheet.valid.csv"
    samplesheet.write_text("sample,fastq_1,fastq_2\n", encoding="utf-8")
    fasta = tmp_path / "genome.fa"
    fasta.write_text(">c\nACGT\n", encoding="utf-8")
    args = _base_args(tmp_path, preset="star", fasta=str(fasta))
    path, _ = build_params_file(
        args, normalized_samplesheet=samplesheet, output_dir=tmp_path
    )
    loaded = yaml.safe_load(path.read_text(encoding="utf-8"))
    assert loaded.get("igenomes_ignore") is True


def test_igenomes_ignore_absent_when_genome_shortcut_used(tmp_path):
    """When using an iGenomes shortcut, igenomes_ignore must NOT be set."""
    samplesheet = tmp_path / "samplesheet.valid.csv"
    samplesheet.write_text("sample,fastq_1,fastq_2\n", encoding="utf-8")
    args = _base_args(tmp_path, preset="star", genome="GRCh38")
    path, _ = build_params_file(
        args, normalized_samplesheet=samplesheet, output_dir=tmp_path
    )
    loaded = yaml.safe_load(path.read_text(encoding="utf-8"))
    assert "igenomes_ignore" not in loaded
