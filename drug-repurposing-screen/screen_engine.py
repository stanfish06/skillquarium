"""Core engine for pooled viability repurposing screens.

Format-agnostic pipeline: QC → normalisation → hit calling → selectivity →
biomarker sweep → priority scoring. Logic ported from the validated PRISM
reference implementation (prism_utils.py).
"""

from __future__ import annotations

import ast
import math
import operator
import re
import warnings
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import yaml
from scipy import stats
from scipy.optimize import curve_fit


DISCLAIMER = (
    "ClawBio is a research and educational tool. It is not a medical device "
    "and does not provide clinical diagnoses. Consult a healthcare "
    "professional before making any medical decisions."
)


@dataclass
class BundlePaths:
    primary_readout: Path | None
    secondary_readout: Path | None
    treatment_info: Path
    sample_info: Path
    pooling_info: Path | None
    features_dir: Path | None


@dataclass
class PipelineResult:
    qc_primary: pd.DataFrame
    primary_hits: pd.DataFrame
    selectivity: pd.DataFrame
    biomarkers: pd.DataFrame
    priority: pd.DataFrame
    summary: dict[str, Any]


def load_yaml(path: Path) -> dict[str, Any]:
    with open(path) as fh:
        return yaml.safe_load(fh)


def ssmd(neg: np.ndarray, pos: np.ndarray, robust: bool = True) -> float:
    neg = np.asarray(neg, float)
    pos = np.asarray(pos, float)
    neg = neg[np.isfinite(neg)]
    pos = pos[np.isfinite(pos)]
    if len(neg) < 2 or len(pos) < 2:
        return np.nan
    if robust:
        s_neg = stats.median_abs_deviation(neg, scale="normal")
        s_pos = stats.median_abs_deviation(pos, scale="normal")
        var = s_neg ** 2 + s_pos ** 2
        if var <= 0:
            return np.nan
        return (np.median(neg) - np.median(pos)) / math.sqrt(var)
    var = neg.var(ddof=1) + pos.var(ddof=1)
    if var <= 0:
        return np.nan
    return (neg.mean() - pos.mean()) / math.sqrt(var)


def robust_z(values: np.ndarray, ref: np.ndarray) -> np.ndarray:
    ref = np.asarray(ref, float)
    ref = ref[np.isfinite(ref)]
    med = np.nanmedian(ref)
    mad = stats.median_abs_deviation(ref, nan_policy="omit", scale="normal")
    if mad == 0 or not np.isfinite(mad):
        return np.full_like(np.asarray(values, float), np.nan)
    return (np.asarray(values, float) - med) / mad


def bh_fdr(pvals: np.ndarray) -> np.ndarray:
    p = np.asarray(pvals, float)
    n = int(np.sum(np.isfinite(p)))
    order = np.argsort(p)
    ranked = p[order]
    q = np.full_like(p, np.nan)
    if n == 0:
        return q
    adj = ranked * n / (np.arange(1, len(ranked) + 1))
    adj = np.minimum.accumulate(adj[::-1])[::-1]
    q[order] = np.clip(adj, 0, 1)
    return q


def hill_4pl(log_dose: np.ndarray, bottom: float, top: float, log_ec50: float, slope: float) -> np.ndarray:
    return bottom + (top - bottom) / (1.0 + 10.0 ** (slope * (log_ec50 - log_dose)))


