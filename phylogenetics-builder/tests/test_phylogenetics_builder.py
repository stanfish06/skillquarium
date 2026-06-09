"""
Tests for phylogenetics_builder.py
Red/Green TDD: These tests will fail (Red) until the implementation is complete.
"""

import json
import re
import subprocess
import sys
from pathlib import Path
from importlib.util import spec_from_file_location, module_from_spec
import pytest

SKILL_DIR = Path(__file__).resolve().parents[1]
SCRIPT = SKILL_DIR / "phylogenetics_builder.py"
DEMO_INPUT = SKILL_DIR / "demo_alignment.fasta"


def get_module():
    """Dynamically load phylogenetics_builder.py module for testing functions."""
    if not SCRIPT.exists():
        raise ImportError(f"Script {SCRIPT} does not exist yet.")
    spec = spec_from_file_location("phylogenetics_builder", SCRIPT)
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def run_cli(args, **kwargs):
    """Run the CLI tool as a subprocess."""
    return subprocess.run(
        [sys.executable, str(SCRIPT)] + args,
        capture_output=True,
        text=True,
        **kwargs,
    )


class TestCLI:
    """CLI execution tests."""

    def test_missing_input_returns_error(self, tmp_path):
        result = run_cli(["--input", str(tmp_path / "nonexistent.fasta"), "--output", str(tmp_path)])
        assert result.returncode != 0

    def test_demo_mode_creates_outputs(self, tmp_path):
        result = run_cli(["--demo", "--output", str(tmp_path)])
        assert result.returncode == 0, f"stderr: {result.stderr}"
        assert (tmp_path / "report.md").exists()
        assert (tmp_path / "result.json").exists()
        assert (tmp_path / "phylo_tree.nwk").exists()
        # Verify Matplotlib figure output if Bio.Phylo / matplotlib is installed
        # figures/phylogram.png
        assert (tmp_path / "figures" / "phylogram.png").exists()

    def test_demo_mode_no_iqtree_needed(self, tmp_path, monkeypatch):
        # Remove iqtree from PATH to simulate absence of iqtree
        monkeypatch.setenv("PATH", "")
        result = run_cli(["--demo", "--output", str(tmp_path)])
        assert result.returncode == 0, f"stderr: {result.stderr}"
        assert (tmp_path / "report.md").exists()
        assert (tmp_path / "result.json").exists()
        assert (tmp_path / "phylo_tree.nwk").exists()


