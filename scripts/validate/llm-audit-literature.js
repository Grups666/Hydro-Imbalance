#!/usr/bin/env node
/**
 * LLM semantic audit for literature-to-region/mode alignment.
 *
 * The script reads title/abstract metadata, asks an Anthropic Messages compatible
 * model to identify study area and hydrological processes, saves resumable audit
 * results, and writes the semantic alignment back to the browser catalog.
 */

const fs = require("node:fs");
const https = require("node:https");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const CATALOG_PATH = path.join(ROOT, "catalog/literature/reference-catalog.js");
const REGION_PATH = path.join(ROOT, "catalog/regions/basin-profiles.js");
const CONFIG_PATH = path.join(ROOT, "config/atlas.local.json");
const REPORT_PATH = path.join(ROOT, "data/literature/llm-alignment-audit.json");
const BATCH_SIZE = Number(process.env.LLM_AUDIT_BATCH_SIZE || 12);
const LIMIT = Number(process.env.LLM_AUDIT_LIMIT || 0);
const FORCE = process.env.LLM_AUDIT_FORCE === "1";
const APPLY_ONLY = process.env.LLM_AUDIT_APPLY_ONLY === "1";
const DELAY_MS = Number(process.env.LLM_AUDIT_DELAY_MS || 1500);
const RETRIES = Number(process.env.LLM_AUDIT_RETRIES || 2);

function readJsonIfExists(filePath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return fallback;
  }
}

function loadBrowserGlobal(filePath, globalName) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(filePath, "utf8"), context, { filename: filePath });
  return context.window[globalName];
}

