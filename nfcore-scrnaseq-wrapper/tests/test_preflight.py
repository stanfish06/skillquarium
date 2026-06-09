from __future__ import annotations

from argparse import Namespace
from pathlib import Path
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import preflight
from errors import SkillError
from nfcore_4_1_0_contract import POLICY_SOURCE_NFCORE_DOCS

_PIPELINE_SOURCE = {
    "source_kind": "local_checkout",
    "source_ref": "scrnaseq-checkout",
    "resolved_version": "abc123",
    "branch": "main",
    "dirty": False,
}


def _mock_env(monkeypatch):
    monkeypatch.setattr(
        preflight, "_check_java", lambda: {"path": "/usr/bin/java", "version": "17.0.8"}
    )
    monkeypatch.setattr(
        preflight,
        "_check_nextflow",
        lambda: {"path": "/usr/bin/nextflow", "version": "25.04.0"},
    )
    monkeypatch.setattr(
        preflight,
        "_check_profile",
        lambda profile: {
            "profile": profile,
            "backend_path": "/usr/bin/docker",
            "backend_ready": True,
        },
    )


def _args(tmp_path: Path) -> Namespace:
    return Namespace(
        output=str(tmp_path / "out"),
        resume=False,
        preset="star",
        protocol="10XV3",
        profile="docker",
        demo=False,
        email=None,
        email_on_fail=None,
        genome=None,
        fasta=str(tmp_path / "genome.fa"),
        gtf=str(tmp_path / "genes.gtf"),
        transcript_fasta=None,
        txp2gene=None,
        simpleaf_index=None,
        kallisto_index=None,
        star_index=None,
        cellranger_index=None,
        barcode_whitelist=None,
        cellrangerarc_reference=None,
        cellrangerarc_config=None,
        motifs=None,
        kb_t1c=None,
        kb_t2c=None,
        cellranger_vdj_index=None,
        skip_cellrangermulti_vdjref=False,
        gex_frna_probe_set=None,
        gex_target_panel=None,
        gex_cmo_set=None,
        fb_reference=None,
        vdj_inner_enrichment_primers=None,
        gex_barcode_sample_assignment=None,
        cellranger_multi_barcodes=None,
    )


def test_preflight_happy_path(tmp_path, monkeypatch):
    args = _args(tmp_path)
    Path(args.fasta).write_text(">chr1\nACGT\n", encoding="utf-8")
    Path(args.gtf).write_text(
        'chr1\tsrc\tgene\t1\t4\t.\t+\t.\tgene_id "g1";\n', encoding="utf-8"
    )
    _mock_env(monkeypatch)
    result = preflight.run_preflight(
        args,
        pipeline_source=_PIPELINE_SOURCE,
        samplesheet_summary={"sample_count": 1, "unknown_columns": []},
    )
    assert result["ok"] is True


def test_profile_accepts_safe_institutional_executor_component(monkeypatch):
    monkeypatch.setattr(
        preflight,
        "_check_singularity_compatible_profile",
        lambda profile: {
            "profile": profile,
            "backend_path": "/usr/bin/singularity",
            "backend_ready": True,
        },
    )
    result = preflight._check_profile("singularity,slurm")

    assert result["profile"] == "singularity,slurm"
    assert result["backend_ready"] is True
    assert result["components"] == ["singularity", "slurm"]


def test_profile_rejects_unsafe_unknown_component():
    with pytest.raises(SkillError) as exc:
        preflight._check_profile("docker,bad profile")

    assert exc.value.error_code == "INVALID_PROFILE"
    assert exc.value.details["invalid_components"] == ["bad profile"]


def test_preflight_rejects_missing_nextflow_config(tmp_path, monkeypatch):
    args = _args(tmp_path)
    args.extra_config = [str(tmp_path / "missing.config")]
    Path(args.fasta).write_text(">chr1\nACGT\n", encoding="utf-8")
    Path(args.gtf).write_text(
        'chr1\tsrc\tgene\t1\t4\t.\t+\t.\tgene_id "g1";\n', encoding="utf-8"
    )
    _mock_env(monkeypatch)

    with pytest.raises(SkillError) as exc:
        preflight.run_preflight(
            args,
            pipeline_source=_PIPELINE_SOURCE,
            samplesheet_summary={"sample_count": 1, "unknown_columns": []},
        )

    assert exc.value.error_code == "INVALID_PRESET_CONFIGURATION"
    assert exc.value.details["field"] == "extra_config"


