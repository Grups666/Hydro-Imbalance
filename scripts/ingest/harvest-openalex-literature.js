#!/usr/bin/env node
/**
 * Bulk literature harvester for basin hydrological modes and water-cycle imbalance.
 *
 * It queries OpenAlex by mechanism and basin terms, deduplicates by DOI/OpenAlex ID,
 * preserves manually curated entries, and rewrites catalog/literature/reference-catalog.js.
 */

const fs = require("node:fs");
const https = require("node:https");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const CATALOG_PATH = path.join(ROOT, "catalog/literature/reference-catalog.js");
const RAW_DIR = path.join(ROOT, "data/literature");
const RAW_PATH = path.join(RAW_DIR, "openalex-harvest.json");
const PER_PAGE = Number(process.env.OPENALEX_PER_PAGE || 100);
const MAX_RESULTS_PER_QUERY = Number(process.env.OPENALEX_MAX_PER_QUERY || 100);
const MAILTO = process.env.OPENALEX_MAILTO || "";

const QUERY_GROUPS = [
  {
    mode: "dryIrrigation",
    queries: [
      "groundwater depletion irrigation basin water storage GRACE",
      "groundwater overexploitation aquifer depletion irrigation water cycle",
      "nonrenewable groundwater irrigation food production aquifer",
      "groundwater footprint aquifer water balance",
      "irrigation expansion evapotranspiration water cycle impacts",
      "High Plains Aquifer groundwater depletion irrigation",
      "Ogallala Aquifer groundwater depletion irrigation drought",
      "California Central Valley groundwater depletion drought irrigation",
      "Central Valley groundwater depletion land subsidence irrigation",
      "Indus Basin groundwater depletion irrigation GRACE",
      "Northwest India groundwater depletion irrigation monsoon",
      "North China Plain groundwater depletion irrigation GRACE",
      "Tigris Euphrates groundwater depletion GRACE irrigation drought"
    ]
  },
  {
    mode: "monsoon",
    queries: [
      "monsoon basin groundwater recharge floodplain water storage",
      "Ganges Brahmaputra groundwater recharge monsoon floodplain",
      "Indo Gangetic Basin groundwater depletion recharge irrigation",
      "Ganges Brahmaputra Meghna terrestrial water storage GRACE",
      "monsoon rainfall groundwater storage India GRACE",
      "floodplain river aquifer exchange monsoon basin"
    ]
  },
  {
    mode: "reservoir",
    queries: [
      "reservoir regulation river flow regime hydropower basin",
      "hydropower operations downstream water availability river flow regime",
      "dam regulation flood pulse sediment river basin",
      "global hydropower dams river flow alteration",
      "free flowing rivers dam fragmentation global",
      "Yellow River runoff decline human activities reservoir",
      "Mekong hydropower dams hydrological impacts flow regime",
      "Nile Grand Ethiopian Renaissance Dam reservoir operation drought",
      "Aral Sea irrigation diversion water balance desiccation",
      "Murray Darling environmental flows drought water management"
    ]
  },
  {
    mode: "humid",
    queries: [
      "humid basin runoff climate change flood extremes hydrology",
      "water cycle intensification runoff precipitation extremes basin",
      "river floods climate change humid basins",
      "land use change runoff humid catchment hydrology",
      "streamflow change climate variability human activities humid basin"
    ]
  },
  {
    mode: "tropical",
    queries: [
      "tropical forest basin evapotranspiration rainfall recycling hydrology",
      "Amazon basin water cycle deforestation rainfall recycling",
      "tropical rainforest hydrology runoff evapotranspiration basin",
      "Congo basin hydrology water cycle rainfall evapotranspiration",
      "tropical floodplain inundation water storage remote sensing"
    ]
  },
  {
    mode: "boreal",
    queries: [
      "boreal basin snowmelt wetland storage hydrology",
      "Arctic basin hydrology permafrost thaw runoff groundwater",
      "high latitude river discharge snowmelt permafrost water cycle",
      "permafrost thaw hydrologic impacts basin runoff",
      "boreal wetlands runoff storage climate change"
    ]
  },
  {
    mode: "snow",
    queries: [
      "snow dominated basin water availability climate change runoff timing",
      "glacier melt runoff basin climate change water resources",
      "snow drought hydrology basin runoff climate change",
      "mountain snowpack runoff timing water availability",
      "cryosphere water towers basin runoff climate change"
    ]
  },
  {
    mode: "mountain",
    queries: [
      "mountain water towers runoff downstream water supply",
      "orographic precipitation mountain basin hydrology runoff",
      "Himalayan water towers glacier snow runoff basin",
      "Andes glacier runoff water resources basin",
      "mountain headwater catchment climate change hydrology"
    ]
  },
  {
    mode: "dryNatural",
    queries: [
      "dryland river ephemeral flow transmission losses hydrology",
      "arid basin runoff recharge episodic rainfall hydrology",
      "semiarid catchment runoff generation water balance",
      "ephemeral stream groundwater recharge arid basin",
      "dryland water cycle climate variability runoff"
    ]
  },
  {
    mode: "lowHumanImpact",
    queries: [
      "low human impact basin natural flow regime hydrology",
      "natural river flow regime reference condition hydrology",
      "pristine basin hydrology climate variability runoff",
      "global river threats water security biodiversity low impact basins",
      "free flowing rivers hydrological connectivity biodiversity"
    ]
  },
  {
    mode: "mixed",
    queries: [
      "terrestrial water storage trends basin GRACE climate human activities",
      "water cycle imbalance basin climate change human activities",
      "hydrological regime change basin attribution climate human",
      "freshwater availability trends GRACE global basins",
      "human water use impacts global hydrological cycle"
    ]
  }
];

