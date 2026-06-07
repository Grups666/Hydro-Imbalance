# Full Basin Mode Coverage

Date: 2026-05-24

## Current Basin Inventory

The current frontend basin dataset is HydroBASINS Level 4:

- Total basins: 1121
- Asia: 192
- Europe: 234
- Africa: 242
- North America: 178
- South America: 144
- Australia/Oceania: 131

## Design Decision

The atlas should not attach papers only to the 11 highlighted case-study regions. All 1121 basins need a research entry point.

This is implemented through three tiers:

1. Basin-specific references
   - Used for highlighted regions such as High Plains, Central Valley, North China Plain, Yellow River, Mekong, Nile, and Murray-Darling.

2. Mode-level references
   - Used for every non-highlighted basin.
   - References are attached to inferred hydrological modes such as snow, monsoon, humid, tropical, boreal, dry natural, mountain, low human impact, dry irrigation, and reservoir-regulated systems.

3. Global concept references
   - Used as fallback literature for mixed or uncertain basins.
   - Covers stationarity, water-cycle intensification, global groundwater depletion, river stressors, and global freshwater storage change.

## Mode Classes

- `snow`: Snow and glacier melt dominant.
- `monsoon`: Monsoon floodplain recharge.
- `dryIrrigation`: Arid irrigation and groundwater dependent.
- `reservoir`: Reservoir regulation and flow redistribution.
- `humid`: Humid runoff dominant.
- `tropical`: Tropical high-runoff forest basin.
- `boreal`: Boreal snowmelt and wetland storage.
- `dryNatural`: Natural dryland ephemeral flow.
- `mountain`: Mountain orographic runoff.
- `lowHumanImpact`: Low human-impact natural basin.
- `managed`: Managed recovery or external transfer.
- `mixed`: Mixed or weak diagnosis.

## Important Caveat

The current classifier is rule-based and uses basin centroid, broad region, latitude, longitude, area, and highlighted-region overrides. It is a prototype coverage layer, not a final scientific attribution model.

Future versions should replace or augment it with pressure and climate indicators:

- Aridity index.
- Snow fraction and glacier fraction.
- Dam density and reservoir storage.
- Irrigated area fraction.
- Groundwater withdrawal intensity.
- Population density.
- Land-cover change.
- GRACE/GRACE-FO TWS trend.
- Runoff seasonality and flow regulation metrics.
