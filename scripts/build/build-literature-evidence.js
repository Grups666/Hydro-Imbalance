#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");
const evidenceVersion = "2026-06-18";
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

const HISTORICAL_CENTER = (1962 + 1996) / 2;
const RECENT_CENTER = (1997 + 2016) / 2;
const WINDOW_CENTER_DELTA_YEARS = RECENT_CENTER - HISTORICAL_CENTER;

const sources = [
  {
    id: "zemp2019-global",
    variableKey: "glacier",
    scope: "Global glaciers outside the Greenland and Antarctic ice sheets",
    title: "Global glacier mass changes and their contributions to sea-level rise from 1961 to 2016",
    authors: "Zemp et al.",
    year: 2019,
    venue: "Nature",
    doi: "10.1038/s41586-019-1071-0",
    url: "https://pubmed.ncbi.nlm.nih.gov/30962533/",
    abstract: "Global extrapolation of glaciological and geodetic observations for 1961-2016, including regional specific mass-change rates and sea-level contribution.",
    reportedQuantity: {
      label: "Glacier mass change",
      valueText: "2006-2016 regional rates from -0.1 to -1.2 m w.e. yr-1; global loss 335 +/- 144 Gt yr-1",
      period: "1961-2016, with 2006-2016 regional rates"
    },
    assessment: "Broad global benchmark. Basin-scale values should fall within the same order of magnitude as the regional m w.e. yr-1 rates, not match exactly.",
    appliesTo: (basin, classification) => isGlacierImbalanced(classification)
  },
  {
    id: "brun2017-hma",
    variableKey: "glacier",
    scope: "High Mountain Asia",
    title: "A spatially resolved estimate of High Mountain Asia glacier mass balances, 2000-2016",
    authors: "Brun et al.",
    year: 2017,
    venue: "Nature Geoscience",
    doi: "10.1038/NGEO2999",
    url: "https://pubmed.ncbi.nlm.nih.gov/28890734/",
    abstract: "Satellite stereo-imagery DEM time series were used to estimate spatially resolved glacier mass balances for about 92% of the glacierized area of High Mountain Asia.",
    reportedQuantity: {
      label: "High Mountain Asia glacier mass balance",
      valueText: "-16.3 +/- 3.5 Gt yr-1 (-0.18 +/- 0.04 m w.e. yr-1), with strong subregional variability",
      period: "2000-2016"
    },
    assessment: "Useful regional check for Asian mountain basins; our basin-normalized storage-shift equivalents should be negative for losing glacierized basins, with local deviations expected.",
    appliesTo: (basin, classification) => isGlacierImbalanced(classification) && isHighMountainAsia(basin)
  },
  {
    id: "farinotti2015-tienshan",
    variableKey: "glacier",
    scope: "Tien Shan",
    title: "Substantial glacier mass loss in the Tien Shan over the past 50 years",
    authors: "Farinotti et al.",
    year: 2015,
    venue: "Nature Geoscience",
    doi: "10.1038/ngeo2513",
    url: "https://www.nature.com/articles/ngeo2513",
    abstract: "Regional reconstruction of Tien Shan glacier mass change over roughly five decades, used here as a focused benchmark for Central Asian glacierized basins.",
    reportedQuantity: {
      label: "Tien Shan glacier mass loss",
      valueText: "About 27 +/- 15% of total glacier mass lost over 1961-2012, commonly reported as about 5.4 +/- 2.8 Gt yr-1",
      period: "1961-2012"
    },
    assessment: "Focused Central Asia check. Direct matching is not expected because our values are basin means over glacier area and use a 1962-2016 window comparison.",
    appliesTo: (basin, classification) => isGlacierImbalanced(classification) && isTienShanBasin(basin)
  },
  {
    id: "dussaillant2019-andes",
    variableKey: "glacier",
    scope: "South American Andes",
    title: "Two decades of glacier mass loss along the Andes",
    authors: "Dussaillant et al.",
    year: 2019,
    venue: "Nature Geoscience",
    doi: "10.1038/s41561-019-0432-5",
    url: "https://www.nature.com/articles/s41561-019-0432-5",
    abstract: "ASTER DEM time series were used to estimate Andean glacier mass changes from 10 degrees N to 56 degrees S.",
    reportedQuantity: {
      label: "Andean glacier mass loss",
      valueText: "-22.9 +/- 5.9 Gt yr-1 (-0.72 +/- 0.22 m w.e. yr-1), with strongest losses in Patagonia and the Tropical Andes",
      period: "2000-2018"
    },
    assessment: "Regional benchmark for South American basins. Our strongest Andean basin shifts should be negative and often near the same m w.e. yr-1 order after window-center conversion.",
    appliesTo: (basin, classification) => isGlacierImbalanced(classification) && basin.region === "SA"
  },
  {
    id: "farinotti2019-storage",
    variableKey: "glacier",
    scope: "Global glacier storage baseline",
    title: "A consensus estimate for the ice thickness distribution of all glaciers on Earth",
    authors: "Farinotti et al.",
    year: 2019,
    venue: "Nature Geoscience",
    doi: "10.1038/s41561-019-0300-3",
    url: "https://www.nature.com/articles/s41561-019-0300-3",
    abstract: "Consensus global ice-thickness and volume estimate for individual glaciers, used by this project as the absolute storage anchor before applying annual mass-balance reconstruction.",
    reportedQuantity: {
      label: "Global glacier ice volume",
      valueText: "Consensus global ice-volume baseline, about 158,000 km3 of ice outside the main ice sheets",
      period: "Inventory-era baseline around 2000"
    },
    assessment: "Methodological validation for the absolute storage baseline. This source constrains storage magnitude, while Zemp-style mass balance controls the temporal evolution.",
    appliesTo: (basin, classification) => isGlacierImbalanced(classification)
  }
];