def fit_dose_response(doses: np.ndarray, viabilities: np.ndarray) -> dict[str, Any]:
    d = np.asarray(doses, float)
    v = np.asarray(viabilities, float)
    mask = np.isfinite(d) & np.isfinite(v) & (d > 0)
    d = d[mask]
    v = v[mask]
    out: dict[str, Any] = {
        "bottom": np.nan, "top": np.nan, "ec50": np.nan, "ic50": np.nan,
        "slope": np.nan, "auc": np.nan, "r2": np.nan,
        "n_pts": int(len(d)), "converged": False, "quality": "failed",
    }
    if len(d) < 4:
        return out
    ld = np.log10(d)
    p0 = [max(0.0, min(np.percentile(v, 10), 0.5)),
          max(0.5, min(np.percentile(v, 90), 1.2)),
          float(np.median(ld)), 1.0]
    bounds = ([-0.2, 0.5, ld.min() - 2, 0.1], [0.5, 1.2, ld.max() + 2, 6.0])
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            popt, _ = curve_fit(hill_4pl, ld, v, p0=p0, bounds=bounds, maxfev=5000)
    except Exception:
        return out
    bottom, top, log_ec50, slope = popt
    pred = hill_4pl(ld, *popt)
    ss_res = float(np.sum((v - pred) ** 2))
    ss_tot = float(np.sum((v - v.mean()) ** 2))
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 else np.nan
    grid = np.linspace(ld.min(), ld.max(), 64)
    fit_curve = hill_4pl(grid, *popt)
    ld_range = grid.max() - grid.min()
    if hasattr(np, "trapezoid"):
        auc_val = np.trapezoid(fit_curve, grid)
    else:
        auc_val = np.trapz(fit_curve, grid)  # type: ignore[attr-defined]
    auc = float(auc_val / ld_range) if ld_range > 0 else np.nan
    if not (bottom < 0.5 < top) and not (top < 0.5 < bottom):
        ic50 = np.nan
    else:
        frac = (top - bottom) / (0.5 - bottom)
        if frac > 1:
            log_ic50 = log_ec50 - np.log10(frac - 1) / slope
            ic50 = 10.0 ** log_ic50 if ld.min() <= log_ic50 <= ld.max() else np.nan
        else:
            ic50 = np.nan
    out.update({
        "bottom": float(bottom), "top": float(top),
        "ec50": float(10 ** log_ec50),
        "ic50": float(ic50) if np.isfinite(ic50) else np.nan,
        "slope": float(slope), "auc": auc, "r2": float(r2),
        "converged": True,
    })
    if np.isfinite(r2) and r2 >= 0.7:
        out["quality"] = "good"
    elif np.isfinite(ic50) and not np.isfinite(r2):
        out["quality"] = "right_censored"
    else:
        out["quality"] = "low_r2"
    return out


def selectivity_metrics(viability_per_sample: pd.Series) -> dict[str, float]:
    a = viability_per_sample.dropna().values
    if len(a) < 3:
        return dict(median_viability=np.nan, kill_rate=np.nan, bimodality_coef=np.nan, n=float(len(a)))
    med = float(np.median(a))
    kill_rate = float(np.mean(a < 0.5))
    skew = float(stats.skew(a))
    kurt = float(stats.kurtosis(a))
    n = len(a)
    denom = kurt + 3 * (n - 1) ** 2 / max(1, (n - 2) * (n - 3))
    bc = (skew ** 2 + 1.0) / denom if denom > 0 else np.nan
    return dict(median_viability=med, kill_rate=kill_rate, bimodality_coef=float(bc), n=float(n))


def classify_selectivity(
    kill_rate: float,
    median_viability: float,
    bimodality_coef: float,
    *,
    kill_broad: float = 0.7,
    kill_selective: float = 0.15,
    bc_selective: float = 0.55,
) -> str:
    if not np.isfinite(kill_rate) or kill_rate < kill_selective:
        return "inactive"
    if kill_rate >= kill_broad and (not np.isfinite(median_viability) or median_viability > 0.35):
        return "broadly_active"
    if kill_selective <= kill_rate < kill_broad and np.isfinite(bimodality_coef) and bimodality_coef >= bc_selective:
        return "context_selective"
    if kill_rate >= kill_selective:
        return "other"
    return "inactive"


def resolve_bundle_paths(bundle_dir: Path, schema: dict[str, Any]) -> BundlePaths:
    paths = schema.get("paths", {})
    root = bundle_dir
    return BundlePaths(
        primary_readout=(root / paths["primary_readout"]) if paths.get("primary_readout") else None,
        secondary_readout=(root / paths["secondary_readout"]) if paths.get("secondary_readout") else None,
        treatment_info=root / paths["treatment_info"],
        sample_info=root / paths["sample_info"],
        pooling_info=(root / paths["pooling_info"]) if paths.get("pooling_info") else None,
        features_dir=(root / paths["features_dir"]) if paths.get("features_dir") else None,
    )


def load_readout_long(path: Path, sample_col: str = "sample_id") -> pd.DataFrame:
    wide = pd.read_csv(path, index_col=0)
    wide.index.name = sample_col
    long = wide.reset_index().melt(id_vars=sample_col, var_name="well_id", value_name="readout")
    long["readout"] = pd.to_numeric(long["readout"], errors="coerce")
    return long


_COLUMN_NAME_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_FORBIDDEN_QUERY_TOKENS = ("__", "import", "exec", "eval", "open", "getattr", "lambda")

_COMPARE_OPS: dict[type, Any] = {
    ast.Eq: operator.eq,
    ast.NotEq: operator.ne,
    ast.Lt: operator.lt,
    ast.LtE: operator.le,
    ast.Gt: operator.gt,
    ast.GtE: operator.ge,
}


