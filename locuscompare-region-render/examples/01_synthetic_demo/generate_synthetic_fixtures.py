"""Deterministic generator for 01_synthetic_demo's TSV fixtures.

Produces the four files referenced by `config.json`:
  exposure.tsv, outcome.tsv, ld_matrix.tsv, genes.tsv

The output is byte-stable across runs (fixed RNG seed) so the rendered PNG
can serve as a golden-parity smoke check. Re-run after editing this script;
do not hand-edit the TSVs.

Usage:
    python generate_synthetic_fixtures.py
"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent

SEED = 20260524
N_VARIANTS = 200
LEAD_POSITION = 500_000
WINDOW_START = 1
WINDOW_END = 1_000_000
LEAD_REF, LEAD_ALT = "A", "T"

BETA_LEAD_EXPOSURE = 0.500
BETA_LEAD_OUTCOME = 0.400
SE_BASE = 0.05

LD_DECAY_BP = 50_000


def _norm_sf(z: float) -> float:
    """Two-sided p-value from a z-score using math.erfc (no scipy dependency)."""
    return math.erfc(abs(z) / math.sqrt(2.0))


def _allele_pair(rng: np.random.Generator) -> tuple[str, str]:
    """Random non-palindromic SNV (ref, alt)."""
    bases = ("A", "C", "G", "T")
    palindromes = {("A", "T"), ("T", "A"), ("C", "G"), ("G", "C")}
    while True:
        a, b = rng.choice(bases, size=2, replace=False)
        if (a, b) not in palindromes:
            return str(a), str(b)


def generate() -> None:
    rng = np.random.default_rng(SEED)

    # Variant positions: lead at 500_000 + 199 others spread across window.
    other_positions = rng.integers(WINDOW_START, WINDOW_END + 1, size=N_VARIANTS - 1)
    other_positions = np.sort(np.unique(other_positions))
    while len(other_positions) < N_VARIANTS - 1:
        extras = rng.integers(WINDOW_START, WINDOW_END + 1, size=N_VARIANTS - 1 - len(other_positions))
        other_positions = np.sort(np.unique(np.concatenate([other_positions, extras])))
    other_positions = other_positions[: N_VARIANTS - 1]
    # Make sure the lead position is not duplicated.
    other_positions = other_positions[other_positions != LEAD_POSITION]

    positions = np.concatenate([[LEAD_POSITION], other_positions])
    sorted_idx = np.argsort(positions)
    positions = positions[sorted_idx]

    # Allele pairs per variant (non-palindromic so the harmoniser does not
    # exclude every row).
    allele_pairs: list[tuple[str, str]] = []
    for pos in positions:
        if pos == LEAD_POSITION:
            allele_pairs.append((LEAD_REF, LEAD_ALT))
        else:
            allele_pairs.append(_allele_pair(rng))

    variant_ids = [f"1_{pos}_{ref}_{alt}" for pos, (ref, alt) in zip(positions, allele_pairs)]

    # LD r2 with lead: gaussian decay in distance + small noise; clipped to [0, 1].
    distances = np.abs(positions - LEAD_POSITION)
    r2_clean = np.exp(-(distances / LD_DECAY_BP) ** 2)
    r2_noise = rng.normal(0, 0.04, size=len(positions))
    r2 = np.clip(r2_clean + r2_noise, 0.0, 1.0)
    r2[positions == LEAD_POSITION] = 1.0

    # Beta = beta_lead * sign * sqrt(r2) + small noise. Sign is shared across
    # exposure / outcome at each variant (so the cross-trait scatter forms a
    # clean diagonal -- the visual hallmark of co-localisation).
    signs = rng.choice([-1.0, 1.0], size=len(positions))
    signs[positions == LEAD_POSITION] = 1.0

    beta_exp = BETA_LEAD_EXPOSURE * signs * np.sqrt(r2) + rng.normal(0, 0.02, size=len(positions))
    beta_out = BETA_LEAD_OUTCOME * signs * np.sqrt(r2) + rng.normal(0, 0.02, size=len(positions))
    se_exp = np.full(len(positions), SE_BASE)
    se_out = np.full(len(positions), SE_BASE)

    p_exp = np.array([_norm_sf(b / s) for b, s in zip(beta_exp, se_exp)])
    p_out = np.array([_norm_sf(b / s) for b, s in zip(beta_out, se_out)])
    # Floor p-values at 5e-324 (matches INPUT_SCHEMA.md missing-data convention).
    p_exp = np.clip(p_exp, 5e-324, 1.0)
    p_out = np.clip(p_out, 5e-324, 1.0)

    def write_sumstats(path: Path, beta: np.ndarray, se: np.ndarray, p: np.ndarray) -> None:
        header = ("variant_id", "chromosome", "position_bp", "allele_a", "allele_b",
                  "beta", "se", "p")
        lines = ["\t".join(header)]
        for vid, pos, (ref, alt), b, s, pp in zip(variant_ids, positions, allele_pairs, beta, se, p):
            lines.append("\t".join([
                vid, "1", str(int(pos)), ref, alt,
                f"{b:.6g}", f"{s:.6g}", f"{pp:.6g}",
            ]))
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    write_sumstats(HERE / "exposure.tsv", beta_exp, se_exp, p_exp)
    write_sumstats(HERE / "outcome.tsv", beta_out, se_out, p_out)

    # LD matrix: two columns (partner_variant_id, r2). Exclude the lead.
    ld_lines = ["partner_variant_id\tr2"]
    for vid, rr in zip(variant_ids, r2):
        if vid == f"1_{LEAD_POSITION}_{LEAD_REF}_{LEAD_ALT}":
            continue
        ld_lines.append(f"{vid}\t{rr:.6g}")
    (HERE / "ld_matrix.tsv").write_text("\n".join(ld_lines) + "\n", encoding="utf-8")

    # Gene track: three synthetic protein-coding genes spanning the window;
    # the middle one straddles the lead so the bottom panel anchors visually.
    genes = [
        ("DEMOGENE_A", 100_000, 200_000, "+", "protein_coding"),
        ("DEMOGENE_B", 450_000, 550_000, "-", "protein_coding"),
        ("DEMOGENE_C", 800_000, 900_000, "+", "protein_coding"),
    ]
    gene_lines = ["gene_symbol\tstart\tend\tstrand\tbiotype"]
    for symbol, start, end, strand, biotype in genes:
        gene_lines.append(f"{symbol}\t{start}\t{end}\t{strand}\t{biotype}")
    (HERE / "genes.tsv").write_text("\n".join(gene_lines) + "\n", encoding="utf-8")

    print(f"wrote {HERE}/exposure.tsv      ({N_VARIANTS} variants)")
    print(f"wrote {HERE}/outcome.tsv       ({N_VARIANTS} variants)")
    print(f"wrote {HERE}/ld_matrix.tsv     ({N_VARIANTS - 1} partner pairs)")
    print(f"wrote {HERE}/genes.tsv         ({len(genes)} genes)")


if __name__ == "__main__":
    generate()