function isGlacierImbalanced(classification) {
  return classification?.imbalancedVariables?.includes("glacier");
}

function basinName(basin) {
  return `${basin.name || ""} ${basin.sourceName || ""}`.toLowerCase();
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

function comparisonStats(source, basins, classificationByBasin) {
  const matched = basins
    .map((basin) => ({ basin, classification: classificationByBasin[String(basin.id)] }))
    .filter(({ basin, classification }) => source.appliesTo(basin, classification));
  const rates = matched
    .map(({ classification }) => classification.metrics?.glacier?.difference)
    .filter(Number.isFinite)
    .map((differenceMm) => differenceMm / WINDOW_CENTER_DELTA_YEARS / 1000);
  const sortedExamples = matched
    .map(({ basin, classification }) => ({
      basinId: String(basin.id),
      name: basin.name,
      region: basin.region,
      storageShiftMm: round(classification.metrics?.glacier?.difference, 1),
      equivalentRateMweYr: round((classification.metrics?.glacier?.difference || 0) / WINDOW_CENTER_DELTA_YEARS / 1000, 3)
    }))
    .sort((a, b) => Math.abs(b.storageShiftMm || 0) - Math.abs(a.storageShiftMm || 0))
    .slice(0, 6);

  return {
    matchedBasinCount: matched.length,
    windowCenterDeltaYears: WINDOW_CENTER_DELTA_YEARS,
    ourMetric: "recent_mean_1997_2016 minus historical_mean_1962_1996 for glacier_storage_mm_we, normalized by glacier-covered area",
    ourEquivalentRateMweYrRange: rates.length ? [round(Math.min(...rates)), round(Math.max(...rates))] : null,
    ourEquivalentRateMweYrMedian: round(median(rates)),
    exampleBasins: sortedExamples
  };
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
        basis: `${moduleInfo.basinType}; basin evidence attached by basin_id after filtering glacier-imbalanced basins in the source region.`,
        ...stats,
        assessment: source.assessment
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

  const document = {
    schema: "basin-literature-evidence/v1",
    generated: evidenceVersion,
    moduleId: moduleInfo.moduleId,
    variableCoverage: ["glacier"],
    method: {
      attachment: "Evidence is attached to basin ontology identifiers, not map coordinates.",
      comparison: "The project glacier value is a storage-state window shift in mm water equivalent. For comparison with m w.e. yr-1 literature rates, the shift is divided by 27.5 years, the distance between the centers of 1962-1996 and 1997-2016.",
      limitation: "Most references are regional rather than basin-specific; they validate order of magnitude and direction, not exact basin equality."
    },
    entries,
    byBasin
  };
  fs.writeFileSync(path.join(moduleInfo.dataDir, "basin-literature-evidence.json"), JSON.stringify(document, null, 2) + "\n");
  console.log(`${moduleInfo.moduleId}: wrote ${entries.length} evidence entries for ${Object.keys(byBasin).length} basins`);
}

for (const moduleInfo of modules) buildEvidenceForModule(moduleInfo);
