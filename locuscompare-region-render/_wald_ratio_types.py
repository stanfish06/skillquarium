"""Lead-variant Wald-ratio knowledge skill.

Computes the single-instrument Wald-ratio Mendelian-randomization estimate at
the eCAVIAR-like colocalising lead variant of a coloc pair, plus the diagnostic
data needed to draw a per-pair scatter (β_eqtl vs β_gwas).

Background:
- OT's `Colocalisation.betaRatioSignAverage` is sign-only; magnitude is NOT the
  Wald-ratio estimate.
- The credible-set lead variants on each side are typically DIFFERENT variants
  (lead-of-CS ≠ shared causal variant). Sign-comparing lead-vs-lead betas is
  meaningless — we must intersect locus members and pick a shared-variant lead.
- We pick the lead as `argmax(PIP_left × PIP_right)` over the intersection of
  the two credible-set loci. Rationale: this is the single variant most likely
  to be causal in BOTH studies (the eCAVIAR CLPP construction; Hormozdiari 2016).

Wald-ratio (Wald 1940):
    WR = β_outcome / β_exposure
    SE(WR) ≈ |β_outcome / β_exposure| × √( (SE_outcome/β_outcome)² + (SE_exposure/β_exposure)² )
                     (delta method on the log-ratio; symmetric in the two
                     uncertainties; degenerates to SE_out/|β_exp| when SE_exp ≪ β_exp)

Allele-harmonization caveat:
- OT exposes per-variant `referenceAllele` + `alternateAllele` on each side.
  Identical (ref, alt) on both sides → no flip needed (effect-allele is ALT in
  both). Strand-flipped or swapped alleles → caller must flip the sign of one
  side's beta. Palindromic SNPs (A/T or G/C) cannot be unambiguously
  harmonised without EAF — flag and exclude.

Inputs:
- left_locus  : list[OT locus row dict] — credible set L (the gene/exposure side)
- right_locus : list[OT locus row dict] — credible set R (the disease/outcome side)

Outputs:
- WaldRatioResult — lead variant, harmonized betas, WR + SE + 95% CI + sign call.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

PALINDROMIC_PAIRS: frozenset[tuple[str, str]] = frozenset(
    {("A", "T"), ("T", "A"), ("G", "C"), ("C", "G")}
)


class WrCall(str, Enum):
    """Sign call for the lead-variant Wald-ratio. Mirrors DoeCall but is
    derived from a SINGLE variant's harmonized betas — orthogonal to OT's
    intersection-mean `betaRatioSignAverage`.
    """

    ALIGNED = "aligned"           # WR > 0 → β_out and β_exp same sign
    OPPOSITE = "opposite"         # WR < 0 → β_out and β_exp opposite sign
    UNDETERMINED = "undetermined" # missing β/SE on either side, no intersection, etc.


@dataclass
class LocusVariant:
    """Per-variant locus row, normalized from OT's `credibleSet.locus.rows[]`."""

    variant_id: str
    chromosome: str | None
    position: int | None
    ref: str | None
    alt: str | None
    pip: float | None             # OT.posteriorProbability
    beta: float | None
    se: float | None
    p_value: float | None         # combined from pValueMantissa × 10^pValueExponent
    is95: bool | None
    is99: bool | None
    r2_lead: float | None         # OT.r2Overall (LD with credible-set lead)

    @classmethod
    def from_ot_row(cls, row: dict[str, Any]) -> "LocusVariant":
        v = row.get("variant") or {}
        mant = row.get("pValueMantissa")
        exp = row.get("pValueExponent")
        p_value: float | None
        if mant is None or exp is None:
            p_value = None
        else:
            p_value = mant * (10 ** exp)
        return cls(
            variant_id=v.get("id"),
            chromosome=v.get("chromosome"),
            position=v.get("position"),
            ref=v.get("referenceAllele"),
            alt=v.get("alternateAllele"),
            pip=row.get("posteriorProbability"),
            beta=row.get("beta"),
            se=row.get("standardError"),
            p_value=p_value,
            is95=row.get("is95CredibleSet"),
            is99=row.get("is99CredibleSet"),
            r2_lead=row.get("r2Overall"),
        )


