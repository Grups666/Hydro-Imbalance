# Supplementary Methods

## S1. Variable overlap between flux and extremity dimensions

Some WaterGAP variables are used in more than one diagnostic dimension. This is intentional. The diagnostic dimension is defined by the statistic being evaluated, not only by the source variable.

Flux anomaly uses the baseline-relative departure of the mean state. For a source variable such as precipitation, flux anomaly evaluates whether the recent-window mean precipitation has departed from its long-term baseline mean.

Extremity anomaly uses tail, variability, or transition-oriented statistics. For precipitation, this may represent unusually high precipitation tendency. For soil moisture or runoff, it may represent dry-state tendency or rapid dry-wet transition risk. In the current implementation, extremity anomaly is treated as a proxy dimension because the available WaterGAP outputs do not directly provide all event-based indicators such as flash drought frequency or sub-monthly rainfall intensity.

The distinction can be summarized as:

```
same source variable + mean statistic      -> flux or storage anomaly
same source variable + tail/risk statistic -> extremity anomaly
```

This avoids treating the same variable twice for the same evidence. A repeated variable enters different dimensions only when it supports a different hydrological question.

## S2. WaterGAP variables and dimensions

The analysis processed 44 hydrological variables from WaterGAP2-2e. Table S1 lists all variables with their assigned diagnostic dimensions and temporal resolution.

**Table S1. WaterGAP variables used in the diagnostic framework.**

| Variable code | English label | Unit | Temporal resolution | Diagnostic dimension |
|---|---|---|---|---|
| qtot | Total Runoff | kg m-2 s-1 | monthly | flux, extremity |
| evap-total | Evapotranspiration | kg m-2 s-1 | monthly | flux, extremity |
| potevap | Potential Evapotranspiration | kg m-2 s-1 | monthly | flux, extremity |
| qsb | Subsurface Runoff | kg m-2 s-1 | monthly | flux |
| qs | Fast Surface And Fast Subsurface Runoff | kg m-2 s-1 | monthly | flux |
| qr | Total Groundwater Recharge | kg m-2 s-1 | monthly | flux |
| qg | Groundwater Discharge | kg m-2 s-1 | monthly | flux |
| qrd | Diffuse Groundwater Recharge | kg m-2 s-1 | monthly | flux |
| qrf | Focussed/localised Groundwater Recharge | kg m-2 s-1 | monthly | flux |
| dis | Streamflow | m3 s-1 | monthly | flux, extremity |
| tws | Total Water Storage | kg m-2 | monthly | storage |
| groundwstor | Groundwater Storage | kg m-2 | monthly | storage |
| soilmoist | Soil Water Storage | kg m-2 | monthly | storage, extremity |
| swe | Snow Water Storage | kg m-2 | monthly | storage |
| canopystor | Canopy Water Storage | kg m-2 | monthly | storage |
| riverstor | River Storage | kg m-2 | monthly | storage |
| reservoirstor | Reservoir Storage | kg m-2 | monthly | storage |
| lakestor | Lake Water Storage | kg m-2 | monthly | storage |
| wetlandstor | Wetland Water Storage | kg m-2 | monthly | storage |
| pirrww | Potential Irrigation Water Withdrawals | kg m-2 s-1 | monthly | demand-function |
| pirruse | Potential Irrigation Consumptive Water Use | kg m-2 s-1 | monthly | demand-function |
| pirrwwgw | Potential Irrigation Water Withdrawal (assuming Unlimited Water Supply) From Groundwater Resources | kg m-2 s-1 | monthly | demand-function |
| pirrusegw | Potential Irrigation Water Consumption From Groundwater Resources | kg m-2 s-1 | monthly | demand-function |
| pdomww | Potential Domestic Water Withdrawals | kg m-2 s-1 | monthly | demand-function |
| pdomuse | Potential Domestic Consumptive Water Use | kg m-2 s-1 | monthly | demand-function |
| pdomwwgw | Potential Domestic Water Withdrawal From Groundwater Resources | kg m-2 s-1 | monthly | demand-function |
| pdomusegw | Potential Domestic Water Consumption From Groundwater Resources | kg m-2 s-1 | monthly | demand-function |
| pmanww | Potential Manufacturing Water Withdrawal | kg m-2 s-1 | monthly | demand-function |
| pmanuse | Potential Manufacturing Water Consumption | kg m-2 s-1 | monthly | demand-function |
| pmanwwgw | Potential Manufacturing Water Withdrawal From Groundwater Resources | kg m-2 s-1 | monthly | demand-function |
| pmanusegw | Potential Manufacturing Water Consumption From Groundwater Resources | kg m-2 s-1 | monthly | demand-function |
| pliveww | Potential Livestock Water Withdrawal | kg m-2 s-1 | monthly | demand-function |
| pliveuse | Potential Livestock Water Consumption | kg m-2 s-1 | monthly | demand-function |
| pelecww | Potential Electricity Water Withdrawal | kg m-2 s-1 | monthly | demand-function |
| pelecuse | Potential Electricity Water Consumption | kg m-2 s-1 | monthly | demand-function |
| ptotww | Potential Total Water Withdrawals | kg m-2 s-1 | monthly | demand-function |
| ptotuse | Potential Total Consumptive Water Use | kg m-2 s-1 | monthly | demand-function |
| ptotwwgw | Total Potential Water Withdrawal (all Sectors) From Groundwater Resources | kg m-2 s-1 | monthly | demand-function |
| ptotusegw | Total Potential Water Consumption (all Sectors) From Groundwater Resources | kg m-2 s-1 | monthly | demand-function |
| atotuse | Actual Consumptive Water Use | kg m-2 s-1 | monthly | demand-function |
| atotusegw | Total Actual Water Consumption (all Sectors) From Groundwater Resources | kg m-2 s-1 | monthly | demand-function |
| snm | Snow Melt | kg m-2 s-1 | monthly | context |
| triver | River Water Temperature | K | monthly | flux |
| lai-total | Leaf Area Index | 1 | monthly | context |


