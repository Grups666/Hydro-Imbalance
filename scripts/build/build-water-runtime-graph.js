/**
 * Build the browser runtime graph from the complete literature knowledge graph.
 * The full catalog remains the source of truth; the browser receives only records
 * referenced by active region relations.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");
const sourcePath = path.join(root, "public/modules/water-imbalance/data/knowledge-graph.json");
const outputPath = path.join(root, "public/modules/water-imbalance/data/runtime-graph.json");
const graph = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const relations = graph.relations || [];
const recordIds = new Set(relations.map((relation) => relation.source).filter(Boolean));
const records = Object.fromEntries(
  Object.entries(graph.literature?.records || {}).filter(([id]) => recordIds.has(id))
);

const runtimeGraph = {
  schema: graph.schema,
  module: graph.module,
  generatedFrom: [path.relative(root, sourcePath).replace(/\\/g, "/")],
  spatialContexts: graph.spatialContexts,
  literature: { records },
  relations
};

fs.writeFileSync(outputPath, JSON.stringify(runtimeGraph, null, 2) + "\n");
console.log(`Wrote ${path.relative(root, outputPath)} with ${Object.keys(records).length} linked records.`);