@dataclass
class HarmonisedPair:
    """A single intersected variant after allele-harmonisation."""

    variant_id: str
    pip_left: float
    pip_right: float
    beta_left: float
    beta_right: float
    se_left: float | None
    se_right: float | None
    p_left: float | None
    p_right: float | None
    sign_flipped: bool            # True if right side was flipped to align effect alleles
    palindromic: bool             # True if (ref, alt) is A/T or G/C — flagged + excluded
    pip_product: float = 0.0      # PIP_left × PIP_right; eCAVIAR-like CLPP

    def __post_init__(self) -> None:
        self.pip_product = (self.pip_left or 0.0) * (self.pip_right or 0.0)


@dataclass
class WaldRatioResult:
    """Lead-variant Wald-ratio + diagnostic substrate for the scatter."""

    lead: HarmonisedPair | None
    wr: float | None
    se_wr: float | None
    ci_lo: float | None
    ci_hi: float | None
    call: WrCall
    n_intersected: int            # how many shared variants survived intersection
    n_eligible: int               # how many of those had β + SE on both sides (and were not palindromic)
    n_palindromic_excluded: int   # ambiguous-strand SNPs dropped per Hemani 2018 convention
    notes: list[str] = field(default_factory=list)
    pairs: list[HarmonisedPair] = field(default_factory=list)


def _harmonise_one(
    l: LocusVariant, r: LocusVariant
) -> HarmonisedPair | None:
    """Allele-harmonise a single intersected variant.

    Returns None if either side is missing β, or if palindromic (per Hemani
    2018 — drop A/T and G/C SNPs without EAF info).
    Sign-flips the right-side β when alleles are swapped (ref↔alt) on R.
    """
    if l.beta is None or r.beta is None:
        return None
    # Reject if any allele is missing — can't harmonise.
    if not (l.ref and l.alt and r.ref and r.alt):
        return None

    # Palindromic exclusion (A/T, G/C; ambiguous strand).
    if (l.ref.upper(), l.alt.upper()) in PALINDROMIC_PAIRS:
        return HarmonisedPair(
            variant_id=l.variant_id,
            pip_left=l.pip or 0.0,
            pip_right=r.pip or 0.0,
            beta_left=l.beta,
            beta_right=r.beta,
            se_left=l.se,
            se_right=r.se,
            p_left=l.p_value,
            p_right=r.p_value,
            sign_flipped=False,
            palindromic=True,
        )

    sign_flipped = False
    beta_right = r.beta
    if (l.ref.upper(), l.alt.upper()) == (r.ref.upper(), r.alt.upper()):
        # Identical (ref, alt) — no harmonisation needed.
        pass
    elif (l.ref.upper(), l.alt.upper()) == (r.alt.upper(), r.ref.upper()):
        # Swapped alleles — flip right-side beta so both sides are ALT-effect.
        beta_right = -r.beta
        sign_flipped = True
    else:
        # Different alleles entirely (e.g., multi-allelic, strand-flip without
        # palindrome detection, or upstream pipeline mismatch). Caller must
        # decide — surface as a non-harmonisable pair.
        return None

    return HarmonisedPair(
        variant_id=l.variant_id,
        pip_left=l.pip or 0.0,
        pip_right=r.pip or 0.0,
        beta_left=l.beta,
        beta_right=beta_right,
        se_left=l.se,
        se_right=r.se,
        p_left=l.p_value,
        p_right=r.p_value,
        sign_flipped=sign_flipped,
        palindromic=False,
    )


def harmonise_locus_intersection(
    left_locus: list[LocusVariant],
    right_locus: list[LocusVariant],
) -> list[HarmonisedPair]:
    """Intersect two credible-set locus tables on variant_id and harmonise alleles.

    Drops variants present on only one side, missing β on either side, or with
    irreconcilable allele encodings. Palindromic SNPs are KEPT in the returned
    list with `palindromic=True` so the caller can audit; `wald_ratio_at_lead`
    excludes them from the lead-selection.
    """
    by_id_right = {v.variant_id: v for v in right_locus if v.variant_id}
    pairs: list[HarmonisedPair] = []
    for l in left_locus:
        if not l.variant_id:
            continue
        r = by_id_right.get(l.variant_id)
        if r is None:
            continue
        pair = _harmonise_one(l, r)
        if pair is not None:
            pairs.append(pair)
    return pairs


