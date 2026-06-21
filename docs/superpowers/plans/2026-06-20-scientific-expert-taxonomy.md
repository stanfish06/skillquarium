# Scientific Expert Taxonomy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat scientific expert profile map with a validated two-level discipline hierarchy and explicit profile-to-domain bridges for all 503 imported profiles.

**Architecture:** A vault-owned JSON manifest is the sole taxonomy source. A small standard-library Python module parses and validates it before `build.py` writes anything; `build.py` then adds expert metadata to wrappers and renders the master and discipline maps. Repository tests validate the data contract, rendered ordering, connectivity, preservation behavior, and idempotence without adding a third-party test dependency.

**Tech Stack:** Python 3.12 standard library (`dataclasses`, `json`, `pathlib`, `unittest`), JSON, generated Markdown/Obsidian links, GitHub Actions.

---

## File Structure

- Create `.skill-vault/expert_taxonomy.py`: immutable taxonomy model, catalog loading, aggregate validation, and discipline indexes.
- Create `.skill-vault/scientific-expert-taxonomy.json`: reviewed assignments for exactly 503 catalog profiles.
- Create `.skill-vault/tests/test_expert_taxonomy.py`: unit tests for parsing, validation, and repository coverage.
- Create `.skill-vault/tests/test_expert_navigation.py`: generated-output ordering, connectivity, and dispatcher assertions.
- Modify `.skill-vault/build.py`: validate before writes, suppress noisy expert name-matching, render expert wrapper metadata, and generate expert maps.
- Modify `.skill-vault/README.md`: document taxonomy ownership and maintenance commands.
- Modify `README.md`: describe discipline-based expert navigation.
- Modify `.github/workflows/rebuild-index.yml`: run vault tests after regeneration.
- Modify `.github/workflows/update-skills.yml`: run vault tests after upstream update and regeneration.
- Regenerate `maps/scientific-expert-profiles.md`, create `maps/scientific-expert-profiles/*.md`, and regenerate the 504 expert wrapper notes plus `index.md`.

Do not modify imported `*/SKILL.md` files, `scientific-agents/references/catalog.json`, `skills.base`, or Graphify artifacts.

### Task 1: Add The Taxonomy Model And Aggregate Validation

**Files:**
- Create: `.skill-vault/expert_taxonomy.py`
- Create: `.skill-vault/tests/test_expert_taxonomy.py`

- [ ] **Step 1: Write failing tests for valid loading and aggregate errors**

Create `.skill-vault/tests/test_expert_taxonomy.py` with a temporary-manifest helper and these initial cases:

