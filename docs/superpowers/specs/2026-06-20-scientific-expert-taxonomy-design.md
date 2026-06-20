# Scientific Expert Taxonomy Design

**Status:** Draft for written review
**Date:** 2026-06-20

## Context

The vault contains 503 imported scientific expert profiles plus the
`scientific-agents` dispatcher. The navigation generator currently assigns all
504 skills to one `scientific-expert-profiles` domain and renders one flat map.
Related-skill discovery is based on exact skill-name mentions in descriptions,
which leaves most profiles without useful peers and also creates noisy matches
for generic names.

The expert profiles need their own browsable hierarchy while remaining visibly
connected to the vault's existing capability domains. This is a navigation-layer
change; imported expert content remains upstream-managed.

## Goals

- Keep `Scientific Expert Profiles` as a distinct top-level vault domain.
- Add a two-level expert hierarchy: discipline maps followed by profiles.
- Give every profile one canonical primary discipline.
- Allow optional secondary disciplines for cross-disciplinary discovery.
- List primary experts before secondary experts on discipline maps.
- Connect profiles to broad existing capability domains.
- Make all assignments explicit, versioned, deterministic, and reviewable.
- Reject taxonomy drift before generated files are partially rewritten.

## Non-goals

- Curating profile-to-specific-skill links in this iteration.
- Running heuristic or LLM classification during normal builds.
- Modifying imported profile `SKILL.md` files.
- Automatically rebuilding Graphify in CI.
- Replacing the vault's existing top-level domain taxonomy.

## Chosen Architecture

Store vault-owned classification metadata in a separate versioned manifest:

```text
.skill-vault/scientific-expert-taxonomy.json
```

The manifest is the sole source of truth for expert navigation. The importer
continues to own upstream profile content and provenance, while `build.py`
validates the manifest and renders the human navigation layer.

This separation avoids mixing 503 classifications into generator code and
avoids re-import churn across 503 upstream-managed skill files.

## Taxonomy Model

The manifest has an explicit schema version, an ordered discipline catalog, and
one record for every imported expert profile:

```json
{
  "schema_version": 1,
  "disciplines": [
    {
      "id": "biology-life-sciences",
      "title": "Biology & Life Sciences",
      "description": "Biological systems from molecules and cells to organisms and ecosystems."
    }
  ],
  "profiles": {
    "biophysicist": {
      "primary": "biology-life-sciences",
      "secondary": ["physics-astronomy"],
      "bridge_domains": ["imaging-signals", "data-science-compute"]
    }
  }
}
```

Field semantics:

- `schema_version` selects the supported validation contract.
- `disciplines` is ordered and defines stable IDs, display titles, descriptions,
  and top-level rendering order.
- `primary` is required and provides the profile's canonical home.
- `secondary` is optional, ordered, and must not repeat the primary discipline.
- `bridge_domains` is required and contains one or more existing non-expert
  domain keys from `build.py`.

The initial discipline roster is:

1. Biology & Life Sciences
2. Medicine & Health
3. Chemistry & Materials
4. Physics & Astronomy
5. Earth & Environmental Sciences
6. Agriculture, Food & Animal Sciences
7. Mathematics & Statistics
8. Computing & Data Science
9. Engineering & Technology
10. Social & Behavioral Sciences

Cross-disciplinary profiles still have exactly one primary home. They appear in
a separate secondary section on every additional discipline map.

## Generated Navigation

The existing master map remains at:

```text
maps/scientific-expert-profiles.md
```

It becomes a concise discipline index with counts and links instead of a flat
504-item list. Discipline maps are generated beneath it:

```text
maps/scientific-expert-profiles/biology-life-sciences.md
maps/scientific-expert-profiles/medicine-health.md
...
```

Each discipline map contains, in order:

1. Scope and a link back to the expert index.
2. Relevant existing capability-domain maps.
3. `Primary experts`, sorted by profile slug.
4. `Cross-disciplinary experts`, sorted by profile slug.

