"""Exercise git snapshot enumeration with paths Git normally quotes."""

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[3] / "skills/lean-elaboration-test/scripts/count_lean_lines.py"


class CountLeanLinesTests(unittest.TestCase):
    def run_snapshot(self, files_from: object, prefixes: tuple[str, ...] = ()) -> subprocess.CompletedProcess[str]:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        subprocess.run(["git", "init", "-q", str(root)], check=True)
        for name in ("Project.lean", "Project/Selected.lean", "Project/OffFacade.lean", "Löb\nResult.lean"):
            path = root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("module\ndef answer := 42\n", encoding="utf-8")
        subprocess.run(["git", "add", "--", "."], cwd=root, check=True)
        subprocess.run(["git", "-c", "user.name=Test", "-c", "user.email=test@example.com",
                        "commit", "-qm", "snapshot"], cwd=root, check=True)
        manifest = root / "built-files.json"
        manifest.write_text(json.dumps(files_from), encoding="utf-8")
        return subprocess.run([sys.executable, str(SCRIPT), "HEAD", *prefixes, "--files-from", str(manifest)],
                              cwd=root, capture_output=True, text=True, check=False)

    def test_unicode_and_newline_paths_are_counted_at_the_requested_commit(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            subprocess.run(["git", "init", "-q", str(root)], check=True)
            subprocess.run(["git", "config", "core.quotePath", "true"], cwd=root, check=True)
            for name in ("Regular.lean", "Löb.lean", "Line\nbreak.lean", "Carriage\r\nreturn.lean"):
                (root / name).write_text("module\ndef answer := 42\n", encoding="utf-8")
            subprocess.run(["git", "add", "--", "."], cwd=root, check=True)
            subprocess.run(["git", "-c", "user.name=Test", "-c", "user.email=test@example.com",
                            "commit", "-qm", "snapshot"], cwd=root, check=True)
            # Counts must use the committed blobs even when the working tree changes.
            (root / "Löb.lean").write_text("-- now comment-only\n", encoding="utf-8")
            (root / "Untracked.lean").write_text("module\n", encoding="utf-8")
            result = subprocess.run([sys.executable, str(SCRIPT), "HEAD"], cwd=root,
                                    check=True, capture_output=True, text=True)
            rows = dict(line.split(":", 1) for line in result.stdout.splitlines() if ":" in line)
            for key, expected in ((".lean files in tree", "4"), ("counted files", "4"),
                                  ("total lines (counted files)", "8"), ("non-comment code lines", "8"),
                                  ("non-module files", "0")):
                self.assertEqual(rows[key].strip(), expected, result.stdout)

    def test_exact_file_manifest_excludes_off_facade_modules(self) -> None:
        result = self.run_snapshot(["Project.lean", "Project/Selected.lean", "Löb\nResult.lean"])
        self.assertEqual(result.returncode, 0, result.stderr)
        rows = dict(line.split(":", 1) for line in result.stdout.splitlines() if ":" in line)
        self.assertEqual(rows[".lean files in tree"].strip(), "3", result.stdout)
        self.assertEqual(rows["non-comment code lines"].strip(), "6", result.stdout)

    def test_exact_file_manifest_rejects_untracked_and_invalid_entries(self) -> None:
        for content in (["Missing.lean"], ["Project.lean", "Project.lean"], [{}], {"files": []}, []):
            with self.subTest(content=content):
                result = self.run_snapshot(content)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("--files-from", result.stderr)
                self.assertNotIn("Traceback", result.stderr)

    def test_exact_file_manifest_cannot_be_combined_with_prefix_filters(self) -> None:
        result = self.run_snapshot(["Project.lean"], prefixes=("Project",))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("--files-from cannot be combined with PATH_PREFIX", result.stderr)


if __name__ == "__main__":
    unittest.main()
