const data = window.ANALYSIS_DATA;

const I18N = {
  zh: {
    heroEyebrow: "WaterGAP / Global Diagnostics",
    heroTitle: "水循环失衡辨识",
    heroCopy: "对比近 20 年和近 30 年相对于历史长期基线的偏离程度，以标准差倍数识别潜在失衡区域。",
    metricGrid: "输出分辨率",
    resolutionValue: "0.5° 全球网格",
    controlsTitle: "参数控制",
    controlsDesc: "切换变量、时间窗口、阈值和语言。",
    variable: "变量",
    window: "时间窗口",
    threshold: "判定阈值",
    language: "语言",
    window20: "近 20 年",
    window30: "近 30 年",
    mapTitleSuffix: "全球热力图",
    mapSubtitle: "年窗口，相对长期基线偏离",
    legendLow: "低于基线",
    legendNeutral: "接近基线",
    legendHigh: "高于基线",
    recentPeriod: "近期窗口",
    baselinePeriod: "长期基线",
    note: "说明",
    periodNote: "最近窗口年均值与此前长期基线均值比较，按基线标准差归一化。",
    validCells: "有效网格",
    meanAbsZ: "平均 |z|",
    maxAbsZ: "最大 |z|",
    imbalancedRatio: "失衡占比",
    stdFloor: "标准差下限",
    tooltipLon: "经度",
    tooltipLat: "纬度",
    tooltipDiff: "差值",
    resetView: "回正",
    expandMap: "放大地图",
    closeMap: "关闭放大地图",
    loading: "正在加载变量数据...",
  },
  en: {
    heroEyebrow: "WaterGAP / Global Diagnostics",
    heroTitle: "Water Cycle Imbalance Detection",
    heroCopy: "Compare the recent 20-year and 30-year windows against the long-term baseline and identify potential imbalance regions by standard-deviation multiples.",
    metricGrid: "Grid",
    resolutionValue: "0.5° Global Grid",
    controlsTitle: "Controls",
    controlsDesc: "Switch variable, window, threshold, and language.",
    variable: "Variable",
    window: "Window",
    threshold: "Threshold",
    language: "Language",
    window20: "Recent 20 years",
    window30: "Recent 30 years",
    mapTitleSuffix: "Global Heatmap",
    mapSubtitle: "year window relative to the long-term baseline",
    legendLow: "Below baseline",
    legendNeutral: "Near baseline",
    legendHigh: "Above baseline",
    recentPeriod: "Recent window",
    baselinePeriod: "Long-term baseline",
    note: "Note",
    periodNote: "The recent-window annual mean is compared against the earlier long-term baseline and normalized by the baseline standard deviation.",
    validCells: "Valid cells",
    meanAbsZ: "Mean |z|",
    maxAbsZ: "Max |z|",
    imbalancedRatio: "Imbalanced share",
    stdFloor: "Std floor",
    tooltipLon: "Lon",
    tooltipLat: "Lat",
    tooltipDiff: "Difference",
    resetView: "Reset view",
    expandMap: "Expand map",
    closeMap: "Close expanded map",
    loading: "Loading variable data...",
  },
};

const root = document.documentElement;
const variableSelect = document.getElementById("variableSelect");
const windowSelect = document.getElementById("windowSelect");
const thresholdRange = document.getElementById("thresholdRange");
const thresholdValue = document.getElementById("thresholdValue");
const languageSelect = document.getElementById("languageSelect");
const periodCard = document.getElementById("periodCard");
const summaryGrid = document.getElementById("summaryGrid");
const mapTitle = document.getElementById("mapTitle");
const mapSubtitle = document.getElementById("mapSubtitle");
const methodBox = document.getElementById("methodBox");
const loadingOverlay = document.getElementById("loadingOverlay");
const expandMapButton = document.getElementById("expandMapButton");
const closeMapModalButton = document.getElementById("closeMapModalButton");
const mapModal = document.getElementById("mapModal");

const mainSurface = {
  key: "main",
  canvas: document.getElementById("mapCanvas"),
  tooltip: document.getElementById("tooltip"),
  resetButton: document.getElementById("resetViewButton"),
};
mainSurface.ctx = mainSurface.canvas.getContext("2d");

