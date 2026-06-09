"""Tests for nfcore-sarek-wrapper / outputs_parser.py."""
from __future__ import annotations

from pathlib import Path

import pytest

from errors import ErrorCode, SkillError
from outputs_parser import OutputsReport, parse_outputs


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _touch(path: Path, content: bytes | str = b"x") -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(content, str):
        path.write_text(content)
    else:
        path.write_bytes(content)
    return path


def _csv(path: Path, samples: list[str]) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = ["patient,sample,cram,crai"]
    for s in samples:
        lines.append(f"P_{s},{s},{s}.cram,{s}.cram.crai")
    path.write_text("\n".join(lines) + "\n")
    return path


def _make_mapped_csv(outdir: Path, samples: list[str]) -> Path:
    # The usage docs and official rendered results tree publish restart CSVs at
    # top-level <outdir>/csv/.
    return _csv(outdir / "csv" / "mapped.csv", samples)


def _make_md_csv(outdir: Path, samples: list[str]) -> Path:
    return _csv(outdir / "csv" / "markduplicates.csv", samples)


def _make_recal_csv(outdir: Path, samples: list[str]) -> Path:
    return _csv(outdir / "csv" / "recalibrated.csv", samples)


def _make_md_cram(outdir: Path, sample: str, as_bam: bool = False) -> tuple[Path, Path]:
    ext = "bam" if as_bam else "cram"
    idx = "bai" if as_bam else "crai"
    cram = _touch(outdir / "preprocessing" / "markduplicates" / sample / f"{sample}.md.{ext}")
    crai = _touch(outdir / "preprocessing" / "markduplicates" / sample / f"{sample}.md.{ext}.{idx}")
    return cram, crai


def _make_recal_cram(outdir: Path, sample: str) -> tuple[Path, Path]:
    cram = _touch(outdir / "preprocessing" / "recalibrated" / sample / f"{sample}.recal.cram")
    crai = _touch(outdir / "preprocessing" / "recalibrated" / sample / f"{sample}.recal.cram.crai")
    return cram, crai


# ---------------------------------------------------------------------------
# Empty/edge cases
# ---------------------------------------------------------------------------


def test_empty_output_dir_no_validate(tmp_path):
    rep = parse_outputs(
        tmp_path,
        step="mapping",
        tools=[],
        analysis_mode="germline",
        aligner="bwa-mem",
        validate=False,
    )
    assert isinstance(rep, OutputsReport)
    assert rep.csv_handoff == {}
    assert rep.handoff_available is False
    assert rep.samples_detected == []
    assert rep.pairs_detected == []
    assert rep.variant_calling == {}
    assert rep.pipeline_info is None



def test_empty_output_dir_validate_with_caller_raises(tmp_path):
    with pytest.raises(SkillError) as exc_info:
        parse_outputs(
            tmp_path,
            step="variant_calling",
            tools=["strelka"],
            analysis_mode="germline",
            aligner="bwa-mem",
            validate=True,
        )
    assert exc_info.value.error_code == ErrorCode.EXPECTED_OUTPUTS_NOT_FOUND
    assert exc_info.value.stage == "outputs"


# ---------------------------------------------------------------------------
# Preprocessing
# ---------------------------------------------------------------------------


def test_mapping_step_detects_csv_and_mapped(tmp_path):
    _make_mapped_csv(tmp_path, ["SAMPLE_A"])
    _make_md_cram(tmp_path, "SAMPLE_A")
    rep = parse_outputs(
        tmp_path,
        step="mapping",
        tools=[],
        analysis_mode="germline",
        aligner="bwa-mem",
    )
    assert "mapped" in rep.csv_handoff
    assert "SAMPLE_A" in rep.preprocessing["markduplicates"]
    assert rep.samples_detected == ["SAMPLE_A"]




