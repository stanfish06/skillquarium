import hashlib
import importlib.util
import io
import json
import os
import re
import shutil
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


def validate_expert_taxonomy_metadata(text, assignment):
    match = re.match(r"^---\n(.*?)\n---(?:\n|$)", text, re.DOTALL)
    if match is None:
        raise ValueError("wrapper is missing first frontmatter block")
    lines = match.group(1).splitlines()
    keys = ("expert_primary", "expert_secondary", "bridge_domains")
    positions = {
        key: [
            index
            for index, line in enumerate(lines)
            if line.startswith(f"{key}:")
        ]
        for key in keys
    }
    expected_counts = {
        "expert_primary": 1,
        "expert_secondary": int(bool(assignment.secondary)),
        "bridge_domains": 1,
    }
    for key, expected_count in expected_counts.items():
        actual_count = len(positions[key])
        if actual_count != expected_count:
            if expected_count == 1:
                expectation = f"exactly one {key}"
            else:
                expectation = f"no {key}"
            raise ValueError(
                f"expected {expectation}, found {actual_count}"
            )

    expected = [f"expert_primary: {assignment.primary}"]
    if assignment.secondary:
        expected.append("expert_secondary:")
        expected.extend(f"  - {value}" for value in assignment.secondary)
    expected.append("bridge_domains:")
    expected.extend(f"  - {value}" for value in assignment.bridge_domains)

    start = positions["expert_primary"][0]
    bridge_start = positions["bridge_domains"][0]
    end = bridge_start + 1
    while end < len(lines) and lines[end].startswith("  - "):
        end += 1
    actual = lines[start:end]
    if actual != expected:
        raise ValueError(
            "expert taxonomy metadata mismatch: "
            f"expected {expected!r}, found {actual!r}"
        )


def _profile_bullet_slugs(section):
    slugs = []
    pattern = re.compile(
        r"^- \[([a-z0-9]+(?:-[a-z0-9]+)*)\]"
        r"\(\.\./\.\./([a-z0-9]+(?:-[a-z0-9]+)*)\.md\) - .+$"
    )
    for line in section.splitlines():
        if not line.startswith("- "):
            continue
        match = pattern.fullmatch(line)
        if match is None or match.group(1) != match.group(2):
            raise ValueError(f"invalid profile bullet: {line}")
        slugs.append(match.group(1))
    return tuple(slugs)


def validate_discipline_profile_sections(
    text, *, expected_primary, expected_cross
):
    primary_heading = "## Primary experts"
    cross_heading = "## Cross-disciplinary experts"
    if text.count(primary_heading) != 1 or text.count(cross_heading) != 1:
        raise ValueError("profile section headings must each appear exactly once")
    primary_start = text.index(primary_heading)
    cross_start = text.index(cross_heading)
    if primary_start >= cross_start:
        raise ValueError("profile section headings are out of order")

    primary_section = text[primary_start + len(primary_heading) : cross_start]
    cross_section = text[cross_start + len(cross_heading) :]
    actual_primary = _profile_bullet_slugs(primary_section)
    actual_cross = _profile_bullet_slugs(cross_section)
    expected_primary = tuple(expected_primary)
    expected_cross = tuple(expected_cross)
    all_linked_slugs = tuple(
        re.findall(
            r"\]\(\.\./\.\./([a-z0-9]+(?:-[a-z0-9]+)*)\.md\)",
            text,
        )
    )
    if (
        actual_primary != expected_primary
        or actual_cross != expected_cross
        or all_linked_slugs != expected_primary + expected_cross
    ):
        raise ValueError(
            "profile section mismatch: "
            f"expected {(expected_primary, expected_cross)!r}, "
            f"found {(actual_primary, actual_cross)!r}"
        )


class ExpertNavigationApiTests(unittest.TestCase):
    def test_exposes_testable_expert_navigation_helpers(self):
        self.assertTrue(hasattr(vault_build, "render_expert_master_map"))
        self.assertTrue(hasattr(vault_build, "render_expert_discipline_map"))
        self.assertTrue(hasattr(vault_build, "prune_stale_expert_maps"))
        self.assertTrue(hasattr(vault_build, "atomic_write_text"))


