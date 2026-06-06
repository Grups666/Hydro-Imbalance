# Hydro-Imbalance

Hydro-Imbalance is a Tereon domain module for basin-scale water-cycle imbalance. It provides data, classification, time series, literature evidence, and the module adapter consumed by Tereon.

The Foundation map and module loader now live in:

[https://github.com/Grups666/Tereon](https://github.com/Grups666/Tereon)

## Remote Module

Tereon can load this module from GitHub Pages through the direct module manifest:

```text
https://grups666.github.io/Hydro-Imbalance/modules/water-imbalance/module.json
```

The repository also exposes a root `module.json` entry for repo URL imports:

```text
https://github.com/Grups666/Hydro-Imbalance
```

That root entry points Tereon back to the GitHub Pages module assets. Hydro-Imbalance remains a headless module/data repository.

The manifest points to the module entry, runtime graph, classification, and time-series metadata under:

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

- Global basin imbalance classification.
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

## Literature

The repository retains 2,851 literature records collected from curated foundational studies and OpenAlex discovery. The browser runtime graph is reduced to only the literature records and author entities needed by active region links.

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

## Version

Current split-repo release: `v0.0.1`
