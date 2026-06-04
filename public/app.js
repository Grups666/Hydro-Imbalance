const canvas = document.querySelector("#mapCanvas");
const ctx = canvas.getContext("2d");
const panel = document.querySelector("#basinPanel");
const profile = document.querySelector("#basinProfile");
const basinCount = document.querySelector("#basinCount");
const interactionHint = document.querySelector("#interactionHint");
const llmStatus = document.querySelector("#llmStatus");
const legendList = document.querySelector("#legendList");
const toast = document.querySelector("#toast");
const queryForm = document.querySelector("#queryForm");
const queryInput = document.querySelector("#queryInput");
const micButton = document.querySelector("#micButton");
const researchPanel = document.querySelector("#researchPanel");
const researchTitle = document.querySelector("#researchTitle");
const researchContent = document.querySelector("#researchContent");
const referencePanel = document.querySelector("#referencePanel");
const referenceTitle = document.querySelector("#referenceTitle");
const referenceContent = document.querySelector("#referenceContent");
const voiceDock = document.getElementById("voiceDock");
const legendPanel = document.getElementById("legendPanel");
const legendToggle = document.getElementById("legendToggle");

const modes = window.RESEARCH_EXPLORER.modes;
const highlightedRegions = window.RESEARCH_EXPLORER.highlightedRegions;
const modeProfiles = window.RESEARCH_EXPLORER.modeProfiles || {};
const referenceCatalog = window.REFERENCE_CATALOG || {};
const basins = window.BASIN_DATA?.basins || [];
const landRings = window.LAND_50M || [];

let width = 0;
let height = 0;
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let hoveredBasin = null;
let selectedBasin = null;
let dragging = false;
let dragStart = null;
let prepared = [];
let redrawPending = false;
let fadeTimer = null;
let isRecording = false;
let waveformCanvas = null;
let waveformCtx = null;
let voiceAnalyser = null;
let voiceDataArray = null;
let spacePressTimer = null;
let spaceTriggeredVoice = false;
let voiceStartRecording = null;
let voiceStopRecording = null;

const FADE_DELAY = 5000;
const LONG_PRESS_DELAY = 300;

function getBaseScale() {
  return height / 180;
}

function normalizeLon(lon) {
  while (lon > 180) lon -= 360;
  while (lon < -180) lon += 360;
  return lon;
}

function clampOffsetY() {
  const mapHeight = 180 * getBaseScale() * scale;
  if (mapHeight <= height) {
    offsetY = 0;
  } else {
    const maxOffsetY = (mapHeight - height) / 2;
    offsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, offsetY));
  }
}

function bboxCenter(bbox) {
  return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
}

function regionForBasin(basin) {
  const [lon, lat] = bboxCenter(basin.bbox);
  return highlightedRegions.find((r) => (
    lon >= r.match.lon[0] && lon <= r.match.lon[1] &&
    lat >= r.match.lat[0] && lat <= r.match.lat[1]
  ));
}

