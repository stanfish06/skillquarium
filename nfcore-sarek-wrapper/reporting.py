# nfcore-sarek-wrapper / reporting.py
"""Write the human-facing report bundle for an nf-core/sarek run.

This module owns four files written under ``<output_dir>/reproducibility/``:

* ``report.md``       — human-readable markdown summary.
* ``result.json``     — machine-readable run summary (schema_version 1).
* ``commands.sh``     — portable bash replay script.
* ``remap_paths.py``  — copy of the cross-machine path remapper.

It must NOT write to any other file in the reproducibility bundle (that is
``provenance.py``'s job).  This module is pure-Python: no subprocesses, no
network, no logging beyond the returned ``warnings`` list.
"""

from __future__ import annotations

import dataclasses
import gzip
import json
import shutil
import stat
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_SKILL_DIR = Path(__file__).resolve().parent
if str(_SKILL_DIR) in sys.path:
    sys.path.remove(str(_SKILL_DIR))
sys.path.insert(0, str(_SKILL_DIR))


def _purge_foreign_bare_modules(*names: str) -> None:
    for name in names:
        module = sys.modules.get(name)
        module_file = Path(getattr(module, "__file__", "") or "")
        if module is not None and _SKILL_DIR not in module_file.parents and module_file != _SKILL_DIR / f"{name}.py":
            sys.modules.pop(name, None)


_purge_foreign_bare_modules("schemas")

from schemas import DEFAULT_ALIGNER, DEFAULT_STEP, SKILL_NAME, SKILL_VERSION  # noqa: E402

_DISCLAIMER = (
    "ClawBio is a research and educational tool. It is not a medical device "
    "and does not provide clinical diagnoses. Consult a healthcare "
    "professional before making any medical decisions."
)

_EM_DASH = "-"  # ASCII placeholder for "not available"


# ---------------------------------------------------------------------------
# Public dataclass
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ReportingArtifacts:
    report_md: Path
    result_json: Path
    commands_sh: Path
    remap_paths_py: Path
    files_written: list[Path]
    warnings: list[str]


# ---------------------------------------------------------------------------
# Public entry
# ---------------------------------------------------------------------------


