#!/usr/bin/env python3
"""Regression tests for assets/lean-compile-gate.sh, using a stub compiler."""

from __future__ import annotations

import os
import shutil
import stat
import subprocess
import tempfile
import time
import unittest
from pathlib import Path

GATE = Path(__file__).resolve().parent.parent / "assets" / "lean-compile-gate.sh"
STUB = """#!/bin/bash
echo "start $(date +%s.%N) $(basename "$PWD") ${LEAN_GATE_SLOT:-none}" >> "$GATE_TEST_LOG"
sleep 0.6
echo "end $(date +%s.%N) $(basename "$PWD") ${LEAN_GATE_SLOT:-none}" >> "$GATE_TEST_LOG"
"""


@unittest.skipUnless(shutil.which("flock"), "flock not available")
class CompileGateTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = Path(tempfile.mkdtemp()).resolve()
        bin_dir = self.tmp / "bin"
        bin_dir.mkdir()
        self.lean = bin_dir / "lean"
        shutil.copy(GATE, self.lean)
        (bin_dir / "lean.real").write_text(STUB)
        for path in (self.lean, bin_dir / "lean.real"):
            path.chmod(path.stat().st_mode | stat.S_IXUSR)
        for name in ("proj", "main", "other"):
            (self.tmp / name).mkdir()
        self.log = self.tmp / "log"
        self.env = dict(
            os.environ,
            LEAN_GATE_SLOTS="2",
            LEAN_GATE_PREFIXES=str(self.tmp / "proj"),
            LEAN_GATE_RESERVED=str(self.tmp / "main"),
            LEAN_GATE_DIR=str(self.tmp / "locks"),
            GATE_TEST_LOG=str(self.log),
        )
        self.env.pop("LEAN_GATE_SLOT", None)

    def tearDown(self) -> None:
        shutil.rmtree(self.tmp)

    def run_in(self, names: list[str], arg: str = "X.lean") -> None:
        procs = [
            subprocess.Popen([str(self.lean), arg], cwd=self.tmp / n, env=self.env,
                             stderr=subprocess.DEVNULL)
            for n in names
        ]
        for p in procs:
            self.assertEqual(p.wait(timeout=30), 0)

    def events(self) -> list[tuple[float, int, str, str]]:
        out = []
        for line in self.log.read_text().splitlines():
            kind, t, where, slot = line.split()
            out.append((float(t), 1 if kind == "start" else -1, where, slot))
        return sorted(out, key=lambda e: (e[0], e[1]))

    def max_concurrent(self, where: str) -> int:
        cur = best = 0
        for _, delta, w, _ in self.events():
            if w == where:
                cur += delta
                best = max(best, cur)
        return best

    def test_shared_slots_bound_project_compiles(self) -> None:
        self.run_in(["proj"] * 5)
        self.assertEqual(self.max_concurrent("proj"), 2)

    def test_reserved_checkout_is_not_blocked(self) -> None:
        start = time.monotonic()
        procs = [subprocess.Popen([str(self.lean), "X.lean"], cwd=self.tmp / "proj",
                                  env=self.env, stderr=subprocess.DEVNULL) for _ in range(2)]
        time.sleep(0.2)
        self.run_in(["main"])
        self.assertLess(time.monotonic() - start, 1.1)
        for p in procs:
            p.wait(timeout=30)
        slots = {s for _, d, w, s in self.events() if w == "main" and d == 1}
        self.assertEqual(slots, {"2"})

    def test_other_directories_and_non_compiles_are_ungated(self) -> None:
        self.run_in(["other"] * 3)
        self.assertEqual(self.max_concurrent("other"), 3)
        self.log.unlink()
        self.run_in(["proj"] * 3, arg="--version")
        self.assertEqual(self.max_concurrent("proj"), 3)

    def test_unavailable_lock_directory_exits_without_compiling(self) -> None:
        blocked = self.tmp / "not-a-directory"
        blocked.write_text("occupied")
        self.env["LEAN_GATE_DIR"] = str(blocked / "locks")
        result = subprocess.run([str(self.lean), "X.lean"], cwd=self.tmp / "proj",
                                env=self.env, capture_output=True, text=True, timeout=3, check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("cannot create lock directory", result.stderr)
        self.assertFalse(self.log.exists())

    def test_unopenable_lock_file_exits_without_compiling(self) -> None:
        locks = Path(self.env["LEAN_GATE_DIR"])
        (locks / "slot0").mkdir(parents=True)
        result = subprocess.run([str(self.lean), "X.lean"], cwd=self.tmp / "proj",
                                env=self.env, capture_output=True, text=True, timeout=3, check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("cannot open lock file", result.stderr)
        self.assertFalse(self.log.exists())

    def test_invalid_slot_counts_exit_without_compiling(self) -> None:
        for slots in ("0", "-1", "not-a-number", "1.5", "18446744073709551616"):
            for checkout in ("proj", "main"):
                with self.subTest(slots=slots, checkout=checkout):
                    env = dict(self.env, LEAN_GATE_SLOTS=slots)
                    result = subprocess.run([str(self.lean), "X.lean"], cwd=self.tmp / checkout,
                                            env=env, capture_output=True, text=True, timeout=3, check=False)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn("LEAN_GATE_SLOTS must be a positive integer", result.stderr)
                    self.assertFalse(self.log.exists())

    def test_flock_errors_are_not_treated_as_contention(self) -> None:
        flock = self.tmp / "bin" / "flock"
        flock.write_text("#!/bin/bash\nexit 2\n")
        flock.chmod(0o755)
        self.env["PATH"] = str(flock.parent) + os.pathsep + self.env["PATH"]
        result = subprocess.run([str(self.lean), "X.lean"], cwd=self.tmp / "proj",
                                env=self.env, capture_output=True, text=True, timeout=3, check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("cannot lock", result.stderr)
        self.assertFalse(self.log.exists())


if __name__ == "__main__":
    unittest.main()
