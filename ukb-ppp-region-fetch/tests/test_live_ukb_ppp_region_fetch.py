"""Live smoke test for the UKB-PPP region-fetch skill.

Hits the real Synapse listing endpoint + (optionally) the authenticated
download path to fetch a small SORT1-locus window from UKB-PPP. Gated by
@pytest.mark.live + RUN_LIVE_TESTS=1 + SYNAPSE_AUTH_TOKEN.

The listing-only smoke is auth-free and verifies the index build still
resolves SORT1; the full fetch smoke additionally requires a Synapse PAT
(free; no UKB Application needed for the summary-stats layer per Sun 2023
data release notes).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

# Inject the skill dir so the bare-name `ukb_ppp_region_fetch` resolves
# under ClawBio's kebab-cased skill directory.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ukb_ppp_region_fetch import (  # noqa: E402
    RegionResult,
    SynapseListFetcher,
    UKBPPPClient,
)
from ukb_ppp_region_fetch import _ProteinIndex  # noqa: E402


pytestmark = pytest.mark.live


@pytest.mark.skipif(
    os.getenv("RUN_LIVE_TESTS") != "1",
    reason="live tests gated on RUN_LIVE_TESTS=1",
)
def test_live_listing_finds_sort1_eur() -> None:
    """Auth-free Synapse listing: SORT1 is in the EUR (discovery) folder.

    Verifies: the Synapse REST listing endpoint is reachable and the
    file-name regex still matches the canonical SORT1 archive. Does NOT
    download any data; safe to run on CI without a PAT.
    """
    lister = SynapseListFetcher()
    idx = _ProteinIndex(lister, "EUR")
    rec = idx.resolve("SORT1")
    assert rec["hgnc"] == "SORT1"
    assert rec["uniprot"] == "Q99523"
    assert rec["olink_id"].startswith("OID")
    assert rec["synapse_id"].startswith("syn")


@pytest.mark.skipif(
    os.getenv("RUN_LIVE_TESTS") != "1" or not os.getenv("SYNAPSE_AUTH_TOKEN"),
    reason="live download smoke needs RUN_LIVE_TESTS=1 + SYNAPSE_AUTH_TOKEN",
)
def test_live_fetch_region_sort1_eur_smoke() -> None:
    """Authenticated: SORT1 cis-pQTL in plasma (EUR discovery), ±500 bp
    around the canonical 1p13.3 lead variant (rs12740374; chr1:109274968).

    Verifies the full pipeline: protein resolution -> tar download ->
    per-chromosome extraction -> region filter -> harmonised output.
    Magnitude / value checks belong in a separate golden-parity layer,
    not in this live smoke.
    """
    client = UKBPPPClient()
    result = client.fetch_region(
        protein_label="SORT1",
        ancestry="EUR",
        chromosome="1",
        start_bp=109_274_000,
        end_bp=109_275_000,
    )
    assert isinstance(result, RegionResult)
    assert result.variants, "expected non-empty UKB-PPP slice around rs12740374"
    v = result.variants[0]
    assert v.chromosome == "1"
    assert 109_274_000 <= v.position <= 109_275_000
    assert result.release.protein_hgnc == "SORT1"
    assert result.release.ancestry == "EUR"
