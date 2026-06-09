from __future__ import annotations

import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from remap_paths import cmd_remap, remap_csv, verify_paths

_FASTQ_HEADER = "sample,fastq_1,fastq_2,expected_cells,seq_center\n"


def _write_samplesheet(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(
            fh,
            fieldnames=["sample", "fastq_1", "fastq_2", "expected_cells", "seq_center"],
        )
        writer.writeheader()
        writer.writerows(rows)


# ── find_samplesheet ──────────────────────────────────────────────────────────


# ── remap_csv ─────────────────────────────────────────────────────────────────


def test_remap_csv_replaces_matching_prefix(tmp_path):
    ss = tmp_path / "samplesheet.valid.csv"
    _write_samplesheet(
        ss,
        [
            {
                "sample": "S1",
                "fastq_1": "/old/data/S1_R1.fastq.gz",
                "fastq_2": "/old/data/S1_R2.fastq.gz",
                "expected_cells": "",
                "seq_center": "",
            },
        ],
    )
    changes = remap_csv(ss, "/old/data", "/new/data", dry_run=False)
    assert len(changes) == 2
    assert changes[0] == (
        "fastq_1",
        "/old/data/S1_R1.fastq.gz",
        "/new/data/S1_R1.fastq.gz",
    )
    assert changes[1] == (
        "fastq_2",
        "/old/data/S1_R2.fastq.gz",
        "/new/data/S1_R2.fastq.gz",
    )
    rows = list(csv.DictReader(ss.read_text(encoding="utf-8").splitlines()))
    assert rows[0]["fastq_1"] == "/new/data/S1_R1.fastq.gz"
    assert rows[0]["fastq_2"] == "/new/data/S1_R2.fastq.gz"


def test_remap_csv_only_replaces_prefix_not_middle(tmp_path):
    ss = tmp_path / "samplesheet.valid.csv"
    _write_samplesheet(
        ss,
        [
            {
                "sample": "S1",
                "fastq_1": "/data/old/S1_R1.fastq.gz",
                "fastq_2": "/data/old/S1_R2.fastq.gz",
                "expected_cells": "",
                "seq_center": "",
            },
        ],
    )
    changes = remap_csv(ss, "/old", "/new", dry_run=False)
    assert changes == [], "Should not replace /old in the middle of the path"


# ── verify_paths ──────────────────────────────────────────────────────────────


def test_verify_paths_returns_missing_paths(tmp_path):
    ss = tmp_path / "samplesheet.valid.csv"
    _write_samplesheet(
        ss,
        [
            {
                "sample": "S1",
                "fastq_1": "/nonexistent/R1.fastq.gz",
                "fastq_2": "/nonexistent/R2.fastq.gz",
                "expected_cells": "",
                "seq_center": "",
            },
        ],
    )
    missing = verify_paths(ss)
    assert len(missing) == 2
    assert "/nonexistent/R1.fastq.gz" in missing
    assert "/nonexistent/R2.fastq.gz" in missing


# ── cmd_remap (integration) ───────────────────────────────────────────────────


def test_cmd_remap_succeeds_when_paths_are_remapped_to_existing_files(tmp_path):
    r1 = tmp_path / "fastqs" / "S1_R1.fastq.gz"
    r2 = tmp_path / "fastqs" / "S1_R2.fastq.gz"
    r1.parent.mkdir()
    r1.write_bytes(b"")
    r2.write_bytes(b"")
    ss = tmp_path / "samplesheet.valid.csv"
    _write_samplesheet(
        ss,
        [
            {
                "sample": "S1",
                "fastq_1": "/old/fastqs/S1_R1.fastq.gz",
                "fastq_2": "/old/fastqs/S1_R2.fastq.gz",
                "expected_cells": "",
                "seq_center": "",
            },
        ],
    )
    rc = cmd_remap(
        "/old/fastqs", str(tmp_path / "fastqs"), dry_run=False, bundle_dir=tmp_path
    )
    assert rc == 0
    rows = list(csv.DictReader(ss.read_text(encoding="utf-8").splitlines()))
    assert rows[0]["fastq_1"] == str(tmp_path / "fastqs" / "S1_R1.fastq.gz")


def test_cmd_remap_returns_nonzero_when_new_paths_missing(tmp_path):
    ss = tmp_path / "samplesheet.valid.csv"
    _write_samplesheet(
        ss,
        [
            {
                "sample": "S1",
                "fastq_1": "/old/S1_R1.fastq.gz",
                "fastq_2": "/old/S1_R2.fastq.gz",
                "expected_cells": "",
                "seq_center": "",
            },
        ],
    )
    rc = cmd_remap("/old", "/nonexistent", dry_run=False, bundle_dir=tmp_path)
    assert rc != 0


# ── cmd_verify (integration) ──────────────────────────────────────────────────


# ── find_commands_sh ──────────────────────────────────────────────────────────


# ── params.yaml reference remapping ──────────────────────────────────────────


def _write_bundle(tmp_path):
    bundle = tmp_path / "reproducibility"
    bundle.mkdir(parents=True, exist_ok=True)
    return bundle


def test_remap_params_references_rewrites_local_paths(tmp_path):
    import remap_paths

    bundle = _write_bundle(tmp_path)
    params = bundle / "params.yaml"
    params.write_text(
        "outdir: upstream/results\n"
        "fasta: /old/refs/genome.fa\n"
        "gtf: /old/refs/genes.gtf\n"
        "star_index: s3://bucket/star\n",
        encoding="utf-8",
    )

    changes = remap_paths.remap_params_references(
        params, "/old/refs", "/new/refs", dry_run=False
    )

    text = params.read_text(encoding="utf-8")
    assert "fasta: /new/refs/genome.fa" in text
    assert "gtf: /new/refs/genes.gtf" in text
    assert "star_index: s3://bucket/star" in text
    assert {c[0] for c in changes} == {"fasta", "gtf"}


def test_verify_params_references_skips_uris_and_missing(tmp_path):
    import remap_paths

    bundle = _write_bundle(tmp_path)
    real = bundle / "genome.fa"
    real.write_text("x", encoding="utf-8")
    params = bundle / "params.yaml"
    params.write_text(
        f"fasta: {real}\n"
        "gtf: /does/not/exist.gtf\n"
        "transcript_fasta: https://example.org/tx.fa\n",
        encoding="utf-8",
    )

    missing = remap_paths.verify_params_references(params)
    assert missing == ["/does/not/exist.gtf"]


def test_cmd_remap_references_returns_nonzero_when_refs_missing(tmp_path):
    """A non-dry-run reference remap that leaves references missing must signal
    failure via a non-zero exit code, matching cmd_remap and cmd_verify (audit H-6)."""
    import remap_paths

    bundle = _write_bundle(tmp_path)
    params = bundle / "params.yaml"
    params.write_text("fasta: /old/refs/genome.fa\n", encoding="utf-8")

    rc = remap_paths.cmd_remap_references(
        "/old/refs", "/nonexistent/refs", dry_run=False, bundle_dir=bundle
    )

    assert rc != 0


def test_cmd_remap_references_succeeds_when_refs_exist(tmp_path):
    """When the remapped references resolve on disk, the exit code is 0 (audit H-6)."""
    import remap_paths

    bundle = _write_bundle(tmp_path)
    new_refs = tmp_path / "refs"
    new_refs.mkdir()
    (new_refs / "genome.fa").write_text("x", encoding="utf-8")
    params = bundle / "params.yaml"
    params.write_text("fasta: /old/refs/genome.fa\n", encoding="utf-8")

    rc = remap_paths.cmd_remap_references(
        "/old/refs", str(new_refs), dry_run=False, bundle_dir=bundle
    )

    assert rc == 0


def test_params_reference_keys_match_params_builder():
    import remap_paths
    import params_builder

    # Ordered equality (stronger than set): the bundle remapper must walk params.yaml
    # reference keys in the exact canonical order, not merely the same membership.
    assert tuple(remap_paths._PARAMS_REFERENCE_KEYS) == tuple(
        params_builder._REFERENCE_PATH_FIELDS
    )


def test_bundle_copy_of_real_script_is_canonical_and_functional(tmp_path):
    """The bundle copy of the real remap_paths.py exposes canonical reference keys
    and a working params.yaml regex."""
    import reporting
    from schemas import ALL_REFERENCE_PATH_FIELDS

    reporting._write_remap_script(tmp_path)
    copied = (tmp_path / "remap_paths.py").read_text(encoding="utf-8")

    namespace: dict = {"__file__": str(tmp_path / "remap_paths.py")}
    exec(compile(copied, "remap_paths_bundle", "exec"), namespace)
    assert namespace["_PARAMS_REFERENCE_KEYS"] == tuple(ALL_REFERENCE_PATH_FIELDS)
    assert namespace["_PARAMS_REF_RE"].search("fasta: /x/genome.fa\n") is not None


def test_bundle_copy_regenerates_keys_even_if_in_repo_literal_drifts(
    tmp_path, monkeypatch
):
    """By construction: even if the in-repo literal between the AUTO-GENERATED
    sentinels drifts, the bundle copy is regenerated from the canonical source so
    the standalone bundle can never go out of sync."""
    import reporting
    from schemas import ALL_REFERENCE_PATH_FIELDS

    drifted_source = (
        "from pathlib import Path\n"
        "import re\n"
        "_BUNDLE_DIR = Path(__file__).resolve().parent\n"
        "# >>> AUTO-GENERATED reference keys (do not edit by hand) >>>\n"
        '_PARAMS_REFERENCE_KEYS = ("WRONG_DRIFTED_KEY",)\n'
        "# <<< AUTO-GENERATED reference keys <<<\n"
        "_PARAMS_REF_RE = re.compile('|'.join(re.escape(k) for k in _PARAMS_REFERENCE_KEYS))\n"
    )
    fake_src = tmp_path / "src_remap_paths.py"
    fake_src.write_text(drifted_source, encoding="utf-8")
    monkeypatch.setattr(reporting, "_REMAP_SCRIPT_SRC", fake_src)

    out_dir = tmp_path / "bundle"
    reporting._write_remap_script(out_dir)
    copied = (out_dir / "remap_paths.py").read_text(encoding="utf-8")

    namespace: dict = {"__file__": str(out_dir / "remap_paths.py")}
    exec(compile(copied, "remap_paths_bundle", "exec"), namespace)
    assert "WRONG_DRIFTED_KEY" not in copied
    assert namespace["_PARAMS_REFERENCE_KEYS"] == tuple(ALL_REFERENCE_PATH_FIELDS)
