from __future__ import annotations

import re
import sys
from pathlib import Path

_SKILL_DIR = Path(__file__).resolve().parent
if str(_SKILL_DIR) not in sys.path:
    sys.path.insert(0, str(_SKILL_DIR))

from errors import ErrorCode, SkillError
from nfcore_4_1_0_contract import (
    ALIGNER_OUTPUT_DIRS,
    COMMON_REQUIRED_OUTPUTS,
    FASTQC_GATED_ALIGNERS,
    MULTIQC_REQUIRED_OUTPUT,
)


def _first_match(root: Path, pattern: str) -> str:
    matches = sorted(root.glob(pattern))
    return str(matches[0]) if matches else ""


def parse_outputs(output_dir: Path) -> dict[str, object]:
    upstream_dir = _require_upstream_results_dir(output_dir)
    h5ad_candidates = find_h5ad_candidates(upstream_dir)
    rds_candidates = find_rds_outputs(upstream_dir)
    preferred_h5ad = select_preferred_h5ad(h5ad_candidates)

    return {
        "upstream_dir": str(upstream_dir),
        "top_level_entries": list_top_level_entries(upstream_dir),
        "multiqc_report": find_multiqc_report(upstream_dir),
        "pipeline_info_dir": find_pipeline_info_dir(upstream_dir),
        "official_outputs": build_official_outputs_manifest(upstream_dir),
        "h5ad_candidates": h5ad_candidates,
        "rds_candidates": rds_candidates,
        "preferred_h5ad": preferred_h5ad,
        "preferred_h5ad_selection_log": build_selection_log(
            h5ad_candidates, preferred_h5ad
        ),
        "handoff_available": bool(preferred_h5ad),
        "samples_detected": detect_sample_names(h5ad_candidates),
        "cellbender_used": detect_cellbender_outputs(h5ad_candidates),
    }


def build_selection_log(h5ad_candidates: list[str], preferred_h5ad: str) -> str:
    if not h5ad_candidates:
        return "No h5ad output files found."
    if not preferred_h5ad:
        return (
            f"No canonical h5ad selected — {len(h5ad_candidates)} candidate(s) found "
            "but selection is ambiguous. Inspect h5ad_candidates in result.json."
        )
    name = Path(preferred_h5ad).name
    all_names = [Path(c).name for c in h5ad_candidates]
    return f"Selected '{name}' from {len(h5ad_candidates)} candidate(s). All candidates: {all_names}."


def _require_upstream_results_dir(output_dir: Path) -> Path:
    upstream_dir = output_dir / "upstream" / "results"
    if upstream_dir.exists():
        return upstream_dir
    raise SkillError(
        stage="parsing",
        error_code=ErrorCode.EXPECTED_OUTPUTS_NOT_FOUND,
        message="Pipeline output directory was not created.",
        fix="Re-run the wrapper after checking the Nextflow logs.",
        details={"expected_dir": str(upstream_dir)},
    )


def find_h5ad_candidates(upstream_dir: Path) -> list[str]:
    # Canonical location per nf-core/scrnaseq 4.1.0 conf/modules.config: the
    # concatenated matrix is published directly to ``<aligner>/mtx_conversions/``
    # while per-sample matrices are nested one level deeper under
    # ``<aligner>/mtx_conversions/<sample>/`` (the MTX_TO_H5AD/CONCAT_H5AD/
    # ANNDATA_BARCODES ``saveAs`` rewrites non-``combined_`` files to
    # ``${meta.id}/${filename}``). Scan BOTH depths so per-sample matrices are not
    # dropped from the inventory, samples_detected, or the checksum manifest
    # (audit F-1) — while still restricting to ``mtx_conversions`` so stray/
    # intermediate .h5ad elsewhere in the tree (e.g. CellBender working copies
    # under ``<sample>/cellbender_removebackground/``) cannot pollute the
    # candidates (audit H-1). Fall back to a full-tree scan only when no
    # mtx_conversions matrices exist, so unusual layouts are still detected.
    canonical = sorted(
        {
            str(path)
            for pattern in ("*/mtx_conversions/*.h5ad", "*/mtx_conversions/*/*.h5ad")
            for path in upstream_dir.glob(pattern)
        }
    )
    if canonical:
        return canonical
    return sorted(str(path) for path in upstream_dir.rglob("*.h5ad"))


