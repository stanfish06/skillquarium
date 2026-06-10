#!/usr/bin/env python3
"""Rebuild the optional local Graphify graph for this skills vault.

This is intentionally separate from build.py because Graphify can run an
LLM-backed semantic extraction pass. Keep build.py fast for CI; run this script
manually when you want to refresh graphify-out/.

Default scope is the navigation layer: root wrapper notes, maps/, AGENTS.md,
README.md, install-skills.sh, .github/, and .skill-vault/ tooling docs/scripts.
Use --full to include every skill folder, which is much larger and may cost
real time or LLM tokens.
"""
from __future__ import annotations

import argparse
import os
import shlex
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GRAPH_DIR = ROOT / "graphify-out"
DEFAULT_INCLUDE_DIRS = {"maps", ".github", ".skill-vault"}
SUPPORTED_BACKENDS = (
    "azure",
    "bedrock",
    "claude",
    "claude-cli",
    "deepseek",
    "gemini",
    "kimi",
    "ollama",
    "openai",
)
BACKEND_REASON_EXPLICIT = "explicit"
BACKEND_REASON_API_KEY = "auto from exported API key"
BACKEND_REASON_CLAUDE_CLI = "auto fallback through local Claude Code CLI"
BACKEND_REASON_MISSING = "missing"
DEFAULT_EXTRA_EXCLUDES = [
    "graphify-out/",
    ".git/",
    ".obsidian/",
    ".skill-vault/skill-lock.json",
    "__pycache__/",
    "screenshot.png",
    "Untitled.*",
]
LLM_ENV_KEYS = (
    "GEMINI_API_KEY",
    "GOOGLE_API_KEY",
    "MOONSHOT_API_KEY",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "DEEPSEEK_API_KEY",
    "AZURE_OPENAI_API_KEY",
)
MODEL_ENV_BY_BACKEND = {
    "azure": "GRAPHIFY_AZURE_MODEL",
    "bedrock": "GRAPHIFY_BEDROCK_MODEL",
    "claude-cli": "GRAPHIFY_CLAUDE_CLI_MODEL",
    "deepseek": "GRAPHIFY_DEEPSEEK_MODEL",
    "gemini": "GRAPHIFY_GEMINI_MODEL",
    "ollama": "OLLAMA_MODEL",
    "openai": "GRAPHIFY_OPENAI_MODEL",
}


def has_llm_api_key() -> bool:
    return any(os.environ.get(key) for key in LLM_ENV_KEYS)


