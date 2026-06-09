"""pytest configuration."""

import sys
from pathlib import Path

import pytest

# Put the skill's own dir on sys.path so tests can import sibling modules
# (the fork uses a flat layout, no package path).
SKILL_DIR = Path(__file__).resolve().parent.parent
if str(SKILL_DIR) not in sys.path:
    sys.path.insert(0, str(SKILL_DIR))


def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line(
        "markers",
        "live: integration test that runs plink against a 1000G region fetched from EBI",
    )


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    import os
    run_live = os.environ.get("RUN_LIVE_TESTS") == "1" or "live" in (config.getoption("-m") or "")
    if run_live:
        return
    skip_live = pytest.mark.skip(reason="live test (set RUN_LIVE_TESTS=1 or pytest -m live; needs plink 1.9 + network)")
    for item in items:
        if "live" in item.keywords:
            item.add_marker(skip_live)
