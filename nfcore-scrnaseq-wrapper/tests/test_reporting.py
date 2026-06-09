from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from reporting import write_report, write_repro_commands, write_result


def _make_args(tmp_path: Path, **kwargs) -> argparse.Namespace:
    defaults = dict(
        input=str(tmp_path / "samplesheet.csv"),
        output=str(tmp_path / "out"),
        preset="star",
        profile="docker",
        pipeline_version="3.14.0",
        protocol=None,
        skip_cellbender=False,
        skip_fastqc=False,
        skip_emptydrops=False,
        skip_multiqc=False,
        resume=False,
        demo=False,
        check=False,
        fasta=None,
        gtf=None,
        transcript_fasta=None,
        txp2gene=None,
        simpleaf_index=None,
        kallisto_index=None,
        star_index=None,
        cellranger_index=None,
        barcode_whitelist=None,
        expected_cells=None,
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
        save_align_intermeds=False,
        run_downstream=False,
        email=None,
        multiqc_title=None,
    )
    defaults.update(kwargs)
    return argparse.Namespace(**defaults)


def _pipeline_source() -> dict:
    return {
        "source_kind": "remote_repo",
        "source_ref": "nf-core/scrnaseq",
        "resolved_version": "3.14.0",
        "branch": "",
        "dirty": False,
    }


def _preflight_result() -> dict:
    return {
        "ok": True,
        "java": {"version": "21.0.0", "path": "/usr/bin/java"},
        "nextflow": {"version": "25.4.0", "path": "/usr/bin/nextflow"},
        "profile": {
            "profile": "docker",
            "backend_path": "/usr/bin/docker",
            "backend_ready": True,
        },
        "pipeline_source": _pipeline_source(),
        "references": {},
        "samplesheet": {"sample_count": 2, "unknown_columns": []},
    }


def _parsed_outputs(preferred_h5ad: str = "") -> dict:
    return {
        "preferred_h5ad": preferred_h5ad,
        "multiqc_report": "",
        "pipeline_info_dir": "",
        "aligner_effective": "star",
        "cellbender_used": False,
        "handoff_available": bool(preferred_h5ad),
        "samples_detected": ["sampleA", "sampleB"],
        "h5ad_candidates": [],
        "rds_candidates": [],
    }


# ── write_report ──────────────────────────────────────────────────────────────


def test_write_report_creates_report_md(tmp_path):
    args = _make_args(tmp_path)
    report_path = write_report(
        tmp_path,
        args=args,
        pipeline_source=_pipeline_source(),
        preflight_result=_preflight_result(),
        parsed_outputs=_parsed_outputs(),
        command_str="nextflow run nf-core/scrnaseq",
    )
    assert report_path == tmp_path / "report.md"
    assert report_path.exists()


def test_write_report_handoff_with_preferred_h5ad(tmp_path):
    preferred = "/output/outs/cellbender.h5ad"
    write_report(
        tmp_path,
        args=_make_args(tmp_path),
        pipeline_source=_pipeline_source(),
        preflight_result=_preflight_result(),
        parsed_outputs=_parsed_outputs(preferred_h5ad=preferred),
        command_str="nextflow run nf-core/scrnaseq",
    )
    content = (tmp_path / "report.md").read_text(encoding="utf-8")
    assert preferred in content
    assert "scrna" in content


def test_write_report_handoff_without_preferred_h5ad(tmp_path):
    write_report(
        tmp_path,
        args=_make_args(tmp_path),
        pipeline_source=_pipeline_source(),
        preflight_result=_preflight_result(),
        parsed_outputs=_parsed_outputs(preferred_h5ad=""),
        command_str="nextflow run nf-core/scrnaseq",
    )
    content = (tmp_path / "report.md").read_text(encoding="utf-8")
    assert "not available" in content or "No canonical" in content


def test_write_report_uses_samplesheet_sample_count(tmp_path):
    parsed = {**_parsed_outputs(), "samples_detected": []}
    write_report(
        tmp_path,
        args=_make_args(tmp_path),
        pipeline_source=_pipeline_source(),
        preflight_result=_preflight_result(),
        parsed_outputs=parsed,
        command_str="nextflow run nf-core/scrnaseq",
    )
    content = (tmp_path / "report.md").read_text(encoding="utf-8")
    assert "- Samples: `2`" in content


