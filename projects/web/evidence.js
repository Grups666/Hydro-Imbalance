const data = window.ANALYSIS_DATA;

const I18N = {
  zh: {
    heroEyebrow: "WaterGAP / Global Diagnostics",
    heroTitle: "变量分析",
    heroCopy: "同时查看单个变量的标准化失衡证据和多年平均空间分布，区分异常强度与变量本身量级。",
    navImbalance: "失衡诊断",
    navVariables: "变量分析",
    navEvidence: "变量分析",
    controlsTitle: "变量控制",
    controlsDesc: "切换变量、近期窗口、异常阈值、均值类型和语言。",
    language: "语言",
    variable: "变量",
    window: "近期窗口",
    window20: "近 20 年",
    window30: "近 30 年",
    windowFullPeriod: "全时段",
    threshold: "显著异常阈值",
    meanType: "均值类型",
    baselineMean: "长期基线多年平均",
    recentMean: "近期窗口多年平均",
    evidenceMapTitle: "变量失衡证据",
    meanMapTitle: "变量均值分布",
    legendNegative: "负偏离",
    legendPositive: "正偏离",
    legendLow: "低值",
    legendHigh: "高值",
    evidenceSummaryTitle: "失衡证据摘要",
    meanSummaryTitle: "均值分布摘要",
    metricGrid: "输出分辨率",
    resolutionValue: "0.5° 全球网格",
    displayedMetric: "显示指标",
    recentPeriod: "近期窗口",
    baselinePeriod: "长期基线",
    meanPeriod: "均值时段",
    zScore: "z-score",
    validCells: "有效网格",
    meanAbsZ: "平均 |z|",
    maxAbsZ: "最大 |z|",
    highShare: "显著异常占比",
    stdFloor: "标准差下限",
    activityFloor: "证据活动下限",
    practicalStdFloor: "实际量级标准差下限",
    minValue: "最小值",
    medianValue: "中位数",
    maxValue: "最大值",
    tooltipLon: "经度",
    tooltipLat: "纬度",
    tooltipDiff: "差值",
    tooltipValue: "均值",
    methodTitle: "说明",
    methodText: "上方地图显示变量在有效证据域内的标准化偏离，用于解释失衡强度；下方地图显示同一变量的多年平均量级，用于判断异常是否发生在有实际水文或用水意义的区域。二者共用变量和近期窗口，但长期基线均值显示为全基线时段。",
    mapSubtitleEvidence: "近期相对长期基线的标准化偏离",
    mapSubtitleBaseline: "长期基线期的多年平均值",
    mapSubtitleRecent: "近期窗口的多年平均值",
    loading: "正在加载变量数据...",
    expandMap: "放大地图",
    closeMap: "关闭放大地图",
    resetView: "回正",
  },
  en: {
    heroEyebrow: "WaterGAP / Global Diagnostics",
    heroTitle: "Variable Analysis",
    heroCopy: "Inspect standardized imbalance evidence and multi-year mean magnitude for the same variable in one view.",
    navImbalance: "Diagnosis",
    navVariables: "Variables",
    navEvidence: "Variables",
    controlsTitle: "Variable Controls",
    controlsDesc: "Switch variable, recent window, anomaly threshold, mean type, and language.",
    language: "Language",
    variable: "Variable",
    window: "Recent window",
    window20: "Recent 20 years",
    window30: "Recent 30 years",
    windowFullPeriod: "Full period",
    threshold: "Significant anomaly threshold",
    meanType: "Mean type",
    baselineMean: "Baseline multi-year mean",
    recentMean: "Recent-window mean",
    evidenceMapTitle: "Variable Imbalance Evidence",
    meanMapTitle: "Variable Mean Distribution",
    legendNegative: "Negative",
    legendPositive: "Positive",
    legendLow: "Low",
    legendHigh: "High",
    evidenceSummaryTitle: "Evidence Summary",
    meanSummaryTitle: "Mean Summary",
    metricGrid: "Grid",
    resolutionValue: "0.5° Global Grid",
    displayedMetric: "Displayed metric",
    recentPeriod: "Recent window",
    baselinePeriod: "Long-term baseline",
    meanPeriod: "Mean period",
    zScore: "z-score",
    validCells: "Valid cells",
    meanAbsZ: "Mean |z|",
    maxAbsZ: "Max |z|",
    highShare: "Significant share",
    stdFloor: "Std floor",
    activityFloor: "Evidence activity floor",
    practicalStdFloor: "Practical std floor",
    minValue: "Minimum",
    medianValue: "Median",
    maxValue: "Maximum",
    tooltipLon: "Lon",
    tooltipLat: "Lat",
    tooltipDiff: "Difference",
    tooltipValue: "Mean",
    methodTitle: "Method",
    methodText: "The upper map shows standardized departures inside the effective evidence domain and explains anomaly intensity. The lower map shows the same variable's multi-year mean magnitude, making it clear whether the anomaly occurs where the variable has hydrological or water-use relevance. Both maps share the selected variable and recent window; baseline means are shown for the full baseline period.",
    mapSubtitleEvidence: "Standardized departure of the recent window from the long-term baseline",
    mapSubtitleBaseline: "Multi-year mean over the long-term baseline",
    mapSubtitleRecent: "Multi-year mean over the recent window",
    loading: "Loading variable data...",
    expandMap: "Expand map",
    closeMap: "Close expanded map",
    resetView: "Reset view",
  },
};

