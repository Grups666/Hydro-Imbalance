# WaterGAP Analysis Viewer

This folder contains the WaterGAP processing scripts and the local static web viewer used for exploratory analysis.

## Contents

- `src/build_analysis.py`: scans readable WaterGAP NetCDF files under `datasets/`, computes recent-window z-score diagnostics, and writes JavaScript data modules for the viewer.
- `src/build_basins.py`: prepares basin boundary data for map overlays.
- `web/`: static HTML/CSS/JavaScript viewer.
- `web/data/`: generated variable-level data modules consumed by the viewer.
- `datasets/`: local raw WaterGAP inputs. These files are intentionally ignored by Git except for `.gitkeep`.
- `basin-data.js`: generated basin overlay data used by both the viewer and paper figures.

## Run

Generate analysis data:

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

## Notes

The analysis currently compares recent 20-year and 30-year means against the earlier long-term baseline and reports grid-cell z-scores. Large raw datasets, browser profiles, Python caches, and editor state are ignored by Git.