def write_reports(
    *,
    output_dir: Path,
    skill_dir: Path,
    params: dict[str, Any],
    samplesheet_report: Any,
    pipeline_source: Any,
    outputs_report: Any | None,
    nextflow_command: list[str],
    pipeline_source_kind: str,
    java_version: str | None = None,
    nextflow_version: str | None = None,
    resume_used: bool = False,
    arm: bool = False,
    profile: str = "docker",
    elapsed_seconds: float | None = None,
) -> ReportingArtifacts:
    """Write report.md, result.json, commands.sh, and copy remap_paths.py.

    All four files land in ``<output_dir>/reproducibility/``.  The function
    is idempotent: re-running overwrites the four artifacts but leaves all
    other files in the bundle untouched.
    """
    output_dir = Path(output_dir)
    skill_dir = Path(skill_dir)
    repro_dir = output_dir / "reproducibility"
    repro_dir.mkdir(parents=True, exist_ok=True)

    warnings: list[str] = []
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # Snapshot upstream structures into plain dicts so we don't accidentally
    # depend on dataclass/dict variance below.
    ss = _as_dict(samplesheet_report)
    ps = _as_dict(pipeline_source)
    ofr = _as_dict(outputs_report) if outputs_report is not None else None

    status = "ok" if ofr is not None else "partial"
    if ofr is None:
        warnings.append(
            "No outputs_report was provided; result.json marked as 'partial' "
            "and report.md will omit output sections."
        )

    pipeline_version = str(
        ps.get("resolved_version") or params.get("pipeline_version") or "3.8.1"
    )

    # ---- report.md ---------------------------------------------------------
    report_md = repro_dir / "report.md"
    report_md.write_text(
        _build_report_md(
            output_dir=output_dir,
            generated_at=generated_at,
            params=params,
            samplesheet=ss,
            outputs=ofr,
            pipeline_version=pipeline_version,
            java_version=java_version,
            nextflow_version=nextflow_version,
            resume_used=resume_used,
            elapsed_seconds=elapsed_seconds,
            extra_warnings=list(warnings),
        ),
        encoding="utf-8",
    )

    # ---- result.json -------------------------------------------------------
    result_json = repro_dir / "result.json"
    result_payload = _build_result_payload(
        output_dir=output_dir,
        generated_at=generated_at,
        status=status,
        params=params,
        samplesheet=ss,
        outputs=ofr,
        resume_used=resume_used,
        elapsed_seconds=elapsed_seconds,
        warnings=warnings,
    )
    result_json.write_text(
        json.dumps(result_payload, indent=2, sort_keys=True), encoding="utf-8"
    )

    # ---- commands.sh -------------------------------------------------------
    commands_sh = repro_dir / "commands.sh"
    sh_text, sh_warnings = _build_commands_sh(
        output_dir=output_dir,
        generated_at=generated_at,
        nextflow_command=list(nextflow_command),
        profile=str(params.get("profile") or profile),
        pipeline_version=pipeline_version,
        pipeline_source_kind=pipeline_source_kind,
    )
    warnings.extend(sh_warnings)
    commands_sh.write_text(sh_text, encoding="utf-8")
    commands_sh.chmod(
        commands_sh.stat().st_mode
        | stat.S_IXUSR
        | stat.S_IXGRP
        | stat.S_IXOTH
    )

    # ---- remap_paths.py copy ----------------------------------------------
    remap_src = skill_dir / "remap_paths.py"
    remap_dst = repro_dir / "remap_paths.py"
    if remap_src.exists():
        shutil.copy2(remap_src, remap_dst)
        try:
            shutil.copymode(remap_src, remap_dst)
        except OSError:
            pass
    else:
        warnings.append(f"remap_paths.py not found at {remap_src}; skipping copy.")

    files = [report_md, result_json, commands_sh]
    if remap_dst.exists():
        files.append(remap_dst)

    return ReportingArtifacts(
        report_md=report_md,
        result_json=result_json,
        commands_sh=commands_sh,
        remap_paths_py=remap_dst,
        files_written=files,
        warnings=warnings,
    )


# ---------------------------------------------------------------------------
# Helpers — input normalisation
# ---------------------------------------------------------------------------


def _as_dict(obj: Any) -> dict[str, Any]:
    """Best-effort: turn a dict or dataclass-like object into a plain dict."""
    if obj is None:
        return {}
    if isinstance(obj, dict):
        return dict(obj)
    if dataclasses.is_dataclass(obj) and not isinstance(obj, type):
        return dataclasses.asdict(obj)
    # Generic object with attributes
    out: dict[str, Any] = {}
    for name in dir(obj):
        if name.startswith("_"):
            continue
        try:
            value = getattr(obj, name)
        except AttributeError:
            continue
        if callable(value):
            continue
        out[name] = value
    return out


def _attr(obj: Any, key: str, default: Any = None) -> Any:
    """Read either dict-key or attribute access."""
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _to_rel(path: Path | str | None, output_dir: Path) -> str | None:
    """POSIX-relative path under output_dir, or None if not under."""
    if path is None or path == "":
        return None
    try:
        p = Path(path)
    except (TypeError, ValueError):
        return None
    try:
        return p.resolve().relative_to(output_dir.resolve()).as_posix()
    except (ValueError, OSError):
        try:
            return Path(path).relative_to(output_dir).as_posix()
        except ValueError:
            return None


# ---------------------------------------------------------------------------
# VCF record counting
# ---------------------------------------------------------------------------