Variables assigned to multiple dimensions contribute different statistics to each dimension. For example, runoff contributes its mean-state anomaly to flux anomaly and soil moisture contributes to land-water stress diagnostics.

## S3. Mean-state anomaly equations

For a variable `v`, grid cell `i`, and selected recent window `W`, the baseline mean, recent mean, and baseline standard deviation are:

```
μ_base(v,i) = mean(x(v,i,t)), for t ∈ T_base
```

```
μ_recent(v,i) = mean(x(v,i,t)), for t ∈ T_recent
```

```
σ_base(v,i) = sd(x(v,i,t)), for t ∈ T_base
```

where `T_base` is the baseline period (1950 to year before recent window) and `T_recent` is the recent window (2000-2019 for 20-year window, 1990-2019 for 30-year window).

The raw anomaly is:

```
Δ(v,i) = μ_recent(v,i) - μ_base(v,i)
```

## S4. Effective evidence domain

For each variable and grid cell, the activity magnitude is defined as the maximum absolute value of baseline and recent means:

```
M(v,i) = max(|μ_base(v,i)|, |μ_recent(v,i)|)
```

The global active share of a variable is the fraction of grid cells with non-zero magnitude:

```
A(v) = N(M(v,i) > 0) / N(M(v,i) is finite)
```

A variable is treated as spatially sparse when:

```
A(v) < 0.35
```

The 35% threshold was chosen empirically to distinguish variables with concentrated spatial activity (e.g., irrigation withdrawals, industrial water use) from variables with widespread activity (e.g., precipitation, evapotranspiration).

### S4.1 Sparse variable thresholds

For sparse variables, two thresholds are computed from the distribution of positive magnitude values:

**Activity floor** (60th percentile of positive magnitudes):

```
F_act(v) = P₆₀(M(v,i) | M(v,i) > 0)
```

Only grid cells satisfying the following condition are retained as evidence for that sparse variable:

```
M(v,i) ≥ F_act(v)
```

The 60th percentile was chosen to exclude the lower tail of marginally active cells while retaining the majority of cells with meaningful activity.

**Practical standard-deviation floor** (50% of 75th percentile of positive magnitudes):

```
F_std_practical(v) = 0.5 × P₇₅(M(v,i) | M(v,i) > 0)
```

The 75th percentile and 0.5 multiplier were chosen to provide a robust minimum standard deviation that reflects the typical magnitude scale of the variable in active regions.

### S4.2 Global standard-deviation floor

For all variables (sparse and non-sparse), a global standard-deviation floor prevents unstable amplification in near-zero-variance cells:

```
F_std_global(v) = P₅(σ_base(v,i) | σ_base(v,i) > 0)
```

The 5th percentile was chosen to regularize only the lowest tail of baseline variances while preserving the relative scaling for most cells.

### S4.3 Effective standard deviation

The effective standard deviation combines all applicable floors:

```
σ_eff(v,i) = max(σ_base(v,i), F_std_global(v), F_std_practical(v))
```