const modalSurface = {
  key: "modal",
  canvas: document.getElementById("modalMapCanvas"),
  tooltip: document.getElementById("modalTooltip"),
  resetButton: document.getElementById("modalResetViewButton"),
};
modalSurface.ctx = modalSurface.canvas.getContext("2d");

const lat = data.grid.lat;
const lon = data.grid.lon;

window.ANALYSIS_VARIABLE_DATA = window.ANALYSIS_VARIABLE_DATA || {};
const variableDataCache = window.ANALYSIS_VARIABLE_DATA;
const loadingScripts = new Map();
const interactionState = {
  main: { scale: 1, offsetX: 0, offsetY: 0, dragging: false, startX: 0, startY: 0, startOffsetX: 0, startOffsetY: 0 },
  modal: { scale: 1, offsetX: 0, offsetY: 0, dragging: false, startX: 0, startY: 0, startOffsetX: 0, startOffsetY: 0 },
};
let renderedLanguage = null;

function currentLanguage() {
  return languageSelect.value || "zh";
}

function t(key) {
  return I18N[currentLanguage()][key];
}

function stateFor(surface) {
  return interactionState[surface.key];
}

function setI18nText(key) {
  const node = document.querySelector(`[data-i18n='${key}']`);
  if (node) {
    node.textContent = t(key);
  }
}

function variableLabel(variable) {
  return variable.label[currentLanguage()];
}

function optionLabel(variable, code) {
  return `${variable.label[currentLanguage()]} [${code}]`;
}

function sortVariables(entries) {
  const locale = currentLanguage() === "zh" ? "zh-CN" : "en";
  return entries.sort((a, b) => optionLabel(a[1], a[0]).localeCompare(optionLabel(b[1], b[0]), locale));
}

function populateVariables() {
  const previous = variableSelect.value;
  variableSelect.innerHTML = "";
  sortVariables(Object.entries(data.variables)).forEach(([key, item]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = optionLabel(item, key);
    variableSelect.appendChild(option);
  });
  variableSelect.value = data.variables[previous] ? previous : Object.keys(data.variables)[0];
}

function syncVariableOptions() {
  if (renderedLanguage !== currentLanguage() || variableSelect.options.length === 0) {
    populateVariables();
    renderedLanguage = currentLanguage();
  }
}

function currentState() {
  const variableKey = variableSelect.value || Object.keys(data.variables)[0];
  const windowKey = windowSelect.value;
  const threshold = Number(thresholdRange.value);
  const variableData = variableDataCache[variableKey];
  return {
    variableKey,
    windowKey,
    threshold,
    variable: data.variables[variableKey],
    result: variableData ? variableData.windows[windowKey] : null,
  };
}

function colorForZ(z, threshold) {
  if (z === null || Number.isNaN(z)) {
    return "rgba(0, 0, 0, 0)";
  }
  if (Math.abs(z) < threshold) {
    return "rgba(233, 223, 185, 0.72)";
  }
  const alpha = Math.min(0.92, 0.42 + Math.abs(z) * 0.12);
  return z > 0 ? `rgba(223, 108, 79, ${alpha})` : `rgba(74, 168, 200, ${alpha})`;
}

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "N/A";
  }
  return Number(value).toFixed(digits);
}

function formatAdaptiveNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "N/A";
  }
  const absValue = Math.abs(Number(value));
  if (absValue > 0 && absValue < 1e-4) {
    return Number(value).toExponential(2);
  }
  return Number(value).toFixed(digits);
}

function formatDirectionalCoordinate(value, positiveLabel, negativeLabel) {
  const numericValue = Number(value);
  const direction = numericValue >= 0 ? positiveLabel : negativeLabel;
  return `${Math.abs(numericValue).toFixed(2)}° ${direction}`;
}

function imbalancePercentage(zGrid, threshold) {
  let valid = 0;
  let imbalanced = 0;
  for (const row of zGrid) {
    for (const value of row) {
      if (value === null || Number.isNaN(value)) {
        continue;
      }
      valid += 1;
      if (Math.abs(value) >= threshold) {
        imbalanced += 1;
      }
    }
  }
  return valid === 0 ? 0 : (imbalanced / valid) * 100;
}