function inferredModeForBasin(basin) {
  const region = regionForBasin(basin);
  if (region) return region.mode;
  const [lon, lat] = bboxCenter(basin.bbox);
  const absLat = Math.abs(lat);
  const isLarge = basin.areaKm2 > 150000;
  const isSmall = basin.areaKm2 < 50000;
  const tropicalBelt = absLat < 12;
  const subtropicalDryBelt = absLat >= 12 && absLat <= 35;
  const midLatitude = absLat > 35 && absLat <= 55;
  const highLatitude = absLat > 55;
  const mountainAsia = basin.region === "AS" && lon >= 65 && lon <= 105 && lat >= 25 && lat <= 42;
  const andes = basin.region === "SA" && lon >= -82 && lon <= -65 && lat >= -55 && lat <= 12;
  const rockyMountains = basin.region === "NA" && lon >= -125 && lon <= -100 && lat >= 30 && lat <= 60;
  const alpineEurope = basin.region === "EU" && lon >= 5 && lon <= 25 && lat >= 42 && lat <= 49;
  const eastSouthAsiaMonsoon = basin.region === "AS" && lat > 5 && lat < 32 && lon >= 70 && lon <= 125;
  const westAfricaMonsoon = basin.region === "AF" && lat > 4 && lat < 18 && lon >= -18 && lon <= 35;
  const southAmericaTropical = basin.region === "SA" && tropicalBelt;
  const australiaDry = basin.region === "AU" && lat < -15 && lat > -38;
  const africaDry = basin.region === "AF" && subtropicalDryBelt && !(westAfricaMonsoon && !isSmall);

  if (highLatitude) return basin.region === "EU" || basin.region === "NA" || basin.region === "AS" ? "boreal" : "snow";
  if (mountainAsia || andes || rockyMountains || alpineEurope) return "mountain";
  if (eastSouthAsiaMonsoon || westAfricaMonsoon) return "monsoon";
  if (tropicalBelt && (basin.region === "SA" || basin.region === "AF" || basin.region === "AS")) return "tropical";
  if (australiaDry || africaDry || (subtropicalDryBelt && isLarge)) return isSmall ? "dryNatural" : "dryIrrigation";
  if (basin.region === "EU" || (basin.region === "NA" && midLatitude) || (basin.region === "SA" && !southAmericaTropical)) return "humid";
  if (isSmall && !subtropicalDryBelt) return "lowHumanImpact";
  return "mixed";
}

function modeProfileForBasin(prep) {
  return prep.region || modeProfiles[prep.mode] || modeProfiles.mixed || {};
}

function referencesForBasin(prep) {
  const modeProfile = modeProfiles[prep.mode] || {};
  const references = [...(modeProfile.references || [])];
  for (const referenceId of prep.region?.references || []) {
    if (!references.includes(referenceId)) references.unshift(referenceId);
  }
  const harvestedForMode = Object.entries(referenceCatalog)
    .filter(([, ref]) => isReferenceEligibleForBasin(ref, prep))
    .sort(([, a], [, b]) => (b.cited_by_count || 0) - (a.cited_by_count || 0))
    .slice(0, 40)
    .map(([id]) => id);
  for (const referenceId of harvestedForMode) {
    if (!references.includes(referenceId)) references.push(referenceId);
  }
  if (!references.length) return ["vorosmarty2010GlobalThreats", "milly2008Stationarity", "rodell2018Freshwater"];
  return references;
}

function isReferenceEligibleForBasin(ref, prep) {
  if (!ref.harvested) return true;
  if (ref.llm_audited) {
    if (ref.llm_alignment_status === "reject") return false;
    const recommendedModes = ref.llm_recommended_modes || [];
    const recommendedRegions = ref.llm_recommended_region_ids || [];
    const modeMatches = !recommendedModes.length || recommendedModes.includes(prep.mode) || recommendedModes.includes("mixed");
    const regionMatches = !prep.region || !recommendedRegions.length || recommendedRegions.includes(prep.region.id);
    return modeMatches && regionMatches && (ref.llm_confidence == null || ref.llm_confidence >= 0.45);
  }
  return false;
}

function harvestedCountForMode(mode) {
  return Object.values(referenceCatalog).filter((ref) => {
    if (!ref.harvested) return false;
    if (ref.llm_audited) {
      return ref.llm_alignment_status !== "reject" && (ref.llm_recommended_modes || []).includes(mode);
    }
    return false;
  }).length;
}

function prepareBasins() {
  prepared = basins.map((basin) => {
    const region = regionForBasin(basin);
    return {
      basin,
      region,
      mode: region?.mode || inferredModeForBasin(basin),
      rings: basin.rings.filter((ring) => ring.length >= 3),
      center: bboxCenter(basin.bbox)
    };
  });
  basinCount.textContent = `${basins.length.toLocaleString()} selectable basins`;
  interactionHint.textContent = basins.length
    ? "Click any basin to view details"
    : "Basin data not loaded: please open via server.js";
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  requestDraw();
}

