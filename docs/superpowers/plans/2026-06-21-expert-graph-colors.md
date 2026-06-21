# Scientific Expert Graph Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Color scientific expert profile nodes in Obsidian's graph by their primary professional domain.

**Architecture:** Keep the taxonomy's existing `expert_primary` property as the single source of profile classification. Extend graph generation with an explicit palette keyed by taxonomy discipline ID, emit property-query color groups before the generic expert-domain group, and preserve all unrelated Obsidian graph settings.

**Tech Stack:** Python standard library, `unittest`, Obsidian graph search queries, JSON.

---

### Task 1: Drive graph group generation with tests

**Files:**
- Modify: `.skill-vault/tests/test_expert_taxonomy.py`
- Modify: `.skill-vault/build.py`

- [ ] **Step 1: Write failing tests**

Add tests that create a temporary `.obsidian/graph.json`, call `update_graph(taxonomy)`, and assert:

```python
expert_queries = [
    f"[expert_primary:{discipline.id}]"
    for discipline in taxonomy.disciplines
]
self.assertEqual(
    [group["query"] for group in graph["colorGroups"][:10]],
    expert_queries,
)
self.assertLess(
    queries.index("[expert_primary:biology-life-sciences]"),
    queries.index("tag:#domain/scientific-expert-profiles"),
)
self.assertEqual(graph["unrelated"], "preserved")
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `python3 -m unittest .skill-vault/tests/test_expert_taxonomy.py -v`

Expected: FAIL because `update_graph` does not accept a taxonomy and emits no professional-domain groups.

- [ ] **Step 3: Implement the palette and group builder**

Add a complete palette:

```python
EXPERT_PALETTE = {
    "biology-life-sciences": 0x2CA02C,
    "medicine-health": 0xD62728,
    "chemistry-materials": 0xFF7F0E,
    "physics-astronomy": 0x1F77B4,
    "earth-environmental-sciences": 0x17BECF,
    "agriculture-food-animal-sciences": 0xBCBD22,
    "mathematics-statistics": 0x9467BD,
    "computing-data-science": 0x7F7F7F,
    "engineering-technology": 0x8C564B,
    "social-behavioral-sciences": 0xE377C2,
}
```

Change `update_graph` to accept the loaded taxonomy, validate that every discipline has exactly one palette entry, prepend `[expert_primary:<id>]` groups in taxonomy order, append existing domain groups, and leave other JSON keys untouched. Pass the taxonomy from `main()`.

- [ ] **Step 4: Run the focused tests and verify success**

Run: `python3 -m unittest .skill-vault/tests/test_expert_taxonomy.py -v`

Expected: PASS.

### Task 2: Regenerate and verify the vault graph configuration

**Files:**
- Modify: `.obsidian/graph.json`

- [ ] **Step 1: Regenerate graph configuration**

Run: `python3 .skill-vault/build.py --graph`

Expected: `graph.json` reports 33 color groups: 10 expert professional domains plus 23 existing vault domains.

- [ ] **Step 2: Run complete validation**

Run:

```bash
python3 -m unittest discover -s .skill-vault/tests -v
python3 .skill-vault/build.py
git diff --check
```

Expected: all tests pass, the build succeeds, and `git diff --check` prints nothing.

- [ ] **Step 3: Commit and push the PR update**

```bash
git add .skill-vault/build.py .skill-vault/tests/test_expert_taxonomy.py \
  .obsidian/graph.json docs/superpowers/plans/2026-06-21-expert-graph-colors.md
git commit -m "feat(vault): color expert graph nodes by domain"
git push origin codex/scientific-expert-taxonomy
```

Expected: PR #91 updates with the new commit.
