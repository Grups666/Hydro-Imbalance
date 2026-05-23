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

const modes = window.RESEARCH_EXPLORER.modes;
const highlightedRegions = window.RESEARCH_EXPLORER.highlightedRegions;
const referenceCatalog = window.REFERENCE_CATALOG || {};
const basins = window.BASIN_DATA?.basins || [];
const landRings = window.WORLD_LAND || [];

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

function lonLatToScreen(lon, lat) {
  const baseScale = Math.min(width / 360, height / 180) * 0.92 * scale;
  return [
    width / 2 + lon * baseScale + offsetX,
    height / 2 - lat * baseScale + offsetY
  ];
}

function screenToLonLat(x, y) {
  const baseScale = Math.min(width / 360, height / 180) * 0.92 * scale;
  return [
    (x - width / 2 - offsetX) / baseScale,
    (height / 2 + offsetY - y) / baseScale
  ];
}

function bboxCenter(bbox) {
  return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
}

function regionForBasin(basin) {
  const [lon, lat] = bboxCenter(basin.bbox);
  return highlightedRegions.find((region) => (
    lon >= region.match.lon[0] &&
    lon <= region.match.lon[1] &&
    lat >= region.match.lat[0] &&
    lat <= region.match.lat[1]
  ));
}

function inferredModeForBasin(basin) {
  const region = regionForBasin(basin);
  if (region) return region.mode;
  if (basin.region === "AS" && basin.bbox[1] > 45) return "snow";
  if (basin.region === "AS" && basin.bbox[1] > 5 && basin.bbox[1] < 32) return "monsoon";
  if (["AF", "AU"].includes(basin.region) || (basin.bbox[1] < 40 && basin.bbox[3] > -40 && basin.areaKm2 > 150000)) return "dryIrrigation";
  if (["EU", "SA"].includes(basin.region)) return "humid";
  return "mixed";
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

  basinCount.textContent = `${basins.length.toLocaleString()} 个可选流域`;
  interactionHint.textContent = basins.length
    ? "点击任意流域边界内区域查看详情"
    : "流域数据未加载：请通过 server.js 打开页面";
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

function makePath(rings) {
  const path = new Path2D();
  for (const ring of rings) {
    let first = true;
    for (const [lon, lat] of ring) {
      const [x, y] = lonLatToScreen(lon, lat);
      if (first) {
        path.moveTo(x, y);
        first = false;
      } else {
        path.lineTo(x, y);
      }
    }
    path.closePath();
  }
  return path;
}

function drawBaseMap() {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#f7fafc");
  gradient.addColorStop(0.58, "#eef6f8");
  gradient.addColorStop(1, "#e7f0f4");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(112, 128, 144, 0.18)";
  ctx.lineWidth = 1;
  for (let lon = -180; lon <= 180; lon += 30) {
    const [x0, y0] = lonLatToScreen(lon, -80);
    const [x1, y1] = lonLatToScreen(lon, 85);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  for (let lat = -60; lat <= 60; lat += 20) {
    const [x0, y0] = lonLatToScreen(-180, lat);
    const [x1, y1] = lonLatToScreen(180, lat);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  const landPath = makePath(landRings);
  ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
  ctx.strokeStyle = "rgba(72, 84, 96, 0.38)";
  ctx.lineWidth = 0.55;
  ctx.fill(landPath, "evenodd");
  ctx.stroke(landPath);
}

function drawBasin(prep) {
  const isSelected = selectedBasin?.id === prep.basin.id;
  const isHovered = hoveredBasin?.id === prep.basin.id;
  const mode = modes[prep.mode] || modes.mixed;
  const path = makePath(prep.rings);

  const fillAlpha = prep.region ? 0.36 : 0.08;
  ctx.fillStyle = hexToRgba(mode.color, isSelected ? 0.58 : isHovered ? 0.42 : fillAlpha);
  ctx.strokeStyle = isSelected
    ? "#111827"
    : isHovered
      ? mode.color
      : prep.region
        ? "rgba(17, 24, 39, 0.34)"
        : "rgba(17, 24, 39, 0.12)";
  ctx.lineWidth = isSelected ? 1.65 : isHovered ? 1.1 : prep.region ? 0.62 : 0.32;
  ctx.fill(path, "evenodd");
  ctx.stroke(path);
}

function draw() {
  drawBaseMap();
  const visible = prepared.filter(({ basin }) => isBasinVisible(basin));
  visible.sort((a, b) => (a.region ? 1 : 0) - (b.region ? 1 : 0));
  for (const prep of visible) drawBasin(prep);
}

function isBasinVisible(basin) {
  const [x0, y0] = lonLatToScreen(basin.bbox[0], basin.bbox[1]);
  const [x1, y1] = lonLatToScreen(basin.bbox[2], basin.bbox[3]);
  return Math.max(x0, x1) >= -40 &&
    Math.min(x0, x1) <= width + 40 &&
    Math.max(y0, y1) >= -40 &&
    Math.min(y0, y1) <= height + 40;
}

function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = ((yi > lat) !== (yj > lat)) &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi;
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
  const [lon, lat] = screenToLonLat(x, y);
  let best = null;
  let bestArea = Infinity;

  for (const prep of prepared) {
    if (!isBasinVisible(prep.basin)) continue;
    if (!pointInBasin(lon, lat, prep)) continue;
    if (prep.basin.areaKm2 < bestArea) {
      best = prep;
      bestArea = prep.basin.areaKm2;
    }
  }
  return best;
}

function selectBasin(prep) {
  if (!prep) return;
  selectedBasin = prep.basin;
  renderProfile(prep);
  panel.classList.add("open");
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
  const title = region?.name || basin.name;
  const cycle = region?.cycle || defaultCycle(prep);
  const pattern = region?.pattern || defaultPattern(prep);
  const references = region?.references || defaultReferences();

  profile.innerHTML = `
    <div class="profile-kicker">
      <span class="legend-swatch" style="background:${mode.color};color:${mode.color}"></span>
      <span>${mode.label}</span>
    </div>
    <h2 class="profile-title">${title}</h2>
    <p class="profile-subtitle">${region?.summary || "该流域尚未配置专门文献档案；系统会根据地理位置和流域属性给出初步水文循环类型，用于后续智能查询。"}</p>
    <div class="metric-grid">
      <div class="metric"><strong>${Math.round(basin.areaKm2).toLocaleString()}</strong><span>面积 km²</span></div>
      <div class="metric"><strong>${basin.cellCount}</strong><span>WaterGAP 网格数</span></div>
      <div class="metric"><strong>${basin.region}</strong><span>HydroBASINS 区域</span></div>
      <div class="metric"><strong>${basin.id}</strong><span>流域编号</span></div>
    </div>
    <section class="profile-section">
      <h3>水文循环模式</h3>
      <div class="tag-row"><span class="tag">${region?.label || mode.label}</span></div>
    </section>
    <section class="profile-section">
      <h3>水循环特点</h3>
      <ul>${cycle.map((item) => `<li>${item}</li>`).join("")}</ul>
    </section>
    <section class="profile-section">
      <h3>时空 pattern</h3>
      <ul>${pattern.map((item) => `<li>${item}</li>`).join("")}</ul>
    </section>
    <section class="profile-section">
      <h3>已配置文献</h3>
      <div class="reference-list">${references.map(renderReferenceButton).join("")}</div>
    </section>
  `;
}

function renderReferenceButton(referenceId) {
  const ref = referenceCatalog[referenceId] || {
    title: referenceId,
    authors: "未配置作者信息",
    year: "",
    venue: "",
    abstract: "该条目尚未配置摘要。"
  };
  return `
    <button class="reference-link" type="button" data-reference-id="${escapeHtml(referenceId)}">
      <span>${escapeHtml(ref.title)}</span>
      <small>${escapeHtml([ref.authors, ref.year, ref.venue].filter(Boolean).join(" · "))}</small>
    </button>
  `;
}

function defaultCycle(prep) {
  const mode = modes[prep.mode]?.label || "Mixed";
  return [
    `初步归类为 ${mode}。`,
    "完整机制需要结合降水、蒸散、径流、地下水、储量和人类用水数据进一步判断。",
    "可通过底部语音或文本入口发起专题检索。"
  ];
}

function defaultPattern(prep) {
  return [
    "当前演示系统对未配置流域仅提供地理-水文初筛。",
    `bbox: ${prep.basin.bbox.map((v) => v.toFixed(2)).join(", ")}。`
  ];
}

function defaultReferences() {
  return ["rodell2018Freshwater", "jasechko2024Aquifers", "globalIrrigationReview"];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showReference(referenceId) {
  const ref = referenceCatalog[referenceId];
  if (!ref) {
    showToast("该参考文献尚未配置详情。");
    return;
  }

  referenceTitle.textContent = ref.title;
  referenceContent.innerHTML = `
    <dl class="reference-meta">
      <div><dt>作者</dt><dd>${escapeHtml(ref.authors || "未配置")}</dd></div>
      <div><dt>年份</dt><dd>${escapeHtml(ref.year || "未配置")}</dd></div>
      <div><dt>期刊</dt><dd>${escapeHtml(ref.venue || "未配置")}</dd></div>
      <div><dt>DOI</dt><dd>${escapeHtml(ref.doi || "未配置")}</dd></div>
    </dl>
    <h3>摘要</h3>
    <p>${escapeHtml(ref.abstract || "该文献尚未配置摘要。")}</p>
    ${ref.file ? `<a class="pdf-link" href="/references/${encodeURIComponent(ref.file)}" target="_blank" rel="noreferrer">打开本地 PDF</a>` : ""}
  `;
  referencePanel.classList.remove("hidden");
}

function hexToRgba(hex, alpha) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add("hidden"), 2600);
}

async function askResearch(question) {
  if (!selectedBasin) {
    showToast("请先在地图上选择一个流域。");
    return;
  }

  researchPanel.classList.remove("hidden");
  researchTitle.textContent = question;
  researchContent.textContent = "正在整理流域上下文并请求研究综合...";

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
      profile: prep.region ? {
        ...prep.region,
        references: (prep.region.references || []).map((id) => referenceCatalog[id]?.title || id)
      } : null
    }
  };

  try {
    const response = await fetch("/api/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    researchContent.textContent = data.report || "没有返回报告。";
  } catch (error) {
    researchContent.textContent = localFallbackReport(payload);
  }
}

