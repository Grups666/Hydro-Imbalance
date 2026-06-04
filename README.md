# Hydro-Imbalance

An ontology-driven spatial research foundation for exploring basin-scale water-cycle imbalance, hydrological time series, and scientific literature.

**Online demo:** [https://grups666.github.io/Hydro-Imbalance/](https://grups666.github.io/Hydro-Imbalance/)

## Overview

Hydro-Imbalance separates a generic spatial research foundation from domain-specific research modules.

The **Foundation** provides:

- Global interactive map and reusable basin geometry.
- Layer management, feature selection, hover, and inspection.
- Dynamic module loading through module manifests.
- Generic CSV and module-manifest import entry points.
- A shared interface for attaching datasets, literature, analysis results, and panels to spatial entities.

The **Water Imbalance Ontology module** provides:

- Basin water-cycle imbalance classifications.
- Named regional research contexts.
- Basin-linked annual hydrological time series.
- Literature evidence linked to regions and hydrological modes.
- Ontology relations connecting basins, processes, modes, datasets, and literature.

The Foundation does not contain hard-coded water-imbalance concepts. The complete domain implementation is loaded from:

```text
public/modules/water-imbalance/
```

## Current Interface

The default Water Imbalance module adds a thematic basin layer to the Foundation.

Selecting a basin opens a module-specific inspector containing:

- Basin metadata and matched imbalance mode.
- Ontology relations.
- Hydrological-process summary.
- Linked literature evidence.
- A four-variable time-series preview.

The preview expands into four vertically aligned charts with a shared annual cursor:

1. Actual evapotranspiration.
2. Potential groundwater withdrawal.
3. Groundwater storage.
4. Glacier storage.

Moving the pointer horizontally synchronizes the selected year across all four charts. Each chart shows its corresponding value and horizontal crosshair.

## Foundation and Module Architecture

```text
Foundation
├── global map
├── base outlines
├── basin geometry and basin IDs
├── layer manager
├── inspector
├── import interface
└── module loader

Water Imbalance module
├── module.json
├── ontology.json
├── index.js
└── data/
    ├── knowledge-graph.json
    ├── basin-time-series-metadata.json
    └── basin-four-variable-timeseries-1962-2016.csv
```

The module connects its records to the Foundation using basin identifiers:

```text
Foundation Basin.id
        ↕ exact identifier join
Module TimeSeries.basin_id
```

Latitude and longitude are not required for the time-series dataset because spatial geometry already belongs to the Foundation basin entity.

## Water Imbalance Ontology

The module ontology defines reusable entities including:

- `Basin`
- `RegionContext`
- `ImbalanceMode`
- `HydrologicalProcess`
- `Literature`
- `Dataset`
- `BasinTimeSeries`
- `HydrologicalVariable`
- `AnalysisResult`

Example relations:

```text
BasinTimeSeries -> time_series_describes_basin -> Basin
Basin -> basin_has_mode -> ImbalanceMode
Basin -> basin_matches_region -> RegionContext
Literature -> paper_evidences_mode -> ImbalanceMode
Literature -> paper_studies_region -> RegionContext
Dataset -> dataset_supports_process -> HydrologicalProcess
AnalysisResult -> result_attaches_to_basin -> Basin
```

The current knowledge graph contains:

```text
11 water-cycle modes
11 named regional contexts
2,851 literature records
3,618 typed relations
```

## Basin Time-Series Dataset

The module includes a unified annual catchment-scale dataset covering **1962-2016**:

```text
70,125 catchment-year records
1,275 source catchments
55 annual records per catchment
1,096 exact matches with current Foundation basins
97.77% coverage of Foundation basins
```

### Variables

| Variable | Meaning | Unit |
|---|---|---|
| `aet_mm_yr` | Annual actual evapotranspiration | mm yr-1 |
| `potential_groundwater_withdrawal_mm_yr` | Annual potential groundwater withdrawal | mm yr-1 |
| `groundwater_storage_mm` | Annual mean groundwater storage | mm |
| `glacier_storage_mm_we` | Reconstructed absolute glacier storage | mm water equivalent |

All variables are normalized by catchment area.

### WaterGAP Processing

The WaterGAP-derived variables use WaterGAP 2.2d monthly output.

Actual evapotranspiration and potential groundwater withdrawal are supplied as monthly fluxes in `kg m-2 s-1`. They are integrated using the number of days in each calendar month:

```text
monthly depth (mm) = flux (kg m-2 s-1) × days in month × 86,400
```

Monthly depths are summed to annual values and averaged across WaterGAP cells assigned to each catchment.

Monthly groundwater storage in `kg m-2` is directly equivalent to millimetres of water. A day-weighted annual mean is calculated and then averaged across assigned catchment grid cells.

Two source catchments contain no valid WaterGAP grid values. Their WaterGAP-derived variables remain missing rather than being fabricated.

### Glacier Water-Equivalent Storage

Glacier storage is an absolute water-equivalent storage reconstruction, not glacier area or annual loss alone.

The reconstruction combines:

- Farinotti et al. (2019) global glacier-volume estimates as an around-2000 absolute reference.
- RGI 6.0 glacier outlines for catchment assignment.
- Zemp et al. (2019) regional annual glacier mass-balance series.

Ice volume is converted to water-equivalent volume using:

```text
water-equivalent volume = ice volume × 0.9
```

Annual regional mass balance is distributed according to glacier area within each catchment:

```text
annual balance km3 we =
0.001 × sum(regional annual balance m we × catchment glacier area km2)
```

Annual storage is reconstructed forward and backward from the around-2000 reference. Negative reconstructed storage is clipped to zero. Absolute catchment storage is converted to catchment-normalized depth:

```text
glacier_storage_mm_we =
glacier_storage_km3_we / catchment_area_km2 × 1,000,000
```

## Literature Collection and Semantic Review

The literature catalog was assembled from manually curated foundational studies and OpenAlex discovery queries covering basin hydrology, water-cycle modes, groundwater depletion, storage change, reservoir regulation, monsoon recharge, snow and glacier processes, and low-human-impact basins.

Each record may include:

- Title, authors, affiliations, year, and venue.
- DOI or external link.
- Abstract and keywords.
- Candidate water-cycle mode and regional context.
- Semantic-review status, confidence, and explanation.

An LLM semantic-audit workflow reviewed all **2,851 records** using titles and abstracts rather than simple keyword matching.

Current review results:

```text
Approved: 1,859
Review required: 366
Rejected: 626
```

Rejected records are excluded from the module's displayed evidence. Approved and review-required records are linked to modes or named regional contexts through typed knowledge-graph relations.

## Module Import Model

Modules are described by a manifest:

```json
{
  "id": "water-imbalance",
  "entry": "./index.js",
  "className": "WaterImbalanceModule",
  "ontology": "./ontology.json",
  "knowledgeGraph": "./data/knowledge-graph.json",
  "defaultLoad": true
}
```

The same module can run through the local Node server or as a static GitHub Pages deployment. On GitHub Pages, the Foundation falls back from the module API to static module manifests.

The current import interface supports:

- CSV point-data import using latitude and longitude fields.
- Module-manifest import for modules already available under `public/modules/`.

Future import contracts can support basin-ID time series, GeoJSON, remote datasets, script results, and packaged module archives.

## Run Locally

Requirements:

- Node.js 18 or newer.

```bash
git clone https://github.com/Grups666/Hydro-Imbalance.git
cd Hydro-Imbalance
npm install
npm start
```

Open:

```text
http://127.0.0.1:8791/
```

Run validation:

```bash
npm test
```

## GitHub Pages

The repository includes a GitHub Actions workflow that deploys the `public/` directory to GitHub Pages.

After Pages is enabled with **GitHub Actions** as its source, pushes to `main` deploy automatically to:

[https://grups666.github.io/Hydro-Imbalance/](https://grups666.github.io/Hydro-Imbalance/)

## Important Directories

```text
public/foundation/                 Generic map, layer, UI, and module-loading runtime
public/modules/water-imbalance/    Domain module, ontology, knowledge graph, and time series
public/assets/                     Foundation basin and land geometry
catalog/literature/                Source literature catalog
data/literature/                   Harvest and semantic-audit outputs
scripts/                           Data ingestion, processing, validation, and export tools
docs/                              Architecture, product, and research documentation
```

## Limitations

- Basin time-series coverage is based on exact `basin_id` matching and currently covers 97.77% of Foundation basins.
- The current imbalance-mode assignment combines named regional contexts and broad spatial rules. It is a research-screening layer, not a definitive causal diagnosis.
- GitHub Pages is static. Server-side LLM research endpoints are available only when running the local Node server.
- Literature semantic review improves alignment but does not replace expert verification.

## Version

Current release: **V0.1.0**

## Citation

```bibtex
@software{hydro_imbalance_2026,
  title  = {Hydro-Imbalance: An Ontology-Driven Spatial Research Foundation},
  author = {Grups666},
  year   = {2026},
  url    = {https://github.com/Grups666/Hydro-Imbalance}
}
```
