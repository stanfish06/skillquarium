#!/usr/bin/env python3
"""Import K-Dense scientific-agents profiles as native SKILL.md folders.

The upstream repository stores each expert profile as:

    scientific-agents/<slug>/AGENTS.md

This vault and the skills CLI discover folders that contain SKILL.md, so this
script converts the upstream profiles into first-class skills while preserving
the original profile body and source provenance.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import textwrap
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_REPO = "K-Dense-AI/scientific-agents"
SOURCE_URL = "https://github.com/K-Dense-AI/scientific-agents"


def folded(text: str, *, width: int = 88, indent: str = "  ") -> str:
    lines = []
    for paragraph in text.splitlines() or [""]:
        if not paragraph.strip():
            lines.append(indent.rstrip())
            continue
        lines.extend(textwrap.wrap(paragraph, width=width, initial_indent=indent,
                                   subsequent_indent=indent))
    return "\n".join(lines)


def source_commit(source: Path) -> str:
    try:
        return subprocess.check_output(
            ["git", "-C", str(source), "rev-parse", "HEAD"],
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def compact_description(agent: dict) -> str:
    work_mode = " ".join(agent.get("work_mode", "").split())
    summary = " ".join(agent.get("summary", "").split())
    if len(summary) > 320:
        summary = summary[:320].rsplit(" ", 1)[0].rstrip(" .;,") + "..."
    desc = f"Expert-thinking profile for {agent['profession']}"
    if work_mode:
        if len(work_mode) > 140:
            work_mode = work_mode[:140].rsplit(" ", 1)[0].rstrip(" /,;") + "..."
        desc += f" ({work_mode})"
    if summary:
        desc += f": {summary}"
    return desc


def render_skill(agent: dict, profile_body: str, commit: str) -> str:
    slug = agent["slug"]
    profession = agent["profession"]
    upstream_path = f"scientific-agents/{slug}/AGENTS.md"
    desc = compact_description(agent)
    summary = " ".join(agent.get("summary", "").split())
    work_mode = " ".join(agent.get("work_mode", "").split())

    frontmatter = [
        "---",
        f"name: {slug}",
        "description: >",
        folded(desc),
        "metadata:",
        f"  short-description: {profession} expert profile",
        f"  source-repo: {SOURCE_REPO}",
        f"  source-url: {SOURCE_URL}",
        f"  source-commit: {commit}",
        f"  source-path: {upstream_path}",
        f"  upstream-created: {agent.get('created', '')}",
        f"  upstream-updated: {agent.get('updated', '')}",
        f"  source-count: {agent.get('source_count', '')}",
        "  scientific-agents-profile: true",
        "---",
        "",
    ]

    intro = [
        f"# {profession} Expert Profile",
        "",
        f"Imported from [{SOURCE_REPO}]({SOURCE_URL}) at commit `{commit}`.",
        "",
        "Use this skill when the task benefits from a senior domain practitioner's",
        "operating model: how they frame problems, select methods, stress-test",
        "claims, watch for artifacts, and report uncertainty.",
        "",
        "This profile should be combined with project instructions, local protocols,",
        "tool-specific skills, and current primary sources. For medical, clinical,",
        "regulatory, or safety-critical work, treat it as research support rather",
        "than individualized professional advice.",
        "",
        "## Catalog Metadata",
        "",
        f"- Profession: {profession}",
        f"- Work mode: {work_mode or 'unspecified'}",
        f"- Upstream path: `{upstream_path}`",
        f"- Upstream source count: {agent.get('source_count', 'unknown')}",
    ]
    if summary:
        intro.append(f"- Catalog summary: {summary}")
    intro += ["", "## Imported Profile", "", profile_body.rstrip(), ""]
    return "\n".join(frontmatter + intro)


def render_dispatcher(agents: list[dict], commit: str) -> str:
    examples = [
        "bioinformatician",
        "single-cell-biologist",
        "clinical-epidemiologist",
        "computational-chemist",
        "materials-scientist",
        "astrophysicist",
        "statistician",
        "machine-learning-researcher",
    ]
    examples = [slug for slug in examples if any(a["slug"] == slug for a in agents)]
    catalog_lines = [
        f"- `{a['slug']}` - {a['profession']}: {' '.join(a.get('summary', '').split())}"
        for a in agents[:60]
    ]
    if len(agents) > 60:
        catalog_lines.append(f"- ... {len(agents) - 60} more profiles in references/catalog.json")

    return "\n".join([
        "---",
        "name: scientific-agents",
        "description: >",
        folded(
            "Dispatcher for the K-Dense scientific-agents collection. Use when you need "
            "to choose among imported scientific and engineering expert profiles, such "
            "as bioinformatician, clinical epidemiologist, materials scientist, "
            "astrophysicist, or machine-learning researcher."
        ),
        "metadata:",
        f"  short-description: K-Dense scientific-agents profile dispatcher",
        f"  source-repo: {SOURCE_REPO}",
        f"  source-url: {SOURCE_URL}",
        f"  source-commit: {commit}",
        "  source-path: catalog.json",
        "  scientific-agents-profile: true",
        "---",
        "",
        "# Scientific Agents Profile Dispatcher",
        "",
        f"This skill indexes {len(agents)} expert-thinking profiles imported from "
        f"[{SOURCE_REPO}]({SOURCE_URL}) at commit `{commit}`.",
        "",
        "Use it when the user asks for a scientific discipline perspective but no",
        "specific profile has been selected yet. Pick the closest imported profile,",
        "then read that profile's `SKILL.md` before acting.",
        "",
        "## Selection Rules",
        "",
        "- Prefer the narrowest relevant profile over a broad one.",
        "- Combine profession profiles with tool skills already in this vault.",
        "- For clinical, regulatory, safety, legal, or financial topics, verify current",
        "  primary sources and keep advice scoped to research support.",
        "- If several profiles fit, say which ones you are combining and why.",
        "",
        "## Useful Starting Profiles",
        "",
        *(f"- [{slug}](../{slug}/SKILL.md)" for slug in examples),
        "",
        "## Catalog Preview",
        "",
        *catalog_lines,
        "",
        "The complete upstream catalog is stored at `references/catalog.json`.",
        "",
    ])


def load_agents(source: Path) -> list[dict]:
    catalog_path = source / "catalog.json"
    with catalog_path.open(encoding="utf-8") as f:
        data = json.load(f)
    agents = data["agents"]
    for agent in agents:
        slug = agent["slug"]
        profile_path = source / "scientific-agents" / slug / "AGENTS.md"
        if not profile_path.is_file():
            raise FileNotFoundError(profile_path)
    return agents


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, help="Local checkout of K-Dense-AI/scientific-agents")
    parser.add_argument("--dest", type=Path, default=ROOT, help="Skills vault root")
    args = parser.parse_args()

    source = args.source.resolve()
    dest = args.dest.resolve()
    agents = load_agents(source)
    commit = source_commit(source)

    for agent in agents:
        slug = agent["slug"]
        profile_path = source / "scientific-agents" / slug / "AGENTS.md"
        skill_dir = dest / slug
        skill_dir.mkdir(parents=True, exist_ok=True)
        skill_text = render_skill(agent, profile_path.read_text(encoding="utf-8"), commit)
        (skill_dir / "SKILL.md").write_text(skill_text, encoding="utf-8")

    dispatcher_dir = dest / "scientific-agents"
    references_dir = dispatcher_dir / "references"
    references_dir.mkdir(parents=True, exist_ok=True)
    (dispatcher_dir / "SKILL.md").write_text(render_dispatcher(agents, commit), encoding="utf-8")
    shutil.copy2(source / "catalog.json", references_dir / "catalog.json")
    shutil.copy2(source / "README.md", references_dir / "README.md")
    shutil.copy2(source / "LICENSE.md", references_dir / "LICENSE.md")

    print(f"Imported {len(agents)} profiles plus dispatcher into {dest}")
    print(f"Source commit: {commit}")


if __name__ == "__main__":
    main()