function localFallbackReport(payload) {
  const refs = payload.basin.profile?.references || defaultReferences();
  return [
    "离线示例报告",
    "",
    `研究问题：${payload.question}`,
    `流域：${payload.basin.name}`,
    `水文模式：${payload.basin.hydrologicalMode}`,
    "",
    "可用线索：",
    ...(payload.basin.profile?.cycle || []).map((item) => `- ${item}`),
    "",
    "建议检索式：",
    `- \"${payload.basin.name}\" ${payload.question}`,
    `- \"${payload.basin.name}\" hydrology climate ecology`,
    `- \"${payload.basin.name}\" water management ${payload.question}`,
    "",
    "本地已配置参考：",
    ...refs.map((item) => `- ${item}`),
    "",
    "说明：启动本地服务并配置模型密钥后，此处会切换为真实智能综合。"
  ].join("\n");
}

function setupVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    micButton.title = "当前浏览器不支持 Web Speech API，可使用文本输入。";
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "zh-CN";
  recognition.interimResults = false;
  recognition.continuous = false;

  micButton.addEventListener("click", () => {
    micButton.classList.add("listening");
    recognition.start();
  });

  recognition.addEventListener("result", (event) => {
    const text = event.results[0][0].transcript;
    queryInput.value = text;
    micButton.classList.remove("listening");
    askResearch(text);
  });

  recognition.addEventListener("end", () => micButton.classList.remove("listening"));
  recognition.addEventListener("error", () => {
    micButton.classList.remove("listening");
    showToast("语音识别未成功，可直接输入文本。");
  });
}

async function checkServer() {
  try {
    const response = await fetch("/api/health");
    const data = await response.json();
    llmStatus.textContent = data.llmConfigured ? "模型：已连接" : "模型：离线示例";
  } catch {
    llmStatus.textContent = "模型：静态示例";
  }
}

canvas.addEventListener("mousemove", (event) => {
  if (dragging) {
    offsetX = dragStart.offsetX + event.clientX - dragStart.x;
    offsetY = dragStart.offsetY + event.clientY - dragStart.y;
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
  const factor = event.deltaY < 0 ? 1.16 : 0.86;
  scale = Math.max(0.8, Math.min(8, scale * factor));
  requestDraw();
}, { passive: false });

document.querySelector("#zoomInButton").addEventListener("click", () => {
  scale = Math.min(8, scale * 1.25);
  requestDraw();
});

document.querySelector("#zoomOutButton").addEventListener("click", () => {
  scale = Math.max(0.8, scale / 1.25);
  requestDraw();
});

document.querySelector("#resetButton").addEventListener("click", () => {
  scale = 1;
  offsetX = 0;
  offsetY = 0;
  requestDraw();
});

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

window.addEventListener("resize", resize);

prepareBasins();
renderLegend();
resize();
setupVoice();
checkServer();