def _count_vcf_records(path: Path | str, *, max_bytes: int = 50_000_000) -> int | None:
    """Count non-header records in a VCF or VCF.gz file.

    Returns None for missing files, files exceeding max_bytes, or read errors.
    """
    if path is None:
        return None
    p = Path(path)
    if not p.exists() or not p.is_file():
        return None
    try:
        if p.stat().st_size > max_bytes:
            return None
    except OSError:
        return None
    opener = gzip.open if p.suffix == ".gz" else open
    count = 0
    try:
        with opener(p, "rt") as fh:  # type: ignore[arg-type]
            for line in fh:
                if line and not line.startswith("#"):
                    count += 1
    except (OSError, EOFError, UnicodeDecodeError):
        return None
    return count


# ---------------------------------------------------------------------------
# ASCAT purity/ploidy parsing
# ---------------------------------------------------------------------------


def _parse_ascat_purity_ploidy(path: Path | str | None) -> tuple[str | None, str | None]:
    """Extract (purity, ploidy) from an ASCAT *.purityploidy.txt file."""
    if path is None:
        return None, None
    p = Path(path)
    if not p.exists() or not p.is_file():
        return None, None
    try:
        text = p.read_text(encoding="utf-8")
    except OSError:
        return None, None
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if len(lines) < 2:
        return None, None
    header = lines[0].split()
    values = lines[1].split()
    purity: str | None = None
    ploidy: str | None = None
    for i, col in enumerate(header):
        col_l = col.lower()
        if i >= len(values):
            break
        if "purity" in col_l:
            purity = values[i]
        elif "ploidy" in col_l:
            ploidy = values[i]
    if purity is None and ploidy is None and len(values) >= 2:
        # Fallback: first column = aberrant cell fraction (~purity), second = ploidy
        purity = values[0]
        ploidy = values[1]
    return purity, ploidy


# ---------------------------------------------------------------------------
# report.md
# ---------------------------------------------------------------------------