def find_rds_outputs(upstream_dir: Path) -> list[str]:
    return sorted(str(path) for path in upstream_dir.rglob("*.rds"))


def list_top_level_entries(upstream_dir: Path) -> list[str]:
    return sorted(path.name for path in upstream_dir.iterdir())


def find_multiqc_report(upstream_dir: Path) -> str:
    return _first_match(upstream_dir, "multiqc/**/multiqc_report.html") or _first_match(
        upstream_dir, "**/multiqc_report.html"
    )


def find_fastqc_reports(upstream_dir: Path) -> dict[str, list[str]]:
    fastqc_dir = upstream_dir / "fastqc"
    return {
        "html_reports": _manifest_glob(fastqc_dir, "**/*.html"),
        "zip_reports": _manifest_glob(fastqc_dir, "**/*.zip"),
    }


def find_pipeline_info_dir(upstream_dir: Path) -> str:
    pipeline_info_dir = upstream_dir / "pipeline_info"
    return str(pipeline_info_dir) if pipeline_info_dir.exists() else ""


def build_official_outputs_manifest(upstream_dir: Path) -> dict[str, object]:
    """Summarize the documented nf-core/scrnaseq output families.

    This is intentionally descriptive, not prescriptive: required-output
    validation stays in validate_expected_outputs(), while the manifest exposes
    official directories so users can inspect optional artifacts without knowing
    the nf-core tree by heart.
    """
    mtx_dirs = sorted(
        str(path) for path in upstream_dir.glob("*/mtx_conversions") if path.is_dir()
    )
    fastqc_reports = find_fastqc_reports(upstream_dir)
    return {
        "documented_families": [
            "fastqc",
            "reference_genome",
            "simpleaf",
            "star",
            "kallisto",
            "cellranger",
            "cellrangerarc",
            "cellrangermulti",
            "cellbender_removebackground",
            "multiqc",
            "pipeline_info",
            "mtx_conversions",
        ],
        "required_contract": [
            "pipeline_info",
            "effective_aligner_output_dir",
            "multiqc_report_unless_skip_multiqc",
            "h5ad_matrix",
            "fastqc_unless_skip_fastqc",
        ],
        "optional_contract": [
            "reference_genome_when_save_reference",
            "cellbender_removebackground_when_enabled",
            "rds_conversions",
        ],
        "pipeline_info": _manifest_entry(upstream_dir / "pipeline_info"),
        "multiqc": {
            **_manifest_entry(upstream_dir / "multiqc"),
            "report": find_multiqc_report(upstream_dir),
        },
        "fastqc": {
            **_manifest_entry(upstream_dir / "fastqc"),
            **fastqc_reports,
        },
        "reference_genome": _manifest_entry(upstream_dir / "reference_genome"),
        "aligner_outputs": {
            aligner: _manifest_entry(upstream_dir / output_dir)
            for aligner, output_dir in ALIGNER_OUTPUT_DIRS.items()
        },
        "cellbender_removebackground": _manifest_glob(
            upstream_dir, "*/**/cellbender_removebackground"
        ),
        "mtx_conversions": mtx_dirs,
    }


def _manifest_entry(path: Path) -> dict[str, object]:
    return {"present": path.exists(), "path": str(path) if path.exists() else ""}


def _manifest_glob(root: Path, pattern: str) -> list[str]:
    if not root.exists():
        return []
    return sorted(str(path) for path in root.glob(pattern))


def select_preferred_h5ad(h5ad_candidates: list[str]) -> str:
    """Pick the single canonical .h5ad to hand downstream, or "" if ambiguous.

    nf-core/scrnaseq names matrices `*_{raw,filtered,cellbender_filter}_matrix.h5ad`
    and writes a concatenated `combined_matrix.h5ad` (no filter token). The
    concatenated ("combined_*") file is canonical, so it always wins over
    per-sample files. Within a group we prefer the most-processed filter level
    (cellbender_filter > filtered > plain > raw). A tie at the best level — e.g.
    the same filter produced by two aligners, or two distinct samples — is
    genuinely ambiguous and must not be guessed.
    """
    if not h5ad_candidates:
        return ""
    combined = [c for c in h5ad_candidates if Path(c).name.startswith("combined_")]
    if combined:
        return _best_by_filter_rank(combined)
    if len(h5ad_candidates) == 1:
        return h5ad_candidates[0]
    # Multiple per-sample files: unambiguous only if they all belong to one sample.
    samples = {
        name for name in (_sample_name_from_h5ad(c) for c in h5ad_candidates) if name
    }
    if len(samples) == 1:
        return _best_by_filter_rank(h5ad_candidates)
    return ""


