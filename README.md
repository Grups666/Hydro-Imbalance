# Hydro-Imbalance

Hydro-Imbalance is a Tereon domain module and research workspace for basin-scale hydrological imbalance. It provides data, classification, time series, basin ontology, manuscript assets, and module adapters consumed by Tereon.

The Foundation map and module loader live in:

[https://github.com/Grups666/Tereon](https://github.com/Grups666/Tereon)

## Interactive Page

Open the already-loaded Hydrological Imbalance viewer here:

[https://grups666.github.io/Hydro-Imbalance/](https://grups666.github.io/Hydro-Imbalance/)

This page launches Tereon with two Hydro-Imbalance module manifests preloaded, so users can compare the same imbalance method on two basin boundary products:

- `Water Imbalance - Major River Basins`: GRDC Major River Basins of the World, 2020.
- `Water Imbalance - WMO Basins`: GRDC WMO Basins and Sub-Basins, 2020.

## Tereon Module

Direct module manifest:

```text
https://grups666.github.io/Hydro-Imbalance/module.json
```

WMO basin comparison manifest:

```text
https://grups666.github.io/Hydro-Imbalance/module-wmo.json
```

Repository URL import:

```text
https://github.com/Grups666/Hydro-Imbalance
```

The manifest points Tereon to the module entry, basin classification, and time-series metadata under:

```text
public/modules/water-imbalance/
```

## Module Contents

```text
public/modules/water-imbalance/
  index.js
  data/
    basin-data.json
    basin-three-variable-timeseries-1962-2016.csv
    basin-time-series-metadata.json
    basin-imbalance-classification.json

public/modules/water-imbalance-wmo/
  data/
    basin-data.json
    basin-three-variable-timeseries-1962-2016.csv
    basin-time-series-metadata.json
    basin-imbalance-classification.json
```

## Data Products

- Global GRDC Major River Basin hydrological imbalance classification.
- Global GRDC WMO Basin/Sub-Basin hydrological imbalance classification for boundary-product comparison.
- Annual three-variable basin time series for 1962-2016.
- Per-variable recent-versus-historical imbalance assessment.
- Basin ontology keyed by basin ID and basin name; future evidence links should attach directly to those basin identifiers, not to coordinate boxes.

## Imbalance Classification

Variables:

| Variable | Meaning | Unit |
|---|---|---|
| `net_water_demand_deficit_mm_yr` | Water-demand deficit after local naturalized runoff availability and environmental-flow requirement are considered | mm yr-1 |
| `groundwater_storage_mm` | Annual mean groundwater storage | mm |
| `glacier_storage_mm_we` | Reconstructed absolute glacier storage | mm water equivalent |

A variable is classified as imbalanced when:

```text
abs(recent mean - historical mean) > 2 * historical standard deviation
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

The core basin time-series classification uses WaterGAP 2.2d clipped to 1962-2016 to match the glacier reconstruction. The default manuscript-facing unit remains GRDC Major River Basins; the WMO module uses GRDC WMO Basins and Sub-Basins as a parallel comparison product without changing the imbalance rule. The local exploratory grid viewer uses WaterGAP2.2e ISIMIP3a GSWP3-W5E5 obsclim/histsoc/default monthly output for 1901-2019, stored under `projects/datasets/watergap_22e_2019/`. The downloader is resumable and skips files that already match the official byte size.

Literature evidence for basin validation is stored in each public module as `data/basin-literature-evidence.json`. The evidence is linked by basin identifier and variable key, not by map coordinates. The current evidence set covers glacier storage, groundwater storage, and water-demand deficit. Each entry records the literature quantity, the comparison denominator, the project basin statistics, and a risk note when the literature definition is not directly equivalent. Glacier storage shifts are converted to approximate m w.e. yr-1 equivalents by dividing by the 27.5-year distance between the 1962-1996 and 1997-2016 window centers; groundwater shifts are similarly linearized to mm yr-1 when compared with GRACE-style trends; water-demand deficit is compared primarily through recent mean mm yr-1 and regional pressure/gap studies.

The local research viewer can be opened from `projects/web/index.html`, or served locally with:

```bash
cd projects
python -m http.server 8000
```

Then visit `http://localhost:8000/web/`.

## Build And Validate

```bash
npm run build:water-imbalance
node scripts/build/build-literature-evidence.js
npm test
```

WMO comparison data are generated with the same scripts using `--source wmo`, `--basin-data`, `--glacier-storage`, and module build arguments. Large raw and intermediate CSV/ZIP/TIF/NetCDF files remain outside version control. The only published module manifests are `module.json` and `module-wmo.json`; browser-ready JS and data assets are kept under `public/modules/`.

For the research workspace scripts:

```bash
python -m py_compile paper/code/*.py projects/src/*.py
node --check projects/web/app.js
node --check projects/web/evidence.js
```

## Version-Control Policy

Large raw datasets and local browser/editor state are ignored by Git. Manuscripts, plotting code, final figure assets, module manifests, and browser-ready module data are kept as project deliverables.
