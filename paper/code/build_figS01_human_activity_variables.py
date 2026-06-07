"""
Figure: human water-use variables used in activity-region diagnostics.

The layout mirrors Figure S1: each row is a diagnostic input group, with the
left column showing recent-window standardized anomaly and the right column
showing the long-term baseline mean context.
"""

from __future__ import annotations

import json
import struct
import warnings
import zipfile
from pathlib import Path

import matplotlib as mpl
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import LinearSegmentedColormap, Normalize, TwoSlopeNorm


ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / "projects" / "web"
CHARTS = ROOT / "paper" / "charts"
BASEMAPS = ROOT / "paper" / "data" / "basemaps" / "natural_earth"
WINDOW = "20"
ACTIVITY_PERCENTILE = 75.0
SPARSE_ACTIVE_SHARE_THRESHOLD = 0.35
SPARSE_ACTIVITY_FLOOR_PERCENTILE = 60
SPARSE_STD_REFERENCE_PERCENTILE = 75
SPARSE_STD_REFERENCE_RATIO = 0.5
VARIABLE_LABEL_STYLE = {
    "fontsize": 9.6,
    "fontstyle": "italic",
    "color": "#2a2825",
}
GROUP_LABEL_STYLE = {
    "fontsize": 11.8,
    "fontweight": "bold",
    "fontstyle": "normal",
    "color": "#27231f",
}

ACTIVITY_GROUPS = [
    {
        "name": "Irrigation",
        "codes": ["pirrww"],
        "detail": "Potential Irrigation\nWater Withdrawals",
        "colors": ["#fff0f0", "#ffd6d7", "#ffbabb", "#ff9a9b"],
        "mean_vmax": 1.0,
    },
    {
        "name": "Electricity",
        "codes": ["pelecww"],
        "detail": "Potential Electricity\nWater Withdrawal",
        "colors": ["#eef8eb", "#d8efd2", "#bde1b3", "#8ccc7a"],
        "mean_vmax": 0.4,
    },
    {
        "name": "Manufacturing",
        "codes": ["pmanww"],
        "detail": "Potential Manufacturing\nWater Withdrawal",
        "colors": ["#f6efff", "#eadbff", "#dac0ff", "#c99bff"],
        "mean_vmax": 0.3,
    },
    {
        "name": "Domestic",
        "codes": ["pdomww"],
        "detail": "Potential Domestic\nWater Withdrawals",
        "colors": ["#eef4ff", "#d7e6ff", "#aecaff", "#6fa6ff"],
        "mean_vmax": 0.2,
    },
]

ZSCORE_COLORS = ["#2a8a9a", "#5aa8b8", "#a8d0d8", "#f8f8f8", "#f8d0d0", "#d8a0a8", "#a86080"]


def read_variable(code: str) -> dict:
    path = WEB / "data" / f"{code}.js"
    text = path.read_text(encoding="utf-8")
    payload = text.split("=", 2)[2].strip().rstrip(";")
    return json.loads(payload)["windows"][WINDOW]


def as_array(grid):
    return np.asarray(grid, dtype=np.float32)


def nanmax_stack(arrays: list[np.ndarray]) -> np.ndarray:
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", category=RuntimeWarning)
        return np.nanmax(np.stack(arrays), axis=0)


def percentile(values: np.ndarray, q: float) -> float:
    finite = values[np.isfinite(values)]
    return float(np.percentile(finite, q)) if finite.size else 0.0


def support_profile(magnitude_grid: np.ndarray) -> dict[str, float | bool]:
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


def adjusted_zscore(result: dict) -> np.ndarray:
    raw_z = as_array(result["zScore"])
    diff = as_array(result["difference"])
    magnitude = as_array(result.get("magnitude") or result.get("recentMean") or result.get("baselineMean"))
    profile = support_profile(magnitude)

    adjusted = np.full_like(raw_z, np.nan, dtype=np.float32)
    valid = np.isfinite(raw_z) & np.isfinite(diff)
    if profile["activityFloor"] > 0:
        valid &= np.isfinite(magnitude) & (magnitude >= profile["activityFloor"])

    zero_diff = valid & (diff == 0)
    adjusted[zero_diff] = 0

    nonzero = valid & (diff != 0)
    inferred_std = np.full_like(raw_z, np.nan, dtype=np.float32)
    raw_nonzero = nonzero & (raw_z != 0)
    inferred_std[raw_nonzero] = np.abs(diff[raw_nonzero] / raw_z[raw_nonzero])
    inferred_std[nonzero & (raw_z == 0)] = np.inf
    denominator = np.maximum(inferred_std, float(profile["practicalStdFloor"]))
    ok = nonzero & np.isfinite(denominator) & (denominator > 0)
    adjusted[ok] = diff[ok] / denominator[ok]
    return adjusted


