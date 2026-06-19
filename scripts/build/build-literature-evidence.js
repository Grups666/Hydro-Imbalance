#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");
const evidenceVersion = "2026-06-19";
const historicalCenter = (1962 + 1996) / 2;
const recentCenter = (1997 + 2016) / 2;
const windowCenterDeltaYears = recentCenter - historicalCenter;

const modules = [
  {
    moduleId: "water-imbalance",
    basinType: "GRDC Major River Basins",
    dataDir: path.join(root, "public/modules/water-imbalance/data")
  },
  {
    moduleId: "water-imbalance-wmo",
    basinType: "GRDC WMO Basins and Sub-Basins",
    dataDir: path.join(root, "public/modules/water-imbalance-wmo/data")
  }
];

const variableLabels = {
  deficit: "Water-demand deficit",
  groundwater: "Groundwater Storage",
  glacier: "Glacier Storage"
};

const sources = [
  {
    id: "zemp2019-global-glacier",
    variableKey: "glacier",
    scope: "Global glacier mass change",
    title: "Global glacier mass changes and their contributions to sea-level rise from 1961 to 2016",
    authors: "Zemp et al.",
    year: 2019,
    venue: "Nature",
    doi: "10.1038/s41586-019-1071-0",
    url: "https://pubmed.ncbi.nlm.nih.gov/30962533/",
    abstract: "Global extrapolation of glaciological and geodetic observations for 1961-2016, including regional specific mass-change rates.",
    reportedQuantity: {
      label: "Glacier mass change",
      valueText: "1961-2016 sea-level contribution 27 +/- 22 mm; 2006-2016 regional rates -0.1 to -1.2 m w.e. yr-1; global loss 335 +/- 144 Gt yr-1",
      period: "1961-2016, with 2006-2016 regional rates"
    },
    validationType: "direct-rate-order",
    assessment: "Good global benchmark for sign and order of magnitude. Basin values should be compared as window-shift equivalent rates, not exact annual mass-balance observations.",
    riskNote: "If a basin equivalent rate is much below -1.3 m w.e. yr-1, inspect glacier-area normalization and very small glacierized area.",
    appliesTo: (basin, classification) => isImbalanced(classification, "glacier")
  },
  {
    id: "glambie2025-regional-glacier",
    variableKey: "glacier",
    scope: "Regional glacier assessments",
    title: "Community estimate of global glacier mass changes from 2000 to 2023",
    authors: "GlaMBIE Team",
    year: 2025,
    venue: "Nature",
    doi: "10.1038/s41586-024-08545-z",
    url: "https://www.nature.com/articles/s41586-024-08545-z",
    abstract: "Multi-method regional glacier mass-change assessment for 2000-2023, useful for regional order-of-magnitude validation.",
    reportedQuantity: {
      label: "Regional glacier mass balance",
      valueText: "Alaska -0.72, W Canada/USA -0.68, Central Europe -1.06, Central Asia -0.22, South Asia east -0.52, Southern Andes -0.93, New Zealand -0.96 m w.e. yr-1",
      period: "2000-2023"
    },
    validationType: "direct-rate-order",
    assessment: "Strong regional benchmark. Because it emphasizes the accelerated 2000-2023 period, project values can be lower where the 1962-2016 window includes earlier slower losses.",
    riskNote: "New Zealand and some Alps/Himalaya basins are expected to look lower than this recent benchmark; that is a window effect unless the manuscript claims a 2000s-only rate.",
    appliesTo: (basin, classification) => isImbalanced(classification, "glacier")
  },
  {
    id: "hugonnet2021-global-glacier",
    variableKey: "glacier",
    scope: "ASTER 2000-2019 glacier elevation change regions",
    title: "Accelerated global glacier mass loss in the early twenty-first century",
    authors: "Hugonnet et al.",
    year: 2021,
    venue: "Nature",
    doi: "10.1038/s41586-021-03436-z",
    url: "https://www.nature.com/articles/s41586-021-03436-z",
    abstract: "ASTER digital elevation model analysis of global glacier mass changes over 2000-2019.",
    reportedQuantity: {
      label: "Regional glacier mass balance",
      valueText: "Alaska -0.780, W Canada/USA -0.530, High Mountain Asia -0.220, Central Europe -0.860, Southern Andes -0.720, New Zealand -0.720 m w.e. yr-1",
      period: "2000-2019"
    },
    validationType: "direct-rate-order",
    assessment: "Very useful direct m w.e. yr-1 benchmark after converting project storage shifts by the 27.5-year window-center separation.",
    riskNote: "Project values far outside these regional ranges should be checked first for basin-region mismatch and glacierized-area denominator effects.",
    appliesTo: (basin, classification) => isImbalanced(classification, "glacier")
  },
  {
    id: "dussaillant2019-andes-glacier",
    variableKey: "glacier",
    scope: "South American Andes",
    title: "Two decades of glacier mass loss along the Andes",
    authors: "Dussaillant et al.",
    year: 2019,
    venue: "Nature Geoscience",
    doi: "10.1038/s41561-019-0432-5",
    url: "https://www.nature.com/articles/s41561-019-0432-5",
    abstract: "ASTER DEM time series estimate Andean glacier mass changes from 10 degrees N to 56 degrees S.",
    reportedQuantity: {
      label: "Andean glacier mass loss",
      valueText: "-22.9 +/- 5.9 Gt yr-1 (-0.72 +/- 0.22 m w.e. yr-1); Patagonian Andes -0.78 +/- 0.25; Tropical Andes -0.42 +/- 0.24",
      period: "2000-2018"
    },
    validationType: "direct-rate-order",
    assessment: "South American median project values are expected to cluster near -0.7 m w.e. yr-1 after equivalent-rate conversion.",
    riskNote: "Very small basins with tiny glacierized area can exceed the regional rate; flag values below about -1.3 m w.e. yr-1 for inspection.",
    appliesTo: (basin, classification) => isImbalanced(classification, "glacier") && basin.region === "SA"
  },
  {
    id: "brun2017-hma-glacier",
    variableKey: "glacier",
    scope: "High Mountain Asia",
    title: "A spatially resolved estimate of High Mountain Asia glacier mass balances, 2000-2016",
    authors: "Brun et al.",
    year: 2017,
    venue: "Nature Geoscience",
    doi: "10.1038/NGEO2999",
    url: "https://pubmed.ncbi.nlm.nih.gov/28890734/",
    abstract: "Satellite stereo-imagery DEM time series were used to estimate glacier mass balance for about 92% of High Mountain Asia glacierized area.",
    reportedQuantity: {
      label: "High Mountain Asia glacier mass balance",
      valueText: "-16.3 +/- 3.5 Gt yr-1 (-0.18 +/- 0.04 m w.e. yr-1), with strong subregional variability",
      period: "2000-2016"
    },
    validationType: "direct-rate-order",
    assessment: "The project should generally show negative but smaller rates than Alaska/Andes. South Asia east and some Himalaya basins can be more negative than the HMA average.",
    riskNote: "If Himalaya-linked basins remain near zero despite glacier imbalance classification, check regional balance allocation.",
    appliesTo: (basin, classification) => isImbalanced(classification, "glacier") && isHighMountainAsia(basin)
  },
  {
    id: "farinotti2015-tienshan-glacier",
    variableKey: "glacier",
    scope: "Tien Shan",
    title: "Substantial glacier mass loss in the Tien Shan over the past 50 years",
    authors: "Farinotti et al.",
    year: 2015,
    venue: "Nature Geoscience",
    doi: "10.1038/ngeo2513",
    url: "https://www.nature.com/articles/ngeo2513",
    abstract: "Regional reconstruction of Tien Shan glacier mass change over roughly five decades.",
    reportedQuantity: {
      label: "Tien Shan glacier mass loss",
      valueText: "Mass loss 27 +/- 15% over 1961-2012; average loss about 5.4 +/- 2.8 Gt yr-1, roughly -0.3 m w.e. yr-1 by area scaling",
      period: "1961-2012"
    },
    validationType: "derived-rate-order",
    assessment: "Useful Central Asia benchmark; project values around -0.1 to -0.3 m w.e. yr-1 are plausible.",
    riskNote: "The m w.e. conversion depends on the glacier-area denominator, so this should be treated as order-of-magnitude evidence.",
    appliesTo: (basin, classification) => isImbalanced(classification, "glacier") && isTienShanBasin(basin)
  },
  {
    id: "rodell2009-north-india-groundwater",
    variableKey: "groundwater",
    scope: "North India groundwater depletion",
    title: "Satellite-based estimates of groundwater depletion in India",
    authors: "Rodell et al.",
    year: 2009,
    venue: "Nature",
    doi: "10.1038/nature08238",
    url: "https://www.nature.com/articles/nature08238",
    abstract: "GRACE-based groundwater depletion estimate for Rajasthan, Punjab, Haryana and Delhi.",
    reportedQuantity: {
      label: "Groundwater depletion",
      valueText: "4.0 +/- 1.0 cm yr-1 equivalent water height, or 17.7 +/- 4.5 km3 yr-1 over about 438,000 km2",
      period: "2002.8-2008.10"
    },
    validationType: "trend-to-window-shift",
    assessment: "A linear extension of -40 mm yr-1 over the 27.5-year window-center separation implies about -1100 mm. Basin means of a few hundred negative mm are plausible for irrigation hotspots.",
    riskNote: "This is a hotspot, not full-basin coverage; full Ganges/Indus basin means should usually be less negative than the hotspot trend.",
    appliesTo: (basin, classification) => isImbalanced(classification, "groundwater") && /(ganges|indus|yamuna|sutlej|punjab|haryana|rajasthan)/i.test(basinName(basin))
  },
  {
    id: "mukherjee2018-ganges-groundwater",
    variableKey: "groundwater",
    scope: "Ganges basin groundwater",
    title: "Groundwater depletion causing reduction of baseflow triggering Ganges river summer drying",
    authors: "Mukherjee et al.",
    year: 2018,
    venue: "Scientific Reports",
    doi: "10.1038/s41598-018-30246-7",
    url: "https://www.nature.com/articles/s41598-018-30246-7",
    abstract: "Long-term Ganges groundwater decline analysis using in situ and satellite evidence.",
    reportedQuantity: {
      label: "Ganges groundwater trend",
      valueText: "Long-term Ganges basin groundwater decline about -0.30 +/- 0.07 cm yr-1; satellite-era pre-monsoon decline can reach about -1.93 cm yr-1",
      period: "1978-2015 and 2003-2015"
    },
    validationType: "trend-to-window-shift",
    assessment: "Long-term trend implies about -80 mm across 27.5 years, while satellite-era seasonal estimates imply several hundred mm. Project Ganges negative values in this bracket are plausible.",
    riskNote: "Seasonal pre-monsoon and annual mean storage are not identical; avoid direct one-to-one equality.",
    appliesTo: (basin, classification) => isImbalanced(classification, "groundwater") && /ganges/i.test(basinName(basin))
  },
  {
    id: "feng2013-north-china-groundwater",
    variableKey: "groundwater",
    scope: "North China groundwater depletion",
    title: "Evaluation of groundwater depletion in North China using GRACE",
    authors: "Feng et al.",
    year: 2013,
    venue: "Water Resources Research",
    doi: "10.1002/wrcr.20192",
    url: "https://agupubs.onlinelibrary.wiley.com/doi/abs/10.1002/wrcr.20192",
    abstract: "GRACE-based groundwater depletion estimate for North China.",
    reportedQuantity: {
      label: "North China groundwater depletion",
      valueText: "2.2 +/- 0.3 cm yr-1 equivalent water height, or 8.3 +/- 1.1 km3 yr-1 over about 370,000 km2",
      period: "2003-2010"
    },
    validationType: "trend-to-window-shift",
    assessment: "A -22 mm yr-1 trend implies roughly -600 mm over 27.5 years. Hai He and North China Plain linked values can therefore be several hundred negative mm.",
    riskNote: "The GRACE study area is not exactly the full Yellow River or Hai He basin; use as hotspot validation.",
    appliesTo: (basin, classification) => isImbalanced(classification, "groundwater") && /(hai|yellow river|huang|north china|hebei)/i.test(basinName(basin))
  },
  {
    id: "xiao2022-central-valley-groundwater",
    variableKey: "groundwater",
    scope: "California Central Valley",
    title: "A satellite-based monitoring framework for groundwater depletion in California's Central Valley",
    authors: "Xiao et al.",
    year: 2022,
    venue: "Nature Communications",
    doi: "10.1038/s41467-022-35582-x",
    url: "https://www.nature.com/articles/s41467-022-35582-x",
    abstract: "Long-term Central Valley groundwater depletion estimate using satellite and ancillary data.",
    reportedQuantity: {
      label: "Central Valley groundwater depletion",
      valueText: "1962-2021 trend -12.1 +/- 0.8 mm yr-1; 2003-2021 trend -15.7 +/- 1.4 mm yr-1",
      period: "1962-2021 and 2003-2021"
    },
    validationType: "trend-to-window-shift",
    assessment: "Long-term trend implies about -330 mm over the project window-center separation; stronger recent trend implies about -430 mm. San Joaquin values more negative than this need denominator/mask inspection.",
    riskNote: "The project San Joaquin basin may not equal the exact Central Valley mask and uses effective grid cells.",
    appliesTo: (basin, classification) => isImbalanced(classification, "groundwater") && /(san joaquin|sacramento|central valley|california)/i.test(basinName(basin))
  },
  {
    id: "castle2014-colorado-groundwater",
    variableKey: "groundwater",
    scope: "Colorado River Basin",
    title: "Groundwater depletion during drought threatens future water security of the Colorado River Basin",
    authors: "Castle et al.",
    year: 2014,
    venue: "Geophysical Research Letters",
    doi: "10.1002/2014GL061055",
    url: "https://agupubs.onlinelibrary.wiley.com/doi/full/10.1002/2014GL061055",
    abstract: "GRACE-based Colorado River Basin water storage and groundwater depletion during drought.",
    reportedQuantity: {
      label: "Colorado groundwater depletion",
      valueText: "Groundwater depletion about 5.6 +/- 0.4 km3 yr-1; roughly -9 mm yr-1 over the full Colorado River Basin",
      period: "2004.12-2013.11"
    },
    validationType: "trend-to-window-shift",
    assessment: "A -9 mm yr-1 drought-era rate implies about -250 mm over 27.5 years. Project Colorado values around this order are plausible.",
    riskNote: "This is a drought-period trend, so it should not be mechanically equated with the full 1962-2016 window.",
    appliesTo: (basin, classification) => isImbalanced(classification, "groundwater") && basin.region === "NA" && /colorado/i.test(basinName(basin))
  },
  {
    id: "voss2013-tigris-groundwater",
    variableKey: "groundwater",
    scope: "Tigris-Euphrates-Western Iran",
    title: "Groundwater depletion in the Middle East from GRACE with implications for transboundary water management",
    authors: "Voss et al.",
    year: 2013,
    venue: "Water Resources Research",
    doi: "10.1002/wrcr.20078",
    url: "https://escholarship.org/content/qt9w39k18q/qt9w39k18q.pdf",
    abstract: "GRACE-based Tigris-Euphrates-Western Iran terrestrial water and groundwater depletion estimate.",
    reportedQuantity: {
      label: "Groundwater residual depletion",
      valueText: "Groundwater depletion -17.3 +/- 2.1 mm yr-1, equivalent to -13.0 +/- 1.6 km3 yr-1",
      period: "2003-2009"
    },
    validationType: "trend-to-window-shift",
    assessment: "The trend implies about -475 mm over 27.5 years. Basin values of tens to a few hundred negative mm are plausible; values far below -500 mm need checking.",
    riskNote: "The study is a regional GRACE residual during a dry period; it is not a direct WaterGAP groundwater-storage state.",
    appliesTo: (basin, classification) => isImbalanced(classification, "groundwater") && /(shatt|tigris|euphrates|karun|iran|iraq)/i.test(basinName(basin))
  },
  {
    id: "immerzeel2019-water-demand-towers",
    variableKey: "deficit",
    scope: "Mountain water tower demand index",
    title: "Importance and vulnerability of the world's water towers",
    authors: "Immerzeel et al.",
    year: 2019,
    venue: "Nature",
    doi: "10.1038/s41586-019-1822-y",
    url: "https://www.nature.com/articles/s41586-019-1822-y",
    abstract: "Defines a demand index from net human water demand and natural demand relative to downstream water availability.",
    reportedQuantity: {
      label: "Demand Index ranking",
      valueText: "Indus DI 0.758; Ganges-Brahmaputra 0.598; Yellow River 0.536; Tigris-Euphrates 0.575; North America Colorado 0.599; Yangtze 0.340",
      period: "2001-2014 average monthly demands"
    },
    validationType: "relative-pressure-check",
    assessment: "This is not a mm quantity, but it validates the expected spatial ranking: Indus/Ganges/Yellow/Tigris-Euphrates/Colorado should be higher pressure than Yangtze/Brahmaputra.",
    riskNote: "Do not compare DI numerically to project mm. Use it only as a pressure-pattern check.",
    appliesTo: (basin, classification) => isImbalanced(classification, "deficit") && /(indus|ganges|brahmaputra|yellow river|yangtze|shatt|tigris|euphrates|colorado|san joaquin|california)/i.test(basinName(basin))
  },
  {
    id: "hoekstra2012-blue-water-scarcity",
    variableKey: "deficit",
    scope: "Blue water scarcity with environmental flow requirement",
    title: "The monthly blue water footprint compared to blue water availability for the world's major river basins",
    authors: "Hoekstra et al.",
    year: 2012,
    venue: "PLOS ONE",
    doi: "10.1371/journal.pone.0032688",
    url: "https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0032688",
    abstract: "Monthly blue water footprint compared with natural-runoff-based availability after environmental flow requirements.",
    reportedQuantity: {
      label: "Annualized scarcity-derived deficit",
      valueText: "Approximate annual deficits from supporting tables: Indus 69.6 km3 yr-1 (~61 mm yr-1), Ganges 7.3 (~7), Yellow 8.9 (~9), Tigris-Euphrates 6.9 (~8), Yangtze/Brahmaputra near 0",
      period: "1996-2005"
    },
    validationType: "derived-deficit-order",
    assessment: "Good definition check because it includes environmental flow. It uses consumption footprint rather than withdrawals, so project values based on withdrawals can be higher.",
    riskNote: "Annual aggregation can hide monthly scarcity; do not interpret near-zero annual deficit as no seasonal stress.",
    appliesTo: (basin, classification) => isImbalanced(classification, "deficit") && /(indus|ganges|brahmaputra|yellow river|yangtze|shatt|tigris|euphrates|colorado)/i.test(basinName(basin))
  },
  {
    id: "wijngaard2018-igb-water-gap",
    variableKey: "deficit",
    scope: "Indus-Ganges-Brahmaputra water gap",
    title: "Future changes in hydro-climatic extremes in the Indus, Ganges and Brahmaputra river basins",
    authors: "Wijngaard et al.",
    year: 2018,
    venue: "Hydrology and Earth System Sciences",
    doi: "10.5194/hess-22-6297-2018",
    url: "https://hess.copernicus.org/articles/22/6297/2018/",
    abstract: "Regional IGB model assessment reporting water demand and water gap/unmet demand.",
    reportedQuantity: {
      label: "IGB water gap",
      valueText: "Indus water gap 83 km3 yr-1 (~73 mm yr-1); Ganges 35 km3 yr-1 (~34 mm yr-1); Brahmaputra no blue water gap",
      period: "Current baseline in study"
    },
    validationType: "direct-gap-order",
    assessment: "Strong regional comparison for IGB. Project recent means around tens to low hundreds mm yr-1 are plausible for Ganges/Indus; Brahmaputra should be much lower.",
    riskNote: "The study's water gap is unmet demand often supplied by non-sustainable groundwater, not exactly withdrawal + EFR - naturalized runoff.",
    appliesTo: (basin, classification) => isImbalanced(classification, "deficit") && /(indus|ganges|brahmaputra)/i.test(basinName(basin))
  },
  {
    id: "qin2025-global-water-gap",
    variableKey: "deficit",
    scope: "Global water gap under environmental flow constraints",
    title: "Global water gap under safe and just Earth system boundaries",
    authors: "Qin et al.",
    year: 2025,
    venue: "Nature Communications",
    doi: "10.1038/s41467-025-56517-2",
    url: "https://www.nature.com/articles/s41467-025-56517-2",
    abstract: "Global water gap defined from renewable water availability and consumption while maintaining environmental flows.",
    reportedQuantity: {
      label: "Regional water gap",
      valueText: "Baseline 2001-2010: global 457.9 km3 yr-1; Ganges-Brahmaputra 56.1, Tigris-Euphrates 34.1, Indus 28.7, Nile 22.2 km3 yr-1; Central Valley 12.8; Colorado River Basin 3.8",
      period: "2001-2010 baseline"
    },
    validationType: "direct-gap-order",
    assessment: "Useful basin/global order check. Because it uses consumption while the project uses potential withdrawals, the project can be higher in irrigated basins.",
    riskNote: "If project values are far above literature by more than an order of magnitude after using comparable area, inspect runoff availability or EFR calculation.",
    appliesTo: (basin, classification) => isImbalanced(classification, "deficit") && /(indus|ganges|brahmaputra|nile|shatt|tigris|euphrates|colorado|san joaquin|california)/i.test(basinName(basin))
  }
];