def test_recal_table_detection(tmp_path):
    # preprocessing/recal_table/<sample>/<sample>.recal.table
    _touch(tmp_path / "preprocessing" / "recal_table" / "S1" / "S1.recal.table")
    rep = parse_outputs(
        tmp_path,
        step="mapping",
        tools=[],
        analysis_mode="germline",
        aligner="bwa-mem",
    )
    assert rep.preprocessing["recal_table"]["S1"].name == "S1.recal.table"





# ---------------------------------------------------------------------------
# Variant calling
# ---------------------------------------------------------------------------


def test_strelka_germline_single_sample(tmp_path):
    _make_mapped_csv(tmp_path, ["S1"])
    _touch(
        tmp_path / "variant_calling" / "strelka" / "S1" / "S1.strelka.variants.vcf.gz"
    )
    rep = parse_outputs(
        tmp_path,
        step="variant_calling",
        tools=["strelka"],
        analysis_mode="germline",
        aligner="bwa-mem",
    )
    assert "strelka" in rep.variant_calling
    assert "S1" in rep.variant_calling["strelka"]
    assert rep.step_completed == "variant_calling"


def test_mutect2_tumor_normal_pair(tmp_path):
    _make_mapped_csv(tmp_path, ["TUM", "NORM"])
    pair = "TUM_vs_NORM"
    _touch(
        tmp_path / "variant_calling" / "mutect2" / pair / f"{pair}.mutect2.filtered.vcf.gz"
    )
    rep = parse_outputs(
        tmp_path,
        step="variant_calling",
        tools=["mutect2"],
        analysis_mode="somatic_paired",
        aligner="bwa-mem",
    )
    assert "mutect2" in rep.variant_calling
    assert pair in rep.variant_calling["mutect2"]
    assert pair in rep.pairs_detected



def test_manta_germline(tmp_path):
    _touch(
        tmp_path / "variant_calling" / "manta" / "S1" / "S1.manta.diploid_sv.vcf.gz"
    )
    _touch(
        tmp_path / "variant_calling" / "manta" / "S1" / "S1.manta.candidate_small_indels.vcf.gz"
    )
    _touch(
        tmp_path / "variant_calling" / "manta" / "S1" / "S1.manta.candidate_sv.vcf.gz"
    )
    rep = parse_outputs(
        tmp_path,
        step="variant_calling",
        tools=["manta"],
        analysis_mode="germline",
        aligner="bwa-mem",
    )
    entry = rep.variant_calling["manta"]["S1"]
    assert entry["sv_vcf"].name == "S1.manta.diploid_sv.vcf.gz"
    assert "small_indels_vcf" in entry
    assert "candidate_sv_vcf" in entry



def test_ascat_pair_outputs(tmp_path):
    pair = "T1_vs_N1"
    base = tmp_path / "variant_calling" / "ascat" / pair
    _touch(base / "T1_vs_N1.cnvs.txt")
    _touch(base / "T1_vs_N1.purityploidy.txt")
    _touch(base / "T1_vs_N1.segments.txt")
    _touch(base / "T1_vs_N1.plot1.png")
    _touch(base / "T1_vs_N1.plot2.png")
    rep = parse_outputs(
        tmp_path,
        step="variant_calling",
        tools=["ascat"],
        analysis_mode="somatic_paired",
        aligner="bwa-mem",
    )
    entry = rep.variant_calling["ascat"][pair]
    assert "cnvs" in entry
    assert "purity_ploidy" in entry
    assert "segments" in entry
    assert len(entry["plots"]) == 2


def test_cnvkit_outputs(tmp_path):
    sample = "S1"
    base = tmp_path / "variant_calling" / "cnvkit" / sample
    _touch(base / f"{sample}.cnr")
    _touch(base / f"{sample}.cns")
    _touch(base / f"{sample}.call.cns")
    _touch(base / f"{sample}.bintest.cns")
    rep = parse_outputs(
        tmp_path,
        step="variant_calling",
        tools=["cnvkit"],
        analysis_mode="germline",
        aligner="bwa-mem",
    )
    entry = rep.variant_calling["cnvkit"][sample]
    for key in ("cnr", "cns", "call_cns", "bintest_cns"):
        assert key in entry