def test_preflight_rejects_missing_reference(tmp_path, monkeypatch):
    args = _args(tmp_path)
    _mock_env(monkeypatch)
    with pytest.raises(SkillError) as exc:
        preflight.run_preflight(
            args,
            pipeline_source=_PIPELINE_SOURCE,
            samplesheet_summary={"sample_count": 1, "unknown_columns": []},
        )
    assert exc.value.error_code == "MISSING_REFERENCE"


def test_fasta_path_with_whitespace_fails_before_nextflow_schema(tmp_path, monkeypatch):
    args = _args(tmp_path)
    fasta_dir = tmp_path / "refs with spaces"
    fasta_dir.mkdir()
    fasta = fasta_dir / "genome.fa"
    gtf = tmp_path / "genes.gtf"
    fasta.write_text(">chr1\nACGT\n", encoding="utf-8")
    gtf.write_text('chr1\tsrc\tgene\t1\t4\t.\t+\t.\tgene_id "g1";\n', encoding="utf-8")
    args.fasta = str(fasta)
    args.gtf = str(gtf)
    _mock_env(monkeypatch)

    with pytest.raises(SkillError) as exc:
        preflight.run_preflight(
            args,
            pipeline_source=_PIPELINE_SOURCE,
            samplesheet_summary={"sample_count": 1, "unknown_columns": []},
        )

    assert exc.value.error_code == "INVALID_PRESET_CONFIGURATION"
    assert exc.value.details["field"] == "fasta"


def test_preflight_rejects_email_not_matching_nfcore_schema(tmp_path, monkeypatch):
    args = _args(tmp_path)
    args.email = "bad address@example.org"
    _mock_env(monkeypatch)

    with pytest.raises(SkillError) as exc:
        preflight.run_preflight(
            args,
            pipeline_source=_PIPELINE_SOURCE,
            samplesheet_summary={"sample_count": 1, "unknown_columns": []},
        )

    assert exc.value.error_code == "INVALID_PRESET_CONFIGURATION"
    assert exc.value.details["field"] == "email"


@pytest.mark.parametrize("preset", ["standard", "star", "kallisto"])
def test_missing_protocol_is_rejected_for_non_cellranger_presets(
    tmp_path, monkeypatch, preset
):
    args = _args(tmp_path)
    args.preset = preset
    args.protocol = None
    Path(args.fasta).write_text(">chr1\nACGT\n", encoding="utf-8")
    Path(args.gtf).write_text(
        'chr1\tsrc\tgene\t1\t4\t.\t+\t.\tgene_id "g1";\n', encoding="utf-8"
    )
    _mock_env(monkeypatch)

    with pytest.raises(SkillError) as exc:
        preflight.run_preflight(
            args,
            pipeline_source=_PIPELINE_SOURCE,
            samplesheet_summary={"sample_count": 1, "unknown_columns": []},
        )

    assert exc.value.error_code == "INVALID_PRESET_CONFIGURATION"
    assert exc.value.details["missing_field"] == "protocol"
    assert exc.value.details["policy_source"] == POLICY_SOURCE_NFCORE_DOCS


@pytest.mark.parametrize("preset", ["cellranger", "cellrangerarc", "cellrangermulti"])
def test_missing_protocol_preserves_cellranger_auto_detection(
    tmp_path, monkeypatch, preset
):
    args = _args(tmp_path)
    args.preset = preset
    args.protocol = None
    args.genome = "GRCh38"
    args.fasta = None
    args.gtf = None
    _mock_env(monkeypatch)

    result = preflight.run_preflight(
        args,
        pipeline_source=_PIPELINE_SOURCE,
        samplesheet_summary={
            "sample_count": 1,
            "unknown_columns": [],
            "feature_types": ["gex"],
        },
    )

    assert result["ok"] is True


@pytest.mark.parametrize("preset", ["star", "kallisto"])
def test_scrnaseq_accepts_smartseq_protocol_for_documented_presets(
    tmp_path, monkeypatch, preset
):
    args = _args(tmp_path)
    args.preset = preset
    args.protocol = "smartseq"
    Path(args.fasta).write_text(">chr1\nACGT\n", encoding="utf-8")
    Path(args.gtf).write_text(
        'chr1\tsrc\tgene\t1\t4\t.\t+\t.\tgene_id "g1";\n', encoding="utf-8"
    )
    _mock_env(monkeypatch)

    result = preflight.run_preflight(
        args,
        pipeline_source=_PIPELINE_SOURCE,
        samplesheet_summary={
            "sample_count": 1,
            "unknown_columns": [],
            "feature_types": ["gex"],
        },
    )

    assert result["ok"] is True


