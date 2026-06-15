"""conftest.py — ensure the skill directory is importable for tests.

Mirrors the sibling ``nfcore-sarek-wrapper`` conftest so both wrappers set up
imports identically. NOTE: this skill ships its modules under bare top-level
names (``errors``, ``schemas``, ``outputs_parser``, ``reporting``, …), as do
several sibling skills in this monorepo. Run this skill's tests on their own
(``pytest skills/nfcore-scrnaseq-wrapper/tests``), which is how CI runs them; a
single ``pytest`` session that also collects a sibling skill's tests can hit
bare-name module shadowing at collection time (a monorepo-wide property of the
shared ``testpaths`` list, not a defect in this skill).
"""
from __future__ import annotations

import sys
from pathlib import Path

_SKILL_DIR = Path(__file__).resolve().parent.parent
_TESTS_DIR = Path(__file__).resolve().parent
for path in (_SKILL_DIR, _TESTS_DIR):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))
