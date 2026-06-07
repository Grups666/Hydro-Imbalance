"""
Figure S1: Variable-level imbalance evidence and multi-year mean maps

Shows z-score imbalance (left column) and multi-year mean (right column)
for representative WaterGAP2-2e variables available through 2019.

Designed for Nature submission with understated luxury aesthetics.
"""

import json
import struct
import zipfile
from pathlib import Path

import matplotlib as mpl
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import LinearSegmentedColormap, Normalize, TwoSlopeNorm, LogNorm


ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / "projects" / "web"
CHARTS = ROOT / "paper" / "charts"
BASEMAPS = ROOT / "paper" / "data" / "basemaps" / "natural_earth"
WINDOW = "20"
SECONDS_PER_DAY = 86400.0
VARIABLE_LABEL_STYLE = {
    "fontsize": 9.6,
    "fontstyle": "italic",
    "color": "#2a2825",
}

# Variables to display with their display names and units
# Reordered sequence: AET, groundwater, soil moisture, snow variables
VARIABLES = [
    {"code": "evap-total", "name": "Actual Evapotranspiration", "unit": "kg m$^{-2}$ s$^{-1}$"},
    {"code": "groundwstor", "name": "Groundwater Storage", "unit": "kg m$^{-2}$"},
    {"code": "soilmoist", "name": "Soil Moisture Content", "unit": "kg m$^{-2}$"},
    {"code": "swe", "name": "Snow Water Storage", "unit": "kg m$^{-2}$"},
    {"code": "snm", "name": "Snow Melt", "unit": "mm day$^{-1}$", "mean_scale": SECONDS_PER_DAY},
]

# Color schemes - unified cyan to pink diverging for z-score, distinct for mean
# Z-score: cyan (negative) -> white (neutral) -> pink (positive) for all variables
ZSCORE_COLORS = ["#2a8a9a", "#5aa8b8", "#a8d0d8", "#f8f8f8", "#f8d0d0", "#d8a0a8", "#a86080"]

# Mean colors: distinct for each variable type
VARIABLE_COLORS = {
    "evap-total": {
        "zscore": ZSCORE_COLORS,
        "mean": ["#fbfaf7", "#e0d0e0", "#c0a0c0", "#9a7098", "#6a4068"],
    },
    "groundwstor": {
        "zscore": ZSCORE_COLORS,
        "mean": ["#fbfaf7", "#dcecd8", "#acd2a6", "#6fac78", "#36795a"],
    },
    "soilmoist": {
        "zscore": ZSCORE_COLORS,
        "mean": ["#fbfaf7", "#ded3bd", "#bba57f", "#8f7350", "#5e462f"],
    },
    "swe": {
        "zscore": ZSCORE_COLORS,
        "mean": ["#fbfaf7", "#c0e0f0", "#90c0e0", "#58a0c8", "#2878a0"],
    },
    "snm": {
        "zscore": ZSCORE_COLORS,
        "mean": ["#fbfaf7", "#c9f2f0", "#8bdedb", "#45bfc2", "#149aa5"],
    },
}


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
    """Calculate percentile of finite values."""
    finite_vals = values[np.isfinite(values)]
    if finite_vals.size == 0:
        return 0.0
    return float(np.percentile(finite_vals, q))


def compute_sparse_profile(magnitude_grid):
    """Compute sparse variable support profile (same as web app)."""
    finite_mag = magnitude_grid[np.isfinite(magnitude_grid)]
    positive_mag = finite_mag[finite_mag > 0]

    if finite_mag.size == 0:
        return {"activeShare": 0, "sparseSupport": False, "activityFloor": 0, "practicalStdFloor": 0}

    active_share = positive_mag.size / finite_mag.size
    sparse_support = active_share < SPARSE_ACTIVE_SHARE_THRESHOLD

    activity_floor = 0
    practical_std_floor = 0

    if sparse_support and positive_mag.size > 0:
        activity_floor = percentile(positive_mag, SPARSE_ACTIVITY_FLOOR_PERCENTILE)
        practical_std_floor = percentile(positive_mag, SPARSE_STD_REFERENCE_PERCENTILE) * SPARSE_STD_REFERENCE_RATIO

    return {
        "activeShare": active_share,
        "sparseSupport": sparse_support,
        "activityFloor": activity_floor,
        "practicalStdFloor": practical_std_floor,
    }


