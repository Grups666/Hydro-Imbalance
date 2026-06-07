"""
Global catchment classification of human water-use influence.

The map classifies HydroBASINS level-4 catchments by dominant recent
human-water-use type. Intensities are converted from kg m-2 s-1 to mm day-1.
"""

from __future__ import annotations

import csv
import json
import struct
import warnings
import zipfile
from pathlib import Path

import matplotlib as mpl
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.collections import LineCollection
from matplotlib.colors import to_rgb
from matplotlib.patches import Patch, Polygon


ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / "projects" / "web"
BASIN_DATA = ROOT / "projects" / "basin-data.js"
CHARTS = ROOT / "paper" / "charts"
REPORTS = ROOT / "paper" / "reports"
BASEMAPS = ROOT / "paper" / "data" / "basemaps" / "natural_earth"
WINDOW = "20"
SECONDS_PER_DAY = 86400.0
HUMAN_WITHDRAWAL_CODES = ["pirrww", "pelecww", "pmanww", "pdomww"]
CELL_WITHDRAWAL_MIN_MM_DAY = 0.10
CATCHMENT_ACTIVE_AREA_MIN = 0.10
CELL_SINGLE_SHARE = 0.50
CELL_SECOND_SHARE = 0.25
CATCHMENT_SINGLE_SHARE = 0.50
CATCHMENT_SECOND_SHARE = 0.25
CONSISTENCY_THRESHOLD = 0.95
HUMAN_IMPACTED_EDGE = "#f0b82e"

COMPONENTS = {
    "irrigation": {
        "label": "Irrigation",
        "codes": ["pirrww"],
        "color": "#ff9a9b",
    },
    "electricity": {
        "label": "Electricity",
        "codes": ["pelecww"],
        "color": "#8ccc7a",
    },
    "manufacturing": {
        "label": "Manufacturing",
        "codes": ["pmanww"],
        "color": "#c99bff",
    },
    "domestic": {
        "label": "Domestic",
        "codes": ["pdomww"],
        "color": "#6fa6ff",
    },
}

CLASS_COLORS = {
    "irrigation": "#ff9a9b",
    "domestic": "#6fa6ff",
    "electricity": "#8ccc7a",
    "manufacturing": "#c99bff",
}


