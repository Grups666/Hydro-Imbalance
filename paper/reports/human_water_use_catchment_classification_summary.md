# Human Water-Use Basin Classification

- Active cell rule: a grid cell is active when at least one of pirrww, pelecww, pmanww, pdomww has recent 20-year mean withdrawal >= 0.10 mm/day.
- Affected basin rule: active-cell area fraction >= 10%.
- Cell-level class rule: after values below 0.10 mm/day are set to zero, the top withdrawal type is single-dominant if its share is >= 50%; otherwise the top two types are combined when the second type share is >= 25%; remaining cells are recorded as top-led mixed.
- Basin consistency index: sqrt(sum(p_k^2)), where p_k is the active-cell area share of cell withdrawal type k.
- Hatching rule: basins with consistency index < 0.95 are hatched as heterogeneous withdrawal-composition basins.
- Basin class rule: inactive cells are removed, then the dominant active-cell type is used when its share is >= 50%; otherwise the top two cell types are combined when the second share is >= 25%; remaining basins are recorded as top-led mixed.
- Consistency-index distribution among affected basins: P10=0.714, P25=0.848, median=1.000, P75=1.000, P90=1.000.
- Composition counts: coherent = 96, heterogeneous = 56.

| Class | Label | Basin count |
|---|---|---:|
| irrigation | Irrigation dominant | 111 |
| electricity | Electricity dominant | 26 |
| domestic | Domestic dominant | 5 |
| irrigation+electricity | Irrigation + Electricity | 3 |
| basin_mixed_electricity | Electricity-led mixed basin | 2 |
| manufacturing | Manufacturing dominant | 2 |
| basin_mixed_manufacturing | Manufacturing-led mixed basin | 1 |
| irrigation+manufacturing | Irrigation + Manufacturing | 1 |
| manufacturing+domestic | Manufacturing + Domestic | 1 |