class UnsafeSampleQueryError(ValueError):
    """Raised when objective.yaml sample_info_query is not a safe filter expression."""


def _validate_query_string(query: str) -> None:
    lowered = query.lower()
    for token in _FORBIDDEN_QUERY_TOKENS:
        if token in lowered:
            raise UnsafeSampleQueryError(
                f"Invalid sample_info_query: forbidden token {token!r} in {query!r}"
            )


def _eval_query_node(node: ast.AST, df: pd.DataFrame) -> pd.Series | str | int | float | bool | None:
    if isinstance(node, ast.BoolOp):
        values = [_eval_query_node(v, df) for v in node.values]
        if not values or not all(isinstance(v, pd.Series) for v in values):
            raise UnsafeSampleQueryError("Boolean combinations must yield per-sample masks")
        result = values[0]
        for value in values[1:]:
            if isinstance(node.op, ast.And):
                result = result & value
            elif isinstance(node.op, ast.Or):
                result = result | value
            else:
                raise UnsafeSampleQueryError(f"Unsupported boolean operator: {ast.dump(node.op)}")
        return result

    if isinstance(node, ast.BinOp):
        if isinstance(node.op, ast.BitAnd):
            left = _eval_query_node(node.left, df)
            right = _eval_query_node(node.right, df)
            if not isinstance(left, pd.Series) or not isinstance(right, pd.Series):
                raise UnsafeSampleQueryError("Boolean combinations must yield per-sample masks")
            return left & right
        if isinstance(node.op, ast.BitOr):
            left = _eval_query_node(node.left, df)
            right = _eval_query_node(node.right, df)
            if not isinstance(left, pd.Series) or not isinstance(right, pd.Series):
                raise UnsafeSampleQueryError("Boolean combinations must yield per-sample masks")
            return left | right
        raise UnsafeSampleQueryError(f"Unsupported binary operator: {ast.dump(node.op)}")

    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Not):
        operand = _eval_query_node(node.operand, df)
        if not isinstance(operand, pd.Series):
            raise UnsafeSampleQueryError("Logical not must apply to a per-sample mask")
        return ~operand

    if isinstance(node, ast.Compare):
        if len(node.ops) != 1 or len(node.comparators) != 1:
            raise UnsafeSampleQueryError("Chained comparisons are not supported in sample_info_query")
        op_type = type(node.ops[0])
        compare = _COMPARE_OPS.get(op_type)
        if compare is None:
            raise UnsafeSampleQueryError(f"Unsupported comparison operator: {ast.dump(node.ops[0])}")
        left = _eval_query_node(node.left, df)
        right = _eval_query_node(node.comparators[0], df)
        return compare(left, right)

    if isinstance(node, ast.Attribute):
        raise UnsafeSampleQueryError("Attribute access is not supported in sample_info_query")

    if isinstance(node, ast.Subscript):
        raise UnsafeSampleQueryError("Subscripting is not supported in sample_info_query")

    if isinstance(node, ast.Call):
        raise UnsafeSampleQueryError("Function calls are not supported in sample_info_query")

    if isinstance(node, ast.Name):
        column = node.id
        if not _COLUMN_NAME_RE.match(column):
            raise UnsafeSampleQueryError(f"Invalid column name in sample_info_query: {column!r}")
        if column not in df.columns:
            raise UnsafeSampleQueryError(f"Unknown sample_info column in sample_info_query: {column!r}")
        return df[column]

    if isinstance(node, ast.Constant):
        value = node.value
        if isinstance(value, (str, int, float, bool)) or value is None:
            return value
        raise UnsafeSampleQueryError(f"Unsupported literal type: {type(value).__name__}")

    raise UnsafeSampleQueryError(f"Unsupported expression in sample_info_query: {ast.dump(node)}")


def safe_sample_query(df: pd.DataFrame, query: str) -> pd.Series:
    """Evaluate a restricted boolean filter over sample_info columns.

    Only column comparisons, ``and`` / ``or`` / ``not``, and scalar literals are
    permitted. Arbitrary Python (including ``df.eval(..., engine='python')``) is
    rejected so user-supplied ``objective.yaml`` cannot inject code.
    """
    _validate_query_string(query)
    try:
        parsed = ast.parse(query.strip(), mode="eval")
    except SyntaxError as exc:
        raise UnsafeSampleQueryError(f"Invalid sample_info_query syntax: {query!r}") from exc

    result = _eval_query_node(parsed.body, df)
    if not isinstance(result, pd.Series):
        raise UnsafeSampleQueryError("sample_info_query must evaluate to a per-sample boolean mask")
    return result.fillna(False).astype(bool)


