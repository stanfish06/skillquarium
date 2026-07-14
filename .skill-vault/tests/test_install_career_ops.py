import os
from pathlib import Path
import shlex
import subprocess
import tempfile
import unittest


REPO_ROOT = Path(__file__).resolve().parents[2]
HELPER = REPO_ROOT / ".skill-vault" / "install-career-ops.sh"


class CareerOpsInstallerTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.home = self.root / "home"
        self.home.mkdir()
        self.workspace = self.home / "career-ops"
        self.log_path = self.root / "commands.log"

    def make_workspace(self):
        (self.workspace / ".git").mkdir(parents=True)
        (self.workspace / "update-system.mjs").write_text("// test updater\n")

    def run_installer(self, **overrides):
        environment = os.environ.copy()
        environment.update(
            {
                "HOME": str(self.home),
                "CAREER_OPS_DIR": str(self.workspace),
                "COMMAND_LOG": str(self.log_path),
            }
        )
        environment.update(overrides)

        script = f"""
source {shlex.quote(str(HELPER))}
npx() {{
  printf 'npx' >> "$COMMAND_LOG"
  printf ' %s' "$@" >> "$COMMAND_LOG"
  printf '\n' >> "$COMMAND_LOG"
}}
install_career_ops
"""
        return subprocess.run(
            ["bash", "-c", script],
            cwd=REPO_ROOT,
            env=environment,
            text=True,
            capture_output=True,
            check=False,
        )

    def command_log(self):
        if not self.log_path.exists():
            return []
        return self.log_path.read_text().splitlines()

    def test_bootstraps_missing_workspace_with_pinned_scaffolder(self):
        result = self.run_installer()

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(
            self.command_log(),
            [f"npx -y @santifer/career-ops@1.19.0 init {self.workspace}"],
        )

    def test_skip_avoids_all_work(self):
        result = self.run_installer(CAREER_OPS_SKIP="1")

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.command_log(), [])
        self.assertIn("skipped", result.stdout)

    def test_freeze_leaves_existing_workspace_untouched(self):
        self.make_workspace()

        result = self.run_installer(CAREER_OPS_AUTO_UPDATE="0")

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.command_log(), [])
        self.assertIn("frozen", result.stdout)

    def test_rejects_existing_non_workspace_directory(self):
        self.workspace.mkdir()

        result = self.run_installer()

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("not a valid Career Ops workspace", result.stderr)


if __name__ == "__main__":
    unittest.main()