function writeBrowserCatalog(catalog) {
  const ordered = Object.fromEntries(Object.entries(catalog).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(CATALOG_PATH, `window.REFERENCE_CATALOG = ${JSON.stringify(ordered, null, 2)};\n`, "utf8");
}

function setting(config, name, fallback = "") {
  return process.env[name] || config[name] || fallback;
}

function truncate(value, max = 900) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length <= max ? text : `${text.slice(0, max)}...`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function promptForBatch(items, explorer) {
  const modes = Object.keys(explorer.modes || {});
  const regions = (explorer.highlightedRegions || []).map((region) => ({
    id: region.id,
    name: region.name,
    mode: region.mode,
    label: region.label,
    bbox: region.match
  }));

  return [
    "You are auditing a hydrology literature catalog for a map-based research system.",
    "For each paper, read the title, abstract, candidate mode, venue, and source query context.",
    "Decide whether the paper should be attached to the candidate hydrological mode and/or to a named case-study region.",
    "Do not rely on keyword matching only. Infer the study area and hydrological process from the abstract when possible.",
    "If a paper is global, conceptual, or methodological and relevant to a mode, attach it to the mode rather than a specific region.",
    "If the paper is not about hydrology, water cycle, basin water resources, groundwater, river flow, snow/glacier, reservoirs, drought, floods, or related Earth-system water processes, mark it reject.",
    "",
    `Allowed hydrological modes: ${modes.join(", ")}`,
    `Case-study regions: ${JSON.stringify(regions)}`,
    "",
    "Return only valid JSON. No markdown.",
    "Return an array with exactly one object per input item. Schema:",
    JSON.stringify({
      id: "catalog id",
      study_area_type: "specific_basin | named_region | country_or_multi_country | global | conceptual | unclear",
      study_area_names: ["names explicitly or implicitly studied"],
      countries_or_regions: ["countries or macro-regions if inferable"],
      hydrological_processes: ["groundwater depletion", "reservoir regulation", "snowmelt runoff"],
      recommended_modes: ["one or more allowed modes"],
      recommended_region_ids: ["case-study ids only if clearly matched"],
      attach_scope: "specific_region | mode_level | global_concept | reject",
      alignment_status: "approve | review | reject",
      confidence: 0.0,
      reason: "brief reason"
    }),
    "",
    "Input items:",
    JSON.stringify(items.map(([id, entry]) => ({
      id,
      title: entry.title,
      abstract: truncate(entry.abstract, 1000),
      candidate_mode: entry.water_cycle_mode || "",
      current_study_regions: entry.study_regions || [],
      venue: entry.venue || "",
      relevance_note: truncate(entry.relevance, 400)
    })))
  ].join("\n");
}

function requestMessage(config, prompt) {
  const apiKey = setting(config, "ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
  const baseUrl = setting(config, "ANTHROPIC_BASE_URL", "https://api.anthropic.com").replace(/\/$/, "");
  const model = setting(config, "ANTHROPIC_MODEL", setting(config, "ANTHROPIC_DEFAULT_SONNET_MODEL", "claude-3-5-sonnet-latest"));
  const body = JSON.stringify({
    model,
    max_tokens: 12000,
    temperature: 0,
    messages: [{ role: "user", content: prompt }]
  });

  return new Promise((resolve, reject) => {
    const url = new URL(`${baseUrl}/v1/messages`);
    const req = https.request({
      hostname: url.hostname,
      path: `${url.pathname}${url.search}`,
      method: "POST",
      family: 4,
      timeout: 90_000,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      }
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`LLM HTTP ${res.statusCode}: ${data.slice(0, 600)}`));
          return;
        }
        try {
          const json = JSON.parse(data);
          const text = Array.isArray(json.content)
            ? json.content.map((part) => part.text || "").join("\n")
            : JSON.stringify(json);
          resolve(text);
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error("LLM request timed out")));
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function parseJsonArray(text) {
  const clean = String(text || "").replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Fall through to bracket extraction.
  }
  const start = clean.indexOf("[");
  const end = clean.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) throw new Error(`No JSON array found: ${clean.slice(0, 300)}`);
  const parsed = JSON.parse(clean.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error("LLM response JSON is not an array");
  return parsed;
}

function saveReport(report) {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
}

function applyAuditToCatalog(catalog, report) {
  const records = report.records || {};
  for (const [id, result] of Object.entries(records)) {
    if (!catalog[id]) continue;
    catalog[id].llm_audited = true;
    catalog[id].llm_study_area_type = result.study_area_type || "unclear";
    catalog[id].llm_study_area_names = result.study_area_names || [];
    catalog[id].llm_countries_or_regions = result.countries_or_regions || [];
    catalog[id].llm_hydrological_processes = result.hydrological_processes || [];
    catalog[id].llm_recommended_modes = result.recommended_modes || [];
    catalog[id].llm_recommended_region_ids = result.recommended_region_ids || [];
    catalog[id].llm_attach_scope = result.attach_scope || "review";
    catalog[id].llm_alignment_status = result.alignment_status || "review";
    catalog[id].llm_confidence = typeof result.confidence === "number" ? result.confidence : null;
    catalog[id].llm_reason = result.reason || "";
  }
}

async function main() {
  const config = readJsonIfExists(CONFIG_PATH);
  const catalog = loadBrowserGlobal(CATALOG_PATH, "REFERENCE_CATALOG") || {};
  const explorer = loadBrowserGlobal(REGION_PATH, "RESEARCH_EXPLORER") || {};
  const report = readJsonIfExists(REPORT_PATH, {
    generated_at: new Date().toISOString(),
    updated_at: null,
    records: {},
    errors: []
  });

  if (APPLY_ONLY) {
    applyAuditToCatalog(catalog, report);
    writeBrowserCatalog(catalog);
    console.log(`Applied ${Object.keys(report.records || {}).length} LLM audit records to catalog.`);
    return;
  }

  const allEntries = Object.entries(catalog)
    .filter(([id, entry]) => FORCE || !report.records?.[id] || !entry.llm_audited)
    .sort(([, a], [, b]) => {
      const ah = a.harvested ? 1 : 0;
      const bh = b.harvested ? 1 : 0;
      return ah - bh || (b.cited_by_count || 0) - (a.cited_by_count || 0);
    });
  const entries = LIMIT > 0 ? allEntries.slice(0, LIMIT) : allEntries;
  console.log(`LLM audit queue: ${entries.length} of ${Object.keys(catalog).length} records. Batch size: ${BATCH_SIZE}`);

  for (let index = 0; index < entries.length; index += BATCH_SIZE) {
    const batch = entries.slice(index, index + BATCH_SIZE);
    const ids = batch.map(([id]) => id);
    try {
      console.log(`Batch ${Math.floor(index / BATCH_SIZE) + 1}: ${ids.join(", ")}`);
      let text = "";
      let lastError = null;
      for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
        try {
          if (attempt > 0) await sleep(DELAY_MS * (attempt + 1));
          text = await requestMessage(config, promptForBatch(batch, explorer));
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          console.error(`  attempt ${attempt + 1} failed: ${error.message}`);
        }
      }
      if (lastError) throw lastError;
      const results = parseJsonArray(text);
      for (const result of results) {
        if (!result.id || !catalog[result.id]) continue;
        report.records[result.id] = result;
      }
      report.updated_at = new Date().toISOString();
      saveReport(report);
      applyAuditToCatalog(catalog, report);
      writeBrowserCatalog(catalog);
      console.log(`  saved ${results.length} results; total audited ${Object.keys(report.records).length}`);
      if (DELAY_MS > 0) await sleep(DELAY_MS);
    } catch (error) {
      report.errors.push({ ids, error: error.message, at: new Date().toISOString() });
      saveReport(report);
      console.error(`  failed: ${error.message}`);
    }
  }

  applyAuditToCatalog(catalog, report);
  writeBrowserCatalog(catalog);
  console.log(`LLM audit complete. Audited records: ${Object.keys(report.records || {}).length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
