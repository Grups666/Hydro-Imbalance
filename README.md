# Hydro-Imbalance

A spatial research foundation for mapping basin-scale water-cycle imbalance, hydrological time series, and scientific literature.

**Online demo:** [https://grups666.github.io/Hydro-Imbalance/](https://grups666.github.io/Hydro-Imbalance/)

## Overview

Hydro-Imbalance separates a generic map-based Foundation from a domain module that can be loaded independently.

The Foundation supplies the global map, basin geometry and identifiers, layer management, feature interaction, inspector, and module loader. The default Water Imbalance module supplies:

- A global categorical basin imbalance map.
- Annual three-variable basin time series for 1962-2016.
- Per-variable recent-versus-historical imbalance assessment.
- Basin area and Foundation dataset match rate.
- Literature evidence for named research regions.

The module does not use the former irrigation, groundwater, reservoir, monsoon, or other hydrological-mode classifications. Hydrological-process and ontology panels are also excluded.

## Imbalance Classification

The three assessed variables are:

| Variable | Meaning | Unit |
|---|---|---|
| `potential_total_water_withdrawal_mm_yr` | Potential total water withdrawal across sectors and water sources | mm yr-1 |
| `groundwater_storage_mm` | Annual mean groundwater storage | mm |
| `glacier_storage_mm_we` | Reconstructed absolute glacier storage | mm water equivalent |

For each variable, the mean of the recent 20-year period, 1997-2016, is compared with the earlier historical period, 1962-1996. A variable is classified as imbalanced when:

```text
abs(recent mean - historical mean) > historical standard deviation
AND
abs(recent mean - historical mean) > 1 mm
```

The map color represents the set of imbalanced variables:

| Color | Classification |
|---|---|
| White | No detected imbalance |
| Yellow | Total water withdrawal |
| Magenta | Groundwater storage |
| Cyan | Glacier storage |
| Red | Withdrawal + groundwater |
| Green | Withdrawal + glacier |
| Blue | Groundwater + glacier |
| Black | All three variables |
| Light gray | No matched time series |

The generated classification file records the historical mean, recent mean, historical standard deviation, difference, and decision for every variable and basin.

## Dataset

The authoritative input is:

```text
Water_Circle_Imbalance/projects/datasets/basin_time_series/
  basin_three_variable_timeseries_1962_2016.csv
```

Coverage:

```text
70,125 catchment-year records
1,275 source catchments
55 annual records per catchment
1,096 exact matches with Foundation basins
97.77% Foundation basin coverage
```

The module connects time series to Foundation geometry through an exact `basin_id` join. Coordinates are not duplicated in the module dataset.

### WaterGAP Processing

Potential total water withdrawal uses WaterGAP 2.2d monthly `ptotww` flux. Monthly flux in `kg m-2 s-1` is integrated using calendar month length, summed to annual depth, and averaged across WaterGAP cells assigned to each catchment.

Monthly groundwater storage uses WaterGAP 2.2d `groundwstor`. Values in `kg m-2` are equivalent to millimetres of water. Day-weighted annual means are averaged across assigned catchment cells.

### Glacier Water-Equivalent Storage

Glacier storage combines the Farinotti et al. (2019) around-2000 absolute glacier-volume reference, RGI 6.0 glacier outlines, and Zemp et al. (2019) regional annual mass balance.

Ice volume is converted to water-equivalent volume using a density ratio of `0.9`. Annual storage is reconstructed forward and backward from the around-2000 reference, clipped at zero, and normalized by catchment area.

## Literature

The repository retains 2,851 literature records collected from curated foundational studies and OpenAlex discovery. Titles and abstracts were semantically audited with an LLM. The literature catalog remains available independently from the numerical imbalance classification.

## Module Structure

```text
public/modules/water-imbalance/
  module.json
  index.js
  data/
    basin-three-variable-timeseries-1962-2016.csv
    basin-time-series-metadata.json
    basin-imbalance-classification.json
    knowledge-graph.json
```

Rebuild the module data from the authoritative source CSV:

```bash
npm run build:water-imbalance
```

## Run Locally

```bash
npm install
npm start
```

Open `http://127.0.0.1:8791/`.

Run validation:

```bash
npm test
```

## GitHub Pages

The repository deploys to:

[https://grups666.github.io/Hydro-Imbalance/](https://grups666.github.io/Hydro-Imbalance/)

## Version

Current release: **V0.1.1**