function requestDraw() {
  if (redrawPending) return;
  redrawPending = true;
  requestAnimationFrame(() => {
    redrawPending = false;
    draw();
  });
}

function drawBaseMap() {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#f7fafc");
  gradient.addColorStop(0.58, "#eef6f8");
  gradient.addColorStop(1, "#e7f0f4");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const baseScale = getBaseScale() * scale;

  // Calculate visible longitude range
  const leftLon = (-width / 2 - offsetX) / baseScale;
  const rightLon = (width / 2 - offsetX) / baseScale;

  // Draw grid lines
  ctx.strokeStyle = "rgba(112, 128, 144, 0.18)";
  ctx.lineWidth = 1;

  const startGridLon = Math.floor(leftLon / 30) * 30;
  for (let lon = startGridLon; lon <= rightLon; lon += 30) {
    const x = width / 2 + lon * baseScale + offsetX;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let lat = -60; lat <= 60; lat += 20) {
    const y = height / 2 - lat * baseScale + offsetY;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Draw land - calculate which 360-degree segments are visible
  const segmentWidth = 360 * baseScale;
  const firstSegment = Math.floor(leftLon / 360);
  const lastSegment = Math.ceil(rightLon / 360);

  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.strokeStyle = "rgba(72, 84, 96, 0.4)";
  ctx.lineWidth = 0.7;

  for (let seg = firstSegment; seg <= lastSegment; seg++) {
    const lonOffset = seg * 360;

    for (const ring of landRings) {
      const path = new Path2D();
      let first = true;
      for (const [lon, lat] of ring) {
        const x = width / 2 + (lon + lonOffset) * baseScale + offsetX;
        const y = height / 2 - lat * baseScale + offsetY;
        if (first) { path.moveTo(x, y); first = false; }
        else { path.lineTo(x, y); }
      }
      ctx.fill(path);
      ctx.stroke(path);
    }
  }
}

function drawBasin(prep) {
  const isSelected = selectedBasin?.id === prep.basin.id;
  const isHovered = hoveredBasin?.id === prep.basin.id;
  const mode = modes[prep.mode] || modes.mixed;
  const baseScale = getBaseScale() * scale;

  ctx.fillStyle = hexToRgba(mode.color, isSelected ? 0.58 : isHovered ? 0.42 : prep.region ? 0.36 : 0.08);
  ctx.strokeStyle = isSelected ? "#111827" : isHovered ? mode.color : prep.region ? "rgba(17, 24, 39, 0.28)" : "rgba(17, 24, 39, 0.08)";
  ctx.lineWidth = isSelected ? 1.8 : isHovered ? 1.2 : prep.region ? 0.5 : 0.2;

  // Calculate visible longitude range
  const leftLon = (-width / 2 - offsetX) / baseScale;
  const rightLon = (width / 2 - offsetX) / baseScale;
  const firstSegment = Math.floor(leftLon / 360);
  const lastSegment = Math.ceil(rightLon / 360);

  for (let seg = firstSegment; seg <= lastSegment; seg++) {
    const lonOffset = seg * 360;
    for (const ring of prep.rings) {
      const path = new Path2D();
      let first = true;
      for (const [lon, lat] of ring) {
        const x = width / 2 + (lon + lonOffset) * baseScale + offsetX;
        const y = height / 2 - lat * baseScale + offsetY;
        if (first) { path.moveTo(x, y); first = false; }
        else { path.lineTo(x, y); }
      }
      ctx.fill(path);
      ctx.stroke(path);
    }
  }
}

function draw() {
  drawBaseMap();
  const visible = prepared.filter(({ basin }) => isBasinVisible(basin));
  visible.sort((a, b) => (a.region ? 1 : 0) - (b.region ? 1 : 0));
  for (const prep of visible) drawBasin(prep);
}

function isBasinVisible(basin) {
  const baseScale = getBaseScale() * scale;
  const [minLon, minLat, maxLon, maxLat] = basin.bbox;

  // Check if any segment of this basin is visible
  const leftLon = (-width / 2 - offsetX) / baseScale;
  const rightLon = (width / 2 - offsetX) / baseScale;
  const firstSegment = Math.floor((leftLon - maxLon) / 360);
  const lastSegment = Math.ceil((rightLon - minLon) / 360);

  for (let seg = firstSegment; seg <= lastSegment; seg++) {
    const offset = seg * 360;
    const x0 = width / 2 + (minLon + offset) * baseScale + offsetX;
    const x1 = width / 2 + (maxLon + offset) * baseScale + offsetX;
    const y0 = height / 2 - minLat * baseScale + offsetY;
    const y1 = height / 2 - maxLat * baseScale + offsetY;

    if (Math.max(x0, x1) >= -40 && Math.min(x0, x1) <= width + 40 &&
        Math.max(y0, y1) >= -40 && Math.min(y0, y1) <= height + 40) {
      return true;
    }
  }
  return false;
}

function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = ((yi > lat) !== (yj > lat)) && lon < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInBasin(lon, lat, prep) {
  const [minLon, minLat, maxLon, maxLat] = prep.basin.bbox;
  if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) return false;
  let inside = false;
  for (const ring of prep.rings) {
    if (pointInRing(lon, lat, ring)) inside = !inside;
  }
  return inside;
}

