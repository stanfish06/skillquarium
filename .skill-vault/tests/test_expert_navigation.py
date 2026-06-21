import hashlib
import importlib.util
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


VAULT_HELPERS = Path(__file__).resolve().parents[1]

TAXONOMY_SPEC = importlib.util.spec_from_file_location(
    "expert_taxonomy", VAULT_HELPERS / "expert_taxonomy.py"
)
expert_taxonomy = importlib.util.module_from_spec(TAXONOMY_SPEC)
assert TAXONOMY_SPEC.loader is not None
sys.modules[TAXONOMY_SPEC.name] = expert_taxonomy
TAXONOMY_SPEC.loader.exec_module(expert_taxonomy)

BUILD_SPEC = importlib.util.spec_from_file_location(
    "skill_vault_expert_navigation_build", VAULT_HELPERS / "build.py"
)
vault_build = importlib.util.module_from_spec(BUILD_SPEC)
assert BUILD_SPEC.loader is not None
BUILD_SPEC.loader.exec_module(vault_build)


class ExpertNavigationApiTests(unittest.TestCase):
    def test_exposes_testable_expert_navigation_helpers(self):
        self.assertTrue(hasattr(vault_build, "render_expert_master_map"))
        self.assertTrue(hasattr(vault_build, "render_expert_discipline_map"))
        self.assertTrue(hasattr(vault_build, "prune_stale_expert_maps"))
        self.assertTrue(hasattr(vault_build, "atomic_write_text"))


