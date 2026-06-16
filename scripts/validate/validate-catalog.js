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
  check(`${prefix} no literature graph`, !manifest.knowledgeGraph, manifest.knowledgeGraph || "none");
  check(`${prefix} no literature panel`, !(manifest.provides?.panels || []).some((panel) => /literature/i.test(panel.id || panel.name || "")));
  check(`${prefix} three variables`, metadata.variables?.length === 3, metadata.variables?.map((item) => item.id).join(", "));
  check(`${prefix} classification coverage`, Object.keys(classification.basins || {}).length === metadata.coverage.basins, `${Object.keys(classification.basins || {}).length} basins`);
  check(`${prefix} basin matches`, metadata.coverage.matchedBasins > 0 && metadata.coverage.matchedBasins <= metadata.coverage.basins, `${metadata.coverage.matchedBasins}/${metadata.coverage.basins}`);
  check(`${prefix} classification colors`, Object.keys(classification.colors || {}).length === 8, `${Object.keys(classification.colors || {}).length} classes`);

  const classTotal = Object.values(classification.counts || {}).reduce((sum, count) => sum + count, 0);
  check(`${prefix} classification count total`, classTotal === metadata.coverage.basins, `${classTotal}`);
}

console.log("=== Validation complete ===");
if (failed) process.exit(1);