class ExpertNavigationAuditParserTests(unittest.TestCase):
    def test_taxonomy_metadata_parser_rejects_duplicate_keys(self):
        text = (
            "---\n"
            "title: alpha\n"
            "expert_primary: physics-astronomy\n"
            "expert_primary: chemistry-materials\n"
            "bridge_domains:\n"
            "  - data-science-compute\n"
            "---\n"
        )
        assignment = expert_taxonomy.ProfileAssignment(
            "physics-astronomy", (), ("data-science-compute",)
        )

        with self.assertRaisesRegex(ValueError, "exactly one expert_primary"):
            validate_expert_taxonomy_metadata(text, assignment)

    def test_discipline_section_validator_rejects_extra_or_duplicate_members(self):
        text = (
            "## Primary experts\n\n"
            "- [alpha](../../alpha.md) - Alpha.\n"
            "- [alpha](../../alpha.md) - Duplicate.\n\n"
            "## Cross-disciplinary experts\n\n"
            "- [omega](../../omega.md) - Omega.\n"
            "- [extra](../../extra.md) - Extra.\n"
        )

        with self.assertRaisesRegex(ValueError, "profile section mismatch"):
            validate_discipline_profile_sections(
                text,
                expected_primary=("alpha",),
                expected_cross=("omega",),
            )


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


class RepositoryGeneratedNavigationAuditTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root = VAULT_HELPERS.parent
        cls.bridge_domain_order = tuple(
            key
            for key, *_ in vault_build.CATEGORIES
            if key != expert_taxonomy.EXPERT_DOMAIN
        )
        catalog_profiles = expert_taxonomy.load_catalog_profiles(
            cls.root / "scientific-agents/references/catalog.json"
        )
        discovered_profiles = {
            skill_dir.name
            for skill_dir in cls.root.iterdir()
            if skill_dir.is_dir()
            and skill_dir.name != expert_taxonomy.DISPATCHER
            and (skill_dir / "SKILL.md").is_file()
            and "scientific-agents-profile: true"
            in (skill_dir / "SKILL.md").read_text(encoding="utf-8")[:4096]
        }
        cls.taxonomy = expert_taxonomy.load_taxonomy(
            cls.root / ".skill-vault/scientific-expert-taxonomy.json",
            catalog_profiles=catalog_profiles,
            discovered_profiles=discovered_profiles,
            valid_bridge_domains=cls.bridge_domain_order,
        )
        cls.master_map = cls.root / "maps/scientific-expert-profiles.md"
        cls.discipline_maps = {
            discipline.id: cls.root
            / "maps/scientific-expert-profiles"
            / f"{discipline.id}.md"
            for discipline in cls.taxonomy.disciplines
        }

    def test_all_503_wrappers_match_manifest_metadata_and_navigation(self):
        self.assertEqual(len(self.taxonomy.profiles), 503)

        for slug, assignment in self.taxonomy.profiles.items():
            with self.subTest(slug=slug):
                text = (self.root / f"{slug}.md").read_text(encoding="utf-8")
                validate_expert_taxonomy_metadata(text, assignment)
                self.assertTrue(assignment.bridge_domains)
                primary = self.taxonomy.discipline_by_id[assignment.primary]
                primary_link = (
                    f"[{primary.title}]"
                    "(maps/scientific-expert-profiles/"
                    f"{primary.id}.md)"
                )
                self.assertEqual(text.count(primary_link), 1)
                for discipline_id in assignment.secondary:
                    secondary = self.taxonomy.discipline_by_id[discipline_id]
                    secondary_link = (
                        f"[{secondary.title}]"
                        "(maps/scientific-expert-profiles/"
                        f"{secondary.id}.md)"
                    )
                    self.assertEqual(text.count(secondary_link), 1)
                for domain in assignment.bridge_domains:
                    self.assertIn(f"(maps/{domain}.md)", text)

    def test_discipline_maps_place_profiles_in_declared_sections(self):
        for discipline in self.taxonomy.disciplines:
            path = self.discipline_maps[discipline.id]
            text = path.read_text(encoding="utf-8")
            with self.subTest(discipline=discipline.id):
                validate_discipline_profile_sections(
                    text,
                    expected_primary=self.taxonomy.primary_profiles(
                        discipline.id
                    ),
                    expected_cross=self.taxonomy.secondary_profiles(
                        discipline.id
                    ),
                )

    def test_dispatcher_appears_only_in_master_map(self):
        master = self.master_map.read_text(encoding="utf-8")
        self.assertEqual(
            master.count("[scientific-agents](../scientific-agents.md)"), 1
        )
        for discipline_id, path in self.discipline_maps.items():
            with self.subTest(discipline=discipline_id):
                self.assertNotIn(
                    "scientific-agents", path.read_text(encoding="utf-8")
                )

    def test_every_generated_map_markdown_link_resolves(self):
        paths = (self.master_map, *self.discipline_maps.values())
        for path in paths:
            text = path.read_text(encoding="utf-8")
            for target in re.findall(r"\[[^]]+\]\(([^)]+)\)", text):
                with self.subTest(map=path.name, target=target):
                    local_target = target.split("#", 1)[0]
                    self.assertTrue(
                        (path.parent / local_target).is_file(),
                        f"{path.relative_to(self.root)} links missing {target}",
                    )

    def test_representative_wrappers_omit_incidental_related_skill_links(self):
        former_targets = ("electron.md", "qa.md", "review.md")
        for slug in (
            "inorganic-chemist",
            "environmental-engineer",
            "health-informatician",
        ):
            with self.subTest(slug=slug):
                text = (self.root / f"{slug}.md").read_text(encoding="utf-8")
                self.assertIn("## Relevant capability domains", text)
                self.assertNotIn("## Related skills", text)
                for target in former_targets:
                    self.assertNotIn(f"]({target})", text)