class ExpertNavigationRenderTests(unittest.TestCase):
    def taxonomy(self):
        disciplines = (
            expert_taxonomy.Discipline(
                "physics-astronomy",
                "Physics & Astronomy",
                "Physical systems from particles to the cosmos.",
            ),
            expert_taxonomy.Discipline(
                "biology-life-sciences",
                "Biology & Life Sciences",
                "Living systems across scales.",
            ),
        )
        profiles = {
            "alpha-physicist": expert_taxonomy.ProfileAssignment(
                "physics-astronomy", (), ("imaging-signals",)
            ),
            "beta-physicist": expert_taxonomy.ProfileAssignment(
                "physics-astronomy", (), ("research-writing",)
            ),
            "omega-biologist": expert_taxonomy.ProfileAssignment(
                "biology-life-sciences",
                ("physics-astronomy",),
                ("data-science-compute",),
            ),
            "zeta-physicist": expert_taxonomy.ProfileAssignment(
                "physics-astronomy", (), ("research-writing",)
            ),
        }
        return expert_taxonomy.ExpertTaxonomy(disciplines, profiles)

    def test_atomic_write_replaces_with_temporary_sibling(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        target = Path(temporary.name) / "map.md"
        target.write_text("old", encoding="utf-8")

        with mock.patch.object(
            vault_build.os, "replace", wraps=os.replace
        ) as replace:
            vault_build.atomic_write_text(target, "new")

        replace.assert_called_once()
        source, destination = map(Path, replace.call_args.args)
        self.assertEqual(destination, target)
        self.assertEqual(source.parent, target.parent)
        self.assertFalse(source.exists())
        self.assertEqual(target.read_text(encoding="utf-8"), "new")

    def test_master_uses_manifest_order_counts_and_dispatcher_without_flat_list(self):
        rendered = vault_build.render_expert_master_map(
            taxonomy=self.taxonomy(),
            title="Scientific Expert Profiles",
            scope="Discipline-specific scientific and engineering profiles.",
            created="2025-01-02",
        )

        self.assertIn(
            "tags:\n"
            "  - skill-map\n"
            "generated: scientific-expert-taxonomy\n"
            "created: 2025-01-02",
            rendered,
        )
        self.assertIn("[Back to Skill Index](../index.md)", rendered)
        self.assertIn("## Profile Dispatcher", rendered)
        self.assertIn("[scientific-agents](../scientific-agents.md)", rendered)
        self.assertIn("## Browse By Discipline", rendered)
        physics = (
            "[Physics & Astronomy]"
            "(scientific-expert-profiles/physics-astronomy.md)"
            " - 3 primary, 1 cross-disciplinary"
        )
        biology = (
            "[Biology & Life Sciences]"
            "(scientific-expert-profiles/biology-life-sciences.md)"
            " - 1 primary, 0 cross-disciplinary"
        )
        self.assertIn(physics, rendered)
        self.assertIn(biology, rendered)
        self.assertLess(rendered.index(physics), rendered.index(biology))
        for slug in self.taxonomy().profiles:
            self.assertNotIn(f"../{slug}.md", rendered)

    def test_nested_map_orders_links_and_unions_bridges_for_all_shown_profiles(self):
        taxonomy = self.taxonomy()
        rendered = vault_build.render_expert_discipline_map(
            discipline=taxonomy.disciplines[0],
            taxonomy=taxonomy,
            short_descriptions={
                "alpha-physicist": "Alpha summary.",
                "beta-physicist": "Beta summary.",
                "omega-biologist": "Omega summary.",
                "zeta-physicist": "Zeta summary.",
            },
            category_titles={
                "research-writing": "Scientific Writing, Figures & Publishing",
                "data-science-compute": "Data Science, Stats & Scientific Computing",
                "imaging-signals": "Imaging, Microscopy & Biosignals",
            },
            bridge_domain_order=(
                "research-writing",
                "data-science-compute",
                "imaging-signals",
            ),
            created="2025-01-02",
        )

        self.assertIn("# Physics & Astronomy", rendered)
        self.assertIn("generated: scientific-expert-taxonomy", rendered)
        self.assertIn("Physical systems from particles to the cosmos.", rendered)
        self.assertIn(
            "[Back to Scientific Expert Profiles]"
            "(../scientific-expert-profiles.md)",
            rendered,
        )
        bridge_links = (
            "[Scientific Writing, Figures & Publishing](../research-writing.md)",
            "[Data Science, Stats & Scientific Computing](../data-science-compute.md)",
            "[Imaging, Microscopy & Biosignals](../imaging-signals.md)",
        )
        self.assertLess(rendered.index(bridge_links[0]), rendered.index(bridge_links[1]))
        self.assertLess(rendered.index(bridge_links[1]), rendered.index(bridge_links[2]))
        primary_heading = rendered.index("## Primary experts")
        cross_heading = rendered.index("## Cross-disciplinary experts")
        self.assertLess(primary_heading, cross_heading)
        primary_links = (
            "[alpha-physicist](../../alpha-physicist.md) - Alpha summary.",
            "[beta-physicist](../../beta-physicist.md) - Beta summary.",
            "[zeta-physicist](../../zeta-physicist.md) - Zeta summary.",
        )
        self.assertLess(rendered.index(primary_links[0]), rendered.index(primary_links[1]))
        self.assertLess(rendered.index(primary_links[1]), rendered.index(primary_links[2]))
        self.assertIn(
            "[omega-biologist](../../omega-biologist.md) - Omega summary.",
            rendered,
        )
        self.assertNotIn("Profile Dispatcher", rendered)
        self.assertNotIn("scientific-agents", rendered)

    def test_nested_map_renders_clear_marker_when_no_secondary_profiles_exist(self):
        discipline = expert_taxonomy.Discipline(
            "mathematics-statistics",
            "Mathematics & Statistics",
            "Mathematical and statistical sciences.",
        )
        taxonomy = expert_taxonomy.ExpertTaxonomy(
            (discipline,),
            {
                "algebraist": expert_taxonomy.ProfileAssignment(
                    "mathematics-statistics", (), ("data-science-compute",)
                )
            },
        )

        rendered = vault_build.render_expert_discipline_map(
            discipline=discipline,
            taxonomy=taxonomy,
            short_descriptions={"algebraist": "Studies algebraic structures."},
            category_titles={
                "data-science-compute": "Data Science, Stats & Scientific Computing"
            },
            bridge_domain_order=("data-science-compute",),
            created="2025-01-02",
        )

        self.assertIn("## Cross-disciplinary experts\n\n_No cross-disciplinary experts._", rendered)

    def test_pruning_removes_only_owned_stale_direct_child_markdown(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        directory = Path(temporary.name)
        (directory / "current.md").write_text("current", encoding="utf-8")
        owned = "---\ngenerated: scientific-expert-taxonomy\n---\n"
        (directory / "stale-owned.md").write_text(owned, encoding="utf-8")
        (directory / "manual.md").write_text("manual", encoding="utf-8")
        (directory / "keep.txt").write_text("keep", encoding="utf-8")
        nested = directory / "nested"
        nested.mkdir()
        (nested / "stale-owned.md").write_text(owned, encoding="utf-8")

        pruned = vault_build.prune_stale_expert_maps(directory, ("current",))

        self.assertEqual(pruned, ("stale-owned.md",))
        self.assertTrue((directory / "current.md").exists())
        self.assertFalse((directory / "stale-owned.md").exists())
        self.assertTrue((directory / "manual.md").exists())
        self.assertTrue((directory / "keep.txt").exists())
        self.assertTrue((nested / "stale-owned.md").exists())

    def test_renderer_failure_happens_before_expert_writes_or_pruning(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        maps = root / "maps"
        expert_maps = maps / "scientific-expert-profiles"
        expert_maps.mkdir(parents=True)
        master = maps / "scientific-expert-profiles.md"
        master.write_text("manual master", encoding="utf-8")
        stale = expert_maps / "stale-owned.md"
        stale.write_text(
            "---\ngenerated: scientific-expert-taxonomy\n---\n",
            encoding="utf-8",
        )
        discipline = expert_taxonomy.Discipline(
            "biology-life-sciences",
            "Biology & Life Sciences",
            "Living systems across scales.",
        )
        taxonomy = expert_taxonomy.ExpertTaxonomy((discipline,), {})
        categories = (
            (
                expert_taxonomy.EXPERT_DOMAIN,
                "Scientific Expert Profiles",
                "Discipline-specific profiles.",
                (),
                (),
            ),
        )

        with (
            mock.patch.object(vault_build, "VAULT_DIR", root),
            mock.patch.object(vault_build, "ROOT", str(root)),
            mock.patch.object(vault_build, "MAPS_DIR", maps),
            mock.patch.object(vault_build, "EXPERT_MAPS_DIR", expert_maps),
            mock.patch.object(vault_build, "CATEGORIES", categories),
            mock.patch.object(vault_build, "discover_skills", return_value=set()),
            mock.patch.object(vault_build, "load_catalog_profiles", return_value=set()),
            mock.patch.object(vault_build, "load_taxonomy", return_value=taxonomy),
            mock.patch.object(
                vault_build,
                "render_expert_discipline_map",
                side_effect=RuntimeError("render failed"),
            ),
        ):
            with self.assertRaisesRegex(RuntimeError, "render failed"):
                vault_build.main()

        self.assertEqual(master.read_text(encoding="utf-8"), "manual master")
        self.assertTrue(stale.exists())

    def test_main_does_not_prune_without_validated_discipline_ids(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        maps = root / "maps"
        expert_maps = maps / "scientific-expert-profiles"
        expert_maps.mkdir(parents=True)
        existing = expert_maps / "existing.md"
        existing.write_text("keep", encoding="utf-8")

        with (
            mock.patch.object(vault_build, "VAULT_DIR", root),
            mock.patch.object(vault_build, "ROOT", str(root)),
            mock.patch.object(vault_build, "MAPS_DIR", maps),
            mock.patch.object(vault_build, "EXPERT_MAPS_DIR", expert_maps),
            mock.patch.object(vault_build, "CATEGORIES", ()),
            mock.patch.object(vault_build, "discover_skills", return_value=set()),
            mock.patch.object(vault_build, "load_catalog_profiles", return_value=set()),
            mock.patch.object(
                vault_build,
                "load_taxonomy",
                return_value=expert_taxonomy.ExpertTaxonomy((), {}),
            ),
        ):
            self.assertEqual(vault_build.main(), 0)

        self.assertTrue(existing.exists())

    def test_taxonomy_rejects_non_slug_discipline_ids(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        path = Path(temporary.name) / "taxonomy.json"
        path.write_text(
            json.dumps(
                {
                    "schema_version": 1,
                    "disciplines": [
                        {
                            "id": "../software-dev",
                            "title": "Escaped",
                            "description": "Must not escape the map directory.",
                        }
                    ],
                    "profiles": {},
                }
            ),
            encoding="utf-8",
        )

        with self.assertRaises(expert_taxonomy.TaxonomyValidationError) as raised:
            expert_taxonomy.load_taxonomy(
                path,
                catalog_profiles=set(),
                discovered_profiles=set(),
                valid_bridge_domains=(),
            )

        self.assertIn("invalid discipline id: ../software-dev", str(raised.exception))

    def test_main_rejects_escaped_discipline_path_without_overwrite(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        maps = root / "maps"
        expert_maps = maps / "scientific-expert-profiles"
        expert_maps.mkdir(parents=True)
        outside = maps / "software-dev.md"
        outside.write_text("manual map", encoding="utf-8")
        taxonomy = expert_taxonomy.ExpertTaxonomy(
            (
                expert_taxonomy.Discipline(
                    "../software-dev",
                    "Escaped",
                    "Must not escape the map directory.",
                ),
            ),
            {},
        )
        categories = (
            (
                expert_taxonomy.EXPERT_DOMAIN,
                "Scientific Expert Profiles",
                "Discipline-specific profiles.",
                (),
                (),
            ),
        )
        with (
            mock.patch.object(vault_build, "VAULT_DIR", root),
            mock.patch.object(vault_build, "ROOT", str(root)),
            mock.patch.object(vault_build, "MAPS_DIR", maps),
            mock.patch.object(vault_build, "EXPERT_MAPS_DIR", expert_maps),
            mock.patch.object(vault_build, "CATEGORIES", categories),
            mock.patch.object(vault_build, "discover_skills", return_value=set()),
            mock.patch.object(vault_build, "load_catalog_profiles", return_value=set()),
            mock.patch.object(vault_build, "load_taxonomy", return_value=taxonomy),
            mock.patch("sys.stderr", new_callable=io.StringIO),
        ):
            result = vault_build.main()

        self.assertNotEqual(result, 0)
        self.assertEqual(outside.read_text(encoding="utf-8"), "manual map")

    def test_main_preserves_expert_dates_and_keeps_nonexpert_map_bytes(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        maps = root / "maps"
        expert_maps = maps / "scientific-expert-profiles"
        expert_maps.mkdir(parents=True)
        standard_path = maps / "software-dev.md"
        master_path = maps / "scientific-expert-profiles.md"
        nested_path = expert_maps / "biology-life-sciences.md"
        for path, created in (
            (standard_path, "2020-01-01"),
            (master_path, "2020-02-02"),
            (nested_path, "2020-03-03"),
        ):
            path.write_text(f"---\ncreated: {created}\n---\n", encoding="utf-8")

        discipline = expert_taxonomy.Discipline(
            "biology-life-sciences",
            "Biology & Life Sciences",
            "Living systems across scales.",
        )
        taxonomy = expert_taxonomy.ExpertTaxonomy((discipline,), {})
        categories = (
            (
                "software-dev",
                "Software Development",
                "Build and maintain software.",
                (),
                (),
            ),
            (
                expert_taxonomy.EXPERT_DOMAIN,
                "Scientific Expert Profiles",
                "Discipline-specific profiles.",
                ("software-dev",),
                (),
            ),
        )
        with (
            mock.patch.object(vault_build, "VAULT_DIR", root),
            mock.patch.object(vault_build, "ROOT", str(root)),
            mock.patch.object(vault_build, "MAPS_DIR", maps),
            mock.patch.object(vault_build, "EXPERT_MAPS_DIR", expert_maps),
            mock.patch.object(vault_build, "CATEGORIES", categories),
            mock.patch.object(vault_build, "TODAY", "2099-12-31"),
            mock.patch.object(vault_build, "discover_skills", return_value=set()),
            mock.patch.object(vault_build, "load_catalog_profiles", return_value=set()),
            mock.patch.object(vault_build, "load_taxonomy", return_value=taxonomy),
        ):
            self.assertEqual(vault_build.main(), 0)

        master = master_path.read_text(encoding="utf-8")
        nested = nested_path.read_text(encoding="utf-8")
        self.assertIn("created: 2020-02-02", master)
        self.assertIn("## Profile Dispatcher", master)
        self.assertIn("created: 2020-03-03", nested)
        self.assertIn("# Biology & Life Sciences", nested)
        self.assertIn("Living systems across scales.", nested)
        self.assertEqual(
            standard_path.read_text(encoding="utf-8"),
            "---\n"
            "title: Software Development\n"
            "tags:\n"
            "  - skill-map\n"
            "created: 2020-01-01\n"
            "---\n\n"
            "# Software Development\n\n"
            "> [!abstract] Scope\n"
            "> Build and maintain software.\n\n"
            "[Back to Skill Index](../index.md)\n\n"
            "## Skills (0)\n\n",
        )


class RepositoryFixedPointTests(unittest.TestCase):
    def snapshot_generated_tree(self):
        root = VAULT_HELPERS.parent
        paths = set(root.glob("*.md"))
        paths.update((root / "maps").rglob("*.md"))
        return {
            path.relative_to(root).as_posix(): hashlib.sha256(
                path.read_bytes()
            ).hexdigest()
            for path in paths
        }

    def test_repository_build_is_a_byte_identical_fixed_point(self):
        before = self.snapshot_generated_tree()

        result = subprocess.run(
            [sys.executable, str(VAULT_HELPERS / "build.py")],
            cwd=VAULT_HELPERS.parent,
            check=False,
            capture_output=True,
            text=True,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        after = self.snapshot_generated_tree()
        changed = sorted(
            path
            for path in before.keys() | after.keys()
            if before.get(path) != after.get(path)
        )
        self.assertEqual(changed, [], "generated files changed on rebuild")


if __name__ == "__main__":
    unittest.main()
