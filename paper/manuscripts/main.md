# Methods

## Diagnostic Framework

We treated water-cycle imbalance as a standardized anomaly outcome evaluated from WaterGAP2-2e variables. The analysis focuses on whether recent hydrological states depart from their long-term baseline in a physically interpretable way. Rather than assigning imbalance to a single variable, the framework compares complementary evidence from water demand, atmospheric evaporative demand, and water storage.

The current paper figures focus on regional imbalance contrasts among three variables: potential irrigation water withdrawals, potential evapotranspiration, and groundwater storage. These variables were selected because they jointly describe human water demand, climatic evaporative forcing, and subsurface storage response in major irrigation regions.

To evaluate the role of human activity, we separated human-water-use exposure from hydrological response. Human-water-use exposure was first screened by absolute magnitude in the updated WaterGAP2-2e 2019 dataset, with flux units converted from kg m-2 s-1 to mm day-1 for interpretation. The activity-variable figure uses four sectoral withdrawal variables: potential irrigation water withdrawals, potential electricity water withdrawal, potential manufacturing water withdrawal, and potential domestic water withdrawals. For each variable, the mean map shows the recent 20-year withdrawal intensity and the imbalance map shows the recent standardized anomaly.

Core human-water-use regions were not defined from z-scores alone. For each grid cell, the recent 20-year mean withdrawals were used to decide whether each sector had meaningful absolute activity. Values below 0.1 mm day-1 were ignored before classifying the water-use composition. This avoids interpreting very small absolute water-use values with large relative anomalies as major human-activity regions.

## Data and Temporal Baseline

The analysis used WaterGAP2-2e gridded monthly outputs from the ISIMIP3a GSWP3-W5E5 obsclim/histsoc/default experiment on a 0.5 degree global grid with 720 columns and 360 rows. The dataset spans 1901-2019. Monthly variables were aggregated to annual means before recent-window diagnostics were calculated.

Two recent windows are retained in the processing pipeline:

- Recent 20-year window: 2000-2019
- Recent 30-year window: 1990-2019

The figures in the main text use the recent 20-year window. The long-term baseline for this window is 1950-1999. For each variable and grid cell, the recent-window mean was compared with the baseline mean, and the anomaly was standardized by an effective baseline standard deviation to obtain a z-score.

## Sparse-Variable Handling

Several water-use and abstraction variables are spatially sparse because large regions have values close to zero. A direct z-score can be misleading in such regions: a small absolute change divided by an extremely small baseline variance can produce an artificially large standardized anomaly.

To reduce this artifact, sparse variables are evaluated within an effective evidence domain. A variable is classified as spatially sparse when its global active share falls below 35%. For sparse variables, grid cells below the 60th percentile of positive magnitude values are excluded from evidence evaluation, and the z-score denominator is regularized using a practical standard-deviation floor equal to 50% of the 75th percentile of positive magnitude values.

Non-sparse variables retain the full global domain and use a global lower bound on baseline standard deviation to avoid unstable division by near-zero variance. Figure S1 shows the variable-level imbalance evidence and recent 20-year mean context for representative variables.

![Figure S1. Variable-level imbalance evidence and recent 20-year mean analysis.](figS02_variable_imbalance_means.png)

The same effective-domain rule was applied to the human-water-use variables. Figure S2 shows the sectoral withdrawal variables used to define human-activity evidence, with recent 20-year mean intensity on the left and recent imbalance evidence on the right.

![Figure S2. Human water-use variable groups used to define core activity regions.](figS01_human_activity_variables.png)

To summarize human-water-use exposure at catchment scale, we classified HydroBASINS level-4 catchments from grid-cell composition rather than catchment-mean component shares. A grid cell is active when at least one of the four withdrawal variables has a recent 20-year mean of at least 0.1 mm day-1. Within active cells, the dominant withdrawal type is assigned when its share exceeds 50%; otherwise a two-type class is assigned when the second type exceeds 25%, and remaining cells are retained as top-led mixed withdrawals. A catchment is shown when active cells occupy at least 10% of catchment area. Catchment colors are then assigned from the active-cell type proportions using the same 50% and 25% thresholds. Diagonal hatching marks catchments with heterogeneous active-cell composition, measured by a consistency index across cell types.

![Figure S3. Catchment-scale classification of dominant human water-use influence.](fig01_human_water_use_catchment_classification.png)

## Catchment-Scale Water Imbalance

Figure 2 classifies each catchment from annual time series of potential total water withdrawal, groundwater storage, and reconstructed absolute glacier storage. For each variable, the recent 20-year mean for 1997-2016 is compared with the historical period 1962-1996. A variable is classified as imbalanced when the absolute recent-minus-historical mean difference exceeds both the historical standard deviation and 1 mm.

