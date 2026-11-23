# Verification Runbook for sbxenv.yaml commands

User-run integration checks; not executed by repository validation. `sbx env`
is experimental. Require a supported local runtime. Sign-in is per app: a
session from plain `sbx login` does not sign in the isolated `--app-name`
app, so sign it in once in step 1. These files use the shell agent without
provider secrets. Run from the skill directory in one shell. Review each
generated host command before approval. Recorded results are in
`runtime-results.md`.
Never pass `--force` to `create`/`run` here: each plan is approved
interactively after review.

## 0. Verify the kit helper against live Docker Hub

```bash
python3 -I scripts/kits.py search claude
python3 -I scripts/kits.py update sbx/playwright
python3 -I scripts/kits.py pin "$(python3 -I scripts/kits.py update sbx/playwright \
  | python3 -I -c 'import json,sys; print(json.load(sys.stdin)[0]["suggested"])')"
python3 -I scripts/kits.py update sbx/no-such-kit-for-this-check; echo "exit=$?"
```
Pass: `search` returns v3 kits as JSON; `update` returns a `suggested`
reference ending in `:<newestRelease>`; `pin` keeps that same tag and adds a
`@sha256:` digest; the missing repository yields `exit=1` with an `error`
that says `repository not found` (a connection error here means the check
did not run). These calls only read public registries. Offline behavior is
covered by `scripts/test_kits_helper.py` in repository validation.

## 1. Prepare unique scratch files and an isolated app

```bash
APP="env-$(date +%s)-$$"  # unique suffix, at most 20 characters
sbx --app-name "$APP" login   # interactive sign-in for this isolated app only
WORK=$(mktemp -d)
mkdir "$WORK/minimal" "$WORK/empty" "$WORK/hooks" "$WORK/remove" "$WORK/never"
cp assets/sbxenv.yaml "$WORK/minimal/sbxenv.yaml"
cat > "$WORK/empty/sbxenv.yaml" <<'YAML'
schemaVersion: "1"
name: env-check-empty
agent: shell
YAML
cat > "$WORK/hooks/sbxenv.yaml" <<'YAML'
schemaVersion: "1"
name: env-check-hooks
agent: shell
lifecycle:
  initialize:
    - command: printf 'initialize-ran\n' >> initialize.log
  postCreate:
    - command: printf 'post-create-ran\n' >> post-create.log
YAML
cat > "$WORK/remove/sbxenv.yaml" <<'YAML'
schemaVersion: "1"
name: env-check-remove
agent: shell
lifecycle:
  preRemove:
    - command: exit 1
YAML
cat > "$WORK/never/sbxenv.yaml" <<'YAML'
schemaVersion: "1"
name: env-check-never
agent: shell
YAML
```
Pass: each scenario has its own file and distinct explicit or derived name.
No files outside the scratch directory are edited.

## 2. Verify plan-only behavior and omitted workspace

```bash
sbx --app-name "$APP" env plan "$WORK/minimal"
sbx --app-name "$APP" env plan "$WORK/empty"
```
Pass: both print apply plans without creating a sandbox, recording approval,
or running commands. The first declares the directory holding its file as
a workspace; the second declares no workspace. Plan itself never prompts;
this does not prove that a later create/run will apply silently.

## 3. Verify initialize reruns but postCreate runs only once

```bash
sbx --app-name "$APP" policy init balanced
sbx --app-name "$APP" env run -d "$WORK/hooks"
sbx --app-name "$APP" env run -d "$WORK/hooks"
sbx --app-name "$APP" env exec "$WORK/hooks" -- pwd
cat "$WORK/hooks/initialize.log"
cat "$WORK/hooks/post-create.log"
```
Approve both invocations interactively after reviewing the plan. Pass: two
`initialize-ran` lines and one `post-create-ran` line; exec adds neither.
Initialize runs from the project directory on the host on every create/run,
including reattachment. PostCreate runs on the host once after creation.
This assumes the default `env.rememberHostCommands` setting, not an override
that remembers consent.

## 4. Verify unchanged approved configuration without host commands is silent

```bash
sbx --app-name "$APP" env run -d "$WORK/empty"
sbx --app-name "$APP" env run -d "$WORK/empty"
```
Approve the first invocation interactively; do not use auto-approve. Pass:
the second run reuses the same sandbox without an approval prompt because
nothing changed and the file declares no host commands.

## 5. Verify preRemove failure does not prevent removal

```bash
sbx --app-name "$APP" env create "$WORK/remove"
sbx --app-name "$APP" env rm "$WORK/remove"
```
Review and approve both the create plan and the destroy plan. Pass: removal
warns that preRemove did not finish but still removes this sandbox. The
hook is the known `exit 1` command, not an untrusted archival script.

## 6. Verify non-interactive env exec does not create a missing sandbox

```bash
sbx --app-name "$APP" --no-input env exec "$WORK/never" -- echo hi < /dev/null; echo "exit=$?"
sbx --app-name "$APP" --no-input env exec "$WORK/empty" -- echo hi < /dev/null; echo "exit=$?"
```
Pass: the first fails with `exit=125` and an error saying the sandbox does
not exist (create it first with `sbx env create`); an error about sign-in or
the daemon means the check did not run. The second, against the sandbox
step 4 created, prints `hi` with `exit=0`. Without `--no-input`, in an
interactive terminal, the first command instead offers to create the
sandbox; decline it here.

## 7. Verify mount-root environment file protection

```bash
sbx --app-name "$APP" env run -d "$WORK/minimal"
sbx --app-name "$APP" env exec "$WORK/minimal" -- sh -c 'test -f "$1" && echo x >> "$1"' sh "$WORK/minimal/sbxenv.yaml"
```
Approve creation. Pass: the file exists inside the sandbox and the write
fails with `Read-only file system` or `Permission denied`. A silent failure
without that message means `test -f` did not find the path; the check did
not run.
The file is directly at the workspace mount root (`workspace: .`). This
does not prove protection for files in a renameable subdirectory; those
have the rename gap described in SKILL.md.

## 8. Clean up only this disposable session

```bash
sbx --app-name "$APP" env rm --force "$WORK/minimal"
sbx --app-name "$APP" env rm --force "$WORK/empty"
sbx --app-name "$APP" env rm --force "$WORK/hooks"
sbx --app-name "$APP" daemon stop
rm -rf "$WORK"
```
Pass: the created environments are removed and the isolated daemon stops.
Forced removal is consented cleanup of these known test files only. If a
check failed early, inspect this app and remove any remaining test sandbox
before stopping its daemon; never substitute the default daemon.
