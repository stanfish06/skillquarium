---
name: xarray-pandera-duckdb
description: Labeled array, schema validation, and embedded SQL analytics workflows with xarray, pandera-validation, duckdb-docs, query, read-file, and polars. Use when combining NetCDF/Zarr multidimensional arrays, DataFrame schemas, Parquet/CSV/Arrow analytics, or validation gates for scientific data pipelines.
---

# xarray + Pandera + DuckDB

Use this skill for local scientific data workflows that need labeled multidimensional arrays, schema validation, and SQL over files.

## Routing

- Use `xarray` for NetCDF/Zarr/labeled N-dimensional arrays.
- Use `pandera-validation` for DataFrame schema checks.
- Use `duckdb-docs`, `query`, `read-file`, `attach-db`, and `install-duckdb` for embedded SQL over Parquet, CSV, JSON, Arrow, or database files.
- Use `polars` for DataFrame-native lazy pipelines; use DuckDB when SQL is clearer or data already lives in files.

## Workflow

1. Identify data shape:
   - tabular: DataFrame/Parquet/CSV/Arrow
   - gridded or multidimensional: NetCDF/Zarr/xarray
   - mixed: arrays plus metadata tables
2. Validate schemas at boundaries:
   - required columns/dimensions
   - units and coordinate systems
   - allowed categories
   - nullability and ranges
3. Query large tabular files in place with DuckDB instead of loading everything into memory.
4. Convert only the subset needed for downstream analysis.
5. Persist outputs in analysis-friendly formats:
   - Parquet for tabular data
   - Zarr/NetCDF for labeled arrays
   - validation reports for rejected rows or files

## Checks

- Keep units explicit; schema validation should include units when possible.
- Avoid silently converting coordinate order or time zones.
- For large files, prototype with `LIMIT` and projected columns before full scans.
- Keep schema definitions versioned with the pipeline.
