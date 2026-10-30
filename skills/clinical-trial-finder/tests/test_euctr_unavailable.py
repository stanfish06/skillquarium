"""Keep unavailable European coverage distinct from a genuine empty search."""

import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SKILL_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SKILL_DIR))

import clinical_trial_finder as finder
import euctr


class EuctrUnavailableTests(unittest.TestCase):
    def test_direct_fetch_reports_unavailable_without_network(self):
        with (
            patch("urllib.request.urlopen") as request,
            self.assertRaisesRegex(RuntimeError, "No European registry search"),
        ):
            euctr.fetch_euctr("BRCA1")
        request.assert_not_called()

    def test_cli_rejects_before_queries_or_outputs_for_every_input_mode(self):
        modes = [
            ["--query", "breast cancer"],
            ["--gene", "BRCA1"],
            ["--rsid", "rs3798220"],
            ["--input", "missing-query-file.txt"],
            ["--demo"],
        ]
        for mode in modes:
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as temporary:
                output = Path(temporary) / "output"
                stdout, stderr = io.StringIO(), io.StringIO()
                args = [
                    "clinical_trial_finder.py",
                    *mode,
                    "--euctr",
                    "--output",
                    str(output),
                ]
                with (
                    patch.object(sys, "argv", args),
                    patch.object(finder, "fetch_trials") as ctgov,
                    patch.object(finder, "parse_input") as parse_input,
                    patch("urllib.request.urlopen") as request,
                    contextlib.redirect_stdout(stdout),
                    contextlib.redirect_stderr(stderr),
                    self.assertRaises(SystemExit) as exit_status,
                ):
                    finder.main()
                self.assertEqual(exit_status.exception.code, 2)
                self.assertIn("No European registry search", stderr.getvalue())
                self.assertIn("ClinicalTrials.gov only", stderr.getvalue())
                self.assertEqual(stdout.getvalue(), "")
                self.assertFalse(output.exists())
                ctgov.assert_not_called()
                parse_input.assert_not_called()
                request.assert_not_called()

    def test_ctgov_only_genuine_empty_result_still_writes_outputs(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "output"
            args = [
                "clinical_trial_finder.py",
                "--query",
                "unmatched-condition",
                "--output",
                str(output),
                "--fhir",
            ]
            with (
                patch.object(sys, "argv", args),
                patch.object(finder, "fetch_trials", return_value=[]) as ctgov,
                patch.object(finder, "write_phase_chart", return_value=None),
                contextlib.redirect_stdout(io.StringIO()),
            ):
                finder.main()
            ctgov.assert_called_once()
            summary = json.loads((output / "summary.json").read_text())
            self.assertEqual(summary["total"], 0)
            self.assertEqual(summary["source"], "clinicaltrials.gov/api/v2")
            self.assertEqual(summary["trials"], [])
            self.assertEqual(
                json.loads((output / "fhir_bundle.json").read_text())["total"], 0
            )
            for name in [
                "report.md",
                "report.html",
                "tables/trials.csv",
                "commands.sh",
                "checksums.sha256",
            ]:
                self.assertTrue((output / name).is_file(), name)


if __name__ == "__main__":
    unittest.main()
