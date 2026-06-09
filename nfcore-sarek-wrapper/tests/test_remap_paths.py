"""Tests for the standalone bundle-side remap_paths.py helper."""
from __future__ import annotations

from pathlib import Path

import remap_paths


def test_regenerate_checksums_mirrors_provenance_exclusions(tmp_path: Path):
    """The stdlib regenerator must hash the same file set as provenance.py.

    provenance.py excludes work/, .nextflow/, reproducibility/ and logs/ (and
    .log files). The standalone regenerator copied into each bundle must agree,
    otherwise ``sha256sum -c`` after a remap would not match the original.
    """
    output_dir = tmp_path / "out"
    bundle = output_dir / "reproducibility"
    (output_dir / "upstream" / "results").mkdir(parents=True)
    (output_dir / "upstream" / "results" / "var.vcf.gz").write_bytes(b"vcf")
    bundle.mkdir(parents=True)
    (bundle / "params.yaml").write_text("x", encoding="utf-8")
    (bundle / "logs").mkdir()
    (bundle / "logs" / "stdout.txt").write_text("log", encoding="utf-8")
    (output_dir / "work").mkdir()
    (output_dir / "work" / "junk").write_text("junk", encoding="utf-8")
    (output_dir / ".nextflow").mkdir()
    (output_dir / ".nextflow" / "history").write_text("h", encoding="utf-8")

    remap_paths._regenerate_checksums(bundle)
    text = (bundle / "checksums.sha256").read_text()

    assert "upstream/results/var.vcf.gz" in text
    assert "work/" not in text
    assert ".nextflow" not in text
    # The reproducibility/ bundle (incl. its logs/) is excluded, mirroring provenance.py.
    assert "reproducibility/" not in text
    assert "logs/" not in text
    # The checksum file never references itself.
    assert "checksums.sha256" not in text


# ---------------------------------------------------------------------------
# params.yaml reference remapping (full cross-OS portability)
# ---------------------------------------------------------------------------


def _write_params(tmp_path: Path, body: str) -> Path:
    repro = tmp_path / "reproducibility"
    repro.mkdir(parents=True, exist_ok=True)
    p = repro / "params.yaml"
    p.write_text(body, encoding="utf-8")
    return p


def test_remap_params_references_rewrites_reference_paths(tmp_path: Path):
    p = _write_params(
        tmp_path,
        "# header comment with /orig/refs that must NOT change\n"
        "input: reproducibility/samplesheet.valid.csv\n"
        "fasta: /orig/refs/genome.fa\n"
        "dbsnp: /orig/refs/dbsnp.vcf.gz\n"
        "pon: false\n"
        "vep_cache: s3://annotation-cache/vep_cache/\n"
        "bcftools_columns: CHROM,POS,REF,ALT\n",
    )
    changes = remap_paths.remap_params_references(p, "/orig/refs", "/new/refs", dry_run=False)
    keys = {k for k, _old, _new in changes}
    assert keys == {"fasta", "dbsnp"}
    text = p.read_text()
    assert "fasta: /new/refs/genome.fa" in text
    assert "dbsnp: /new/refs/dbsnp.vcf.gz" in text
    assert "pon: false" in text                      # disable sentinel untouched
    assert "vep_cache: s3://annotation-cache/vep_cache/" in text  # URI untouched
    assert "bcftools_columns: CHROM,POS,REF,ALT" in text          # non-path untouched
    assert "# header comment with /orig/refs" in text            # comments untouched
    assert p.with_suffix(".yaml.bak").exists()


def test_remap_params_references_dry_run_does_not_write(tmp_path: Path):
    p = _write_params(tmp_path, "fasta: /orig/g.fa\n")
    before = p.read_text()
    changes = remap_paths.remap_params_references(p, "/orig", "/new", dry_run=True)
    assert len(changes) == 1
    assert p.read_text() == before
    assert not p.with_suffix(".yaml.bak").exists()


def test_remap_params_references_preserves_quotes(tmp_path: Path):
    p = _write_params(tmp_path, "fasta: '/orig/my genome.fa'\n")
    remap_paths.remap_params_references(p, "/orig", "/new", dry_run=False)
    assert "fasta: '/new/my genome.fa'" in p.read_text()


def test_verify_params_references_reports_missing(tmp_path: Path):
    p = _write_params(
        tmp_path,
        "fasta: /no/such/genome.fa\n"
        "vep_cache: s3://x/\n"
        "pon: false\n",
    )
    missing = remap_paths.verify_params_references(p)
    assert missing == ["/no/such/genome.fa"]


def test_params_reference_keys_match_provenance():
    # The standalone key list must stay in sync with the authoritative set so a
    # newly-added reference param is not silently skipped during remap.
    from provenance import REFERENCE_PATH_PARAMS

    assert set(remap_paths._PARAMS_REFERENCE_KEYS) == set(REFERENCE_PATH_PARAMS)


def test_cmd_remap_references_rewrites_params_yaml(tmp_path: Path):
    bundle = tmp_path / "reproducibility"
    bundle.mkdir(parents=True)
    newrefs = tmp_path / "refs"
    newrefs.mkdir()
    (newrefs / "genome.fa").write_text("x", encoding="utf-8")  # so post-remap verify passes
    (bundle / "params.yaml").write_text("fasta: /orig/genome.fa\n", encoding="utf-8")
    (bundle / "commands.sh").write_text("#!/usr/bin/env bash\nnextflow run nf-core/sarek\n", encoding="utf-8")
    rc = remap_paths.cmd_remap_references("/orig", str(newrefs), dry_run=False, bundle_dir=bundle)
    assert rc == 0
    assert f"fasta: {newrefs.as_posix()}/genome.fa" in (bundle / "params.yaml").read_text()
