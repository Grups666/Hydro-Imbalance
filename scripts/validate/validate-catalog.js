#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");
let failed = false;

function check(label, condition, detail) {
  if (condition) {
    console.log(`  OK ${label}${detail ? `: ${detail}` : ""}`);
  } else {
    failed = true;
    console.error(`  ERROR ${label}${detail ? `: ${detail}` : ""}`);
  }
}

console.log("=== Hydro-Imbalance validation ===");

const modules = [
  { moduleName: "water-imbalance", manifestFile: "module.json" },
  { moduleName: "water-imbalance-wmo", manifestFile: "module-wmo.json" }
];

for (const { moduleName, manifestFile } of modules) {
  const moduleDir = path.join(root, "public/modules", moduleName);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, manifestFile), "utf8"));
  const metadata = JSON.parse(fs.readFileSync(path.join(moduleDir, "data/basin-time-series-metadata.json"), "utf8"));
  const classification = JSON.parse(fs.readFileSync(path.join(moduleDir, "data/basin-imbalance-classification.json"), "utf8"));
  const prefix = moduleName;

  check(`${prefix} module version`, manifest.version === "0.1.1", manifest.version);
  check(`${prefix} manifest file`, manifest.id === moduleName, `${manifestFile}: ${manifest.id}`);
  check(`${prefix} entry`, manifest.entry === "./public/modules/water-imbalance/index.js", manifest.entry);
  check(`${prefix} no legacy knowledge graph`, !manifest.knowledgeGraph, manifest.knowledgeGraph || "none");
  check(`${prefix} three variables`, metadata.variables?.length === 3, metadata.variables?.map((item) => item.id).join(", "));
  check(`${prefix} literature evidence metadata`, metadata.literatureEvidence === "./basin-literature-evidence.json", metadata.literatureEvidence || "missing");
  check(`${prefix} classification coverage`, Object.keys(classification.basins || {}).length === metadata.coverage.basins, `${Object.keys(classification.basins || {}).length} basins`);
  check(`${prefix} basin matches`, metadata.coverage.matchedBasins > 0 && metadata.coverage.matchedBasins <= metadata.coverage.basins, `${metadata.coverage.matchedBasins}/${metadata.coverage.basins}`);
  check(`${prefix} classification colors`, Object.keys(classification.colors || {}).length === 8, `${Object.keys(classification.colors || {}).length} classes`);

  const classTotal = Object.values(classification.counts || {}).reduce((sum, count) => sum + count, 0);
  check(`${prefix} classification count total`, classTotal === metadata.coverage.basins, `${classTotal}`);

  const evidencePath = path.join(moduleDir, "data/basin-literature-evidence.json");
  const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  const glacierEntries = (evidence.entries || []).filter((entry) => entry.variableKey === "glacier");
  const groundwaterEntries = (evidence.entries || []).filter((entry) => entry.variableKey === "groundwater");
  const deficitEntries = (evidence.entries || []).filter((entry) => entry.variableKey === "deficit");
  check(`${prefix} literature evidence entries`, glacierEntries.length >= 3, `${glacierEntries.length} glacier entries`);
  check(`${prefix} groundwater evidence entries`, groundwaterEntries.length >= 3, `${groundwaterEntries.length} groundwater entries`);
  check(`${prefix} deficit evidence entries`, deficitEntries.length >= 3, `${deficitEntries.length} deficit entries`);
  check(`${prefix} literature evidence schema`, evidence.schema === "basin-literature-evidence/v2", evidence.schema);
  check(`${prefix} literature variable coverage`, ["glacier", "groundwater", "deficit"].every((key) => (evidence.variableCoverage || []).includes(key)), (evidence.variableCoverage || []).join(", "));
  check(`${prefix} literature evidence basin links`, Object.keys(evidence.byBasin || {}).length > 0, `${Object.keys(evidence.byBasin || {}).length} basins`);
  check(`${prefix} literature evidence DOI links`, (evidence.entries || []).every((entry) => entry.doi && entry.url), "doi/url present");
}

console.log("=== Validation complete ===");
if (failed) process.exit(1);
