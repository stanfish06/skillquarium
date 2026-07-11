"""Cross-OS portability guard: remap_paths invocations must use `python3`.

`remap_paths.py` ships with a `#!/usr/bin/env python3` shebang, and modern macOS
plus many Linux distributions provide only `python3`, not a bare `python`. Every
instruction that tells a user to run the bundled remap helper — in the script's
own help/usage text or in a generated `commands.sh` note — must therefore say
`python3`, or the suggested command fails with `python: command not found`.

This is a fast, static regression guard for that portability fix.
"""

import re
from pathlib import Path

_SKILL_DIR = Path(__file__).resolve().parent.parent
# Source files that may emit user-facing `remap_paths.py` invocation instructions.
_SOURCES = ("remap_paths.py", "reporting.py", "repro_commands.py")
# A bare `python remap_paths.py` / `python reproducibility/remap_paths.py` not
# preceded by `3`, a letter, `_` or `.` (so `python3`, `mypython` are not matched).
_BARE_PYTHON_REMAP = re.compile(r"(?<![3A-Za-z_.])python (?:reproducibility/)?remap_paths\.py")


def test_no_bare_python_remap_invocation_in_sources():
    offenders = []
    for name in _SOURCES:
        path = _SKILL_DIR / name
        if not path.exists():
            continue
        for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if _BARE_PYTHON_REMAP.search(line):
                offenders.append(f"{name}:{lineno}: {line.strip()}")
    assert not offenders, (
        "remap_paths.py has a `python3` shebang; instructions must invoke it with "
        "`python3` for portability to python3-only systems. Offending lines:\n"
        + "\n".join(offenders)
    )
