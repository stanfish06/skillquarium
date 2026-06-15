#!/usr/bin/env python3
"""
remap_paths.py — Make this reproducibility bundle portable across machines.

The replay command (commands.sh) self-anchors to this bundle's location, so the
output directory never needs patching. Only the machine-specific data paths —
FASTQ paths in the samplesheet and reference/index paths in params.yaml — need
remapping before replaying on a different machine:

  1. Update FASTQ paths in the samplesheet:
       python3 remap_paths.py --old /original/data/dir --new /new/data/dir

  2. Update reference/index paths in params.yaml (fasta, gtf, *_index, ...):
       python3 remap_paths.py --refs-old /old/refs --refs-new /new/refs

  3. Verify everything is ready:
       python3 remap_paths.py --verify

  Preview any change without modifying files by adding --dry-run.
  Remote URIs (s3://, https://, ...) and $VAR references are always skipped.
"""

from __future__ import annotations

import argparse
import csv
import re
import shutil
import sys
from pathlib import Path

_BUNDLE_DIR = Path(__file__).resolve().parent
_FASTQ_COLUMNS = ("fastq_1", "fastq_2", "fastq_barcode")
# Reference path KEYS as they appear in params.yaml (underscore form).
# The block between the AUTO-GENERATED sentinels mirrors
# schemas.ALL_REFERENCE_PATH_FIELDS and is regenerated verbatim into every bundle
# copy by reporting._write_remap_script, so the standalone bundle can never drift
# from the canonical list even if this in-repo literal is edited. A parity test
# (test_params_reference_keys_match_params_builder) guards the in-repo copy too.
# >>> AUTO-GENERATED reference keys (do not edit by hand) >>>
_PARAMS_REFERENCE_KEYS = (
    "fasta",
    "gtf",
    "transcript_fasta",
    "txp2gene",
    "simpleaf_index",
    "kallisto_index",
    "star_index",
    "cellranger_index",
    "barcode_whitelist",
    "kb_t1c",
    "kb_t2c",
    "motifs",
    "cellrangerarc_config",
    "cellranger_vdj_index",
    "gex_frna_probe_set",
    "gex_target_panel",
    "gex_cmo_set",
    "fb_reference",
    "vdj_inner_enrichment_primers",
    "gex_barcode_sample_assignment",
    "cellranger_multi_barcodes",
)
# <<< AUTO-GENERATED reference keys <<<

# Matches a top-level `key: value` line in params.yaml for any reference key.
# Longest keys first so e.g. `cellranger_vdj_index` isn't shadowed by a prefix.
_PARAMS_REF_RE = re.compile(
    r"""^(?P<prefix>[ \t]*(?:"""
    + "|".join(
        re.escape(k) for k in sorted(_PARAMS_REFERENCE_KEYS, key=len, reverse=True)
    )
    + r""")[ \t]*:[ \t]+)(?P<q>["']?)(?P<value>.*?)(?P=q)(?P<trail>[ \t]*)$""",
    re.MULTILINE,
)


def find_samplesheet(bundle_dir: Path | None = None) -> Path | None:
    search_dir = bundle_dir or _BUNDLE_DIR
    for name in ("samplesheet.valid.csv", "samplesheet.demo.csv"):
        p = search_dir / name
        if p.exists():
            return p
    return None


def find_commands_sh(bundle_dir: Path | None = None) -> Path | None:
    search_dir = bundle_dir or _BUNDLE_DIR
    p = search_dir / "commands.sh"
    return p if p.exists() else None


def remap_csv(
    samplesheet: Path,
    old_prefix: str,
    new_prefix: str,
    *,
    dry_run: bool,
) -> list[tuple[str, str, str]]:
    """Return list of (column, old_path, new_path) for every changed cell."""
    text = samplesheet.read_text(encoding="utf-8")
    fieldnames = list(csv.DictReader(text.splitlines()).fieldnames or [])
    rows = list(csv.DictReader(text.splitlines()))
    changes: list[tuple[str, str, str]] = []

    for row in rows:
        for col in _FASTQ_COLUMNS:
            # Boundary-aware match (same semantics as the params.yaml remapper):
            # a prefix of "/data/sample1" must NOT match "/data/sample10/...".
            if col in row and row[col] and _prefix_matches(row[col], old_prefix):
                new_val = new_prefix + row[col][len(old_prefix) :]
                changes.append((col, row[col], new_val))
                if not dry_run:
                    row[col] = new_val

    if not dry_run and changes:
        backup = samplesheet.with_suffix(".bak")
        shutil.copy2(samplesheet, backup)
        # lineterminator="\n": preserve the bundle's LF line endings (csv defaults
        # to CRLF) so remapping does not change the file's line-ending convention.
        with samplesheet.open("w", newline="", encoding="utf-8") as fh:
            writer = csv.DictWriter(fh, fieldnames=fieldnames, lineterminator="\n")
            writer.writeheader()
            writer.writerows(rows)

    return changes


