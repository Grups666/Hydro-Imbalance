"""
Figure 1: Regional imbalance comparison for major irrigation regions.

The figure compares PIRRWW, AET, and groundwater-storage standardized
anomalies for five irrigation regions. PIRRWW defines the visual focus mask,
but AET and groundwater storage are still drawn over the full regional mesh.
The focus mask is generalized into a small number of regional windows rather
than thresholding individual PIRRWW grid cells.
"""

from __future__ import annotations

import json
import struct
import zipfile
from pathlib import Path

import matplotlib as mpl
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import LinearSegmentedColormap, TwoSlopeNorm
from matplotlib.patches import Ellipse, Patch, PathPatch, Rectangle
from matplotlib.path import Path as MplPath
from matplotlib.ticker import FuncFormatter


ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / "projects" / "web"
CHARTS = ROOT / "paper" / "charts"
BASEMAPS = ROOT / "paper" / "data" / "basemaps" / "natural_earth"
WINDOW = "20"

REGIONS = [
    {
        "title": "South Asia",
        "subtitle": "Indus-Ganges",
        "lat_range": (5, 40),
        "lon_range": (60, 100),
        "focus_rectangles": [
            (67.5, 9.0, 18.5, 24.0),
            (86.8, 21.0, 9.0, 7.6),
        ],
        "focus_ellipses": [],
    },
    {
        "title": "Middle East",
        "subtitle": "Tigris-Euphrates",
        "lat_range": (12, 45),
        "lon_range": (30, 70),
        "focus_ellipses": [
            (43.8, 34.0, 23.0, 10.5, -8.0),
            (62.0, 38.4, 14.0, 8.0, -8.0),
        ],
    },
    {
        "title": "East Asia",
        "subtitle": "North China Plain",
        "lat_range": (15, 55),
        "lon_range": (95, 135),
        "focus_rectangles": [
            (100.8, 36.2, 10.2, 7.8),
            (113.6, 28.5, 14.8, 23.0),
        ],
        "focus_ellipses": [
        ],
    },
    {
        "title": "Europe",
        "subtitle": "Southern and\nEastern Europe",
        "lat_range": (20, 50),
        "lon_range": (-15, 45),
        "focus_ellipses": [
            (15.0, 35.5, 61.0, 14.5, 0.0),
        ],
    },
]

VARIABLES = [
    {"code": "pirrww", "title": "Potential irrigation water withdrawals"},
    {"code": "evap-total", "title": "Actual evapotranspiration"},
    {"code": "groundwstor", "title": "Groundwater storage"},
]

ZSCORE_COLORS = [
    "#1f7888",
    "#63aeb8",
    "#d8e7e4",
    "#fbf7f0",
    "#ead2cf",
    "#c88492",
    "#8f4562",
]

FIG_BG = "#f7f4ee"
AX_BG = "#f2eee6"
LAND = "#e9e2d6"
OCEAN = "#e6ecea"
COAST = "#625d55"
BASIN_EDGE = "#7c6f62"
GRID = "#d8d0c2"
TEXT = "#27231f"
SUBTEXT = "#6b655e"
FOCUS_FILL = "#efc75e"
FOCUS_EDGE = "#1d1718"
NONFOCUS_MASK = "#9f9a91"

SPARSE_ACTIVE_SHARE_THRESHOLD = 0.35
SPARSE_ACTIVITY_FLOOR_PERCENTILE = 60
SPARSE_STD_REFERENCE_PERCENTILE = 75
SPARSE_STD_REFERENCE_RATIO = 0.5


def read_variable(code):
    path = WEB / "data" / f"{code}.js"
    text = path.read_text(encoding="utf-8")
    payload = text.split("=", 2)[2].strip().rstrip(";")
    return json.loads(payload)["windows"][WINDOW]


def as_array(grid):
    return np.asarray(grid, dtype=np.float32)


def percentile(values, q):
    finite = values[np.isfinite(values)]
    return float(np.percentile(finite, q)) if finite.size else 0.0


