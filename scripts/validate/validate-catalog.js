#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "../..");
let failed = false;

function loadBrowserData(filePath, globalName) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(filePath, "utf8"), context, { filename: filePath });
  return context.window[globalName];
}

function check(label, condition, detail) {
  if (condition) {
    console.log(`  OK ${label}${detail ? `: ${detail}` : ""}`);
  } else {
    failed = true;
    console.error(`  ERROR ${label}${detail ? `: ${detail}` : ""}`);
  }
}

console.log("=== Hydro-Imbalance validation ===");

const literature = loadBrowserData(path.join(root, "catalog/literature/reference-catalog.js"), "REFERENCE_CATALOG");
check("literature catalog", Object.keys(literature || {}).length > 0, `${Object.keys(literature || {}).length} records`);

const basinData = loadBrowserData(path.join(root, "public/assets/basin-data.js"), "BASIN_DATA");
const foundationBasins = basinData?.basins || [];
check("Foundation basins", foundationBasins.length > 0, `${foundationBasins.length} basins`);

const moduleDir = path.join(root, "public/modules/water-imbalance");
const manifest = JSON.parse(fs.readFileSync(path.join(moduleDir, "module.json"), "utf8"));
const metadata = JSON.parse(fs.readFileSync(path.join(moduleDir, "data/basin-time-series-metadata.json"), "utf8"));
const classification = JSON.parse(fs.readFileSync(path.join(moduleDir, "data/basin-imbalance-classification.json"), "utf8"));
const graph = JSON.parse(fs.readFileSync(path.join(moduleDir, "data/knowledge-graph.json"), "utf8"));

check("module version", manifest.version === "0.1.1", manifest.version);
check("three variables", metadata.variables?.length === 3, metadata.variables?.map((item) => item.id).join(", "));
check("classification coverage", Object.keys(classification.basins || {}).length === metadata.coverage.basins, `${Object.keys(classification.basins || {}).length} basins`);
check("Foundation exact-ID matches", metadata.coverage.matchedFoundationBasins === 1096, `${metadata.coverage.matchedFoundationBasins}/${foundationBasins.length}`);
check("classification colors", Object.keys(classification.colors || {}).length === 8, `${Object.keys(classification.colors || {}).length} classes`);
check("literature retained", Object.keys(graph.literature?.records || {}).length === Object.keys(literature || {}).length, `${Object.keys(graph.literature?.records || {}).length} records`);
check("old mode concepts removed", !graph.concepts && !(graph.relations || []).some((relation) => String(relation.type).includes("mode")));

const classTotal = Object.values(classification.counts || {}).reduce((sum, count) => sum + count, 0);
check("classification count total", classTotal === metadata.coverage.basins, `${classTotal}`);

console.log("=== Validation complete ===");
if (failed) process.exit(1);