@pytest.mark.parametrize(
    "preset", ["standard", "cellranger", "cellrangerarc", "cellrangermulti"]
)
def test_scrnaseq_rejects_smartseq_protocol_for_unsupported_presets(
    tmp_path, monkeypatch, preset
):
    args = _args(tmp_path)
    args.preset = preset
    args.protocol = "smartseq"
    if preset in {"cellranger", "cellrangerarc", "cellrangermulti"}:
        args.genome = "GRCh38"
        args.fasta = None
        args.gtf = None
    _mock_env(monkeypatch)

    with pytest.raises(SkillError) as exc:
        preflight.run_preflight(
            args,
            pipeline_source=_PIPELINE_SOURCE,
            samplesheet_summary={"sample_count": 1, "unknown_columns": []},
        )

    assert exc.value.error_code == "INVALID_PRESET_CONFIGURATION"
    assert "Smart-seq" in exc.value.message
    assert exc.value.details["policy_source"] == POLICY_SOURCE_NFCORE_DOCS


@pytest.mark.parametrize("preset", ["standard", "star", "kallisto"])
def test_non_cellranger_presets_reject_auto_protocol_case_insensitively(
    tmp_path, monkeypatch, preset
):
    args = _args(tmp_path)
    args.preset = preset
    args.protocol = "AUTO"
    _mock_env(monkeypatch)

    with pytest.raises(SkillError) as exc:
        preflight.run_preflight(
            args,
            pipeline_source=_PIPELINE_SOURCE,
            samplesheet_summary={"sample_count": 1, "unknown_columns": []},
        )

    assert exc.value.error_code == "INVALID_PRESET_CONFIGURATION"
    assert exc.value.details["protocol"] == "AUTO"
    assert exc.value.details["policy_source"] == POLICY_SOURCE_NFCORE_DOCS


@pytest.mark.parametrize(
    ("preset", "protocol"),
    [
        ("cellranger", "dropseq"),
        ("cellranger", "customchemistry"),
        ("cellrangerarc", "10XV3"),
        ("cellrangerarc", "customchemistry"),
    ],
)
def test_cellranger_family_rejects_protocols_outside_nfcore_matrix(
    tmp_path, monkeypatch, preset, protocol
):
    args = _args(tmp_path)
    args.preset = preset
    args.protocol = protocol
    args.genome = "GRCh38"
    args.fasta = None
    args.gtf = None
    _mock_env(monkeypatch)

    with pytest.raises(SkillError) as exc:
        preflight.run_preflight(
            args,
            pipeline_source=_PIPELINE_SOURCE,
            samplesheet_summary={
                "sample_count": 1,
                "unknown_columns": [],
                "feature_types": ["gex"],
            },
        )

    assert exc.value.error_code == "INVALID_PRESET_CONFIGURATION"
    assert exc.value.details["preset"] == preset
    assert exc.value.details["protocol"] == protocol
    assert exc.value.details["policy_source"] == POLICY_SOURCE_NFCORE_DOCS


@pytest.mark.parametrize("preset", ["standard", "star", "kallisto"])
def test_custom_protocol_passthrough_is_kept_for_documented_aligners(
    tmp_path, monkeypatch, preset
):
    args = _args(tmp_path)
    args.preset = preset
    args.protocol = "customchemistry"
    Path(args.fasta).write_text(">chr1\nACGT\n", encoding="utf-8")
    Path(args.gtf).write_text(
        'chr1\tsrc\tgene\t1\t4\t.\t+\t.\tgene_id "g1";\n', encoding="utf-8"
    )
    _mock_env(monkeypatch)

    result = preflight.run_preflight(
        args,
        pipeline_source=_PIPELINE_SOURCE,
        samplesheet_summary={
            "sample_count": 1,
            "unknown_columns": [],
            "feature_types": ["gex"],
        },
    )

    assert result["ok"] is True