def compute_sparse_profile(magnitude_grid):
    finite_mag = magnitude_grid[np.isfinite(magnitude_grid)]
    positive_mag = finite_mag[finite_mag > 0]

    if finite_mag.size == 0:
        return {"activeShare": 0.0, "sparseSupport": False, "activityFloor": 0.0, "practicalStdFloor": 0.0}

    active_share = positive_mag.size / finite_mag.size
    sparse_support = active_share < SPARSE_ACTIVE_SHARE_THRESHOLD

    activity_floor = 0.0
    practical_std_floor = 0.0
    if sparse_support and positive_mag.size:
        activity_floor = percentile(positive_mag, SPARSE_ACTIVITY_FLOOR_PERCENTILE)
        practical_std_floor = percentile(positive_mag, SPARSE_STD_REFERENCE_PERCENTILE) * SPARSE_STD_REFERENCE_RATIO

    return {
        "activeShare": active_share,
        "sparseSupport": sparse_support,
        "activityFloor": activity_floor,
        "practicalStdFloor": practical_std_floor,
    }


def compute_adjusted_zscore(z_grid, diff_grid, magnitude_grid, profile):
    adjusted_z = np.full_like(z_grid, np.nan, dtype=np.float32)
    valid = np.isfinite(z_grid) & np.isfinite(diff_grid)

    if profile["activityFloor"] > 0:
        valid &= np.isfinite(magnitude_grid) & (magnitude_grid >= profile["activityFloor"])

    zero_diff = valid & (diff_grid == 0)
    adjusted_z[zero_diff] = 0

    nonzero = valid & (diff_grid != 0)
    inferred_std = np.full_like(z_grid, np.nan, dtype=np.float32)
    raw_nonzero = nonzero & (z_grid != 0)
    inferred_std[raw_nonzero] = np.abs(diff_grid[raw_nonzero] / z_grid[raw_nonzero])
    inferred_std[nonzero & (z_grid == 0)] = np.inf

    denominator = np.maximum(inferred_std, profile["practicalStdFloor"])
    ok = nonzero & np.isfinite(denominator) & (denominator > 0)
    adjusted_z[ok] = diff_grid[ok] / denominator[ok]
    return adjusted_z


def load_zscores():
    var_data = {}
    for variable in VARIABLES:
        data = read_variable(variable["code"])
        raw_z = as_array(data["zScore"])
        diff = as_array(data["difference"])
        magnitude = as_array(data.get("magnitude") or data.get("recentMean") or data.get("baselineMean"))
        profile = compute_sparse_profile(magnitude)
        var_data[variable["code"]] = compute_adjusted_zscore(raw_z, diff, magnitude, profile)
    return var_data


def read_assignment_json(path, marker="="):
    text = path.read_text(encoding="utf-8")
    payload = text.split(marker, 1)[1].strip().rstrip(";")
    return json.loads(payload)


def get_regional_data(z_grid, lat_range, lon_range):
    lats = np.linspace(89.75, -89.75, 360)
    lons = np.linspace(-179.75, 179.75, 720)
    lat_min, lat_max = lat_range
    lon_min, lon_max = lon_range

    row_start = np.searchsorted(-lats, -lat_max)
    row_end = np.searchsorted(-lats, -lat_min)
    col_start = np.searchsorted(lons, lon_min)
    col_end = np.searchsorted(lons, lon_max)

    return z_grid[row_start:row_end, col_start:col_end], lats[row_start:row_end], lons[col_start:col_end]


def get_regional_focus_mask(region):
    """Generalized PIRRWW-reference windows for comparative focus.

    These ellipses are intentionally fewer and smoother than a per-cell
    threshold, so the figure reads as a regional comparison instead of a
    scattered significance mask.
    """
    _, regional_lats, regional_lons = get_regional_data(
        np.zeros((360, 720), dtype=np.float32),
        region["lat_range"],
        region["lon_range"],
    )
    lon_grid, lat_grid = np.meshgrid(regional_lons, regional_lats)
    focus = np.zeros_like(lon_grid, dtype=bool)

    for center_lon, center_lat, width, height, angle_deg in region["focus_ellipses"]:
        angle = np.deg2rad(angle_deg)
        x = lon_grid - center_lon
        y = lat_grid - center_lat
        x_rot = x * np.cos(angle) + y * np.sin(angle)
        y_rot = -x * np.sin(angle) + y * np.cos(angle)
        focus |= (x_rot / (width / 2.0)) ** 2 + (y_rot / (height / 2.0)) ** 2 <= 1.0

    for lon_min, lat_min, width, height in region.get("focus_rectangles", []):
        focus |= (
            (lon_grid >= lon_min)
            & (lon_grid <= lon_min + width)
            & (lat_grid >= lat_min)
            & (lat_grid <= lat_min + height)
        )

    return focus