def apply_sample_query(df: pd.DataFrame, query: str | None) -> pd.Series:
    if not query:
        return pd.Series(True, index=df.index)
    return safe_sample_query(df, query)


def run_primary_qc(
    long_df: pd.DataFrame,
    treatment: pd.DataFrame,
    sample_info: pd.DataFrame,
    schema: dict[str, Any],
) -> pd.DataFrame:
    cols = schema.get("columns", {})
    sample_col = cols.get("sample_id", "sample_id")
    well_col = cols.get("well_id", "well_id")
    pert_col = cols.get("perturbation_type", "perturbation_type")
    plate_col = cols.get("detection_plate", "detection_plate")
    neg_type = schema.get("controls", {}).get("negative", "vehicle_control")
    pos_type = schema.get("controls", {}).get("positive", "positive_control")
    ssmd_cutoff = float(schema.get("qc", {}).get("ssmd_cutoff", 1.5))

    merged = long_df.merge(treatment, on=well_col, how="inner")
    merged = merged.merge(sample_info, on=sample_col, how="inner")

    rows = []
    for (sample_id, plate), grp in merged.groupby([sample_col, plate_col]):
        neg = grp.loc[grp[pert_col] == neg_type, "readout"].values
        pos = grp.loc[grp[pert_col] == pos_type, "readout"].values
        score = ssmd(neg, pos, robust=True)
        rows.append({
            sample_col: sample_id,
            plate_col: plate,
            "ssmd": score,
            "pass_qc": bool(np.isfinite(score) and score >= ssmd_cutoff),
        })
    return pd.DataFrame(rows)


def normalise_primary(
    long_df: pd.DataFrame,
    treatment: pd.DataFrame,
    qc: pd.DataFrame,
    schema: dict[str, Any],
) -> pd.DataFrame:
    cols = schema.get("columns", {})
    sample_col = cols.get("sample_id", "sample_id")
    well_col = cols.get("well_id", "well_id")
    pert_col = cols.get("perturbation_type", "perturbation_type")
    plate_col = cols.get("detection_plate", "detection_plate")
    compound_col = cols.get("compound_id", "compound_id")
    neg_type = schema.get("controls", {}).get("negative", "vehicle_control")
    hit_cfg = schema.get("hit_calling", {})
    viability_cutoff = float(hit_cfg.get("viability_cutoff", 0.5))
    z_cutoff = float(hit_cfg.get("robust_z_cutoff", -2.0))
    min_samples = int(hit_cfg.get("min_samples", 3))

    passing = qc.loc[qc["pass_qc"], [sample_col, plate_col]].drop_duplicates()
    merged = long_df.merge(treatment, on=well_col, how="inner")
    merged = merged.merge(passing, on=[sample_col, plate_col], how="inner")
    merged = merged[merged[pert_col] == "experimental_treatment"].copy()

    dmso = long_df.merge(treatment, on=well_col, how="inner")
    dmso = dmso[dmso[pert_col] == neg_type]
    dmso_med = (
        dmso.groupby([sample_col, plate_col])["readout"]
        .median()
        .rename("dmso_median")
        .reset_index()
    )
    merged = merged.merge(dmso_med, on=[sample_col, plate_col], how="left")
    merged["viability"] = (merged["readout"] / merged["dmso_median"]).clip(0, 2)

    sample_medians = merged.groupby([sample_col, plate_col, compound_col])["viability"].median().reset_index()
    sample_medians["robust_z"] = sample_medians.groupby([sample_col, plate_col])["viability"].transform(
        lambda s: robust_z(s.values, s.values)
    )

    compound_summary = []
    for compound_id, grp in sample_medians.groupby(compound_col):
        hit_mask = (grp["viability"] < viability_cutoff) & (grp["robust_z"] < z_cutoff)
        n_hit = int(hit_mask.sum())
        compound_summary.append({
            compound_col: compound_id,
            "median_viability": float(grp["viability"].median()),
            "n_samples_hit": n_hit,
            "is_hit": n_hit >= min_samples,
        })
    return pd.DataFrame(compound_summary)


