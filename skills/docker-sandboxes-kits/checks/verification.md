# Verification Runbook for kit spec.yaml commands

`sbx kit` is EXPERIMENTAL. The local validation and inspection steps below
do not create sandboxes; composing/creating does. This runbook does not
publish artifacts or use a signing identity. This runbook is unexecuted; use an isolated, unique
`--app-name` (≤20 characters) on every `sbx` invocation, a scratch registry
namespace, and never a production signing key. Edits to a copied spec.yaml
below use a small portable Python one-liner rather than `sed -i` (whose
in-place syntax differs between BSD/macOS and GNU/Linux) so the runbook
works on POSIX shells with Python 3. Docker login and a supported local
runtime are prerequisites; login changes shared authentication, not just
the test app. Run from the skill directory in one shell.

`sbx kit validate` accepts a local **directory**, ZIP file, or git repository,
not an OCI reference or a bare spec.yaml file. Other kit subcommands accept
different reference types; consult their help. Copy each asset to a file
named `spec.yaml` in its own directory before running these checks.

```bash
APP="k-$(date +%s)-$$"  # fresh suffix, at most 20 characters
WORK=$(mktemp -d)
mkdir "$WORK/kit-sandbox-example" "$WORK/kit-mixin-example" "$WORK/workspace"
cp assets/spec-sandbox.yaml "$WORK/kit-sandbox-example/spec.yaml"
cp assets/spec-mixin.yaml "$WORK/kit-mixin-example/spec.yaml"
```

## 1. Validate both example kits (schema-only checks)

```bash
sbx --app-name "$APP" kit validate "$WORK/kit-sandbox-example/"
sbx --app-name "$APP" kit validate "$WORK/kit-mixin-example/"
```
Pass: both report valid with no errors. This proves only schema
well-formedness — it does NOT compose either kit against a base agent and
does NOT check any network reachability; see steps 3–4 for the difference.

## 2. Confirm strict decoding rejects an unknown field

```bash
cp -r "$WORK/kit-mixin-example" "$WORK/kit-typo-mixin"
python3 - "$WORK/kit-typo-mixin/spec.yaml" <<'PYCODE'
import pathlib, sys
p = pathlib.Path(sys.argv[1])
p.write_text(p.read_text().replace('permissions:', 'permisions:', 1))
PYCODE
sbx --app-name "$APP" kit validate "$WORK/kit-typo-mixin/"
```
Pass: fails with an unrecognized-field error naming `permisions`, not a
silent no-op.

## 3. Establish a truthful policy baseline before testing egress (isolated test app only)

The genuine minimal mixin's `permissions.network.allow` (`registry.npmjs.org`)
does not by itself prove anything is blocked: the default `balanced` global
policy already allows many common hosts, and `allow-all` allows everything.
To observe an actual denial, initialize a `deny-all` baseline — do this ONLY
under this runbook's own isolated `--app-name`, never on a daemon you use
for real work:

```bash
sbx --app-name "$APP" policy init deny-all
```
Pass: `sbx --app-name "$APP" policy ls` shows the deny-all preset active for
this isolated app only.

## 4. Confirm the all-egress-declared rule against the truthful baseline

```bash
sbx --app-name "$APP" create --kit "$WORK/kit-mixin-example/" --name kit-egress-check shell "$WORK/workspace"
sbx --app-name "$APP" policy check network --sandbox kit-egress-check registry.npmjs.org   # allowed: this kit's own allow entry
sbx --app-name "$APP" policy check network --sandbox kit-egress-check example.com           # NOT allowed: deny-all baseline, no kit grants it
```
Pass: `registry.npmjs.org` is allowed (the mixin's own declared entry, on
top of the deny-all baseline); an unrelated host (`example.com`) is not —
this is what actually demonstrates the all-egress-declared/additive model,
not merely removing an entry from one kit's `allow` list (which proves
nothing about the effective policy on its own).

## 5. Confirm a mixin cannot declare a sandbox: block

```bash
cp -r "$WORK/kit-mixin-example" "$WORK/kit-bad-mixin"
printf '\nsandbox:\n  image: docker/sandbox-templates:shell-docker\n' >> "$WORK/kit-bad-mixin/spec.yaml"
sbx --app-name "$APP" kit validate "$WORK/kit-bad-mixin/"
```
Pass: fails — a `sandbox:` block is forbidden for `kind: mixin`.

## 6. Confirm a duplicate-service credential fails composition, not `kit validate`

```bash
cp -r "$WORK/kit-mixin-example" "$WORK/kit-github-mixin"
python3 - "$WORK/kit-github-mixin/spec.yaml" <<'PYCODE'
import pathlib, sys
p = pathlib.Path(sys.argv[1])
p.write_text(p.read_text() + '''
credentials:
  - service: github
    apiKey:
      name: GITHUB_TOKEN
      inject:
        - domain: api.github.com
          scheme: bearer
''')
PYCODE
sbx --app-name "$APP" kit validate "$WORK/kit-github-mixin/"   # passes: schema-only
sbx --app-name "$APP" create --kit "$WORK/kit-github-mixin/" --name kit-dup-check shell "$WORK/workspace"   # expect: fails, shell already declares github
```
Pass: `kit validate` reports the kit as schema-valid on its own; only the
actual `sbx create --kit` composition against `shell` (which already
declares a `github` credential) fails with a duplicate-service error —
confirming `kit validate` proves schema, not composability.

## 7. Confirm `sbx kit add` recreate-aware requirement

```bash
sbx --app-name "$APP" run --name kit-add-check -d shell "$WORK/workspace"
sbx --app-name "$APP" kit add kit-add-check "$WORK/kit-mixin-example/"
sbx --app-name "$APP" kit inspect "$WORK/kit-mixin-example/"
```
Then check the actual sandbox, not just the artifact:
```bash
sbx --app-name "$APP" exec kit-add-check printenv MY_MIXIN
sbx --app-name "$APP" policy check network --sandbox kit-add-check registry.npmjs.org
```
Pass: `kit add` succeeds, the variable is `1`, and the host is allowed.
`kit inspect` alone only shows the input artifact, not applied state.

## 8. Inspect the sandbox kit declaration without assuming inheritance was resolved

```bash
sbx --app-name "$APP" kit inspect "$WORK/kit-sandbox-example/" --json | grep -E '"extends"[[:space:]]*:[[:space:]]*"shell"'
```
Pass: inspect reports `"extends": "shell"`. Local artifact inspection
prints the declaration; it does not resolve the parent or print an inherited
image. Parent resolution occurs during create/run. Source-level loader and
composition checks confirm that this asset inherits the embedded shell
image; this inspect command alone does not prove image availability.

## 9. Clean up (consented removal of this runbook's own isolated app and sandboxes)

```bash
sbx --app-name "$APP" rm --force kit-add-check kit-egress-check
sbx --app-name "$APP" daemon stop
rm -rf "$WORK"
```
`--app-name "$APP"` isolates every command in this runbook to its own
daemon; the `deny-all` baseline set in step 3 applies only to that isolated
app and never touches the default daemon's policy.