def _build_report_md(
    *,
    output_dir: Path,
    generated_at: str,
    params: dict[str, Any],
    samplesheet: dict[str, Any],
    outputs: dict[str, Any] | None,
    pipeline_version: str,
    java_version: str | None,
    nextflow_version: str | None,
    resume_used: bool,
    elapsed_seconds: float | None,
    extra_warnings: list[str],
) -> str:
    lines: list[str] = []
    lines.append("# nf-core/sarek run report")
    lines.append("")
    lines.append(f"**Generated:** {generated_at}")
    lines.append("")

    # ---- Summary table ----------------------------------------------------
    analysis_mode = str(samplesheet.get("analysis_mode") or _EM_DASH)
    tools_list = _tool_tokens(params.get("tools"))
    skip_list = _tool_tokens(params.get("skip_tools"))
    samples = samplesheet.get("sample_names") or []
    pairings = samplesheet.get("pairings") or []
    elapsed_str = _format_elapsed(elapsed_seconds)

    lines.append("## Run summary")
    lines.append("")
    lines.append("| Field | Value |")
    lines.append("|---|---|")
    lines.append(f"| Pipeline | nf-core/sarek {pipeline_version} |")
    lines.append(f"| Step | {params.get('step') or DEFAULT_STEP} |")
    lines.append(f"| Aligner | {params.get('aligner') or DEFAULT_ALIGNER} |")
    lines.append(f"| Analysis mode | {analysis_mode} |")
    lines.append(f"| Profile | {params.get('profile') or _EM_DASH} |")
    lines.append(f"| Tools | {_join_or_none(tools_list)} |")
    lines.append(f"| Skip tools | {_join_or_none(skip_list)} |")
    lines.append(f"| WES | {_yes_no(params.get('wes'))} |")
    lines.append(f"| Joint germline | {_yes_no(params.get('joint_germline'))} |")
    lines.append(f"| Joint Mutect2 | {_yes_no(params.get('joint_mutect2'))} |")
    lines.append(f"| Samples | {len(samples)} |")
    if analysis_mode == "somatic_paired":
        lines.append(f"| Tumor/Normal pairs | {len(pairings)} |")
    else:
        lines.append(f"| Tumor/Normal pairs | {_EM_DASH} |")
    lines.append(f"| Resume | {_yes_no(resume_used)} |")
    lines.append(f"| Java | {java_version or _EM_DASH} |")
    lines.append(f"| Nextflow | {nextflow_version or _EM_DASH} |")
    lines.append(f"| Elapsed | {elapsed_str} |")
    lines.append("")

    # ---- Samples ----------------------------------------------------------
    lines.append("## Samples")
    lines.append("")
    detected: list[str] = []
    if outputs is not None:
        detected = outputs.get("samples_detected") or []
    sample_list = list(detected) if detected else list(samples)
    if sample_list:
        lines.append("| Sample | Status |")
        lines.append("|---|---|")
        detected_set = set(detected) if detected else set()
        for s in sample_list:
            status = "detected" if (not detected or s in detected_set) else "expected"
            lines.append(f"| {s} | {status} |")
    else:
        lines.append("(no samples reported)")
    lines.append("")

    # ---- Tumor/Normal pairings -------------------------------------------
    if analysis_mode == "somatic_paired":
        lines.append("## Tumor/Normal pairings")
        lines.append("")
        if pairings:
            lines.append("| Tumor | Normal |")
            lines.append("|---|---|")
            for pair in pairings:
                tumor, normal = _split_pair(pair)
                lines.append(f"| {tumor} | {normal} |")
        else:
            lines.append("(no pairings recorded)")
        lines.append("")

    # ---- Variant calling --------------------------------------------------
    if outputs is not None:
        lines.extend(_build_variant_calling_section(outputs))
        lines.extend(_build_annotation_section(outputs))
        lines.extend(_build_qc_section(outputs, output_dir))
    else:
        lines.append("## Variant calling outputs")
        lines.append("")
        lines.append("(outputs not parsed; run was not completed or --check mode)")
        lines.append("")

    # ---- Reproducibility --------------------------------------------------
    lines.append("## Reproducibility")
    lines.append("")
    lines.append("The `reproducibility/` directory contains:")
    lines.append("- `params.yaml` - exact params used")
    lines.append("- `samplesheet.valid.csv` - normalized samplesheet")
    lines.append(
        "- `commands.sh` - portable replay script (set `CLAWBIO_REPO` to your local checkout root)"
    )
    lines.append("- `manifest.json` - drift-detection fingerprint")
    lines.append("- `checksums.sha256` - all output file hashes")
    lines.append("- `environment.yml` - minimal conda env")
    lines.append(
        "- `remap_paths.py` - cross-machine path remapper. Data paths: "
        "`--old /old/prefix --new /new/prefix`; reference paths in params.yaml: "
        "`--refs-old /old/refs --refs-new /new/refs`; then `--verify`"
    )
    lines.append("")

    # ---- Disclaimer -------------------------------------------------------
    lines.append("## Disclaimer")
    lines.append("")
    lines.append(_DISCLAIMER)
    lines.append("")

    # ---- Warnings ---------------------------------------------------------
    all_warnings: list[str] = []
    if outputs is not None:
        all_warnings.extend(str(w) for w in (outputs.get("warnings") or []))
    all_warnings.extend(extra_warnings)
    if all_warnings:
        lines.append("## Warnings")
        lines.append("")
        for w in all_warnings:
            lines.append(f"- {w}")
        lines.append("")

    return "\n".join(lines)