```python
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "expert_taxonomy.py"
SPEC = importlib.util.spec_from_file_location("expert_taxonomy", MODULE_PATH)
expert_taxonomy = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = expert_taxonomy
SPEC.loader.exec_module(expert_taxonomy)


class ExpertTaxonomyTests(unittest.TestCase):
    def write_manifest(self, data: dict) -> Path:
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        path = Path(directory.name) / "taxonomy.json"
        path.write_text(json.dumps(data), encoding="utf-8")
        return path

    def valid_data(self) -> dict:
        return {
            "schema_version": 1,
            "disciplines": [
                {"id": "biology-life-sciences", "title": "Biology & Life Sciences",
                 "description": "Biological systems."},
                {"id": "physics-astronomy", "title": "Physics & Astronomy",
                 "description": "Physical systems."},
            ],
            "profiles": {
                "biophysicist": {
                    "primary": "biology-life-sciences",
                    "secondary": ["physics-astronomy"],
                    "bridge_domains": ["imaging-signals", "data-science-compute"],
                }
            },
        }

    def test_loads_valid_taxonomy_and_builds_indexes(self):
        taxonomy = expert_taxonomy.load_taxonomy(
            self.write_manifest(self.valid_data()),
            catalog_profiles={"biophysicist"},
            discovered_profiles={"biophysicist"},
            valid_bridge_domains=("imaging-signals", "data-science-compute"),
        )

        self.assertEqual(taxonomy.disciplines[0].id, "biology-life-sciences")
        self.assertEqual(taxonomy.profiles["biophysicist"].secondary,
                         ("physics-astronomy",))
        self.assertEqual(taxonomy.primary_profiles("biology-life-sciences"),
                         ("biophysicist",))
        self.assertEqual(taxonomy.secondary_profiles("physics-astronomy"),
                         ("biophysicist",))
        self.assertEqual(
            taxonomy.bridge_domains_for_discipline(
                "physics-astronomy", ("data-science-compute", "imaging-signals")
            ),
            ("data-science-compute", "imaging-signals"),
        )

    def test_reports_all_validation_errors_together(self):
        data = self.valid_data()
        data["disciplines"].append(data["disciplines"][0])
        data["profiles"]["biophysicist"] = {
            "primary": "missing",
            "secondary": ["missing", "missing"],
            "bridge_domains": ["scientific-expert-profiles", "unknown"],
        }
        data["profiles"]["scientific-agents"] = {
            "primary": "biology-life-sciences",
            "secondary": [],
            "bridge_domains": ["imaging-signals"],
        }

        with self.assertRaises(expert_taxonomy.TaxonomyValidationError) as caught:
            expert_taxonomy.load_taxonomy(
                self.write_manifest(data),
                catalog_profiles={"biophysicist", "missing-from-manifest"},
                discovered_profiles={"biophysicist", "disk-only"},
                valid_bridge_domains=("imaging-signals", "data-science-compute"),
            )

        message = str(caught.exception)
        for fragment in (
            "duplicate discipline id: biology-life-sciences",
            "catalog/discovered mismatch",
            "missing taxonomy profiles: missing-from-manifest",
            "unexpected taxonomy profiles: scientific-agents",
            "biophysicist.primary: unknown discipline missing",
            "biophysicist.secondary: duplicate discipline missing",
            "biophysicist.bridge_domains: unknown domain unknown",
            "biophysicist.bridge_domains: forbidden expert domain",
        ):
            self.assertIn(fragment, message)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the tests and verify the missing module failure**

Run:

```bash
python3 -m unittest discover -s .skill-vault/tests -p 'test_expert_taxonomy.py' -v
```

Expected: `ERROR` because `.skill-vault/expert_taxonomy.py` does not exist.

- [ ] **Step 3: Implement the immutable model and loader**

Create `.skill-vault/expert_taxonomy.py` with these public types and functions:

```python
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Mapping, Sequence


SCHEMA_VERSION = 1
DISPATCHER = "scientific-agents"
EXPERT_DOMAIN = "scientific-expert-profiles"


class TaxonomyValidationError(ValueError):
    def __init__(self, errors: Iterable[str]):
        self.errors = tuple(errors)
        super().__init__("Invalid scientific expert taxonomy:\n- " + "\n- ".join(self.errors))


@dataclass(frozen=True)
class Discipline:
    id: str
    title: str
    description: str


@dataclass(frozen=True)
class ProfileAssignment:
    primary: str
    secondary: tuple[str, ...]
    bridge_domains: tuple[str, ...]


@dataclass(frozen=True)
class ExpertTaxonomy:
    disciplines: tuple[Discipline, ...]
    profiles: Mapping[str, ProfileAssignment]

    @property
    def discipline_by_id(self) -> Mapping[str, Discipline]:
        return {discipline.id: discipline for discipline in self.disciplines}

    def primary_profiles(self, discipline_id: str) -> tuple[str, ...]:
        return tuple(sorted(
            slug for slug, profile in self.profiles.items()
            if profile.primary == discipline_id
        ))

    def secondary_profiles(self, discipline_id: str) -> tuple[str, ...]:
        return tuple(sorted(
            slug for slug, profile in self.profiles.items()
            if discipline_id in profile.secondary
        ))

    def bridge_domains_for_discipline(
        self, discipline_id: str, domain_order: Sequence[str]
    ) -> tuple[str, ...]:
        shown = set(self.primary_profiles(discipline_id))
        shown.update(self.secondary_profiles(discipline_id))
        used = {
            domain
            for slug in shown
            for domain in self.profiles[slug].bridge_domains
        }
        return tuple(domain for domain in domain_order if domain in used)