def unique(patterns: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for pattern in patterns:
        if pattern not in seen:
            seen.add(pattern)
            result.append(pattern)
    return result


def overview_excludes(root: Path) -> list[str]:
    excludes = list(DEFAULT_EXTRA_EXCLUDES)
    for child in sorted(root.iterdir(), key=lambda path: path.name):
        if child.is_dir() and child.name not in DEFAULT_INCLUDE_DIRS:
            excludes.append(f"{child.name}/")
    return unique(excludes)


def choose_backend(requested: str | None) -> tuple[str | None, str]:
    if requested:
        return requested, BACKEND_REASON_EXPLICIT
    if has_llm_api_key():
        return None, BACKEND_REASON_API_KEY
    if shutil.which("claude"):
        return "claude-cli", BACKEND_REASON_CLAUDE_CLI
    return None, BACKEND_REASON_MISSING


def configure_model_env(
    backend: str | None,
    model: str | None,
    env: dict[str, str],
) -> str | None:
    """Propagate model overrides to graphify commands that lack --model support."""
    if not model:
        return None
    if backend is None:
        print(
            "warning: --model cannot be propagated to cluster-only without an "
            "explicit --backend; extraction will receive --model, but labeling "
            "may use graphify's backend default.",
            file=sys.stderr,
        )
        return None
    model_env_key = MODEL_ENV_BY_BACKEND.get(backend)
    if model_env_key is None:
        print(
            f"warning: graphify exposes no cluster-only model env override for "
            f"backend {backend!r}; extraction will receive --model, but labeling "
            "may use graphify's backend default.",
            file=sys.stderr,
        )
        return None
    env[model_env_key] = model
    return model_env_key


def quote(cmd: list[str]) -> str:
    return shlex.join(str(part) for part in cmd)


def run(cmd: list[str], *, env: dict[str, str], dry_run: bool) -> int:
    print(quote(cmd))
    if dry_run:
        return 0
    try:
        subprocess.run(cmd, cwd=ROOT, env=env, check=True)
    except subprocess.CalledProcessError as exc:
        print(
            f"error: command failed with exit code {exc.returncode}: {quote(cmd)}",
            file=sys.stderr,
        )
        return exc.returncode or 1
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Rebuild graphify-out/ for the skills vault."
    )
    parser.add_argument(
        "--full",
        action="store_true",
        help="include every skill folder instead of only the navigation layer",
    )
    parser.add_argument(
        "--backend",
        choices=SUPPORTED_BACKENDS,
        help="Graphify LLM backend; defaults to API-key autodetect or claude-cli",
    )
    parser.add_argument(
        "--model",
        help=(
            "backend model override; for claude-cli this sets "
            "GRAPHIFY_CLAUDE_CLI_MODEL"
        ),
    )
    parser.add_argument(
        "--claude-cli-model",
        default=os.environ.get("GRAPHIFY_CLAUDE_CLI_MODEL", "haiku"),
        help="Claude CLI model alias/id when using claude-cli (default: haiku)",
    )
    parser.add_argument(
        "--no-tree",
        action="store_true",
        help="skip graphify tree HTML generation",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="print graphify commands without running extraction",
    )
    parser.add_argument(
        "extra_graphify_args",
        nargs=argparse.REMAINDER,
        help="extra args for graphify extract after --",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if shutil.which("graphify") is None:
        print("error: graphify is not on PATH; run install-skills.sh first", file=sys.stderr)
        return 127

    backend, backend_reason = choose_backend(args.backend)
    if backend is None and backend_reason == BACKEND_REASON_MISSING and not args.dry_run:
        print(
            "error: no Graphify LLM backend is configured. Export an API key, "
            "install/authenticate the Claude Code CLI, or pass --backend ollama.",
            file=sys.stderr,
        )
        return 2

    env = dict(os.environ)
    model = args.model
    if backend == "claude-cli":
        env["GRAPHIFY_CLAUDE_CLI_MODEL"] = model or args.claude_cli_model
        model = None
    model_env_key = configure_model_env(backend, model, env)

    excludes = DEFAULT_EXTRA_EXCLUDES if args.full else overview_excludes(ROOT)

    extract_cmd = ["graphify", "extract", str(ROOT), "--out", str(ROOT)]
    if backend:
        extract_cmd.extend(["--backend", backend])
    if model:
        extract_cmd.extend(["--model", model])
    for pattern in excludes:
        extract_cmd.extend(["--exclude", pattern])
    if args.extra_graphify_args:
        extra = args.extra_graphify_args
        if extra and extra[0] == "--":
            extra = extra[1:]
        extract_cmd.extend(extra)

    cluster_cmd = ["graphify", "cluster-only", str(ROOT)]
    if backend:
        cluster_cmd.append(f"--backend={backend}")

    tree_cmd = [
        "graphify",
        "tree",
        "--graph",
        str(GRAPH_DIR / "graph.json"),
        "--output",
        str(GRAPH_DIR / "GRAPH_TREE.html"),
        "--root",
        str(ROOT),
        "--label",
        "my-skills",
    ]

    scope = "full repository" if args.full else "navigation layer"
    print(f"Graphify scope: {scope}")
    print(f"Backend: {backend or 'graphify auto'} ({backend_reason})")
    if backend == "claude-cli":
        print(f"Claude CLI model: {env['GRAPHIFY_CLAUDE_CLI_MODEL']}")
    elif model_env_key:
        print(f"Cluster label model env: {model_env_key}={env[model_env_key]}")
    print()

    status = run(extract_cmd, env=env, dry_run=args.dry_run)
    if status:
        return status
    status = run(cluster_cmd, env=env, dry_run=args.dry_run)
    if status:
        return status
    if not args.no_tree:
        status = run(tree_cmd, env=env, dry_run=args.dry_run)
        if status:
            return status

    if args.dry_run:
        print("\nDry run only; graphify-out/ was not changed.")
    else:
        print(f"\nGraphify graph rebuilt in {GRAPH_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
