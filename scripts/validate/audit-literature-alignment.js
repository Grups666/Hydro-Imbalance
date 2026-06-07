#!/usr/bin/env node
/**
 * Audits whether harvested papers align with their assigned water-cycle mode.
 * The audit is conservative: it flags weak matches instead of deleting records.
 */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const CATALOG_PATH = path.join(ROOT, "catalog/literature/reference-catalog.js");
const REPORT_PATH = path.join(ROOT, "data/literature/alignment-audit.json");

const MODE_KEYWORDS = {
  dryIrrigation: {
    strong: ["groundwater", "aquifer", "irrigation", "pumping", "depletion", "overexploitation", "withdrawal", "water table", "subsidence"],
    context: ["arid", "semiarid", "drought", "storage", "grace", "agriculture", "crop", "recharge"]
  },
  monsoon: {
    strong: ["monsoon", "ganges", "brahmaputra", "indo-gangetic", "floodplain", "seasonal rainfall"],
    context: ["recharge", "groundwater", "river-aquifer", "inundation", "storage", "india", "bangladesh", "precipitation"]
  },
  reservoir: {
    strong: ["reservoir", "dam", "hydropower", "flow regulation", "regulated", "operation", "allocation", "diversion"],
    context: ["downstream", "sediment", "flood pulse", "river flow", "environmental flow", "transboundary", "water availability"]
  },
  humid: {
    strong: ["humid", "runoff", "streamflow", "flood", "precipitation extremes", "rainfall-runoff"],
    context: ["climate change", "catchment", "basin", "land use", "hydrologic", "soil moisture"]
  },
  tropical: {
    strong: ["tropical", "amazon", "congo", "rainforest", "forest", "evapotranspiration", "rainfall recycling"],
    context: ["deforestation", "inundation", "floodplain", "moisture", "runoff", "wetland"]
  },
  boreal: {
    strong: ["boreal", "arctic", "permafrost", "high-latitude", "snowmelt", "wetland", "peatland"],
    context: ["thaw", "frozen", "northern", "runoff", "groundwater", "storage", "river discharge"]
  },
  snow: {
    strong: ["snow", "snowpack", "glacier", "cryosphere", "meltwater", "snowmelt", "rain-on-snow"],
    context: ["runoff timing", "water availability", "warming", "mountain", "seasonal", "ice"]
  },
  mountain: {
    strong: ["mountain", "orographic", "headwater", "water tower", "himalaya", "andes", "alpine"],
    context: ["snow", "glacier", "runoff", "downstream", "elevation", "precipitation"]
  },
  dryNatural: {
    strong: ["dryland", "arid", "semiarid", "ephemeral", "wadi", "transmission loss", "desert"],
    context: ["runoff", "recharge", "episodic", "rainfall", "flash flood", "infiltration"]
  },
  lowHumanImpact: {
    strong: ["natural flow", "reference condition", "pristine", "free-flowing", "low impact", "undisturbed"],
    context: ["biodiversity", "connectivity", "river", "hydrologic regime", "baseline", "ecosystem"]
  },
  mixed: {
    strong: ["water cycle", "terrestrial water storage", "freshwater", "hydrological change", "human activities", "climate change"],
    context: ["grace", "basin", "runoff", "streamflow", "groundwater", "storage", "attribution"]
  },
  managed: {
    strong: ["managed", "management", "recovery", "water transfer", "governance", "policy", "restoration"],
    context: ["groundwater", "allocation", "irrigation", "extraction", "recharge", "basin"]
  }
};

function loadCatalog() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(CATALOG_PATH, "utf8"), context, { filename: CATALOG_PATH });
  return context.window.REFERENCE_CATALOG || {};
}

function normalize(text) {
  return String(text || "").toLowerCase();
}

function scoreEntry(entry) {
  const mode = entry.water_cycle_mode || "mixed";
  const rules = MODE_KEYWORDS[mode] || MODE_KEYWORDS.mixed;
  const text = normalize([
    entry.title,
    entry.abstract,
    entry.relevance,
    entry.venue,
    entry.study_regions?.join(" ")
  ].join(" "));

  const strongHits = rules.strong.filter((keyword) => text.includes(keyword));
  const contextHits = rules.context.filter((keyword) => text.includes(keyword));
  const genericHydrology = ["water", "hydrolog", "river", "basin", "catchment", "runoff", "groundwater", "streamflow", "storage", "precipitation"].filter((keyword) => text.includes(keyword));

  const score = strongHits.length * 3 + contextHits.length + Math.min(genericHydrology.length, 3);
  let status = "low";
  if (strongHits.length >= 2 || score >= 8) status = "high";
  else if (strongHits.length >= 1 || score >= 5) status = "medium";

  return {
    score,
    status,
    strongHits,
    contextHits,
    genericHits: genericHydrology
  };
}

function writeCatalog(catalog) {
  const ordered = Object.fromEntries(Object.entries(catalog).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(CATALOG_PATH, `window.REFERENCE_CATALOG = ${JSON.stringify(ordered, null, 2)};\n`, "utf8");
}

function main() {
  const catalog = loadCatalog();
  const summary = {};
  const low = [];
  const medium = [];

  for (const [id, entry] of Object.entries(catalog)) {
    const audit = scoreEntry(entry);
    entry.alignment_score = audit.score;
    entry.alignment_status = audit.status;
    entry.alignment_terms = {
      strong: audit.strongHits,
      context: audit.contextHits,
      generic: audit.genericHits
    };
    const mode = entry.water_cycle_mode || "missing";
    summary[mode] ||= { high: 0, medium: 0, low: 0, total: 0 };
    summary[mode][audit.status] += 1;
    summary[mode].total += 1;
    if (audit.status === "low") low.push({ id, mode, score: audit.score, title: entry.title });
    if (audit.status === "medium") medium.push({ id, mode, score: audit.score, title: entry.title });
  }

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify({
    generated_at: new Date().toISOString(),
    summary,
    low_count: low.length,
    medium_count: medium.length,
    low,
    medium_sample: medium.slice(0, 200)
  }, null, 2), "utf8");
  writeCatalog(catalog);

  console.log(JSON.stringify({ total: Object.keys(catalog).length, summary, low_count: low.length, report: REPORT_PATH }, null, 2));
}

main();