class TestUnitFunctions:
    """Unit tests for the functions inside phylogenetics_builder.py."""

    def test_parse_fasta_valid(self, tmp_path):
        fasta_content = (
            ">seq1\nACGTACGT\n"
            ">seq2\nACGTTCGT\n"
            ">seq3\nACGTACGT\n"
        )
        fasta_file = tmp_path / "valid.fasta"
        fasta_file.write_text(fasta_content)

        module = get_module()
        parsed = module.parse_fasta(fasta_file)
        assert len(parsed) == 3
        assert parsed["seq1"] == "ACGTACGT"
        assert parsed["seq2"] == "ACGTTCGT"

    def test_parse_fasta_unequal_lengths(self, tmp_path):
        fasta_content = (
            ">seq1\nACGTACG\n"  # 7 bp
            ">seq2\nACGTTCGT\n"  # 8 bp
            ">seq3\nACGTACGT\n"
        )
        fasta_file = tmp_path / "unequal.fasta"
        fasta_file.write_text(fasta_content)

        module = get_module()
        with pytest.raises(ValueError, match="same length"):
            module.parse_fasta(fasta_file)

    def test_parse_fasta_too_few_sequences(self, tmp_path):
        fasta_content = (
            ">seq1\nACGTACGT\n"
            ">seq2\nACGTTCGT\n"
        )
        fasta_file = tmp_path / "few.fasta"
        fasta_file.write_text(fasta_content)

        module = get_module()
        with pytest.raises(ValueError, match="at least 3"):
            module.parse_fasta(fasta_file)

    def test_parse_fasta_empty_header(self, tmp_path):
        fasta_content = (
            ">seq1\nACGTACGT\n"
            ">\nACGTTCGT\n"
            ">seq3\nACGTACGT\n"
        )
        fasta_file = tmp_path / "empty_header.fasta"
        fasta_file.write_text(fasta_content)

        module = get_module()
        with pytest.raises(ValueError, match="Empty sequence header"):
            module.parse_fasta(fasta_file)

    def test_parse_fasta_duplicate_header(self, tmp_path):
        fasta_content = (
            ">seq1\nACGTACGT\n"
            ">seq1\nACGTTCGT\n"
            ">seq3\nACGTACGT\n"
        )
        fasta_file = tmp_path / "duplicate_header.fasta"
        fasta_file.write_text(fasta_content)

        module = get_module()
        with pytest.raises(ValueError, match="Duplicate sequence header"):
            module.parse_fasta(fasta_file)

    def test_newick_to_table(self):
        newick = "(Homo_sapiens_demo:0.02,Pan_troglodytes_demo:0.03)100:0.05;"
        module = get_module()
        table = module.newick_to_table(newick)
        assert len(table) > 0
        # Check that we parsed the node labels or support values
        assert any(row["support"] == 100 for row in table)

    def test_result_json_keys(self, tmp_path):
        run_cli(["--demo", "--output", str(tmp_path)])
        result_file = tmp_path / "result.json"
        assert result_file.exists()
        data = json.loads(result_file.read_text())
        assert "tool" in data
        assert "model" in data
        assert "tree" in data
        assert "num_taxa" in data
        assert data["tool"] == "iqtree"

    def test_disclaimer_in_report(self, tmp_path):
        run_cli(["--demo", "--output", str(tmp_path)])
        report_content = (tmp_path / "report.md").read_text()
        assert "not a medical device" in report_content.lower()


# Output Contract validation
def _parse_output_contract(skill_md):
    """Extract files promised in the SKILL.md '## Output Structure' tree."""
    if not skill_md.exists():
        return []
    text = skill_md.read_text()
    m = re.search(r"##\s*Output Structure\s*\n+```[^\n]*\n(.*?)\n```", text, re.S)
    if not m:
        return []
    files = []
    parents = {}
    for raw in m.group(1).splitlines():
        if not raw.strip():
            continue
        parts = re.split(r"\s+#", raw, maxsplit=1)
        entry, comment = parts[0], (parts[1] if len(parts) > 1 else "")
        mm = re.match(r"^([\s│├└─]*)(.*)$", entry)
        prefix, name = mm.group(1), mm.group(2).strip()
        if not name:
            continue
        depth = len(prefix) // 4
        if depth == 0:
            continue  # the root output_directory/ line
        if name.endswith("/"):
            parents[depth] = name.rstrip("/")
            for d in [k for k in parents if k > depth]:
                del parents[d]
            continue
        if "optional" in comment.lower():
            continue
        rel = "/".join(parents[d] for d in sorted(parents) if d < depth)
        files.append(rel + "/" + name if rel else name)
    return files


class TestOutputContract:
    """Every artifact promised in SKILL.md '## Output Structure' must be produced."""

    def test_documented_outputs_are_produced(self, tmp_path):
        promised = _parse_output_contract(SKILL_DIR / "SKILL.md")
        if not promised:
            pytest.skip("No parseable '## Output Structure' section in SKILL.md")
        result = run_cli(["--demo", "--output", str(tmp_path)])
        assert result.returncode == 0, f"demo run failed: {result.stderr}"
        missing = [p for p in promised if not (tmp_path / p).exists()]
        assert not missing, (
            "SKILL.md Output Structure promises artifacts the skill did not "
            "produce: " + ", ".join(missing) + ". Write them, mark them "
            "'(optional)' in the SKILL.md tree, or remove them from the "
            "documented Output Structure."
        )
