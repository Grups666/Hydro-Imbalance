# Water-Cycle Imbalance

- Historical period: 1962-1996.
- Recent 20-year period: 1997-2016.
- Variable imbalance rule: absolute recent-minus-historical mean difference exceeds both the historical standard deviation and 1 mm.
- Catchment class: combination of imbalanced net water-demand deficit, groundwater storage, and glacier storage variables.
- Net water-demand deficit: max(0, potential total withdrawal + environmental-flow requirement - naturalized runoff availability), aggregated monthly to annual basin means.
- Human-impacted boundary: WaterGAP 2.2d `ptotww` cells with recent mean total withdrawal >= 0.10 mm/day occupy >= 10% of catchment area.
- Human-impacted catchments outlined in gold: 412.

| Class | Catchment count | Color |
|---|---:|---|
| No detected imbalance | 634 | `#eef2f7` |
| Water-demand deficit | 203 | `#e3b23c` |
| Groundwater storage | 104 | `#c767b1` |
| Glacier storage | 102 | `#2fb7c8` |
| Deficit + groundwater | 156 | `#d85f55` |
| Deficit + glacier | 48 | `#66b95a` |
| Groundwater + glacier | 17 | `#4f7fd5` |
| All three variables | 11 | `#3f4652` |
