"""Live smoke test for locuscompare-region-render.

Exercises the renderer's matplotlib + filesystem pipeline by drawing a
LocusZoom-style gene track for SORT1 (1p13.3, the canonical LDL/CHD
locus per Musunuru 2010) on a synthetic axes, then writes the figure
to disk. The "live" dimension here is that the rendering pipeline
runs end-to-end through the installed scientific-Python stack
(matplotlib backend + file I/O).

For a full 4-panel end-to-end render that pulls real sumstats from
eQTL Catalogue + GWAS Catalog + 1000G LD + GENCODE, use the demos
under examples/02_eqtl_catalogue_x_gwas_catalog/ (requires the
sibling fetcher skills to be on the same checkout).

Run with:
    RUN_LIVE_TESTS=1 pytest skills/locuscompare-region-render/tests/test_live_locuscompare_region_render.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest


SKILL_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SKILL_DIR))

from regional_plot import GeneTrackEntry, render_gene_track  # noqa: E402


pytestmark = pytest.mark.live


@pytest.mark.skipif(
    os.getenv("RUN_LIVE_TESTS") != "1",
    reason="live tests gated on RUN_LIVE_TESTS=1",
)
def test_live_render_gene_track_sort1_smoke(tmp_path: Path) -> None:
    """One-gene gene-track at the SORT1 locus renders to a non-zero PNG."""
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    sort1 = GeneTrackEntry(
        gene_symbol="SORT1",
        start=109_817_590,
        end=109_900_000,
        strand="+",
        exons=[(109_817_590, 109_817_838), (109_850_000, 109_851_000)],
        biotype="protein_coding",
    )
    fig, ax = plt.subplots(figsize=(8, 1.5))
    render_gene_track(
        ax,
        genes=[sort1],
        xlim_bp=(109_700_000, 109_900_000),
        lead_position=109_817_590,
        track_label="Genes (GENCODE v39, synthetic test)",
    )
    out = tmp_path / "sort1_gene_track.png"
    fig.savefig(out)
    plt.close(fig)
    assert out.is_file()
    assert out.stat().st_size > 0
