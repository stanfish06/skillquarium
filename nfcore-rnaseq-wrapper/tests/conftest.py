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