For non-sparse variables, `F_std_practical(v) = 0` and no activity-floor masking is applied.

### S4.4 Final standardized anomaly

The final standardized anomaly (z-score) is:

```
z(v,i) = Δ(v,i) / σ_eff(v,i)
```

For sparse variables, grid cells with `M(v,i) < F_act(v)` are excluded from evidence evaluation and assigned `z(v,i) = NaN`.

## S5. Pixel-level score aggregation

Each valid z-score is converted to a bounded 0-100 score:

```
S(v,i) = min(|z(v,i)| / 3, 1) × 100
```

The 3-sigma clipping threshold prevents isolated extreme values from dominating the score distribution. Under this transformation, z-scores of 1, 2, and 3 correspond to scores of approximately 33, 67, and 100, respectively.

For diagnostic dimension `d`, the dimension score is the maximum of all valid variable scores assigned to that dimension:

```
S(d,i) = max(S(v,i)), for v ∈ V(d)
```

where `V(d)` is the set of variables assigned to dimension `d`.

The integrated imbalance score is the mean of the four dimension scores:

```
S_imbalance(i) = mean(S_flux(i), S_storage(i), S_extreme(i), S_demand_function(i))
```

Only valid variable scores are included in the dimension-level maximum, and only valid dimension scores are included in the integrated mean. The maximum-evidence rule was used at the dimension level because a hydrological dimension can be meaningfully abnormal when one of its representative variables provides strong evidence, even if other variables assigned to the same dimension are weak or locally irrelevant.

## S6. Threshold conversion

The integrated diagnostic summaries use a fixed significant-imbalance threshold of 50 on the 0-100 score scale. This corresponds to a 1.5-sigma anomaly because the score scale clips 3 sigma to 100:

```
S* = (1.5 / 3) × 100 = 50
```

The threshold is used for summary quantities such as significant-area fraction. It does not replace the continuous score field used in the maps.

## S7. Catchment aggregation

For a catchment `c`, let `I(c)` be the set of valid grid cells whose centers fall inside the catchment polygon. The catchment-level score is:

```
S(c) = mean(S(i)), for i ∈ I(c)
```

where `S(i)` can represent the integrated imbalance score or one of the four dimension scores.

For variable evidence within a catchment:

```
S(v,c) = mean(S(v,i)), for i ∈ I(c)
```

**Example**: If a catchment contains five grid cells with integrated scores of 70, 60, 80, invalid, and 50:

```
S(c) = (70 + 60 + 80 + 50) / 4 = 65
```

Under a 1.5-sigma threshold (score ≥ 50), this catchment is classified as significantly imbalanced because `65 ≥ 50`.

## S8. Methodological safeguards

The method includes three safeguards against over-interpretation:

1. **Sparse variable masking**: Variables with concentrated spatial activity are evaluated only within their effective evidence domains, excluding cells with negligible activity.

2. **Standard-deviation regularization**: Extremely small baseline standard deviations are regularized using global (5th percentile) and practical (sparse variables only) standard-deviation floors.

3. **Z-score clipping**: Z-score magnitudes are clipped at 3 sigma before conversion to 0-100 scores.

Together, these safeguards reduce false imbalance signals caused by near-zero values, unstable variance, or isolated extreme z-scores, while preserving interpretable evidence at both grid-cell and catchment scales.

## S9. Human-water-use activity groups and aggregation

Human-water-use exposure was evaluated after screening the available WaterGAP water-use variables by absolute magnitude. All withdrawal and consumptive-use fluxes are reported by WaterGAP in kg m-2 s-1. For human-water-use figures and thresholding, these fluxes were converted to mm day-1 using:

```
1 kg m-2 s-1 = 86400 mm day-1
```

The activity-variable figure uses sectoral withdrawal variables rather than consumptive-use variables or source-specific groundwater subsets. This keeps the comparison on a consistent withdrawal basis across the main human water-use sectors.

**Table S2. Human-water-use groups used to define core activity regions.**

| Group | Variables |
|---|---|
| Irrigation | Potential Irrigation Water Withdrawals |
| Electricity | Potential Electricity Water Withdrawal |
| Manufacturing | Potential Manufacturing Water Withdrawal |
| Domestic | Potential Domestic Water Withdrawals |

For each sectoral withdrawal variable `v`, the signed imbalance anomaly is:

```
z_v(i)
```

Only valid variable-level z-scores after effective-domain filtering are eligible. Therefore, grid cells with negligible long-term and recent activity for a sparse water-use variable do not contribute to the anomaly map.

