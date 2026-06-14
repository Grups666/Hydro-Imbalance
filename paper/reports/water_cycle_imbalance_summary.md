# Water-Cycle Imbalance

- Historical period: 1962-1996.
- Recent 20-year period: 1997-2016.
- Variable imbalance rule: absolute recent-minus-historical mean difference exceeds both 2 historical standard deviations and 1 mm.
- Catchment class: combination of imbalanced net water-demand deficit, groundwater storage, and glacier storage variables.
- Net water-demand deficit: max(0, potential total withdrawal + environmental-flow requirement - naturalized runoff availability), aggregated monthly to annual basin means.
- Human-impacted boundary: WaterGAP 2.2d `ptotww` cells with recent mean total withdrawal >= 0.10 mm/day occupy >= 10% of catchment area.
- Human-impacted catchments outlined in gold: 412.

| Class | Catchment count | Color |
|---|---:|---|
| No detected imbalance | 851 | `#eef2f7` |
| Water-demand deficit | 87 | `#e3b23c` |
| Groundwater storage | 73 | `#c767b1` |
| Glacier storage | 143 | `#2fb7c8` |
| Deficit + groundwater | 87 | `#d85f55` |
| Deficit + glacier | 21 | `#66b95a` |
| Groundwater + glacier | 8 | `#4f7fd5` |
| All three variables | 5 | `#3f4652` |