class RepositoryFixedPointTests(unittest.TestCase):
    def copy_navigation_fixture(self, source, destination):
        helper_dir = destination / ".skill-vault"
        helper_dir.mkdir(parents=True)
        for name in (
            "build.py",
            "expert_taxonomy.py",
            "scientific-expert-taxonomy.json",
        ):
            shutil.copy2(source / ".skill-vault" / name, helper_dir / name)

        catalog = Path("scientific-agents/references/catalog.json")
        (destination / catalog).parent.mkdir(parents=True)
        shutil.copy2(source / catalog, destination / catalog)

        skill_names = []
        for skill_path in sorted(source.glob("*/SKILL.md")):
            skill = skill_path.parent.name
            skill_names.append(skill)
            copied_skill = destination / skill / "SKILL.md"
            copied_skill.parent.mkdir(exist_ok=True)
            shutil.copy2(skill_path, copied_skill)
            wrapper = source / f"{skill}.md"
            if wrapper.is_file():
                shutil.copy2(wrapper, destination / wrapper.name)

        shutil.copy2(source / "index.md", destination / "index.md")
        for map_path in (source / "maps").rglob("*.md"):
            relative = map_path.relative_to(source)
            copied_map = destination / relative
            copied_map.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(map_path, copied_map)
        return tuple(skill_names)

    def snapshot_generated_tree(self, root, skill_names):
        paths = {root / f"{skill}.md" for skill in skill_names}
        paths.add(root / "index.md")
        paths.update((root / "maps").rglob("*.md"))
        return {
            path.relative_to(root).as_posix(): hashlib.sha256(
                path.read_bytes()
            ).hexdigest()
            for path in paths
        }

    def test_repository_build_is_a_byte_identical_fixed_point(self):
        source = VAULT_HELPERS.parent
        source_skills = tuple(
            path.parent.name for path in sorted(source.glob("*/SKILL.md"))
        )
        source_before = self.snapshot_generated_tree(source, source_skills)
        sentinel = source / "maps/scientific-expert-profiles.md"
        sentinel_before = hashlib.sha256(sentinel.read_bytes()).hexdigest()

        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        workspace = Path(temporary.name)
        fixture = workspace / "fixture"
        fixture.mkdir()
        adversarial = workspace / "adversarial-vault"
        adversarial.mkdir()
        adversarial_sentinel = adversarial / "do-not-touch.txt"
        adversarial_sentinel.write_text("untouched", encoding="utf-8")
        copied_skills = self.copy_navigation_fixture(source, fixture)
        before = self.snapshot_generated_tree(fixture, copied_skills)

        with mock.patch.dict(
            os.environ, {"SKILL_VAULT_ROOT": str(adversarial)}
        ):
            environment = os.environ.copy()
            environment["SKILL_VAULT_ROOT"] = str(fixture)
            result = subprocess.run(
                [sys.executable, str(fixture / ".skill-vault/build.py")],
                cwd=fixture,
                env=environment,
                check=False,
                capture_output=True,
                text=True,
            )

        self.assertEqual(result.returncode, 0, result.stderr)
        after = self.snapshot_generated_tree(fixture, copied_skills)
        changed = sorted(
            path
            for path in before.keys() | after.keys()
            if before.get(path) != after.get(path)
        )
        self.assertEqual(changed, [], "generated files changed on rebuild")
        self.assertEqual(
            self.snapshot_generated_tree(source, source_skills), source_before
        )
        self.assertEqual(
            hashlib.sha256(sentinel.read_bytes()).hexdigest(), sentinel_before
        )
        self.assertEqual(
            adversarial_sentinel.read_text(encoding="utf-8"), "untouched"
        )


if __name__ == "__main__":
    unittest.main()