# Documented filter suffixes, best→worst for downstream handoff.
_FILTER_RANK_CELLBENDER = 0
_FILTER_RANK_FILTERED = 1
_FILTER_RANK_PLAIN = 2
_FILTER_RANK_RAW = 3

# nf-core/scrnaseq matrices are named ``<prefix>_<token>_matrix.h5ad`` where the
# filter token is one of cellbender_filter / filtered / raw, or absent for the
# plain ``<prefix>_matrix.h5ad``. The token is matched on the *suffix* only — a
# substring scan of the whole filename would misrank a sample whose name happens
# to contain "raw"/"filtered"/"cellbender" (audit H-2).
_FILTER_TOKEN_RE = re.compile(
    r"_(?P<token>cellbender_filter|filtered|raw)_matrix\.h5ad$", re.IGNORECASE
)
_FILTER_RANK_BY_TOKEN = {
    "cellbender_filter": _FILTER_RANK_CELLBENDER,
    "filtered": _FILTER_RANK_FILTERED,
    "raw": _FILTER_RANK_RAW,
}


def _filter_rank(name: str) -> int:
    match = _FILTER_TOKEN_RE.search(name)
    if not match:
        return _FILTER_RANK_PLAIN
    return _FILTER_RANK_BY_TOKEN[match.group("token").lower()]


def _best_by_filter_rank(candidates: list[str]) -> str:
    ranked = sorted(
        candidates, key=lambda c: (_filter_rank(Path(c).name), Path(c).name)
    )
    best_rank = _filter_rank(Path(ranked[0]).name)
    best = [c for c in ranked if _filter_rank(Path(c).name) == best_rank]
    return best[0] if len(best) == 1 else ""


def detect_sample_names(h5ad_candidates: list[str]) -> list[str]:
    return sorted(
        {
            _sample_name_from_h5ad(candidate)
            for candidate in h5ad_candidates
            if _sample_name_from_h5ad(candidate)
        }
    )


# Strip the documented matrix suffix (with or without a filter token) to recover
# the sample prefix. Anchored to the end so a sample name containing a token is
# preserved intact (audit H-2).
_SAMPLE_SUFFIX_RE = re.compile(
    r"_(?:cellbender_filter|filtered|raw)_matrix\.h5ad$|_matrix\.h5ad$",
    re.IGNORECASE,
)


def _sample_name_from_h5ad(candidate: str) -> str:
    name = Path(candidate).name
    sample_name = _SAMPLE_SUFFIX_RE.sub("", name)
    # No suffix stripped → not a recognised matrix filename; "combined" is the
    # concatenated all-sample matrix, not a per-sample name.
    if sample_name == name or sample_name == "combined" or not sample_name:
        return ""
    return sample_name


def detect_cellbender_outputs(h5ad_candidates: list[str]) -> bool:
    # Drive the flag off the canonical cellbender_filter matrix suffix (same source
    # of truth as _filter_rank), not a substring scan of the path: a sample whose
    # name contains "cellbender" must not be mistaken for a CellBender run (audit H-7).
    return any(
        _filter_rank(Path(path).name) == _FILTER_RANK_CELLBENDER
        for path in h5ad_candidates
    )