function applyTranslations() {
  [
    "heroEyebrow",
    "heroTitle",
    "heroCopy",
    "controlsTitle",
    "controlsDesc",
    "variable",
    "window",
    "threshold",
    "language",
    "legendLow",
    "legendNeutral",
    "legendHigh",
  ].forEach(setI18nText);

  const window20 = document.querySelector("[data-window='20']");
  const window30 = document.querySelector("[data-window='30']");
  if (window20) {
    window20.textContent = t("window20");
  }
  if (window30) {
    window30.textContent = t("window30");
  }

  loadingOverlay.textContent = t("loading");
  expandMapButton.setAttribute("aria-label", t("expandMap"));
  closeMapModalButton.setAttribute("aria-label", t("closeMap"));
  mainSurface.resetButton.setAttribute("aria-label", t("resetView"));
  modalSurface.resetButton.setAttribute("aria-label", t("resetView"));
}

function setLoading(isLoading) {
  loadingOverlay.classList.toggle("hidden", !isLoading);
}

function ensureVariableData(variableKey) {
  if (variableDataCache[variableKey]) {
    return Promise.resolve(variableDataCache[variableKey]);
  }
  if (loadingScripts.has(variableKey)) {
    return loadingScripts.get(variableKey);
  }

  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = data.variables[variableKey].dataScript;
    script.onload = () => {
      loadingScripts.delete(variableKey);
      resolve(variableDataCache[variableKey]);
    };
    script.onerror = () => {
      loadingScripts.delete(variableKey);
      reject(new Error(`Failed to load ${variableKey}`));
    };
    document.body.appendChild(script);
  });

  loadingScripts.set(variableKey, promise);
  return promise;
}

function renderSummary(state) {
  if (!state.result) {
    return;
  }
  thresholdValue.textContent = `${state.threshold.toFixed(1)}σ`;
  const { recentPeriod, baselinePeriod, summary } = state.result;
  const percentage = imbalancePercentage(state.result.zScore, state.threshold);

  periodCard.innerHTML = `
    <div>${t("metricGrid")}: <strong>${t("resolutionValue")}</strong></div>
    <div>${t("recentPeriod")}: <strong>${recentPeriod[0]}-${recentPeriod[1]}</strong></div>
    <div>${t("baselinePeriod")}: <strong>${baselinePeriod[0]}-${baselinePeriod[1]}</strong></div>
    <div>${t("note")}: ${t("periodNote")}</div>
    <div>${t("stdFloor")}: <strong>${formatAdaptiveNumber(summary.stdFloor, 6)}</strong></div>
  `;

  summaryGrid.innerHTML = `
    <div class="summary-item">
      <span>${t("validCells")}</span>
      <strong>${summary.validCells}</strong>
    </div>
    <div class="summary-item">
      <span>${t("meanAbsZ")}</span>
      <strong>${formatNumber(summary.meanAbsZ)}</strong>
    </div>
    <div class="summary-item">
      <span>${t("maxAbsZ")}</span>
      <strong>${formatNumber(summary.maxAbsZ)}</strong>
    </div>
    <div class="summary-item">
      <span>${t("imbalancedRatio")}</span>
      <strong>${formatNumber(percentage)}%</strong>
    </div>
  `;

  mapTitle.textContent = `${variableLabel(state.variable)} ${t("mapTitleSuffix")}`;
  mapSubtitle.textContent = `${state.windowKey} ${t("mapSubtitle")}`;
  methodBox.textContent = data.meta.method[currentLanguage()];
}

function updateResetButton(surface) {
  const view = stateFor(surface);
  const active = Math.abs(view.scale - 1) > 0.001 || Math.abs(view.offsetX) > 1 || Math.abs(view.offsetY) > 1;
  surface.resetButton.classList.toggle("hidden", !active);
}

function clampOffsets(surface) {
  const view = stateFor(surface);
  const scaledWidth = surface.canvas.width * view.scale;
  const scaledHeight = surface.canvas.height * view.scale;
  const minOffsetX = Math.min(0, surface.canvas.width - scaledWidth);
  const minOffsetY = Math.min(0, surface.canvas.height - scaledHeight);
  view.offsetX = Math.max(minOffsetX, Math.min(0, view.offsetX));
  view.offsetY = Math.max(minOffsetY, Math.min(0, view.offsetY));
}