def test_lofreq_vcf_without_tool_suffix(tmp_path):
    # LoFreq publishes variant_calling/lofreq/<sample>/<tumorsample>.vcf.gz
    # with NO ".lofreq." infix — the parser must still detect it.
    sample = "TUMOR1"
    base = tmp_path / "variant_calling" / "lofreq" / sample
    _touch(base / f"{sample}.vcf.gz")
    rep = parse_outputs(
        tmp_path,
        step="variant_calling",
        tools=["lofreq"],
        analysis_mode="tumor_only",
        aligner="bwa-mem",
    )
    entry = rep.variant_calling["lofreq"][sample]
    assert entry["vcf"].name == f"{sample}.vcf.gz"


def test_haplotypecaller_filtered(tmp_path):
    sample = "H1"
    _touch(
        tmp_path / "variant_calling" / "haplotypecaller" / sample / f"{sample}.haplotypecaller.vcf.gz"
    )
    _touch(
        tmp_path / "variant_calling" / "haplotypecaller" / sample / f"{sample}.haplotypecaller.filtered.vcf.gz"
    )
    rep = parse_outputs(
        tmp_path,
        step="variant_calling",
        tools=["haplotypecaller"],
        analysis_mode="germline",
        aligner="bwa-mem",
    )
    entry = rep.variant_calling["haplotypecaller"][sample]
    assert "vcf" in entry
    assert "filtered_vcf" in entry




def test_deepvariant_gvcf_is_cataloged(tmp_path):
    _touch(
        tmp_path / "variant_calling" / "deepvariant" / "S1" / "S1.deepvariant.g.vcf.gz"
    )
    rep = parse_outputs(
        tmp_path,
        step="variant_calling",
        tools=["deepvariant"],
        analysis_mode="germline",
        aligner="bwa-mem",
    )
    assert rep.variant_calling["deepvariant"]["S1"]["gvcf"].name == "S1.deepvariant.g.vcf.gz"


def test_joint_variant_calling_dirs_are_cataloged(tmp_path):
    _touch(
        tmp_path
        / "variant_calling"
        / "haplotypecaller"
        / "joint_variant_calling"
        / "joint_germline.vcf.gz"
    )
    rep = parse_outputs(
        tmp_path,
        step="variant_calling",
        tools=["haplotypecaller"],
        analysis_mode="germline",
        aligner="bwa-mem",
    )
    assert "joint_haplotypecaller" in rep.variant_calling
    assert "joint_germline" in rep.variant_calling["joint_haplotypecaller"]



def test_msisensor2_extensionless_outputs_are_cataloged(tmp_path):
    _touch(tmp_path / "variant_calling" / "msisensor2" / "T1" / "T1")
    _touch(tmp_path / "variant_calling" / "msisensor2" / "T1" / "T1_dis")
    _touch(tmp_path / "variant_calling" / "msisensor2" / "T1" / "T1_somatic")
    rep = parse_outputs(
        tmp_path,
        step="variant_calling",
        tools=["msisensor2"],
        analysis_mode="tumor_only",
        aligner="bwa-mem",
        validate=False,
    )
    entry = rep.variant_calling["msisensor2"]["T1"]
    assert entry["score"].name == "T1"
    assert entry["distribution"].name == "T1_dis"
    assert entry["somatic_sites"].name == "T1_somatic"


def test_post_variant_outputs_are_cataloged(tmp_path):
    _touch(tmp_path / "variant_calling" / "filtered" / "S1" / "S1.filtered.vcf.gz")
    _touch(tmp_path / "variant_calling" / "normalized" / "S1" / "S1.normalized.vcf.gz")
    _touch(tmp_path / "variant_calling" / "consensus" / "S1" / "S1.consensus.vcf.gz")
    _touch(tmp_path / "variant_calling" / "concat" / "S1" / "S1.concat.vcf.gz")
    rep = parse_outputs(
        tmp_path,
        step="variant_calling",
        tools=[],
        analysis_mode="germline",
        aligner="bwa-mem",
    )
    assert {"filtered", "normalized", "consensus", "concat"} <= set(rep.variant_calling)