def rectangle_vertices(lon_min, lat_min, width, height, clockwise=False):
    lon_max = lon_min + width
    lat_max = lat_min + height
    vertices = [
        (lon_min, lat_min),
        (lon_max, lat_min),
        (lon_max, lat_max),
        (lon_min, lat_max),
        (lon_min, lat_min),
    ]
    return vertices[::-1] if clockwise else vertices


def ellipse_vertices(center_lon, center_lat, width, height, angle_deg, clockwise=False, points=160):
    theta = np.linspace(0, 2 * np.pi, points, endpoint=False)
    if clockwise:
        theta = theta[::-1]
    angle = np.deg2rad(angle_deg)
    x = (width / 2.0) * np.cos(theta)
    y = (height / 2.0) * np.sin(theta)
    x_rot = x * np.cos(angle) - y * np.sin(angle)
    y_rot = x * np.sin(angle) + y * np.cos(angle)
    vertices = list(zip(center_lon + x_rot, center_lat + y_rot))
    vertices.append(vertices[0])
    return vertices


def add_path_part(vertices, path_vertices, path_codes):
    path_vertices.extend(vertices)
    path_codes.extend([MplPath.MOVETO] + [MplPath.LINETO] * (len(vertices) - 2) + [MplPath.CLOSEPOLY])


def draw_focus_overlay(ax, region):
    lat_range = region["lat_range"]
    lon_range = region["lon_range"]
    path_vertices = []
    path_codes = []

    add_path_part(
        rectangle_vertices(lon_range[0], lat_range[0], lon_range[1] - lon_range[0], lat_range[1] - lat_range[0]),
        path_vertices,
        path_codes,
    )

    for lon_min, lat_min, width, height in region.get("focus_rectangles", []):
        add_path_part(rectangle_vertices(lon_min, lat_min, width, height, clockwise=True), path_vertices, path_codes)
        ax.add_patch(
            Rectangle(
                (lon_min, lat_min),
                width,
                height,
                fill=False,
                edgecolor=FOCUS_EDGE,
                linewidth=0.30,
                alpha=0.36,
                zorder=3.2,
            )
        )

    for center_lon, center_lat, width, height, angle_deg in region.get("focus_ellipses", []):
        add_path_part(
            ellipse_vertices(center_lon, center_lat, width, height, angle_deg, clockwise=True),
            path_vertices,
            path_codes,
        )
        ax.add_patch(
            Ellipse(
                (center_lon, center_lat),
                width,
                height,
                angle=angle_deg,
                fill=False,
                edgecolor=FOCUS_EDGE,
                linewidth=0.30,
                alpha=0.36,
                zorder=3.2,
            )
        )

    overlay = PathPatch(
        MplPath(path_vertices, path_codes),
        facecolor=NONFOCUS_MASK,
        edgecolor="none",
        alpha=0.56,
        zorder=2.8,
    )
    ax.add_patch(overlay)


def read_shp_parts(zip_path):
    with zipfile.ZipFile(zip_path) as zf:
        shp_name = next(name for name in zf.namelist() if name.lower().endswith(".shp"))
        data = zf.read(shp_name)

    parts_out = []
    offset = 100
    while offset + 8 < len(data):
        content_words = struct.unpack(">i", data[offset + 4:offset + 8])[0]
        content_bytes = content_words * 2
        offset += 8
        record = data[offset:offset + content_bytes]
        offset += content_bytes
        if len(record) < 44:
            continue
        shape_type = struct.unpack("<i", record[:4])[0]
        if shape_type not in (5, 15, 25):
            continue
        num_parts = struct.unpack("<i", record[36:40])[0]
        num_points = struct.unpack("<i", record[40:44])[0]
        parts = list(struct.unpack(f"<{num_parts}i", record[44:44 + 4 * num_parts]))
        point_start = 44 + 4 * num_parts
        points = np.frombuffer(record[point_start:point_start + 16 * num_points], dtype="<f8").reshape(num_points, 2)
        parts.append(num_points)
        for start, end in zip(parts[:-1], parts[1:]):
            if end - start >= 3:
                parts_out.append(points[start:end].copy())
    return parts_out


BASEMAP_CACHE = {}
BASIN_CACHE = None


def basemap_parts(name):
    if name not in BASEMAP_CACHE:
        BASEMAP_CACHE[name] = read_shp_parts(BASEMAPS / name)
    return BASEMAP_CACHE[name]


