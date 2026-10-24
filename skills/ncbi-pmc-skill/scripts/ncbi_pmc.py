#!/usr/bin/env python3
"""Explain retirement of the legacy PMC Open Access service without network access."""

from __future__ import annotations

import json
import sys


def error(code: str, message: str) -> dict[str, object]:
    return {"ok": False, "error": {"code": code, "message": message}, "warnings": []}


def execute(payload: object) -> dict[str, object]:
    if not isinstance(payload, dict):
        raise ValueError("Input must be one JSON object.")
    # The old availability/file-link response has no compatible replacement endpoint.
    return {
        **error(
            "service_retired",
            "The PMC OA Web Service was withdrawn on 2026-08-25. "
            "Use paper-lookup for eligible full text or ncbi-entrez-skill for PMC metadata.",
        ),
        "source": "ncbi-pmc-oa",
        "retired_on": "2026-08-25",
        "documentation": "https://pmc.ncbi.nlm.nih.gov/tools/oa-service/",
        "alternatives": [
            {"skill": "paper-lookup", "use": "Eligible article text via E-utilities, BioC, or Europe PMC"},
            {"skill": "ncbi-entrez-skill", "use": "PMC search, identifiers, and metadata"},
        ],
    }


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        output = error("invalid_json", f"Could not parse JSON input: {exc}")
        code = 2
    else:
        try:
            output = execute(payload)
        except ValueError as exc:
            output = error("invalid_input", str(exc))
            code = 2
        else:
            code = 1
    sys.stdout.write(json.dumps(output) + "\n")
    return code


if __name__ == "__main__":
    raise SystemExit(main())
