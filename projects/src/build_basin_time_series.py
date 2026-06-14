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


PTOTWW_FILE = "watergap_22d_WFDEI-GPCC_histsoc_ptotww_monthly_1901_2016.nc4"
NATURAL_RUNOFF_FILE = "watergap_22d_WFDEI-GPCC_nosoc_ncrunnat_monthly_1901_2016.nc4"
EFR_REFERENCE_PERIOD = (1962, 1996)


WATERGAP_SPECS = [
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
        description="Build unified annual basin time series for net water-demand deficit, groundwater storage, and absolute glacier storage."
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


def compute_monthly_efr_flux() -> np.ndarray:
    """Estimate environmental flow requirement from naturalized runoff Q90."""
    file_path = DATASET_DIR / NATURAL_RUNOFF_FILE
    if not file_path.exists():
        raise FileNotFoundError(file_path)

    with Dataset(str(file_path)) as dataset:
        variable = dataset.variables["ncrunnat"]
        time_len = len(dataset.dimensions["time"])
        source_start, source_end = infer_year_range(file_path, time_len)
        if EFR_REFERENCE_PERIOD[0] < source_start or EFR_REFERENCE_PERIOD[1] > source_end:
            raise ValueError(
                f"EFR reference period {EFR_REFERENCE_PERIOD} is outside {source_start}-{source_end}"
            )

        efr = []
        for month_index in range(12):
            slices = []
            for year in range(EFR_REFERENCE_PERIOD[0], EFR_REFERENCE_PERIOD[1] + 1):
                offset = (year - source_start) * 12 + month_index
                grid = as_float_grid(variable[offset])
                grid = np.where(np.isfinite(grid), np.maximum(grid, 0.0), np.nan)
                slices.append(grid)
            with warnings.catch_warnings(), np.errstate(invalid="ignore"):
                warnings.simplefilter("ignore", category=RuntimeWarning)
                q90_exceedance = np.nanpercentile(np.stack(slices), 10, axis=0).astype(np.float32)
            efr.append(np.where(np.isfinite(q90_exceedance), np.maximum(q90_exceedance, 0.0), np.nan))
    return np.stack(efr).astype(np.float32)


def annual_net_water_demand_deficit_grid(
    demand_monthly: np.ndarray,
    natural_runoff_monthly: np.ndarray,
    efr_flux: np.ndarray,
    year: int,
) -> np.ndarray:
    demand = as_float_grid(demand_monthly)
    runoff = as_float_grid(natural_runoff_monthly)
    if demand.shape[0] != 12 or runoff.shape[0] != 12:
        raise ValueError(f"Expected 12 monthly slices for {year}, got {demand.shape} and {runoff.shape}")

    days = month_weights(year).reshape(12, 1, 1)
    demand = np.where(np.isfinite(demand), np.maximum(demand, 0.0), np.nan)
    runoff = np.where(np.isfinite(runoff), np.maximum(runoff, 0.0), np.nan)
    efr = np.where(np.isfinite(efr_flux), np.maximum(efr_flux, 0.0), np.nan)
    valid = np.isfinite(demand) & np.isfinite(runoff) & np.isfinite(efr)

    deficit_flux = np.maximum(demand + efr - runoff, 0.0)
    deficit_flux[~valid] = np.nan
    annual = np.nansum(deficit_flux * days * SECONDS_PER_DAY, axis=0, dtype=np.float64).astype(np.float32)
    annual[np.sum(valid, axis=0) == 0] = np.nan
    return annual


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


def read_net_water_demand_deficit_series(years: np.ndarray, basin_cells: list[np.ndarray]) -> dict[int, list[float]]:
    demand_path = DATASET_DIR / PTOTWW_FILE
    runoff_path = DATASET_DIR / NATURAL_RUNOFF_FILE
    if not demand_path.exists():
        raise FileNotFoundError(demand_path)
    if not runoff_path.exists():
        raise FileNotFoundError(runoff_path)

    efr_flux = compute_monthly_efr_flux()
    result: dict[int, list[float]] = {}
    with Dataset(str(demand_path)) as demand_dataset, Dataset(str(runoff_path)) as runoff_dataset:
        demand = demand_dataset.variables["ptotww"]
        runoff = runoff_dataset.variables["ncrunnat"]
        demand_start, demand_end = infer_year_range(demand_path, len(demand_dataset.dimensions["time"]))
        runoff_start, runoff_end = infer_year_range(runoff_path, len(runoff_dataset.dimensions["time"]))

        for year in years:
            year = int(year)
            if year < demand_start or year > demand_end or year < runoff_start or year > runoff_end:
                result[year] = [math.nan] * len(basin_cells)
                continue
            demand_offset = (year - demand_start) * 12
            runoff_offset = (year - runoff_start) * 12
            grid = annual_net_water_demand_deficit_grid(
                demand[demand_offset : demand_offset + 12],
                runoff[runoff_offset : runoff_offset + 12],
                efr_flux,
                year,
            )
            result[year] = aggregate_grid_by_basin(grid, basin_cells)
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
- WaterGAP values are available for 1273 catchments; two catchments contain no valid WaterGAP grid values and remain `NaN` for net water-demand deficit and groundwater storage.
- Rows: {total_catchments * (end_year - start_year + 1)} catchment-year records.

## Output Variables

- `net_water_demand_deficit_mm_yr`: annual water-demand deficit after local naturalized runoff availability is used to satisfy potential total withdrawal and environmental-flow requirement.
- `groundwater_storage_mm`: annual mean groundwater storage from WaterGAP `groundwstor`.
- `glacier_storage_mm_we`: reconstructed annual absolute glacier water storage, expressed as water-equivalent depth over the full catchment area.

All three outputs are area-normalized water depths. Net water-demand deficit is an annual flux amount (`mm yr-1`); groundwater and glacier storage are annual storage states (`mm`).

## WaterGAP Processing

### Net Water-Demand Deficit

Monthly potential total water withdrawal comes from WaterGAP 2.2d `ptotww`. Local water availability comes from naturalized net cell runoff, WaterGAP 2.2d `ncrunnat`. Natural demand is represented as environmental-flow requirement (EFR), estimated for each grid cell and calendar month as the Q90 exceedance value of naturalized runoff over {EFR_REFERENCE_PERIOD[0]}-{EFR_REFERENCE_PERIOD[1]}. In ordinary percentile notation this is the 10th percentile of monthly naturalized runoff for that calendar month.

For each month:

`deficit_flux = max(ptotww + EFR - ncrunnat, 0)`

`monthly_deficit_mm = deficit_flux * days_in_month * 86400`

Monthly deficits are summed to annual depth and averaged across WaterGAP grid cells assigned to each catchment. The resulting variable is a local supply-adjusted demand deficit, not raw total withdrawal.

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
        "net_water_demand_deficit_mm_yr",
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
                    "net_water_demand_deficit_mm_yr": watergap_values["net_water_demand_deficit"][year][basin_index],
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
    print(f"Aggregating net_water_demand_deficit from {PTOTWW_FILE} and {NATURAL_RUNOFF_FILE}")
    watergap_values["net_water_demand_deficit"] = read_net_water_demand_deficit_series(years, basin_cells)
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