def verify_paths(samplesheet: Path) -> list[str]:
    """Return FASTQ paths in the samplesheet that don't exist on disk.

    Remote URIs (s3://, https://, ...) and $VAR references are skipped.
    """
    missing: list[str] = []
    for row in csv.DictReader(samplesheet.read_text(encoding="utf-8").splitlines()):
        for col in _FASTQ_COLUMNS:
            val = row.get(col, "")
            if not val or "://" in val or val.startswith("$"):
                continue
            if not Path(val).exists():
                missing.append(val)
    return missing


def _prefix_matches(path: str, prefix: str) -> bool:
    if path == prefix:
        return True
    sep = "" if prefix.endswith("/") else "/"
    return path.startswith(prefix + sep)


def find_params(bundle_dir: Path | None = None) -> Path | None:
    search_dir = bundle_dir or _BUNDLE_DIR
    p = search_dir / "params.yaml"
    return p if p.exists() else None


def remap_params_references(
    params_yaml: Path,
    old_prefix: str,
    new_prefix: str,
    *,
    dry_run: bool,
) -> list[tuple[str, str, str]]:
    """Rewrite reference/index paths stored in params.yaml. Return (key, old, new)."""
    content = params_yaml.read_text(encoding="utf-8")
    changes: list[tuple[str, str, str]] = []

    def _replace(m: "re.Match[str]") -> str:
        value = m.group("value")
        if "://" in value or not _prefix_matches(value, old_prefix):
            return m.group(0)
        new_value = new_prefix + value[len(old_prefix) :]
        key = m.group("prefix").strip().rstrip(":").strip()
        changes.append((key, value, new_value))
        return f"{m.group('prefix')}{m.group('q')}{new_value}{m.group('q')}{m.group('trail')}"

    updated = _PARAMS_REF_RE.sub(_replace, content)

    if not dry_run and changes:
        backup = params_yaml.with_suffix(".yaml.bak")
        shutil.copy2(params_yaml, backup)
        # write bytes with LF normalised: keep params.yaml byte-stable across OS
        # (Path.write_text would emit CRLF on Windows and change the checksum).
        params_yaml.write_bytes(
            updated.replace("\r\n", "\n").replace("\r", "\n").encode("utf-8")
        )

    return changes


def verify_params_references(params_yaml: Path) -> list[str]:
    """Return local reference paths in params.yaml that don't exist on disk.

    URIs, $VAR references, the ``false`` sentinel and glob patterns are skipped.
    """
    content = params_yaml.read_text(encoding="utf-8")
    missing: list[str] = []
    for m in _PARAMS_REF_RE.finditer(content):
        value = m.group("value").strip()
        if (
            not value
            or value.lower() in ("false", "true")
            or "://" in value
            or value.startswith("$")
            or any(ch in value for ch in "*{}")
        ):
            continue
        if not Path(value).exists():
            missing.append(value)
    return missing


def cmd_remap_references(
    old_prefix: str,
    new_prefix: str,
    *,
    dry_run: bool,
    bundle_dir: Path | None = None,
) -> int:
    params_yaml = find_params(bundle_dir=bundle_dir)
    if params_yaml is None:
        print("ERROR: params.yaml not found in this bundle directory.", file=sys.stderr)
        return 1

    label = "[DRY RUN] " if dry_run else ""
    print(f"{label}Remapping reference paths in: params.yaml")
    changes = remap_params_references(
        params_yaml, old_prefix, new_prefix, dry_run=dry_run
    )

    if not changes:
        print(f"No reference paths start with {old_prefix!r} — nothing to change.")
        return 0

    verb = "Would change" if dry_run else "Changed"
    print(f"\n{verb} {len(changes)} reference path(s):")
    for key, old_val, new_val in changes:
        print(f"  [{key}]")
        print(f"    - {old_val}")
        print(f"    + {new_val}")

    if dry_run:
        print("\nRe-run without --dry-run to apply these changes.")
        return 0

    print(f"\nBackup saved: {params_yaml.with_suffix('.yaml.bak').name}")
    missing = verify_params_references(params_yaml)
    if missing:
        print(
            f"\nWARNING: {len(missing)} reference path(s) do not exist on this machine:"
        )
        for m in missing:
            print(f"  {m}")
        print(
            "\nCheck the new prefix is correct, or run --verify after the files are in place."
        )
        # Signal failure so automated portability workflows can detect a broken
        # remap, matching cmd_remap (FASTQs) and cmd_verify (audit H-6).
        return 1
    print("\nAll reference paths verified.")
    return 0