def compute_selectivity(
    long_df: pd.DataFrame,
    treatment: pd.DataFrame,
    sample_info: pd.DataFrame,
    hits: pd.DataFrame,
    objective: dict[str, Any],
    schema: dict[str, Any],
) -> pd.DataFrame:
    cols = schema.get("columns", {})
    sample_col = cols.get("sample_id", "sample_id")
    well_col = cols.get("well_id", "well_id")
    pert_col = cols.get("perturbation_type", "perturbation_type")
    plate_col = cols.get("detection_plate", "detection_plate")
    compound_col = cols.get("compound_id", "compound_id")
    neg_type = schema.get("controls", {}).get("negative", "vehicle_control")

    active = hits.loc[hits["is_hit"], compound_col].tolist()
    merged = long_df.merge(treatment, on=well_col, how="inner")
    merged = merged.merge(sample_info, on=sample_col, how="inner")
    merged = merged[merged[compound_col].isin(active)]

    dmso = long_df.merge(treatment, on=well_col, how="inner")
    dmso = dmso[dmso[pert_col] == neg_type]
    dmso_med = dmso.groupby([sample_col, plate_col])["readout"].median().rename("dmso_median").reset_index()
    merged = merged.merge(dmso_med, on=[sample_col, plate_col], how="left")
    merged["viability"] = (merged["readout"] / merged["dmso_median"]).clip(0, 2)

    target_mask = apply_sample_query(sample_info.set_index(sample_col), objective.get("target_context", {}).get("sample_info_query"))
    target_ids = set(sample_info.loc[target_mask.reindex(sample_info[sample_col]).fillna(False).values, sample_col])

    per_sample = merged.groupby([compound_col, sample_col])["viability"].median().reset_index()

    rows = []
    for compound_id, grp in per_sample.groupby(compound_col):
        via = grp.set_index(sample_col)["viability"]
        metrics_all = selectivity_metrics(via)
        sel_class = classify_selectivity(
            metrics_all["kill_rate"],
            metrics_all["median_viability"],
            metrics_all["bimodality_coef"],
        )
        target_via = via.reindex([s for s in via.index if s in target_ids]).dropna()
        off_via = via.reindex([s for s in via.index if s not in target_ids]).dropna()
        target_kill = float(np.mean(target_via < 0.5)) if len(target_via) else 0.0
        off_kill = float(np.mean(off_via < 0.5)) if len(off_via) else 0.0
        rows.append({
            compound_col: compound_id,
            "selectivity_class": sel_class,
            "kill_rate_all": metrics_all["kill_rate"],
            "median_viability_all": metrics_all["median_viability"],
            "bimodality_coef": metrics_all["bimodality_coef"],
            "target_kill_rate": target_kill,
            "off_target_kill_rate": off_kill,
            "context_selectivity_score": max(0.0, target_kill - off_kill),
        })
    return pd.DataFrame(rows)


def biomarker_sweep(
    selectivity_df: pd.DataFrame,
    sample_info: pd.DataFrame,
    features_dir: Path | None,
    objective: dict[str, Any],
    schema: dict[str, Any],
) -> pd.DataFrame:
    cols = schema.get("columns", {})
    sample_col = cols.get("sample_id", "sample_id")
    compound_col = cols.get("compound_id", "compound_id")
    if features_dir is None or not features_dir.exists():
        return pd.DataFrame(columns=[compound_col, "feature", "feature_type", "rho", "pvalue", "qvalue"])

    selective = selectivity_df.loc[
        selectivity_df["selectivity_class"].isin(["context_selective", "other"]),
        compound_col,
    ].tolist()
    if not selective:
        return pd.DataFrame(columns=[compound_col, "feature", "feature_type", "rho", "pvalue", "qvalue"])

    sample_indexed = sample_info.set_index(sample_col)
    results = []
    for feat_path in sorted(features_dir.glob("*.csv")):
        feat_type = feat_path.stem
        feat = pd.read_csv(feat_path, index_col=0)
        feat.index.name = sample_col
        feat = feat.apply(pd.to_numeric, errors="coerce")
        for compound_id in selective:
            col = f"sensitivity_{compound_id}"
            if col not in sample_indexed.columns:
                continue
            sens = sample_indexed[col]
            for feature in feat.columns:
                x = feat[feature].reindex(sens.index).values
                y = sens.values
                mask = np.isfinite(x) & np.isfinite(y)
                if mask.sum() < 5:
                    continue
                rho, pval = stats.spearmanr(x[mask], y[mask])
                if not np.isfinite(rho):
                    continue
                results.append({
                    compound_col: compound_id,
                    "feature": feature,
                    "feature_type": feat_type,
                    "rho": float(rho),
                    "pvalue": float(pval),
                })
    if not results:
        return pd.DataFrame(columns=[compound_col, "feature", "feature_type", "rho", "pvalue", "qvalue"])
    out = pd.DataFrame(results)
    out["qvalue"] = bh_fdr(out["pvalue"].values)
    return out.sort_values("qvalue")