def _build_variant_calling_section(outputs: dict[str, Any]) -> list[str]:
    lines: list[str] = []
    lines.append("## Variant calling outputs")
    lines.append("")
    variant_calling = outputs.get("variant_calling") or {}
    if not variant_calling:
        lines.append("(no variant-calling outputs detected)")
        lines.append("")
        return lines

    for tool, by_key in sorted(variant_calling.items()):
        if not by_key:
            continue
        lines.append(f"### {tool}")
        lines.append("")
        if tool == "ascat":
            lines.append("| Sample / Pair | Purity | Ploidy | Files |")
            lines.append("|---|---|---|---|")
            for key, entry in sorted(by_key.items()):
                purity, ploidy = _parse_ascat_purity_ploidy(entry.get("purity_ploidy"))
                files = _flatten_entry_files(entry)
                lines.append(
                    f"| {key} | {purity or _EM_DASH} | {ploidy or _EM_DASH} | {len(files)} |"
                )
        else:
            lines.append("| Sample / Pair | Files | Variant count |")
            lines.append("|---|---|---|")
            for key, entry in sorted(by_key.items()):
                files = _flatten_entry_files(entry)
                vc = _best_variant_count(files)
                vc_s = str(vc) if vc is not None else _EM_DASH
                lines.append(f"| {key} | {len(files)} | {vc_s} |")
        lines.append("")
    return lines


def _build_annotation_section(outputs: dict[str, Any]) -> list[str]:
    lines: list[str] = []
    annotation = outputs.get("annotation") or {}
    flat: list[tuple[str, str, Any, Any]] = []
    for annotator, entries in annotation.items():
        if not entries:
            continue
        for sample_caller, entry in entries.items():
            output_file = entry.get("vcf") or entry.get("json") or entry.get("tab")
            flat.append((annotator, sample_caller, output_file, entry.get("html")))
    if not flat:
        return lines
    lines.append("## Annotation")
    lines.append("")
    lines.append("| Annotator | Sample/Caller | Output | HTML report |")
    lines.append("|---|---|---|---|")
    for annotator, sc, output_file, html in sorted(flat):
        output_s = Path(output_file).name if output_file else _EM_DASH
        html_s = Path(html).name if html else _EM_DASH
        lines.append(f"| {annotator} | {sc} | {output_s} | {html_s} |")
    lines.append("")
    return lines


def _build_qc_section(outputs: dict[str, Any], output_dir: Path) -> list[str]:
    lines: list[str] = []
    qc = outputs.get("qc") or {}
    multiqc = qc.get("multiqc_report")
    fastqc = qc.get("fastqc") or []
    mosdepth = qc.get("mosdepth") or []
    ngscheckmate = qc.get("ngscheckmate")

    if not qc:
        return lines

    lines.append("## QC")
    lines.append("")
    multiqc_rel = _to_rel(multiqc, output_dir) if multiqc else None
    lines.append(f"- MultiQC: {multiqc_rel or _EM_DASH}")
    lines.append(f"- FastQC samples: {len(fastqc)}")
    lines.append(f"- mosdepth: {len(mosdepth)}")
    nc_rel = _to_rel(ngscheckmate, output_dir) if ngscheckmate else None
    lines.append(f"- ngscheckmate: {nc_rel or _EM_DASH}")
    lines.append("")
    return lines


def _flatten_entry_files(entry: dict[str, Any]) -> list[Path]:
    files: list[Path] = []
    for value in entry.values():
        if isinstance(value, Path):
            files.append(value)
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, Path):
                    files.append(item)
                elif isinstance(item, str):
                    files.append(Path(item))
        elif isinstance(value, str):
            files.append(Path(value))
    return files


def _is_gvcf_name(name: str) -> bool:
    """True for all-sites gVCF / genome VCFs.

    Their record count reflects reference blocks across the genome, not called
    variants, so they must not drive the headline "variant count". Covers
    ``<sample>.<caller>.g.vcf[.gz]`` (HaplotypeCaller/DeepVariant/Sentieon) and
    ``<sample>.strelka.genome.vcf.gz`` (Strelka's all-sites genome VCF).
    """
    n = name.lower()
    return n.endswith(".g.vcf") or n.endswith(".g.vcf.gz") or ".genome.vcf" in n


