# Water Circle Imbalance

This repository contains the analysis code, manuscript assets, and local web viewer for the water-cycle imbalance study.

## Directory Layout

- `paper/`: manuscript text, publication figures, and figure-building scripts.
- `projects/`: WaterGAP analysis pipeline and local exploratory web viewer.
- `references/`: background literature and source references.

## Main Workflows

### Rebuild paper figures

```bash
python paper/code/build_fig01_human_water_use_catchment_classification.py
python paper/code/build_fig02_water_cycle_imbalance.py
python paper/code/build_figS01_human_activity_variables.py
python paper/code/build_figS02_variable_imbalance_means.py
python paper/code/build_figS03_regional_imbalance.py
```

Figure outputs are written to `paper/charts/`:

- `fig01_human_water_use_catchment_classification.png`
- `fig02_water_cycle_imbalance.png`
- `figS01_human_activity_variables.png`
- `figS02_variable_imbalance_means.png`
- `figS03_regional_imbalance.png`

### Rebuild the web analysis data

```bash
cd projects
python src/download_watergap_22e_2019.py
python src/build_analysis.py
python src/build_basins.py
```

The current analysis uses WaterGAP2-2e ISIMIP3a GSWP3-W5E5 obsclim/histsoc/default monthly output for 1901-2019, stored under `projects/datasets/watergap_22e_2019/`. The downloader is resumable and skips files that already match the official byte size.

The web viewer can be opened from `projects/web/index.html`, or served locally with:

```bash
cd projects
python -m http.server 8000
```

Then visit `http://localhost:8000/web/`.

## Version-Control Policy

Large raw datasets and local browser/editor state are ignored by Git. Manuscripts, plotting code, and final figure assets under `paper/` are kept as project deliverables.