def group_magnitude(codes: list[str], key: str) -> np.ndarray:
    arrays = [np.abs(as_array(read_variable(code)[key])) * 86400.0 for code in codes]
    return nanmax_stack(arrays)


def group_signed_zscore(codes: list[str]) -> np.ndarray:
    best_abs = np.full((360, 720), np.nan, dtype=np.float32)
    best_z = np.full((360, 720), np.nan, dtype=np.float32)
    for code in codes:
        z_grid = adjusted_zscore(read_variable(code))
        z_abs = np.abs(z_grid)
        update = np.isfinite(z_abs) & (~np.isfinite(best_abs) | (z_abs > best_abs))
        best_abs[update] = z_abs[update]
        best_z[update] = z_grid[update]
    return best_z


ROBINSON_X = np.array([1.0000, 0.9986, 0.9954, 0.9900, 0.9822, 0.9730, 0.9600, 0.9427, 0.9216, 0.8962, 0.8679, 0.8350, 0.7986, 0.7597, 0.7186, 0.6732, 0.6213, 0.5722, 0.5322])
ROBINSON_Y = np.array([0.0000, 0.0620, 0.1240, 0.1860, 0.2480, 0.3100, 0.3720, 0.4340, 0.4958, 0.5571, 0.6176, 0.6769, 0.7346, 0.7903, 0.8435, 0.8936, 0.9394, 0.9761, 1.0000])


def robinson(lon_deg, lat_deg):
    abs_lat = np.clip(np.abs(lat_deg), 0, 90)
    xp = np.interp(abs_lat, np.arange(0, 91, 5), ROBINSON_X)
    yp = np.interp(abs_lat, np.arange(0, 91, 5), ROBINSON_Y)
    x = 0.8487 * xp * np.radians(lon_deg)
    y = 1.3523 * yp * np.sign(lat_deg)
    return x, y


def projected_edges():
    lon_edges = np.linspace(-180, 180, 721)
    lat_edges = np.linspace(90, -90, 361)
    lon2, lat2 = np.meshgrid(lon_edges, lat_edges)
    return robinson(lon2, lat2)


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


def basemap_parts(name):
    if name not in BASEMAP_CACHE:
        BASEMAP_CACHE[name] = read_shp_parts(BASEMAPS / name)
    return BASEMAP_CACHE[name]


def add_basemap(ax):
    def draw_line_parts(points, *, linewidth, alpha):
        lon_values = points[:, 0]
        lat_values = points[:, 1]
        breaks = np.where(np.abs(np.diff(lon_values)) > 180)[0] + 1
        for segment in np.split(np.arange(points.shape[0]), breaks):
            if segment.size < 2:
                continue
            x, y = robinson(lon_values[segment], lat_values[segment])
            ax.plot(x, y, color="#575148", linewidth=linewidth, alpha=alpha, zorder=4)

    for points in basemap_parts("ne_50m_land.zip"):
        draw_line_parts(points, linewidth=0.34, alpha=0.62)
    for points in basemap_parts("ne_50m_antarctic_ice_shelves_polys.zip"):
        draw_line_parts(points, linewidth=0.30, alpha=0.55)


def add_graticule(ax):
    for lat in np.arange(-60, 90, 30):
        lon_line = np.linspace(-180, 180, 721)
        lat_line = np.full_like(lon_line, lat)
        x, y = robinson(lon_line, lat_line)
        ax.plot(x, y, color="#c8c0b3", lw=0.30, alpha=0.48, zorder=1)


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
    ax.plot(x, y, color="#4a4840", lw=0.58, alpha=0.55, zorder=8)
    for lon in np.arange(-120, 180, 60):
        lat_line = np.linspace(-85, 85, 401)
        lon_line = np.full_like(lat_line, lon)
        x, y = robinson(lon_line, lat_line)
        ax.plot(x, y, color="#c8c0b3", lw=0.30, alpha=0.48, zorder=1)


def style_axis(ax):
    ax.set_aspect("equal")
    ax.set_xlim(-2.72, 2.72)
    ax.set_ylim(-1.42, 1.42)
    ax.set_axis_off()
    ax.set_facecolor("#f4f1eb")
    add_graticule(ax)
    add_projection_frame(ax)


def cmap_from(colors, name):
    cmap = LinearSegmentedColormap.from_list(name, colors, N=256)
    cmap.set_bad((0, 0, 0, 0))
    return cmap