const root = document.documentElement;
const lat = data.grid.lat;
const lon = data.grid.lon;
const LANGUAGE_STORAGE_KEY = "waterCycleLanguage";
const MISSING_SCORE = "N/A";
const SPARSE_ACTIVE_SHARE_THRESHOLD = 0.35;
const SPARSE_ACTIVITY_FLOOR_PERCENTILE = 60;
const SPARSE_STD_REFERENCE_PERCENTILE = 75;
const SPARSE_STD_REFERENCE_RATIO = 0.5;

const elements = {
  languageSelect: document.getElementById("languageSelect"),
  variableSelect: document.getElementById("variableSelect"),
  windowSelect: document.getElementById("windowSelect"),
  thresholdRange: document.getElementById("thresholdRange"),
  thresholdValue: document.getElementById("thresholdValue"),
  meanTypeSelect: document.getElementById("meanTypeSelect"),
  evidenceMapTitle: document.getElementById("evidenceMapTitle"),
  evidenceMapSubtitle: document.getElementById("evidenceMapSubtitle"),
  meanMapTitle: document.getElementById("meanMapTitle"),
  meanMapSubtitle: document.getElementById("meanMapSubtitle"),
  evidencePeriodCard: document.getElementById("evidencePeriodCard"),
  meanPeriodCard: document.getElementById("meanPeriodCard"),
  evidenceSummaryGrid: document.getElementById("evidenceSummaryGrid"),
  meanSummaryGrid: document.getElementById("meanSummaryGrid"),
  methodBox: document.getElementById("methodBox"),
  loadingOverlay: document.getElementById("loadingOverlay"),
  expandEvidenceMapButton: document.getElementById("expandEvidenceMapButton"),
  expandMeanMapButton: document.getElementById("expandMeanMapButton"),
  closeMapModalButton: document.getElementById("closeMapModalButton"),
  mapModal: document.getElementById("mapModal"),
};

window.ANALYSIS_VARIABLE_DATA = window.ANALYSIS_VARIABLE_DATA || {};
const variableDataCache = window.ANALYSIS_VARIABLE_DATA;
const loadingScripts = new Map();

const surfaces = {
  evidence: makeSurface("evidence", "evidenceMapCanvas", "evidenceTooltip", "resetEvidenceViewButton", "evidence"),
  mean: makeSurface("mean", "meanMapCanvas", "meanTooltip", "resetMeanViewButton", "mean"),
  modal: makeSurface("modal", "modalMapCanvas", "modalTooltip", "modalResetViewButton", "evidence"),
};

const interactionState = {
  evidence: makeView(),
  mean: makeView(),
  modal: makeView(),
};

