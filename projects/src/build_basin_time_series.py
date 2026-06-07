from __future__ import annotations

import argparse
import calendar
import csv
import json
import math
import re
import warnings
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from netCDF4 import Dataset


ROOT = Path(__file__).resolve().parents[2]
PROJECTS_DIR = ROOT / "projects"
DATASET_DIR = PROJECTS_DIR / "datasets"
BASIN_DATA_PATH = PROJECTS_DIR / "basin-data.js"
OUTPUT_DIR = DATASET_DIR / "basin_time_series"
GLACIER_STORAGE_PATH = (
    PROJECTS_DIR
    / "glacier_storage_reconstruction"
    / "results"
    / "basin_glacier_absolute_storage_1962_2016.csv"
)

SECONDS_PER_DAY = 86400.0


@dataclass(frozen=True)
class SeriesSpec:
    code: str
    column: str
    source_file: str
    variable_name: str
    aggregation: str
    unit: str
    description: str


WATERGAP_SPECS = [
    SeriesSpec(
        code="total_water_withdrawal",
        column="potential_total_water_withdrawal_mm_yr",
        source_file="watergap_22d_WFDEI-GPCC_histsoc_ptotww_monthly_1901_2016.nc4",
        variable_name="ptotww",
        aggregation="flux_to_annual_depth",
        unit="mm yr-1",
        description="Potential total water withdrawals, annual depth over the basin.",
    ),
    SeriesSpec(
        code="groundwater_storage",
        column="groundwater_storage_mm",
        source_file="watergap_22d_WFDEI-GPCC_histsoc_groundwstor_monthly_1901_2016.nc4",
        variable_name="groundwstor",
        aggregation="annual_mean_storage",
        unit="mm",
        description="Annual mean groundwater storage, basin mean water equivalent.",
    ),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build unified annual basin time series for total water withdrawal, groundwater storage, and absolute glacier storage."
    )
    parser.add_argument("--start-year", type=int, default=1962)
    parser.add_argument("--end-year", type=int, default=2016)
    parser.add_argument("--output-dir", type=Path, default=OUTPUT_DIR)
    return parser.parse_args()


def load_basins() -> list[dict]:
    text = BASIN_DATA_PATH.read_text(encoding="utf-8")
    match = re.search(r"window\.BASIN_DATA\s*=\s*(\{.*\})\s*;?\s*$", text, flags=re.S)
    if not match:
        raise ValueError(f"Could not parse {BASIN_DATA_PATH}")
    data = json.loads(match.group(1))
    basins = data["basins"]
    basins.sort(key=lambda basin: basin["id"])
    return basins


def infer_year_range(file_path: Path, time_len: int) -> tuple[int, int]:
    match = re.search(r"_(\d{4})_(\d{4})(?:\.|$)", file_path.name)
    if match:
        return int(match.group(1)), int(match.group(2))
    return 1901, 1901 + time_len - 1


def as_float_grid(values: np.ndarray) -> np.ndarray:
    if np.ma.isMaskedArray(values):
        values = values.filled(np.nan)
    array = np.asarray(values, dtype=np.float32)
    array = np.squeeze(array)
    array[np.abs(array) > 1e20] = np.nan
    return array


def month_weights(year: int) -> np.ndarray:
    return np.asarray([calendar.monthrange(year, month)[1] for month in range(1, 13)], dtype=np.float32)


def annual_grid(monthly_values: np.ndarray, year: int, aggregation: str) -> np.ndarray:
    values = as_float_grid(monthly_values)
    if values.shape[0] != 12:
        raise ValueError(f"Expected 12 monthly slices for {year}, got shape {values.shape}")

    days = month_weights(year).reshape(12, 1, 1)
    valid = np.isfinite(values)

    if aggregation == "flux_to_annual_depth":
        annual = np.nansum(values * days * SECONDS_PER_DAY, axis=0, dtype=np.float64).astype(np.float32)
        annual[np.sum(valid, axis=0) == 0] = np.nan
        return annual

    if aggregation == "annual_mean_storage":
        weighted = np.nansum(values * days, axis=0, dtype=np.float64)
        valid_days = np.sum(np.where(valid, days, 0.0), axis=0, dtype=np.float64)
        with np.errstate(invalid="ignore", divide="ignore"):
            annual = (weighted / valid_days).astype(np.float32)
        annual[valid_days == 0] = np.nan
        return annual

    raise ValueError(f"Unsupported aggregation: {aggregation}")


def aggregate_grid_by_basin(grid: np.ndarray, basin_cells: list[np.ndarray]) -> list[float]:
    flat = grid.reshape(-1)
    values: list[float] = []
    for cells in basin_cells:
        with warnings.catch_warnings(), np.errstate(invalid="ignore"):
            warnings.simplefilter("ignore", category=RuntimeWarning)
            value = np.nanmean(flat[cells], dtype=np.float64) if len(cells) else np.nan
        values.append(float(value) if np.isfinite(value) else math.nan)
    return values