function drawBaseMap(surface) {
  const view = stateFor(surface);
  const { canvas, ctx } = surface;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "rgba(30, 64, 75, 0.95)");
  gradient.addColorStop(1, "rgba(8, 22, 26, 0.98)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(view.offsetX, view.offsetY);
  ctx.scale(view.scale, view.scale);
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1 / view.scale;
  for (let i = 0; i <= 6; i += 1) {
    const y = (canvas.height / 6) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  for (let i = 0; i <= 12; i += 1) {
    const x = (canvas.width / 12) * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  ctx.restore();
}

function renderMapToSurface(state, surface) {
  const view = stateFor(surface);
  drawBaseMap(surface);
  if (!state.result) {
    return;
  }

  const { canvas, ctx } = surface;
  const cellWidth = canvas.width / lon.length;
  const cellHeight = canvas.height / lat.length;
  const zGrid = state.result.zScore;

  ctx.save();
  ctx.translate(view.offsetX, view.offsetY);
  ctx.scale(view.scale, view.scale);
  for (let row = 0; row < lat.length; row += 1) {
    for (let col = 0; col < lon.length; col += 1) {
      const z = zGrid[row][col];
      const color = colorForZ(z, state.threshold);
      if (color.endsWith(", 0)")) {
        continue;
      }
      ctx.fillStyle = color;
      ctx.fillRect(col * cellWidth, row * cellHeight, cellWidth + 0.2, cellHeight + 0.2);
    }
  }
  ctx.restore();
}

function renderMaps(state) {
  renderMapToSurface(state, mainSurface);
  updateResetButton(mainSurface);
  if (!mapModal.classList.contains("hidden")) {
    renderMapToSurface(state, modalSurface);
    updateResetButton(modalSurface);
  }
}

function dataPointFromEvent(surface, event) {
  const view = stateFor(surface);
  const bounds = surface.canvas.getBoundingClientRect();
  const cssX = event.clientX - bounds.left;
  const cssY = event.clientY - bounds.top;
  const px = (cssX / bounds.width) * surface.canvas.width;
  const py = (cssY / bounds.height) * surface.canvas.height;
  const localX = (px - view.offsetX) / view.scale;
  const localY = (py - view.offsetY) / view.scale;
  const col = Math.floor((localX / surface.canvas.width) * lon.length);
  const row = Math.floor((localY / surface.canvas.height) * lat.length);
  return { row, col, cssX, cssY, bounds };
}

function renderTooltip(surface, event) {
  const state = currentState();
  if (!state.result) {
    surface.tooltip.classList.add("hidden");
    return;
  }

  const { row, col, cssX, cssY, bounds } = dataPointFromEvent(surface, event);
  if (row < 0 || row >= lat.length || col < 0 || col >= lon.length) {
    surface.tooltip.classList.add("hidden");
    return;
  }

  const z = state.result.zScore[row][col];
  const diff = state.result.difference[row][col];
  if (z === null) {
    surface.tooltip.classList.add("hidden");
    return;
  }

  const preferLeft = cssX > bounds.width * 0.5;
  const tooltipWidth = 228;
  let left = preferLeft ? cssX - tooltipWidth - 10 : cssX + 10;
  let top = cssY + 10;
  left = Math.max(12, Math.min(bounds.width - tooltipWidth - 12, left));
  top = Math.max(12, Math.min(bounds.height - 122, top));

  surface.tooltip.classList.remove("hidden");
  surface.tooltip.style.left = `${left}px`;
  surface.tooltip.style.top = `${top}px`;
  surface.tooltip.innerHTML = `
    <div><strong>${variableLabel(state.variable)}</strong></div>
    <div>${t("tooltipLon")}: ${formatDirectionalCoordinate(lon[col], "E", "W")}</div>
    <div>${t("tooltipLat")}: ${formatDirectionalCoordinate(lat[row], "N", "S")}</div>
    <div>z-score: ${formatNumber(z)}</div>
    <div>${t("tooltipDiff")}: ${formatNumber(diff, 4)} ${state.variable.unit}</div>
  `;
}

function onWheel(surface, event) {
  event.preventDefault();
  const view = stateFor(surface);
  const bounds = surface.canvas.getBoundingClientRect();
  const px = ((event.clientX - bounds.left) / bounds.width) * surface.canvas.width;
  const py = ((event.clientY - bounds.top) / bounds.height) * surface.canvas.height;
  const worldX = (px - view.offsetX) / view.scale;
  const worldY = (py - view.offsetY) / view.scale;
  const zoomFactor = event.deltaY < 0 ? 1.12 : 0.9;
  const nextScale = Math.max(1, Math.min(8, view.scale * zoomFactor));
  view.offsetX = px - worldX * nextScale;
  view.offsetY = py - worldY * nextScale;
  view.scale = nextScale;
  clampOffsets(surface);
  render();
}

function onMouseDown(surface, event) {
  if (event.button !== 0 && event.button !== 1) {
    return;
  }
  const view = stateFor(surface);
  event.preventDefault();
  view.dragging = true;
  view.startX = event.clientX;
  view.startY = event.clientY;
  view.startOffsetX = view.offsetX;
  view.startOffsetY = view.offsetY;
  surface.canvas.classList.add("dragging");
}

function onMouseMove(surface, event) {
  const view = stateFor(surface);
  if (view.dragging) {
    event.preventDefault();
    view.offsetX = view.startOffsetX + (event.clientX - view.startX);
    view.offsetY = view.startOffsetY + (event.clientY - view.startY);
    clampOffsets(surface);
    render();
    return;
  }
  renderTooltip(surface, event);
}

function endDrag(surface) {
  const view = stateFor(surface);
  view.dragging = false;
  surface.canvas.classList.remove("dragging");
}

function resetView(surface) {
  const view = stateFor(surface);
  view.scale = 1;
  view.offsetX = 0;
  view.offsetY = 0;
  surface.tooltip.classList.add("hidden");
  render();
}

function openMapModal() {
  mapModal.classList.remove("hidden");
  mapModal.setAttribute("aria-hidden", "false");
  render();
}

function closeMapModal() {
  modalSurface.tooltip.classList.add("hidden");
  mapModal.classList.add("hidden");
  mapModal.setAttribute("aria-hidden", "true");
}

async function render() {
  root.lang = currentLanguage() === "zh" ? "zh-CN" : "en";
  applyTranslations();
  syncVariableOptions();
  const variableKey = variableSelect.value || Object.keys(data.variables)[0];
  setLoading(!variableDataCache[variableKey]);
  await ensureVariableData(variableKey);
  setLoading(false);
  const state = currentState();
  renderSummary(state);
  renderMaps(state);
}

function registerSurfaceEvents(surface) {
  surface.canvas.addEventListener("mousemove", (event) => onMouseMove(surface, event));
  surface.canvas.addEventListener("mousedown", (event) => onMouseDown(surface, event));
  surface.canvas.addEventListener("wheel", (event) => onWheel(surface, event), { passive: false });
  surface.canvas.addEventListener("mouseleave", () => {
    surface.tooltip.classList.add("hidden");
  });
  surface.resetButton.addEventListener("click", () => resetView(surface));
}

function registerEvents() {
  variableSelect.addEventListener("change", render);
  windowSelect.addEventListener("change", render);
  thresholdRange.addEventListener("input", render);
  languageSelect.addEventListener("change", render);
  registerSurfaceEvents(mainSurface);
  registerSurfaceEvents(modalSurface);
  window.addEventListener("mouseup", () => {
    endDrag(mainSurface);
    endDrag(modalSurface);
  });
  expandMapButton.addEventListener("click", openMapModal);
  closeMapModalButton.addEventListener("click", closeMapModal);
  mapModal.addEventListener("click", (event) => {
    if (event.target === mapModal || event.target.classList.contains("map-modal-backdrop")) {
      closeMapModal();
    }
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !mapModal.classList.contains("hidden")) {
      closeMapModal();
    }
  });
}

registerEvents();
render();
