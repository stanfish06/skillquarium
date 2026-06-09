"""Bundled convenience fetchers for locuscompare.

Each module here exposes a fetch function that returns data in the canonical
schema (per ../INPUT_SCHEMA.md). Future per-source fetcher skills can mirror
this contract.
"""
from .gencode_ondemand import (  # noqa: F401
    fetch_region_genes_remote,
)

# OnDemand1000GLDClient lives in the standalone ld-1000g-region-compute
# sibling skill. Re-exported here only for backward-compat with any code
# that imported from the old location. Import is wrapped so this package
# loads even if the sibling skill is not yet on sys.path.
try:
    from ld_1000g_region_compute import (  # noqa: F401
        OnDemand1000GLDClient,
        OnDemandLDError,
    )
except ImportError:
    pass
