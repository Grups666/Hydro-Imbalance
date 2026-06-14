#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "../..");
const inputDir = path.resolve(root, "../Water_Circle_Imbalance/projects/datasets/basin_time_series");
const inputCsv = path.join(inputDir, "basin_three_variable_timeseries_1962_2016.csv");
const outputDir = path.join(root, "public/modules/water-imbalance/data");
const outputCsv = path.join(outputDir, "basin-three-variable-timeseries-1962-2016.csv");
const outputClassification = path.join(outputDir, "basin-imbalance-classification.json");
const outputMetadata = path.join(outputDir, "basin-time-series-metadata.json");
const graphFile = path.join(outputDir, "knowledge-graph.json");

const variables = [
  {
    id: "net_water_demand_deficit_mm_yr",
    key: "deficit",
    label: "Net Water-Demand Deficit",
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
  none: "#eef2f7",
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

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length);
}

function loadFoundationBasins() {
  const localBasinDataFile = path.join(root, "projects/basin-data.js");
  const siblingBasinDataFile = path.resolve(root, "../Water_Circle_Imbalance/projects/basin-data.js");
  const basinDataFile = fs.existsSync(localBasinDataFile) ? localBasinDataFile : siblingBasinDataFile;
  const code = fs.readFileSync(basinDataFile, "utf8");
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(code, context);
  return context.window.BASIN_DATA?.basins || [];
}

fs.mkdirSync(outputDir, { recursive: true });
fs.copyFileSync(inputCsv, outputCsv);

const lines = fs.readFileSync(inputCsv, "utf8").trim().split(/\r?\n/);
const headers = lines[0].split(",");
const indexes = Object.fromEntries(headers.map((header, index) => [header, index]));
const byBasin = new Map();

for (let index = 1; index < lines.length; index++) {
  const values = lines[index].split(",");
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
    const isImbalanced = Math.abs(difference) > historicalStdDev && Math.abs(difference) > 1;
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

const foundationBasins = loadFoundationBasins();
const matchedFoundationBasins = foundationBasins.filter((basin) => byBasin.has(String(basin.id))).length;
const classificationDocument = {
  schema: "water-imbalance-classification/v1",
  method: {
    historicalPeriod: [1962, 1996],
    recentPeriod: [1997, 2016],
    recentWindowYears: 20,
    rule: "abs(recent_mean - historical_mean) > historical_standard_deviation AND abs(recent_mean - historical_mean) > 1 mm",
    demandDeficitDefinition: "max(0, potential total withdrawal + environmental-flow requirement - naturalized runoff availability), aggregated monthly to annual basin means"
  },
  colors: classColors,
  counts,
  basins: classification
};
fs.writeFileSync(outputClassification, JSON.stringify(classificationDocument, null, 2) + "\n");

const metadata = {
  id: "basin-three-variable-timeseries-1962-2016",
  name: "Unified Basin Hydrology Time Series",
  type: "basin-time-series",
  file: "./basin-three-variable-timeseries-1962-2016.csv",
  classification: "./basin-imbalance-classification.json",
  join: {
    moduleField: "basin_id",
    foundationEntity: "Basin",
    foundationField: "id",
    method: "exact-string"
  },
  time: { field: "year", start: 1962, end: 2016, resolution: "annual" },
  coverage: {
    records: lines.length - 1,
    basins: byBasin.size,
    matchedFoundationBasins,
    foundationBasins: foundationBasins.length,
    foundationCoveragePercent: Number((matchedFoundationBasins / foundationBasins.length * 100).toFixed(2))
  },
  variables,
  imbalanceMethod: classificationDocument.method,
  classColors,
  provenance: {
    waterGapVersion: "2.2d",
    waterDemandVariable: "net_water_demand_deficit_mm_yr",
    waterDemandSources: ["ptotww", "ncrunnat", "environmental flow requirement from ncrunnat Q90 exceedance"],
    glacierSources: ["Farinotti et al. (2019)", "Zemp et al. (2019)"],
    sourceDirectory: "Water_Circle_Imbalance/projects/datasets/basin_time_series"
  }
};
fs.writeFileSync(outputMetadata, JSON.stringify(metadata, null, 2) + "\n");

const oldGraph = JSON.parse(fs.readFileSync(graphFile, "utf8"));
const regions = (oldGraph.spatialContexts?.regions || []).map(({ mode, summary, ...region }) => region);
const relations = [];
for (const relation of oldGraph.relations || []) {
  if (relation.type === "region_has_seed_literature") {
    relations.push({
      type: "paper_studies_region",
      source: relation.target,
      target: relation.source,
      method: relation.method || "curated-region-link",
      confidence: relation.confidence
    });
  } else if (relation.type === "paper_studies_region") {
    relations.push(relation);
  }
}
const graph = {
  schema: "water-imbalance-literature/v1",
  module: "water-imbalance",
  generatedFrom: oldGraph.generatedFrom,
  spatialContexts: { regions },
  literature: oldGraph.literature,
  relations
};
fs.writeFileSync(graphFile, JSON.stringify(graph, null, 2) + "\n");

console.log(JSON.stringify({
  inputCsv,
  records: lines.length - 1,
  sourceBasins: byBasin.size,
  matchedFoundationBasins,
  foundationCoveragePercent: metadata.coverage.foundationCoveragePercent,
  classificationCounts: counts,
  literatureRecords: Object.keys(graph.literature?.records || {}).length,
  literatureRegionRelations: relations.length
}, null, 2));
