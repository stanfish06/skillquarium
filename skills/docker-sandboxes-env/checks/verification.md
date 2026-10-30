# Verification Runbook for sbxenv.yaml commands

User-run integration checks; not executed during skill generation. `sbx env`
is experimental. Require a supported local runtime and an existing Docker
login; login is shared authentication, not scoped by `--app-name`. These
files use the shell agent without provider secrets. Run from the skill
directory in one shell. Review each generated host command before approval.

## 1. Prepare unique scratch files and an isolated app

```bash
APP="env-$(date +%s)-$$"  # unique suffix, at most 20 characters
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

## 6. Verify env exec does not create a missing sandbox

```bash
sbx --app-name "$APP" env exec "$WORK/never" -- echo hi
```
Pass: fails because `env-check-never` has never been created. A successful
`echo hi` here would contradict the expected missing-sandbox behavior.

## 7. Verify mount-root environment file protection

```bash
sbx --app-name "$APP" env run -d "$WORK/minimal"
sbx --app-name "$APP" env exec "$WORK/minimal" -- sh -c 'echo x >> "$1"' sh "$WORK/minimal/sbxenv.yaml"
```
Approve creation. Pass: the write fails with a read-only/permission error.
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
