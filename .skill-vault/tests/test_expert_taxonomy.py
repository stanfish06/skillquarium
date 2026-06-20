import importlib.util
import json
import sys
import tempfile
import unittest
from dataclasses import FrozenInstanceError
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "expert_taxonomy.py"
SPEC = importlib.util.spec_from_file_location("expert_taxonomy", MODULE_PATH)
expert_taxonomy = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = expert_taxonomy
SPEC.loader.exec_module(expert_taxonomy)


class ExpertTaxonomyTests(unittest.TestCase):
    def write_json(self, name: str, data: object) -> Path:
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        path = Path(directory.name) / name
        path.write_text(json.dumps(data), encoding="utf-8")
        return path

    def valid_data(self) -> dict:
        return {
            "schema_version": 1,
            "disciplines": [
                {
                    "id": "biology-life-sciences",
                    "title": "Biology & Life Sciences",
                    "description": "Biological systems.",
                },
                {
                    "id": "physics-astronomy",
                    "title": "Physics & Astronomy",
                    "description": "Physical systems.",
                },
            ],
            "profiles": {
                "astrobiologist": {
                    "primary": "biology-life-sciences",
                    "bridge_domains": ["data-science-compute"],
                },
                "biophysicist": {
                    "primary": "biology-life-sciences",
                    "secondary": ["physics-astronomy"],
                    "bridge_domains": [
                        "imaging-signals",
                        "data-science-compute",
                    ],
                },
            },
        }

    def test_loads_valid_catalog_and_taxonomy_and_builds_indexes(self):
        catalog_path = self.write_json(
            "catalog.json",
            {
                "agents": [
                    {"slug": "biophysicist"},
                    {"slug": "astrobiologist"},
                ]
            },
        )
        catalog_profiles = expert_taxonomy.load_catalog_profiles(catalog_path)
        taxonomy = expert_taxonomy.load_taxonomy(
            self.write_json("taxonomy.json", self.valid_data()),
            catalog_profiles=catalog_profiles,
            discovered_profiles={"astrobiologist", "biophysicist"},
            valid_bridge_domains=("imaging-signals", "data-science-compute"),
        )

        self.assertEqual(expert_taxonomy.SCHEMA_VERSION, 1)
        self.assertEqual(expert_taxonomy.DISPATCHER, "scientific-agents")
        self.assertEqual(
            expert_taxonomy.EXPERT_DOMAIN, "scientific-expert-profiles"
        )
        self.assertEqual(catalog_profiles, {"astrobiologist", "biophysicist"})
        self.assertEqual(taxonomy.disciplines[0].id, "biology-life-sciences")
        self.assertEqual(
            tuple(taxonomy.discipline_by_id),
            ("biology-life-sciences", "physics-astronomy"),
        )
        self.assertEqual(
            taxonomy.profiles["biophysicist"].secondary,
            ("physics-astronomy",),
        )
        self.assertEqual(taxonomy.profiles["astrobiologist"].secondary, ())
        self.assertEqual(
            taxonomy.primary_profiles("biology-life-sciences"),
            ("astrobiologist", "biophysicist"),
        )
        self.assertEqual(
            taxonomy.secondary_profiles("physics-astronomy"),
            ("biophysicist",),
        )
        self.assertEqual(
            taxonomy.bridge_domains_for_discipline(
                "physics-astronomy",
                ("data-science-compute", "imaging-signals"),
            ),
            ("data-science-compute", "imaging-signals"),
        )
        with self.assertRaises(FrozenInstanceError):
            taxonomy.disciplines[0].title = "Changed"

    def test_profiles_mapping_is_a_read_only_snapshot(self):
        assignment = expert_taxonomy.ProfileAssignment(
            "biology-life-sciences", (), ("data-science-compute",)
        )
        source_profiles = {"biophysicist": assignment}
        taxonomy = expert_taxonomy.ExpertTaxonomy((), source_profiles)

        source_profiles.clear()

        self.assertEqual(tuple(taxonomy.profiles), ("biophysicist",))
        with self.assertRaises(TypeError):
            taxonomy.profiles["astrobiologist"] = assignment
        with self.assertRaises(TypeError):
            del taxonomy.profiles["biophysicist"]

    def test_rejects_non_integer_schema_versions(self):
        for schema_version in (True, 1.0):
            with self.subTest(schema_version=schema_version):
                data = self.valid_data()
                data["schema_version"] = schema_version
                with self.assertRaises(
                    expert_taxonomy.TaxonomyValidationError
                ) as caught:
                    expert_taxonomy.load_taxonomy(
                        self.write_json("taxonomy.json", data),
                        catalog_profiles={"astrobiologist", "biophysicist"},
                        discovered_profiles={"astrobiologist", "biophysicist"},
                        valid_bridge_domains=(
                            "imaging-signals",
                            "data-science-compute",
                        ),
                    )

                self.assertIn("unsupported schema_version", str(caught.exception))

    def test_wraps_malformed_utf8_as_validation_error(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        path = Path(directory.name) / "taxonomy.json"
        path.write_bytes(b"\xff")

        with self.assertRaises(expert_taxonomy.TaxonomyValidationError) as caught:
            expert_taxonomy.load_taxonomy(
                path,
                catalog_profiles=set(),
                discovered_profiles=set(),
                valid_bridge_domains=(),
            )

        self.assertIn("cannot read taxonomy", str(caught.exception))

    def test_rejects_unsorted_profile_keys(self):
        data = self.valid_data()
        data["profiles"] = {
            "biophysicist": data["profiles"]["biophysicist"],
            "astrobiologist": data["profiles"]["astrobiologist"],
        }

        with self.assertRaises(
            expert_taxonomy.TaxonomyValidationError
        ) as caught:
            expert_taxonomy.load_taxonomy(
                self.write_json("taxonomy.json", data),
                catalog_profiles={"astrobiologist", "biophysicist"},
                discovered_profiles={"astrobiologist", "biophysicist"},
                valid_bridge_domains=(
                    "imaging-signals",
                    "data-science-compute",
                ),
            )

        self.assertIn(
            "profiles: keys must be lexicographically ordered",
            str(caught.exception),
        )

    def test_rejects_more_than_three_secondary_disciplines(self):
        data = self.valid_data()
        for discipline_id in ("chemistry", "medicine", "engineering"):
            data["disciplines"].append(
                {
                    "id": discipline_id,
                    "title": discipline_id.title(),
                    "description": "Additional discipline.",
                }
            )
        data["profiles"]["biophysicist"]["secondary"] = [
            "physics-astronomy",
            "chemistry",
            "medicine",
            "engineering",
        ]

        with self.assertRaises(
            expert_taxonomy.TaxonomyValidationError
        ) as caught:
            expert_taxonomy.load_taxonomy(
                self.write_json("taxonomy.json", data),
                catalog_profiles={"astrobiologist", "biophysicist"},
                discovered_profiles={"astrobiologist", "biophysicist"},
                valid_bridge_domains=(
                    "imaging-signals",
                    "data-science-compute",
                ),
            )

        self.assertIn(
            "biophysicist.secondary: at most 3 disciplines are allowed",
            str(caught.exception),
        )

    def test_rejects_more_than_four_bridge_domains(self):
        data = self.valid_data()
        domains = tuple(f"domain-{index}" for index in range(5))
        data["profiles"]["astrobiologist"]["bridge_domains"] = list(domains)

        with self.assertRaises(
            expert_taxonomy.TaxonomyValidationError
        ) as caught:
            expert_taxonomy.load_taxonomy(
                self.write_json("taxonomy.json", data),
                catalog_profiles={"astrobiologist", "biophysicist"},
                discovered_profiles={"astrobiologist", "biophysicist"},
                valid_bridge_domains=(
                    *domains,
                    "imaging-signals",
                    "data-science-compute",
                ),
            )

        self.assertIn(
            "astrobiologist.bridge_domains: at most 4 domains are allowed",
            str(caught.exception),
        )

    def test_rejects_bridge_domains_outside_canonical_order(self):
        data = self.valid_data()
        data["profiles"]["biophysicist"]["bridge_domains"] = [
            "data-science-compute",
            "imaging-signals",
        ]

        with self.assertRaises(
            expert_taxonomy.TaxonomyValidationError
        ) as caught:
            expert_taxonomy.load_taxonomy(
                self.write_json("taxonomy.json", data),
                catalog_profiles={"astrobiologist", "biophysicist"},
                discovered_profiles={"astrobiologist", "biophysicist"},
                valid_bridge_domains=(
                    "imaging-signals",
                    "data-science-compute",
                ),
            )

        self.assertIn(
            "biophysicist.bridge_domains: must follow canonical domain order",
            str(caught.exception),
        )

    def test_reports_all_validation_errors_together(self):
        data = self.valid_data()
        data["schema_version"] = 2
        data["disciplines"].append(data["disciplines"][0])
        data["disciplines"].append(
            {"id": "", "title": "Incomplete", "description": ""}
        )
        data["profiles"].pop("astrobiologist")
        data["profiles"]["biophysicist"] = {
            "primary": "missing",
            "secondary": ["missing", "missing"],
            "bridge_domains": [
                "scientific-expert-profiles",
                "unknown",
                "unknown",
            ],
        }
        data["profiles"]["scientific-agents"] = {
            "primary": "",
            "secondary": [1],
            "bridge_domains": [],
        }

        with self.assertRaises(
            expert_taxonomy.TaxonomyValidationError
        ) as caught:
            expert_taxonomy.load_taxonomy(
                self.write_json("taxonomy.json", data),
                catalog_profiles={"biophysicist", "missing-from-manifest"},
                discovered_profiles={"biophysicist", "disk-only"},
                valid_bridge_domains=("imaging-signals", "data-science-compute"),
            )

        message = str(caught.exception)
        self.assertTrue(message.startswith("Invalid scientific expert taxonomy:\n- "))
        for fragment in (
            "unsupported schema_version: 2",
            "duplicate discipline id: biology-life-sciences",
            "disciplines[3]: id, title, and description are required",
            "catalog/discovered mismatch",
            "missing taxonomy profiles: missing-from-manifest",
            "unexpected taxonomy profiles: scientific-agents",
            "biophysicist.primary: unknown discipline missing",
            "biophysicist.secondary: duplicate discipline missing",
            "biophysicist.secondary: repeats primary discipline missing",
            "biophysicist.bridge_domains: duplicate domain unknown",
            "biophysicist.bridge_domains: unknown domain unknown",
            "biophysicist.bridge_domains: forbidden expert domain",
            "scientific-agents.primary: expected a non-empty string",
            "scientific-agents.secondary: expected a list of non-empty strings",
            "scientific-agents.bridge_domains: at least one domain is required",
        ):
            self.assertIn(fragment, message)

    def test_repository_manifest_covers_every_imported_profile(self):
        root = Path(__file__).resolve().parents[2]
        build_path = root / ".skill-vault/build.py"
        build_spec = importlib.util.spec_from_file_location(
            "skill_vault_build", build_path
        )
        vault_build = importlib.util.module_from_spec(build_spec)
        assert build_spec.loader is not None
        build_spec.loader.exec_module(vault_build)
        catalog = expert_taxonomy.load_catalog_profiles(
            root / "scientific-agents/references/catalog.json"
        )
        discovered = {
            skill_dir.name
            for skill_dir in root.iterdir()
            if skill_dir.is_dir()
            and skill_dir.name != expert_taxonomy.DISPATCHER
            and (skill_dir / "SKILL.md").is_file()
            and "scientific-agents-profile: true"
            in (skill_dir / "SKILL.md").read_text(encoding="utf-8")[:4096]
        }
        valid_domains = tuple(
            category[0]
            for category in vault_build.CATEGORIES
            if category[0] != expert_taxonomy.EXPERT_DOMAIN
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
            self.assertTrue(
                taxonomy.primary_profiles(discipline.id), discipline.id
            )
        self.assertTrue(
            all(
                profile.bridge_domains
                for profile in taxonomy.profiles.values()
            )
        )
        self.assertEqual(
            taxonomy.profiles["materials-scientist"].bridge_domains,
            ("data-science-compute", "quantum-physics"),
        )
        self.assertEqual(
            taxonomy.profiles[
                "photovoltaics-solar-cell-scientist"
            ].bridge_domains,
            ("data-science-compute", "quantum-physics"),
        )
        self.assertEqual(
            taxonomy.profiles["urban-infrastructure-planner"].bridge_domains,
            ("data-science-compute",),
        )
        self.assertEqual(taxonomy.profiles["psychophysicist"].secondary, ())
        self.assertEqual(
            taxonomy.profiles["veterinary-epidemiologist"].primary,
            "agriculture-food-animal-sciences",
        )
        self.assertEqual(
            taxonomy.profiles["veterinary-epidemiologist"].secondary,
            ("mathematics-statistics",),
        )
        expected_bridges = {
            "animal-scientist": ("data-science-compute",),
            "glycobiologist": ("proteomics-metabolomics",),
            "logician": ("data-science-compute",),
            "pure-mathematician": ("data-science-compute",),
            "computer-architecture-researcher": (
                "data-science-compute",
                "software-dev",
            ),
            "animal-geneticist-breeder": (
                "genomics-variants",
                "data-science-compute",
            ),
            "digital-pathology-scientist": (
                "clinical-medical",
                "imaging-signals",
                "ml-ai",
            ),
            "environmental-health-scientist": (
                "clinical-medical",
                "data-science-compute",
            ),
            "protein-engineer": (
                "proteomics-metabolomics",
                "drug-discovery-chem",
                "sequence-phylogenetics",
                "ml-ai",
            ),
            "quantum-chemist": (
                "drug-discovery-chem",
                "data-science-compute",
                "quantum-physics",
            ),
            "robotics-scientist": (
                "imaging-signals",
                "data-science-compute",
            ),
        }
        for slug, bridge_domains in expected_bridges.items():
            with self.subTest(slug=slug):
                self.assertEqual(
                    taxonomy.profiles[slug].bridge_domains,
                    bridge_domains,
                )


if __name__ == "__main__":
    unittest.main()