The left column of the activity-variable figure shows recent 20-year mean withdrawal intensity:

```
M_recent_v(i) = |mu_recent(v, i)|
```

`M_recent_v` is converted to mm day-1 in the figure colorbar. This map is used for visual context only. It shows where each retained human-water-use variable has meaningful recent activity.

Human-water-use regions were defined from recent activity magnitude rather than standardized anomaly. For catchment classification, each sectoral withdrawal variable was screened directly at grid-cell scale:

```
M_recent_v(i) >= 0.1 mm day-1
```

This fixed magnitude threshold was used to avoid assigning human-water-use composition to cells where all sectoral withdrawals are negligible in absolute terms.

## S9.1 Catchment-scale human-water-use classification

A separate global map classifies HydroBASINS level-4 catchments by dominant human-water-use influence. The catchment screening uses recent 20-year mean withdrawals from four sectoral withdrawal variables to decide whether each grid cell and catchment are sufficiently affected by human water use to be shown. The activity-type class is then assigned from grid-cell composition inside the catchment rather than from catchment-mean component shares.

For grid cell `i`, each sectoral withdrawal variable is first converted to mm day-1 and screened independently:

```
W_v(i) = 0, if W_v(i) < 0.1 mm day-1
```

where `v` represents potential irrigation, domestic, electricity, or manufacturing water withdrawal. A grid cell is treated as active when at least one screened sector remains positive. For active cells, the sectoral shares are calculated from the screened recent 20-year means:

```
p_v(i) = W_v(i) / sum_v W_v(i)
```

The cell-level withdrawal type is assigned by the following rules. If the largest sectoral share is at least 0.50, the cell is assigned to that single sector. If the largest share is below 0.50 and the second-largest share is at least 0.25, the cell is assigned to the two-sector combination. Remaining active cells are assigned to a top-led mixed class, retaining the leading sector in the label.

For catchment `c`, the active-area fraction is the area-weighted share of catchment cells satisfying the active-cell rule. A catchment is plotted when:

```
active_area_fraction(c) >= 0.10
```

This second threshold removes catchments where human withdrawals occur in only a very small part of the catchment. For retained catchments, inactive cells are removed before classifying catchment water-use composition. The area share of each active-cell withdrawal type is:

```
P_k(c) = area(type k active cells in c) / area(all active cells in c)
```

The catchment consistency index is:

```
C(c) = sqrt(sum_k P_k(c)^2)
```

High values indicate that one active-cell withdrawal type dominates the catchment; lower values indicate more heterogeneous within-catchment composition. Diagonal hatching marks catchments with `C(c) < 0.95`.

The catchment water-use class is assigned from the active-cell type proportions using the same 0.50 and 0.25 thresholds. If the largest active-cell type share is at least 0.50, the catchment is assigned to that dominant type. If the largest share is below 0.50 and the second-largest share is at least 0.25, the catchment is assigned to the top-two combination. Remaining catchments are assigned to a top-led mixed class.

## S10. Catchment-scale water-imbalance classification

Figure 2 uses the unified annual catchment time-series dataset for 1962-2016. Three variables are assessed:

- Net water-demand deficit (`net_water_demand_deficit_mm_yr`), in mm yr-1.
- Groundwater storage (`groundwater_storage_mm`), in mm.
- Reconstructed absolute glacier storage (`glacier_storage_mm_we`), in mm water equivalent.

The net water-demand deficit is calculated from WaterGAP 2.2d monthly `ptotww` and naturalized net cell runoff (`ncrunnat`). Natural demand is represented as environmental-flow requirement (EFR), estimated for each grid cell and calendar month as the Q90 exceedance value of naturalized runoff during 1962-1996. In ordinary percentile notation this is the 10th percentile of the monthly naturalized runoff distribution for that calendar month. Monthly deficit is:

```
deficit_flux = max(ptotww + EFR - ncrunnat, 0)
```

Monthly fluxes are converted to depth using calendar month length and summed to annual catchment means.

For each final variable `v` and catchment `c`, the historical mean and population standard deviation are calculated over 1962-1996, and the recent mean is calculated over the recent 20-year period 1997-2016:

```
mu_historical(v,c) = mean(x(v,c,t)), 1962 <= t <= 1996
sigma_historical(v,c) = sd_population(x(v,c,t)), 1962 <= t <= 1996
mu_recent(v,c) = mean(x(v,c,t)), 1997 <= t <= 2016
delta(v,c) = mu_recent(v,c) - mu_historical(v,c)
```

