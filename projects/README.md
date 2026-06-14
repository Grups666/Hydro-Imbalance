# WaterGAP Processing

This folder contains the current data-processing scripts, local raw inputs, generated basin data, and exploratory grid viewer.

## Contents

- `src/build_basin_time_series.py`: builds the 1962-2016 basin time series used by Figure 2 and the Tereon module.
- `src/build_analysis.py`: scans readable WaterGAP NetCDF files under `datasets/`, computes recent-window z-score diagnostics, and writes JavaScript data modules for the exploratory viewer.
- `src/build_basins.py`: prepares basin boundary data for map overlays and paper figures.
- `web/`: static HTML/CSS/JavaScript viewer.
- `web/data/`: generated variable-level data modules consumed by the viewer.
- `datasets/`: local raw WaterGAP inputs. These files are intentionally ignored by Git except for `.gitkeep`.
- `basin-data.js`: generated basin overlay data used by both the viewer and paper figures.

## Run

Generate the basin time-series dataset:

```bash
python src/build_basin_time_series.py
```

Generate exploratory grid analysis data:

```bash
python src/build_analysis.py
```

Generate basin data:

```bash
python src/build_basins.py
```

Open the viewer directly from `web/index.html`, or serve the folder locally:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000/web/`.

## Current Data Use

The basin time-series product uses WaterGAP 2.2d for 1962-2016, matching the glacier reconstruction period. The first variable is `net_water_demand_deficit_mm_yr`, calculated from `ptotww`, environmental-flow requirement, and `ncrunnat`. The exploratory viewer uses generated grid-cell z-score summaries for visual inspection only. Large raw datasets, browser profiles, Python caches, and editor state are ignored by Git.