def test_output_dir_not_empty_raises(tmp_path, monkeypatch):
    out = tmp_path / "out"
    out.mkdir()
    (out / "result.json").write_text("{}", encoding="utf-8")
    args = _args(tmp_path)
    args.output = str(out)
    fasta = tmp_path / "genome.fa"
    gtf = tmp_path / "genes.gtf"
    fasta.write_text(">chr1\nACGT\n", encoding="utf-8")
    gtf.write_text('chr1\tsrc\tgene\t1\t4\t.\t+\t.\tgene_id "g1";\n', encoding="utf-8")
    args.fasta = str(fasta)
    args.gtf = str(gtf)
    _mock_env(monkeypatch)
    with pytest.raises(SkillError) as exc:
        preflight.run_preflight(
            args,
            pipeline_source=_PIPELINE_SOURCE,
            samplesheet_summary={"sample_count": 1, "unknown_columns": []},
        )
    assert exc.value.error_code == "OUTPUT_DIR_NOT_EMPTY"


def test_genome_shortcut_satisfies_reference_requirement(tmp_path, monkeypatch):
    """--genome (iGenomes shortcut) must satisfy the reference requirement for any preset."""
    args = _args(tmp_path)
    args.genome = "GRCh38"
    args.fasta = None
    args.gtf = None
    _mock_env(monkeypatch)
    result = preflight.run_preflight(
        args,
        pipeline_source=_PIPELINE_SOURCE,
        samplesheet_summary={"sample_count": 1, "unknown_columns": []},
    )
    assert result["ok"] is True


def test_cellrangermulti_antibody_capture_requires_feature_barcode_reference(
    tmp_path, monkeypatch
):
    args = _args(tmp_path)
    args.preset = "cellrangermulti"
    args.genome = "GRCh38"
    args.fasta = None
    args.gtf = None
    _mock_env(monkeypatch)
    with pytest.raises(SkillError) as exc:
        preflight.run_preflight(
            args,
            pipeline_source=_PIPELINE_SOURCE,
            samplesheet_summary={
                "sample_count": 1,
                "unknown_columns": [],
                "feature_types": ["ab"],
            },
        )
    assert exc.value.error_code == "INVALID_PRESET_CONFIGURATION"
    assert exc.value.details["missing_field"] == "fb_reference"


def test_cellrangermulti_ffpe_probe_set_requires_barcodes_samplesheet(
    tmp_path, monkeypatch
):
    args = _args(tmp_path)
    args.preset = "cellrangermulti"
    args.genome = "GRCh38"
    args.fasta = None
    args.gtf = None
    probe_set = tmp_path / "probe_set.csv"
    probe_set.write_text("gene_id\n", encoding="utf-8")
    args.gex_frna_probe_set = str(probe_set)
    _mock_env(monkeypatch)

    with pytest.raises(SkillError) as exc:
        preflight.run_preflight(
            args,
            pipeline_source=_PIPELINE_SOURCE,
            samplesheet_summary={
                "sample_count": 1,
                "unknown_columns": [],
                "feature_types": ["gex"],
            },
        )

    assert exc.value.error_code == "INVALID_PRESET_CONFIGURATION"
    assert exc.value.details["missing_field"] == "cellranger_multi_barcodes"
    assert exc.value.details["field"] == "gex_frna_probe_set"


def test_cellrangermulti_rejects_ffpe_and_cmo_combination(tmp_path, monkeypatch):
    args = _args(tmp_path)
    args.preset = "cellrangermulti"
    args.genome = "GRCh38"
    args.fasta = None
    args.gtf = None
    probe_set = tmp_path / "probe_set.csv"
    barcodes = tmp_path / "barcodes.csv"
    probe_set.write_text("gene_id\n", encoding="utf-8")
    barcodes.write_text("sample,cmo_ids\nsampleA,CMO301\n", encoding="utf-8")
    args.gex_frna_probe_set = str(probe_set)
    args.cellranger_multi_barcodes = str(barcodes)
    _mock_env(monkeypatch)

    with pytest.raises(SkillError) as exc:
        preflight.run_preflight(
            args,
            pipeline_source=_PIPELINE_SOURCE,
            samplesheet_summary={
                "sample_count": 1,
                "unknown_columns": [],
                "feature_types": ["gex", "cmo"],
            },
        )

    assert exc.value.error_code == "INVALID_PRESET_CONFIGURATION"
    assert exc.value.details["conflicting_fields"] == ["gex_frna_probe_set", "cmo"]
    assert exc.value.details["policy_source"] == POLICY_SOURCE_NFCORE_DOCS