let renderedLanguage = null;
let renderedState = null;
let modalKind = "evidence";

function makeSurface(key, canvasId, tooltipId, resetButtonId, kind) {
  const canvas = document.getElementById(canvasId);
  return {
    key,
    kind,
    canvas,
    ctx: canvas.getContext("2d"),
    tooltip: document.getElementById(tooltipId),
    resetButton: document.getElementById(resetButtonId),
  };
}

function makeView() {
  return { scale: 1, offsetX: 0, offsetY: 0, dragging: false, startX: 0, startY: 0, startOffsetX: 0, startOffsetY: 0 };
}

function currentLanguage() {
  return elements.languageSelect.value || "zh";
}

function t(key) {
  return I18N[currentLanguage()][key] || key;
}

function restoreLanguagePreference() {
  const savedLanguage = root.dataset.initialLanguage || localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (savedLanguage && I18N[savedLanguage]) {
    elements.languageSelect.value = savedLanguage;
  }
}

function persistLanguagePreference() {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage());
}

function variableLabel(code) {
  const variable = data.variables[code];
  return variable ? variable.label[currentLanguage()] || variable.label.en || code : code;
}

function optionLabel(code) {
  return `${variableLabel(code)} [${code}]`;
}

function syncStaticText() {
  root.lang = currentLanguage() === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.dataset.i18n;
    if (key && I18N[currentLanguage()][key]) node.textContent = t(key);
  });
  elements.loadingOverlay.textContent = t("loading");
  elements.thresholdValue.textContent = `${Number(elements.thresholdRange.value).toFixed(1)}σ`;
  elements.closeMapModalButton.setAttribute("aria-label", t("closeMap"));
  Object.values(surfaces).forEach((surface) => {
    surface.resetButton.setAttribute("aria-label", t("resetView"));
  });
  elements.expandEvidenceMapButton.setAttribute("aria-label", t("expandMap"));
  elements.expandMeanMapButton.setAttribute("aria-label", t("expandMap"));
  root.classList.remove("i18n-booting");
  root.classList.add("i18n-ready");
}

function populateSelectors() {
  if (renderedLanguage !== currentLanguage() || elements.variableSelect.options.length === 0) {
    const previousVariable = elements.variableSelect.value;
    elements.variableSelect.innerHTML = "";
    Object.keys(data.variables)
      .sort((a, b) => optionLabel(a).localeCompare(optionLabel(b), currentLanguage() === "zh" ? "zh-CN" : "en"))
      .forEach((code) => {
        const option = document.createElement("option");
        option.value = code;
        option.textContent = optionLabel(code);
        elements.variableSelect.appendChild(option);
      });
    elements.variableSelect.value = data.variables[previousVariable] ? previousVariable : Object.keys(data.variables)[0];
    elements.windowSelect.options[0].textContent = t("window20");
    elements.windowSelect.options[1].textContent = t("window30");
    elements.meanTypeSelect.options[0].textContent = t("baselineMean");
    elements.meanTypeSelect.options[1].textContent = t("recentMean");
    renderedLanguage = currentLanguage();
  }
}

function setLoading(active) {
  elements.loadingOverlay.classList.toggle("hidden", !active);
  elements.loadingOverlay.textContent = t("loading");
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });
}

async function ensureVariableData(code) {
  if (variableDataCache[code]) return variableDataCache[code];
  if (!loadingScripts.has(code)) {
    loadingScripts.set(code, loadScript(data.variables[code].dataScript));
  }
  await loadingScripts.get(code);
  return variableDataCache[code];
}