def mean_cmap_from(colors, name):
    cmap = LinearSegmentedColormap.from_list(name, ["#ffffff", *colors], N=256)
    cmap.set_bad((0, 0, 0, 0))
    return cmap


def draw_zscore(ax, z_grid):
    x_edges, y_edges = projected_edges()
    mesh = ax.pcolormesh(
        x_edges,
        y_edges,
        np.clip(z_grid, -3, 3),
        cmap=cmap_from(ZSCORE_COLORS, "zscore"),
        norm=TwoSlopeNorm(vmin=-3, vcenter=0, vmax=3),
        shading="auto",
        rasterized=True,
        zorder=2,
    )
    style_axis(ax)
    add_basemap(ax)
    return mesh


def draw_mean(ax, mean_grid, colors, vmax):
    x_edges, y_edges = projected_edges()
    display = np.where(np.isfinite(mean_grid), mean_grid, np.nan).astype(np.float32)
    mesh = ax.pcolormesh(
        x_edges,
        y_edges,
        display,
        cmap=mean_cmap_from(colors, "mean"),
        norm=Normalize(vmin=0.0, vmax=vmax, clip=False),
        shading="auto",
        rasterized=True,
        zorder=2,
    )
    style_axis(ax)
    add_basemap(ax)
    return mesh


def make_figure():
    mpl.rcParams.update({"font.family": "DejaVu Sans", "savefig.transparent": False})
    CHARTS.mkdir(parents=True, exist_ok=True)

    fig = plt.figure(figsize=(15.0, 11.3), dpi=450)
    fig.patch.set_facecolor("#f8f6f2")
    gs = fig.add_gridspec(
        nrows=len(ACTIVITY_GROUPS) + 1,
        ncols=2,
        height_ratios=[0.08] + [1] * len(ACTIVITY_GROUPS),
        hspace=0.09,
        wspace=0.045,
        left=0.185,
        right=0.955,
        top=0.96,
        bottom=0.035,
    )

    title_ax = fig.add_subplot(gs[0, :])
    title_ax.set_axis_off()
    for row, group in enumerate(ACTIVITY_GROUPS, start=1):
        ax_left = fig.add_subplot(gs[row, 0])
        ax_right = fig.add_subplot(gs[row, 1])
        if row == 1:
            ax_left.text(
                0.5,
                1.11,
                "Recent 20-Year Mean",
                transform=ax_left.transAxes,
                ha="center",
                va="bottom",
                fontsize=13.2,
                fontweight="bold",
                color="#27231f",
            )
            ax_right.text(
                0.5,
                1.11,
                "Imbalance Evaluation",
                transform=ax_right.transAxes,
                ha="center",
                va="bottom",
                fontsize=13.2,
                fontweight="bold",
                color="#27231f",
            )

        z_grid = group_signed_zscore(group["codes"])
        recent_mean = group_magnitude(group["codes"], "recentMean")
        mesh_left = draw_mean(ax_left, recent_mean, group["colors"], group["mean_vmax"])
        mesh_right = draw_zscore(ax_right, z_grid)

        ax_left.text(
            -0.49,
            0.5,
            group["detail"],
            transform=ax_left.transAxes,
            ha="left",
            va="center",
            linespacing=1.15,
            **VARIABLE_LABEL_STYLE,
        )

        cbar_left = fig.colorbar(mesh_left, ax=ax_left, orientation="vertical", fraction=0.035, pad=0.018, aspect=18, shrink=0.82, extend="max")
        cbar_left.set_label("mm day$^{-1}$", fontsize=8.0, labelpad=3)
        cbar_left.ax.tick_params(labelsize=7.1, length=2)
        cbar_left.outline.set_linewidth(0.3)
        tick_step = 0.2 if group["mean_vmax"] > 0.6 else 0.1
        cbar_left.set_ticks(np.arange(0.0, group["mean_vmax"] + tick_step / 2, tick_step))
        cbar_left.ax.yaxis.set_major_formatter(mpl.ticker.FormatStrFormatter("%.1f"))

        cbar_right = fig.colorbar(mesh_right, ax=ax_right, orientation="vertical", fraction=0.035, pad=0.018, aspect=18, shrink=0.82)
        cbar_right.set_label("z-score", fontsize=8.0, labelpad=3)
        cbar_right.ax.tick_params(labelsize=7.1, length=2)
        cbar_right.outline.set_linewidth(0.3)
        cbar_right.set_ticks([-3, -2, -1, 0, 1, 2, 3])

    output = CHARTS / "figS01_human_activity_variables.png"
    fig.savefig(output, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    print(f"Saved: {output}")
    return output


if __name__ == "__main__":
    make_figure()