def score_priority(
    hits: pd.DataFrame,
    selectivity: pd.DataFrame,
    biomarkers: pd.DataFrame,
    treatment: pd.DataFrame,
    objective: dict[str, Any],
    schema: dict[str, Any],
) -> pd.DataFrame:
    cols = schema.get("columns", {})
    compound_col = cols.get("compound_id", "compound_id")
    name_col = cols.get("compound_name", "compound_name")
    weights = objective.get("priority_weights", {})
    w_sel = float(weights.get("selectivity", 0.25))
    w_bio = float(weights.get("biomarker_strength", 0.25))
    w_phase = float(weights.get("clinical_phase", 0.20))
    w_mech = float(weights.get("mechanism_novelty", 0.15))
    w_pheno = float(weights.get("phenocopy_support", 0.15))

    meta = treatment.drop_duplicates(subset=[compound_col])[[compound_col, name_col, "clinical_phase", "moa"]]
    df = hits.merge(selectivity, on=compound_col, how="left")
    df = df.merge(meta, on=compound_col, how="left")

    bio_best = (
        biomarkers.sort_values("qvalue")
        .groupby(compound_col)
        .first()
        .reset_index()[[compound_col, "feature", "feature_type", "rho", "qvalue"]]
        if len(biomarkers)
        else pd.DataFrame(columns=[compound_col, "feature", "feature_type", "rho", "qvalue"])
    )
    df = df.merge(bio_best, on=compound_col, how="left")

    phase_score = df["clinical_phase"].map({
        "Launched": 1.0, "Phase 3": 0.85, "Phase 2": 0.7, "Phase 1": 0.55, "Preclinical": 0.3,
    }).fillna(0.2)

    sel_score = df["context_selectivity_score"].fillna(0).clip(0, 1)
    bio_score = (1 - df["qvalue"].fillna(1)).clip(0, 1) if "qvalue" in df else 0.0
    mech_score = df["selectivity_class"].eq("context_selective").astype(float) * 0.5 + 0.5

    df["priority"] = (
        w_sel * sel_score
        + w_bio * (bio_score if isinstance(bio_score, pd.Series) else 0)
        + w_phase * phase_score
        + w_mech * mech_score
        + w_pheno * 0.5
    )
    df = df.sort_values("priority", ascending=False)
    df["rank"] = np.arange(1, len(df) + 1)
    return df


def run_pipeline(
    bundle_dir: Path,
    schema_path: Path,
    objective_path: Path,
    cache_dir: Path | None = None,
) -> PipelineResult:
    schema = load_yaml(schema_path)
    objective = load_yaml(objective_path)
    paths = resolve_bundle_paths(bundle_dir, schema)

    cols = schema.get("columns", {})
    sample_col = cols.get("sample_id", "sample_id")

    treatment = pd.read_csv(paths.treatment_info)
    sample_info = pd.read_csv(paths.sample_info)

    if paths.primary_readout is None:
        raise ValueError("Primary readout required for this pipeline stage")

    long_primary = load_readout_long(paths.primary_readout, sample_col=sample_col)
    qc = run_primary_qc(long_primary, treatment, sample_info, schema)
    hits = normalise_primary(long_primary, treatment, qc, schema)
    selectivity = compute_selectivity(long_primary, treatment, sample_info, hits, objective, schema)
    biomarkers = biomarker_sweep(selectivity, sample_info, paths.features_dir, objective, schema)
    priority = score_priority(hits, selectivity, biomarkers, treatment, objective, schema)

    summary = {
        "objective_name": objective.get("name", "unspecified"),
        "n_samples": int(sample_info[sample_col].nunique()),
        "n_compounds": int(treatment[cols.get("compound_id", "compound_id")].nunique()),
        "n_hits": int(hits["is_hit"].sum()),
        "n_context_selective": int((selectivity["selectivity_class"] == "context_selective").sum()),
        "top_compound": priority.iloc[0][cols.get("compound_id", "compound_id")] if len(priority) else None,
    }
    return PipelineResult(
        qc_primary=qc,
        primary_hits=hits,
        selectivity=selectivity,
        biomarkers=biomarkers,
        priority=priority,
        summary=summary,
    )