function flattenValidValues(grid, predicate = null) {
  const values = [];
  for (const row of grid) {
    for (const value of row) {
      if (value === null || !Number.isFinite(Number(value))) continue;
      if (predicate && !predicate(Number(value))) continue;
      values.push(Number(value));
    }
  }
  return values;
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = ((sorted.length - 1) * p) / 100;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function quantiles(values, ps) {
  return ps.map((p) => percentile(values, p * 100));
}

function extent(values) {
  if (!values.length) return { min: null, max: null };
  let min = values[0];
  let max = values[0];
  for (let index = 1; index < values.length; index += 1) {
    min = Math.min(min, values[index]);
    max = Math.max(max, values[index]);
  }
  return { min, max };
}

function supportProfile(result) {
  const magnitudeGrid = result.magnitude || result.recentMean || result.baselineMean;
  const validMagnitudeValues = magnitudeGrid ? flattenValidValues(magnitudeGrid, (value) => value > 0) : [];
  const finiteMagnitudeValues = magnitudeGrid ? flattenValidValues(magnitudeGrid) : [];
  const activeShare = finiteMagnitudeValues.length ? validMagnitudeValues.length / finiteMagnitudeValues.length : 0;
  const sparseSupport = activeShare < SPARSE_ACTIVE_SHARE_THRESHOLD;
  return {
    activeShare,
    sparseSupport,
    activityFloor: sparseSupport && validMagnitudeValues.length
      ? percentile(validMagnitudeValues, SPARSE_ACTIVITY_FLOOR_PERCENTILE)
      : 0,
    practicalStdFloor: sparseSupport && validMagnitudeValues.length
      ? percentile(validMagnitudeValues, SPARSE_STD_REFERENCE_PERCENTILE) * SPARSE_STD_REFERENCE_RATIO
      : 0,
  };
}

function adjustedZ(result, rowIndex, colIndex, profile) {
  const rawZ = result.zScore[rowIndex][colIndex];
  const diff = result.difference[rowIndex][colIndex];
  if (rawZ === null || diff === null || !Number.isFinite(Number(rawZ)) || !Number.isFinite(Number(diff))) return null;
  const numericRawZ = Number(rawZ);
  const numericDiff = Number(diff);
  if (numericDiff === 0) return 0;
  const inferredStd = numericRawZ !== 0 ? Math.abs(numericDiff / numericRawZ) : Number.POSITIVE_INFINITY;
  const denominator = Math.max(inferredStd, profile.practicalStdFloor);
  return denominator > 0 && Number.isFinite(denominator) ? numericDiff / denominator : null;
}

function buildEvidenceResult(result, threshold) {
  const magnitudeGrid = result.magnitude || result.recentMean || result.baselineMean;
  const profile = supportProfile(result);
  let valid = 0;
  let high = 0;
  let absSum = 0;
  let absMax = 0;
  const cells = result.zScore.map((row, rowIndex) => row.map((rawZ, colIndex) => {
    const magnitude = magnitudeGrid ? magnitudeGrid[rowIndex][colIndex] : null;
    const outsideActivityDomain =
      profile.activityFloor > 0 &&
      (!Number.isFinite(Number(magnitude)) || Number(magnitude) < profile.activityFloor);
    if (rawZ === null || !Number.isFinite(Number(rawZ)) || outsideActivityDomain) return { z: null, magnitude };
    const z = adjustedZ(result, rowIndex, colIndex, profile);
    if (z === null || !Number.isFinite(Number(z))) return { z: null, magnitude };
    const absZ = Math.abs(Number(z));
    valid += 1;
    absSum += absZ;
    absMax = Math.max(absMax, absZ);
    if (absZ >= threshold) high += 1;
    return { z: Number(z), magnitude };
  }));
  return {
    cells,
    profile,
    summary: {
      valid,
      meanAbsZ: valid ? absSum / valid : 0,
      maxAbsZ: absMax,
      highShare: valid ? (high / valid) * 100 : 0,
    },
  };
}

function buildMeanResult(result, meanType) {
  const grid = result[meanType];
  const values = flattenValidValues(grid);
  return {
    grid,
    values,
    thresholds: quantiles(values, [0.1, 0.3, 0.5, 0.7, 0.9]),
  };
}

function currentState() {
  const variableKey = elements.variableSelect.value || Object.keys(data.variables)[0];
  const windowKey = elements.windowSelect.value || "20";
  const threshold = Number(elements.thresholdRange.value);
  const meanType = elements.meanTypeSelect.value || "baselineMean";
  const payload = variableDataCache[variableKey];
  const result = payload ? payload.windows[windowKey] : null;
  return {
    variableKey,
    variable: data.variables[variableKey],
    windowKey,
    threshold,
    meanType,
    result,
    evidence: result ? buildEvidenceResult(result, threshold) : null,
    mean: result ? buildMeanResult(result, meanType) : null,
  };
}

function colorForEvidenceCell(cell, threshold) {
  if (!cell || cell.z === null || !Number.isFinite(Number(cell.z))) return "rgba(0,0,0,0)";
  const isLight = root.getAttribute("data-theme") === "light";
  if (Math.abs(cell.z) < threshold) {
    return isLight ? "rgba(180, 168, 96, 0.55)" : "rgba(226, 220, 190, 0.65)";
  }
  const alpha = Math.min(0.94, 0.42 + Math.abs(cell.z) * 0.12);
  if (isLight) {
    return cell.z > 0 ? `rgba(190, 70, 55, ${alpha})` : `rgba(42, 130, 170, ${alpha})`;
  }
  return cell.z > 0 ? `rgba(210, 82, 65, ${alpha})` : `rgba(65, 150, 192, ${alpha})`;
}

function colorForMeanValue(value, thresholds) {
  if (value === null || !Number.isFinite(Number(value))) return "rgba(0,0,0,0)";
  const palette = ["#103f59", "#216987", "#4aa8c8", "#d6d7c0", "#e79b6e", "#c96549", "#8d3a2d"];
  const [q10, q30, q50, q70, q90] = thresholds;
  if (q10 === null) return palette[3];
  if (value <= q10) return palette[0];
  if (value <= q30) return palette[1];
  if (value <= q50) return palette[2];
  if (value <= q70) return palette[3];
  if (value <= q90) return palette[5];
  return palette[6];
}

function formatNumber(value, digits = 2) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : MISSING_SCORE;
}

