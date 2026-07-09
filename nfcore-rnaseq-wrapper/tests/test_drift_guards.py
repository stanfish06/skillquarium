"""Drift guards for the parameter surface and the module-isolation shim.

These are invariant/regression tests (audit F5, F6). They lock the relationships
between the several hand-maintained parameter lists so a future edit that adds a
flag without wiring it everywhere fails loudly here, and they guard the bare-import
isolation shim against a new module forgetting the purge call.
"""
from __future__ import annotations

import importlib
from pathlib import Path
import sys

_SKILL_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_SKILL_DIR))


def _purge_foreign(*names: str) -> None:
    for name in names:
        module = sys.modules.get(name)
        module_file = Path(getattr(module, "__file__", "") or "")
        if module is not None and _SKILL_DIR not in module_file.parents and module_file != _SKILL_DIR / f"{name}.py":
            sys.modules.pop(name, None)


def _purge_local(*names: str) -> None:
    for name in names:
        module = sys.modules.get(name)
        module_file = Path(getattr(module, "__file__", "") or "")
        if module is not None and (module_file == _SKILL_DIR / f"{name}.py" or _SKILL_DIR in module_file.parents):
            sys.modules.pop(name, None)


_purge_foreign("errors", "schemas", "params_builder", "reporting", "nfcore_rnaseq_wrapper")

import params_builder  # noqa: E402
import reporting  # noqa: E402
wrapper = importlib.import_module("nfcore_rnaseq_wrapper")  # noqa: E402

# Importing the full wrapper pulls EVERY skill module into sys.modules under its bare
# name. Leaving them cached would shadow the errors/schemas class identity that sibling
# test modules (e.g. test_samplesheet_builder) rely on for pytest.raises(SkillError),
# so purge every skill module from the cache now. The module-level references captured
# above keep the objects this file needs alive after the cache is cleared.
_purge_local(*[p.stem for p in _SKILL_DIR.glob("*.py")])
while str(_SKILL_DIR) in sys.path:
    sys.path.remove(str(_SKILL_DIR))


# ── F5: parameter-list drift guards ───────────────────────────────────────────

# Wrapper-control flags that are intentionally NOT replayed as pipeline params
# through reporting's flag lists (they are handled by dedicated logic or are
# launcher concerns, not nf-core parameters).
_CONTROL_DESTS = frozenset({
    "help",
    "output",
    "aligner",            # recorded explicitly by build_repro_command_args
    "profile",            # recorded explicitly
    "pipeline_version",   # recorded explicitly
    "pipeline_local",     # recorded explicitly
    "demo",               # recorded explicitly
    "input",              # recorded explicitly (samplesheet copy)
    "resume",             # recorded explicitly
    "timeout_hours",      # recorded explicitly (only when non-default)
    "deseq2_vst",         # recorded explicitly via --deseq2-vst/--no-deseq2-vst
    "nextflow_config",    # recorded explicitly (list)
    "check",              # preflight-only, never reaches a real run
    "verbose",            # launcher-only logging concern, not an nf-core param
    "no_banner",          # launcher-only display concern, not an nf-core param
    "work_dir",           # execution-environment path, not a scientific param
})


def test_demo_cleared_references_cover_all_params_builder_reference_fields():
    """Every reference path field params_builder can write to params.yaml must be in
    the wrapper's hermetic cleared-reference set, so --demo / a self-contained test
    profile can never leave one behind to override the profile's bundled reference
    (audit F1/F5)."""
    cleared = set(wrapper._DEMO_CLEARED_REFERENCE_FIELDS)
    writable_refs = set(params_builder._REFERENCE_PATH_FIELDS)
    missing = writable_refs - cleared
    assert not missing, (
        "reference fields params_builder can write but the hermetic-profile clear step "
        f"does not remove (would override a test profile): {sorted(missing)}"
    )


def test_every_pipeline_flag_is_recorded_for_replay():
    """Every pipeline-affecting --flag must be recorded by build_repro_command_args via
    one of reporting's flag lists, so reproducibility/commands.sh never silently drops a
    parameter on replay (audit F5). New flags must be added to a repro list or the
    explicit control allowlist."""
    parser = wrapper.build_parser()
    repro_known = (
        set(reporting._BOOLEAN_FLAGS)
        | set(reporting._OPTIONAL_VALUE_FLAGS)
        | set(reporting._REPRO_PATH_FLAGS)
        | set(reporting._REPRO_MULTI_PATH_FLAGS)
    )
    dests = {action.dest for action in parser._actions}
    missing = sorted(d for d in dests if d not in repro_known and d not in _CONTROL_DESTS)
    assert not missing, (
        "these --flags are recorded nowhere in reporting.build_repro_command_args, so "
        f"commands.sh replay would silently drop them: {missing}"
    )


# ── F6: module-isolation shim guard ───────────────────────────────────────────


def test_modules_importing_errors_or_schemas_call_purge_guard():
    """Every skill module that imports the bare top-level `errors`/`schemas` must also
    call purge_foreign_bare_modules; otherwise a sibling skill shipping an identically
    named module could shadow ours when both run in one interpreter (audit F6). This
    static guard fails loudly if a new module forgets the purge."""
    offenders: list[str] = []
    for py in sorted(_SKILL_DIR.glob("*.py")):
        if py.name == "_isolated_imports.py":
            continue
        text = py.read_text(encoding="utf-8")
        imports_shared = ("from errors import" in text) or ("from schemas import" in text)
        if imports_shared and "purge_foreign_bare_modules" not in text:
            offenders.append(py.name)
    assert not offenders, (
        "these modules import errors/schemas without purge_foreign_bare_modules, leaving "
        f"them open to cross-skill module shadowing: {offenders}"
    )