def _delta_se(beta_out: float, beta_exp: float, se_out: float | None, se_exp: float | None) -> float | None:
    """Symmetric delta-method SE for the log-ratio:
        SE(WR) ≈ |WR| × √((SE_out/β_out)² + (SE_exp/β_exp)²)

    Falls back to SE_out / |β_exp| when SE_exp is missing (the simpler
    approximation; still informative when SE_exp ≪ β_exp).
    Returns None if the SE we'd need is missing entirely.
    """
    if beta_exp == 0:
        return None
    if se_out is None:
        return None
    if beta_out == 0:
        # WR = 0; floor SE to SE_out / |β_exp|.
        return abs(se_out / beta_exp)
    wr = beta_out / beta_exp
    term_out = (se_out / beta_out) ** 2
    if se_exp is None:
        # Approximation: SE_exp ≪ β_exp → drop the second term.
        term_exp = 0.0
    else:
        term_exp = (se_exp / beta_exp) ** 2
    return abs(wr) * math.sqrt(term_out + term_exp)


def wald_ratio_at_lead(
    pairs: list[HarmonisedPair],
) -> WaldRatioResult:
    """Pick lead = argmax(PIP_left × PIP_right) over harmonised pairs and
    compute WR = β_right / β_left at that variant.

    The lead-selection is restricted to non-palindromic pairs with both betas
    AND both PIPs available. If no pair survives, returns WrCall.UNDETERMINED.
    """
    n_intersected = len(pairs)
    n_palindromic = sum(1 for p in pairs if p.palindromic)
    eligible = [
        p for p in pairs
        if not p.palindromic
        and p.beta_left is not None
        and p.beta_right is not None
        and p.pip_left is not None
        and p.pip_right is not None
    ]
    n_eligible = len(eligible)

    notes: list[str] = []
    if n_palindromic:
        notes.append(
            f"excluded {n_palindromic} palindromic (A/T or G/C) variant(s) from lead selection"
        )

    if n_eligible == 0:
        return WaldRatioResult(
            lead=None,
            wr=None,
            se_wr=None,
            ci_lo=None,
            ci_hi=None,
            call=WrCall.UNDETERMINED,
            n_intersected=n_intersected,
            n_eligible=0,
            n_palindromic_excluded=n_palindromic,
            notes=notes + [
                "no eligible intersected variant with PIPs + betas on both sides",
            ],
            pairs=pairs,
        )

    lead = max(eligible, key=lambda p: p.pip_product)

    if lead.beta_left == 0:
        notes.append("β_exposure (left) is zero at lead — Wald ratio undefined")
        return WaldRatioResult(
            lead=lead,
            wr=None,
            se_wr=None,
            ci_lo=None,
            ci_hi=None,
            call=WrCall.UNDETERMINED,
            n_intersected=n_intersected,
            n_eligible=n_eligible,
            n_palindromic_excluded=n_palindromic,
            notes=notes,
            pairs=pairs,
        )

    wr = lead.beta_right / lead.beta_left
    se = _delta_se(lead.beta_right, lead.beta_left, lead.se_right, lead.se_left)
    ci_lo: float | None = None
    ci_hi: float | None = None
    if se is not None:
        ci_lo = wr - 1.96 * se
        ci_hi = wr + 1.96 * se
    if wr > 0:
        call = WrCall.ALIGNED
    elif wr < 0:
        call = WrCall.OPPOSITE
    else:
        call = WrCall.UNDETERMINED

    if lead.sign_flipped:
        notes.append(f"lead variant {lead.variant_id}: right-side β flipped during allele harmonisation")
    if lead.se_right is None:
        notes.append("right-side SE missing at lead — WR SE could not be computed")

    return WaldRatioResult(
        lead=lead,
        wr=wr,
        se_wr=se,
        ci_lo=ci_lo,
        ci_hi=ci_hi,
        call=call,
        n_intersected=n_intersected,
        n_eligible=n_eligible,
        n_palindromic_excluded=n_palindromic,
        notes=notes,
        pairs=pairs,
    )


__all__ = [
    "HarmonisedPair",
    "LocusVariant",
    "PALINDROMIC_PAIRS",
    "WaldRatioResult",
    "WrCall",
    "harmonise_locus_intersection",
    "wald_ratio_at_lead",
]
