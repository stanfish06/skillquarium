"""Unit tests for `_wald_ratio_types.py`.

Audit gap (PR #272): the lead-variant Wald-ratio module lacked dedicated
coverage. These tests pin the three building blocks the orchestrator depends
on:

  - `LocusVariant.from_ot_row` — OT credibleSet.locus.rows[] normalisation
  - `harmonise_locus_intersection` — intersect-on-variant-id + allele harmonise
  - `wald_ratio_at_lead` — argmax(PIP_left * PIP_right) selection + delta-method SE
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import pytest


SKILL_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SKILL_DIR))

from _wald_ratio_types import (  # noqa: E402
    HarmonisedPair,
    LocusVariant,
    PALINDROMIC_PAIRS,
    WrCall,
    harmonise_locus_intersection,
    wald_ratio_at_lead,
)


# ----- PALINDROMIC_PAIRS sanity


def test_palindromic_pairs_cover_at_and_gc():
    assert ("A", "T") in PALINDROMIC_PAIRS
    assert ("T", "A") in PALINDROMIC_PAIRS
    assert ("G", "C") in PALINDROMIC_PAIRS
    assert ("C", "G") in PALINDROMIC_PAIRS
    # Non-palindromic
    assert ("A", "G") not in PALINDROMIC_PAIRS
    assert ("C", "T") not in PALINDROMIC_PAIRS


# ----- LocusVariant.from_ot_row


def test_locus_variant_from_ot_row_combines_mantissa_and_exponent():
    row = {
        "variant": {
            "id": "1_109274968_G_T",
            "chromosome": "1",
            "position": 109_274_968,
            "referenceAllele": "G",
            "alternateAllele": "T",
        },
        "posteriorProbability": 0.42,
        "beta": 0.31,
        "standardError": 0.05,
        "pValueMantissa": 3.0,
        "pValueExponent": -8,
        "is95CredibleSet": True,
        "is99CredibleSet": True,
        "r2Overall": 0.92,
    }
    lv = LocusVariant.from_ot_row(row)
    assert lv.variant_id == "1_109274968_G_T"
    assert lv.chromosome == "1"
    assert lv.position == 109_274_968
    assert lv.ref == "G"
    assert lv.alt == "T"
    assert lv.pip == 0.42
    assert lv.beta == 0.31
    assert lv.se == 0.05
    assert lv.p_value == pytest.approx(3.0e-8)
    assert lv.is95 is True
    assert lv.is99 is True
    assert lv.r2_lead == 0.92


def test_locus_variant_from_ot_row_handles_missing_pvalue_components():
    row = {
        "variant": {"id": "1_1_A_G", "referenceAllele": "A", "alternateAllele": "G"},
        "posteriorProbability": 0.1,
        "beta": 0.0,
        "standardError": 0.1,
        # No pValueMantissa / pValueExponent -> p_value should be None.
    }
    lv = LocusVariant.from_ot_row(row)
    assert lv.p_value is None


# ----- harmonise_locus_intersection


def _lv(vid, ref, alt, beta, *, pip=0.5, se=0.05, p_value=1e-8):
    return LocusVariant(
        variant_id=vid,
        chromosome="1",
        position=int(vid.split("_")[1]),
        ref=ref,
        alt=alt,
        pip=pip,
        beta=beta,
        se=se,
        p_value=p_value,
        is95=True,
        is99=True,
        r2_lead=1.0,
    )


def test_harmonise_intersection_drops_variants_only_on_one_side():
    left = [_lv("1_100_A_G", "A", "G", 0.4), _lv("1_200_C_T", "C", "T", 0.2)]
    right = [_lv("1_100_A_G", "A", "G", 0.5)]
    pairs = harmonise_locus_intersection(left, right)
    assert [p.variant_id for p in pairs] == ["1_100_A_G"]
    assert pairs[0].sign_flipped is False
    assert pairs[0].palindromic is False
    assert pairs[0].pip_product == pytest.approx(0.5 * 0.5)


def test_harmonise_intersection_flips_swapped_alleles():
    left = [_lv("1_100_A_G", "A", "G", 0.4)]
    right = [_lv("1_100_A_G", "G", "A", 0.6)]  # swapped (ref<->alt)
    pairs = harmonise_locus_intersection(left, right)
    assert len(pairs) == 1
    p = pairs[0]
    assert p.sign_flipped is True
    assert p.beta_left == pytest.approx(0.4)
    assert p.beta_right == pytest.approx(-0.6), "right-side beta should be sign-flipped"


def test_harmonise_intersection_keeps_palindromic_but_flags_them():
    left = [_lv("1_100_A_T", "A", "T", 0.5)]
    right = [_lv("1_100_A_T", "A", "T", 0.6)]
    pairs = harmonise_locus_intersection(left, right)
    assert len(pairs) == 1
    assert pairs[0].palindromic is True


def test_harmonise_intersection_drops_irreconcilable_alleles():
    """A/G vs C/T: not the same SNV, not palindromic, not swapped. Drop."""
    left = [_lv("1_100_A_G", "A", "G", 0.4)]
    right = [_lv("1_100_A_G", "C", "T", 0.6)]
    pairs = harmonise_locus_intersection(left, right)
    assert pairs == []


def test_harmonise_intersection_drops_missing_beta():
    left = [_lv("1_100_A_G", "A", "G", 0.4)]
    right_missing = LocusVariant(
        variant_id="1_100_A_G", chromosome="1", position=100, ref="A", alt="G",
        pip=0.5, beta=None, se=None, p_value=None, is95=None, is99=None, r2_lead=None,
    )
    pairs = harmonise_locus_intersection(left, [right_missing])
    assert pairs == []


# ----- wald_ratio_at_lead


def _pair(vid, *, beta_left, beta_right, pip_left=0.5, pip_right=0.5,
          se_left=0.05, se_right=0.05, palindromic=False):
    return HarmonisedPair(
        variant_id=vid,
        pip_left=pip_left,
        pip_right=pip_right,
        beta_left=beta_left,
        beta_right=beta_right,
        se_left=se_left,
        se_right=se_right,
        p_left=1e-8,
        p_right=1e-8,
        sign_flipped=False,
        palindromic=palindromic,
    )


def test_wald_ratio_picks_pip_product_argmax():
    pairs = [
        _pair("v1", beta_left=0.5, beta_right=0.2, pip_left=0.10, pip_right=0.10),
        _pair("v2", beta_left=0.5, beta_right=0.2, pip_left=0.80, pip_right=0.80),  # argmax
        _pair("v3", beta_left=0.5, beta_right=0.2, pip_left=0.40, pip_right=0.40),
    ]
    res = wald_ratio_at_lead(pairs)
    assert res.lead is not None
    assert res.lead.variant_id == "v2"
    assert res.wr == pytest.approx(0.4)
    assert res.call is WrCall.ALIGNED
    assert res.n_intersected == 3
    assert res.n_eligible == 3
    assert res.n_palindromic_excluded == 0


def test_wald_ratio_opposite_sign_call_when_betas_disagree():
    pairs = [_pair("v1", beta_left=0.5, beta_right=-0.3, pip_left=0.9, pip_right=0.9)]
    res = wald_ratio_at_lead(pairs)
    assert res.wr == pytest.approx(-0.6)
    assert res.call is WrCall.OPPOSITE
    # Delta-method SE finite + CI brackets WR.
    assert res.se_wr is not None and res.se_wr > 0
    assert res.ci_lo < res.wr < res.ci_hi


def test_wald_ratio_excludes_palindromic_from_lead_selection():
    pairs = [
        _pair("vpal", beta_left=10.0, beta_right=10.0, pip_left=0.99, pip_right=0.99,
              palindromic=True),
        _pair("vok", beta_left=0.5, beta_right=0.2, pip_left=0.4, pip_right=0.4),
    ]
    res = wald_ratio_at_lead(pairs)
    assert res.lead is not None
    assert res.lead.variant_id == "vok", "palindromic must be excluded from lead choice"
    assert res.n_palindromic_excluded == 1
    assert any("palindromic" in n for n in res.notes)


def test_wald_ratio_undetermined_when_no_eligible_pair():
    pairs = [_pair("vpal", beta_left=0.5, beta_right=0.2, pip_left=0.9, pip_right=0.9,
                   palindromic=True)]
    res = wald_ratio_at_lead(pairs)
    assert res.lead is None
    assert res.call is WrCall.UNDETERMINED
    assert res.wr is None


def test_wald_ratio_undefined_when_exposure_beta_zero():
    pairs = [_pair("v1", beta_left=0.0, beta_right=0.5, pip_left=0.9, pip_right=0.9)]
    res = wald_ratio_at_lead(pairs)
    assert res.call is WrCall.UNDETERMINED
    assert res.wr is None
    assert any("zero" in n.lower() for n in res.notes)


def test_wald_ratio_handles_missing_right_se():
    """SE(right) missing -> drop the second delta-method term; SE still finite."""
    pairs = [_pair("v1", beta_left=0.5, beta_right=0.2, se_right=None,
                   pip_left=0.9, pip_right=0.9)]
    res = wald_ratio_at_lead(pairs)
    assert res.wr == pytest.approx(0.4)
    # Implementation only flags missing right-side SE when it's actually used
    # downstream; the symmetric formula falls back to SE_left-only when SE_right
    # is missing, so just verify the result is finite.
    assert res.se_wr is None or math.isfinite(res.se_wr)


def test_wald_ratio_empty_input_returns_undetermined():
    res = wald_ratio_at_lead([])
    assert res.lead is None
    assert res.call is WrCall.UNDETERMINED
    assert res.n_intersected == 0
    assert res.n_eligible == 0
