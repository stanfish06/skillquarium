"""conftest.py — pre-stub the ``clawbio`` package for this skill's tests.

The stub maps ``clawbio`` / ``clawbio.common`` onto the real package directories
via ``__path__`` and eagerly loads only the leaf helper modules the wrapper needs
(``clawbio.common.checksums`` and friends). This keeps the test session light:
importing the real ``clawbio`` package would execute ``clawbio/__init__.py`` ->
``from .runner import ...`` -> ``from clawbio.cli import ...``, pulling the whole
CLI engine into every test.

The runner-allowlist tests do need ``clawbio.cli`` (for ``clawbio.cli.SKILLS``).
Loading that module runs ``clawbio/cli.py``, whose first line is
``from clawbio import __version__``. Because we deliberately skip executing
``clawbio/__init__.py``, the stub must expose ``__version__`` itself, otherwise
that import fails with ``ImportError: cannot import name '__version__'``. We read
the value straight from ``clawbio/__init__.py`` so the stub never drifts from the
real package version.
"""
from __future__ import annotations

import ast
import importlib.util
import sys
import types
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent


def _read_clawbio_version() -> str:
    """Return ``clawbio.__version__`` without importing (and thus executing) the
    package ``__init__`` (which would trigger the heavy ``runner``/``cli`` chain)."""
    init_path = _REPO_ROOT / "clawbio" / "__init__.py"
    try:
        tree = ast.parse(init_path.read_text(encoding="utf-8"))
    except OSError:
        return "0.0.0"
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "__version__":
                    try:
                        return ast.literal_eval(node.value)
                    except ValueError:
                        return "0.0.0"
    return "0.0.0"


def _ensure_clawbio_stubs() -> None:
    if "clawbio" not in sys.modules:
        pkg = types.ModuleType("clawbio")
        pkg.__path__ = [str(_REPO_ROOT / "clawbio")]  # type: ignore[attr-defined]
        pkg.__package__ = "clawbio"
        # clawbio.cli does `from clawbio import __version__` at import time; expose
        # it on the stub so the runner-allowlist tests can import clawbio.cli
        # without executing clawbio/__init__.py.
        pkg.__version__ = _read_clawbio_version()  # type: ignore[attr-defined]
        sys.modules["clawbio"] = pkg
    if "clawbio.common" not in sys.modules:
        common = types.ModuleType("clawbio.common")
        common.__path__ = [str(_REPO_ROOT / "clawbio" / "common")]  # type: ignore[attr-defined]
        common.__package__ = "clawbio.common"
        sys.modules["clawbio.common"] = common

    def _load(name: str) -> None:
        if name in sys.modules:
            return
        path = _REPO_ROOT / (name.replace(".", "/") + ".py")
        spec = importlib.util.spec_from_file_location(name, path)
        mod = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
        mod.__package__ = name.rsplit(".", 1)[0]
        sys.modules[name] = mod
        spec.loader.exec_module(mod)  # type: ignore[union-attr]

    _load("clawbio.common.checksums")
    _load("clawbio.common.portable_commands")
    _load("clawbio.common.report")
    _load("clawbio.common.reproducibility")


_ensure_clawbio_stubs()


# ── Cross-skill bare-module isolation (shared verbatim with nfcore-sarek /
# nfcore-scrnaseq conftests) ─────────────────────────────────────────────────
# Several nf-core wrapper skills ship modules under bare top-level names
# (``errors``, ``schemas``, …). A single pytest session that collects more than
# one wrapper suite can shadow them across skills. We force THIS skill's dir to
# the front of sys.path and ensure each bare name resolves to this skill's
# *canonical* module object — restoring the same object (not reimporting) when a
# foreign copy is cached, so ``pytest.raises(SkillError)`` class identity holds.
_ISO_SKILL_DIR = Path(__file__).resolve().parent.parent
_ISO_TESTS_DIR = Path(__file__).resolve().parent
_ISO_BARE_MODULES = (
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
_ISO_CANONICAL: dict[str, object] = {}


def _claim_local_modules() -> None:
    for path in (_ISO_TESTS_DIR, _ISO_SKILL_DIR):
        if str(path) in sys.path:
            sys.path.remove(str(path))
        sys.path.insert(0, str(path))
    for name in _ISO_BARE_MODULES:
        module = sys.modules.get(name)
        if module is not None:
            module_file = Path(getattr(module, "__file__", "") or "")
            local = (
                module_file == _ISO_SKILL_DIR / f"{name}.py"
                or _ISO_SKILL_DIR in module_file.parents
            )
            if local:
                _ISO_CANONICAL[name] = module
                continue
        if name in _ISO_CANONICAL:
            sys.modules[name] = _ISO_CANONICAL[name]
        elif module is not None:
            sys.modules.pop(name, None)


_claim_local_modules()


def pytest_collectstart(collector):  # noqa: ARG001 - pytest hook signature
    _claim_local_modules()


def pytest_runtest_setup(item):  # noqa: ARG001 - pytest hook signature
    _claim_local_modules()
