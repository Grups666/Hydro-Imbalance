#!/usr/bin/env node
/**
 * Exports an LLM-audit-based mode coverage summary for frontend/profile review.
 */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const CATALOG_PATH = path.join(ROOT, "catalog/literature/reference-catalog.js");
const OUT_PATH = path.join(ROOT, "data/literature/llm-mode-summary.json");

function loadCatalog() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(CATALOG_PATH, "utf8"), context, { filename: CATALOG_PATH });
  return context.window.REFERENCE_CATALOG || {};
}

function main() {
  const catalog = loadCatalog();
  const summary = {};

  for (const [id, entry] of Object.entries(catalog)) {
    if (!entry.llm_audited || entry.llm_alignment_status === "reject") continue;
    const modes = entry.llm_recommended_modes?.length ? entry.llm_recommended_modes : [entry.water_cycle_mode || "mixed"];
    for (const mode of modes) {
      summary[mode] ||= {
        total: 0,
        processes: {},
        study_area_types: {},
        regions: {},
        top_references: []
      };
      const bucket = summary[mode];
      bucket.total += 1;
      bucket.study_area_types[entry.llm_study_area_type || "unclear"] =
        (bucket.study_area_types[entry.llm_study_area_type || "unclear"] || 0) + 1;
      for (const process of entry.llm_hydrological_processes || []) {
        bucket.processes[process] = (bucket.processes[process] || 0) + 1;
      }
      for (const area of entry.llm_study_area_names || []) {
        bucket.regions[area] = (bucket.regions[area] || 0) + 1;
      }
      bucket.top_references.push({
        id,
        title: entry.title,
        venue: entry.venue,
        year: entry.year,
        cited_by_count: entry.cited_by_count || 0,
        confidence: entry.llm_confidence
      });
    }
  }

  for (const bucket of Object.values(summary)) {
    bucket.processes = Object.fromEntries(Object.entries(bucket.processes).sort((a, b) => b[1] - a[1]).slice(0, 30));
    bucket.regions = Object.fromEntries(Object.entries(bucket.regions).sort((a, b) => b[1] - a[1]).slice(0, 30));
    bucket.top_references = bucket.top_references
      .sort((a, b) => (b.cited_by_count || 0) - (a.cited_by_count || 0))
      .slice(0, 25);
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify({
    generated_at: new Date().toISOString(),
    audited_records_used: Object.values(summary).reduce((sum, item) => sum + item.total, 0),
    modes: summary
  }, null, 2), "utf8");
  console.log(`Wrote ${OUT_PATH}`);
  console.log(JSON.stringify(Object.fromEntries(Object.entries(summary).map(([mode, item]) => [mode, item.total])), null, 2));
}

main();