function hitTest(x, y) {
  const baseScale = getBaseScale() * scale;
  const lon = (x - width / 2 - offsetX) / baseScale;
  const lat = (height / 2 + offsetY - y) / baseScale;

  let best = null;
  let bestArea = Infinity;

  for (const prep of prepared) {
    if (!isBasinVisible(prep.basin)) continue;
    const [minLon, maxLon] = [prep.basin.bbox[0], prep.basin.bbox[2]];

    // Find which segment this click is closest to
    const segment = Math.round(lon / 360);
    const offsets = [segment - 1, segment, segment + 1];

    for (const offset of offsets) {
      const shiftedMin = minLon + offset * 360;
      const shiftedMax = maxLon + offset * 360;
      if (lon >= shiftedMin && lon <= shiftedMax) {
        const testLon = lon - offset * 360;
        if (pointInBasin(testLon, lat, prep) && prep.basin.areaKm2 < bestArea) {
          best = prep;
          bestArea = prep.basin.areaKm2;
        }
      }
    }
  }
  return best;
}

function selectBasin(prep) {
  if (!prep) return;
  selectedBasin = prep.basin;
  renderProfile(prep);
  panel.classList.add("open");
  voiceDock.classList.remove("faded");
  clearTimeout(fadeTimer);
  requestDraw();
}

function renderLegend() {
  legendList.innerHTML = Object.values(modes).map((mode) => `
    <div class="legend-item">
      <span class="legend-swatch" style="background:${mode.color};color:${mode.color}"></span>
      <span>${mode.label}</span>
    </div>
  `).join("");
}

