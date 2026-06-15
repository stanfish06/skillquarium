"""The skills/catalog.json entry must mirror SKILL.md's YAML frontmatter.

Parity with nfcore-scrnaseq-wrapper's test_catalog_entry_mirrors_skill_frontmatter:
the catalog is the machine-readable index the agent routes on, so it must never
drift from the skill's own declared description/version/tags/trigger_keywords.
sarek keeps ``description`` top-level, ``version``/``tags`` under ``metadata:``,
and ``trigger_keywords`` under ``metadata.openclaw:`` — this reads each at its
actual path so the catalog can never silently drift from any of them.
"""
from __future__ import annotations

import json
from pathlib import Path

import yaml

_SKILL_DIR = Path(__file__).resolve().parent.parent
_CATALOG = _SKILL_DIR.parent / "catalog.json"


def _read_frontmatter() -> dict:
    text = (_SKILL_DIR / "SKILL.md").read_text(encoding="utf-8")
    assert text.startswith("---"), "SKILL.md must open with a YAML frontmatter block"
    _, fm, _ = text.split("---", 2)
    return yaml.safe_load(fm)


def _catalog_entry() -> dict:
    catalog = json.loads(_CATALOG.read_text(encoding="utf-8"))
    items = catalog if isinstance(catalog, list) else catalog.get("skills", [])
    return next(e for e in items if e.get("name") == "nfcore-sarek-wrapper")


def test_catalog_entry_mirrors_skill_frontmatter():
    fm = _read_frontmatter()
    meta = fm.get("metadata", {})
    entry = _catalog_entry()

    assert entry["description"] == fm["description"]
    assert entry["version"] == meta["version"]
    assert entry["tags"] == meta["tags"]
    assert entry["trigger_keywords"] == meta["openclaw"]["trigger_keywords"]