def _write_multi_barcodes(path: Path, body_rows: str) -> None:
    """Write a cellranger_multi_barcodes CSV with the documented 4.1.0 header."""
    path.write_text(
        "sample,multiplexed_sample_id,probe_barcode_ids,cmo_ids,ocm_ids,description\n"
        + body_rows,
        encoding="utf-8",
    )


def test_cellrangermulti_rejects_mixed_modes_in_one_barcodes_row(tmp_path, monkeypatch):
    """nf-core/scrnaseq usage docs: the --cellranger-multi-barcodes samplesheet
    encodes the multiplexing mode per sample via probe_barcode_ids (FFPE), cmo_ids
    (CMO) and ocm_ids (OCM), which are mutually exclusive. A single sample mixing
    FFPE and OCM must fail fast in preflight (audit F-2)."""
    args = _args(tmp_path)
    args.preset = "cellrangermulti"
    args.genome = "GRCh38"
    args.fasta = None
    args.gtf = None
    barcodes = tmp_path / "barcodes.csv"
    _write_multi_barcodes(barcodes, "S1,S1_a,BC001,,OB1,desc\n")  # FFPE + OCM
    args.cellranger_multi_barcodes = str(barcodes)
    _mock_env(monkeypatch)

    with pytest.raises(SkillError) as exc:
        preflight.run_preflight(
            args,
            pipeline_source=_PIPELINE_SOURCE,
            samplesheet_summary={
                "sample_count": 1,
                "unknown_columns": [],
                "feature_types": ["gex"],
            },
        )

    assert exc.value.error_code == "INVALID_PRESET_CONFIGURATION"
    assert exc.value.details["conflicting_modes"] == ["FFPE", "OCM"]
    assert exc.value.details["sample"] == "S1"
    assert exc.value.details["policy_source"] == POLICY_SOURCE_NFCORE_DOCS


def test_cellrangermulti_rejects_mixed_modes_across_sample_rows(tmp_path, monkeypatch):
    """Two rows of the same physical sample using different modes (CMO then OCM) is
    rejected — 'using more than one for a single sample' (audit F-2)."""
    args = _args(tmp_path)
    args.preset = "cellrangermulti"
    args.genome = "GRCh38"
    args.fasta = None
    args.gtf = None
    barcodes = tmp_path / "barcodes.csv"
    _write_multi_barcodes(barcodes, "S1,S1_a,,CMO301,,desc\nS1,S1_b,,,OB2,desc\n")
    args.cellranger_multi_barcodes = str(barcodes)
    _mock_env(monkeypatch)

    with pytest.raises(SkillError) as exc:
        preflight.run_preflight(
            args,
            pipeline_source=_PIPELINE_SOURCE,
            samplesheet_summary={
                "sample_count": 1,
                "unknown_columns": [],
                "feature_types": ["gex"],
            },
        )

    assert exc.value.error_code == "INVALID_PRESET_CONFIGURATION"
    assert exc.value.details["conflicting_modes"] == ["CMO", "OCM"]


def test_cellrangermulti_allows_single_mode_ocm_barcodes(tmp_path, monkeypatch):
    """A barcodes samplesheet using a single mode (OCM only, across rows) must NOT
    be rejected (audit F-2)."""
    args = _args(tmp_path)
    args.preset = "cellrangermulti"
    args.genome = "GRCh38"
    args.fasta = None
    args.gtf = None
    barcodes = tmp_path / "barcodes.csv"
    _write_multi_barcodes(barcodes, "S1,S1_a,,,OB1,desc\nS1,S1_b,,,OB2,desc\n")
    args.cellranger_multi_barcodes = str(barcodes)
    _mock_env(monkeypatch)

    result = preflight.run_preflight(
        args,
        pipeline_source=_PIPELINE_SOURCE,
        samplesheet_summary={
            "sample_count": 1,
            "unknown_columns": [],
            "feature_types": ["gex"],
        },
    )

    assert result["ok"] is True