Its capability-domain list is the union of bridges declared by profiles shown
on that map, rendered in the existing `CATEGORIES` order. It is therefore
derived, stable, and does not introduce a second source of bridge metadata.

The `scientific-agents` dispatcher remains on the master expert map and is not
classified as a profession.

Each profile wrapper retains its canonical vault domain:

```yaml
domain: scientific-expert-profiles
```

It also gains generated taxonomy metadata:

```yaml
expert_primary: biology-life-sciences
expert_secondary:
  - physics-astronomy
bridge_domains:
  - imaging-signals
  - data-science-compute
```

The wrapper navigation links to its primary discipline, secondary disciplines,
and declared capability-domain maps. Existing status, rating, aliases, and
personal notes remain preserved.

For imported expert profiles, explicit domain bridges replace exact-name
auto-related skill links. This prevents generic terms such as `review`, `qa`, or
`electron` from creating misleading expert connections. Non-profile
skill-to-skill matching remains unchanged.

## Build Flow

`build.py` performs the following sequence:

1. Discover installed skills and imported expert profiles.
2. Load and fully validate the taxonomy manifest.
3. Build in-memory primary, secondary, and domain-bridge indexes.
4. Generate profile wrappers with taxonomy metadata and navigation links.
5. Generate discipline maps and the master expert index.
6. Generate the existing top-level index and other domain maps as before.

Validation completes before any generated file is written. A failed validation
therefore leaves the navigation layer untouched.

The one-time initial classification may be drafted with assisted tooling, but
the reviewed manifest is committed as ordinary data. No classifier runs during
routine local builds or CI.

## Validation And Errors

The build exits nonzero with actionable errors for:

- Unsupported schema versions or malformed manifest structure.
- A catalog profile missing from the manifest.
- A manifest profile that no longer exists in the catalog.
- A mismatch between catalog profiles and imported profiles discovered on disk.
- The dispatcher appearing in the profile classification.
- Unknown or duplicate discipline IDs.
- Missing or unknown primary disciplines.
- Unknown, duplicate, or primary-repeating secondary disciplines.
- Missing, unknown, duplicate, or expert-domain bridge keys.

Errors identify the profile and invalid field wherever possible. Multiple data
errors should be accumulated into one report so maintainers can fix a batch in
one pass.

## Testing And Acceptance Criteria

Focused tests cover:

- Valid manifest loading and indexing.
- Every catalog profile having exactly one taxonomy record.
- Every taxonomy record referring to a live catalog profile.
- Discipline and bridge-domain reference validation.
- Primary-before-secondary rendering and alphabetical ordering within sections.
- Representative wrapper metadata and links.
- Preservation of editable wrapper fields and personal notes.
- Dispatcher placement only on the master expert map.
- Exclusion of imported profiles from exact-name related-skill matching.
- Idempotence: two consecutive builds produce no second diff.

A generated-link connectivity audit verifies that every expert profile can reach:

1. The master expert index through its primary discipline map.
2. At least one existing non-expert capability-domain map through an explicit
   bridge.

The existing rebuild workflows continue to run `build.py`. New or removed
upstream profiles therefore cause an intentional CI failure until the manifest
is updated and reviewed.

## Graphify

No Graphify-specific edge file is introduced. The generated Markdown hierarchy
and domain links become deterministic source material for the existing manual
Graphify rebuild. This keeps CI fast and avoids treating a stale semantic graph
as the taxonomy source of truth.

After implementation and verification, maintainers may run:

```bash
python3 .skill-vault/build-graphify.py
```

to refresh the optional local graph from the improved navigation layer.

## Rollout Boundaries

The first iteration is complete when all 503 profiles are classified, all
generated navigation passes validation and connectivity checks, and the build is
idempotent. Fine-grained profile-to-tool links can be designed later using usage
evidence and targeted curation rather than unreliable name matching.
