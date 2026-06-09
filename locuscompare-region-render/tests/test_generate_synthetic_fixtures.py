"""Unit tests for `examples/01_synthetic_demo/generate_synthetic_fixtures.py`.

Audit gap (PR #272): the synthetic-fixture generator is invoked at fixture-
update time (and silently relied on by the offline synthetic-demo end-to-end
test); here we pin its byte-stable output so a deterministic-RNG regression
is caught.

We run `generate()` in an isolated tmp-path copy (so the real fixtures stay
untouched), then assert:
  - all four expected files exist
  - headers + row counts match the schema the renderer consumes
  - the seeded RNG yields byte-stable output (re-run produces identical bytes)
"""
from __future__ import annotations

import importlib
import importlib.util
import shutil
import sys
from pathlib import Path

import pytest


SKILL_DIR = Path(__file__).resolve().parent.parent
GENERATOR_PATH = SKILL_DIR / "examples" / "01_synthetic_demo" / "generate_synthetic_fixtures.py"


def _load_generator_module(target_dir: Path):
    """Load the generator from a copy in `target_dir` (so it writes there,
    not into the repo's checked-in fixtures)."""
    copy_path = target_dir / "generate_synthetic_fixtures.py"
    shutil.copyfile(GENERATOR_PATH, copy_path)
    spec = importlib.util.spec_from_file_location(
        f"_gen_test_{target_dir.name}", copy_path
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_generator_emits_four_files_with_expected_schema(tmp_path):
    pytest.importorskip("numpy")
    module = _load_generator_module(tmp_path)
    module.generate()

    # Four expected outputs.
    exposure = tmp_path / "exposure.tsv"
    outcome = tmp_path / "outcome.tsv"
    ld = tmp_path / "ld_matrix.tsv"
    genes = tmp_path / "genes.tsv"
    for p in (exposure, outcome, ld, genes):
        assert p.is_file(), f"generator missed {p.name}"

    # Sumstats headers (INPUT_SCHEMA.md required columns).
    expected_sumstats = "variant_id\tchromosome\tposition_bp\tallele_a\tallele_b\tbeta\tse\tp"
    assert exposure.read_text().splitlines()[0] == expected_sumstats
    assert outcome.read_text().splitlines()[0] == expected_sumstats

    # Row counts: header + N_VARIANTS data rows.
    n = module.N_VARIANTS
    assert len(exposure.read_text().splitlines()) == n + 1
    assert len(outcome.read_text().splitlines()) == n + 1

    # LD matrix: two-column shape, lead excluded => N_VARIANTS - 1 partners.
    ld_lines = ld.read_text().splitlines()
    assert ld_lines[0] == "partner_variant_id\tr2"
    assert len(ld_lines) == n  # header + (n - 1) partners

    # Gene track: five-column shape, three synthetic genes.
    gene_lines = genes.read_text().splitlines()
    assert gene_lines[0] == "gene_symbol\tstart\tend\tstrand\tbiotype"
    assert len(gene_lines) == 4
    assert any(line.startswith("DEMOGENE_B") for line in gene_lines[1:])


def test_generator_includes_the_lead_variant_in_both_sumstats(tmp_path):
    pytest.importorskip("numpy")
    module = _load_generator_module(tmp_path)
    module.generate()

    lead_id = f"1_{module.LEAD_POSITION}_{module.LEAD_REF}_{module.LEAD_ALT}"
    for path in (tmp_path / "exposure.tsv", tmp_path / "outcome.tsv"):
        ids = [line.split("\t", 1)[0] for line in path.read_text().splitlines()[1:]]
        assert lead_id in ids, f"{path.name} missing lead variant {lead_id}"


def test_generator_is_deterministic(tmp_path):
    """Seeded RNG -> running the generator twice must yield byte-identical files."""
    pytest.importorskip("numpy")
    first = tmp_path / "first"
    first.mkdir()
    second = tmp_path / "second"
    second.mkdir()

    mod_a = _load_generator_module(first)
    mod_a.generate()
    mod_b = _load_generator_module(second)
    mod_b.generate()

    for name in ("exposure.tsv", "outcome.tsv", "ld_matrix.tsv", "genes.tsv"):
        assert (first / name).read_bytes() == (second / name).read_bytes(), \
            f"{name} differs across runs — RNG seed not deterministic"
