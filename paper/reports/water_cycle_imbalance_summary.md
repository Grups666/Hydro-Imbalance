# Water-Cycle Imbalance

- Historical period: 1962-1996.
- Recent 20-year period: 1997-2016.
- Variable imbalance rule: absolute recent-minus-historical mean difference exceeds both 2 historical standard deviations and 1 mm.
- Basin class: combination of imbalanced water-demand deficit, groundwater storage, and glacier storage variables.
- Water-demand deficit: max(0, potential total withdrawal + environmental-flow requirement - naturalized runoff availability), aggregated monthly to annual basin means.
- Human-impacted boundary: WaterGAP 2.2d `ptotww` cells with recent mean total withdrawal >= 0.10 mm/day occupy >= 10% of basin area.
- Human-impacted basins outlined in slate gray: 190.

| Class | Basin count | Color |
|---|---:|---|
| No detected imbalance | 335 | `#eef2f7` |
| Water-demand deficit | 52 | `#e3b23c` |
| Groundwater storage | 28 | `#c767b1` |
| Glacier storage | 64 | `#2fb7c8` |
| Deficit + groundwater | 24 | `#d85f55` |
| Deficit + glacier | 11 | `#66b95a` |
| Groundwater + glacier | 4 | `#4f7fd5` |
| All three variables | 2 | `#3f4652` |