A variable is classified as imbalanced when:

```
abs(delta(v,c)) > 2 sigma_historical(v,c)
AND
abs(delta(v,c)) > 1 mm
```

The catchment class is the set of variables satisfying this rule. This produces eight classes: no detected imbalance, three single-variable classes, three two-variable combinations, and imbalance in all three variables.

Human-impacted catchments are annotated independently using WaterGAP 2.2d total-withdrawal activity. A slate-gray boundary marks catchments where cells with recent mean `ptotww` of at least 0.1 mm day-1 occupy at least 10% of catchment area. This boundary is contextual and does not modify the three-variable imbalance classification.

## S11. Figure S1: Variable-level imbalance evidence

Figure S1 presents the variable-level imbalance evidence and recent 20-year mean analysis for five representative variables:

1. **Actual Evapotranspiration (evap-total)**: A non-sparse variable with widespread global activity. The full domain is retained, and only the global standard-deviation floor is applied. The z-score map shows regional patterns of positive and negative anomalies.

2. **Groundwater Storage (groundwstor)**: A non-sparse storage variable. The mean map uses a linear scale starting from zero, as storage cannot be negative. The z-score map shows regions with declining or increasing groundwater storage relative to baseline.

3. **Soil Moisture Content (soilmoist)**: A storage variable that shows near-surface water availability and land-atmosphere stress in the recent period.

4. **Snow Water Storage (swe)**: A non-sparse storage variable with high spatial variability. The mean map uses a logarithmic scale to represent the full dynamic range from minimal snow in tropical regions to high snow water equivalent in polar and mountainous regions.

5. **Snow Melt (snm)**: A snow-process flux variable. The mean map is shown in mm day-1 to make the recent 20-year melt intensity directly readable.

The figure demonstrates how the diagnostic framework handles both sparse and non-sparse variables, and how the effective evidence domain prevents false signals in regions with negligible activity for sparse variables.

## S12. Literature support for human-activity interpretation

The catchment-scale water-imbalance classification was designed to be consistent with prior process-based and attribution studies. These studies were not used to tune the thresholds directly; they provide physical interpretation for coupled changes in local water-demand deficit and water storage.

**Table S3. Selected studies supporting the human-activity interpretation.**

| Study | Main evidence used in this manuscript |
|---|---|
| Tang et al. (2007), Journal of Hydrometeorology, DOI: 10.1175/JHM589.1 | Partial irrigation and precipitation heterogeneity alter simulated evapotranspiration and runoff. The study reported strong regional streamflow sensitivity to irrigation representation, supporting the use of irrigation variables as human-water-use exposure. |
| Leng et al. (2014), Regional Environmental Change, DOI: 10.1007/s10113-014-0640-x | North China Plain simulations separated climate and irrigation effects and showed that groundwater-fed irrigation strongly affects groundwater level and soil moisture compared with climate-only perturbations. |
| Leng et al. (2015), Advances in Modeling Earth Systems, DOI: 10.1002/2015MS000437 | Global irrigation experiments compared no-irrigation, surface-water irrigation, and groundwater-pumping irrigation scenarios, showing source-dependent impacts on surface-water and groundwater resources. |
| Huang et al. (2019), Hydrological Processes, DOI: 10.1002/hyp.13393 | Including groundwater representation improved terrestrial water storage simulations when evaluated against GRACE, supporting groundwater storage as a key response indicator. |
| Wang et al. (2020), Journal of Hydrology, DOI: 10.1016/j.jhydrol.2020.125460 | Budyko-based attribution and hydrological-model comparison showed that human activities dominated changes in Yellow River streamflow signatures after the 1980s. |
| Yang et al. (2021), Geography and Sustainability, DOI: 10.1016/j.geosus.2021.05.003 | Review of climate and human impacts on hydrological cycle and water resources, supporting the framing of water-cycle imbalance as coupled climate-human redistribution rather than a single-variable trend. |
| Tang and Chen (2025), Science China Earth Sciences / Bulletin summary, DOI: 10.1360/SSTe-2025-0078 | Review framing global change as intensifying water-cycle imbalance and water-resource risk; used as conceptual support for interpreting multi-variable departures from historical conditions. |

These studies also motivate a key interpretive safeguard in the present analysis: a human-water-use affected catchment is not automatically labeled as groundwater or glacier imbalance. Instead, the label depends on which annual catchment time series satisfy the same recent-versus-historical rule.
