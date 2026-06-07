# Literature Update: Water-cycle Modes and Imbalance Papers

Date: 2026-05-24

## Scope

This update expands the local literature catalog to 2,851 records for the configured hydrology regions and mode-level full-basin coverage:

- High Plains / Ogallala
- California Central Valley
- Indus / Northwest India
- Ganges-Brahmaputra Plain
- North China Plain
- Yellow River Basin
- Tigris-Euphrates-Western Iran
- Aral Sea / Amu Darya-Syr Darya
- Lower Mekong
- Nile Basin
- Murray-Darling Basin

The requested phrase "all papers" is operationalized here as a systematic core corpus covering the major mechanisms of basin water-cycle modes and water-cycle imbalance. A literal exhaustive corpus should be handled as an ongoing bibliometric ingestion workflow, because new papers are published continuously and database coverage differs across Web of Science, Scopus, OpenAlex, Crossref, Semantic Scholar, and publisher APIs.

## Inclusion Criteria

- Strong link to the region's configured water-cycle mode or water-cycle imbalance mechanism.
- Published in a high-quality journal, recorded locally as `Q1`.
- Metadata includes title, authors, major affiliations, year, venue, DOI/link, region relevance, and a concise abstract-style summary.
- Preference for Nature-family journals, PNAS, Water Resources Research, Journal of Hydrology, Geophysical Research Letters, Hydrology and Earth System Sciences, and comparable Earth-system journals.

## Mechanism Coverage

- Groundwater depletion and groundwater footprint.
- Irrigation expansion, non-renewable groundwater use, and agricultural water dependence.
- GRACE/GRACE-FO terrestrial water storage decline.
- Monsoon recharge, floodplain storage, and river-aquifer exchange.
- Reservoir regulation, hydropower operations, and intra-annual flow redistribution.
- Terminal lake desiccation and irrigation diversion.
- Drought propagation, megadrought, and hydrologic non-stationarity.
- Transboundary allocation and cooperative reservoir operation.
- Ecological flow limits, sediment-budget disturbance, and downstream ecosystem impacts.

## Local Files Updated

- `catalog/literature/reference-catalog.js`
- `catalog/literature/schema.json`
- `catalog/regions/basin-profiles.js`
- `public/app.js`
- `scripts/validate/validate-catalog.js`
- `scripts/ingest/harvest-openalex-literature.js`
- `data/literature/openalex-harvest.json`

## OpenAlex Harvest Summary

- Existing curated records before harvest: 94.
- OpenAlex candidate records retrieved: 6,081.
- New deduplicated records added: 2,757.
- Final local literature catalog: 2,851 records.

Mode-level harvested records:

- `dryIrrigation`: 724
- `reservoir`: 477
- `monsoon`: 315
- `dryNatural`: 219
- `tropical`: 206
- `boreal`: 186
- `humid`: 181
- `snow`: 151
- `mountain`: 114
- `mixed`: 94
- `lowHumanImpact`: 90

## Next Steps

For an exhaustive paper inventory, the next version should add an ingestion workflow:

1. Define search queries per basin and per mechanism.
2. Query OpenAlex/Crossref/Semantic Scholar APIs.
3. Deduplicate by DOI.
4. Store raw API metadata under `data/raw/literature/` or an external artifact store.
5. Manually screen relevance and journal quality.
6. Promote screened records into `catalog/literature/reference-catalog.js`.
