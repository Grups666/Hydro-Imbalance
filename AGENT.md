# Project Agent Guide

## Project Purpose

This repository supports a water-cycle imbalance study. The central question is not whether a variable is large in one year, but whether recent hydrological behavior departs from a long-term baseline in a physically interpretable way.

The current imbalance diagnostic is window based:

- Recent 20-year window used in main figures: 2000-2019.
- Recent 30-year window is retained in the processing pipeline as a sensitivity option.
- The main 20-year baseline is 1950-1999.
- Imbalance is evaluated as recent-window mean minus baseline mean, standardized by an effective baseline standard deviation.

Do not treat "current imbalance" as a single-year value. It is a recent-window departure from the historical baseline.

## Repository Layout

- `projects/`: WaterGAP processing, basin preparation, local web viewer, and local datasets.
- `projects/src/build_analysis.py`: scans WaterGAP NetCDF files, aggregates monthly data to annual means, builds recent-window diagnostics, and writes `projects/web/data/*.js` plus `projects/web/analysis-data.js`.
- `projects/src/build_basins.py`: prepares HydroBASINS level-4 catchment geometry and WaterGAP cell membership in `projects/basin-data.js`.
- `projects/src/build_basin_time_series.py`: builds annual catchment-level time series for selected variables.
- `projects/src/build_glacier_basin_bridge.py`: builds the RGI glacier-area bridge used only as an internal spatial weighting table for glacier calculations.
- `projects/glacier_storage_reconstruction/`: reconstructs annual catchment glacier water storage from a static Farinotti et al. absolute volume reference and Zemp et al. annual mass-change data.
- `projects/web/`: local static viewer for exploratory diagnostics.
- `paper/code/`: figure-building scripts for manuscript figures.
- `paper/charts/`: generated figure outputs.
- `paper/manuscripts/`: manuscript and supplementary methods text.
- `paper/reports/`: concise figure method/count summaries.
- `references/`: background literature.

Large raw datasets under `projects/datasets/` are local and ignored by Git.

## Core Diagnostic Logic

For a variable `v` at grid cell `i`:

```text
baseline_mean(v,i) = mean annual value over baseline period
recent_mean(v,i) = mean annual value over recent window
difference(v,i) = recent_mean(v,i) - baseline_mean(v,i)
z(v,i) = difference(v,i) / effective_baseline_std(v,i)
```

The processing uses standard-deviation floors and sparse-variable masks so that near-zero values do not create false large z-scores.

Important implications:

- Flux variables such as evapotranspiration or withdrawals enter as annual amounts or annual means, then the recent mean is compared to baseline mean.
- Storage variables such as groundwater storage enter as annual mean state values, then the recent mean state is compared to baseline mean state.
- A variable that is already a year-to-year change rate should not be treated as a storage/state variable without first considering whether it needs temporal integration.

## Variable Type Discipline

Always identify the physical type before adding or interpreting a variable.

- Flux/process amount: examples include AET and water withdrawal. Use annual integrated depth such as `mm yr-1`, then compare recent-window mean against baseline mean.
- Storage/state: examples include groundwater storage, soil moisture, snow water storage. Use annual mean water-equivalent state such as `mm`, then compare recent-window mean against baseline mean.
- Annual change rate: examples include glacier annual mass balance in `m w.e. yr-1`. This is a first derivative of storage. For a storage-imbalance question, integrate it to a cumulative storage-change series before applying the recent-window framework.

Do not mix annual change-rate variables directly with state variables when the interpretation is "current imbalance" as a recent-window departure from baseline state.

## Glacier Handling

Zemp et al. (2019) regional `INT_mwe` is annual specific glacier mass-change rate:

```text
INT_mwe = annual glacier mass balance estimated by spatial interpolation
unit = m water equivalent yr-1
positive = mass gain
negative = mass loss
```

`INT_mwe` is not absolute glacier water storage. It is an annual change rate. If it is used directly, it answers:

```text
How much glacier mass changed in this year?
```

For this project's imbalance framework, the preferred glacier state-like indicator is cumulative glacier mass change, not raw annual mass balance:

```text
annual_glacier_balance_mm_yr(c,t)
  = 1000 * sum_r(INT_mwe(r,t) * glacier_area_km2(c,r)) / catchment_area_km2(c)

cumulative_glacier_mass_change_mm(c,t)
  = sum_tau<=t annual_glacier_balance_mm_yr(c,tau)
```

This cumulative series is still relative, because Zemp 2019 does not provide an absolute initial glacier volume for every catchment. It should be interpreted as glacier storage change relative to the chosen start year, not total glacier storage.

If an absolute glacier storage variable is required, an additional ice-thickness or glacier-volume dataset is needed. Then storage can be estimated as:

```text
glacier_storage_mm = glacier_water_equivalent_volume / catchment_area
```

The RGI glacier area bridge is an internal spatial weighting aid only. Do not expose glacier area as one of the four basin time-series variables unless the user explicitly asks for a coverage or background table.

## Human Water-Use Classification

Human water-use exposure is based on recent 20-year mean withdrawals, not z-score alone.

Variables:

- Potential Irrigation Water Withdrawals: `pirrww`
- Potential Electricity Water Withdrawal: `pelecww`
- Potential Manufacturing Water Withdrawal: `pmanww`
- Potential Domestic Water Withdrawals: `pdomww`

Grid-cell activity rule:

```text
active if any selected withdrawal >= 0.10 mm day-1
```

Catchment activity rule:

```text
human-impacted if active cells occupy >= 10% of catchment area
```

Cell-level composition is assigned from screened recent-mean shares:

- Single dominant if top share >= 50%.
- Two-sector combination if top share < 50% and second share >= 25%.
- Otherwise keep a top-led mixed class.

Catchment-level composition removes inactive cells first, then applies the same 50% and 25% rules to active-cell type proportions.

Hatching in the human-water-use classification indicates heterogeneous within-catchment withdrawal composition, based on the consistency index:

```text
C = sqrt(sum_k P_k^2)
```

Catchments with `C < 0.95` are hatched.

## Water-Cycle Imbalance Classification

Figure 2 uses annual basin time series for three variables:

- Net water-demand deficit.
- Groundwater storage.
- Reconstructed absolute glacier storage.

For each variable, compare the recent 20-year mean for 1997-2016 with the historical mean for 1962-1996. A variable is imbalanced when:

```text
abs(recent_mean - historical_mean) > 2 * historical_standard_deviation
AND
abs(recent_mean - historical_mean) > 1 mm
```

The catchment class is the combination of variables that satisfy the rule, producing eight classes: no detected imbalance, three single-variable classes, three two-variable combinations, and an all-three-variable class.

The net water-demand deficit is computed from WaterGAP 2.2d as `max(0, ptotww + EFR - ncrunnat)`, where EFR is the environmental-flow requirement estimated from naturalized runoff Q90 exceedance for each calendar month. Monthly deficits are aggregated to annual catchment means.

The gold boundary remains an independent human-impact annotation. It marks catchments where WaterGAP 2.2d `ptotww` cells with recent mean total withdrawal above `0.1 mm/day` occupy at least 10% of catchment area. It does not change the three-variable imbalance class.

## Figure Guidelines

- Do not place large descriptive titles or subtitles inside figure panels.
- Keep figure titles and detailed captions in the manuscript text, immediately near the figure reference.
- Global map figures must include a visible Robinson projection frame so the map boundary is consistent with regional and variable maps.
- Legends for global classification maps should sit outside the mapped land/catchment area and must not overlap the data.
- Use "catchment" for HydroBASINS spatial units in figure-facing text, captions, reports, and legends.
- In figure legends, hatching should indicate heterogeneity or pattern explicitly, not a separate physical variable class.

## Coding And Data Rules

- Prefer existing scripts and project conventions over creating one-off files.
- Do not generate extra markdown, templates, or duplicate result files unless requested or needed as a stable deliverable.
- If a generated file is only a local dataset output under `projects/datasets/`, remember it is intentionally ignored by Git.
- Keep figure scripts deterministic and write outputs to `paper/charts/`.
- Keep reports under `paper/reports/` concise and aligned with current figures only.
- Documentation should describe only the current repository state and current outputs.
- Use ASCII in code and documentation unless a file already requires non-ASCII content.