def basin_data():
    global BASIN_CACHE
    if BASIN_CACHE is None:
        BASIN_CACHE = read_assignment_json(ROOT / "projects" / "basin-data.js")
    return BASIN_CACHE


def iter_visible_land_parts(lat_range, lon_range):
    lat_min, lat_max = lat_range
    lon_min, lon_max = lon_range
    for points in basemap_parts("ne_50m_land.zip"):
        lon_values = points[:, 0]
        lat_values = points[:, 1]
        if lon_values.max() < lon_min or lon_values.min() > lon_max:
            continue
        if lat_values.max() < lat_min or lat_values.min() > lat_max:
            continue
        yield lon_values, lat_values


def iter_visible_ocean_parts(lat_range, lon_range):
    lat_min, lat_max = lat_range
    lon_min, lon_max = lon_range
    for points in basemap_parts("ne_50m_ocean.zip"):
        lon_values = points[:, 0]
        lat_values = points[:, 1]
        if np.nanmax(lon_values) - np.nanmin(lon_values) > 300:
            continue
        if lon_values.max() < lon_min or lon_values.min() > lon_max:
            continue
        if lat_values.max() < lat_min or lat_values.min() > lat_max:
            continue
        yield lon_values, lat_values


def iter_visible_basin_rings(lat_range, lon_range):
    lat_min, lat_max = lat_range
    lon_min, lon_max = lon_range
    for basin in basin_data()["basins"]:
        bbox = basin.get("bbox")
        if not bbox or bbox[2] < lon_min or bbox[0] > lon_max or bbox[3] < lat_min or bbox[1] > lat_max:
            continue
        for ring in basin.get("rings", []):
            if len(ring) < 3:
                continue
            arr = np.asarray(ring, dtype=np.float32)
            yield arr[:, 0], arr[:, 1]


def draw_ocean_context(ax, lat_range, lon_range):
    for lon_values, lat_values in iter_visible_ocean_parts(lat_range, lon_range):
        ax.fill(lon_values, lat_values, facecolor=OCEAN, edgecolor="none", alpha=0.50, zorder=0.05, clip_on=True)


def draw_land_context(ax, lat_range, lon_range):
    for lon_values, lat_values in iter_visible_land_parts(lat_range, lon_range):
        ax.fill(lon_values, lat_values, facecolor=LAND, edgecolor="none", alpha=0.82, zorder=0.2, clip_on=True)


def draw_coastlines(ax, lat_range, lon_range):
    for lon_values, lat_values in iter_visible_land_parts(lat_range, lon_range):
        ax.plot(lon_values, lat_values, color=COAST, linewidth=0.26, alpha=0.46, zorder=4, clip_on=True)


def draw_basin_outlines(ax, lat_range, lon_range):
    for lon_values, lat_values in iter_visible_basin_rings(lat_range, lon_range):
        ax.plot(lon_values, lat_values, color=BASIN_EDGE, linewidth=0.18, alpha=0.22, zorder=3.7, clip_on=True)


def cmap_from(colors, name):
    cmap = LinearSegmentedColormap.from_list(name, colors, N=256)
    cmap.set_bad((0, 0, 0, 0))
    return cmap


def lat_formatter(x, _pos):
    return f"{abs(x):.0f}{'N' if x >= 0 else 'S'}"


def lon_formatter(x, _pos):
    return f"{abs(x):.0f}{'E' if x >= 0 else 'W'}"