def read_assignment_json(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    payload = text.split("=", 1)[1].strip().rstrip(";")
    return json.loads(payload)


def read_variable(code: str) -> dict:
    text = (WEB / "data" / f"{code}.js").read_text(encoding="utf-8")
    payload = text.split("=", 2)[2].strip().rstrip(";")
    return json.loads(payload)["windows"][WINDOW]


def grid(code: str, key: str = "recentMean", convert_flux: bool = True) -> np.ndarray:
    values = np.asarray(read_variable(code)[key], dtype=np.float32)
    if convert_flux:
        return values * SECONDS_PER_DAY
    return values


def component_grid(component: dict, key: str = "recentMean") -> np.ndarray:
    arrays = [grid(code, key) for code in component["codes"]]
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", category=RuntimeWarning)
        return np.nansum(np.stack(arrays), axis=0).astype(np.float32)


def robinson(lon_deg, lat_deg):
    robinson_x = np.array([1.0000, 0.9986, 0.9954, 0.9900, 0.9822, 0.9730, 0.9600, 0.9427, 0.9216, 0.8962, 0.8679, 0.8350, 0.7986, 0.7597, 0.7186, 0.6732, 0.6213, 0.5722, 0.5322])
    robinson_y = np.array([0.0000, 0.0620, 0.1240, 0.1860, 0.2480, 0.3100, 0.3720, 0.4340, 0.4958, 0.5571, 0.6176, 0.6769, 0.7346, 0.7903, 0.8435, 0.8936, 0.9394, 0.9761, 1.0000])
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
        ax.plot(x, y, color="#6f695f", lw=0.32, alpha=0.55, zorder=5)


def add_graticule(ax):
    for lat in np.arange(-60, 90, 30):
        lon_line = np.linspace(-180, 180, 721)
        lat_line = np.full_like(lon_line, lat)
        x, y = robinson(lon_line, lat_line)
        ax.plot(x, y, color="#cbc3b5", lw=0.28, alpha=0.5, zorder=1)


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
    ax.plot(x, y, color="#4a4840", lw=0.58, alpha=0.58, zorder=8)
    for lon in np.arange(-120, 180, 60):
        lat_line = np.linspace(-85, 85, 401)
        lon_line = np.full_like(lat_line, lon)
        x, y = robinson(lon_line, lat_line)
        ax.plot(x, y, color="#cbc3b5", lw=0.28, alpha=0.5, zorder=1)


def class_label(class_key: str) -> str:
    if class_key.startswith("mixed_"):
        key = class_key.removeprefix("mixed_")
        return f"{COMPONENTS[key]['label']}-led mixed withdrawals"
    parts = class_key.split("+")
    labels = [COMPONENTS[part]["label"] for part in parts if part in COMPONENTS]
    if len(labels) == 1:
        return f"{labels[0]} dominant"
    return " + ".join(labels)


def class_style(component_keys: list[str]) -> tuple[str, str]:
    if len(component_keys) == 1 and component_keys[0].startswith("mixed_"):
        key = component_keys[0]
        top = key.removeprefix("mixed_")
        return key, mix_colors(COMPONENTS[top]["color"], "#b8b1c8")
    if len(component_keys) >= 1:
        key = "+".join(component_keys)
        if key not in CLASS_COLORS:
            CLASS_COLORS[key] = mix_colors(*(COMPONENTS[item]["color"] for item in component_keys))
        return key, CLASS_COLORS[key]
    raise ValueError(f"Cannot style empty component set: {component_keys}")


def mix_colors(*colors: str) -> str:
    rgb = np.mean([to_rgb(color) for color in colors], axis=0)
    return "#{:02x}{:02x}{:02x}".format(*(np.clip(rgb * 255, 0, 255).astype(int)))


def type_components(type_key: str) -> list[str]:
    if "|" in type_key:
        parts = []
        for item in type_key.split("|"):
            parts.extend(type_components(item))
        return parts
    if type_key.startswith("catchment_mixed_"):
        return [type_key.removeprefix("catchment_mixed_")]
    if type_key.startswith("mixed_"):
        return [type_key.removeprefix("mixed_")]
    return [part for part in type_key.split("+") if part in COMPONENTS]


def canonical_combo_key(type_keys: list[str]) -> str:
    seen = set()
    components = []
    for type_key in type_keys:
        for component in type_components(type_key):
            if component not in seen:
                seen.add(component)
                components.append(component)
    ordered = sorted(components, key=lambda item: list(COMPONENTS).index(item))
    return "+".join(ordered)


def active_area_fraction(active_mask: np.ndarray, total_flat: np.ndarray, cells: np.ndarray, weights: np.ndarray) -> float:
    finite = np.isfinite(total_flat[cells])
    if not finite.any():
        return 0.0
    selected_weights = weights[cells][finite]
    if selected_weights.sum() <= 0:
        return 0.0
    active = active_mask.ravel()[cells][finite]
    return float(selected_weights[active].sum() / selected_weights.sum())


def cell_withdrawal_type_grid(withdrawal_arrays: dict[str, np.ndarray]) -> np.ndarray:
    keys = list(COMPONENTS)
    stack = np.stack([withdrawal_arrays[key] for key in keys])
    stack = np.where(np.isfinite(stack) & (stack >= CELL_WITHDRAWAL_MIN_MM_DAY), stack, 0.0)
    totals = stack.sum(axis=0)
    result = np.full(totals.shape, "none", dtype=object)
    active = totals > 0
    if not active.any():
        return result

    shares = np.divide(stack, totals, out=np.zeros_like(stack, dtype=np.float32), where=totals > 0)
    order = np.argsort(shares, axis=0)[::-1]
    rows, cols = np.where(active)
    for row, col in zip(rows, cols):
        top_idx = int(order[0, row, col])
        second_idx = int(order[1, row, col])
        top_share = float(shares[top_idx, row, col])
        second_share = float(shares[second_idx, row, col])
        top = keys[top_idx]
        second = keys[second_idx]
        if top_share >= CELL_SINGLE_SHARE:
            result[row, col] = top
        elif second_share >= CELL_SECOND_SHARE:
            result[row, col] = canonical_combo_key([top, second])
        else:
            result[row, col] = f"mixed_{top}"
    return result


def type_color(type_key: str) -> str:
    if "|" in type_key:
        return mix_colors(*(type_color(part) for part in type_key.split("|")))
    if type_key.startswith("catchment_mixed_"):
        return type_color(type_key.removeprefix("catchment_"))
    if type_key.startswith("mixed_"):
        top = type_key.removeprefix("mixed_")
        return mix_colors(COMPONENTS[top]["color"], "#b8b1c8")
    parts = type_key.split("+")
    return mix_colors(*(COMPONENTS[part]["color"] for part in parts))


def type_label(type_key: str) -> str:
    if "|" in type_key:
        return " + ".join(type_label(part) for part in type_key.split("|"))
    if type_key.startswith("catchment_mixed_"):
        top = type_key.removeprefix("catchment_mixed_")
        return f"{COMPONENTS[top]['label']}-led mixed catchment"
    if type_key.startswith("mixed_"):
        top = type_key.removeprefix("mixed_")
        return f"{COMPONENTS[top]['label']}-led mixed cells"
    labels = [COMPONENTS[part]["label"] for part in type_key.split("+")]
    if len(labels) == 1:
        return f"{labels[0]} dominant"
    return " + ".join(labels)


def catchment_withdrawal_class(cell_types: np.ndarray, cells: np.ndarray, weights: np.ndarray) -> tuple[str, dict[str, float], float]:
    flat_types = cell_types.ravel()[cells]
    active = flat_types != "none"
    if not active.any():
        return "none", {}, 0.0

    selected_types = flat_types[active]
    selected_weights = weights[cells][active]
    totals: dict[str, float] = {}
    for type_key, weight in zip(selected_types, selected_weights):
        totals[str(type_key)] = totals.get(str(type_key), 0.0) + float(weight)

    active_area = sum(totals.values())
    shares = {key: value / active_area for key, value in totals.items() if active_area > 0}
    ordered = sorted(shares, key=shares.get, reverse=True)
    consistency = float(np.sqrt(sum(value * value for value in shares.values())))

    top = ordered[0]
    second = ordered[1] if len(ordered) > 1 else None
    if shares[top] >= CATCHMENT_SINGLE_SHARE:
        return top, shares, consistency
    if second is not None and shares[second] >= CATCHMENT_SECOND_SHARE:
        return canonical_combo_key([top, second]), shares, consistency
    lead = top.removeprefix("mixed_").split("+", 1)[0]
    return f"catchment_mixed_{lead}", shares, consistency


def polygon_from_ring(ring, *, facecolor, edgecolor, linewidth, alpha=1.0, hatch=None, zorder=3):
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
        hatch=hatch,
        zorder=zorder,
    )