def load_catalog_profiles(path: Path) -> set[str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    agents = data.get("agents")
    if not isinstance(agents, list) or not all(
        isinstance(agent, dict) and isinstance(agent.get("slug"), str)
        for agent in agents
    ):
        raise TaxonomyValidationError((f"invalid catalog agents list: {path}",))
    return {agent["slug"] for agent in agents}


def _string_list(value: object, field: str, errors: list[str]) -> tuple[str, ...]:
    if not isinstance(value, list) or not all(isinstance(item, str) and item for item in value):
        errors.append(f"{field}: expected a list of non-empty strings")
        return ()
    return tuple(value)


def load_taxonomy(
    path: Path,
    *,
    catalog_profiles: set[str],
    discovered_profiles: set[str],
    valid_bridge_domains: Sequence[str],
) -> ExpertTaxonomy:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise TaxonomyValidationError((f"cannot read {path}: {exc}",)) from exc

    errors: list[str] = []
    if not isinstance(raw, dict):
        raise TaxonomyValidationError(("manifest root: expected an object",))
    if raw.get("schema_version") != SCHEMA_VERSION:
        errors.append(f"unsupported schema_version: {raw.get('schema_version')!r}")

    raw_disciplines = raw.get("disciplines")
    if not isinstance(raw_disciplines, list):
        raw_disciplines = []
        errors.append("disciplines: expected a list")
    disciplines: list[Discipline] = []
    seen_discipline_ids: set[str] = set()
    for index, item in enumerate(raw_disciplines):
        if not isinstance(item, dict):
            errors.append(f"disciplines[{index}]: expected an object")
            continue
        values = tuple(item.get(key) for key in ("id", "title", "description"))
        if not all(isinstance(value, str) and value for value in values):
            errors.append(f"disciplines[{index}]: id, title, and description are required")
            continue
        discipline_id, title, description = values
        if discipline_id in seen_discipline_ids:
            errors.append(f"duplicate discipline id: {discipline_id}")
            continue
        seen_discipline_ids.add(discipline_id)
        disciplines.append(Discipline(discipline_id, title, description))

    raw_profiles = raw.get("profiles")
    if not isinstance(raw_profiles, dict):
        raw_profiles = {}
        errors.append("profiles: expected an object")
    taxonomy_slugs = {slug for slug in raw_profiles if isinstance(slug, str)}
    if catalog_profiles != discovered_profiles:
        catalog_only = ", ".join(sorted(catalog_profiles - discovered_profiles)) or "none"
        disk_only = ", ".join(sorted(discovered_profiles - catalog_profiles)) or "none"
        errors.append(f"catalog/discovered mismatch: catalog-only={catalog_only}; disk-only={disk_only}")
    missing = catalog_profiles - taxonomy_slugs
    unexpected = taxonomy_slugs - catalog_profiles
    if missing:
        errors.append("missing taxonomy profiles: " + ", ".join(sorted(missing)))
    if DISPATCHER in unexpected:
        errors.append(f"unexpected taxonomy profiles: {DISPATCHER}")
        unexpected.remove(DISPATCHER)
    if unexpected:
        errors.append("unexpected taxonomy profiles: " + ", ".join(sorted(unexpected)))

    valid_domains = set(valid_bridge_domains)
    profiles: dict[str, ProfileAssignment] = {}
    for slug, item in raw_profiles.items():
        if not isinstance(slug, str) or not isinstance(item, dict):
            errors.append(f"profiles.{slug}: expected an object")
            continue
        primary = item.get("primary")
        if not isinstance(primary, str) or not primary:
            errors.append(f"{slug}.primary: expected a non-empty string")
            primary = ""
        elif primary not in seen_discipline_ids:
            errors.append(f"{slug}.primary: unknown discipline {primary}")
        secondary = _string_list(item.get("secondary", []), f"{slug}.secondary", errors)
        for value in sorted({value for value in secondary if secondary.count(value) > 1}):
            errors.append(f"{slug}.secondary: duplicate discipline {value}")
        if primary and primary in secondary:
            errors.append(f"{slug}.secondary: repeats primary discipline {primary}")
        for value in secondary:
            if value not in seen_discipline_ids:
                errors.append(f"{slug}.secondary: unknown discipline {value}")
        bridges = _string_list(item.get("bridge_domains"), f"{slug}.bridge_domains", errors)
        if not bridges:
            errors.append(f"{slug}.bridge_domains: at least one domain is required")
        for value in sorted({value for value in bridges if bridges.count(value) > 1}):
            errors.append(f"{slug}.bridge_domains: duplicate domain {value}")
        for value in bridges:
            if value == EXPERT_DOMAIN:
                errors.append(f"{slug}.bridge_domains: forbidden expert domain")
            elif value not in valid_domains:
                errors.append(f"{slug}.bridge_domains: unknown domain {value}")
        profiles[slug] = ProfileAssignment(primary, secondary, bridges)

    if errors:
        raise TaxonomyValidationError(errors)
    return ExpertTaxonomy(tuple(disciplines), profiles)
```

- [ ] **Step 4: Run the unit tests and verify they pass**

Run the same `unittest` command. Expected: `Ran 2 tests ... OK`.

- [ ] **Step 5: Commit the model and tests**

```bash
git add .skill-vault/expert_taxonomy.py .skill-vault/tests/test_expert_taxonomy.py
git commit -m "feat(vault): validate scientific expert taxonomy"
```

### Task 2: Create And Review The 503-Profile Manifest

**Files:**
- Create: `.skill-vault/scientific-expert-taxonomy.json`
- Modify: `.skill-vault/tests/test_expert_taxonomy.py`

- [ ] **Step 1: Add the failing repository-coverage test**

Append a test that loads the committed catalog, discovers profile directories by
checking `metadata.scientific-agents-profile: true` while excluding
`scientific-agents`, and calls `load_taxonomy`. Assert 503 assignments, ten
disciplines, a non-empty primary group for every discipline, and at least one
bridge for every profile.

```python
    def test_repository_manifest_covers_every_imported_profile(self):
        root = Path(__file__).resolve().parents[2]
        catalog = expert_taxonomy.load_catalog_profiles(
            root / "scientific-agents/references/catalog.json"
        )
        discovered = {
            skill_dir.name
            for skill_dir in root.iterdir()
            if skill_dir.is_dir()
            and skill_dir.name != expert_taxonomy.DISPATCHER
            and (skill_dir / "SKILL.md").is_file()
            and "scientific-agents-profile: true" in
                (skill_dir / "SKILL.md").read_text(encoding="utf-8")[:4096]
        }
        valid_domains = (
            "genomics-variants", "single-cell-rnaseq", "proteomics-metabolomics",
            "drug-discovery-chem", "sequence-phylogenetics", "bio-databases-platforms",
            "clinical-medical", "imaging-signals", "ml-ai", "data-science-compute",
            "quantum-physics", "research-writing", "academic-pipelines",
            "literature-discovery", "documents-office", "cloud-devops", "vault-meta",
            "reasoning-ideation", "web-automation-frontend", "analytics-engineering",
            "security-auditing", "software-dev",
        )
        taxonomy = expert_taxonomy.load_taxonomy(
            root / ".skill-vault/scientific-expert-taxonomy.json",
            catalog_profiles=catalog,
            discovered_profiles=discovered,
            valid_bridge_domains=valid_domains,
        )
        self.assertEqual(len(taxonomy.profiles), 503)
        self.assertEqual(len(taxonomy.disciplines), 10)
        for discipline in taxonomy.disciplines:
            self.assertTrue(taxonomy.primary_profiles(discipline.id), discipline.id)
        self.assertTrue(all(profile.bridge_domains for profile in taxonomy.profiles.values()))
```

- [ ] **Step 2: Run the coverage test and verify it fails for the missing manifest**

Run:

```bash
python3 -m unittest discover -s .skill-vault/tests -p 'test_expert_taxonomy.py' -v
```

Expected: failure reading
`.skill-vault/scientific-expert-taxonomy.json`.

- [ ] **Step 3: Classify all profiles in ten review batches**

Create the manifest with the exact discipline IDs below, in this order:

```text
biology-life-sciences
medicine-health
chemistry-materials
physics-astronomy
earth-environmental-sciences
agriculture-food-animal-sciences
mathematics-statistics
computing-data-science
engineering-technology
social-behavioral-sciences
```

Classify from each catalog record's `profession`, `work_mode`, and `summary` using
this fixed rubric:

- Primary is the profession's canonical academic or professional home, not the
  tools mentioned in its summary.
- Add a secondary only when another discipline is part of the profession itself;
  do not turn every method dependency into a secondary discipline.
- Put a profile in no more than three secondary disciplines.
- Choose one to four existing capability domains that materially support the
  profile's stated workflows.
- Use `clinical-medical` for patient, diagnostic, therapeutic, or public-health
  practice; `drug-discovery-chem` for chemistry/materials and molecular modeling;
  `quantum-physics` for physics/astronomy; and `data-science-compute` as the broad
  bridge only when computation, modeling, statistics, GIS, or simulation is part
  of the stated work mode.
- Add narrower bio domains (`genomics-variants`, `single-cell-rnaseq`,
  `proteomics-metabolomics`, `sequence-phylogenetics`, `imaging-signals`) only
  when the profile explicitly uses that modality.
- Never use `scientific-expert-profiles` as a bridge.

Review the JSON in ten primary-discipline batches. For each batch, confirm that
every slug belongs there professionally, every secondary is truly
cross-disciplinary, and every bridge points to a capability that appears in the
catalog description. Sort profile keys lexicographically so diffs remain stable.

- [ ] **Step 4: Validate coverage and print an audit summary**

Run the tests, then run:

```bash
python3 - <<'PY'
import importlib.util
import sys
from pathlib import Path

root = Path.cwd()
spec = importlib.util.spec_from_file_location("expert_taxonomy", root / ".skill-vault/expert_taxonomy.py")
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
catalog = module.load_catalog_profiles(root / "scientific-agents/references/catalog.json")
discovered = {
    path.name for path in root.iterdir()
    if path.is_dir() and path.name != module.DISPATCHER
    and (path / "SKILL.md").is_file()
    and "scientific-agents-profile: true" in (path / "SKILL.md").read_text(encoding="utf-8")[:4096]
}
valid_domains = (
    "genomics-variants", "single-cell-rnaseq", "proteomics-metabolomics",
    "drug-discovery-chem", "sequence-phylogenetics", "bio-databases-platforms",
    "clinical-medical", "imaging-signals", "ml-ai", "data-science-compute",
    "quantum-physics", "research-writing", "academic-pipelines",
    "literature-discovery", "documents-office", "cloud-devops", "vault-meta",
    "reasoning-ideation", "web-automation-frontend", "analytics-engineering",
    "security-auditing", "software-dev",
)
taxonomy = module.load_taxonomy(
    root / ".skill-vault/scientific-expert-taxonomy.json",
    catalog_profiles=catalog,
    discovered_profiles=discovered,
    valid_bridge_domains=valid_domains,
)
print(f"profiles={len(taxonomy.profiles)} disciplines={len(taxonomy.disciplines)}")
for discipline in taxonomy.disciplines:
    print(f"{discipline.id}: primary={len(taxonomy.primary_profiles(discipline.id))} "
          f"secondary={len(taxonomy.secondary_profiles(discipline.id))}")
PY
```

Expected first line: `profiles=503 disciplines=10`. No discipline may report
`primary=0`.

- [ ] **Step 5: Commit the reviewed manifest and coverage test**

```bash
git add .skill-vault/scientific-expert-taxonomy.json .skill-vault/tests/test_expert_taxonomy.py
git commit -m "data(vault): classify scientific expert profiles"
```

### Task 3: Integrate Validation And Expert Wrapper Rendering

**Files:**
- Modify: `.skill-vault/build.py:17-32,403-421,504-585`
- Modify: `.skill-vault/tests/test_expert_taxonomy.py`

- [ ] **Step 1: Add failing tests for wrapper metadata, bridges, and preserved fields**

Extract wrapper rendering into a pure `render_wrapper(...)` function in
`build.py`. Add tests that pass an expert assignment and assert the result
contains:

```yaml
domain: scientific-expert-profiles
expert_primary: biology-life-sciences
expert_secondary:
  - physics-astronomy
bridge_domains:
  - imaging-signals
```

Also assert that the body links to
`maps/scientific-expert-profiles/biology-life-sciences.md`,
`maps/scientific-expert-profiles/physics-astronomy.md`, and
`maps/imaging-signals.md`; that it does not contain `## Related skills`; and that
a supplied `status: favorite`, `rating: 5`, aliases, and personal notes are
unchanged. Add a non-expert case asserting the existing related-skill section is
unchanged.

- [ ] **Step 2: Run the focused tests and verify they fail because `render_wrapper` is absent**

Run the Task 1 discovery command. Expected: failure importing or calling
`render_wrapper`.

- [ ] **Step 3: Load and validate taxonomy before any writes**

In `build.py`, import `Path`, `ExpertTaxonomy`, `ProfileAssignment`,
`TaxonomyValidationError`, `load_catalog_profiles`, and `load_taxonomy`. In
`main()`:

1. Build `on_disk` before `os.makedirs`, `update_graph`, or any file write.
2. Identify imported profiles with `is_scientific_agents_profile`, excluding the
   dispatcher.
3. Build valid bridge-domain order from `CATEGORIES`, excluding
   `scientific-expert-profiles`.
4. Load catalog slugs and the manifest.
5. Catch `TaxonomyValidationError`, print it to stderr, and return `1`.
6. Only after successful validation, create directories and honor `--graph`.
7. Return `0` on success and use `raise SystemExit(main())` at the entry point.

Use these constants:

```python
VAULT_DIR = Path(
    os.environ.get("SKILL_VAULT_ROOT", Path(__file__).resolve().parents[1])
).resolve()
TAXONOMY_PATH = VAULT_DIR / ".skill-vault/scientific-expert-taxonomy.json"
CATALOG_PATH = VAULT_DIR / "scientific-agents/references/catalog.json"
EXPERT_MAPS_DIR = VAULT_DIR / "maps/scientific-expert-profiles"
```

Keep existing string-path helpers working by assigning `ROOT = str(VAULT_DIR)`.

- [ ] **Step 4: Stop exact-name matching from creating expert skill edges**

Call `build_related` only with non-profile skills, then seed empty sets for each
expert and the dispatcher:

```python
related_candidates = [skill for skill in skills_sorted if skill not in expert_profiles]
related = build_related(related_candidates, full_desc)
for skill in skills_sorted:
    related.setdefault(skill, set())
```

This preserves non-expert behavior and removes both expert-to-expert and
expert-to-skill name-matching edges.

- [ ] **Step 5: Implement the pure wrapper renderer and use it in the loop**

Move lines 555-583 into `render_wrapper`. For expert assignments, append the
three taxonomy fields to frontmatter, render primary and secondary discipline
links after the canonical domain link, and replace `## Related skills` with:

```markdown
## Relevant capability domains

- [Imaging, Microscopy & Biosignals](maps/imaging-signals.md)
```

Render bridge domains in `CATEGORIES` order, not manifest order. Leave dispatcher
and all non-profile wrappers on the existing related-skill path.

- [ ] **Step 6: Run tests and a validation-failure smoke test**

Run unit tests. Then temporarily point `TAXONOMY_PATH` at a malformed temp file in
a test or patch `load_taxonomy` and assert `main()` returns `1` before a mocked
writer is called. Expected: all tests pass and no output file is written on the
failure path.

- [ ] **Step 7: Commit wrapper integration**

```bash
git add .skill-vault/build.py .skill-vault/tests/test_expert_taxonomy.py
git commit -m "feat(vault): render expert taxonomy metadata"
```

### Task 4: Generate The Master And Discipline Maps

**Files:**
- Modify: `.skill-vault/build.py:458-468,587-602`
- Create: `maps/scientific-expert-profiles/*.md` (generated)
- Modify: `maps/scientific-expert-profiles.md` (generated)
- Create: `.skill-vault/tests/test_expert_navigation.py`

- [ ] **Step 1: Write failing pure-render tests for map structure and ordering**

Add tests for `render_expert_master_map(...)` and
`render_expert_discipline_map(...)` using two primary profiles and one secondary
profile. Assert:

- The master contains discipline links in manifest order and the dispatcher.
- A discipline map links back to `../scientific-expert-profiles.md`.
- Capability maps are the bridge union in `CATEGORIES` order.
- `## Primary experts` occurs before `## Cross-disciplinary experts`.
- Slugs are alphabetical within each section.
- Profile links from nested maps use `../../<slug>.md`.

- [ ] **Step 2: Run tests and verify both render functions are missing**

Run the vault test discovery command. Expected: failures naming the absent
render functions.

- [ ] **Step 3: Implement pure master and discipline renderers**

The master renderer must preserve its existing `created` value and produce:

```markdown
# Scientific Expert Profiles

> [!abstract] Scope
> Discipline-specific scientific and engineering operating profiles adapted from K-Dense scientific-agents.

[Back to Skill Index](../index.md)

## Profile Dispatcher

- [scientific-agents](../scientific-agents.md) - Select the narrowest relevant profile.

## Browse By Discipline

- [Biology & Life Sciences](scientific-expert-profiles/biology-life-sciences.md) - N primary, M cross-disciplinary
```

The discipline renderer uses the exact section ordering from the spec and the
existing one-line descriptions from `short`.

- [ ] **Step 4: Replace only the expert category's default map renderer**

In the `CATEGORIES` loop, branch on `key == "scientific-expert-profiles"` and
write the master renderer. Write one nested map per manifest discipline before
continuing to the next category. All other domain maps remain byte-for-byte on
their current code path.

- [ ] **Step 5: Remove stale generated discipline maps safely**

After validation and before rendering, create `EXPERT_MAPS_DIR`. Remove only
`*.md` files in that dedicated directory whose stems are not current discipline
IDs. Never recurse and never remove non-Markdown files.

- [ ] **Step 6: Run tests and regenerate maps**

```bash
python3 -m unittest discover -s .skill-vault/tests -p 'test_*.py' -v
python3 .skill-vault/build.py
```

Expected: tests pass; build reports 1,013 wrappers and 23 top-level maps; the
master expert map is concise; ten nested discipline maps exist.

- [ ] **Step 7: Commit map generation and generated maps**

```bash
git add .skill-vault/build.py .skill-vault/tests/test_expert_navigation.py \
  maps/scientific-expert-profiles.md maps/scientific-expert-profiles/
git commit -m "feat(vault): generate expert discipline maps"
```

### Task 5: Add Repository Connectivity And Idempotence Audits

**Files:**
- Modify: `.skill-vault/tests/test_expert_navigation.py`

- [ ] **Step 1: Add generated-link connectivity tests**

For each manifest profile, read its root wrapper and assert it links to:

```text
maps/scientific-expert-profiles/<primary>.md
maps/<at-least-one-bridge>.md
```

Read its primary discipline map and assert `../../<slug>.md` appears between
`## Primary experts` and `## Cross-disciplinary experts`. For every secondary,
assert the same wrapper link appears after the cross-disciplinary heading. Also
assert the dispatcher appears only in the master map, never in a discipline map.

- [ ] **Step 2: Add a no-noisy-expert-links regression test**

Assert representative wrappers such as `inorganic-chemist.md`,
`environmental-engineer.md`, and `health-informatician.md` contain
`## Relevant capability domains` and do not contain their former incidental
links to `electron.md`, `qa.md`, or `review.md`.

- [ ] **Step 3: Add an idempotence test using a temporary copied fixture**

Create a temporary minimal vault containing `build.py`, `expert_taxonomy.py`, a
two-profile manifest/catalog, two profile `SKILL.md` files, the dispatcher, and
one non-profile skill. Run `build.py` twice with a `SKILL_VAULT_ROOT` environment
override added for tests, hash every generated root wrapper and map after each
run, and assert the hash dictionaries are equal. Ensure the fixture wrapper has
custom status, rating, aliases, and personal notes before the first run and
assert they survive both runs.

- [ ] **Step 4: Run the complete vault test suite**

```bash
python3 -m unittest discover -s .skill-vault/tests -p 'test_*.py' -v
```

Expected: all taxonomy, rendering, connectivity, preservation, and idempotence
tests pass.

- [ ] **Step 5: Commit the audits**

```bash
git add .skill-vault/build.py .skill-vault/tests/test_expert_navigation.py
git commit -m "test(vault): audit expert navigation connectivity"
```

### Task 6: Wire Tests Into CI And Document Maintenance

**Files:**
- Modify: `.github/workflows/rebuild-index.yml:34-37`
- Modify: `.github/workflows/update-skills.yml:76-81`
- Modify: `.skill-vault/README.md`
- Modify: `README.md:27-63`

- [ ] **Step 1: Run tests after regeneration in both workflows**

Add this step immediately after `Rebuild navigation layer` in both workflows:

```yaml
      - name: Test vault navigation
        run: python3 -m unittest discover -s .skill-vault/tests -p 'test_*.py' -v
```

This ordering lets generated-output audits inspect current files while taxonomy
validation still prevents partial writes.

- [ ] **Step 2: Document the taxonomy source and update procedure**

In `.skill-vault/README.md`, add a `Scientific expert taxonomy` section that
states:

1. The manifest, not Graphify or generated maps, is authoritative.
2. New/removed catalog profiles must update the manifest in the same change.
3. Normal builds never classify with heuristics or an LLM.
4. Run the standard-library test command and `build.py` before committing.
5. The dispatcher is deliberately outside the 503 profile assignments.

Update root `README.md` to mention the discipline maps and primary versus
cross-disciplinary sections under Navigation.

- [ ] **Step 3: Verify workflow syntax by inspection and run local commands**

```bash
python3 -m unittest discover -s .skill-vault/tests -p 'test_*.py' -v
python3 .skill-vault/build.py
git diff --check
```

Expected: tests and build pass; `git diff --check` prints nothing.

- [ ] **Step 4: Commit CI and documentation**

```bash
git add .github/workflows/rebuild-index.yml .github/workflows/update-skills.yml \
  .skill-vault/README.md README.md
git commit -m "docs(vault): document expert taxonomy maintenance"
```

### Task 7: Regenerate, Review, And Verify The Full Vault

**Files:**
- Regenerate: 504 expert wrapper notes, `maps/scientific-expert-profiles.md`,
  `maps/scientific-expert-profiles/*.md`, and `index.md`
- Verify only: `graphify-out/*`, `.obsidian/*`, imported `*/SKILL.md`

- [ ] **Step 1: Snapshot imported source hashes before regeneration**

```bash
find . -mindepth 2 -maxdepth 2 -name SKILL.md -print0 \
  | sort -z | xargs -0 sha256sum > /tmp/expert-taxonomy-skill-hashes.before
```

- [ ] **Step 2: Run the full build and tests**

```bash
python3 .skill-vault/build.py
python3 -m unittest discover -s .skill-vault/tests -p 'test_*.py' -v
```

Expected: successful build, 503 classified profiles, ten discipline maps, and
all tests passing.

- [ ] **Step 3: Verify a second build is byte-identical**

Hash all generated root wrappers, top-level maps, nested expert maps, and
`index.md`; run `build.py` again; hash them again; compare with `cmp`.

```bash
{ find . -maxdepth 1 -name '*.md' -print0; find maps -name '*.md' -print0; } \
  | sort -z | xargs -0 sha256sum > /tmp/expert-nav.before
python3 .skill-vault/build.py
{ find . -maxdepth 1 -name '*.md' -print0; find maps -name '*.md' -print0; } \
  | sort -z | xargs -0 sha256sum > /tmp/expert-nav.after
cmp /tmp/expert-nav.before /tmp/expert-nav.after
```

Expected: `cmp` exits 0 with no output.

- [ ] **Step 4: Verify imported sources and excluded artifacts are untouched**

```bash
find . -mindepth 2 -maxdepth 2 -name SKILL.md -print0 \
  | sort -z | xargs -0 sha256sum > /tmp/expert-taxonomy-skill-hashes.after
cmp /tmp/expert-taxonomy-skill-hashes.before /tmp/expert-taxonomy-skill-hashes.after
git status --short
```

Expected: source hashes match. `git status` must not show changes under
`graphify-out/`, imported skill directories, or `.obsidian/` caused by this work;
pre-existing user changes remain untouched.

- [ ] **Step 5: Inspect representative navigation paths**

Check at least:

- `biophysicist`: primary and secondary sections plus domain bridges.
- `cardiologist`: medical primary with clinical bridge.
- `astrochemist`: cross-disciplinary physics/chemistry placement.
- `agricultural-engineer`: primary versus secondary ordering.
- `computational-social-scientist`: social/computing placement.
- `scientific-agents`: present on master only.

Use `rg` against wrappers and maps; do not rely on Graphify for this acceptance
check.

- [ ] **Step 6: Dry-run the optional Graphify refresh command**

```bash
python3 .skill-vault/build-graphify.py --dry-run
```

Expected: it prints navigation-layer extraction, clustering, and tree commands
without changing `graphify-out/`.

- [ ] **Step 7: Run final checks and commit regenerated navigation**

```bash
git diff --check
python3 -m unittest discover -s .skill-vault/tests -p 'test_*.py' -v
git add .skill-vault/build.py .skill-vault/expert_taxonomy.py \
  .skill-vault/scientific-expert-taxonomy.json .skill-vault/tests \
  maps/scientific-expert-profiles.md maps/scientific-expert-profiles index.md \
  .github/workflows/rebuild-index.yml .github/workflows/update-skills.yml \
  .skill-vault/README.md README.md
python3 - <<'PY' > /tmp/expert-wrapper-paths.z
import json
import sys
from pathlib import Path

data = json.loads(Path(".skill-vault/scientific-expert-taxonomy.json").read_text())
for slug in sorted(data["profiles"]):
    sys.stdout.buffer.write(f"{slug}.md\0".encode())
sys.stdout.buffer.write(b"scientific-agents.md\0")
PY
git add --pathspec-from-file=/tmp/expert-wrapper-paths.z --pathspec-file-nul
git commit -m "feat(vault): connect scientific expert hierarchy"
```

Before committing, compare the staged profile wrapper count against the 504
expected expert-domain wrappers. Do not use `git add -A`, which would capture
unrelated Obsidian or companion state.