The map color represents the combination of variables satisfying this rule. The eight possible classes are no detected imbalance, the three single-variable classes, the three two-variable combinations, and imbalance in all three variables. Gold boundaries independently identify human-impacted catchments using the sectoral-withdrawal activity rule; the boundary does not alter the water-imbalance class.

![Figure 2. Catchment-scale water imbalance classified from total water withdrawal, groundwater storage, and glacier storage.](fig02_water_cycle_imbalance.png)

## Literature Basis for Human-Activity Interpretation

The human-activity interpretation follows previous modeling and attribution studies showing that irrigation, groundwater abstraction, reservoir regulation, and other water-use activities can alter land-surface fluxes, groundwater storage, and streamflow independently of climate forcing. Tang et al. showed that representing partial irrigation and irrigation-induced runoff redistribution can increase evapotranspiration and reduce runoff in hydrological simulations, including a simulated 41% streamflow decrease in the Yellow River basin due to irrigation effects ([Tang et al., 2007](https://doi.org/10.1175/JHM589.1)). Global and regional CLM experiments further demonstrated that irrigation can deplete surface-water resources or groundwater depending on the assumed source, and that groundwater-fed irrigation produces strong subsurface impacts in water-stressed regions ([Leng et al., 2015](https://doi.org/10.1002/2015MS000437); [Leng et al., 2014](https://doi.org/10.1007/s10113-014-0640-x)).

Independent attribution work also supports the need to distinguish human-water-use exposure from hydrological response. In the Yellow River basin, Budyko-based attribution and hydrological-model comparison showed that human activities dominated the post-1980s decline in average, low-, and high-flow signatures, with human contributions commonly exceeding 50% and reaching about 90% in downstream reaches ([Wang et al., 2020](https://doi.org/10.1016/j.jhydrol.2020.125460)). Groundwater-process representation has also been shown to improve simulations of terrestrial water storage when evaluated against GRACE observations, supporting the inclusion of groundwater storage as a key response variable ([Huang et al., 2019](https://doi.org/10.1002/hyp.13393)). Broader reviews emphasize that the water cycle should be interpreted as a coupled climate-human system rather than a purely natural precipitation-runoff response ([Yang et al., 2021](https://doi.org/10.1016/j.geosus.2021.05.003); [Tang and Chen, 2025](https://doi.org/10.1360/SSTe-2025-0078)).

## Regional Focus Masks

For regional comparisons, potential irrigation water withdrawals define the reference focus windows. These focus windows are drawn as simple geometric masks over major irrigation regions. The same masks are applied to all three variables, so potential evapotranspiration and groundwater storage remain comparable to the irrigation-demand reference area while non-focus mesh cells are still visible under a grey overlay.

This design avoids suppressing non-focus information entirely: all mesh values are plotted, but the focus windows guide interpretation toward the irrigation-relevant regional domain.

# Results

## Regional Imbalance Patterns

Figure 1 presents regional imbalance patterns for four major irrigation regions: South Asia, the Middle East, East Asia, and Europe. Each row compares potential irrigation water withdrawals, potential evapotranspiration, and groundwater storage using the same z-score color scale and the same regional focus mask across variables.

![Figure 1. Regional imbalance patterns for major irrigation regions.](figS03_regional_imbalance.png)

The regional comparison reveals distinct imbalance signatures across different hydroclimatic and water-use contexts.

**South Asia (Indus-Ganges).** Potential irrigation water withdrawals show widespread positive anomalies across the Indian subcontinent and the lower Ganges-Brahmaputra region. Groundwater storage shows strong negative anomalies in several of the same focus windows, indicating that irrigation-demand changes and subsurface storage stress are spatially connected but not identical. Potential evapotranspiration provides climatic-demand context across the same regional domain.

**Middle East (Tigris-Euphrates).** Irrigation-related anomalies are concentrated in the Tigris-Euphrates corridor and adjacent agricultural regions. Groundwater storage displays pronounced negative anomalies across parts of the focus domain, while potential evapotranspiration highlights the broader arid-region evaporative-demand background.

**East Asia (North China Plain).** The East Asian focus windows isolate the North China Plain and an inland anomaly belt. Groundwater storage shows strong negative anomalies over the eastern focus window, consistent with storage pressure in intensively cultivated areas. Potential evapotranspiration varies across the broader region and is interpreted relative to the same focus geometry.

**Europe (Southern and Eastern Europe).** The European focus window follows the Mediterranean and southern European agricultural belt. Irrigation and evaporative-demand anomalies are more spatially localized than in South Asia or the Middle East, while groundwater storage shows heterogeneous responses across western, central, and eastern Mediterranean sectors.

Together, these regional panels show that irrigation-demand anomalies, atmospheric evaporative demand, and groundwater-storage responses are related but not interchangeable. The shared focus masks allow the three variables to be compared within the same irrigation-relevant regional domains while preserving the surrounding mesh context.
