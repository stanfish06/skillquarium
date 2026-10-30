---
name: lean-elaboration-test
description: Run a repeatable elaboration test of ONE Lean 4 repo and write a dated report — snapshot size (date, commit, lines excluding comment-only files), clean project-only rebuild with wall/CPU/parallelism/RSS, heavy-tail and per-namespace breakdown, warm own-file profiles of the worst files with likely causes, and improvement suggestions. Use when asked to run an elaboration test, profile a repo build, or track elaboration health over time.
---

# Lean Elaboration Test

A standardized, comparable snapshot of how one repository elaborates. The
method incorporates repeated report-series corrections for partial default
targets, contention artifacts, and build-log versus own-file timing.

**Scope rule: elaborate JUST THIS REPO.** Never mathlib, never upstream
path-dependencies (their oleans are inputs, not measurands). A healthy timed
build compiles only this repo's own modules; if the log shows upstream
compilation, the run is invalid — kill it, fix the cache, restart.

The companion skill **lean-elaboration** consumes this test's findings.

## Phase 0 — Preconditions (all mandatory)

1. **Sync if asked / note the commit.** All size numbers come from git at the
   measured commit, never `find` on a working tree (mid-flight agent edits
   corrupted a baseline once): `git rev-parse HEAD`, `git status --short`.
   Require `git diff --quiet HEAD -- '*.lean'` before a commit-attributed run;
   staged, modified, or deleted tracked Lean files must not enter the baseline.
   Review untracked `.lean` files and build configuration changes too. If they
   affect the selected target, stop or measure a separate explicitly labeled
   working-tree snapshot with matching size counts. Recheck source state after
   the run; concurrent source edits invalidate a commit-attributed baseline.
2. **Upstream olean guards.** Count oleans for Mathlib and any dependencies
   (e.g. `find .lake/packages/mathlib/.lake/build/lib -name '*.olean' | wc -l`);
   compare against repository-documented thresholds. If no threshold exists,
   verify that required dependency artifacts are populated before a timed run.
   If artifacts are missing, stop and use only the repository-approved cache
   restoration or one-time dependency setup procedure.
3. **Separate machine load from artifact ownership.** You may record
   `pgrep -x lake` and `ps -eo user,etime,args | grep -E "[l]ake|[l]ean "`
   (bracket trick so grep doesn't match itself) to disclose co-running load.
   Other checkouts' processes are load information, not a reason to refuse the
   test. Before artifact invalidation, require exclusive use of this checkout's
   build tree through a lock honored by every build wrapper, held through the
   timed run, or use an isolated checkout with its own project artifacts.
   Confirm that an isolated `.lake/build` does not resolve to a shared tree.
   A process listing alone cannot prevent a new same-checkout build from
   starting. If exclusive artifact ownership cannot be established, do not
   delete artifacts or run the clean baseline; report it as not performed.
4. **Read the repo's agent instructions** (olean preservation, guard hooks,
   default build target). Respect them; the test must be a no-op for
   everyone else on the machine.
5. **NEVER `lake clean`. NEVER `lake update`.**

## Phase 1 — Size snapshot

Record: **date (UTC), commit, .lean file count, total lines, non-comment code
lines, comment-only files excluded**. Use
[scripts/count_lean_lines.py](scripts/count_lean_lines.py) (self-contained;
counts from `git ls-tree` at the measured commit; a file is comment-only if
it has no non-comment, non-whitespace character — such files are excluded
from the file/line counts and listed by name). It also counts and lists
non-module files (no `module` header; `lakefile.lean` exempt). Record the
count. It must be 0; the script reports it but does not fail.

Also record what the *build root* covers if it differs from the git tree
(quarantined/off-facade modules make tree > built; report both).

**Verify the default target covers what you think it covers.** A prior report
series measured partial builds because the root facade silently omitted a
large subtree. Check the root `.lean` facade's imports, or
enumerate targets explicitly. Record the complete transitive set of project
modules selected by those targets, including the root facade. Map them to exact
git-tree source paths in `built-files.json`, a nonempty JSON array such as
`["Project.lean", "Project/Basic.lean"]`. Reconcile this manifest with all own-module
build records in Phase 2, including records without displayed timings; total
Lake job counts may include non-module jobs and are not a source-file count.