def compute_adjusted_zscore(z_grid, diff_grid, magnitude_grid, profile):
    """Compute adjusted z-score using the same method as web app."""
    adjusted_z = np.full_like(z_grid, np.nan, dtype=np.float32)

    for i in range(z_grid.shape[0]):
        for j in range(z_grid.shape[1]):
            raw_z = z_grid[i, j]
            diff = diff_grid[i, j]
            magnitude = magnitude_grid[i, j]

            # Check if values are valid
            if not np.isfinite(raw_z) or not np.isfinite(diff):
                continue

            # Check if below activity floor (for sparse variables)
            if profile["activityFloor"] > 0:
                if not np.isfinite(magnitude) or magnitude < profile["activityFloor"]:
                    continue

            # If diff is 0, z is 0
            if diff == 0:
                adjusted_z[i, j] = 0
                continue

            # Infer standard deviation from z and diff
            inferred_std = np.abs(diff / raw_z) if raw_z != 0 else np.inf

            # Use practical std floor as minimum denominator
            denominator = max(inferred_std, profile["practicalStdFloor"])

            if denominator > 0 and np.isfinite(denominator):
                adjusted_z[i, j] = diff / denominator

    return adjusted_z


# Robinson projection parameters
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


def projected_centers():
    lon_centers = np.linspace(-179.75, 179.75, 720)
    lat_centers = np.linspace(89.75, -89.75, 360)
    lon2, lat2 = np.meshgrid(lon_centers, lat_centers)
    return robinson(lon2, lat2)


def read_shp_parts(zip_path):
    """Read shapefile parts from a zipped Natural Earth file."""
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


def draw_projected_parts(ax, parts, *, facecolor, edgecolor="none", linewidth=0.0, alpha=1.0, zorder=0):
    """Draw projected polygon parts."""
    for points in parts:
        lon_values = points[:, 0]
        lat_values = points[:, 1]
        breaks = np.where(np.abs(np.diff(lon_values)) > 180)[0] + 1
        for segment in np.split(np.arange(points.shape[0]), breaks):
            if segment.size < 2:
                continue
            x, y = robinson(lon_values[segment], lat_values[segment])
            if facecolor == "none":
                ax.plot(x, y, color=edgecolor, linewidth=linewidth, alpha=alpha, zorder=zorder)
            else:
                ax.fill(x, y, facecolor=facecolor, edgecolor=edgecolor, linewidth=linewidth, alpha=alpha, zorder=zorder)


def add_natural_earth_basemap(ax):
    """Add Natural Earth land and ocean basemap - drawn AFTER data."""
    draw_projected_parts(
        ax,
        basemap_parts("ne_50m_land.zip"),
        facecolor="none",
        edgecolor="#575148",
        linewidth=0.34,
        alpha=0.62,
        zorder=3,
    )
    draw_projected_parts(
        ax,
        basemap_parts("ne_50m_antarctic_ice_shelves_polys.zip"),
        facecolor="none",
        edgecolor="#575148",
        linewidth=0.3,
        alpha=0.55,
        zorder=3,
    )


def add_graticule(ax):
    """Add latitude lines."""
    for lat in np.arange(-60, 90, 30):
        lon_line = np.linspace(-180, 180, 721)
        lat_line = np.full_like(lon_line, lat)
        x, y = robinson(lon_line, lat_line)
        ax.plot(x, y, color="#c8c0b3", lw=0.30, alpha=0.48, zorder=1)


def add_projection_frame(ax):
    """Add projection boundary and longitude lines."""
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
    """Apply consistent axis styling."""
    ax.set_aspect("equal")
    ax.set_xlim(-2.72, 2.72)
    ax.set_ylim(-1.42, 1.42)
    ax.set_axis_off()
    ax.set_facecolor("#f4f1eb")
    add_graticule(ax)
    add_projection_frame(ax)
    # Basemap drawn AFTER data in draw_zscore_map and draw_mean_map