def _best_variant_count(files: list[Path]) -> int | None:
    """Count records in the most meaningful VCF for a caller's output.

    Preference order: a filtered call set, then the raw called-variants VCF, and
    only as a last resort an all-sites gVCF/genome VCF. This keeps the reported
    count aligned with actual variant calls (e.g. Strelka's ``variants.vcf.gz``)
    rather than gVCF reference blocks (``genome.vcf.gz``).
    """
    vcfs = [
        f for f in files
        if f.name.lower().endswith(".vcf") or f.name.lower().endswith(".vcf.gz")
    ]
    vcfs.sort(
        key=lambda path: (
            1 if _is_gvcf_name(path.name) else 0,            # gVCF / genome VCF last
            0 if ".filtered." in path.name.lower() else 1,   # prefer filtered call set
            path.name.lower(),
        )
    )
    for f in vcfs:
        count = _count_vcf_records(f)
        if count is not None:
            return count
    return None


def _split_pair(pair: Any) -> tuple[str, str]:
    if isinstance(pair, (tuple, list)) and len(pair) >= 2:
        return str(pair[0]), str(pair[1])
    if isinstance(pair, dict):
        # Current paired entries store singular "tumor"; retain "tumors" for
        # unpaired and legacy report payloads.
        tumors = pair.get("tumors") or pair.get("tumor") or []
        if isinstance(tumors, list):
            tumor = ", ".join(str(t) for t in tumors) if tumors else ""
        else:
            tumor = str(tumors) if tumors else ""
        normal = str(pair.get("normal") or "")
        return tumor, normal
    if isinstance(pair, str) and "_vs_" in pair:
        t, _, n = pair.partition("_vs_")
        return t, n
    return str(pair), _EM_DASH


def _yes_no(v: Any) -> str:
    if isinstance(v, bool):
        return "yes" if v else "no"
    if v in (None, "", _EM_DASH):
        return "no"
    return "yes" if v else "no"


def _join_or_none(seq: Any) -> str:
    if not seq:
        return "(none)"
    if isinstance(seq, (list, tuple, set)):
        return ", ".join(str(s) for s in seq)
    return str(seq)


def _tool_tokens(raw: Any) -> list[str]:
    if not raw:
        return []
    if isinstance(raw, str):
        return [token.strip() for token in raw.split(",") if token.strip()]
    if isinstance(raw, (list, tuple, set)):
        return [str(token).strip() for token in raw if str(token).strip()]
    return [str(raw).strip()]


def _format_elapsed(seconds: float | None) -> str:
    if seconds is None:
        return _EM_DASH
    try:
        s = int(round(float(seconds)))
    except (TypeError, ValueError):
        return _EM_DASH
    h, rem = divmod(s, 3600)
    m, sec = divmod(rem, 60)
    return f"{h}:{m:02d}:{sec:02d}"


# ---------------------------------------------------------------------------
# result.json
# ---------------------------------------------------------------------------