def test_write_report_falls_back_to_detected_samples_when_count_missing(tmp_path):
    preflight = _preflight_result()
    preflight["samplesheet"]["sample_count"] = None
    write_report(
        tmp_path,
        args=_make_args(tmp_path),
        pipeline_source=_pipeline_source(),
        preflight_result=preflight,
        parsed_outputs=_parsed_outputs(),
        command_str="nextflow run nf-core/scrnaseq",
    )
    content = (tmp_path / "report.md").read_text(encoding="utf-8")
    assert "- Samples: `2`" in content


# ── write_repro_commands ──────────────────────────────────────────────────────


def test_write_repro_commands_creates_commands_sh(tmp_path):
    args = _make_args(tmp_path)
    write_repro_commands(tmp_path, args=args, pipeline_source=_pipeline_source())
    assert (tmp_path / "reproducibility" / "commands.sh").exists()


def test_write_repro_commands_demo_uses_test_profile(tmp_path):
    """Demo runs prepend the nf-core `test` profile and never re-invoke the wrapper."""
    args = _make_args(tmp_path, demo=True, profile="docker")
    write_repro_commands(tmp_path, args=args, pipeline_source=_pipeline_source())
    content = (tmp_path / "reproducibility" / "commands.sh").read_text(encoding="utf-8")
    assert "-profile test,docker" in content
    assert "nfcore_scrnaseq_wrapper.py" not in content
    assert "--input" not in content


def test_write_repro_commands_copies_user_nextflow_configs(tmp_path):
    cfg = tmp_path / "cluster.config"
    cfg.write_text("process.executor = 'slurm'\n", encoding="utf-8")
    args = _make_args(tmp_path, extra_config=[str(cfg)])

    write_repro_commands(tmp_path, args=args, pipeline_source=_pipeline_source())

    copied = (
        tmp_path / "reproducibility" / "nextflow_configs" / "config_01_cluster.config"
    )
    content = (tmp_path / "reproducibility" / "commands.sh").read_text(encoding="utf-8")
    assert copied.exists()
    assert copied.read_text(encoding="utf-8") == cfg.read_text(encoding="utf-8")
    assert "-c reproducibility/nextflow_configs/config_01_cluster.config" in content


# ── write_result ──────────────────────────────────────────────────────────────


def test_write_result_creates_result_json(tmp_path):
    args = _make_args(tmp_path)
    preferred = tmp_path / "preferred.h5ad"
    result_path = write_result(
        tmp_path,
        args=args,
        pipeline_source=_pipeline_source(),
        parsed_outputs=_parsed_outputs(preferred_h5ad=str(preferred)),
        command_str="nextflow run nf-core/scrnaseq",
    )
    assert result_path.exists()
    payload = json.loads(result_path.read_text(encoding="utf-8"))
    assert "summary" in payload
    assert payload["summary"]["preset"] == "star"
    assert payload["summary"]["profile"] == "docker"
    assert payload["summary"]["output_artifacts"]["preferred_h5ad"] == str(preferred)
    assert payload["data"]["output_artifacts"] == payload["summary"]["output_artifacts"]


def test_write_result_exposes_official_output_manifest(tmp_path):
    args = _make_args(tmp_path)
    official_outputs = {
        "pipeline_info": {"present": True, "path": "/out/pipeline_info"},
        "multiqc": {
            "present": True,
            "path": "/out/multiqc",
            "report": "/out/multiqc/multiqc_report.html",
        },
    }

    result_path = write_result(
        tmp_path,
        args=args,
        pipeline_source=_pipeline_source(),
        parsed_outputs={**_parsed_outputs(), "official_outputs": official_outputs},
        command_str="nextflow run nf-core/scrnaseq",
    )

    payload = json.loads(result_path.read_text(encoding="utf-8"))
    assert (
        payload["summary"]["output_artifacts"]["official_outputs"] == official_outputs
    )
    assert payload["data"]["output_artifacts"]["official_outputs"] == official_outputs


# ── write_check_result ────────────────────────────────────────────────────────


def test_write_repro_commands_creates_remap_script(tmp_path):
    args = _make_args(tmp_path)
    write_repro_commands(tmp_path, args=args, pipeline_source=_pipeline_source())
    assert (tmp_path / "reproducibility" / "remap_paths.py").exists()


def test_write_repro_commands_portability_notice_in_commands_sh(tmp_path):
    args = _make_args(tmp_path, demo=False)
    write_repro_commands(tmp_path, args=args, pipeline_source=_pipeline_source())
    content = (tmp_path / "reproducibility" / "commands.sh").read_text(encoding="utf-8")
    assert "remap_paths.py" in content
    assert (
        "portab" in content.lower()
        or "absolute" in content.lower()
        or "FASTQ" in content
    )
