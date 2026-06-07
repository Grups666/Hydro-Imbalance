from __future__ import annotations

import csv
import json
import math
import re
from collections import defaultdict
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image
from shapely.geometry import MultiPolygon, Point, Polygon
from shapely.ops import unary_union
from shapely.strtree import STRtree


ROOT = Path(__file__).resolve().parents[3]
PROJECTS = ROOT / "projects"
DATASETS = PROJECTS / "datasets"
BASIN_DATA = PROJECTS / "basin-data.js"
FARINOTTI_DIR = DATASETS / "farinotti_2019" / "global_fraction_grids"
ZEMP_DIR = DATASETS / "glacier_zemp_2019"
BRIDGE_PATH = ZEMP_DIR / "glacier_area_by_basin_region.csv"
OUT_DIR = PROJECTS / "glacier_storage_reconstruction" / "results"

FARINOTTI_VOLUME_GRID = FARINOTTI_DIR / "p05_degree_glacier_volume_km3.tif"
FARINOTTI_AREA_GRID = FARINOTTI_DIR / "p05_degree_glacier_area_km2.tif"

REFERENCE_YEAR = 2000
ICE_TO_WATER_DENSITY_RATIO = 0.9


def load_json_assignment(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    match = re.search(r"window\.BASIN_DATA\s*=\s*(\{.*\})\s*;?\s*$", text, flags=re.S)
    if not match:
        raise ValueError(f"Could not parse {path}")
    return json.loads(match.group(1))


def basin_geometry(basin: dict) -> Polygon | MultiPolygon | None:
    polygons: list[Polygon] = []
    for ring in basin.get("rings", []):
        if len(ring) < 4:
            continue
        polygon = Polygon(ring)
        if polygon.is_empty:
            continue
        if not polygon.is_valid:
            polygon = polygon.buffer(0)
        if polygon.is_empty:
            continue
        if isinstance(polygon, Polygon):
            polygons.append(polygon)
        elif isinstance(polygon, MultiPolygon):
            polygons.extend(list(polygon.geoms))
    if not polygons:
        return None
    geometry = unary_union(polygons)
    if not geometry.is_valid:
        geometry = geometry.buffer(0)
    return geometry if not geometry.is_empty else None


def load_basins() -> tuple[list[dict], list[int], list[Polygon | MultiPolygon]]:
    basins = load_json_assignment(BASIN_DATA)["basins"]
    basins.sort(key=lambda basin: int(basin["id"]))
    basin_ids: list[int] = []
    geometries: list[Polygon | MultiPolygon] = []
    for basin in basins:
        geometry = basin_geometry(basin)
        if geometry is None:
            continue
        basin_ids.append(int(basin["id"]))
        geometries.append(geometry)
    return basins, basin_ids, geometries


def read_tiff_array(path: Path) -> np.ndarray:
    if not path.exists():
        raise FileNotFoundError(path)
    image = Image.open(path)
    array = np.asarray(image, dtype=np.float64)
    array[~np.isfinite(array)] = 0.0
    array[array < 0] = 0.0
    return array


def farinotti_resolution_totals() -> pd.DataFrame:
    records = []
    for resolution in ["p05", "p10", "p25", "p50"]:
        volume = read_tiff_array(FARINOTTI_DIR / f"{resolution}_degree_glacier_volume_km3.tif")
        area = read_tiff_array(FARINOTTI_DIR / f"{resolution}_degree_glacier_area_km2.tif")
        records.append(
            {
                "resolution": resolution,
                "total_volume_km3_ice": float(np.nansum(volume)),
                "total_storage_km3_we": float(np.nansum(volume) * ICE_TO_WATER_DENSITY_RATIO),
                "total_area_km2": float(np.nansum(area)),
                "nonzero_volume_cells": int(np.sum(volume > 0)),
            }
        )
    return pd.DataFrame(records)


def aggregate_farinotti_to_basins(
    basin_ids: list[int],
    geometries: list[Polygon | MultiPolygon],
) -> tuple[pd.DataFrame, dict[str, float]]:
    volume_grid = read_tiff_array(FARINOTTI_VOLUME_GRID)
    area_grid = read_tiff_array(FARINOTTI_AREA_GRID)
    if volume_grid.shape != area_grid.shape:
        raise ValueError(f"Grid shape mismatch: {volume_grid.shape} vs {area_grid.shape}")

    rows, cols = volume_grid.shape
    lon0, lat0 = -180.0, 90.0
    resolution = 360.0 / cols
    tree = STRtree(geometries)

    volume_by_basin = defaultdict(float)
    glacier_area_by_basin = defaultdict(float)
    assigned_volume = 0.0
    assigned_area = 0.0
    unassigned_volume = 0.0
    unassigned_area = 0.0
    nonzero_cells = 0
    assigned_cells = 0

    nonzero = np.argwhere((volume_grid > 0) | (area_grid > 0))
    for row, col in nonzero:
        nonzero_cells += 1
        volume = float(volume_grid[row, col])
        glacier_area = float(area_grid[row, col])
        lon = lon0 + (float(col) + 0.5) * resolution
        lat = lat0 - (float(row) + 0.5) * resolution
        point = Point(lon, lat)
        candidates = tree.query(point)
        matched_index = None
        for candidate in candidates:
            candidate = int(candidate)
            if geometries[candidate].covers(point):
                matched_index = candidate
                break
        if matched_index is None:
            unassigned_volume += volume
            unassigned_area += glacier_area
            continue
        basin_id = basin_ids[matched_index]
        volume_by_basin[basin_id] += volume
        glacier_area_by_basin[basin_id] += glacier_area
        assigned_volume += volume
        assigned_area += glacier_area
        assigned_cells += 1

    records = []
    for basin_id in basin_ids:
        records.append(
            {
                "basin_id": basin_id,
                "farinotti_glacier_volume_km3_ice": volume_by_basin.get(basin_id, 0.0),
                "farinotti_glacier_storage_km3_we": volume_by_basin.get(basin_id, 0.0) * ICE_TO_WATER_DENSITY_RATIO,
                "farinotti_glacier_area_km2_internal": glacier_area_by_basin.get(basin_id, 0.0),
            }
        )

    summary = {
        "source_grid_total_volume_km3_ice": float(np.nansum(volume_grid)),
        "source_grid_total_area_km2": float(np.nansum(area_grid)),
        "assigned_volume_km3_ice": assigned_volume,
        "assigned_area_km2": assigned_area,
        "unassigned_volume_km3_ice": unassigned_volume,
        "unassigned_area_km2": unassigned_area,
        "nonzero_cells": nonzero_cells,
        "assigned_cells": assigned_cells,
        "grid_resolution_degree": resolution,
    }
    return pd.DataFrame(records), summary


def read_zemp_region_balance() -> tuple[dict[int, dict[int, float]], pd.DataFrame, pd.DataFrame]:
    region_dir = ZEMP_DIR / "regions_global"
    region_pattern = re.compile(r"region_(\d+)_")
    annual_by_region: dict[int, dict[int, float]] = {}
    region_records = []

    for file_path in sorted(region_dir.glob("Zemp_etal_results_region_*.csv")):
        match = region_pattern.search(file_path.name)
        if not match:
            continue
        region = int(match.group(1))
        lines = [
            line
            for line in file_path.read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.startswith("#")
        ]
        reader = csv.DictReader(lines, skipinitialspace=True)
        for row in reader:
            clean = {key.strip(): value.strip() for key, value in row.items() if key is not None}
            year = int(clean["Year"])
            int_mwe = float(clean["INT_mwe"]) if clean.get("INT_mwe") else math.nan
            int_gt = float(clean["INT_Gt"]) if clean.get("INT_Gt") else math.nan
            area = float(clean["Area_AW_ref_km2"]) if clean.get("Area_AW_ref_km2") else math.nan
            if np.isfinite(int_mwe):
                annual_by_region.setdefault(year, {})[region] = int_mwe
            region_records.append(
                {
                    "year": year,
                    "rgi_region": region,
                    "zemp_INT_mwe": int_mwe,
                    "zemp_INT_Gt": int_gt,
                    "zemp_Area_AW_ref_km2": area,
                }
            )

    global_file = region_dir / "Zemp_etal_results_global.csv"
    global_records = []
    lines = [
        line
        for line in global_file.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith("#")
    ]
    reader = csv.DictReader(lines, skipinitialspace=True)
    for row in reader:
        clean = {key.strip(): value.strip() for key, value in row.items() if key is not None}
        global_records.append(
            {
                "year": int(clean["Year"]),
                "zemp_global_INT_Gt": float(clean["INT_Gt"]) if clean.get("INT_Gt") else math.nan,
                "zemp_global_Area_AW_ref_km2": float(clean["Area_AW_ref_km2"]) if clean.get("Area_AW_ref_km2") else math.nan,
            }
        )

    return annual_by_region, pd.DataFrame(region_records), pd.DataFrame(global_records)


def read_glacier_bridge() -> pd.DataFrame:
    if not BRIDGE_PATH.exists():
        raise FileNotFoundError(BRIDGE_PATH)
    return pd.read_csv(BRIDGE_PATH)


def build_annual_balance_by_basin(
    basins: list[dict],
    bridge: pd.DataFrame,
    annual_by_region: dict[int, dict[int, float]],
    years: list[int],
) -> pd.DataFrame:
    basin_area = {int(basin["id"]): float(basin["areaKm2"]) for basin in basins}
    bridge_rows = defaultdict(list)
    for row in bridge.itertuples(index=False):
        bridge_rows[int(row.basin_id)].append((int(row.rgi_region), float(row.glacier_area_km2)))

    records = []
    for basin in basins:
        basin_id = int(basin["id"])
        area_km2 = basin_area[basin_id]
        rows = bridge_rows.get(basin_id, [])
        for year in years:
            weighted_balance = 0.0
            matched_area = 0.0
            for region, glacier_area in rows:
                value = annual_by_region[year].get(region)
                if value is None or not np.isfinite(value):
                    continue
                weighted_balance += value * glacier_area
                matched_area += glacier_area
            annual_km3_we = weighted_balance * 0.001 if matched_area > 0 else 0.0
            annual_mm_we = annual_km3_we / area_km2 * 1_000_000.0 if area_km2 > 0 else 0.0
            records.append(
                {
                    "basin_id": basin_id,
                    "year": year,
                    "annual_glacier_mass_balance_km3_we": annual_km3_we,
                    "annual_glacier_mass_balance_mm_we": annual_mm_we,
                    "zemp_bridge_glacier_area_km2": matched_area,
                }
            )
    return pd.DataFrame(records)


def reconstruct_absolute_storage(
    basins: list[dict],
    reference_df: pd.DataFrame,
    annual_balance_df: pd.DataFrame,
) -> pd.DataFrame:
    basin_info = pd.DataFrame(
        {
            "basin_id": [int(basin["id"]) for basin in basins],
            "basin_name": [basin.get("name", "") for basin in basins],
            "region": [basin.get("region", "") for basin in basins],
            "basin_area_km2": [float(basin.get("areaKm2", math.nan)) for basin in basins],
            "cell_count": [int(basin.get("cellCount", 0)) for basin in basins],
        }
    )
    base = basin_info.merge(reference_df, on="basin_id", how="left")
    annual = basin_info[["basin_id"]].merge(annual_balance_df, on="basin_id", how="left")
    annual = annual.sort_values(["basin_id", "year"])
    annual["cumulative_from_start_km3_we"] = annual.groupby("basin_id")["annual_glacier_mass_balance_km3_we"].cumsum()
    c_ref = annual.loc[annual["year"] == REFERENCE_YEAR, ["basin_id", "cumulative_from_start_km3_we"]].rename(
        columns={"cumulative_from_start_km3_we": "cumulative_at_reference_year_km3_we"}
    )
    annual = annual.merge(c_ref, on="basin_id", how="left")
    annual["delta_from_reference_km3_we"] = annual["cumulative_from_start_km3_we"] - annual["cumulative_at_reference_year_km3_we"]

    out = annual.merge(base, on="basin_id", how="left")
    out["reference_storage_km3_we_around_2000"] = out["farinotti_glacier_storage_km3_we"].fillna(0.0)
    has_absolute_reference = out["reference_storage_km3_we_around_2000"] > 0
    out["glacier_storage_km3_we_raw"] = np.where(
        has_absolute_reference,
        out["reference_storage_km3_we_around_2000"] + out["delta_from_reference_km3_we"],
        0.0,
    )
    out["glacier_storage_km3_we"] = out["glacier_storage_km3_we_raw"].clip(lower=0.0)
    out["storage_clipped_to_zero"] = out["glacier_storage_km3_we_raw"] < 0
    out["glacier_storage_mm_we"] = out["glacier_storage_km3_we"] / out["basin_area_km2"] * 1_000_000.0
    out["reference_storage_mm_we_around_2000"] = (
        out["reference_storage_km3_we_around_2000"] / out["basin_area_km2"] * 1_000_000.0
    )
    columns = [
        "basin_id",
        "basin_name",
        "region",
        "basin_area_km2",
        "cell_count",
        "year",
        "glacier_storage_km3_we",
        "glacier_storage_mm_we",
        "reference_storage_km3_we_around_2000",
        "reference_storage_mm_we_around_2000",
        "annual_glacier_mass_balance_km3_we",
        "annual_glacier_mass_balance_mm_we",
        "delta_from_reference_km3_we",
        "storage_clipped_to_zero",
    ]
    return out[columns].sort_values(["year", "basin_id"])


def validate_outputs(
    storage_df: pd.DataFrame,
    reference_df: pd.DataFrame,
    farinotti_summary: dict[str, float],
    resolution_totals: pd.DataFrame,
    bridge: pd.DataFrame,
    region_df: pd.DataFrame,
    global_df: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame, str]:
    annual_global = (
        storage_df.groupby("year", as_index=False)
        .agg(
            reconstructed_global_storage_km3_we=("glacier_storage_km3_we", "sum"),
            reconstructed_global_annual_balance_km3_we=("annual_glacier_mass_balance_km3_we", "sum"),
            clipped_basin_count=("storage_clipped_to_zero", "sum"),
        )
        .sort_values("year")
    )
    zemp_global = global_df.rename(columns={"zemp_global_INT_Gt": "zemp_global_annual_balance_km3_we"})
    annual_validation = annual_global.merge(zemp_global, on="year", how="left")
    annual_validation["annual_balance_difference_vs_zemp_km3_we"] = (
        annual_validation["reconstructed_global_annual_balance_km3_we"]
        - annual_validation["zemp_global_annual_balance_km3_we"]
    )
    annual_validation["annual_balance_capture_ratio_vs_zemp"] = (
        annual_validation["reconstructed_global_annual_balance_km3_we"]
        / annual_validation["zemp_global_annual_balance_km3_we"]
    )

    reference_total_km3_we = float(reference_df["farinotti_glacier_storage_km3_we"].sum())
    source_total_km3_we = farinotti_summary["source_grid_total_volume_km3_ice"] * ICE_TO_WATER_DENSITY_RATIO
    assigned_total_km3_we = farinotti_summary["assigned_volume_km3_ice"] * ICE_TO_WATER_DENSITY_RATIO
    p05_total = float(resolution_totals.loc[resolution_totals["resolution"] == "p05", "total_volume_km3_ice"].iloc[0])
    p50_total = float(resolution_totals.loc[resolution_totals["resolution"] == "p50", "total_volume_km3_ice"].iloc[0])

    bridge_area = bridge.groupby("rgi_region", as_index=False)["glacier_area_km2"].sum().rename(
        columns={"glacier_area_km2": "bridge_area_km2"}
    )
    zemp_area = region_df.groupby("rgi_region", as_index=False)["zemp_Area_AW_ref_km2"].median()
    area_validation = bridge_area.merge(zemp_area, on="rgi_region", how="outer")
    area_validation["area_capture_ratio"] = area_validation["bridge_area_km2"] / area_validation["zemp_Area_AW_ref_km2"]

    year_2000 = annual_validation.loc[annual_validation["year"] == REFERENCE_YEAR].iloc[0]
    period_2000_2016 = annual_validation[(annual_validation["year"] >= 2000) & (annual_validation["year"] <= 2016)]

    report = f"""# Glacier Storage Reconstruction Validation

## Product

- Output period: {int(storage_df['year'].min())}-{int(storage_df['year'].max())}.
- Reference absolute storage: Farinotti et al. (2019) 0.05 degree glacier volume grid, treated as an around-2000 absolute ice-volume reference.
- Annual change source: Zemp et al. (2019) regional `INT_mwe`; the globally validated product period is {int(storage_df['year'].min())}-{int(storage_df['year'].max())}.
- Density conversion: ice volume is converted to water equivalent with `rho_ice / rho_water = {ICE_TO_WATER_DENSITY_RATIO}`.

## Static Volume Check

- Farinotti 0.05 degree source-grid total: {farinotti_summary['source_grid_total_volume_km3_ice']:.2f} km3 ice = {source_total_km3_we:.2f} km3 water equivalent.
- Farinotti 0.50 degree source-grid total: {p50_total:.2f} km3 ice; relative difference from 0.05 degree total: {(p50_total - p05_total) / p05_total:.4%}.
- Assigned to HydroBASINS catchments by 0.05 degree cell centers: {farinotti_summary['assigned_volume_km3_ice']:.2f} km3 ice = {assigned_total_km3_we:.2f} km3 water equivalent.
- Unassigned source-grid volume: {farinotti_summary['unassigned_volume_km3_ice']:.2f} km3 ice.
- Assignment capture ratio: {assigned_total_km3_we / source_total_km3_we:.3f}.
- Basin reference-storage total in output: {reference_total_km3_we:.2f} km3 water equivalent.

The published Farinotti et al. global glacier ice-volume estimate is about 158,000 km3 ice; the source-grid total here is used as the direct validation target because it is the exact downloaded product.

## Annual Change Check

- Reconstructed basin-summed annual balance in {REFERENCE_YEAR}: {year_2000['reconstructed_global_annual_balance_km3_we']:.2f} km3 water equivalent.
- Zemp global `INT_Gt` in {REFERENCE_YEAR}: {year_2000['zemp_global_annual_balance_km3_we']:.2f} Gt, approximately km3 water equivalent.
- Difference in {REFERENCE_YEAR}: {year_2000['annual_balance_difference_vs_zemp_km3_we']:.2f} km3 water equivalent.
- Mean capture ratio versus Zemp global annual balance over 2000-2016: {period_2000_2016['annual_balance_capture_ratio_vs_zemp'].mean():.3f}.

The annual-change comparison is not expected to be exactly 1.0 because the basin product excludes source-grid or RGI glacier areas that are not assigned to the HydroBASINS polygons by the current catchment mask.

## Storage Range

- Reconstructed global storage in first year ({int(storage_df['year'].min())}): {annual_global.iloc[0]['reconstructed_global_storage_km3_we']:.2f} km3 water equivalent.
- Reconstructed global storage in reference year ({REFERENCE_YEAR}): {float(annual_global.loc[annual_global['year'] == REFERENCE_YEAR, 'reconstructed_global_storage_km3_we'].iloc[0]):.2f} km3 water equivalent.
- Reconstructed global storage in last year ({int(storage_df['year'].max())}): {annual_global.iloc[-1]['reconstructed_global_storage_km3_we']:.2f} km3 water equivalent.
- Basin-year records clipped to zero because reconstructed storage became negative: {int(storage_df['storage_clipped_to_zero'].sum())}.

## Interpretation

This is a reconstructed annual absolute glacier-water-storage series, not a purely observed annual storage product. The physically important step is using one static absolute storage reference and one annual mass-change series:

`absolute storage(t) = around-2000 absolute storage + cumulative annual mass change from 2000 to t`.
"""
    return annual_validation, area_validation, report


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    basins, basin_ids, geometries = load_basins()
    print("Aggregating Farinotti 0.05 degree volume grid to basins")
    resolution_totals = farinotti_resolution_totals()
    resolution_totals.to_csv(OUT_DIR / "validation_farinotti_grid_resolution_totals.csv", index=False)
    reference_df, farinotti_summary = aggregate_farinotti_to_basins(basin_ids, geometries)

    print("Reading Zemp regional annual mass-balance data")
    annual_by_region, region_df, global_df = read_zemp_region_balance()
    bridge = read_glacier_bridge()
    complete_years = sorted(set(global_df["year"].dropna().astype(int)).intersection(annual_by_region))
    balance_df = build_annual_balance_by_basin(basins, bridge, annual_by_region, complete_years)
    start_year, end_year = complete_years[0], complete_years[-1]

    print("Reconstructing annual absolute glacier storage")
    storage_df = reconstruct_absolute_storage(basins, reference_df, balance_df)
    storage_df.to_csv(OUT_DIR / f"basin_glacier_absolute_storage_{start_year}_{end_year}.csv", index=False)

    print("Running validation checks")
    annual_validation, area_validation, _report = validate_outputs(
        storage_df, reference_df, farinotti_summary, resolution_totals, bridge, region_df, global_df
    )
    annual_validation.to_csv(OUT_DIR / "validation_annual_global_balance.csv", index=False)
    area_validation.to_csv(OUT_DIR / "validation_rgi_region_area_capture.csv", index=False)
    print(f"Wrote results to {OUT_DIR}")


if __name__ == "__main__":
    main()