def _build_result_payload(
    *,
    output_dir: Path,
    generated_at: str,
    status: str,
    params: dict[str, Any],
    samplesheet: dict[str, Any],
    outputs: dict[str, Any] | None,
    resume_used: bool,
    elapsed_seconds: float | None,
    warnings: list[str],
) -> dict[str, Any]:
    run = {
        "step": params.get("step") or DEFAULT_STEP,
        "aligner": params.get("aligner") or DEFAULT_ALIGNER,
        "analysis_mode": samplesheet.get("analysis_mode") or "",
        "profile": params.get("profile") or "",
        "tools": _tool_tokens(params.get("tools")),
        "skip_tools": _tool_tokens(params.get("skip_tools")),
        "wes": bool(params.get("wes") or False),
        "joint_germline": bool(params.get("joint_germline") or False),
        "joint_mutect2": bool(params.get("joint_mutect2") or False),
        "resume_used": bool(resume_used),
        "elapsed_seconds": elapsed_seconds,
    }

    samples_out = [str(s) for s in (samplesheet.get("sample_names") or [])]
    # Samples the wrapper actually detected in the upstream outputs. This can
    # differ from `samples` (input-derived): in --demo the `test` profile
    # supplies the samplesheet remotely, so `samples` is [] while the run still
    # produces sample "test". Surfacing both keeps result.json machine-honest.
    samples_detected_out = (
        [str(s) for s in (outputs.get("samples_detected") or [])]
        if outputs is not None
        else []
    )
    pairs_out: list[dict[str, str]] = []
    for pair in samplesheet.get("pairings") or []:
        t, n = _split_pair(pair)
        pairs_out.append({"tumor": t, "normal": n})

    outputs_section: dict[str, Any] = {}
    all_warnings = list(warnings)

    if outputs is not None:
        # Preprocessing counts
        pre = outputs.get("preprocessing") or {}
        outputs_section["preprocessing"] = {
            "recalibrated_crams": len(pre.get("recalibrated") or {}),
            "markduplicates_crams": len(pre.get("markduplicates") or {}),
            "mapped": len(pre.get("mapped") or {}),
            "sentieon_dedup": len(pre.get("sentieon_dedup") or []),
            "sentieon_consensus": len(pre.get("sentieon_consensus") or []),
            "parabricks": len(pre.get("parabricks") or []),
            "converted": len(pre.get("converted") or []),
        }
        # Variant calling counts per tool
        vc = outputs.get("variant_calling") or {}
        outputs_section["variant_calling"] = {
            tool: len(by_key) for tool, by_key in vc.items() if by_key
        }
        # Annotation counts per annotator
        ann = outputs.get("annotation") or {}
        outputs_section["annotation"] = {
            annotator: len(entries) for annotator, entries in ann.items() if entries
        }
        # QC summary
        qc = outputs.get("qc") or {}
        outputs_section["qc"] = {
            "multiqc": _to_rel(qc.get("multiqc_report"), output_dir),
            "fastqc": len(qc.get("fastqc") or []),
            "mosdepth": len(qc.get("mosdepth") or []),
            "samtools_stats": len(qc.get("samtools_stats") or []),
            "bcftools_stats": len(qc.get("bcftools_stats") or []),
            "ngscheckmate": _to_rel(qc.get("ngscheckmate"), output_dir),
        }
        all_warnings.extend(str(w) for w in (outputs.get("warnings") or []))

    payload: dict[str, Any] = {
        "schema_version": 1,
        "skill": SKILL_NAME,
        "skill_version": SKILL_VERSION,
        "status": status,
        "generated_at": generated_at,
        "run": run,
        "samples": samples_out,
        "samples_detected": samples_detected_out,
        "pairs": pairs_out,
        "outputs": outputs_section,
        "reproducibility": {
            "manifest": "reproducibility/manifest.json",
            "commands": "reproducibility/commands.sh",
        },
        "warnings": all_warnings,
    }
    return payload


# ---------------------------------------------------------------------------
# commands.sh
# ---------------------------------------------------------------------------


_PORTABILITY_TIP = (
    "# Tip: if your machine has different paths than this bundle was "
    "generated on, run remap_paths.py first."
)