def test_manta_tumor_only_vcf_is_cataloged(tmp_path):
    sample = "T1"
    _touch(
        tmp_path / "variant_calling" / "manta" / sample / f"{sample}.manta.tumor_sv.vcf.gz"
    )
    rep = parse_outputs(
        tmp_path,
        step="variant_calling",
        tools=["manta"],
        analysis_mode="tumor_only",
        aligner="bwa-mem",
    )
    assert rep.variant_calling["manta"][sample]["tumor_sv_vcf"].name.endswith("tumor_sv.vcf.gz")


def test_tiddit_paired_outputs_are_cataloged(tmp_path):
    pair = "T_vs_N"
    base = tmp_path / "variant_calling" / "tiddit" / pair
    _touch(base / f"{pair}.tiddit.normal.vcf.gz")
    _touch(base / f"{pair}.tiddit.tumor.vcf.gz")
    _touch(base / f"{pair}_sv_merge.tiddit.vcf.gz")
    rep = parse_outputs(
        tmp_path,
        step="variant_calling",
        tools=["tiddit"],
        analysis_mode="somatic_paired",
        aligner="bwa-mem",
    )
    entry = rep.variant_calling["tiddit"][pair]
    assert "normal_vcf" in entry
    assert "tumor_vcf" in entry
    assert "merged_vcf" in entry


def test_muse_pair(tmp_path):
    pair = "T_vs_N"
    _touch(
        tmp_path / "variant_calling" / "muse" / pair / f"{pair}.muse.vcf.gz"
    )
    rep = parse_outputs(
        tmp_path,
        step="variant_calling",
        tools=["muse"],
        analysis_mode="somatic_paired",
        aligner="bwa-mem",
    )
    assert pair in rep.variant_calling["muse"]
    assert pair in rep.pairs_detected


# ---------------------------------------------------------------------------
# Annotation
# ---------------------------------------------------------------------------


def test_annotation_snpeff_and_vep(tmp_path):
    base = tmp_path / "annotation" / "S1"
    _touch(base / "S1.haplotypecaller_snpEff.ann.vcf.gz")
    _touch(base / "S1.haplotypecaller_snpEff.ann.vcf.gz.tbi")
    _touch(base / "S1.haplotypecaller_snpEff.ann.summary.html")
    _touch(base / "S1.haplotypecaller_VEP.ann.vcf.gz")
    _touch(base / "S1.haplotypecaller_VEP.ann.vcf.gz.tbi")
    _touch(base / "S1.haplotypecaller_VEP.summary.html")
    rep = parse_outputs(
        tmp_path,
        step="annotate",
        tools=["snpeff", "vep"],
        analysis_mode="germline",
        aligner="bwa-mem",
    )
    key = "S1.haplotypecaller"
    assert key in rep.annotation["snpeff"]
    assert key in rep.annotation["vep"]
    assert rep.annotation["snpeff"][key]["html"] is not None
    assert rep.annotation["vep"][key]["html"] is not None
    assert rep.annotation["snpeff"][key]["tbi"] is not None
    assert rep.step_completed == "annotate"


def test_annotation_merge_and_bcf(tmp_path):
    # Official suffixes (conf/modules/annotate.config): merge -> _snpEff_VEP, bcfann -> _BCF.
    base = tmp_path / "annotation" / "S1"
    _touch(base / "S1.haplotypecaller_snpEff_VEP.ann.vcf.gz")
    _touch(base / "S1.haplotypecaller_BCF.ann.vcf.gz")
    rep = parse_outputs(
        tmp_path,
        step="annotate",
        tools=[],
        analysis_mode="germline",
        aligner="bwa-mem",
        validate=False,
    )
    key = "S1.haplotypecaller"
    assert key in rep.annotation["merge"]
    assert key in rep.annotation["bcfann"]