function renderProfile(prep) {
  const basin = prep.basin;
  const region = prep.region;
  const mode = modes[prep.mode] || modes.mixed;
  const modeProfile = modeProfileForBasin(prep);
  const title = region?.name || basin.name;
  const cycle = modeProfile.cycle || [
    `Preliminary classification: ${mode.label}.`,
    "Full mechanism requires precipitation, evapotranspiration, runoff, groundwater, storage, and human water use data.",
    "Use the query input below for targeted research."
  ];
  const pattern = modeProfile.pattern || [
    "Demo system provides only geographic-hydrologic screening for unconfigured basins.",
    `bbox: ${basin.bbox.map((v) => v.toFixed(2)).join(", ")}`
  ];
  const references = referencesForBasin(prep);
  const harvestedCount = harvestedCountForMode(prep.mode);

  profile.innerHTML = `
    <div class="profile-kicker">
      <span class="legend-swatch" style="background:${mode.color};color:${mode.color}"></span>
      <span>${mode.label}</span>
    </div>
    <h2 class="profile-title">${title}</h2>
    <p class="profile-subtitle">${modeProfile.summary || "This basin has no configured literature profile. The system provides preliminary hydrological classification based on geographic location and basin attributes."}</p>
    <div class="metric-grid">
      <div class="metric"><strong>${Math.round(basin.areaKm2).toLocaleString()}</strong><span>Area km²</span></div>
      <div class="metric"><strong>${basin.cellCount || "—"}</strong><span>WaterGAP cells</span></div>
      <div class="metric"><strong>${basin.region}</strong><span>HydroBASINS region</span></div>
      <div class="metric"><strong>${basin.id}</strong><span>Basin ID</span></div>
    </div>
    <section class="profile-section">
      <h3>Hydrological Mode</h3>
      <div class="tag-row"><span class="tag">${region?.label || mode.label}</span></div>
      <p class="profile-note">${region ? "Case-study region: references combine basin-specific literature and mode-level literature." : "Rule-based mode assignment: references are attached by hydrological mode for full HydroBASINS coverage."}</p>
    </section>
    <section class="profile-section">
      <h3>Water Cycle Characteristics</h3>
      <ul>${cycle.map((item) => `<li>${item}</li>`).join("")}</ul>
    </section>
    <section class="profile-section">
      <h3>Spatiotemporal Patterns</h3>
      <ul>${pattern.map((item) => `<li>${item}</li>`).join("")}</ul>
    </section>
    <section class="profile-section">
      <h3>${region ? "Configured Basin References" : "Mode-level References"}</h3>
      <p class="profile-note">${harvestedCount.toLocaleString()} harvested OpenAlex records available for this mode; showing curated records plus top-cited harvested matches.</p>
      <div class="reference-list">${references.map(renderReferenceButton).join("")}</div>
    </section>
  `;
}

function renderReferenceButton(referenceId) {
  const ref = referenceCatalog[referenceId] || { title: referenceId, authors: "Not configured", year: "", venue: "", abstract: "No abstract configured." };
  return `
    <button class="reference-link" type="button" data-reference-id="${escapeHtml(referenceId)}">
      <span>${escapeHtml(ref.title)}</span>
      <small>${escapeHtml([ref.authors, ref.year, ref.venue].filter(Boolean).join(" · "))}</small>
    </button>
  `;
}

function showReference(referenceId) {
  const ref = referenceCatalog[referenceId];
  if (!ref) { showToast("Reference details not configured."); return; }

  referenceTitle.textContent = ref.title;
  referenceContent.innerHTML = `
    <dl class="reference-meta">
      <div><dt>Authors</dt><dd>${escapeHtml(ref.authors || "Not configured")}</dd></div>
      <div><dt>Affiliations</dt><dd>${escapeHtml(ref.affiliations || "Not configured")}</dd></div>
      <div><dt>Year</dt><dd>${escapeHtml(ref.year || "Not configured")}</dd></div>
      <div><dt>Venue</dt><dd>${escapeHtml(ref.venue || "Not configured")}</dd></div>
      <div><dt>Journal tier</dt><dd>${escapeHtml(ref.journal_quartile || "Not configured")}</dd></div>
      <div><dt>DOI</dt><dd>${escapeHtml(ref.doi || "Not configured")}</dd></div>
      <div><dt>LLM area</dt><dd>${escapeHtml([ref.llm_study_area_type, ...(ref.llm_study_area_names || [])].filter(Boolean).join(" · ") || "not audited")}</dd></div>
      <div><dt>LLM modes</dt><dd>${escapeHtml((ref.llm_recommended_modes || []).join(", ") || "not audited")}</dd></div>
      <div><dt>LLM status</dt><dd>${escapeHtml(ref.llm_alignment_status || "not audited")}${ref.llm_confidence != null ? ` · confidence ${escapeHtml(ref.llm_confidence)}` : ""}</dd></div>
      <div><dt>Mode alignment</dt><dd>${escapeHtml(ref.alignment_status || "not audited")}${ref.alignment_score != null ? ` · score ${escapeHtml(ref.alignment_score)}` : ""}</dd></div>
    </dl>
    <h3>Relevance</h3>
    <p>${escapeHtml(ref.relevance || "No relevance note configured.")}</p>
    <h3>Abstract</h3>
    <p>${escapeHtml(ref.abstract || "No abstract configured.")}</p>
    ${ref.external_url ? `<a class="pdf-link" href="${escapeHtml(ref.external_url)}" target="_blank" rel="noreferrer">Open publisher link</a>` : ""}
    ${ref.file ? `<a class="pdf-link" href="/references/${encodeURIComponent(ref.file)}" target="_blank" rel="noreferrer">Open local PDF</a>` : ""}
  `;
  referencePanel.classList.remove("hidden");
}