function formatAdaptiveNumber(value, digits = 2) {
  if (!Number.isFinite(Number(value))) return MISSING_SCORE;
  const abs = Math.abs(Number(value));
  if (abs > 0 && abs < 1e-4) return Number(value).toExponential(2);
  return Number(value).toFixed(digits);
}

function formatDirectionalCoordinate(value, positive, negative) {
  const numeric = Number(value);
  return `${Math.abs(numeric).toFixed(2)}° ${numeric >= 0 ? positive : negative}`;
}

function renderSummary(state) {
  if (!state.result || !state.evidence || !state.mean) return;
  elements.thresholdValue.textContent = `${state.threshold.toFixed(1)}σ`;
  const { recentPeriod, baselinePeriod } = state.result;
  const evidenceSummary = state.evidence.summary;
  const meanPeriodLabel = state.meanType === "baselineMean" ? t("baselinePeriod") : t("recentPeriod");
  const meanPeriodValue = state.meanType === "baselineMean"
    ? `${baselinePeriod[0]}-${baselinePeriod[1]}`
    : `${recentPeriod[0]}-${recentPeriod[1]}`;

  elements.evidencePeriodCard.innerHTML = `
    <div>${t("metricGrid")}: <strong>${t("resolutionValue")}</strong></div>
    <div>${t("displayedMetric")}: <strong>${t("zScore")}</strong></div>
    <div>${t("recentPeriod")}: <strong>${recentPeriod[0]}-${recentPeriod[1]}</strong></div>
    <div>${t("baselinePeriod")}: <strong>${baselinePeriod[0]}-${baselinePeriod[1]}</strong></div>
    <div>${t("activityFloor")}: <strong>${formatAdaptiveNumber(state.evidence.profile.activityFloor, 6)}</strong></div>
    <div>${t("practicalStdFloor")}: <strong>${formatAdaptiveNumber(state.evidence.profile.practicalStdFloor, 6)}</strong></div>
  `;
  elements.evidenceSummaryGrid.innerHTML = `
    <div class="summary-item"><span>${t("validCells")}</span><strong>${evidenceSummary.valid}</strong></div>
    <div class="summary-item"><span>${t("meanAbsZ")}</span><strong>${formatNumber(evidenceSummary.meanAbsZ)}</strong></div>
    <div class="summary-item"><span>${t("maxAbsZ")}</span><strong>${formatNumber(evidenceSummary.maxAbsZ)}</strong></div>
    <div class="summary-item"><span>${t("highShare")}</span><strong>${formatNumber(evidenceSummary.highShare, 1)}%</strong></div>
  `;

  const { min, max } = extent(state.mean.values);
  const median = percentile(state.mean.values, 50);
  elements.meanPeriodCard.innerHTML = `
    <div>${t("metricGrid")}: <strong>${t("resolutionValue")}</strong></div>
    <div>${t("displayedMetric")}: <strong>${t(state.meanType)}</strong></div>
    <div>${meanPeriodLabel}: <strong>${meanPeriodValue}</strong></div>
  `;
  elements.meanSummaryGrid.innerHTML = `
    <div class="summary-item"><span>${t("validCells")}</span><strong>${state.mean.values.length}</strong></div>
    <div class="summary-item"><span>${t("minValue")}</span><strong>${formatAdaptiveNumber(min, 4)} ${state.variable.unit}</strong></div>
    <div class="summary-item"><span>${t("medianValue")}</span><strong>${formatAdaptiveNumber(median, 4)} ${state.variable.unit}</strong></div>
    <div class="summary-item"><span>${t("maxValue")}</span><strong>${formatAdaptiveNumber(max, 4)} ${state.variable.unit}</strong></div>
  `;

  elements.evidenceMapTitle.textContent = `${variableLabel(state.variableKey)} ${t("evidenceMapTitle")}`;
  elements.evidenceMapSubtitle.textContent = `${t(`window${state.windowKey}`)} · ${t("mapSubtitleEvidence")} · ${state.variable.unit}`;
  elements.meanMapTitle.textContent = `${variableLabel(state.variableKey)} ${t("meanMapTitle")}`;
  elements.meanMapSubtitle.textContent = `${t(state.meanType)} · ${state.meanType === "baselineMean" ? t("mapSubtitleBaseline") : t("mapSubtitleRecent")} · ${state.variable.unit}`;
  elements.methodBox.innerHTML = `<h3>${t("methodTitle")}</h3><p>${t("methodText")}</p>`;
}