def read_watergap_series(spec: SeriesSpec, years: np.ndarray, basin_cells: list[np.ndarray]) -> dict[int, list[float]]:
    file_path = DATASET_DIR / spec.source_file
    if not file_path.exists():
        raise FileNotFoundError(file_path)

    result: dict[int, list[float]] = {}
    with Dataset(str(file_path)) as dataset:
        variable = dataset.variables[spec.variable_name]
        time_len = len(dataset.dimensions["time"])
        source_start, source_end = infer_year_range(file_path, time_len)
        if time_len % 12 != 0:
            raise ValueError(f"{file_path.name} is expected to be monthly; time length={time_len}")

        for year in years:
            if year < source_start or year > source_end:
                result[int(year)] = [math.nan] * len(basin_cells)
                continue
            offset = (int(year) - source_start) * 12
            grid = annual_grid(variable[offset : offset + 12], int(year), spec.aggregation)
            result[int(year)] = aggregate_grid_by_basin(grid, basin_cells)

    return result


def read_glacier_storage_series(basins: list[dict], years: np.ndarray) -> dict[int, list[float]]:
    if not GLACIER_STORAGE_PATH.exists():
        raise FileNotFoundError(
            f"Absolute glacier storage reconstruction is missing: {GLACIER_STORAGE_PATH}"
        )

    basin_index = {int(basin["id"]): index for index, basin in enumerate(basins)}
    result = {int(year): [0.0] * len(basins) for year in years}
    seen: set[tuple[int, int]] = set()
    with GLACIER_STORAGE_PATH.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            year = int(row["year"])
            basin_id = int(row["basin_id"])
            if year not in result or basin_id not in basin_index:
                continue
            result[year][basin_index[basin_id]] = float(row["glacier_storage_mm_we"])
            seen.add((year, basin_id))

    expected = len(years) * len(basins)
    if len(seen) != expected:
        raise ValueError(
            f"Glacier storage coverage mismatch: found {len(seen)} basin-years, expected {expected}"
        )
    return result


def write_readme(
    output_dir: Path,
    output_name: str,
    start_year: int,
    end_year: int,
    total_catchments: int,
    glacier_catchments: int,
) -> None:
    glacier_percent = glacier_catchments / total_catchments * 100.0 if total_catchments else 0.0
    text = f"""# Unified Basin Hydrology Time Series

This is the authoritative unified annual time-series dataset for the three selected catchment-scale hydrological variables. The common period is {start_year}-{end_year}, determined by the globally validated glacier-storage reconstruction.

Output file:
- `{output_name}`

Coverage:
- Total catchments: {total_catchments}.
- Catchments with non-zero glacier storage in at least one year: {glacier_catchments}, or {glacier_percent:.2f}%.
- Catchments without glaciers are retained with `glacier_storage_mm_we = 0`.
- WaterGAP values are available for 1273 catchments; two catchments contain no valid WaterGAP grid values and remain `NaN` for total water withdrawal and groundwater storage.
- Rows: {total_catchments * (end_year - start_year + 1)} catchment-year records.

## Output Variables

- `potential_total_water_withdrawal_mm_yr`: annual potential total water withdrawal depth from WaterGAP `ptotww`. It includes total potential withdrawals across sectors and water sources.
- `groundwater_storage_mm`: annual mean groundwater storage from WaterGAP `groundwstor`.
- `glacier_storage_mm_we`: reconstructed annual absolute glacier water storage, expressed as water-equivalent depth over the full catchment area.

All three outputs are area-normalized water depths. Total water withdrawal is an annual flux amount (`mm yr-1`); groundwater and glacier storage are annual storage states (`mm`).

## WaterGAP Processing

### Potential Total Water Withdrawal

Monthly WaterGAP 2.2d `ptotww` flux in `kg m-2 s-1` is integrated using calendar month length:

`monthly_depth_mm = ptotww_kg_m2_s * days_in_month * 86400`

Monthly depths are summed to annual depth and averaged across WaterGAP grid cells assigned to each catchment. This is total potential withdrawal, not groundwater-only withdrawal.

### Groundwater Storage

Monthly WaterGAP 2.2d `groundwstor` in `kg m-2` is directly equivalent to `mm` water. A day-weighted annual mean is computed and averaged across catchment grid cells.

## Glacier Absolute-Storage Reconstruction

The glacier variable is an absolute storage-state reconstruction, not raw glacier area, annual loss, or cumulative change alone.

### Around-2000 Absolute Reference

- Farinotti et al. (2019) global 0.05 degree glacier-volume grid, based on RGI 6.0.
- Ice volume is converted to water-equivalent volume using `rho_ice / rho_water = 0.9`.
- Grid-cell-center values are assigned to HydroBASINS catchments.

### Annual Changes And Reconstruction

- Zemp et al. (2019) regional annual `INT_mwe` supplies annual specific glacier mass balance.
- RGI glacier outlines are intersected with catchments to calculate glacier area by RGI region within each catchment.

`annual_balance_km3_we = 0.001 * sum(INT_mwe_region * glacier_area_km2_in_catchment_region)`

`storage(t) = storage(around 2000) + cumulative annual mass balance from 2000 to t`

Negative reconstructed storage is clipped to zero. Absolute water-equivalent storage volume is converted to the unified depth variable:

`glacier_storage_mm_we = glacier_storage_km3_we / catchment_area_km2 * 1,000,000`

## Glacier Cross Validation

- Farinotti 0.05 degree source-grid total: `158237.04 km3 ice`, consistent with the published approximately `158000 km3 ice`.
- Farinotti 0.50 degree source-grid total: `158165.89 km3 ice`; difference from the 0.05 degree total is only `-0.0450%`.
- Volume assigned to HydroBASINS catchments: `109764.12 km3 ice`, or `98787.71 km3 water equivalent`.
- HydroBASINS assignment captures `69.4%` of source-grid global glacier volume; the remainder primarily falls outside the current catchment mask.
- Reconstructed basin-summed annual balance in 2000: `-139.46 km3 water equivalent`.
- Zemp global `INT_Gt` in 2000: `-147.00 Gt`, approximately `-147.00 km3 water equivalent`.
- Mean annual-balance capture ratio relative to Zemp global values over 2000-2016: `1.043`.
- Reconstructed catchment-assigned storage totals: `103193.57 km3 we` in 1962, `98787.71 km3 we` in 2000, and `93561.67 km3 we` in 2016.
- `153` catchment-year records were clipped to zero because reconstructed storage became negative.

## Reproducibility

- Unified builder: `projects/src/build_basin_time_series.py`
- Glacier reconstruction: `projects/glacier_storage_reconstruction/scripts/reconstruct_basin_glacier_storage.py`
- Glacier supporting results and validation tables: `projects/glacier_storage_reconstruction/results/`
"""
    (output_dir / "README.md").write_text(text, encoding="utf-8")


