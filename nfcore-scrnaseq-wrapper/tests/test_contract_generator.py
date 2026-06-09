"""Audit finding #8 — the contract generator must not revert audit fixes.

``scripts/generate_scrnaseq_contract.py`` regenerates the whole contract file. If
its static template drifts from the hand-maintained contract, a future
regeneration would silently revert audit fixes (e.g. moving ``skip_emptydrops``
back to "unsupported" or dropping the centralised constants). This test
regenerates the policy sections offline (no network) from the live OFFICIAL_PARAMS
and asserts the critical sections match the live contract module.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path
import sys

_SKILL_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_SKILL_DIR))

import nfcore_4_1_0_contract as live

_GENERATOR_PATH = _SKILL_DIR.parent.parent / "scripts" / "generate_scrnaseq_contract.py"


def _load_generator():
    spec = importlib.util.spec_from_file_location("generate_scrnaseq_contract", _GENERATOR_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _regenerate_namespace() -> dict:
    gen = _load_generator()
    # Feed the generator the live OFFICIAL_PARAMS (offline; no schema fetch) and
    # exec the resulting source so we can compare the policy objects it produces.
    params_str = gen.format_params_dict(live.OFFICIAL_PARAMS)
    code = gen.generate_contract_code(live.NFCORE_SCRNASEQ_VERSION, params_str)
    namespace: dict = {}
    exec(compile(code, str(_GENERATOR_PATH) + "::generated", "exec"), namespace)
    return namespace


def test_generated_contract_keeps_skip_emptydrops_as_supported_alias():
    ns = _regenerate_namespace()
    assert "skip_emptydrops" in ns["WRAPPER_SUPPORTED_UPSTREAM_PARAMS"]
    assert "skip_emptydrops" not in ns["INTENTIONALLY_UNSUPPORTED_PARAMS"]
    assert ns["WRAPPER_DEPRECATED_ALIAS_PARAMS"] == {"skip_emptydrops"}


def test_generated_contract_matches_live_policy_sections():
    ns = _regenerate_namespace()
    assert ns["WRAPPER_SUPPORTED_UPSTREAM_PARAMS"] == live.WRAPPER_SUPPORTED_UPSTREAM_PARAMS
    assert ns["INTENTIONALLY_UNSUPPORTED_PARAMS"] == live.INTENTIONALLY_UNSUPPORTED_PARAMS
    assert ns["INTENTIONALLY_UNSUPPORTED_REASONS"] == live.INTENTIONALLY_UNSUPPORTED_REASONS
    assert ns["CELLRANGER_FAMILY_PRESETS"] == live.CELLRANGER_FAMILY_PRESETS
    assert ns["FASTQC_GATED_ALIGNERS"] == live.FASTQC_GATED_ALIGNERS
    assert ns["PRESETS_SUPPORTING_CUSTOM_PROTOCOL"] == live.PRESETS_SUPPORTING_CUSTOM_PROTOCOL
    assert ns["PROTOCOLS_JSON_4_1_0"] == live.PROTOCOLS_JSON_4_1_0


def test_generated_official_params_partition_is_complete():
    ns = _regenerate_namespace()
    classified = ns["WRAPPER_SUPPORTED_UPSTREAM_PARAMS"] | ns["INTENTIONALLY_UNSUPPORTED_PARAMS"]
    assert classified == set(ns["OFFICIAL_PARAMS"])
