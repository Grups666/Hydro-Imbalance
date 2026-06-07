# Hydro-Imbalance

Hydro-Imbalance is a Tereon domain module and research workspace for basin-scale hydrological imbalance. It provides data, classification, time series, literature evidence, manuscript assets, and the module adapter consumed by Tereon.

The Foundation map and module loader live in:

[https://github.com/Grups666/Tereon](https://github.com/Grups666/Tereon)

## Interactive Page

Open the already-loaded Hydrological Imbalance viewer here:

[https://grups666.github.io/Hydro-Imbalance/](https://grups666.github.io/Hydro-Imbalance/)

This page launches Tereon with the Hydro-Imbalance module manifest preloaded, so users do not need to manually import the module URL.

## Tereon Module

Direct module manifest:

```text
https://grups666.github.io/Hydro-Imbalance/module.json
```

Repository URL import:

```text
https://github.com/Grups666/Hydro-Imbalance
```

The manifest points Tereon to the module entry, runtime graph, classification, and time-series metadata under:

```text
public/modules/water-imbalance/
```

## Module Contents

```text
public/modules/water-imbalance/
  module.json
  index.js
  data/
    runtime-graph.json
    knowledge-graph.json
    basin-three-variable-timeseries-1962-2016.csv
    basin-time-series-metadata.json
    basin-imbalance-classification.json
```

## Data Products

- Global basin hydrological imbalance classification.
- Annual three-variable basin time series for 1962-2016.
- Per-variable recent-versus-historical imbalance assessment.
- Literature evidence and author entities for named research regions.

## Imbalance Classification

Variables:

| Variable | Meaning | Unit |
|---|---|---|
| `potential_total_water_withdrawal_mm_yr` | Potential total water withdrawal across sectors and water sources | mm yr-1 |
| `groundwater_storage_mm` | Annual mean groundwater storage | mm |
| `glacier_storage_mm_we` | Reconstructed absolute glacier storage | mm water equivalent |

A variable is classified as imbalanced when:

```text
abs(recent mean - historical mean) > historical standard deviation
AND
abs(recent mean - historical mean) > 1 mm
```

Recent period: 1997-2016.
Historical period: 1962-1996.

## Research Workspace

- `paper/`: manuscript text, publication figures, and figure-building scripts.
- `projects/`: WaterGAP analysis pipeline and local exploratory web viewer.
- `references/`: background literature and source references.

### Rebuild paper figures

```bash
python paper/code/build_fig01_human_water_use_catchment_classification.py
python paper/code/build_fig02_water_cycle_imbalance.py
python paper/code/build_figS01_human_activity_variables.py
python paper/code/build_figS02_variable_imbalance_means.py
python paper/code/build_figS03_regional_imbalance.py
```

Figure outputs are written to `paper/charts/`.

### Rebuild the local web analysis data

```bash
cd projects
python src/download_watergap_22e_2019.py
python src/build_analysis.py
python src/build_basins.py
```

The current analysis uses WaterGAP2-2e ISIMIP3a GSWP3-W5E5 obsclim/histsoc/default monthly output for 1901-2019, stored under `projects/datasets/watergap_22e_2019/`. The downloader is resumable and skips files that already match the official byte size.

The local research viewer can be opened from `projects/web/index.html`, or served locally with:

```bash
cd projects
python -m http.server 8000
```

Then visit `http://localhost:8000/web/`.

## Literature

The repository retains curated foundational studies and OpenAlex discovery records. Browser runtime graph exports are reduced to the literature records and author entities needed by active region links.

Verified Google Scholar profile links are stored separately:

```text
catalog/authors/scholar-profiles.json
```

Only verified `scholar.google.com/citations?user=...` URLs are rendered as author links.

## Build And Validate

```bash
npm run build:water-imbalance
npm run build:runtime-graph
npm test
```

For the research workspace scripts:

```bash
python -m py_compile paper/code/*.py projects/src/*.py
node --check projects/web/app.js
node --check projects/web/evidence.js
```

## Version-Control Policy

Large raw datasets and local browser/editor state are ignored by Git. Manuscripts, plotting code, final figure assets, module manifests, and browser-ready module data are kept as project deliverables.