def draw_regional_map(ax, z_grid, region, focus_mask=None, is_pirrww=False):
    lat_range = region["lat_range"]
    lon_range = region["lon_range"]
    regional_z, regional_lats, regional_lons = get_regional_data(z_grid, lat_range, lon_range)
    lon_edges = np.linspace(regional_lons[0] - 0.25, regional_lons[-1] + 0.25, regional_lons.size + 1)
    lat_edges = np.linspace(regional_lats[0] + 0.25, regional_lats[-1] - 0.25, regional_lats.size + 1)

    ax.set_facecolor(AX_BG)
    draw_ocean_context(ax, lat_range, lon_range)
    draw_land_context(ax, lat_range, lon_range)
    ax.grid(True, color=GRID, linewidth=0.22, alpha=0.22, zorder=0.5)

    norm = TwoSlopeNorm(vmin=-3, vcenter=0, vmax=3)
    mesh = ax.pcolormesh(
        lon_edges,
        lat_edges,
        np.clip(regional_z, -3, 3),
        cmap=cmap_from(ZSCORE_COLORS, "regional_zscore"),
        norm=norm,
        shading="auto",
        rasterized=True,
        alpha=0.88 if is_pirrww else 0.84,
        zorder=2,
    )

    if focus_mask is not None and np.any(focus_mask):
        draw_focus_overlay(ax, region)

    draw_coastlines(ax, lat_range, lon_range)
    draw_basin_outlines(ax, lat_range, lon_range)
    ax.set_xlim(lon_range)
    ax.set_ylim(lat_range)
    ax.set_aspect("equal", adjustable="box", anchor="W")
    ax.set_anchor("W")

    for spine in ax.spines.values():
        spine.set_visible(True)
        spine.set_color("#454039")
        spine.set_linewidth(0.36)

    ax.tick_params(
        axis="both",
        which="both",
        bottom=True,
        left=True,
        labelsize=5.7,
        length=2.0,
        width=0.36,
        colors="#514c45",
        pad=1.0,
    )
    ax.yaxis.set_major_formatter(FuncFormatter(lat_formatter))
    ax.xaxis.set_major_formatter(FuncFormatter(lon_formatter))
    return mesh


def make_figure_5():
    mpl.rcParams.update({
        "font.family": "Arial",
        "axes.linewidth": 0.36,
        "savefig.transparent": False,
        "xtick.direction": "out",
        "ytick.direction": "out",
    })

    CHARTS.mkdir(parents=True, exist_ok=True)
    var_data = load_zscores()
    fig = plt.figure(figsize=(8.7, 11.2), dpi=600)
    fig.patch.set_facecolor(FIG_BG)

    grid = fig.add_gridspec(
        nrows=len(REGIONS),
        ncols=len(VARIABLES) + 1,
        width_ratios=[0.72, 1, 1, 1],
        hspace=0.27,
        wspace=0.095,
        left=0.035,
        right=0.985,
        top=0.92,
        bottom=0.105,
    )

    last_mesh = None
    for row_idx, region in enumerate(REGIONS):
        label_ax = fig.add_subplot(grid[row_idx, 0])
        label_ax.set_axis_off()
        label_ax.set_facecolor(FIG_BG)
        label_ax.text(0.78, 0.60, region["title"], fontsize=8.7, fontweight="bold", ha="right", va="center", color=TEXT)
        label_ax.text(
            0.78,
            0.36,
            region["subtitle"],
            fontsize=6.05,
            ha="right",
            va="center",
            color=SUBTEXT,
            linespacing=1.0,
        )

        focus_mask = get_regional_focus_mask(region)

        for col_idx, variable in enumerate(VARIABLES):
            ax = fig.add_subplot(grid[row_idx, col_idx + 1])
            last_mesh = draw_regional_map(
                ax,
                var_data[variable["code"]],
                region,
                focus_mask=focus_mask,
                is_pirrww=variable["code"] == "pirrww",
            )

            ax.tick_params(labelleft=True, labelbottom=True)

            if row_idx == 0:
                ax.set_title(
                    variable["title"],
                    fontsize=8.35,
                    fontweight="bold",
                    color=TEXT,
                    pad=8,
                )

    if last_mesh is not None:
        cbar_ax = fig.add_axes([0.295, 0.045, 0.36, 0.012])
        cbar = fig.colorbar(last_mesh, cax=cbar_ax, orientation="horizontal")
        cbar.set_label("Standardized anomaly (z-score)", fontsize=7.4, labelpad=2.2, color=TEXT)
        cbar.ax.tick_params(labelsize=6.8, length=2.2, width=0.36, colors="#514c45")
        cbar.outline.set_linewidth(0.36)
        cbar.set_ticks([-3, -2, -1, 0, 1, 2, 3])

    fig.legend(
        handles=[
            Patch(
                facecolor=NONFOCUS_MASK,
                edgecolor=FOCUS_EDGE,
                linewidth=0.42,
                alpha=0.72,
                label="Grey overlay: outside PIRRWW-reference focus windows",
            )
        ],
        loc="lower right",
        bbox_to_anchor=(0.985, 0.062),
        frameon=False,
        fontsize=6.9,
        handlelength=1.30,
    )

    output_path = CHARTS / "figS03_regional_imbalance.png"
    fig.savefig(output_path, bbox_inches="tight", facecolor=fig.get_facecolor(), dpi=600)
    plt.close(fig)
    print(f"Saved: {output_path}")
    return output_path


if __name__ == "__main__":
    make_figure_5()