function hexToRgba(hex, alpha) {
  const value = hex.replace("#", "");
  return `rgba(${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)}, ${alpha})`;
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add("hidden"), 2600);
}

function markdownToHtml(text) {
  let html = text
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^- (.*)$/gm, "<li>$1</li>")
    .replace(/^(\d+)\. (.*)$/gm, "<li>$2</li>");

  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>.*?<\/li>\n?)+/g, (match) => {
    const hasNumbers = /^\d+\./m.test(match);
    return `<${hasNumbers ? 'ol' : 'ul'}>${match}</${hasNumbers ? 'ol' : 'ul'}>`;
  });

  // Convert remaining double newlines to paragraph breaks
  html = html
    .split(/\n\n+/)
    .map(block => {
      block = block.trim();
      if (!block) return '';
      if (block.startsWith('<')) return block;
      return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');

  return html;
}

async function askResearch(question) {
  if (!selectedBasin) { showToast("Please select a basin on the map first."); return; }

  researchPanel.classList.remove("hidden");
  researchTitle.textContent = question;
  researchContent.innerHTML = "<p>Preparing basin context...</p>";

  const prep = prepared.find((item) => item.basin.id === selectedBasin.id);
  const payload = {
    question,
    basin: {
      id: selectedBasin.id,
      name: prep.region?.name || selectedBasin.name,
      region: selectedBasin.region,
      bbox: selectedBasin.bbox,
      areaKm2: selectedBasin.areaKm2,
      hydrologicalMode: modes[prep.mode]?.label,
      profile: prep.region ? { ...prep.region, references: (prep.region.references || []).map((id) => referenceCatalog[id]?.title || id) } : null
    }
  };

  try {
    const response = await fetch("/api/research", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    researchContent.innerHTML = markdownToHtml(data.report || "No report returned.");
  } catch (error) {
    researchContent.innerHTML = markdownToHtml(localFallbackReport(payload));
  }
}

function localFallbackReport(payload) {
  const refs = payload.basin.profile?.references || ["Rodell et al. 2018 Nature", "Jasechko et al. 2024 Nature"];
  return [
    "Offline Demo Report",
    "",
    `Research question: ${payload.question}`,
    `Basin: ${payload.basin.name}`,
    `Hydrological mode: ${payload.basin.hydrologicalMode}`,
    "",
    "Suggested search queries:",
    `- "${payload.basin.name}" ${payload.question}`,
    `- "${payload.basin.name}" hydrology climate ecology`,
    `- "${payload.basin.name}" water management`,
    "",
    "Configured references:",
    ...refs.map((r) => `- ${r}`),
    "",
    "Note: Configure API key in local server for real AI-powered research synthesis."
  ].join("\n");
}

function startFadeTimer() {
  clearTimeout(fadeTimer);
  // Only start timer if no content and no selected basin
  if (!queryInput.value.trim() && !selectedBasin) {
    fadeTimer = setTimeout(() => voiceDock.classList.add("faded"), FADE_DELAY);
  }
}

function wakeVoiceDock() {
  voiceDock.classList.remove("faded");
  clearTimeout(fadeTimer);
  startFadeTimer();
}

function setupVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) { micButton.title = "Web Speech API not supported"; return; }

  const recognition = new SpeechRecognition();
  recognition.lang = "zh-CN";
  recognition.interimResults = true;
  recognition.continuous = true; // Don't auto-stop

  let finalTranscript = "";
  let audioContext = null;

  waveformCanvas = document.createElement("canvas");
  waveformCanvas.className = "waveform-canvas";
  waveformCanvas.width = 400;
  waveformCanvas.height = 28;
  waveformCtx = waveformCanvas.getContext("2d");

  async function startRecording() {
    if (isRecording) return;
    isRecording = true;
    finalTranscript = "";
    micButton.classList.add("listening");
    voiceDock.classList.remove("faded");
    clearTimeout(fadeTimer);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      voiceAnalyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(voiceAnalyser);
      voiceAnalyser.fftSize = 256;
      voiceDataArray = new Uint8Array(voiceAnalyser.frequencyBinCount);
    } catch (e) {
      console.log("Audio visualization unavailable");
    }

    showWaveform();
    try {
      recognition.start();
    } catch (e) {
      isRecording = false;
      micButton.classList.remove("listening");
      hideWaveform();
      showToast("Voice recognition failed");
    }
  }

  function stopRecording() {
    if (!isRecording) return;
    isRecording = false;
    micButton.classList.remove("listening");
    hideWaveform();
    voiceAnalyser = null;
    voiceDataArray = null;
    if (audioContext) { audioContext.close(); audioContext = null; }
    try { recognition.stop(); } catch (e) {}
  }

  voiceStartRecording = startRecording;
  voiceStopRecording = stopRecording;

  micButton.addEventListener("click", () => {
    isRecording ? stopRecording() : startRecording();
  });

  recognition.addEventListener("result", (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      }
    }
  });

  recognition.addEventListener("end", () => {
    // Only process if we were actually recording (user stopped it)
    if (!isRecording) {
      if (finalTranscript) {
        queryInput.value = finalTranscript;
        askResearch(finalTranscript);
      }
      wakeVoiceDock();
    }
  });

  recognition.addEventListener("error", (event) => {
    if (event.error !== "aborted") {
      isRecording = false;
      micButton.classList.remove("listening");
      hideWaveform();
      voiceAnalyser = null;
      voiceDataArray = null;
      if (audioContext) { audioContext.close(); audioContext = null; }
      showToast(`Voice error: ${event.error}`);
      wakeVoiceDock();
    }
  });
}