function loadExistingCatalog() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(CATALOG_PATH, "utf8"), context, { filename: CATALOG_PATH });
  return context.window.REFERENCE_CATALOG || {};
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      family: 4,
      timeout: 30_000,
      headers: { "User-Agent": "SpatialResearchOS/0.1 literature harvester" }
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 300)}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on("timeout", () => {
      req.destroy(new Error("OpenAlex request timed out"));
    });
    req.on("error", reject);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function restoreAbstract(invertedIndex) {
  if (!invertedIndex) return "";
  const words = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const position of positions) words[position] = word;
  }
  return words.filter(Boolean).join(" ");
}

function cleanDoi(doi) {
  return (doi || "").replace(/^https:\/\/doi\.org\//i, "").trim();
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/https:\/\/openalex\.org\//, "openalex")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 70);
}

function entryIdFor(work) {
  const doi = cleanDoi(work.doi);
  if (doi) return `oa_${slug(doi)}`;
  return `oa_${slug(work.id || work.display_name || work.title)}`;
}

function firstAuthorYearId(work) {
  const first = work.authorships?.[0]?.author?.display_name || "openalex";
  const year = work.publication_year || "na";
  return `${slug(first).replace(/_/g, "")}${year}`;
}

function authors(work) {
  const names = (work.authorships || []).map((item) => item.author?.display_name).filter(Boolean);
  if (names.length <= 8) return names.join(", ");
  return `${names.slice(0, 8).join(", ")}, et al.`;
}

function affiliations(work) {
  const institutions = [];
  for (const authorship of work.authorships || []) {
    for (const institution of authorship.institutions || []) {
      if (institution.display_name && !institutions.includes(institution.display_name)) {
        institutions.push(institution.display_name);
      }
    }
  }
  return institutions.slice(0, 8).join("; ");
}

function sourceName(work) {
  return work.primary_location?.source?.display_name ||
    work.locations?.find((location) => location.source?.display_name)?.source?.display_name ||
    "";
}

function isRelevant(work) {
  const text = [
    work.display_name,
    sourceName(work),
    restoreAbstract(work.abstract_inverted_index),
    ...(work.concepts || []).map((concept) => concept.display_name)
  ].join(" ").toLowerCase();
  const required = ["water", "hydrolog", "groundwater", "river", "runoff", "basin", "catchment", "aquifer", "irrigation", "reservoir", "drought", "snow", "glacier", "flood", "streamflow", "freshwater", "storage"];
  return required.some((term) => text.includes(term));
}

function likelyHighQuality(work) {
  const cited = work.cited_by_count || 0;
  const venue = sourceName(work).toLowerCase();
  const strongVenues = [
    "nature", "science", "proceedings of the national academy", "water resources research",
    "journal of hydrology", "geophysical research letters", "hydrology and earth system sciences",
    "earth-science reviews", "nature communications", "nature climate change", "nature geoscience",
    "nature water", "remote sensing of environment", "environmental research letters",
    "science of the total environment", "global change biology", "climatic change"
  ];
  return cited >= 15 || strongVenues.some((name) => venue.includes(name));
}

function convertWork(work, mode, query) {
  const doi = cleanDoi(work.doi);
  const abstract = restoreAbstract(work.abstract_inverted_index);
  return {
    title: work.display_name || work.title || "",
    authors: authors(work),
    affiliations: affiliations(work) || "Not available from OpenAlex metadata.",
    year: String(work.publication_year || ""),
    venue: sourceName(work),
    journal_quartile: "candidate-Q1-or-high-impact",
    doi,
    external_url: doi ? `https://doi.org/${doi}` : (work.id || ""),
    openalex_id: work.id || "",
    cited_by_count: work.cited_by_count || 0,
    study_regions: ["mode-level"],
    water_cycle_mode: mode,
    relevance: `Harvested from OpenAlex query "${query}" for ${mode} water-cycle mode and basin water-cycle imbalance coverage.`,
    abstract: abstract || "Abstract not available from OpenAlex metadata.",
    harvested: true
  };
}

async function fetchQuery(query, mode) {
  const results = [];
  const search = encodeURIComponent(query);
  const select = [
    "id", "doi", "display_name", "publication_year", "authorships", "primary_location",
    "locations", "abstract_inverted_index", "cited_by_count", "concepts"
  ].join(",");
  const mailto = MAILTO ? `&mailto=${encodeURIComponent(MAILTO)}` : "";
  const url = `https://api.openalex.org/works?search=${search}&filter=type:article,from_publication_date:1980-01-01&sort=cited_by_count:desc&per-page=${PER_PAGE}&select=${select}${mailto}`;
  const data = await requestJson(url);
  for (const work of data.results || []) {
    if (results.length >= MAX_RESULTS_PER_QUERY) break;
    if (!isRelevant(work)) continue;
    if (!likelyHighQuality(work)) continue;
    results.push(convertWork(work, mode, query));
  }
  return results;
}

function mergeCatalog(existing, harvested) {
  const merged = { ...existing };
  const seen = new Set();

  for (const [id, entry] of Object.entries(existing)) {
    if (entry.doi) seen.add(`doi:${cleanDoi(entry.doi).toLowerCase()}`);
    if (entry.openalex_id) seen.add(`oa:${entry.openalex_id}`);
    seen.add(`title:${String(entry.title || "").toLowerCase()}`);
  }

  let added = 0;
  for (const entry of harvested) {
    const doiKey = entry.doi ? `doi:${entry.doi.toLowerCase()}` : "";
    const oaKey = entry.openalex_id ? `oa:${entry.openalex_id}` : "";
    const titleKey = `title:${String(entry.title || "").toLowerCase()}`;
    if ((doiKey && seen.has(doiKey)) || (oaKey && seen.has(oaKey)) || seen.has(titleKey)) continue;

    let id = entryIdFor(entry);
    if (!id || id === "oa") id = firstAuthorYearId(entry);
    let finalId = id;
    let suffix = 2;
    while (merged[finalId]) finalId = `${id}_${suffix++}`;

    merged[finalId] = entry;
    if (doiKey) seen.add(doiKey);
    if (oaKey) seen.add(oaKey);
    seen.add(titleKey);
    added += 1;
  }
  return { merged, added };
}

function writeCatalog(catalog) {
  const ordered = Object.fromEntries(Object.entries(catalog).sort(([a], [b]) => a.localeCompare(b)));
  const content = `window.REFERENCE_CATALOG = ${JSON.stringify(ordered, null, 2)};\n`;
  fs.writeFileSync(CATALOG_PATH, content, "utf8");
}

async function main() {
  const existing = loadExistingCatalog();
  const harvested = [];
  const errors = [];
  fs.mkdirSync(RAW_DIR, { recursive: true });

  for (const group of QUERY_GROUPS) {
    for (const query of group.queries) {
      try {
        console.log(`[${group.mode}] ${query}`);
        const works = await fetchQuery(query, group.mode);
        harvested.push(...works);
        console.log(`  -> ${works.length} candidate records`);
        await sleep(180);
      } catch (error) {
        errors.push({ mode: group.mode, query, error: error.message });
        console.error(`  !! ${error.message}`);
      }
    }
  }

  const { merged, added } = mergeCatalog(existing, harvested);
  fs.writeFileSync(RAW_PATH, JSON.stringify({
    harvested_at: new Date().toISOString(),
    query_groups: QUERY_GROUPS,
    candidate_count: harvested.length,
    added_count: added,
    errors,
    records: harvested
  }, null, 2), "utf8");
  writeCatalog(merged);

  console.log("");
  console.log(`Existing records: ${Object.keys(existing).length}`);
  console.log(`Harvested candidates: ${harvested.length}`);
  console.log(`Added records: ${added}`);
  console.log(`Final catalog records: ${Object.keys(merged).length}`);
  console.log(`Raw harvest: ${RAW_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