def test_annotation_merge_not_misdetected_as_vep(tmp_path):
    # A merge output (`_snpEff_VEP`) must not be classified as plain VEP (`_VEP`).
    base = tmp_path / "annotation" / "S1"
    _touch(base / "S1.haplotypecaller_snpEff_VEP.ann.vcf.gz")
    rep = parse_outputs(
        tmp_path, step="annotate", tools=[], analysis_mode="germline",
        aligner="bwa-mem", validate=False,
    )
    assert "S1.haplotypecaller" in rep.annotation["merge"]
    assert "S1.haplotypecaller" not in rep.annotation["vep"]


def test_annotation_nested_variantcaller_layout(tmp_path):
    # Sarek 3.8.1 publishes annotation/<variantcaller>/<sample_or_pair>/...ann.vcf.gz
    # (two levels deep). The parser must recurse to find these.
    base = tmp_path / "annotation" / "haplotypecaller" / "S1"
    _touch(base / "S1.haplotypecaller_VEP.ann.vcf.gz")
    _touch(base / "S1.haplotypecaller_snpEff.ann.vcf.gz")
    rep = parse_outputs(
        tmp_path, step="annotate", tools=[], analysis_mode="germline",
        aligner="bwa-mem", validate=False,
    )
    assert "S1.haplotypecaller" in rep.annotation["vep"]
    assert "S1.haplotypecaller" in rep.annotation["snpeff"]


def test_annotation_snpeff_summary_html_default_name(tmp_path):
    # Real sarek 3.8.1 layout: the snpEff module runs `-csvStats <prefix>.csv`
    # but passes no `-stats <prefix>`, so snpEff emits its stats HTML under the
    # DEFAULT constant name `snpEff_summary.html` (in reports/snpeff/<caller>/
    # <sample>/), not a `<stem>_snpEff.html`. The parser must still link it.
    ann = tmp_path / "annotation" / "strelka" / "test"
    _touch(ann / "test.strelka.variants_snpEff.ann.vcf.gz")
    _touch(ann / "test.strelka.variants_snpEff.ann.vcf.gz.tbi")
    reports = tmp_path / "reports" / "snpeff" / "strelka" / "test"
    _touch(reports / "snpEff_summary.html")
    _touch(reports / "test.strelka.variants_snpEff.csv")
    _touch(reports / "test.strelka.variants_snpEff.genes.txt")
    rep = parse_outputs(
        tmp_path, step="annotate", tools=["snpeff"], analysis_mode="germline",
        aligner="bwa-mem", validate=False,
    )
    key = "test.strelka.variants"
    assert key in rep.annotation["snpeff"]
    html = rep.annotation["snpeff"][key]["html"]
    assert html is not None, "snpEff_summary.html should be linked"
    assert Path(html).name == "snpEff_summary.html"


def test_annotation_snpeff_summary_html_scoped_per_sample(tmp_path):
    # Two samples each get their own snpEff_summary.html in their own report dir;
    # the constant name must not leak across samples (dir scoping must hold).
    for sample in ("test", "test2"):
        ann = tmp_path / "annotation" / "strelka" / sample
        _touch(ann / f"{sample}.strelka.variants_snpEff.ann.vcf.gz")
        reports = tmp_path / "reports" / "snpeff" / "strelka" / sample
        _touch(reports / "snpEff_summary.html")
    rep = parse_outputs(
        tmp_path, step="annotate", tools=["snpeff"], analysis_mode="germline",
        aligner="bwa-mem", validate=False,
    )
    for sample in ("test", "test2"):
        html = rep.annotation["snpeff"][f"{sample}.strelka.variants"]["html"]
        assert html is not None
        assert Path(html).parent.name == sample


