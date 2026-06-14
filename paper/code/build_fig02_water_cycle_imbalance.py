"""
Catchment-scale water-imbalance classification.

Each catchment is classified from the combination of imbalanced net
water-demand deficit, groundwater-storage, and glacier-storage variables.
The net water-demand deficit is derived from WaterGAP 2.2d potential total
withdrawal, naturalized runoff availability, and environmental-flow demand.
"""

from __future__ import annotations

import csv
import json
import math
import struct
import warnings
import zipfile
from collections import defaultdict
from pathlib import Path

import matplotlib as mpl
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.collections import LineCollection
from matplotlib.patches import Patch, Polygon
from netCDF4 import Dataset


ROOT = Path(__file__).resolve().parents[2]
DATASET_DIR = ROOT / "projects" / "datasets"
BASIN_DATA = ROOT / "projects" / "basin-data.js"
TIMESERIES = ROOT / "projects" / "datasets" / "basin_time_series" / "basin_three_variable_timeseries_1962_2016.csv"
CHARTS = ROOT / "paper" / "charts"
REPORTS = ROOT / "paper" / "reports"
BASEMAPS = ROOT / "paper" / "data" / "basemaps" / "natural_earth"

HISTORICAL_PERIOD = (1962, 1996)
RECENT_PERIOD = (1997, 2016)
HISTORICAL_STD_MULTIPLIER = 2.0
ABSOLUTE_DIFFERENCE_MIN_MM = 1.0

PTOTWW_FILE = "watergap_22d_WFDEI-GPCC_histsoc_ptotww_monthly_1901_2016.nc4"
SECONDS_PER_DAY = 86400.0
CELL_WITHDRAWAL_MIN_MM_DAY = 0.10
HUMAN_CATCHMENT_ACTIVE_AREA_MIN = 0.10
HUMAN_IMPACTED_EDGE = "#475569"

VARIABLES = [
    {
        "id": "net_water_demand_deficit_mm_yr",
        "key": "deficit",
        "label": "Water-demand deficit",
    },
    {
        "id": "groundwater_storage_mm",
        "key": "groundwater",
        "label": "Groundwater storage",
    },
    {
        "id": "glacier_storage_mm_we",
        "key": "glacier",
        "label": "Glacier storage",
    },
]

CLASS_STYLES = {
    "none": {"label": "No detected imbalance", "color": "#eef2f7"},
    "deficit": {"label": "Water-demand deficit", "color": "#e3b23c"},
    "groundwater": {"label": "Groundwater storage", "color": "#c767b1"},
    "glacier": {"label": "Glacier storage", "color": "#2fb7c8"},
    "deficit+groundwater": {"label": "Deficit + groundwater", "color": "#d85f55"},
    "deficit+glacier": {"label": "Deficit + glacier", "color": "#66b95a"},
    "groundwater+glacier": {"label": "Groundwater + glacier", "color": "#4f7fd5"},
    "deficit+groundwater+glacier": {"label": "All three variables", "color": "#3f4652"},
}