def cmap_from(colors, name):
    cmap = LinearSegmentedColormap.from_list(name, colors, N=256)
    cmap.set_bad((0, 0, 0, 0))
    return cmap


def draw_zscore_map(ax, z_grid, colors):
    """Draw z-score map with diverging colormap centered at 0."""
    x_edges, y_edges = projected_edges()

    cmap = cmap_from(colors, "zscore_div")

    # Use fixed symmetric range for z-scores (cap at 3 for display)
    vmax = 3.0
    norm = TwoSlopeNorm(vmin=-vmax, vcenter=0, vmax=vmax)

    # Clip values for display (values outside ±3 shown as max color)
    z_display = np.clip(z_grid, -vmax, vmax)

    mesh = ax.pcolormesh(x_edges, y_edges, z_display, cmap=cmap, norm=norm, shading="auto", rasterized=True, zorder=2)
    style_axis(ax)
    # Add continent outline on top of data
    add_natural_earth_basemap(ax)

    return mesh, vmax


def draw_mean_map(ax, mean_grid, colors, use_log=False, vmin_override=None):
    """Draw mean value map with sequential colormap.

    Args:
        ax: Matplotlib axis
        mean_grid: 2D array of mean values
        colors: List of colors for colormap
        use_log: If True, use logarithmic scale (for variables with high dynamic range like SWE)
        vmin_override: Override minimum value (e.g., 0 for groundwater storage)
    """
    x_edges, y_edges = projected_edges()

    cmap = cmap_from(colors, "mean_seq")

    if use_log:
        display_grid = np.where(np.isfinite(mean_grid) & (mean_grid > 0), mean_grid, np.nan).astype(np.float32)
    else:
        display_grid = np.where(np.isfinite(mean_grid), mean_grid, np.nan).astype(np.float32)
    finite_vals = display_grid[np.isfinite(display_grid)]
    extend_max = False
    if finite_vals.size == 0:
        vmin, vmax = 0, 1
    else:
        positive_vals = finite_vals[finite_vals > 0]
        if use_log:
            # For log scale, use positive values only
            if positive_vals.size > 0:
                vmin = max(float(np.percentile(positive_vals, 1)), 1e-12)  # Use 1st percentile for min
                vmax = np.max(positive_vals)  # Use actual max for full range
            else:
                vmin, vmax = 1e-12, 1
        else:
            vmin = 0.0
            vmax = np.percentile(positive_vals, 95) if positive_vals.size > 0 else np.max(finite_vals)
            actual_max = float(np.max(finite_vals))
            extend_max = actual_max > vmax
            # Apply override if specified
            if vmin_override is not None:
                vmin = vmin_override

        if vmin == vmax:
            vmin, vmax = vmin - 1, vmax + 1

    if use_log and vmin >= vmax:
        vmax = vmin * 10.0

    if use_log:
        norm = LogNorm(vmin=max(vmin, 1e-12), vmax=vmax, clip=True)
    else:
        norm = Normalize(vmin=vmin, vmax=vmax, clip=False)

    mesh = ax.pcolormesh(x_edges, y_edges, display_grid, cmap=cmap, norm=norm, shading="auto", rasterized=True, zorder=2)
    style_axis(ax)
    # Add continent outline on top of data
    add_natural_earth_basemap(ax)

    return mesh, vmin, vmax, use_log, extend_max


