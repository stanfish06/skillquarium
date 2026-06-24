"""API entry point for skill registry and orchestrator integration."""

import sys
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

_mod_path = Path(__file__).parent / "phylogenetics_builder.py"
_spec = spec_from_file_location("phylogenetics_builder", _mod_path)
_mod = module_from_spec(_spec)
_spec.loader.exec_module(_mod)


def run(input_path: str, output_dir: str = "/tmp/phylogenetics-builder") -> dict:
    """Run the skill programmatically. Returns result dict."""
    import json

    old_argv = sys.argv
    try:
        sys.argv = [
            "phylogenetics_builder.py",
            "--input",
            str(input_path),
            "--output",
            str(output_dir),
        ]
        _mod.main()
    finally:
        sys.argv = old_argv

    result_json = Path(output_dir) / "result.json"
    if result_json.exists():
        return json.loads(result_json.read_text())
    return {}