function showWaveform() {
  const inputParent = queryInput.parentElement;
  queryInput.style.display = "none";
  waveformCanvas.style.display = "block";
  inputParent.insertBefore(waveformCanvas, queryInput);
  animateWaveform();
}

function hideWaveform() {
  if (waveformAnimId) {
    cancelAnimationFrame(waveformAnimId);
    waveformAnimId = null;
  }
  queryInput.style.display = "block";
  waveformCanvas.style.display = "none";
}

let waveformAnimId = null;

function animateWaveform() {
  if (!isRecording) return;

  const ctx = waveformCtx;
  const w = waveformCanvas.width;
  const h = waveformCanvas.height;

  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(10, 132, 255, 0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(10, 132, 255, 0.7)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();

  let amplitude = 0.3;
  if (voiceDataArray && voiceAnalyser) {
    voiceAnalyser.getByteTimeDomainData(voiceDataArray);
    let sum = 0;
    for (let i = 0; i < voiceDataArray.length; i++) {
      const v = (voiceDataArray[i] - 128) / 128;
      sum += v * v;
    }
    amplitude = Math.sqrt(sum / voiceDataArray.length) * 3 + 0.1;
  }

  const centerY = h / 2;
  const maxAmplitude = (h / 2 - 2) * Math.min(amplitude, 1);
  const time = Date.now() / 1000;

  for (let x = 0; x < w; x++) {
    const phase = (x / w) * Math.PI * 6 + time * 3;
    const y = centerY + Math.sin(phase) * maxAmplitude;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  waveformAnimId = requestAnimationFrame(animateWaveform);
}

async function checkServer() {
  try {
    const response = await fetch("/api/health");
    const data = await response.json();
    llmStatus.textContent = data.llmConfigured ? "Model: connected" : "Model: offline demo";
  } catch { llmStatus.textContent = "Model: static demo"; }
}

// Event listeners
canvas.addEventListener("mousemove", (event) => {
  if (dragging) {
    offsetX = dragStart.offsetX + event.clientX - dragStart.x;
    offsetY = dragStart.offsetY + event.clientY - dragStart.y;
    clampOffsetY();
    requestDraw();
    return;
  }
  const hit = hitTest(event.clientX, event.clientY);
  hoveredBasin = hit?.basin || null;
  canvas.style.cursor = hit ? "pointer" : "grab";
  requestDraw();
});

canvas.addEventListener("mousedown", (event) => {
  dragging = true;
  canvas.classList.add("dragging");
  dragStart = { x: event.clientX, y: event.clientY, offsetX, offsetY };
});

window.addEventListener("mouseup", () => {
  dragging = false;
  canvas.classList.remove("dragging");
  canvas.style.cursor = hoveredBasin ? "pointer" : "grab";
});

canvas.addEventListener("click", (event) => {
  if (dragStart && Math.abs(event.clientX - dragStart.x) + Math.abs(event.clientY - dragStart.y) > 6) return;
  selectBasin(hitTest(event.clientX, event.clientY));
});

canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  const baseScale = getBaseScale() * scale;
  const mouseLon = (event.clientX - width / 2 - offsetX) / baseScale;
  const mouseLat = (height / 2 + offsetY - event.clientY) / baseScale;

  const factor = event.deltaY < 0 ? 1.16 : 0.86;
  const newScale = Math.max(1, Math.min(12, scale * factor));
  const newBaseScale = getBaseScale() * newScale;

  offsetX = event.clientX - width / 2 - mouseLon * newBaseScale;
  offsetY = event.clientY - height / 2 + mouseLat * newBaseScale;
  scale = newScale;
  clampOffsetY();
  requestDraw();
}, { passive: false });