function basinName(basin) {
  return `${basin.name || ""} ${basin.sourceName || ""}`.toLowerCase();
}

function isImbalanced(classification, key) {
  return classification?.imbalancedVariables?.includes(key);
}

function isHighMountainAsia(basin) {
  if (basin.region !== "AS") return false;
  return /(alakol|amu|aral|balkhash|brahmaputra|chuy|ganges|himal|indus|irrawaddy|issyk|mekong|salween|sarysu|syr|talas|tarim|tibetan|yangtze|yellow|yarlung|yenisey)/i.test(basinName(basin));
}

function isTienShanBasin(basin) {
  if (basin.region !== "AS") return false;
  return /(alakol|balkhash|chuy|ili|irtysh|issyk|ysyk|talas|tarim|sarysu|syr|aral|tian|tien)/i.test(basinName(basin));
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function round(value, digits = 3) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function formatNumber(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : "n/a";
}

function metricFor(classification, key) {
  const metric = classification?.metrics?.[key];
  return metric?.status === "evaluated" ? metric : null;
}

function statLine(label, value, unit) {
  return { label, value: `${value}${unit ? ` ${unit}` : ""}` };
}

function comparisonStats(source, basins, classificationByBasin) {
  const matched = basins
    .map((basin) => ({ basin, classification: classificationByBasin[String(basin.id)] }))
    .filter(({ basin, classification }) => source.appliesTo(basin, classification))
    .filter(({ classification }) => metricFor(classification, source.variableKey));
  const metrics = matched.map(({ classification }) => metricFor(classification, source.variableKey));
  const differences = metrics.map((metric) => metric.difference).filter(Number.isFinite);
  const recentMeans = metrics.map((metric) => metric.recentMean).filter(Number.isFinite);
  const historicalMeans = metrics.map((metric) => metric.historicalMean).filter(Number.isFinite);

  const displayStats = [
    statLine("Matched basins", matched.length, ""),
    statLine("Recent mean median", formatNumber(median(recentMeans)), variableUnit(source.variableKey)),
    statLine("Recent mean range", formatRange(recentMeans, 1), variableUnit(source.variableKey)),
    statLine("Window shift median", formatNumber(median(differences)), variableUnit(source.variableKey)),
    statLine("Window shift range", formatRange(differences, 1), variableUnit(source.variableKey))
  ];

  if (source.variableKey === "glacier") {
    const rates = differences.map((difference) => difference / windowCenterDeltaYears / 1000);
    displayStats.push(statLine("Equivalent-rate median", formatNumber(median(rates), 3), "m w.e. yr-1"));
    displayStats.push(statLine("Equivalent-rate range", formatRange(rates, 3), "m w.e. yr-1"));
  }

  if (source.variableKey === "groundwater") {
    const trends = differences.map((difference) => difference / windowCenterDeltaYears);
    displayStats.push(statLine("Linearized shift median", formatNumber(median(trends), 2), "mm yr-1"));
    displayStats.push(statLine("Linearized shift range", formatRange(trends, 2), "mm yr-1"));
  }

  if (source.variableKey === "deficit") {
    displayStats.push(statLine("Historical mean median", formatNumber(median(historicalMeans)), "mm yr-1"));
  }

  const examples = matched
    .map(({ basin, classification }) => {
      const metric = metricFor(classification, source.variableKey);
      return {
        basinId: String(basin.id),
        name: basin.name,
        region: basin.region,
        recentMean: round(metric.recentMean, 1),
        historicalMean: round(metric.historicalMean, 1),
        windowShift: round(metric.difference, 1),
        summary: exampleSummary(source.variableKey, metric)
      };
    })
    .sort((a, b) => exampleSortValue(source.variableKey, b) - exampleSortValue(source.variableKey, a))
    .slice(0, 6);

  return {
    matchedBasinCount: matched.length,
    variableLabel: variableLabels[source.variableKey],
    validationType: source.validationType,
    windowCenterDeltaYears,
    ourMetric: metricDescription(source.variableKey),
    displayStats,
    exampleBasins: examples
  };
}

function variableUnit(key) {
  if (key === "glacier") return "mm water equivalent";
  if (key === "groundwater") return "mm";
  return "mm yr-1";
}

function metricDescription(key) {
  if (key === "glacier") {
    return "glacier_storage_mm_we is an absolute storage state normalized by glacier-covered area; comparison with literature rates uses (recent_mean - historical_mean) / 27.5 years / 1000.";
  }
  if (key === "groundwater") {
    return "groundwater_storage_mm is annual mean WaterGAP groundwater storage over effective cells; literature trends are compared to (recent_mean - historical_mean) / 27.5 years.";
  }
  return "net_water_demand_deficit_mm_yr is annual max(0, potential total withdrawal + environmental-flow requirement - naturalized runoff availability), averaged over effective demand-deficit cells.";
}

function formatRange(values, digits) {
  if (!values.length) return "n/a";
  return `${formatNumber(Math.min(...values), digits)} to ${formatNumber(Math.max(...values), digits)}`;
}

function exampleSummary(key, metric) {
  if (key === "glacier") {
    const rate = metric.difference / windowCenterDeltaYears / 1000;
    return `recent ${formatNumber(metric.recentMean)} mm w.e.; shift ${formatNumber(metric.difference)} mm; equivalent ${formatNumber(rate, 3)} m w.e. yr-1`;
  }
  if (key === "groundwater") {
    const trend = metric.difference / windowCenterDeltaYears;
    return `recent ${formatNumber(metric.recentMean)} mm; shift ${formatNumber(metric.difference)} mm; linearized ${formatNumber(trend, 2)} mm yr-1`;
  }
  return `recent ${formatNumber(metric.recentMean)} mm yr-1; historical ${formatNumber(metric.historicalMean)}; shift ${formatNumber(metric.difference)} mm yr-1`;
}

function exampleSortValue(key, item) {
  if (key === "deficit") return Math.abs(item.recentMean || 0);
  return Math.abs(item.windowShift || 0);
}

function buildEvidenceForModule(moduleInfo) {
  const basinData = JSON.parse(fs.readFileSync(path.join(moduleInfo.dataDir, "basin-data.json"), "utf8"));
  const classification = JSON.parse(fs.readFileSync(path.join(moduleInfo.dataDir, "basin-imbalance-classification.json"), "utf8"));
  const basins = basinData.basins || [];
  const classificationByBasin = classification.basins || {};

  const entries = sources.map((source) => {
    const stats = comparisonStats(source, basins, classificationByBasin);
    const basinIds = basins
      .filter((basin) => source.appliesTo(basin, classificationByBasin[String(basin.id)]))
      .map((basin) => String(basin.id));
    return {
      id: source.id,
      variableKey: source.variableKey,
      scope: source.scope,
      title: source.title,
      authors: source.authors,
      year: source.year,
      venue: source.venue,
      doi: source.doi,
      url: source.url,
      abstract: source.abstract,
      reportedQuantity: source.reportedQuantity,
      comparison: {
        basis: `${moduleInfo.basinType}; evidence attached by basin_id after filtering ${variableLabels[source.variableKey]}-imbalanced basins matching the source region or topic.`,
        ...stats,
        assessment: source.assessment,
        riskNote: source.riskNote
      },
      basinIds
    };
  }).filter((entry) => entry.basinIds.length);

  const byBasin = {};
  for (const entry of entries) {
    for (const basinId of entry.basinIds) {
      if (!byBasin[basinId]) byBasin[basinId] = [];
      byBasin[basinId].push(entry.id);
    }
  }

  const variableCoverage = [...new Set(entries.map((entry) => entry.variableKey))];
  const document = {
    schema: "basin-literature-evidence/v2",
    generated: evidenceVersion,
    moduleId: moduleInfo.moduleId,
    variableCoverage,
    method: {
      attachment: "Evidence is attached to basin ontology identifiers and variable keys, not map coordinates.",
      comparison: "Each evidence entry stores the reported literature quantity, the project metric used for comparison, linked-basin summary statistics, and a risk note when definitions or denominators differ.",
      denominatorWarning: "Project water-demand deficit and groundwater values use effective WaterGAP grid cells after small-value masking; glacier storage is normalized by glacier-covered area. Literature values using total basin area or total regional volume must be interpreted through these denominators.",
      limitation: "Most references are regional rather than basin-specific. They validate order of magnitude, sign, and spatial ranking; they do not imply exact equality."
    },
    entries,
    byBasin
  };
  fs.writeFileSync(path.join(moduleInfo.dataDir, "basin-literature-evidence.json"), JSON.stringify(document, null, 2) + "\n");
  console.log(`${moduleInfo.moduleId}: wrote ${entries.length} evidence entries for ${Object.keys(byBasin).length} basins covering ${variableCoverage.join(", ")}`);
}

for (const moduleInfo of modules) buildEvidenceForModule(moduleInfo);