def make_figure_s1():
    """Create Figure S1 with variable rows x 2 columns."""
    mpl.rcParams.update({
        "font.family": "DejaVu Sans",
        "axes.linewidth": 0.36,
        "savefig.transparent": False,
    })

    CHARTS.mkdir(parents=True, exist_ok=True)

    # Keep map geometry and spacing consistent with the human activity figure.
    n_vars = len(VARIABLES)
    fig = plt.figure(figsize=(15.0, 2.45 * n_vars + 0.6), dpi=450)
    fig.patch.set_facecolor("#f8f6f2")

    # Create grid spec with spacing between columns
    gs = fig.add_gridspec(
        nrows=n_vars + 1, ncols=2,
        height_ratios=[0.06] + [1] * n_vars,
        width_ratios=[1, 1],
        hspace=0.10, wspace=0.045,
        left=0.185, right=0.955, top=0.96, bottom=0.035
    )

    # Title row - empty, we'll add titles above each map
    ax_title = fig.add_subplot(gs[0, :])
    ax_title.set_axis_off()
    ax_title.set_facecolor("#f8f6f2")

    # Create map axes
    axes = []
    for row_idx in range(1, n_vars + 1):
        ax_left = fig.add_subplot(gs[row_idx, 0])
        ax_right = fig.add_subplot(gs[row_idx, 1])
        axes.append((ax_left, ax_right))

    # Add column titles above the first row of maps (centered on map, not colorbar)
    # Get the first row axes
    ax_first_left, ax_first_right = axes[0]

    # Calculate position for titles - centered on map area (excluding colorbar)
    # Get the bounding box of each axis in figure coordinates
    fig.canvas.draw()

    # Add titles using text positioned above maps
    ax_first_left.text(0.5, 1.115, "Recent 20-Year Mean", fontsize=13.2, fontweight="bold",
                       ha="center", va="bottom", color="#2a2825", transform=ax_first_left.transAxes)
    ax_first_right.text(0.5, 1.115, "Imbalance Evaluation", fontsize=13.2, fontweight="bold",
                        ha="center", va="bottom", color="#2a2825", transform=ax_first_right.transAxes)

    # Draw maps
    for row_idx, var_info in enumerate(VARIABLES):
        code = var_info["code"]
        name = var_info["name"]
        unit = var_info["unit"]
        mean_scale = var_info.get("mean_scale", 1.0)
        colors = VARIABLE_COLORS[code]

        data = read_variable(code)
        raw_z_grid = as_array(data["zScore"])
        diff_grid = as_array(data["difference"])
        magnitude_grid = as_array(data.get("magnitude") or data.get("recentMean") or data.get("baselineMean"))
        recent_mean = as_array(data["recentMean"]) * mean_scale

        # Compute sparse profile and adjusted z-score (same as web app)
        profile = compute_sparse_profile(magnitude_grid)
        z_grid = compute_adjusted_zscore(raw_z_grid, diff_grid, magnitude_grid, profile)

        ax_left, ax_right = axes[row_idx]

        # Left: recent mean
        vmin_override = 0 if code == "groundwstor" else None
        use_log = code == "swe"

        mesh_left, vmin, vmax_mean, is_log, extend_max = draw_mean_map(
            ax_left, recent_mean, colors["mean"],
            use_log=use_log, vmin_override=vmin_override
        )

        # Right: z-score
        mesh_right, vmax = draw_zscore_map(ax_right, z_grid, colors["zscore"])

        # Row labels on the left side of each row - larger font
        ax_left.text(
            -0.52, 0.5, name,
            ha="left", va="center",
            transform=ax_left.transAxes,
            **VARIABLE_LABEL_STYLE,
        )

        # Colorbars on right side of each map
        cbar_left = fig.colorbar(mesh_left, ax=ax_left, orientation="vertical",
                                  fraction=0.035, pad=0.018, aspect=18, shrink=0.82,
                                  extend="max" if extend_max else "neither")
        cbar_left.set_label(unit, fontsize=8.0, labelpad=3)
        cbar_left.ax.tick_params(labelsize=7.1, length=2)
        cbar_left.outline.set_linewidth(0.3)
        if is_log:
            from matplotlib.ticker import LogLocator
            cbar_left.locator = LogLocator(numticks=6)
            cbar_left.update_ticks()

        cbar_right = fig.colorbar(mesh_right, ax=ax_right, orientation="vertical",
                                   fraction=0.035, pad=0.018, aspect=18, shrink=0.82)
        cbar_right.set_label("z-score", fontsize=8.0, labelpad=3)
        cbar_right.ax.tick_params(labelsize=7.1, length=2)
        cbar_right.outline.set_linewidth(0.3)
        cbar_right.set_ticks([-3, -2, -1, 0, 1, 2, 3])

    # Save figure
    output_path = CHARTS / "figS02_variable_imbalance_means.png"
    fig.savefig(output_path, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)

    print(f"Saved: {output_path}")
    return output_path


if __name__ == "__main__":
    make_figure_s1()