document.querySelector("#zoomInButton").addEventListener("click", () => { scale = Math.min(12, scale * 1.25); clampOffsetY(); requestDraw(); });
document.querySelector("#zoomOutButton").addEventListener("click", () => { scale = Math.max(1, scale / 1.25); clampOffsetY(); requestDraw(); });
document.querySelector("#resetButton").addEventListener("click", () => { scale = 1; offsetX = 0; offsetY = 0; requestDraw(); });
document.querySelector("#closePanelButton").addEventListener("click", () => panel.classList.remove("open"));
document.querySelector("#closeResearchButton").addEventListener("click", () => researchPanel.classList.add("hidden"));
document.querySelector("#closeReferenceButton").addEventListener("click", () => referencePanel.classList.add("hidden"));

profile.addEventListener("click", (event) => {
  const button = event.target.closest("[data-reference-id]");
  if (button) showReference(button.dataset.referenceId);
});

queryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const question = queryInput.value.trim();
  if (question) askResearch(question);
});

queryInput.addEventListener("input", wakeVoiceDock);

window.addEventListener("resize", resize);
window.addEventListener("keydown", (event) => {
  if (event.code === "Space" && !event.target.closest("input, textarea, button") && !isRecording && !spacePressTimer) {
    event.preventDefault();
    spaceTriggeredVoice = false;
    spacePressTimer = setTimeout(() => {
      spaceTriggeredVoice = true;
      if (voiceStartRecording) voiceStartRecording();
    }, LONG_PRESS_DELAY);
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "Space" && spacePressTimer) {
    event.preventDefault();
    clearTimeout(spacePressTimer);
    spacePressTimer = null;
    if (spaceTriggeredVoice) {
      if (voiceStopRecording) voiceStopRecording();
    } else {
      wakeVoiceDock();
      queryInput.focus();
    }
  }
});

legendToggle.addEventListener("click", () => legendPanel.classList.toggle("collapsed"));

// Initialize
prepareBasins();
renderLegend();
resize();
setupVoice();
checkServer();
startFadeTimer();