def add_centered_hatch(ax, clip_patch: Polygon):
    points = np.asarray(clip_patch.get_xy(), dtype=float)
    if points.shape[0] < 3:
        return
    finite = np.isfinite(points).all(axis=1)
    points = points[finite]
    if points.shape[0] < 3:
        return

    xmin, ymin = np.min(points, axis=0)
    xmax, ymax = np.max(points, axis=0)
    center = np.mean(points[:-1], axis=0) if np.allclose(points[0], points[-1]) else np.mean(points, axis=0)
    diagonal = float(np.hypot(xmax - xmin, ymax - ymin))
    if diagonal <= 0:
        return

    direction = np.array([1.0, 1.0]) / np.sqrt(2.0)
    normal = np.array([-1.0, 1.0]) / np.sqrt(2.0)
    spacing = 0.025
    steps = int(np.ceil(diagonal / spacing)) + 2
    line_half_length = diagonal * 1.35
    segments = []
    for step in range(-steps, steps + 1):
        midpoint = center + normal * (step * spacing)
        start = midpoint - direction * line_half_length
        end = midpoint + direction * line_half_length
        segments.append([(start[0], start[1]), (end[0], end[1])])
    collection = LineCollection(segments, colors="#4c463f", linewidths=0.26, alpha=0.48, zorder=4)
    collection.set_clip_path(clip_patch)
    ax.add_collection(collection)