function updateResetButton(surface) {
  const view = interactionState[surface.key];
  const active = Math.abs(view.scale - 1) > 0.001 || Math.abs(view.offsetX) > 1 || Math.abs(view.offsetY) > 1;
  surface.resetButton.classList.toggle("hidden", !active);
}

function clampOffsets(surface) {
  const view = interactionState[surface.key];
  const scaledWidth = surface.canvas.width * view.scale;
  const scaledHeight = surface.canvas.height * view.scale;
  const minOffsetX = Math.min(0, surface.canvas.width - scaledWidth);
  const minOffsetY = Math.min(0, surface.canvas.height - scaledHeight);
  view.offsetX = Math.max(minOffsetX, Math.min(0, view.offsetX));
  view.offsetY = Math.max(minOffsetY, Math.min(0, view.offsetY));
}

function drawBaseMap(surface) {
  const view = interactionState[surface.key];
  const { canvas, ctx } = surface;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const isLight = root.getAttribute("data-theme") === "light";
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  if (isLight) {
    gradient.addColorStop(0, "rgba(200, 220, 230, 0.95)");
    gradient.addColorStop(1, "rgba(180, 200, 210, 0.98)");
  } else {
    gradient.addColorStop(0, "rgba(30, 64, 75, 0.95)");
    gradient.addColorStop(1, "rgba(8, 22, 26, 0.98)");
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(view.offsetX, view.offsetY);
  ctx.scale(view.scale, view.scale);
  ctx.strokeStyle = isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255,255,255,0.12)";
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
  const kind = surface.key === "modal" ? modalKind : surface.kind;
  const view = interactionState[surface.key];
  drawBaseMap(surface);
  if (!state.result) return;
  const { canvas, ctx } = surface;
  const cellWidth = canvas.width / lon.length;
  const cellHeight = canvas.height / lat.length;
  ctx.save();
  ctx.translate(view.offsetX, view.offsetY);
  ctx.scale(view.scale, view.scale);
  for (let row = 0; row < lat.length; row += 1) {
    for (let col = 0; col < lon.length; col += 1) {
      const color = kind === "evidence"
        ? colorForEvidenceCell(state.evidence.cells[row][col], state.threshold)
        : colorForMeanValue(state.mean.grid[row][col], state.mean.thresholds);
      if (color === "rgba(0,0,0,0)") continue;
      ctx.fillStyle = color;
      ctx.fillRect(col * cellWidth, row * cellHeight, cellWidth + 0.2, cellHeight + 0.2);
    }
  }
  ctx.restore();
}

