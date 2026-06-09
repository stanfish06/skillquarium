"""
test_bioqc_mcp.py — Tests for the BioQC MCP skill
==================================================
All tests run offline. Tests confirm metadata, stubs,
reproducibility bundle, and custom chart generation.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
import yaml

SKILL_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SKILL_DIR))

import bioqc_mcp  # noqa: E402


def test_frontmatter_loads():
    """Verify that SKILL.md has valid frontmatter."""
    skill_md = SKILL_DIR / "SKILL.md"
    assert skill_md.exists()
    content = skill_md.read_text(encoding='utf-8')
    assert content.startswith("---")
    parts = content.split("---", 2)
    meta = yaml.safe_load(parts[1])
    assert meta["name"] == "bioqc-mcp"
    assert "metadata" in meta
    assert "openclaw" in meta["metadata"]
    assert len(meta["metadata"]["openclaw"]["trigger_keywords"]) >= 3


def test_fastq_file_finder(tmp_path):
    """find_fastq_files scans and retrieves all fastq formats."""
    # Write empty files
    (tmp_path / "read1.fastq").write_text("")
    (tmp_path / "read2.fastq.gz").write_text("")
    (tmp_path / "other.txt").write_text("")

    files = bioqc_mcp.find_fastq_files(str(tmp_path))
    assert len(files) == 2
    assert files[0]["name"] == "read1.fastq"
    assert files[1]["name"] == "read2.fastq.gz"


def test_parse_fastqc_data(tmp_path):
    """parse_fastqc_data correctly extracts metrics from summary and data files."""
    (tmp_path / "summary.txt").write_text("PASS\tBasic Statistics\tfile.fastq\nFAIL\tAdapter Content\tfile.fastq\n")
    (tmp_path / "fastqc_data.txt").write_text("##FastQC\n>>Basic Statistics\tpass\n#Measure\tValue\nTotal Sequences\t1000\n%GC\t48\n>>END_MODULE\n")

    res = bioqc_mcp.parse_fastqc_data(str(tmp_path))
    assert res["success"] is True
    assert res["summary"]["Basic Statistics"] == "PASS"
    assert res["summary"]["Adapter Content"] == "FAIL"
    assert res["metrics"]["Total Sequences"] == "1000"
    assert res["metrics"]["%GC"] == "48"


def test_write_repro_bundle(tmp_path):
    """write_repro_bundle successfully creates three reproducibility files."""
    out = tmp_path / "run"
    out.mkdir()
    (out / "report.md").write_text("# mock\n")
    (out / "multiqc_output").mkdir()
    (out / "multiqc_output" / "multiqc_report.html").write_text("<html></html>")

    bioqc_mcp.write_repro_bundle(out, is_demo=True, input_dir=None)

    repro = out / "reproducibility"
    assert (repro / "commands.sh").exists()
    assert (repro / "environment.yml").exists()
    assert (repro / "checksums.sha256").exists()
    
    cmd_text = (repro / "commands.sh").read_text()
    assert "skills/bioqc-mcp/bioqc_mcp.py" in cmd_text
    assert "--demo" in cmd_text


def test_demo_fastq_generation(tmp_path):
    """make_demo_fastq_and_fastqc successfully scaffolds stubs for SAMPLE_01 & 02."""
    reports = bioqc_mcp.make_demo_fastq_and_fastqc(tmp_path)
    assert len(reports) == 2
    for r in reports:
        assert r.exists()
        assert (r.parent / "summary.txt").exists()
        assert (r.parent / "fastqc_data.txt").exists()


def test_generate_chart_from_data():
    """generate_chart_from_data successfully renders line and bar charts."""
    if not bioqc_mcp.HAS_VIZ:
        pytest.skip("Visualization packages are missing")

    data = [
        {"pos": 1, "val": 35},
        {"pos": 2, "val": 36},
        {"pos": 3, "val": 34}
    ]
    res = bioqc_mcp.generate_chart_from_data("line", data, "Test Line Chart", "Pos", "Val")
    assert res["success"] is True
    assert res["mime_type"] == "image/png"
    assert len(res["image_data"]) > 100
