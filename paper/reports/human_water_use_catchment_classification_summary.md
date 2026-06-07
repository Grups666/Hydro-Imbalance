# Human Water-Use Catchment Classification

- Active cell rule: a grid cell is active when at least one of pirrww, pelecww, pmanww, pdomww has recent 20-year mean withdrawal >= 0.10 mm/day.
- Affected catchment rule: active-cell area fraction >= 10%.
- Cell-level class rule: after values below 0.10 mm/day are set to zero, the top withdrawal type is single-dominant if its share is >= 50%; otherwise the top two types are combined when the second type share is >= 25%; remaining cells are recorded as top-led mixed.
- Catchment consistency index: sqrt(sum(p_k^2)), where p_k is the active-cell area share of cell withdrawal type k.
- Hatching rule: catchments with consistency index < 0.95 are hatched as heterogeneous withdrawal-composition catchments.
- Catchment class rule: inactive cells are removed, then the dominant active-cell type is used when its share is >= 50%; otherwise the top two cell types are combined when the second share is >= 25%; remaining catchments are recorded as top-led mixed.
- Consistency-index distribution among affected catchments: P10=0.744, P25=0.842, median=1.000, P75=1.000, P90=1.000.
- Composition counts: coherent = 220, heterogeneous = 133.

| Class | Label | Catchment count |
|---|---|---:|
| irrigation | Irrigation dominant | 268 |
| electricity | Electricity dominant | 57 |
| domestic | Domestic dominant | 12 |
| electricity+domestic | Electricity + Domestic | 4 |
| irrigation+electricity | Irrigation + Electricity | 3 |
| manufacturing | Manufacturing dominant | 3 |
| manufacturing+domestic | Manufacturing + Domestic | 2 |
| catchment_mixed_electricity | Electricity-led mixed catchment | 1 |
| catchment_mixed_irrigation | Irrigation-led mixed catchment | 1 |
| electricity+manufacturing | Electricity + Manufacturing | 1 |
| irrigation+manufacturing | Irrigation + Manufacturing | 1 |