def read_assignment_json(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    payload = text.split("=", 1)[1].strip().rstrip(";")
    return json.loads(payload)


def infer_year_range(file_path: Path, time_len: int) -> tuple[int, int]:
    stem = file_path.name
    for part in stem.split("_"):
        if part.isdigit() and len(part) == 4:
            start = int(part)
            return start, start + time_len // 12 - 1
    return 1901, 1901 + time_len // 12 - 1


def as_float_grid(values: np.ndarray) -> np.ndarray:
    if np.ma.isMaskedArray(values):
        values = values.filled(np.nan)
    array = np.asarray(values, dtype=np.float32)
    array = np.squeeze(array)
    array[np.abs(array) > 1e20] = np.nan
    return array


def human_impacted_cell_mask() -> np.ndarray:
    file_path = DATASET_DIR / PTOTWW_FILE
    with Dataset(str(file_path)) as dataset:
        variable = dataset.variables["ptotww"]
        source_start, source_end = infer_year_range(file_path, len(dataset.dimensions["time"]))
        if RECENT_PERIOD[0] < source_start or RECENT_PERIOD[1] > source_end:
            raise ValueError(f"Recent period is outside {source_start}-{source_end}")

        total = np.zeros((360, 720), dtype=np.float64)
        count = np.zeros((360, 720), dtype=np.float64)
        for year in range(RECENT_PERIOD[0], RECENT_PERIOD[1] + 1):
            offset = (year - source_start) * 12
            values = as_float_grid(variable[offset : offset + 12])
            valid = np.isfinite(values)
            total += np.nansum(np.where(valid, values, 0.0), axis=0, dtype=np.float64)
            count += np.sum(valid, axis=0, dtype=np.float64)
    with np.errstate(invalid="ignore", divide="ignore"):
        mean_flux = total / count
    mean_flux[count == 0] = np.nan
    return np.isfinite(mean_flux) & (mean_flux * SECONDS_PER_DAY >= CELL_WITHDRAWAL_MIN_MM_DAY)


def active_area_fraction(active_mask: np.ndarray, cells: np.ndarray, weights: np.ndarray) -> float:
    selected_weights = weights[cells]
    finite = np.isfinite(selected_weights)
    if not finite.any() or selected_weights[finite].sum() <= 0:
        return 0.0
    active = active_mask.ravel()[cells][finite]
    return float(selected_weights[finite][active].sum() / selected_weights[finite].sum())


def mean(values: list[float]) -> float:
    return sum(values) / len(values)


def population_standard_deviation(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    average = mean(values)
    return math.sqrt(sum((value - average) ** 2 for value in values) / len(values))


def read_basin_classification() -> dict[str, dict]:
    by_basin: dict[str, list[dict]] = defaultdict(list)
    with TIMESERIES.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            record = {"year": int(row["year"])}
            for variable in VARIABLES:
                raw = row[variable["id"]]
                try:
                    value = float(raw)
                except (TypeError, ValueError):
                    value = math.nan
                record[variable["id"]] = value
            by_basin[str(row["basin_id"])].append(record)

    classification = {}
    for basin_id, records in by_basin.items():
        records.sort(key=lambda record: record["year"])
        metrics = {}
        imbalanced_variables = []
        for variable in VARIABLES:
            historical = [
                record[variable["id"]]
                for record in records
                if HISTORICAL_PERIOD[0] <= record["year"] <= HISTORICAL_PERIOD[1]
                and math.isfinite(record[variable["id"]])
            ]
            recent = [
                record[variable["id"]]
                for record in records
                if RECENT_PERIOD[0] <= record["year"] <= RECENT_PERIOD[1]
                and math.isfinite(record[variable["id"]])
            ]
            if not historical or not recent:
                metrics[variable["key"]] = {"imbalanced": False, "status": "insufficient-data"}
                continue

            historical_mean = mean(historical)
            recent_mean = mean(recent)
            historical_std = population_standard_deviation(historical)
            difference = recent_mean - historical_mean
            is_imbalanced = (
                abs(difference) > HISTORICAL_STD_MULTIPLIER * historical_std
                and abs(difference) > ABSOLUTE_DIFFERENCE_MIN_MM
            )
            metrics[variable["key"]] = {
                "imbalanced": is_imbalanced,
                "status": "evaluated",
                "historical_mean": historical_mean,
                "recent_mean": recent_mean,
                "historical_standard_deviation": historical_std,
                "difference": difference,
            }
            if is_imbalanced:
                imbalanced_variables.append(variable["key"])

        class_id = "+".join(imbalanced_variables) if imbalanced_variables else "none"
        classification[basin_id] = {
            "class": class_id,
            "label": CLASS_STYLES[class_id]["label"],
            "imbalanced_variables": imbalanced_variables,
            "metrics": metrics,
        }
    return classification


def robinson(lon_deg, lat_deg):
    robinson_x = np.array([1.0000, 0.9986, 0.9954, 0.9900, 0.9822, 0.9730, 0.9600, 0.9427, 0.9216, 0.8962, 0.8679, 0.8350, 0.7986, 0.7597, 0.7186, 0.6732, 0.6213, 0.5722, 0.5322])
    robinson_y = np.array([0.0000, 0.0620, 0.1240, 0.1860, 0.2480, 0.3100, 0.3720, 0.4340, 0.4958, 0.5571, 0.6158, 0.6769, 0.7346, 0.7903, 0.8435, 0.8936, 0.9394, 0.9761, 1.0000])
    abs_lat = np.clip(np.abs(lat_deg), 0, 90)
    xp = np.interp(abs_lat, np.arange(0, 91, 5), robinson_x)
    yp = np.interp(abs_lat, np.arange(0, 91, 5), robinson_y)
    return 0.8487 * xp * np.radians(lon_deg), 1.3523 * yp * np.sign(lat_deg)


def read_shp_parts(zip_path: Path):
    with zipfile.ZipFile(zip_path) as zf:
        shp_name = next(name for name in zf.namelist() if name.lower().endswith(".shp"))
        data = zf.read(shp_name)
    parts = []
    offset = 100
    while offset + 8 < len(data):
        content_words = struct.unpack(">i", data[offset + 4:offset + 8])[0]
        offset += 8
        record = data[offset:offset + content_words * 2]
        offset += content_words * 2
        if len(record) < 44:
            continue
        shape_type = struct.unpack("<i", record[:4])[0]
        if shape_type not in (5, 15, 25):
            continue
        num_parts = struct.unpack("<i", record[36:40])[0]
        num_points = struct.unpack("<i", record[40:44])[0]
        starts = list(struct.unpack(f"<{num_parts}i", record[44:44 + 4 * num_parts]))
        point_start = 44 + 4 * num_parts
        points = np.frombuffer(record[point_start:point_start + 16 * num_points], dtype="<f8").reshape(num_points, 2)
        starts.append(num_points)
        for start, end in zip(starts[:-1], starts[1:]):
            if end - start >= 3:
                parts.append(points[start:end].copy())
    return parts


BASEMAP_CACHE = {}


def basemap_parts(name: str):
    if name not in BASEMAP_CACHE:
        BASEMAP_CACHE[name] = read_shp_parts(BASEMAPS / name)
    return BASEMAP_CACHE[name]


def add_basemap(ax):
    for points in basemap_parts("ne_50m_land.zip"):
        lon = points[:, 0]
        lat = points[:, 1]
        if np.nanmax(lon) - np.nanmin(lon) > 300:
            continue
        x, y = robinson(lon, lat)
        ax.plot(x, y, color="#6f695f", lw=0.28, alpha=0.55, zorder=5)


def add_graticule(ax):
    for lat in np.arange(-60, 90, 30):
        lon_line = np.linspace(-180, 180, 721)
        lat_line = np.full_like(lon_line, lat)
        x, y = robinson(lon_line, lat_line)
        ax.plot(x, y, color="#cbc3b5", lw=0.24, alpha=0.46, zorder=1)


def add_projection_frame(ax):
    top_lon = np.linspace(-180, 180, 721)
    top_lat = np.full_like(top_lon, 89.9)
    right_lat = np.linspace(89.9, -89.9, 361)
    right_lon = np.full_like(right_lat, 180)
    bottom_lon = np.linspace(180, -180, 721)
    bottom_lat = np.full_like(bottom_lon, -89.9)
    left_lat = np.linspace(-89.9, 89.9, 361)
    left_lon = np.full_like(left_lat, -180)
    lon_line = np.r_[top_lon, right_lon, bottom_lon, left_lon, top_lon[:1]]
    lat_line = np.r_[top_lat, right_lat, bottom_lat, left_lat, top_lat[:1]]
    x, y = robinson(lon_line, lat_line)
    ax.plot(x, y, color="#4a4840", lw=0.50, alpha=0.58, zorder=8)
    for lon in np.arange(-120, 180, 60):
        lat_line = np.linspace(-85, 85, 401)
        lon_line = np.full_like(lat_line, lon)
        x, y = robinson(lon_line, lat_line)
        ax.plot(x, y, color="#cbc3b5", lw=0.24, alpha=0.46, zorder=1)


def style_axis(ax):
    ax.set_aspect("equal")
    ax.set_xlim(-2.72, 2.72)
    ax.set_ylim(-1.42, 1.42)
    ax.set_axis_off()
    ax.set_facecolor("#f4f1eb")
    add_graticule(ax)


def polygon_from_ring(ring, *, facecolor, edgecolor, linewidth, alpha=1.0, zorder=3):
    points = np.asarray(ring, dtype=float)
    if points.shape[0] < 3:
        return None
    lon = points[:, 0]
    lat = points[:, 1]
    if np.nanmax(lon) - np.nanmin(lon) > 300:
        return None
    x, y = robinson(lon, lat)
    return Polygon(
        np.column_stack([x, y]),
        closed=True,
        facecolor=facecolor,
        edgecolor=edgecolor,
        linewidth=linewidth,
        alpha=alpha,
        zorder=zorder,
    )


def projected_ring_segment(ring):
    points = np.asarray(ring, dtype=float)
    if points.shape[0] < 3:
        return None
    lon = points[:, 0]
    lat = points[:, 1]
    if np.nanmax(lon) - np.nanmin(lon) > 300:
        return None
    x, y = robinson(lon, lat)
    return np.column_stack([x, y])


def draw_basin_fill(ax, basin: dict, color: str):
    for ring in basin.get("rings", []):
        patch = polygon_from_ring(
            ring,
            facecolor=color,
            edgecolor="#ffffff",
            linewidth=0.08,
            alpha=0.94,
            zorder=3,
        )
        if patch is not None:
            ax.add_patch(patch)


def add_boundary_collections(ax, basins: list[dict], human_domains: dict[int, bool]):
    base_segments = []
    human_segments = []
    for basin in basins:
        for ring in basin.get("rings", []):
            segment = projected_ring_segment(ring)
            if segment is None:
                continue
            base_segments.append(segment)
            if human_domains.get(basin["id"], False):
                human_segments.append(segment)
    if base_segments:
        ax.add_collection(LineCollection(base_segments, colors="#ffffff", linewidths=0.16, alpha=0.98, zorder=5))
    if human_segments:
        ax.add_collection(LineCollection(human_segments, colors=HUMAN_IMPACTED_EDGE, linewidths=0.54, alpha=0.98, zorder=7))


def make_figure():
    mpl.rcParams.update({"font.family": "DejaVu Sans", "savefig.transparent": False})
    CHARTS.mkdir(parents=True, exist_ok=True)
    REPORTS.mkdir(parents=True, exist_ok=True)

    basins = read_assignment_json(BASIN_DATA)["basins"]
    lat = np.asarray([89.75 - 0.5 * index for index in range(360)], dtype=float)
    weights = np.repeat(np.cos(np.deg2rad(lat))[:, None], 720, axis=1).ravel()
    human_cell_mask = human_impacted_cell_mask()
    classification = read_basin_classification()

    class_counts = {key: 0 for key in CLASS_STYLES}
    human_count = 0
    human_domains: dict[int, bool] = {}
    records = []

    fig, ax = plt.subplots(figsize=(13.2, 7.65), dpi=520)
    fig.patch.set_facecolor("#f8f6f2")
    style_axis(ax)

    for basin in basins:
        basin_id = str(basin["id"])
        result = classification.get(basin_id, {"class": "none", "label": CLASS_STYLES["none"]["label"], "imbalanced_variables": [], "metrics": {}})
        class_id = result["class"]
        class_counts[class_id] += 1
        draw_basin_fill(ax, basin, CLASS_STYLES[class_id]["color"])

        cells = np.asarray(basin["cells"], dtype=np.int64)
        human_fraction = active_area_fraction(human_cell_mask, cells, weights)
        human_impacted = human_fraction >= HUMAN_CATCHMENT_ACTIVE_AREA_MIN
        human_domains[basin["id"]] = human_impacted
        human_count += int(human_impacted)

        record = {
            "id": basin["id"],
            "name": basin["name"],
            "region": basin["region"],
            "area_km2": basin["areaKm2"],
            "human_impacted": human_impacted,
            "human_active_area_fraction": human_fraction,
            "class": class_id,
            "label": result["label"],
            "imbalanced_variables": "+".join(result["imbalanced_variables"]),
        }
        for variable in VARIABLES:
            metric = result["metrics"].get(variable["key"], {})
            prefix = variable["key"]
            record[f"{prefix}_imbalanced"] = metric.get("imbalanced", False)
            record[f"{prefix}_historical_mean"] = metric.get("historical_mean", "")
            record[f"{prefix}_recent_mean"] = metric.get("recent_mean", "")
            record[f"{prefix}_historical_standard_deviation"] = metric.get("historical_standard_deviation", "")
            record[f"{prefix}_difference"] = metric.get("difference", "")
        records.append(record)

    add_boundary_collections(ax, basins, human_domains)
    add_basemap(ax)
    add_projection_frame(ax)

    handles = [
        Patch(
            facecolor=style["color"],
            edgecolor="none",
            label=f"{style['label']} ({class_counts[key]})",
        )
        for key, style in CLASS_STYLES.items()
    ]
    handles.append(
        Patch(
            facecolor="#f8f6f2",
            edgecolor=HUMAN_IMPACTED_EDGE,
            linewidth=1.4,
            label=f"Human-impacted catchment ({human_count})",
        )
    )
    legend = ax.legend(
        handles=handles,
        loc="lower center",
        bbox_to_anchor=(0.5, -0.090),
        frameon=True,
        framealpha=0.94,
        facecolor="#f8f6f2",
        edgecolor="#d8d0c3",
        fontsize=6.7,
        ncol=3,
        handlelength=1.7,
        columnspacing=1.1,
    )
    legend.get_frame().set_linewidth(0.45)

    output = CHARTS / "fig02_water_cycle_imbalance.png"
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", category=UserWarning)
        fig.savefig(output, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)

    csv_path = REPORTS / "water_cycle_imbalance.csv"
    fieldnames = list(records[0])
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)

    report_path = REPORTS / "water_cycle_imbalance_summary.md"
    lines = [
        "# Water-Cycle Imbalance",
        "",
        f"- Historical period: {HISTORICAL_PERIOD[0]}-{HISTORICAL_PERIOD[1]}.",
        f"- Recent 20-year period: {RECENT_PERIOD[0]}-{RECENT_PERIOD[1]}.",
        f"- Variable imbalance rule: absolute recent-minus-historical mean difference exceeds both {HISTORICAL_STD_MULTIPLIER:g} historical standard deviations and {ABSOLUTE_DIFFERENCE_MIN_MM:g} mm.",
        "- Catchment class: combination of imbalanced net water-demand deficit, groundwater storage, and glacier storage variables.",
        f"- Net water-demand deficit: max(0, potential total withdrawal + environmental-flow requirement - naturalized runoff availability), aggregated monthly to annual basin means.",
        f"- Human-impacted boundary: WaterGAP 2.2d `ptotww` cells with recent mean total withdrawal >= {CELL_WITHDRAWAL_MIN_MM_DAY:.2f} mm/day occupy >= {HUMAN_CATCHMENT_ACTIVE_AREA_MIN:.0%} of catchment area.",
        f"- Human-impacted catchments outlined in slate gray: {human_count}.",
        "",
        "| Class | Catchment count | Color |",
        "|---|---:|---|",
    ]
    for key, style in CLASS_STYLES.items():
        lines.append(f"| {style['label']} | {class_counts[key]} | `{style['color']}` |")
    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"Saved: {output}")
    print(f"Saved: {csv_path}")
    print(f"Saved: {report_path}")
    print(f"Class counts: {class_counts}")
    print(f"Human-impacted catchments: {human_count}")
    return output


if __name__ == "__main__":
    make_figure()
