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

    def make_workspace(self, claude_contents=None):
        (self.workspace / ".git").mkdir(parents=True)
        (self.workspace / "update-system.mjs").write_text("// test updater\n")
        if claude_contents is not None:
            (self.workspace / "CLAUDE.md").write_text(claude_contents)

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
node() {{
  printf 'node' >> "$COMMAND_LOG"
  printf ' %s' "$@" >> "$COMMAND_LOG"
  printf '\n' >> "$COMMAND_LOG"

  if [ "$2" = "check" ]; then
    if [ -n "${{FAKE_CHECK_OUTPUT+x}}" ]; then
      printf '%s\n' "$FAKE_CHECK_OUTPUT"
    else
      printf '{{"status":"%s"}}\n' "${{FAKE_UPDATE_STATUS:-up-to-date}}"
    fi
    return "${{FAKE_CHECK_STATUS:-0}}"
  fi

  if [ "$2" = "apply" ]; then
    printf 'new system one\nnew system two\n' > "$CAREER_OPS_DIR/CLAUDE.md"
    return "${{FAKE_APPLY_STATUS:-0}}"
  fi

  return 64
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

    def test_up_to_date_does_not_apply(self):
        self.make_workspace()

        result = self.run_installer(FAKE_UPDATE_STATUS="up-to-date")

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.command_log(), ["node update-system.mjs check"])
        self.assertIn("up to date", result.stdout)

    def test_offline_status_warns_and_succeeds(self):
        self.make_workspace()

        result = self.run_installer(FAKE_UPDATE_STATUS="offline")

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("offline", result.stderr)
        self.assertEqual(self.command_log(), ["node update-system.mjs check"])

    def test_no_remote_version_warns_and_succeeds(self):
        self.make_workspace()

        result = self.run_installer(FAKE_UPDATE_STATUS="no-remote-version")

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("no-remote-version", result.stderr)
        self.assertEqual(self.command_log(), ["node update-system.mjs check"])

    def test_available_update_applies_once_and_preserves_local_instructions(self):
        self.make_workspace("system one\nsystem two\nlocal instruction\n")

        result = self.run_installer(FAKE_UPDATE_STATUS="update-available")

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(
            self.command_log(),
            ["node update-system.mjs check", "node update-system.mjs apply"],
        )
        self.assertEqual(
            (self.workspace / "CLAUDE.md").read_text(),
            "new system one\nnew system two\nlocal instruction\n",
        )

    def test_failed_apply_restores_local_instructions_and_fails(self):
        self.make_workspace("system one\nsystem two\nlocal instruction\n")

        result = self.run_installer(
            FAKE_UPDATE_STATUS="update-available", FAKE_APPLY_STATUS="23"
        )

        self.assertEqual(result.returncode, 23)
        self.assertEqual(
            (self.workspace / "CLAUDE.md").read_text(),
            "new system one\nnew system two\nlocal instruction\n",
        )
        self.assertIn("update failed", result.stderr)

    def test_repeated_updates_do_not_duplicate_local_instructions(self):
        self.make_workspace("system one\nsystem two\nlocal instruction\n")

        first = self.run_installer(FAKE_UPDATE_STATUS="update-available")
        second = self.run_installer(FAKE_UPDATE_STATUS="update-available")

        self.assertEqual(first.returncode, 0, first.stderr)
        self.assertEqual(second.returncode, 0, second.stderr)
        self.assertEqual(
            (self.workspace / "CLAUDE.md").read_text(),
            "new system one\nnew system two\nlocal instruction\n",
        )

    def test_update_without_local_instruction_tail_keeps_new_template(self):
        self.make_workspace("system one\nsystem two\n")

        result = self.run_installer(FAKE_UPDATE_STATUS="update-available")

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(
            (self.workspace / "CLAUDE.md").read_text(),
            "new system one\nnew system two\n",
        )

    def test_auto_update_removes_dismissed_marker(self):
        self.make_workspace()
        dismissed = self.workspace / ".update-dismissed"
        dismissed.write_text("career-ops-v1.19.0\n")

        result = self.run_installer(FAKE_UPDATE_STATUS="up-to-date")

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(dismissed.exists())

    def test_unknown_status_fails(self):
        self.make_workspace()

        result = self.run_installer(FAKE_UPDATE_STATUS="unexpected")

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("unknown career-ops update status", result.stderr)

    def test_malformed_status_fails(self):
        self.make_workspace()

        result = self.run_installer(FAKE_CHECK_OUTPUT="{")

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("malformed update status", result.stderr)

    def test_failed_check_fails(self):
        self.make_workspace()

        result = self.run_installer(FAKE_CHECK_STATUS="9")

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("update check failed", result.stderr)

    def test_root_installer_sources_and_calls_career_ops_helper(self):
        installer = (REPO_ROOT / "install-skills.sh").read_text()

        self.assertIn(
            'source "$VAULT_DIR/.skill-vault/install-career-ops.sh"', installer
        )
        self.assertEqual(installer.count("install_career_ops"), 1)


if __name__ == "__main__":
    unittest.main()
