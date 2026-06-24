"""conftest.py — make this wrapper's test suite order-independent.

Several nf-core wrapper skills in this monorepo ship their modules under bare
top-level names (``errors``, ``schemas``, ``preflight``, …). A single pytest
session that collects more than one wrapper suite (the repo-wide ``testpaths``
list / ``make test``) can therefore hit cross-skill module shadowing — a test
importing ``from errors import SkillError`` could bind a sibling wrapper's class.

We force THIS skill's directory to the front of ``sys.path`` and purge any
foreign cached copies of the bare module names — once at import time (so each
test file's *module-level* sibling imports bind this wrapper's classes during
collection) and again before every test via the ``pytest_runtest_setup`` hook,
which runs before fixtures, so the function-scoped module fixtures and any
*runtime* ``from errors import`` inside a test body also resolve to this
wrapper. This gives the order-immunity ``nfcore-rnaseq-wrapper`` achieves while
keeping the rule in one place instead of copy-pasted into every test file.
"""
from __future__ import annotations

import sys
from pathlib import Path

_SKILL_DIR = Path(__file__).resolve().parent.parent
_TESTS_DIR = Path(__file__).resolve().parent

# Bare top-level module names shipped by the nf-core wrapper skills. Purging a
# name this wrapper does not ship is a no-op (only *foreign* cached copies are
# dropped), so one shared list is safe across all three wrappers.
_BARE_MODULES = (
    "errors",
    "schemas",
    "preflight",
    "params_builder",
    "command_builder",
    "samplesheet_builder",
    "outputs_parser",
    "provenance",
    "reporting",
    "executor",
    "pipeline_source",
    "remap_paths",
    "repro_commands",
    "nfcore_4_1_0_contract",
    "_isolated_imports",
)


# Canonical object cache: the first time this skill's copy of a bare module is
# seen in sys.modules, we remember that exact module object. When a *foreign*
# wrapper later caches the same bare name, we restore our canonical object rather
# than purging + reimporting — reimporting would create a NEW module object whose
# ``SkillError`` class differs from the one already-loaded skill modules bound,
# breaking ``pytest.raises(SkillError)`` identity checks. Restoring the same object
# keeps the whole skill (modules + tests) sharing one class identity.
_CANONICAL: dict[str, object] = {}


def _claim_local_modules() -> None:
    """Force this skill dir to the front of sys.path and ensure each bare module
    name resolves to THIS skill's canonical object."""
    for path in (_TESTS_DIR, _SKILL_DIR):
        if str(path) in sys.path:
            sys.path.remove(str(path))
        sys.path.insert(0, str(path))
    for name in _BARE_MODULES:
        module = sys.modules.get(name)
        if module is not None:
            module_file = Path(getattr(module, "__file__", "") or "")
            local = (
                module_file == _SKILL_DIR / f"{name}.py"
                or _SKILL_DIR in module_file.parents
            )
            if local:
                _CANONICAL[name] = module  # remember our canonical object
                continue
        # Foreign (or absent): restore our canonical object if we have one,
        # otherwise drop the foreign copy so the next import loads ours.
        if name in _CANONICAL:
            sys.modules[name] = _CANONICAL[name]
        elif module is not None:
            sys.modules.pop(name, None)


_claim_local_modules()


def pytest_collectstart(collector):  # noqa: ARG001 - pytest hook signature
    # Re-claim immediately before each test module in this dir is collected, so its
    # module-level ``from errors import ...`` binds THIS wrapper's classes even when
    # a sibling wrapper's collection ran in between.
    _claim_local_modules()


def pytest_runtest_setup(item):  # noqa: ARG001 - pytest hook signature
    # Re-claim before each test so runtime ``from errors import ...`` inside a test
    # body resolves to this skill's canonical object (identity-consistent with the
    # function-scoped module fixtures).
    _claim_local_modules()