def write_csv(
    output_dir: Path,
    output_name: str,
    basins: list[dict],
    years: np.ndarray,
    watergap_values: dict[str, dict[int, list[float]]],
    glacier_values: dict[int, list[float]],
) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / output_name
    columns = [
        "basin_id",
        "basin_name",
        "region",
        "basin_area_km2",
        "cell_count",
        "year",
        "potential_total_water_withdrawal_mm_yr",
        "groundwater_storage_mm",
        "glacier_storage_mm_we",
    ]

    try:
        handle = output_path.open("w", encoding="utf-8", newline="")
    except PermissionError:
        output_path = output_path.with_name(f"{output_path.stem}_updated{output_path.suffix}")
        handle = output_path.open("w", encoding="utf-8", newline="")

    with handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        for year in years:
            year = int(year)
            for basin_index, basin in enumerate(basins):
                basin_id = int(basin["id"])
                row = {
                    "basin_id": basin_id,
                    "basin_name": basin.get("name", ""),
                    "region": basin.get("region", ""),
                    "basin_area_km2": basin.get("areaKm2", ""),
                    "cell_count": basin.get("cellCount", ""),
                    "year": year,
                    "potential_total_water_withdrawal_mm_yr": watergap_values["total_water_withdrawal"][year][basin_index],
                    "groundwater_storage_mm": watergap_values["groundwater_storage"][year][basin_index],
                    "glacier_storage_mm_we": glacier_values[year][basin_index],
                }
                writer.writerow(row)
    return output_path


def main() -> None:
    args = parse_args()
    years = np.arange(args.start_year, args.end_year + 1, dtype=np.int16)
    basins = load_basins()
    basin_cells = [np.asarray(basin.get("cells", []), dtype=np.int64) for basin in basins]

    watergap_values: dict[str, dict[int, list[float]]] = {}
    for spec in WATERGAP_SPECS:
        print(f"Aggregating {spec.code} from {spec.source_file}")
        watergap_values[spec.code] = read_watergap_series(spec, years, basin_cells)

    glacier_values = read_glacier_storage_series(basins, years)

    output_name = f"basin_three_variable_timeseries_{args.start_year}_{args.end_year}.csv"
    output_path = write_csv(args.output_dir, output_name, basins, years, watergap_values, glacier_values)
    glacier_catchments = 0
    for basin_index in range(len(basins)):
        if any(glacier_values[int(year)][basin_index] > 0 for year in years):
            glacier_catchments += 1
    write_readme(
        args.output_dir,
        output_path.name,
        args.start_year,
        args.end_year,
        len(basins),
        glacier_catchments,
    )
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
