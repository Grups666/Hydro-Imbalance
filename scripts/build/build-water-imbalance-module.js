#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "../..");
const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, "").split("=");
  return [key, rest.join("=") || "true"];
}));
const inputDir = path.resolve(root, "../Water_Circle_Imbalance/projects/datasets/basin_time_series");
const inputCsv = path.resolve(root, args.inputCsv || path.join(inputDir, "basin_three_variable_timeseries_1962_2016.csv"));
const moduleId = args.moduleId || "water-imbalance";
const moduleName = args.moduleName || (moduleId === "water-imbalance" ? "Water Imbalance - Major River Basins" : "Water Imbalance - WMO Basins");
const moduleDir = path.resolve(root, args.moduleDir || path.join("public/modules", moduleId));
const outputDir = path.join(moduleDir, "data");
const outputCsv = path.join(outputDir, "basin-three-variable-timeseries-1962-2016.csv");
const outputClassification = path.join(outputDir, "basin-imbalance-classification.json");
const outputMetadata = path.join(outputDir, "basin-time-series-metadata.json");
const outputBasinData = path.join(outputDir, "basin-data.json");
const basinDataSource = path.resolve(root, args.basinData || "projects/basin-data.js");
const spatialEntity = args.spatialEntity || (moduleId === "water-imbalance" ? "GRDC Major River Basins" : "GRDC WMO Basins and Sub-Basins");
const basinLayerName = args.basinLayerName || (moduleId === "water-imbalance" ? "Major River Basin Water Imbalance" : "WMO Basin Water Imbalance");
const layerId = args.layerId || (moduleId === "water-imbalance" ? "water-imbalance-mrb-basins" : `${moduleId}-basins`);
const defaultManifest = moduleId === "water-imbalance" ? "module.json" : `module-${moduleId.replace(/^water-imbalance-/, "")}.json`;
const manifestPath = path.resolve(root, args.manifest || defaultManifest);
const manifestDir = path.dirname(manifestPath);
const modulePath = `./${path.relative(manifestDir, moduleDir).replace(/\\/g, "/")}`;
const entryPath = args.entry || "./public/modules/water-imbalance/index.js";
const metadataPath = `${modulePath}/data/basin-time-series-metadata.json`;
const historicalStdMultiplier = 2;
const absoluteDifferenceMinimumMm = 1;

const variables = [
  {
    id: "net_water_demand_deficit_mm_yr",
    key: "deficit",
    label: "Water-demand deficit",
    unit: "mm yr-1",
    kind: "flux",
    color: "#e3b23c"
  },
  {
    id: "groundwater_storage_mm",
    key: "groundwater",
    label: "Groundwater Storage",
    unit: "mm",
    kind: "storage",
    color: "#c767b1"
  },
  {
    id: "glacier_storage_mm_we",
    key: "glacier",
    label: "Glacier Storage",
    unit: "mm water equivalent",
    kind: "storage",
    color: "#2fb7c8"
  }
];

const classColors = {
  none: "#e2e2dc",
  deficit: "#e3b23c",
  groundwater: "#c767b1",
  glacier: "#2fb7c8",
  "deficit+groundwater": "#d85f55",
  "deficit+glacier": "#66b95a",
  "groundwater+glacier": "#4f7fd5",
  "deficit+groundwater+glacier": "#3f4652"
};

function parseValue(raw) {
  if (raw === "" || raw === "NaN" || raw === "nan" || raw == null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += char;
    }
  }
  values.push(value);
  return values;
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length);
}

function loadBasinData() {
  const code = fs.readFileSync(basinDataSource, "utf8");
  if (basinDataSource.endsWith(".json")) return JSON.parse(code);
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(code, context);
  return context.window.BASIN_DATA || { meta: {}, basins: [] };
}

fs.mkdirSync(outputDir, { recursive: true });
fs.copyFileSync(inputCsv, outputCsv);

const lines = fs.readFileSync(inputCsv, "utf8").trim().split(/\r?\n/);
const headers = parseCsvLine(lines[0]);
const indexes = Object.fromEntries(headers.map((header, index) => [header, index]));
const byBasin = new Map();

for (let index = 1; index < lines.length; index++) {
  const values = parseCsvLine(lines[index]);
  const basinId = String(values[indexes.basin_id]);
  if (!byBasin.has(basinId)) byBasin.set(basinId, []);
  const record = { year: Number(values[indexes.year]) };
  for (const variable of variables) record[variable.id] = parseValue(values[indexes[variable.id]]);
  byBasin.get(basinId).push(record);
}

const classification = {};
const counts = {};
for (const [basinId, records] of byBasin) {
  records.sort((a, b) => a.year - b.year);
  const split = records.length - 20;
  const metrics = {};
  const imbalanced = [];

  for (const variable of variables) {
    const historical = records.slice(0, split).map((row) => row[variable.id]).filter(Number.isFinite);
    const recent = records.slice(split).map((row) => row[variable.id]).filter(Number.isFinite);
    if (!historical.length || !recent.length) {
      metrics[variable.key] = { imbalanced: false, status: "insufficient-data" };
      continue;
    }
    const historicalMean = mean(historical);
    const recentMean = mean(recent);
    const historicalStdDev = standardDeviation(historical);
    const difference = recentMean - historicalMean;
    const isImbalanced = Math.abs(difference) > historicalStdMultiplier * historicalStdDev && Math.abs(difference) > absoluteDifferenceMinimumMm;
    metrics[variable.key] = {
      imbalanced: isImbalanced,
      status: "evaluated",
      historicalMean,
      recentMean,
      historicalStdDev,
      difference
    };
    if (isImbalanced) imbalanced.push(variable.key);
  }

  const classId = imbalanced.length ? imbalanced.join("+") : "none";
  counts[classId] = (counts[classId] || 0) + 1;
  classification[basinId] = {
    classId,
    color: classColors[classId],
    imbalancedVariables: imbalanced,
    metrics
  };
}

