"""Live smoke test for ld-1000g-region-compute.

Invokes plink 1.9 against the public 1000 Genomes Phase 3 GRCh38
distribution (tabix-fetched on demand from EBI 1000G FTP) for a tiny
SORT1-window LD computation. Gated by @pytest.mark.live + RUN_LIVE_TESTS=1,
and additionally skipped when plink isn't on PATH (the binary is GPL-3 and
not packaged via pip; reviewers install via brew / apt / conda).

Env var override:
    PLINK_BIN     absolute path to plink binary (default: `plink` on PATH)

Run with:
    RUN_LIVE_TESTS=1 pytest skills/ld-1000g-region-compute/tests/test_live_ld_1000g_region_compute.py
"""
from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

import pytest


sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ondemand_client import (  # noqa: E402
    OnDemand1000GLDClient,
    OnDemandLDResult,
)


pytestmark = pytest.mark.live


def _plink_bin() -> str | None:
    explicit = os.getenv("PLINK_BIN")
    if explicit and os.path.isfile(explicit):
        return explicit
    return shutil.which("plink")


@pytest.mark.skipif(
    os.getenv("RUN_LIVE_TESTS") != "1",
    reason="live tests gated on RUN_LIVE_TESTS=1",
)
@pytest.mark.skipif(
    _plink_bin() is None,
    reason="plink not on PATH and PLINK_BIN not set",
)
def test_live_r2_with_lead_sort1_smoke() -> None:
    """Real plink subprocess: SORT1 lead vs a small partner set in EUR."""
    client = OnDemand1000GLDClient(
        super_pop="EUR",
        plink_bin=_plink_bin(),
    )
    lead = "1_109817590_G_T"
    partners = ["1_109817192_G_A", "1_109817838_T_C"]
    result = client.r2_with_lead(
        lead=lead,
        partners=partners,
        chromosome="1",
        window_bp=200_000,
    )
    assert isinstance(result, OnDemandLDResult)
    # r² for the lead vs itself is 1.0 by definition; partners get a value in
    # [0, 1] if present in 1000G, NaN otherwise. Shape-only check here;
    # magnitude checks live in golden parity fixtures.
    assert len(result.pairs) >= 1
