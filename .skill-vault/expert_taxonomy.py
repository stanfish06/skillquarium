"""Load and validate the scientific expert profile taxonomy."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Mapping, Sequence


SCHEMA_VERSION = 1
DISPATCHER = "scientific-agents"
EXPERT_DOMAIN = "scientific-expert-profiles"


class TaxonomyValidationError(ValueError):
    """Report all independent taxonomy validation failures together."""

    def __init__(self, errors: Iterable[str]):
        self.errors = tuple(errors)
        super().__init__(
            "Invalid scientific expert taxonomy:\n- " + "\n- ".join(self.errors)
        )


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
        return tuple(
            sorted(
                slug
                for slug, profile in self.profiles.items()
                if profile.primary == discipline_id
            )
        )

    def secondary_profiles(self, discipline_id: str) -> tuple[str, ...]:
        return tuple(
            sorted(
                slug
                for slug, profile in self.profiles.items()
                if discipline_id in profile.secondary
            )
        )

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


def _read_json(path: Path, source: str) -> object:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise TaxonomyValidationError((f"cannot read {source} {path}: {exc}",)) from exc


def load_catalog_profiles(path: Path) -> set[str]:
    """Return the validated set of profile slugs in an upstream catalog."""

    data = _read_json(path, "catalog")
    if not isinstance(data, dict):
        raise TaxonomyValidationError(("catalog root: expected an object",))

    agents = data.get("agents")
    if not isinstance(agents, list):
        raise TaxonomyValidationError(("catalog agents: expected a list",))

    errors: list[str] = []
    profiles: set[str] = set()
    for index, agent in enumerate(agents):
        if not isinstance(agent, dict):
            errors.append(f"catalog agents[{index}]: expected an object")
            continue
        slug = agent.get("slug")
        if not isinstance(slug, str) or not slug.strip():
            errors.append(
                f"catalog agents[{index}].slug: expected a non-empty string"
            )
            continue
        if slug in profiles:
            errors.append(f"duplicate catalog profile slug: {slug}")
            continue
        profiles.add(slug)

    if errors:
        raise TaxonomyValidationError(errors)
    return profiles


def _string_list(value: object, field: str, errors: list[str]) -> tuple[str, ...]:
    if not isinstance(value, list) or not all(
        isinstance(item, str) and item.strip() for item in value
    ):
        errors.append(f"{field}: expected a list of non-empty strings")
        return ()
    return tuple(value)


def _duplicates(values: tuple[str, ...]) -> tuple[str, ...]:
    return tuple(sorted({value for value in values if values.count(value) > 1}))


def load_taxonomy(
    path: Path,
    *,
    catalog_profiles: set[str],
    discovered_profiles: set[str],
    valid_bridge_domains: Sequence[str],
) -> ExpertTaxonomy:
    """Load a taxonomy manifest, reporting all independent errors at once."""

    raw = _read_json(path, "taxonomy")
    if not isinstance(raw, dict):
        raise TaxonomyValidationError(("manifest root: expected an object",))

    errors: list[str] = []
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
        if not all(
            isinstance(value, str) and value.strip() for value in values
        ):
            errors.append(
                f"disciplines[{index}]: id, title, and description are required"
            )
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

    taxonomy_slugs = set(raw_profiles)
    if catalog_profiles != discovered_profiles:
        catalog_only = ", ".join(
            sorted(catalog_profiles - discovered_profiles)
        ) or "none"
        disk_only = ", ".join(
            sorted(discovered_profiles - catalog_profiles)
        ) or "none"
        errors.append(
            "catalog/discovered mismatch: "
            f"catalog-only={catalog_only}; disk-only={disk_only}"
        )

    missing = catalog_profiles - taxonomy_slugs
    unexpected = taxonomy_slugs - catalog_profiles
    if missing:
        errors.append("missing taxonomy profiles: " + ", ".join(sorted(missing)))
    if DISPATCHER in taxonomy_slugs:
        errors.append(f"unexpected taxonomy profiles: {DISPATCHER}")
        unexpected.discard(DISPATCHER)
    if unexpected:
        errors.append(
            "unexpected taxonomy profiles: " + ", ".join(sorted(unexpected))
        )

    valid_domains = set(valid_bridge_domains)
    profiles: dict[str, ProfileAssignment] = {}
    for slug, item in raw_profiles.items():
        if not isinstance(slug, str) or not isinstance(item, dict):
            errors.append(f"profiles.{slug}: expected an object")
            continue

        primary = item.get("primary")
        if not isinstance(primary, str) or not primary.strip():
            errors.append(f"{slug}.primary: expected a non-empty string")
            primary = ""
        elif primary not in seen_discipline_ids:
            errors.append(f"{slug}.primary: unknown discipline {primary}")

        secondary = _string_list(
            item.get("secondary", []), f"{slug}.secondary", errors
        )
        for value in _duplicates(secondary):
            errors.append(f"{slug}.secondary: duplicate discipline {value}")
        if primary and primary in secondary:
            errors.append(
                f"{slug}.secondary: repeats primary discipline {primary}"
            )
        for value in dict.fromkeys(secondary):
            if value not in seen_discipline_ids:
                errors.append(f"{slug}.secondary: unknown discipline {value}")

        bridges = _string_list(
            item.get("bridge_domains"), f"{slug}.bridge_domains", errors
        )
        if not bridges:
            errors.append(f"{slug}.bridge_domains: at least one domain is required")
        for value in _duplicates(bridges):
            errors.append(f"{slug}.bridge_domains: duplicate domain {value}")
        for value in dict.fromkeys(bridges):
            if value == EXPERT_DOMAIN:
                errors.append(f"{slug}.bridge_domains: forbidden expert domain")
            elif value not in valid_domains:
                errors.append(f"{slug}.bridge_domains: unknown domain {value}")

        profiles[slug] = ProfileAssignment(primary, secondary, bridges)

    if errors:
        raise TaxonomyValidationError(errors)
    return ExpertTaxonomy(tuple(disciplines), profiles)