def test_cellrangermulti_barcodes_check_tolerates_unparseable_csv(tmp_path, monkeypatch):
    """A barcodes CSV the wrapper cannot parse locally is deferred to upstream
    nf-schema rather than raising a spurious wrapper error (audit F-2)."""
    args = _args(tmp_path)
    args.preset = "cellrangermulti"
    args.genome = "GRCh38"
    args.fasta = None
    args.gtf = None
    barcodes = tmp_path / "barcodes.csv"
    # No recognised mode columns at all → nothing to validate, must not raise.
    barcodes.write_text("sample,multiplexed_sample_id\nS1,S1_a\n", encoding="utf-8")
    args.cellranger_multi_barcodes = str(barcodes)
    _mock_env(monkeypatch)

    result = preflight.run_preflight(
        args,
        pipeline_source=_PIPELINE_SOURCE,
        samplesheet_summary={
            "sample_count": 1,
            "unknown_columns": [],
            "feature_types": ["gex"],
        },
    )

    assert result["ok"] is True


def test_genome_and_fasta_mutually_exclusive(tmp_path, monkeypatch):
    """--genome and --fasta together must raise CONFLICTING_REFERENCES before Nextflow runs."""
    args = _args(tmp_path)
    args.genome = "GRCh38"
    fasta = tmp_path / "genome.fa"
    fasta.write_text(">chr1\nACGT\n", encoding="utf-8")
    args.fasta = str(fasta)
    _mock_env(monkeypatch)
    with pytest.raises(SkillError) as exc:
        preflight.run_preflight(
            args,
            pipeline_source=_PIPELINE_SOURCE,
            samplesheet_summary={"sample_count": 1, "unknown_columns": []},
        )
    assert exc.value.error_code == "CONFLICTING_REFERENCES"


# ── mamba profile ─────────────────────────────────────────────────────────────


# ── podman profile ────────────────────────────────────────────────────────────


# ── HPC profiles (shifter, charliecloud) ─────────────────────────────────────


# ── macOS + Docker + /tmp warning ─────────────────────────────────────────────


def test_seq_center_with_non_star_preset_warns(tmp_path, monkeypatch, capsys):
    """seq_center only affects STARsolo BAM read groups in nf-core/scrnaseq 4.1.0;
    forwarding it under another aligner is a harmless no-op, so the wrapper warns
    rather than silently ignoring it (audit F-6)."""
    args = _args(tmp_path)
    args.preset = "kallisto"
    args.seq_center = "SequencingCenterX"
    Path(args.fasta).write_text(">chr1\nACGT\n", encoding="utf-8")
    Path(args.gtf).write_text(
        'chr1\tsrc\tgene\t1\t4\t.\t+\t.\tgene_id "g1";\n', encoding="utf-8"
    )
    _mock_env(monkeypatch)

    preflight.run_preflight(
        args,
        pipeline_source=_PIPELINE_SOURCE,
        samplesheet_summary={"sample_count": 1, "unknown_columns": []},
    )

    err = capsys.readouterr().err
    assert "seq_center" in err and "STARsolo" in err


def test_seq_center_with_star_preset_does_not_warn(tmp_path, monkeypatch, capsys):
    args = _args(tmp_path)  # preset defaults to star
    args.seq_center = "SequencingCenterX"
    Path(args.fasta).write_text(">chr1\nACGT\n", encoding="utf-8")
    Path(args.gtf).write_text(
        'chr1\tsrc\tgene\t1\t4\t.\t+\t.\tgene_id "g1";\n', encoding="utf-8"
    )
    _mock_env(monkeypatch)

    preflight.run_preflight(
        args,
        pipeline_source=_PIPELINE_SOURCE,
        samplesheet_summary={"sample_count": 1, "unknown_columns": []},
    )

    assert "seq_center" not in capsys.readouterr().err


def test_nfcore_schema_errors_identify_nfcore_policy(tmp_path, monkeypatch):
    args = _args(tmp_path)
    fasta = tmp_path / "genome.txt"
    gtf = tmp_path / "genes.gtf"
    fasta.write_text(">chr1\nACGT\n", encoding="utf-8")
    gtf.write_text('chr1\tsrc\tgene\t1\t4\t.\t+\t.\tgene_id "g1";\n', encoding="utf-8")
    args.fasta = str(fasta)
    args.gtf = str(gtf)
    _mock_env(monkeypatch)

    with pytest.raises(SkillError) as exc:
        preflight.run_preflight(
            args,
            pipeline_source=_PIPELINE_SOURCE,
            samplesheet_summary={"sample_count": 1, "unknown_columns": []},
        )

    assert exc.value.details.get("policy_source") == POLICY_SOURCE_NFCORE_DOCS