function renderMaps(state) {
  renderMapToSurface(state, surfaces.evidence);
  renderMapToSurface(state, surfaces.mean);
  updateResetButton(surfaces.evidence);
  updateResetButton(surfaces.mean);
  if (!elements.mapModal.classList.contains("hidden")) {
    renderMapToSurface(state, surfaces.modal);
    updateResetButton(surfaces.modal);
  }
}

function dataPointFromEvent(surface, event) {
  const view = interactionState[surface.key];
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
  const state = renderedState;
  if (!state || !state.result) return;
  const kind = surface.key === "modal" ? modalKind : surface.kind;
  const { row, col, cssX, cssY, bounds } = dataPointFromEvent(surface, event);
  if (row < 0 || row >= lat.length || col < 0 || col >= lon.length) {
    surface.tooltip.classList.add("hidden");
    return;
  }

  let detail;
  if (kind === "evidence") {
    const cell = state.evidence.cells[row][col];
    const diff = state.result.difference[row][col];
    if (!cell || cell.z === null) {
      surface.tooltip.classList.add("hidden");
      return;
    }
    detail = `
      <div>${t("zScore")}: ${formatNumber(cell.z)}</div>
      <div>${t("tooltipDiff")}: ${formatAdaptiveNumber(diff, 4)} ${state.variable.unit}</div>
    `;
  } else {
    const value = state.mean.grid[row][col];
    if (value === null || !Number.isFinite(Number(value))) {
      surface.tooltip.classList.add("hidden");
      return;
    }
    detail = `<div>${t("tooltipValue")}: ${formatAdaptiveNumber(value, 4)} ${state.variable.unit}</div>`;
  }

  const preferLeft = cssX > bounds.width * 0.5;
  const tooltipWidth = 248;
  let left = preferLeft ? cssX - tooltipWidth - 10 : cssX + 10;
  let top = cssY + 10;
  left = Math.max(12, Math.min(bounds.width - tooltipWidth - 12, left));
  top = Math.max(12, Math.min(bounds.height - 122, top));
  surface.tooltip.classList.remove("hidden");
  surface.tooltip.style.left = `${left}px`;
  surface.tooltip.style.top = `${top}px`;
  surface.tooltip.innerHTML = `
    <div><strong>${variableLabel(state.variableKey)}</strong></div>
    <div>${t("tooltipLon")}: ${formatDirectionalCoordinate(lon[col], "E", "W")}</div>
    <div>${t("tooltipLat")}: ${formatDirectionalCoordinate(lat[row], "N", "S")}</div>
    ${detail}
  `;
}

function onWheel(surface, event) {
  event.preventDefault();
  const view = interactionState[surface.key];
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
  renderMaps(renderedState);
}

function onMouseDown(surface, event) {
  if (event.button !== 0 && event.button !== 1) return;
  const view = interactionState[surface.key];
  event.preventDefault();
  view.dragging = true;
  view.startX = event.clientX;
  view.startY = event.clientY;
  view.startOffsetX = view.offsetX;
  view.startOffsetY = view.offsetY;
  surface.canvas.classList.add("dragging");
}