def test_annotation_vep_json_output_detected(tmp_path):
    # With --vep_out_format json the annotated output is <stem>_VEP.ann.json.gz.
    base = tmp_path / "annotation" / "haplotypecaller" / "S1"
    _touch(base / "S1.haplotypecaller_VEP.ann.json.gz")
    rep = parse_outputs(
        tmp_path, step="annotate", tools=[], analysis_mode="germline",
        aligner="bwa-mem", validate=False,
    )
    assert "S1.haplotypecaller" in rep.annotation["vep"]
    assert rep.annotation["vep"]["S1.haplotypecaller"]["json"].name.endswith(".ann.json.gz")
    assert "vcf" not in rep.annotation["vep"]["S1.haplotypecaller"]


def test_annotation_vep_tab_output_detected(tmp_path):
    # With --vep_out_format tab the annotated output is <stem>_VEP.ann.tab.gz.
    base = tmp_path / "annotation" / "haplotypecaller" / "S1"
    _touch(base / "S1.haplotypecaller_VEP.ann.tab.gz")
    rep = parse_outputs(
        tmp_path, step="annotate", tools=["vep"], analysis_mode="germline",
        aligner="bwa-mem", validate=True,
    )
    assert rep.annotation["vep"]["S1.haplotypecaller"]["tab"].name.endswith(".ann.tab.gz")
    assert "vcf" not in rep.annotation["vep"]["S1.haplotypecaller"]


def test_annotation_snpsift_detected(tmp_path):
    # SnpSift output (`_snpSift.ann`) must be parsed and validated.
    base = tmp_path / "annotation" / "mutect2" / "T1_vs_N1"
    _touch(base / "T1_vs_N1.mutect2_snpSift.ann.vcf.gz")
    rep = parse_outputs(
        tmp_path, step="annotate", tools=["snpsift"], analysis_mode="somatic",
        aligner="bwa-mem", validate=True,
    )
    assert "T1_vs_N1.mutect2" in rep.annotation["snpsift"]


def test_annotate_validate_raises_when_missing(tmp_path):
    with pytest.raises(SkillError) as exc_info:
        parse_outputs(
            tmp_path,
            step="annotate",
            tools=["snpeff"],
            analysis_mode="germline",
            aligner="bwa-mem",
            validate=True,
        )
    assert exc_info.value.error_code == ErrorCode.EXPECTED_OUTPUTS_NOT_FOUND


# ---------------------------------------------------------------------------
# QC
# ---------------------------------------------------------------------------


def test_qc_multiqc_report_detected(tmp_path):
    # Official layout: MultiQC at outdir/multiqc/, NOT outdir/reports/multiqc/.
    _touch(tmp_path / "multiqc" / "multiqc_report.html")
    rep = parse_outputs(
        tmp_path,
        step="mapping",
        tools=[],
        analysis_mode="germline",
        aligner="bwa-mem",
    )
    assert rep.qc["multiqc_report"] is not None



def test_qc_snpeff_and_vep_directories(tmp_path):
    # Official 3.8.1 layout: reports/snpeff/<variantcaller>/<sample>/ (lowercase)
    # and reports/EnsemblVEP/<variantcaller>/<sample>/ (mixed case).
    _touch(tmp_path / "reports" / "snpeff" / "haplotypecaller" / "S1" / "S1.snpEff.csv")
    _touch(tmp_path / "reports" / "EnsemblVEP" / "haplotypecaller" / "S1" / "summary.html")
    rep = parse_outputs(
        tmp_path,
        step="annotate",
        tools=[],
        analysis_mode="germline",
        aligner="bwa-mem",
        validate=False,
    )
    assert len(rep.qc["snpeff_reports"]) == 1
    assert len(rep.qc["vep_reports"]) == 1


# ---------------------------------------------------------------------------
# Pipeline info / reference
# ---------------------------------------------------------------------------



def test_pipeline_info_present(tmp_path):
    (tmp_path / "pipeline_info").mkdir()
    _touch(tmp_path / "pipeline_info" / "execution_report.html")
    rep = parse_outputs(
        tmp_path,
        step="mapping",
        tools=[],
        analysis_mode="germline",
        aligner="bwa-mem",
    )
    assert rep.pipeline_info is not None
    assert rep.pipeline_info.is_dir()