const basinData = loadBasinData();
const moduleBasins = basinData.basins || [];
const matchedBasins = moduleBasins.filter((basin) => byBasin.has(String(basin.id))).length;
const classificationDocument = {
  schema: "water-imbalance-classification/v1",
  method: {
    historicalPeriod: [1962, 1996],
    recentPeriod: [1997, 2016],
    recentWindowYears: 20,
    historicalStdMultiplier,
    absoluteDifferenceMinimumMm,
    rule: "abs(recent_mean - historical_mean) > 2 * historical_standard_deviation AND abs(recent_mean - historical_mean) > 1 mm",
    demandDeficitDefinition: "max(0, potential total withdrawal + environmental-flow requirement - naturalized runoff availability), aggregated monthly to annual basin means"
  },
  colors: classColors,
  counts,
  basins: classification
};
fs.writeFileSync(outputClassification, JSON.stringify(classificationDocument, null, 2) + "\n");
if (path.resolve(basinDataSource) !== path.resolve(outputBasinData)) {
  fs.writeFileSync(outputBasinData, JSON.stringify(basinData, null, 2) + "\n");
}

const metadata = {
  id: "basin-three-variable-timeseries-1962-2016",
  name: `${moduleName} Time Series`,
  type: "basin-time-series",
  file: "./basin-three-variable-timeseries-1962-2016.csv",
  classification: "./basin-imbalance-classification.json",
  basinData: "./basin-data.json",
  join: {
    moduleField: "basin_id",
    spatialEntity,
    spatialField: "id",
    method: "exact-string"
  },
  time: { field: "year", start: 1962, end: 2016, resolution: "annual" },
  coverage: {
    records: lines.length - 1,
    basins: byBasin.size,
    matchedBasins,
    sourceBasins: moduleBasins.length,
    basinCoveragePercent: Number((matchedBasins / moduleBasins.length * 100).toFixed(2))
  },
  variables,
  imbalanceMethod: classificationDocument.method,
  classColors,
  effectiveGridCellRule: {
    netWaterDemandDeficit: "Only WaterGAP cells with 1962-2016 mean net water-demand deficit >= 1 mm yr-1 are included in basin means.",
    groundwaterStorage: "Only WaterGAP cells with absolute 1962-2016 mean groundwater storage >= 1 mm are included in basin means."
  },
  glacierDepthNormalization: "glacier_storage_mm_we is normalized by glacier-covered area within each basin, not by total basin area.",
  provenance: {
    basinSource: basinData.meta?.source || "GRDC Major River Basins of the World",
    basinSourceUrl: basinData.meta?.sourceUrl || "https://grdc.bafg.de/products/basin_layers/major_rivers/",
    basinEdition: basinData.meta?.edition || "2nd revised edition, 2020",
    waterGapVersion: "2.2d",
    waterDemandVariable: "net_water_demand_deficit_mm_yr",
    waterDemandSources: ["ptotww", "ncrunnat", "environmental flow requirement from ncrunnat Q90 exceedance"],
    glacierSources: ["Farinotti et al. (2019)", "Zemp et al. (2019)"],
    sourceDirectory: "Water_Circle_Imbalance/projects/datasets/basin_time_series"
  }
};
fs.writeFileSync(outputMetadata, JSON.stringify(metadata, null, 2) + "\n");

const manifest = {
  id: moduleId,
  name: moduleName,
  version: "0.1.1",
  assetVersion: "2026-06-18-effective-cells-glacier-area",
  description: `Basin-scale three-variable water imbalance classification, time series, and basin ontology for ${spatialEntity}.`,
  author: "Spatial Research Team",
  icon: "droplet",
  basePath: args.basePath || "https://grups666.github.io/Hydro-Imbalance/",
  entry: entryPath,
  className: "WaterImbalanceModule",
  importKind: "module-manifest",
  defaultLoad: false,
  layerId,
  layerName: basinLayerName,
  datasets: [
    {
      id: "basin-three-variable-timeseries-1962-2016",
      metadata: metadataPath
    }
  ],
  provides: {
    layers: [
      {
        id: layerId,
        name: basinLayerName,
        type: "vector",
        source: "module.basins",
        interactive: true
      }
    ],
    panels: [
      {
        id: `${moduleId}-inspector`,
        name: `${moduleName} Inspector`,
        position: "right",
        trigger: "feature:click",
        condition: { layer: layerId, module: moduleId }
      }
    ],
    dataProducts: [
      {
        id: "basin-imbalance-classification",
        type: "derived-classification",
        description: "Classifies each basin from recent-versus-historical shifts in water-demand deficit, groundwater storage, and glacier storage."
      },
      {
        id: "basin-hydrology-time-series",
        type: "basin-time-series",
        description: `Three annual hydrological variables joined to ${spatialEntity} by basin_id.`
      }
    ]
  }
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

console.log(JSON.stringify({
  inputCsv,
  moduleId,
  outputDir,
  manifest: manifestPath,
  records: lines.length - 1,
  sourceBasins: byBasin.size,
  matchedBasins,
  basinCoveragePercent: metadata.coverage.basinCoveragePercent,
  classificationCounts: counts
}, null, 2));
