# ruff: noqa: E402
from __future__ import annotations

from types import SimpleNamespace

from nfcore_sarek_wrapper import _build_params_for_preflight


def test_preflight_snapshot_includes_cli_enum_fields():
    args = SimpleNamespace(
        params_file=None,
        step="mapping",
        tools=None,
        skip_tools=None,
        group_by_umi_strategy="Adjacency",
        vep_out_format="json",
        ascat_genome="hg38",
        publish_dir_mode="copy",
    )

    params = _build_params_for_preflight(args, composed_profile="docker")

    assert params["group_by_umi_strategy"] == "Adjacency"
    assert params["vep_out_format"] == "json"
    assert params["ascat_genome"] == "hg38"
    assert params["publish_dir_mode"] == "copy"


import pytest

from preflight import _ANNOTATION_TOOLS, _VARIANT_CALLING_TOOLS
from schemas import SUPPORTED_PROFILES, SUPPORTED_SKIP_TOOLS, SUPPORTED_TOOLS


@pytest.mark.parametrize("tool", sorted(_VARIANT_CALLING_TOOLS))
def test_official_variant_calling_tool_is_supported(tool):
    assert tool in SUPPORTED_TOOLS


@pytest.mark.parametrize("tool", sorted(_ANNOTATION_TOOLS))
def test_official_annotation_tool_is_supported(tool):
    assert tool in SUPPORTED_TOOLS


@pytest.mark.parametrize("tool", sorted(SUPPORTED_SKIP_TOOLS))
def test_official_skip_tool_is_known(tool):
    assert tool in SUPPORTED_SKIP_TOOLS


@pytest.mark.parametrize("profile", [
    "docker", "singularity", "apptainer", "podman", "conda",
    "mamba", "wave", "arm64", "emulate_amd64", "gpu", "spark", "mutect",
])
def test_core_official_profiles_are_supported(profile):
    assert profile in SUPPORTED_PROFILES