def test_save_reference_enumerates_reference(tmp_path):
    _touch(tmp_path / "reference" / "bwa" / "genome.fa.bwt")
    _touch(tmp_path / "reference" / "fai" / "genome.fa.fai")
    rep = parse_outputs(
        tmp_path,
        step="mapping",
        tools=[],
        analysis_mode="germline",
        aligner="bwa-mem",
        save_reference=True,
    )
    assert rep.reference_outputs is not None
    assert "bwa" in rep.reference_outputs
    assert "fai" in rep.reference_outputs


# ---------------------------------------------------------------------------
# Misc behaviours
# ---------------------------------------------------------------------------


def test_zero_byte_file_skipped_with_warning(tmp_path):
    _make_mapped_csv(tmp_path, ["Z1"])
    # Zero-byte cram should be skipped.
    md_dir = tmp_path / "preprocessing" / "markduplicates" / "Z1"
    md_dir.mkdir(parents=True)
    (md_dir / "Z1.md.cram").write_bytes(b"")
    (md_dir / "Z1.md.cram.crai").write_bytes(b"")
    rep = parse_outputs(
        tmp_path,
        step="markduplicates",
        tools=[],
        analysis_mode="germline",
        aligner="bwa-mem",
    )
    assert "Z1" not in rep.preprocessing["markduplicates"]
    assert any("Zero-byte" in w for w in rep.warnings)


def test_multi_sample_multi_tool(tmp_path):
    _make_mapped_csv(tmp_path, ["S1", "S2"])
    pair = "S1_vs_S2"
    _touch(
        tmp_path / "variant_calling" / "strelka" / "S1" / "S1.strelka.variants.vcf.gz"
    )
    _touch(
        tmp_path / "variant_calling" / "strelka" / "S2" / "S2.strelka.variants.vcf.gz"
    )
    _touch(
        tmp_path / "variant_calling" / "mutect2" / pair / f"{pair}.mutect2.filtered.vcf.gz"
    )
    rep = parse_outputs(
        tmp_path,
        step="variant_calling",
        tools=["strelka", "mutect2"],
        analysis_mode="somatic_paired",
        aligner="bwa-mem",
    )
    assert sorted(rep.samples_detected) == ["S1", "S2"]
    assert pair in rep.pairs_detected
    assert "strelka" in rep.variant_calling
    assert "mutect2" in rep.variant_calling





def test_step_completed_inference_variant_calling(tmp_path):
    _make_recal_csv(tmp_path, ["S1"])
    _touch(
        tmp_path / "variant_calling" / "strelka" / "S1" / "S1.strelka.variants.vcf.gz"
    )
    rep = parse_outputs(
        tmp_path,
        step="mapping",
        tools=["strelka"],
        analysis_mode="germline",
        aligner="bwa-mem",
        validate=False,
    )
    assert rep.step_completed == "variant_calling"




def test_immutable_dataclass(tmp_path):
    rep = parse_outputs(
        tmp_path,
        step="mapping",
        tools=[],
        analysis_mode="germline",
        aligner="bwa-mem",
        validate=False,
    )
    with pytest.raises(Exception):
        rep.step_completed = "different"  # type: ignore[misc]


# ---------------------------------------------------------------------------
# Audit-driven regression tests (vs nf-core/sarek 3.8.1 official docs)
# ---------------------------------------------------------------------------


def test_csv_handoff_prefers_official_top_level_csv_dir(tmp_path):
    official = tmp_path / "csv" / "mapped.csv"
    official.parent.mkdir(parents=True)
    official.write_text("patient,sample,lane,fastq_1\nP1,REAL,1,x.fq.gz\n")
    legacy = tmp_path / "preprocessing" / "csv" / "mapped.csv"
    legacy.parent.mkdir(parents=True)
    legacy.write_text("patient,sample,lane,fastq_1\nP_ghost,GHOST,1,x.fq.gz\n")
    rep = parse_outputs(
        tmp_path,
        step="mapping",
        tools=[],
        analysis_mode="germline",
        aligner="bwa-mem",
        validate=False,
    )
    assert rep.csv_handoff["mapped"] == official
    assert "REAL" in rep.samples_detected
    assert "GHOST" not in rep.samples_detected