def _check_documented_core_files(
    parsed_outputs: dict[str, object],
    *,
    skip_multiqc: bool,
    missing_required: list[str],
) -> None:
    """Validate the documented core files inside pipeline_info/ and multiqc/.

    The 4.1.0 output docs guarantee a software-versions YAML and a params JSON in
    ``pipeline_info/`` and a ``multiqc_data/`` directory alongside the MultiQC
    report. Checking only the directories lets a partially-written/corrupt run pass
    as success, so the core files are validated too (audit finding #6). Checks are
    guarded by real on-disk existence of the parent directory, so unit-style parsed
    dicts with synthetic paths are unaffected; tolerant globs absorb the timestamp
    suffixes nf-core adds to params_*.json.
    """
    pipeline_info_dir = parsed_outputs.get("pipeline_info_dir")
    if isinstance(pipeline_info_dir, str) and pipeline_info_dir:
        pinfo = Path(pipeline_info_dir)
        if pinfo.is_dir():
            # 4.1.0 writes ``software_versions.yml``; tolerate the broader
            # ``*software*versions*.yml`` (some nf-core versions emit
            # ``nf_core_pipeline_software_mqc_versions.yml``) to avoid a false failure.
            if not list(pinfo.glob("*software*versions*.yml")) and not list(
                pinfo.glob("*software*versions*.yaml")
            ):
                missing_required.append("pipeline_info/software_versions.yml")
            if not list(pinfo.glob("params*.json")):
                missing_required.append("pipeline_info/params.json")

    if skip_multiqc:
        return
    multiqc_report = parsed_outputs.get("multiqc_report")
    if isinstance(multiqc_report, str) and multiqc_report:
        multiqc_dir = Path(multiqc_report).parent
        if multiqc_dir.is_dir() and not (multiqc_dir / "multiqc_data").is_dir():
            missing_required.append("multiqc/multiqc_data")


def validate_expected_outputs(
    parsed_outputs: dict[str, object],
    *,
    aligner: str,
    skip_multiqc: bool,
    skip_fastqc: bool = False,
) -> dict[str, list[str]]:
    missing_required: list[str] = []
    missing_optional: list[str] = []
    top_level_entries = _top_level_entries(parsed_outputs)

    for required_output in COMMON_REQUIRED_OUTPUTS:
        if required_output == "pipeline_info":
            present = (
                bool(parsed_outputs.get("pipeline_info_dir"))
                or required_output in top_level_entries
            )
        else:
            present = required_output in top_level_entries
        if not present:
            missing_required.append(required_output)

    aligner_output_dir = ALIGNER_OUTPUT_DIRS.get(aligner, aligner)
    if aligner_output_dir not in top_level_entries:
        missing_required.append(aligner_output_dir)

    if not skip_multiqc and not parsed_outputs.get("multiqc_report"):
        missing_required.append(MULTIQC_REQUIRED_OUTPUT)

    _check_documented_core_files(
        parsed_outputs, skip_multiqc=skip_multiqc, missing_required=missing_required
    )

    if not skip_fastqc:
        # FastQC is a hard gate for every aligner: 4.1.0 runs FASTQC on the shared
        # ch_fastq before aligner branching and publishes results/fastqc/ for all of
        # them (output.md: "FastQC is applied to all aligners' input reads"). The
        # FASTQC_GATED_ALIGNERS set is the full aligner list, so a missing fastqc/
        # tree fails any otherwise-successful run unless --skip-fastqc (audit H-02).
        fastqc_target = (
            missing_required if aligner in FASTQC_GATED_ALIGNERS else missing_optional
        )
        if "fastqc" not in top_level_entries:
            fastqc_target.append("fastqc")
        official_outputs = parsed_outputs.get("official_outputs", {})
        if not isinstance(official_outputs, dict):
            official_outputs = {}
        fastqc = official_outputs.get("fastqc", {})
        if isinstance(fastqc, dict):
            if not fastqc.get("html_reports"):
                fastqc_target.append("fastqc/**/*.html")
            if not fastqc.get("zip_reports"):
                fastqc_target.append("fastqc/**/*.zip")

    # The .h5ad matrices are this skill's central FASTQ→h5ad deliverable. Every
    # 4.1.0 preset runs MTX_TO_H5AD (cellrangerarc/cellrangermulti reuse the
    # cellranger template), so a completed run with zero .h5ad is a genuine failure,
    # not an optional gap — surface it as EXPECTED_OUTPUTS_NOT_FOUND rather than a
    # silent success. (An ambiguous-but-present selection is signalled separately by
    # handoff_available=false, which does not fail the run.)
    if not parsed_outputs.get("h5ad_candidates"):
        missing_required.append(f"{aligner_output_dir}/mtx_conversions/*.h5ad")

    return {
        "missing_required": missing_required,
        "missing_optional": missing_optional,
    }


def _top_level_entries(parsed_outputs: dict[str, object]) -> set[str]:
    entries = parsed_outputs.get("top_level_entries")
    if isinstance(entries, list):
        return {str(entry) for entry in entries}
    upstream_dir = parsed_outputs.get("upstream_dir")
    if isinstance(upstream_dir, str):
        path = Path(upstream_dir)
        if path.exists():
            return set(list_top_level_entries(path))
    return set()