def _build_commands_sh(
    *,
    output_dir: Path,
    generated_at: str,
    nextflow_command: list[str],
    profile: str,
    pipeline_version: str,
    pipeline_source_kind: str,
) -> tuple[str, list[str]]:
    """Return (script_text, warnings)."""
    warnings: list[str] = []

    # Rewrite the nextflow argv to be portable.
    portable_argv, argv_warnings = _portable_argv(
        nextflow_command, output_dir=output_dir
    )
    warnings.extend(argv_warnings)

    lines: list[str] = []
    lines.append("#!/usr/bin/env bash")
    lines.append(f"# Generated by nfcore-sarek-wrapper at {generated_at}.")
    lines.append(
        "# Set CLAWBIO_REPO to the absolute root of your ClawBio checkout before running."
    )
    lines.append("")
    lines.append("set -euo pipefail")
    lines.append("")
    lines.append(
        'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"'
    )
    lines.append("")
    lines.append(
        ': "${CLAWBIO_REPO:?Set CLAWBIO_REPO to the absolute root of your ClawBio repo, '
        'e.g. /home/you/ClawBio}"'
    )
    lines.append("")
    lines.append("# Re-run through ClawBio using the captured parameters and profile:")
    lines.append("")
    lines.append('python3 "$CLAWBIO_REPO/clawbio.py" run sarek-pipeline \\')
    lines.append('  --input "$SCRIPT_DIR/samplesheet.valid.csv" \\')
    lines.append('  --output "<EDIT_ME: parent dir of this reproducibility/ dir>" \\')
    lines.append(f"  --profile {_shell_quote(profile)} \\")
    lines.append('  --params-file "$SCRIPT_DIR/params.yaml"')
    lines.append("")
    lines.append("# Replay the captured Nextflow invocation directly:")
    lines.append("")
    lines.append('(cd "$SCRIPT_DIR/.." && \\')
    lines.append("  " + " \\\n  ".join(_replay_shell_arg(a) for a in portable_argv) + ")")
    lines.append("")
    if pipeline_source_kind in {"local", "local_checkout"}:
        lines.append(
            "# NOTE: original run used a local pipeline checkout; replace its "
            "<EDIT_ME> path before direct replay."
        )
        lines.append("")
    lines.append(_PORTABILITY_TIP)
    lines.append("")
    return "\n".join(lines), warnings


def _portable_argv(
    argv: list[str], *, output_dir: Path
) -> tuple[list[str], list[str]]:
    """Best-effort rewrite of an argv list to remove absolute paths.

    * Paths under output_dir become ``$SCRIPT_DIR/..`` references.
    * Paths under output_dir/reproducibility become ``$SCRIPT_DIR/<rest>``.
    * Other absolute paths are replaced with ``<EDIT_ME>`` and a warning is
      logged.
    """
    warnings: list[str] = []
    out: list[str] = []
    outdir_abs = str(output_dir.resolve())
    repro_abs = str((output_dir / "reproducibility").resolve())

    for a in argv:
        if not isinstance(a, str):
            out.append(str(a))
            continue
        if a.startswith(repro_abs):
            tail = a[len(repro_abs):].lstrip("/")
            out.append(f"$SCRIPT_DIR/{tail}" if tail else "$SCRIPT_DIR")
        elif a.startswith(outdir_abs):
            tail = a[len(outdir_abs):].lstrip("/")
            out.append(f"$SCRIPT_DIR/../{tail}" if tail else "$SCRIPT_DIR/..")
        elif a.startswith("/") and not a.startswith("/dev/"):
            out.append("<EDIT_ME>")
            warnings.append(
                f"commands.sh: could not safely rewrite absolute path '{a}'; "
                f"replaced with <EDIT_ME>."
            )
        else:
            out.append(a)
    return out, warnings


def _shell_quote(s: str) -> str:
    """Minimal POSIX shell quoter for portable replay arguments."""
    if not s:
        return "''"
    if any(c in s for c in " \t\n'\"\\$`<>();&|*?!"):
        return "'" + s.replace("'", "'\\''") + "'"
    return s


def _replay_shell_arg(s: str) -> str:
    """Quote a portable argv token while leaving SCRIPT_DIR expandable."""
    if s == "$SCRIPT_DIR":
        return '"$SCRIPT_DIR"'
    if s.startswith("$SCRIPT_DIR/"):
        return f'"$SCRIPT_DIR/{s[len("$SCRIPT_DIR/"): ]}"'
    return _shell_quote(s)


__all__ = [
    "ReportingArtifacts",
    "write_reports",
    "_count_vcf_records",
]