def cmd_remap(
    old_prefix: str,
    new_prefix: str,
    *,
    dry_run: bool,
    bundle_dir: Path | None = None,
) -> int:
    samplesheet = find_samplesheet(bundle_dir=bundle_dir)
    if samplesheet is None:
        print("ERROR: No samplesheet found in this bundle directory.", file=sys.stderr)
        return 1

    label = "[DRY RUN] " if dry_run else ""
    print(f"{label}Remapping FASTQ paths in: {samplesheet.name}")

    changes = remap_csv(samplesheet, old_prefix, new_prefix, dry_run=dry_run)

    if not changes:
        print(f"No FASTQ paths start with {old_prefix!r} — nothing to change.")
        return 0

    verb = "Would change" if dry_run else "Changed"
    print(f"\n{verb} {len(changes)} path(s):")
    for col, old_val, new_val in changes:
        print(f"  [{col}]")
        print(f"    - {old_val}")
        print(f"    + {new_val}")

    if dry_run:
        print("\nRe-run without --dry-run to apply these changes.")
        return 0

    print(f"\nBackup saved: {samplesheet.with_suffix('.bak').name}")

    missing = verify_paths(samplesheet)
    if missing:
        print(f"\nWARNING: {len(missing)} path(s) do not exist on this machine:")
        for m in missing:
            print(f"  {m}")
        print(
            "\nCorrect the paths and run again, or verify the FASTQ files are accessible."
        )
        return 1

    print("\nAll FASTQ paths verified — ready to replay:")
    print(f"  bash {samplesheet.parent / 'commands.sh'}")
    return 0


def cmd_verify(bundle_dir: Path | None = None) -> int:
    samplesheet = find_samplesheet(bundle_dir=bundle_dir)
    if samplesheet is None:
        print("ERROR: No samplesheet found in this bundle directory.", file=sys.stderr)
        return 1

    ok = True
    missing = verify_paths(samplesheet)
    if not missing:
        print(f"FASTQ paths: all exist in {samplesheet.name}")
    else:
        ok = False
        print(f"FASTQ paths: {len(missing)} missing in {samplesheet.name}:")
        for m in missing:
            print(f"  {m}")
        print("  → fix: python3 remap_paths.py --old <old_prefix> --new <new_prefix>")

    params_yaml = find_params(bundle_dir=bundle_dir)
    if params_yaml is not None:
        missing_refs = verify_params_references(params_yaml)
        if not missing_refs:
            print("Reference paths: all exist in params.yaml")
        else:
            ok = False
            print(f"Reference paths: {len(missing_refs)} missing in params.yaml:")
            for m in missing_refs:
                print(f"  {m}")
            print(
                "  → fix: python3 remap_paths.py --refs-old <old_prefix> --refs-new <new_prefix>"
            )

    if ok:
        print("\nAll checks passed — ready to replay:")
        print(f"  bash {(bundle_dir or _BUNDLE_DIR) / 'commands.sh'}")
    return 0 if ok else 1


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Make this reproducibility bundle portable across machines.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
examples:
  Remap FASTQ paths (required when FASTQs live at a different prefix):
    python3 remap_paths.py --old /Users/alice/fastqs --new /home/bob/fastqs

  Remap reference/index paths in params.yaml:
    python3 remap_paths.py --refs-old /Users/alice/refs --refs-new /home/bob/refs

  Preview any change without modifying files:
    python3 remap_paths.py --old /Users/alice/fastqs --new /home/bob/fastqs --dry-run

  Verify everything is ready to replay:
    python3 remap_paths.py --verify
""",
    )
    parser.add_argument(
        "--old", metavar="PREFIX", help="Original FASTQ path prefix to replace"
    )
    parser.add_argument(
        "--new", metavar="PREFIX", help="New FASTQ path prefix for this machine"
    )
    parser.add_argument(
        "--refs-old",
        metavar="PREFIX",
        help="Original reference/index path prefix to replace in params.yaml",
    )
    parser.add_argument(
        "--refs-new",
        metavar="PREFIX",
        help="New reference/index path prefix for this machine",
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Preview changes without modifying files"
    )
    parser.add_argument(
        "--verify", action="store_true", help="Check all paths exist on this machine"
    )
    args = parser.parse_args()

    if args.verify:
        return cmd_verify()
    if args.refs_old is not None and args.refs_new is not None:
        return cmd_remap_references(args.refs_old, args.refs_new, dry_run=args.dry_run)
    if args.old is not None and args.new is not None:
        return cmd_remap(args.old, args.new, dry_run=args.dry_run)
    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