From the measured repository root, count the exact selected files with the
bundled counter (replace `<skill-dir>` with this installed skill's directory):

```bash
commit=$(git rev-parse HEAD)
python3 <skill-dir>/scripts/count_lean_lines.py "$commit" --files-from built-files.json
```

Use this count for built-module per-line metrics. Prefix filters alone do not
identify a target's dependency closure. Keep the unrestricted tree-wide count
as a separate size snapshot; do not include excluded or off-target modules in
the built denominator.

## Phase 2 — Clean project-only rebuild (the timed run)

Use the repository's guarded project-only rebuild command when it has one.
Establish exclusive artifact ownership as required by Phase 0 before calling
any wrapper that invalidates artifacts. If no wrapper exists, identify the exact
library root (for example `Project`) and prepare
an explicit project-artifact invalidation plan. Confirm every resolved path is
inside this repository's own build subtree and cannot match a dependency tree
before removing anything. A generic shape is:

```bash
rm -rf .lake/build/lib/lean/<Root>
rm -f .lake/build/lib/lean/<Root>.{olean,ilean,trace,olean.hash,ilean.hash}
rm -rf .lake/build/ir/<Root>
/usr/bin/time -v <repo-approved-build-command> > <unique-log-path> 2>&1
```

Treat the snippet as a template, not authorization to delete unresolved or
broad paths. Run invalidation and the build within the same exclusive lease;
an ad hoc lock that other builders do not honor offers no protection. Do not
use the template when local instructions provide a wrapper.

Use GNU `time -v` (gives %CPU and peak RSS; bash `time` doesn't): typically
`/usr/bin/time` on Linux or `gtime` on macOS, whose `/usr/bin/time` is BSD time.
Note the tool in the report — cross-tool CPU splits aren't comparable.

**Watch the first minutes**: any `.lake/packages/mathlib` compile lines, or
bulk upstream-module compiles → kill immediately, diagnose, do not let it
run.

Record from `/usr/bin/time -v` + the log:
- exit status, error count, `sorry` count (vs authorized list), warning count
- wall-clock (Elapsed), user CPU, sys CPU, total CPU (user + sys), %CPU, peak RSS
- total jobs (`[N/M]` progress lines), and confirm only own-repo modules
  compiled

## Phase 3 — Per-file extraction from the build log

```bash
rg --only-matching 'Built <Root>(\.[^ ]+)? \(([0-9.]+)s\)' <log>
```

The pattern includes the root module and its submodules; replace `<Root>` with
the regex-escaped root name. Check the pinned Lake version's log format before
using this seconds-only template. Lake's [build timing source](https://github.com/leanprover/lean4/blob/master/src/lake/Lake/Build/Common.lean)
uses `IO.monoMsNow`; inspect the corresponding file in the selected Lean tag
when checking a different toolchain.

- **Cumulative logged elapsed time** = Σ of displayed Built durations. Lake
  measures these with a monotonic clock, not a CPU clock. Sub-threshold timings
  may be omitted; report the timing-visible fraction of built modules.
- **Logged overlap ratio** = cumulative logged elapsed time ÷ wall-clock.
  Overlapping jobs and contention affect this ratio; it is not CPU parallelism.
- **Average CPU parallelism** = total CPU from Phase 2 ÷ wall-clock.
- **Per-line CPU cost** = total CPU ÷ built-module code lines (ms/line).
  If also reporting logged elapsed time per line, label it separately and
  disclose omitted timings. Use the exact Phase 1 module manifest as the
  denominator, not the whole git tree.
- **Heavy-tail tiers**: file counts ≥10s / ≥20s / ≥30s / ≥40s (the policy
  metric that should only ratchet down).
- **Top-30 worst files**, annotated `vs <prior report date>` where a prior
  snapshot exists.
- **Per-namespace / per-directory aggregation** of logged elapsed time with Δ vs
  prior — this localizes regressions to groups of files.

## Phase 4 — Warm own-file profiling of the worst files

Build wall-clock ≠ own-file cost (includes upstream rebuilds, olean/IR
writes, contention; ~25–40% inflated under parallel load, 2.5× observed).
Confirm each candidate **serially, after the build, one at a time**:

```bash
profile_log=$(mktemp "${TMPDIR:-/tmp}/lean-profile.XXXXXX")
if <repo-approved-lean-command> --profile <Root>/<Path>/File.lean > "$profile_log" 2>&1; then
  profile_status=0
else
  profile_status=$?
fi
tail -n 25 "$profile_log"
printf 'Lean exit status: %s; full log: %s\n' "$profile_status" "$profile_log"
(exit "$profile_status")
```

The last subshell returns Lean's status after displaying the tail; the full
log remains available. Classify the file only when `profile_status` is zero.

For the top 5–10 files record wall + the `cumulative profiling times` block
(typeclass inference / simp / elaboration / interpretation:<tactic> /
import / tactic execution / type checking), events >100ms. Classify each
file's dominant phase and likely cause:
- `import`-dominated → not a local problem; candidate is upstream or the
  file's import list.
- `interpretation:nlinarith`/`linarith` → arithmetic-closer elimination.
- `typeclass inference`, few large events → head-class cache candidate (name
  the searched class! e.g. eight ~1s `SMul` searches = one missing cache).
- `typeclass inference`, thousands of sub-100ms events → diffuse floor;
  don't promise a fix.
- large unattributed `elaboration` → rerun with
  `-D trace.profiler.output=out.json` for per-declaration attribution before
  claiming a cause.

## Phase 5 — Trend comparison (when prior reports exist)

- Compare wall-clock and logged elapsed times only with the same timing tool,
  build scope, toolchain, and comparable parallelism and machine load. Report
  measured total CPU separately; neither logged elapsed time nor default
  profile phase time is immune to contention.
- Contention artifact check before believing any regression: (a) user CPU
  down while logged-sum up? (b) parallelism jumped? (c) same-file timings
  moving in opposite directions? Any two → report the run as
  contention-bound and skip structural conclusions.
- Predicted-vs-actual: Δbuilt code lines × prior CPU ms/line vs actual Δtotal
  CPU. Big ratios (>2×) warrant checking load and downstream effects before
  attributing the change to code growth or a regression.
- Flag any single file on a monotonic climb across ≥3 reports.

## Phase 6 — The report

Write `ELABORATION_REPORT_<YYYY-MM-DD>.md` (or the repo's established
naming) at the repo root. Sections, in order:

1. **Setup/provenance** — date-time window, commit, host, tool, exact
   commands, co-running load observed, which build target.
2. **Size snapshot** — files, lines, non-comment lines, comment-only files
   excluded, built-vs-tree scope note.
3. **Headline table** — wall, user/sys/total CPU, %CPU, average CPU parallelism,
   logged elapsed sum and overlap ratio, peak RSS, jobs, built-module per-line
   CPU ms; columns vs prior snapshots with comparability caveats.
4. **Build health** — exit status, errors, sorries vs authorized, warning
   census (top kinds), rule compliance (no upstream compiles, file-size
   limits, heartbeat overrides).
5. **Heavy tail** — tier table (≥10/20/30/40s) with Δ vs prior; top-30 files.
6. **Per-namespace logged elapsed time** with Δ vs prior.
7. **Own-file profiles** of the worst files — the phase table, dominant
   category per file.
8. **Findings ranked by actionability** — each with the evidence, the named
   lever (per the lean-elaboration skill), and expected value; separate
   "measurement only, no fix applied" honestly.
9. **What is NOT established** — unattributed time, unprofiled tails,
   contention limits. Every number a future reader might over-trust gets a
   caveat here.
10. **Methodology** — commands verbatim, so the next run is identical.
11. **Pointers** — prior reports with their roles (last clean baseline, peak
    regression, etc.).

## Cost & etiquette notes

- The timed rebuild can be expensive. Estimate from the repository's prior
  reports when available; on a shared machine, warn before
  running. Other agents' builds may run concurrently; record the load and mark
  timing comparisons contention-bound when appropriate. Concurrent builds must
  use separate artifact trees; keep the Phase 0 exclusive-ownership guard.
- Profiling (Phase 4) is cheap (~10–60s/file) but must be serial.
- If the measured artifact tree changes concurrently, report clearly that the
  numbers are contaminated; do not infer contamination from a process listing.
- The report is measurement; applying fixes is the lean-elaboration skill's
  loop with per-change A/B — do not mix the two in one pass.