function onMouseMove(surface, event) {
  const view = interactionState[surface.key];
  if (view.dragging) {
    event.preventDefault();
    view.offsetX = view.startOffsetX + (event.clientX - view.startX);
    view.offsetY = view.startOffsetY + (event.clientY - view.startY);
    clampOffsets(surface);
    renderMaps(renderedState);
    return;
  }
  renderTooltip(surface, event);
}

function endDrag(surface) {
  interactionState[surface.key].dragging = false;
  surface.canvas.classList.remove("dragging");
}

function resetView(surface) {
  interactionState[surface.key] = makeView();
  surface.tooltip.classList.add("hidden");
  renderMaps(renderedState);
}

function openMapModal(kind) {
  modalKind = kind;
  surfaces.modal.kind = kind;
  interactionState.modal = { ...interactionState[kind], dragging: false };
  elements.mapModal.classList.remove("hidden");
  elements.mapModal.setAttribute("aria-hidden", "false");
  renderMaps(renderedState);
}

function closeMapModal() {
  surfaces.modal.tooltip.classList.add("hidden");
  elements.mapModal.classList.add("hidden");
  elements.mapModal.setAttribute("aria-hidden", "true");
}

async function render() {
  persistLanguagePreference();
  syncStaticText();
  populateSelectors();
  const variableKey = elements.variableSelect.value || Object.keys(data.variables)[0];
  setLoading(!variableDataCache[variableKey]);
  await ensureVariableData(variableKey);
  setLoading(false);
  const state = currentState();
  renderedState = state;
  renderSummary(state);
  renderMaps(state);
}

function registerSurfaceEvents(surface) {
  surface.canvas.addEventListener("mousemove", (event) => onMouseMove(surface, event));
  surface.canvas.addEventListener("mousedown", (event) => onMouseDown(surface, event));
  surface.canvas.addEventListener("wheel", (event) => onWheel(surface, event), { passive: false });
  surface.canvas.addEventListener("mouseleave", () => surface.tooltip.classList.add("hidden"));
  surface.resetButton.addEventListener("click", () => resetView(surface));
}

function registerEvents() {
  elements.languageSelect.addEventListener("change", render);
  elements.variableSelect.addEventListener("change", render);
  elements.windowSelect.addEventListener("change", render);
  elements.meanTypeSelect.addEventListener("change", render);
  elements.thresholdRange.addEventListener("input", render);
  registerSurfaceEvents(surfaces.evidence);
  registerSurfaceEvents(surfaces.mean);
  registerSurfaceEvents(surfaces.modal);
  window.addEventListener("mouseup", () => {
    endDrag(surfaces.evidence);
    endDrag(surfaces.mean);
    endDrag(surfaces.modal);
  });
  elements.expandEvidenceMapButton.addEventListener("click", () => openMapModal("evidence"));
  elements.expandMeanMapButton.addEventListener("click", () => openMapModal("mean"));
  elements.closeMapModalButton.addEventListener("click", closeMapModal);
  elements.mapModal.addEventListener("click", (event) => {
    if (event.target === elements.mapModal || event.target.classList.contains("map-modal-backdrop")) {
      closeMapModal();
    }
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.mapModal.classList.contains("hidden")) closeMapModal();
  });
}

registerEvents();
restoreLanguagePreference();

// Theme toggle functionality
const themeToggle = document.getElementById("themeToggle");
const THEME_KEY = "water-cycle-theme";

function getStoredTheme() {
  return localStorage.getItem(THEME_KEY);
}

function setStoredTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
}

function applyTheme(theme) {
  if (theme === "light") {
    root.setAttribute("data-theme", "light");
  } else {
    root.removeAttribute("data-theme");
  }
}

function toggleTheme() {
  const currentTheme = root.getAttribute("data-theme");
  const newTheme = currentTheme === "light" ? "dark" : "light";
  applyTheme(newTheme);
  setStoredTheme(newTheme);
  render();
}

// Initialize theme from storage
const storedTheme = getStoredTheme();
if (storedTheme) {
  applyTheme(storedTheme);
}

if (themeToggle) {
  themeToggle.addEventListener("click", toggleTheme);
}

render();