def draw_basin(ax, basin: dict, color: str, heterogeneous: bool):
    for ring in basin.get("rings", []):
        patch = polygon_from_ring(ring, facecolor=color, edgecolor="none", linewidth=0.0, alpha=0.92, zorder=3)
        if patch is not None:
            ax.add_patch(patch)
        if heterogeneous and patch is not None:
            add_centered_hatch(ax, patch)
        boundary = polygon_from_ring(ring, facecolor="none", edgecolor="#f7f3ea", linewidth=0.22, alpha=0.96, zorder=7)
        if boundary is not None:
            ax.add_patch(boundary)


def make_figure():
    mpl.rcParams.update({
        "font.family": "DejaVu Sans",
        "hatch.linewidth": 0.35,
        "savefig.transparent": False,
    })
    CHARTS.mkdir(parents=True, exist_ok=True)
    REPORTS.mkdir(parents=True, exist_ok=True)

    basins = read_assignment_json(BASIN_DATA)["basins"]
    manifest = read_assignment_json(WEB / "analysis-data.js")
    lat = np.asarray(manifest["grid"]["lat"], dtype=float)
    weights = np.repeat(np.cos(np.deg2rad(lat))[:, None], 720, axis=1).ravel()

    withdrawal_arrays = {key: component_grid(component, "recentMean") for key, component in COMPONENTS.items()}
    total = np.nansum(np.stack([withdrawal_arrays[key] for key in COMPONENTS]), axis=0).astype(np.float32)
    total_flat = total.ravel()
    cell_types = cell_withdrawal_type_grid(withdrawal_arrays)
    active_mask = cell_types != "none"

    records = []
    class_counts: dict[str, int] = {}
    consistency_values = []
    fig, ax = plt.subplots(figsize=(13.2, 7.9), dpi=520)
    fig.patch.set_facecolor("#f8f6f2")
    ax.set_facecolor("#f4f1eb")
    add_graticule(ax)

    heterogeneous_count = 0
    coherent_count = 0
    for basin in basins:
        cells = np.asarray(basin["cells"], dtype=np.int64)
        active_fraction = active_area_fraction(active_mask, total_flat, cells, weights)
        if active_fraction < CATCHMENT_ACTIVE_AREA_MIN:
            continue
        class_key, shares, consistency = catchment_withdrawal_class(cell_types, cells, weights)
        if class_key == "none":
            continue
        heterogeneous = consistency < CONSISTENCY_THRESHOLD
        consistency_values.append(consistency)
        if heterogeneous:
            heterogeneous_count += 1
        else:
            coherent_count += 1
        draw_basin(ax, basin, type_color(class_key), heterogeneous)
        class_counts[class_key] = class_counts.get(class_key, 0) + 1
        records.append({
            "id": basin["id"],
            "name": basin["name"],
            "region": basin["region"],
            "area_km2": basin["areaKm2"],
            "cell_withdrawal_min_mm_day": CELL_WITHDRAWAL_MIN_MM_DAY,
            "active_area_fraction": active_fraction,
            "composition_structure": "heterogeneous" if heterogeneous else "coherent",
            "class": class_key,
            "label": type_label(class_key),
            "consistency_index": consistency,
            "cell_type_shares": "; ".join(f"{key}:{value:.4f}" for key, value in sorted(shares.items(), key=lambda item: item[0])),
        })

    add_basemap(ax)
    add_projection_frame(ax)
    ax.set_aspect("equal")
    ax.set_xlim(-2.72, 2.72)
    ax.set_ylim(-1.42, 1.42)
    ax.set_axis_off()

    handles = [
        Patch(facecolor=type_color(key), edgecolor="none", label=f"{type_label(key)} ({count})")
        for key, count in sorted(class_counts.items(), key=lambda item: (-item[1], item[0]))
    ]
    handles.append(Patch(
        facecolor="none",
        edgecolor="#4c463f",
        hatch="////////",
        linewidth=0.0,
        label=f"Spatially heterogeneous catchment ({heterogeneous_count})",
    ))
    legend = ax.legend(
        handles=handles,
        loc="upper center",
        bbox_to_anchor=(0.5, -0.035),
        frameon=True,
        framealpha=0.92,
        facecolor="#f8f6f2",
        edgecolor="#d8d0c3",
        fontsize=6.0,
        ncol=3,
        handlelength=1.7,
        columnspacing=0.85,
    )
    legend.get_frame().set_linewidth(0.45)

    output = CHARTS / "fig01_human_water_use_catchment_classification.png"
    fig.savefig(output, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)

    csv_path = REPORTS / "human_water_use_catchment_classification.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        fieldnames = [
            "id",
            "name",
            "region",
            "area_km2",
            "cell_withdrawal_min_mm_day",
            "active_area_fraction",
            "composition_structure",
            "class",
            "label",
            "consistency_index",
            "cell_type_shares",
        ]
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)

    report_path = REPORTS / "human_water_use_catchment_classification_summary.md"
    consistency = np.asarray(consistency_values, dtype=float)
    if consistency.size:
        consistency_line = (
            f"- Consistency-index distribution among affected catchments: "
            f"P10={np.percentile(consistency, 10):.3f}, P25={np.percentile(consistency, 25):.3f}, "
            f"median={np.percentile(consistency, 50):.3f}, P75={np.percentile(consistency, 75):.3f}, "
            f"P90={np.percentile(consistency, 90):.3f}."
        )
    else:
        consistency_line = "- Consistency-index distribution among affected catchments: no selected catchments."
    lines = [
        "# Human Water-Use Catchment Classification",
        "",
        f"- Active cell rule: a grid cell is active when at least one of {', '.join(HUMAN_WITHDRAWAL_CODES)} has recent 20-year mean withdrawal >= {CELL_WITHDRAWAL_MIN_MM_DAY:.2f} mm/day.",
        f"- Affected catchment rule: active-cell area fraction >= {CATCHMENT_ACTIVE_AREA_MIN:.0%}.",
        f"- Cell-level class rule: after values below {CELL_WITHDRAWAL_MIN_MM_DAY:.2f} mm/day are set to zero, the top withdrawal type is single-dominant if its share is >= {CELL_SINGLE_SHARE:.0%}; otherwise the top two types are combined when the second type share is >= {CELL_SECOND_SHARE:.0%}; remaining cells are recorded as top-led mixed.",
        "- Catchment consistency index: sqrt(sum(p_k^2)), where p_k is the active-cell area share of cell withdrawal type k.",
        f"- Hatching rule: catchments with consistency index < {CONSISTENCY_THRESHOLD:.2f} are hatched as heterogeneous withdrawal-composition catchments.",
        f"- Catchment class rule: inactive cells are removed, then the dominant active-cell type is used when its share is >= {CATCHMENT_SINGLE_SHARE:.0%}; otherwise the top two cell types are combined when the second share is >= {CATCHMENT_SECOND_SHARE:.0%}; remaining catchments are recorded as top-led mixed.",
        consistency_line,
        f"- Composition counts: coherent = {coherent_count}, heterogeneous = {heterogeneous_count}.",
        "",
        "| Class | Label | Catchment count |",
        "|---|---|---:|",
    ]
    for key, count in sorted(class_counts.items(), key=lambda item: (-item[1], item[0])):
        lines.append(f"| {key} | {type_label(key)} | {count} |")
    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"Saved: {output}")
    print(f"Saved: {csv_path}")
    print(f"Saved: {report_path}")
    return output


if __name__ == "__main__":
    make_figure()