def test_mutect2_parser_collects_auxiliary_tables(tmp_path):
    # Mutect2 publishes unfiltered + filtered VCFs plus contamination,
    # segmentation, pileups tables and the artifact-prior archive.
    pair = "T1_vs_N1"
    sub = tmp_path / "variant_calling" / "mutect2" / pair
    sub.mkdir(parents=True)
    files = {
        f"{pair}.mutect2.vcf.gz": b"unfiltered",
        f"{pair}.mutect2.filtered.vcf.gz": b"filtered",
        f"{pair}.mutect2.contamination.table": b"contam",
        f"{pair}.mutect2.segmentation.table": b"seg",
        f"{pair}.mutect2.artifactprior.tar.gz": b"prior",
        f"{pair}.mutect2.pileups.table": b"pileups",
    }
    for fname, payload in files.items():
        (sub / fname).write_bytes(payload)
    rep = parse_outputs(
        tmp_path,
        step="variant_calling",
        tools=["mutect2"],
        analysis_mode="somatic_paired",
        aligner="bwa-mem",
        validate=True,
    )
    entry = rep.variant_calling["mutect2"][pair]
    assert {"vcf", "filtered_vcf", "contamination_table",
            "segmentation_table", "artifact_prior", "pileups_table"} <= set(entry)


def test_ascat_captures_auxiliary_text_outputs(tmp_path):
    # Audit M4: ASCAT publishes metrics.txt + tumourBAF / tumourLogR raw traces
    # alongside cnvs / purityploidy / segments txt + plots.
    pair = "T_vs_N"
    sub = tmp_path / "variant_calling" / "ascat" / pair
    sub.mkdir(parents=True)
    name = f"{pair}.tumour"
    for fname, payload in {
        f"{name}.cnvs.txt": "chr start end cn\n",
        f"{name}.purityploidy.txt": "purity\t0.5\n",
        f"{name}.segments.txt": "seg\n",
        f"{name}.metrics.txt": "GoF=0.95\n",
        f"{name}_tumourBAF.txt": "baf\n",
        f"{name}_tumourLogR.txt": "logr\n",
        f"{name}.ASCATprofile.png": "PNGDATA",
        f"{name}.ASPCF.png": "PNGDATA",
    }.items():
        (sub / fname).write_text(payload)
    rep = parse_outputs(
        tmp_path,
        step="variant_calling",
        tools=["ascat"],
        analysis_mode="somatic_paired",
        aligner="bwa-mem",
        validate=True,
    )
    entry = rep.variant_calling["ascat"][pair]
    assert {"cnvs", "purity_ploidy", "segments", "metrics",
            "tumour_baf", "tumour_logr", "plots"} <= set(entry)
    assert len(entry["plots"]) == 2  # type: ignore[arg-type]


def test_msisensorpro_outputs_found_under_msisensor_dir(tmp_path):
    # Sarek publishes MSIsensor-pro under variant_calling/msisensor/, but the
    # canonical tool token is `msisensorpro`. The report key MUST stay msisensorpro.
    # MSIsensor-pro file naming per official docs: <sample> (score), <sample>_dis,
    # <sample>_germline, <sample>_somatic.
    pair = "T_vs_N"
    sub = tmp_path / "variant_calling" / "msisensor" / pair
    sub.mkdir(parents=True)
    (sub / pair).write_text("Total_Number_of_Sites\nMSI-H 42\n")
    (sub / f"{pair}_dis").write_text("dist data\n")
    rep = parse_outputs(
        tmp_path,
        step="variant_calling",
        tools=["msisensorpro"],
        analysis_mode="somatic_paired",
        aligner="bwa-mem",
        validate=True,
    )
    assert "msisensorpro" in rep.variant_calling
    assert pair in rep.variant_calling["msisensorpro"]
