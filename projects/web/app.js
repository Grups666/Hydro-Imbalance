const data = window.ANALYSIS_DATA;

const I18N = {
  zh: {
    heroEyebrow: "WaterGAP / Global Diagnostics",
    heroTitle: "水循环失衡诊断",
    heroCopy: "以综合失衡为入口，沿通量异常、储量异常、极端化异常和供需/功能异常四个维度追踪变量证据。",
    navImbalance: "失衡诊断",
    navEvidence: "变量分析",
    controlsTitle: "诊断控制",
    controlsDesc: "切换诊断层级、空间单元和时间窗口。",
    language: "语言",
    diagnosticLayer: "诊断层级",
    mapUnit: "空间单元",
    meshUnit: "网格",
    basinUnit: "流域",
    selectedBasin: "选中流域",
    noBasinData: "流域边界未生成",
    noBasinDataHint: "运行 python src/build_basins.py 下载 HydroBASINS 并生成流域聚合数据。",
    basinId: "流域编号",
    basinCells: "流域网格数",
    basinCount: "流域数量",
    window: "时间窗口",
    window20: "近 20 年",
    window30: "近 30 年",
    variable: "变量",
    overview: "综合失衡",
    flux: "通量异常",
    storage: "储量异常",
    extreme: "极端化异常",
    demand: "供需/功能异常",
    overviewDesc: "四个子维度的综合失衡强度，数值越高表示多维异常越集中。",
    fluxDesc: "降水、蒸散发、径流、补给等通量变量相对基线的偏离强度。",
    storageDesc: "总水储量、土壤水、地下水、积雪、湖库湿地等状态变量的偏离强度。",
    extremeDesc: "基于月/年尺度变量近似刻画强降水、干旱倾向和旱涝转换风险。",
    demandDesc: "取水、耗水和自然供水能力之间的异常关系，反映人类用水压力与功能错配。",
    legendLow: "低",
    legendHigh: "高",
    loading: "正在加载诊断数据...",
    expandMap: "放大地图",
    closeMap: "关闭放大地图",
    score: "失衡指数",
    layerScore: "层级指数",
    globalSummary: "全球摘要",
    selectedGrid: "选中网格",
    noCellSelected: "点击地图网格查看局地诊断。",
    dimensionScores: "四维诊断",
    mainEvidence: "主要证据",
    validCells: "有效网格",
    highShare: "高失衡占比",
    meanScore: "平均指数",
    maxScore: "最高指数",
    dominantDimension: "主导维度",
    dataSupport: "数据支撑",
    approximate: "近似",
    full: "完整",
    lon: "经度",
    lat: "纬度",
    zScore: "z-score",
    difference: "差值",
    recent: "近期",
    baseline: "基线",
    variableCount: "变量数",
    levelStable: "基本稳定",
    levelMild: "轻度异常",
    levelModerate: "中度失衡",
    levelSevere: "重度失衡",
    levelExtreme: "极重失衡",
    methodTitle: "判定方法",
    methodText: "综合失衡指数按四个子维度组织。每个变量先进入自身的有效证据域：对低量级、稀疏变量，仅保留有实际活动的空间支持域，并用实际量级标准差下限抑制极小方差放大。随后将有效域内的 |z| 按 3σ 截断并转换为 0-100 分；子维度取相关变量中的最大异常分数，综合层取四个子维度平均。显著异常占比使用固定阈值 50 分。",
  },
  en: {
    heroEyebrow: "WaterGAP / Global Diagnostics",
    heroTitle: "Water Cycle Imbalance Diagnosis",
    heroCopy: "Start from an integrated imbalance index, then trace the evidence through flux, storage, extremity, and demand/function dimensions.",
    navImbalance: "Diagnosis",
    navEvidence: "Variables",
    controlsTitle: "Diagnosis Controls",
    controlsDesc: "Switch diagnosis layer, spatial unit, and time window.",
    language: "Language",
    diagnosticLayer: "Diagnosis layer",
    mapUnit: "Spatial unit",
    meshUnit: "Grid",
    basinUnit: "Basin",
    selectedBasin: "Selected basin",
    noBasinData: "Basin boundaries not generated",
    noBasinDataHint: "Run python src/build_basins.py to download HydroBASINS and generate basin aggregation data.",
    basinId: "Basin ID",
    basinCells: "Basin grid cells",
    basinCount: "Basins",
    window: "Window",
    window20: "Recent 20 years",
    window30: "Recent 30 years",
    variable: "Variable",
    overview: "Integrated imbalance",
    flux: "Flux anomaly",
    storage: "Storage anomaly",
    extreme: "Extremity anomaly",
    demand: "Demand/function mismatch",
    overviewDesc: "Integrated intensity across four diagnostic dimensions; higher values mean multi-dimensional anomaly concentration.",
    fluxDesc: "Baseline-relative anomaly intensity in precipitation, evapotranspiration, runoff, and recharge variables.",
    storageDesc: "Anomaly intensity in total water storage, soil water, groundwater, snow, river, lake, reservoir, and wetland states.",
    extremeDesc: "Monthly/yearly proxy diagnosis for heavy precipitation, drought tendency, and dry-wet transition risks.",
    demandDesc: "Anomalous relationships among withdrawals, consumptive use, and natural supply capacity.",
    legendLow: "Low",
    legendHigh: "High",
    loading: "Loading diagnostic data...",
    expandMap: "Expand map",
    closeMap: "Close expanded map",
    score: "Imbalance index",
    layerScore: "Layer index",
    globalSummary: "Global summary",
    selectedGrid: "Selected grid",
    noCellSelected: "Click a map cell to inspect local diagnosis.",
    dimensionScores: "Four dimensions",
    mainEvidence: "Main evidence",
    validCells: "Valid cells",
    highShare: "High-imbalance share",
    meanScore: "Mean index",
    maxScore: "Max index",
    dominantDimension: "Dominant dimension",
    dataSupport: "Data support",
    approximate: "Approximate",
    full: "Full",
    lon: "Lon",
    lat: "Lat",
    zScore: "z-score",
    difference: "Difference",
    recent: "Recent",
    baseline: "Baseline",
    variableCount: "Variables",
    levelStable: "Stable",
    levelMild: "Mild anomaly",
    levelModerate: "Moderate imbalance",
    levelSevere: "Severe imbalance",
    levelExtreme: "Extreme imbalance",
    methodTitle: "Method",
    methodText: "The integrated imbalance index is organized by four dimensions. Each variable first enters its effective evidence domain: sparse low-magnitude variables only keep cells with meaningful activity, and a practical standard-deviation floor tied to variable magnitude prevents tiny variance from amplifying negligible changes. Effective |z| is then clipped at 3σ and converted to 0-100. Dimension scores use the maximum score among related variables, while the integrated layer averages the four dimensions. High-imbalance share uses a fixed score threshold of 50.",
  },
};

const DIMENSIONS = {
  flux: {
    variables: ["evap-total", "potevap", "dis", "qtot", "qs", "qsb", "qg", "qr", "qrd", "qrf", "triver"],
    support: "full",
  },
  storage: {
    variables: ["tws", "soilmoist", "groundwstor", "swe", "riverstor", "reservoirstor", "lakestor", "wetlandstor", "canopystor"],
    support: "full",
  },
  extreme: {
    variables: ["evap-total", "potevap", "soilmoist", "dis", "qtot"],
    support: "approximate",
  },
  demand: {
    variables: ["ptotww", "ptotuse", "ptotwwgw", "ptotusegw", "pirrww", "pirruse", "pirrwwgw", "pirrusegw", "pdomww", "pdomuse", "pdomwwgw", "pdomusegw", "pliveww", "pliveuse", "pmanww", "pmanuse", "pmanwwgw", "pmanusegw", "pelecww", "pelecuse", "atotuse", "atotusegw"],
    support: "full",
  },
};

const LAYERS = ["overview", "flux", "storage", "extreme", "demand"];
const LANGUAGE_STORAGE_KEY = "waterCycleLanguage";
const SCORE_CAP_SIGMA = 3;
const SIGNIFICANT_SCORE_THRESHOLD = 50;
const SPARSE_ACTIVE_SHARE_THRESHOLD = 0.35;
const SPARSE_ACTIVITY_FLOOR_PERCENTILE = 60;
const SPARSE_STD_REFERENCE_PERCENTILE = 75;
const SPARSE_STD_REFERENCE_RATIO = 0.5;

const root = document.documentElement;
const lat = data.grid.lat;
const lon = data.grid.lon;
const rows = data.grid.rows;
const cols = data.grid.cols;
const basinData = window.BASIN_DATA || { meta: { basinCount: 0 }, basins: [] };

const elements = {
  languageSelect: document.getElementById("languageSelect"),
  layerSelect: document.getElementById("layerSelect"),
  mapUnitSelect: document.getElementById("mapUnitSelect"),
  windowSelect: document.getElementById("windowSelect"),
  mapTitle: document.getElementById("mapTitle"),
  mapSubtitle: document.getElementById("mapSubtitle"),
  layerTabs: document.getElementById("layerTabs"),
  scoreCard: document.getElementById("scoreCard"),
  dimensionBars: document.getElementById("dimensionBars"),
  evidenceList: document.getElementById("evidenceList"),
  methodBox: document.getElementById("methodBox"),
  loadingOverlay: document.getElementById("loadingOverlay"),
  expandMapButton: document.getElementById("expandMapButton"),
  closeMapModalButton: document.getElementById("closeMapModalButton"),
  mapModal: document.getElementById("mapModal"),
};

const surfaces = {
  main: makeSurface("main", "mapCanvas", "tooltip", "resetViewButton"),
  modal: makeSurface("modal", "modalMapCanvas", "modalTooltip", "modalResetViewButton"),
};

const viewState = {
  main: makeView(),
  modal: makeView(),
};

const runtime = {
  selectedCell: null,
  selectedBasinId: null,
  rendered: null,
  loadingScripts: new Map(),
  variableCache: window.ANALYSIS_VARIABLE_DATA || {},
  diagnosticCache: new Map(),
};

window.ANALYSIS_VARIABLE_DATA = runtime.variableCache;

function makeSurface(key, canvasId, tooltipId, resetButtonId) {
  const canvas = document.getElementById(canvasId);
  return {
    key,
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

function variableLabel(code) {
  const variable = data.variables[code];
  return variable ? variable.label[currentLanguage()] || variable.label.en || code : code;
}

function availableVariables(codes) {
  return codes.filter((code) => data.variables[code]);
}

function allDiagnosticVariables() {
  return [...new Set(Object.values(DIMENSIONS).flatMap((dimension) => availableVariables(dimension.variables)))];
}

function variablesForLayer(layer) {
  if (layer === "overview") {
    return allDiagnosticVariables();
  }
  return availableVariables(DIMENSIONS[layer].variables);
}

function currentState() {
  return {
    layer: elements.layerSelect.value || "overview",
    mapUnit: elements.mapUnitSelect.value || "mesh",
    window: elements.windowSelect.value || "20",
  };
}

function scoreThreshold() {
  return SIGNIFICANT_SCORE_THRESHOLD;
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

function syncStaticText() {
  root.lang = currentLanguage() === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  elements.loadingOverlay.textContent = t("loading");
  Array.from(elements.mapUnitSelect.options).forEach((option) => {
    if (option.dataset.i18n) option.textContent = t(option.dataset.i18n);
  });
  elements.expandMapButton.setAttribute("aria-label", t("expandMap"));
  elements.closeMapModalButton.setAttribute("aria-label", t("closeMap"));
  root.classList.remove("i18n-booting");
  root.classList.add("i18n-ready");
}

function populateControls() {
  const layerValue = elements.layerSelect.value || "overview";
  elements.layerSelect.innerHTML = "";
  LAYERS.forEach((layer) => {
    const option = document.createElement("option");
    option.value = layer;
    option.textContent = t(layer);
    elements.layerSelect.appendChild(option);
  });
  elements.layerSelect.value = LAYERS.includes(layerValue) ? layerValue : "overview";

  elements.windowSelect.options[0].textContent = t("window20");
  elements.windowSelect.options[1].textContent = t("window30");

}

function renderLayerTabs() {
  elements.layerTabs.innerHTML = "";
  LAYERS.forEach((layer) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `layer-tab${layer === elements.layerSelect.value ? " active" : ""}`;
    button.textContent = t(layer);
    button.addEventListener("click", () => {
      elements.layerSelect.value = layer;
      render();
    });
    elements.layerTabs.appendChild(button);
  });
}

function setLoading(active) {
  elements.loadingOverlay.classList.toggle("hidden", !active);
}

function ensureVariableData(code) {
  if (runtime.variableCache[code]) {
    return Promise.resolve(runtime.variableCache[code]);
  }
  if (runtime.loadingScripts.has(code)) {
    return runtime.loadingScripts.get(code);
  }

  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = data.variables[code].dataScript;
    script.onload = () => {
      runtime.loadingScripts.delete(code);
      resolve(runtime.variableCache[code]);
    };
    script.onerror = () => {
      runtime.loadingScripts.delete(code);
      reject(new Error(`Failed to load ${code}`));
    };
    document.body.appendChild(script);
  });
  runtime.loadingScripts.set(code, promise);
  return promise;
}

async function loadStateData(state) {
  await Promise.all(allDiagnosticVariables().map(ensureVariableData));
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

function magnitudeValues(result) {
  const grid = result.magnitude || result.recentMean || result.baselineMean;
  const values = [];
  if (!grid) return values;
  for (const row of grid) {
    for (const value of row) {
      if (value !== null && Number.isFinite(Number(value)) && Number(value) > 0) {
        values.push(Number(value));
      }
    }
  }
  return values;
}

function supportProfile(result) {
  const grid = result.magnitude || result.recentMean || result.baselineMean;
  const values = magnitudeValues(result);
  let finite = 0;
  if (grid) {
    for (const row of grid) {
      for (const value of row) {
        if (value !== null && Number.isFinite(Number(value))) finite += 1;
      }
    }
  }
  const activeShare = finite ? values.length / finite : 0;
  const sparseSupport = activeShare < SPARSE_ACTIVE_SHARE_THRESHOLD;
  return {
    activeShare,
    sparseSupport,
    activityFloor: sparseSupport && values.length ? percentile(values, SPARSE_ACTIVITY_FLOOR_PERCENTILE) : 0,
    practicalStdFloor: sparseSupport && values.length ? percentile(values, SPARSE_STD_REFERENCE_PERCENTILE) * SPARSE_STD_REFERENCE_RATIO : 0,
  };
}

function adjustedZ(result, row, col, profile) {
  const rawZ = result.zScore[row][col];
  const diff = result.difference[row][col];
  if (rawZ === null || diff === null || !Number.isFinite(Number(rawZ)) || !Number.isFinite(Number(diff))) {
    return null;
  }
  const numericRawZ = Number(rawZ);
  const numericDiff = Number(diff);
  if (numericDiff === 0) return 0;
  const inferredStd = numericRawZ !== 0 ? Math.abs(numericDiff / numericRawZ) : Number.POSITIVE_INFINITY;
  const denominator = Math.max(inferredStd, profile.practicalStdFloor);
  return denominator > 0 && Number.isFinite(denominator) ? numericDiff / denominator : null;
}

function makeEmptyGrid() {
  return Array.from({ length: rows }, () => new Float32Array(cols).fill(Number.NaN));
}

function cachedVariableDiagnosticBase(code, state) {
  const cacheKey = `${code}|${state.window}`;
  if (runtime.diagnosticCache.has(cacheKey)) {
    return runtime.diagnosticCache.get(cacheKey);
  }

  const payload = runtime.variableCache[code];
  const result = payload && payload.windows[state.window];
  if (!result) return null;

  const profile = supportProfile(result);
  const scoreGrid = makeEmptyGrid();
  const magnitudeGrid = result.magnitude || result.recentMean || result.baselineMean;
  let valid = 0;
  let scoreSum = 0;
  let maxScore = 0;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const magnitude = magnitudeGrid ? magnitudeGrid[row][col] : null;
      if (profile.activityFloor > 0 && (!Number.isFinite(Number(magnitude)) || Number(magnitude) < profile.activityFloor)) continue;
      const z = adjustedZ(result, row, col, profile);
      if (z === null || !Number.isFinite(Number(z))) continue;
      const score = Math.min(100, (Math.abs(Number(z)) / SCORE_CAP_SIGMA) * 100);
      scoreGrid[row][col] = score;
      valid += 1;
      scoreSum += score;
      maxScore = Math.max(maxScore, score);
    }
  }

  const base = {
    code,
    result,
    scoreGrid,
    profile,
    valid,
    meanScore: valid ? scoreSum / valid : 0,
    maxScore,
  };
  runtime.diagnosticCache.set(cacheKey, base);
  return base;
}

function variableDiagnostic(code, state) {
  const base = cachedVariableDiagnosticBase(code, state);
  if (!base) return null;

  let high = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const score = base.scoreGrid[row][col];
      if (Number.isFinite(score) && score >= scoreThreshold()) {
        high += 1;
      }
    }
  }

  return {
    code,
    result: base.result,
    scoreGrid: base.scoreGrid,
    profile: base.profile,
    summary: {
      valid: base.valid,
      meanScore: base.meanScore,
      maxScore: base.maxScore,
      highShare: base.valid ? (high / base.valid) * 100 : 0,
    },
  };
}

function combineDiagnostics(diagnostics, reducer = "mean") {
  const scoreGrid = makeEmptyGrid();
  let valid = 0;
  let scoreSum = 0;
  let maxScore = 0;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      let cellSum = 0;
      let cellCount = 0;
      let cellMax = 0;
      diagnostics.forEach((diagnostic) => {
        const value = diagnostic.scoreGrid[row][col];
        if (Number.isFinite(value)) {
          cellSum += value;
          cellCount += 1;
          cellMax = Math.max(cellMax, value);
        }
      });
      if (cellCount > 0) {
        const score = reducer === "max" ? cellMax : cellSum / cellCount;
        scoreGrid[row][col] = score;
        valid += 1;
        scoreSum += score;
        maxScore = Math.max(maxScore, score);
      }
    }
  }

  return {
    scoreGrid,
    reducer,
    summary: {
      valid,
      meanScore: valid ? scoreSum / valid : 0,
      maxScore,
    },
  };
}

function summarizeGrid(scoreGrid, state) {
  let valid = 0;
  let scoreSum = 0;
  let maxScore = 0;
  let high = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const score = scoreGrid[row][col];
      if (!Number.isFinite(score)) continue;
      valid += 1;
      scoreSum += score;
      maxScore = Math.max(maxScore, score);
      if (score >= scoreThreshold()) high += 1;
    }
  }
  return {
    valid,
    meanScore: valid ? scoreSum / valid : 0,
    maxScore,
    highShare: valid ? (high / valid) * 100 : 0,
  };
}

function meanGridScoreForCells(scoreGrid, cells) {
  let valid = 0;
  let sum = 0;
  for (const index of cells) {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const score = scoreGrid[row][col];
    if (!Number.isFinite(score)) continue;
    valid += 1;
    sum += score;
  }
  return {
    valid,
    meanScore: valid ? sum / valid : Number.NaN,
  };
}

function buildBasinDiagnostics(active, state) {
  if (!basinData.basins.length) {
    return {
      basins: [],
      byId: new Map(),
      summary: { valid: 0, meanScore: 0, maxScore: 0, highShare: 0 },
    };
  }

  const byId = new Map();
  let valid = 0;
  let high = 0;
  let sum = 0;
  let maxScore = 0;
  const basins = basinData.basins.map((basin) => {
    const aggregate = meanGridScoreForCells(active.scoreGrid, basin.cells);
    const score = aggregate.meanScore;
    const item = { ...basin, score, validCells: aggregate.valid };
    byId.set(String(basin.id), item);
    if (Number.isFinite(score)) {
      valid += 1;
      sum += score;
      maxScore = Math.max(maxScore, score);
      if (score >= scoreThreshold()) high += 1;
    }
    return item;
  });

  return {
    basins,
    byId,
    summary: {
      valid,
      meanScore: valid ? sum / valid : 0,
      maxScore,
      highShare: valid ? (high / valid) * 100 : 0,
    },
  };
}

function buildDiagnosticState(state) {
  const variableDiagnostics = {};
  allDiagnosticVariables().forEach((code) => {
    if (runtime.variableCache[code]) {
      const diagnostic = variableDiagnostic(code, state);
      if (diagnostic) variableDiagnostics[code] = diagnostic;
    }
  });

  const dimensionDiagnostics = {};
  Object.entries(DIMENSIONS).forEach(([key, dimension]) => {
    const diagnostics = availableVariables(dimension.variables)
      .map((code) => variableDiagnostics[code])
      .filter(Boolean);
    dimensionDiagnostics[key] = {
      ...combineDiagnostics(diagnostics, "max"),
      diagnostics,
      support: dimension.support,
      variables: diagnostics.map((diagnostic) => diagnostic.code),
    };
    dimensionDiagnostics[key].summary = summarizeGrid(dimensionDiagnostics[key].scoreGrid, state);
  });

  let active;
  if (state.layer === "overview") {
    active = combineDiagnostics(Object.values(dimensionDiagnostics));
    active.summary = summarizeGrid(active.scoreGrid, state);
    active.variables = allDiagnosticVariables();
  } else {
    active = dimensionDiagnostics[state.layer];
  }

  const rendered = {
    state,
    active,
    variableDiagnostics,
    dimensionDiagnostics,
  };
  rendered.basinDiagnostics = buildBasinDiagnostics(active, state);
  return rendered;
}

function levelForScore(score) {
  if (!Number.isFinite(score)) return "N/A";
  if (score < 20) return t("levelStable");
  if (score < 40) return t("levelMild");
  if (score < 60) return t("levelModerate");
  if (score < 80) return t("levelSevere");
  return t("levelExtreme");
}

function formatNumber(value, digits = 1) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "N/A";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function radarLabelLines(label) {
  const text = String(label);
  const isAscii = /^[\x00-\x7F]+$/.test(text);
  if (!isAscii) {
    return text.length > 9 ? [text.slice(0, 9), text.slice(9, 18)] : [text];
  }
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= 18) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  });
  if (current) lines.push(current);
  return lines.slice(0, 2);
}

function formatCoordinate(value, positive, negative) {
  const numeric = Number(value);
  return `${Math.abs(numeric).toFixed(2)}° ${numeric >= 0 ? positive : negative}`;
}

function scoreColor(score) {
  if (!Number.isFinite(score)) return "rgba(0,0,0,0)";
  const isLight = root.getAttribute("data-theme") === "light";
  if (isLight) {
    if (score < 20) return `rgba(168, 192, 144, ${0.4 + score / 80})`;
    if (score < 40) return `rgba(208, 160, 80, ${0.5 + score / 120})`;
    if (score < 60) return `rgba(200, 100, 60, ${0.55 + score / 160})`;
    if (score < 80) return `rgba(176, 48, 48, ${0.6 + score / 200})`;
    return `rgba(96, 32, 80, ${0.72 + score / 350})`;
  }
  if (score < 20) return `rgba(224, 226, 196, ${0.35 + score / 100})`;
  if (score < 40) return `rgba(234, 184, 91, ${0.48 + score / 150})`;
  if (score < 60) return `rgba(223, 118, 72, ${0.52 + score / 180})`;
  if (score < 80) return `rgba(196, 62, 64, ${0.58 + score / 220})`;
  return `rgba(111, 44, 96, ${0.7 + score / 400})`;
}

function projectLonLat(lonValue, latValue, canvas) {
  return {
    x: ((lonValue + 180) / 360) * canvas.width,
    y: ((90 - latValue) / 180) * canvas.height,
  };
}

function drawBasinPath(ctx, canvas, basin) {
  ctx.beginPath();
  basin.rings.forEach((ring) => {
    ring.forEach(([lonValue, latValue], index) => {
      const point = projectLonLat(lonValue, latValue, canvas);
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.closePath();
  });
}

function renderBasinMapToSurface(rendered, surface) {
  const view = viewState[surface.key];
  const { canvas, ctx } = surface;
  ctx.save();
  ctx.translate(view.offsetX, view.offsetY);
  ctx.scale(view.scale, view.scale);
  if (!rendered.basinDiagnostics.basins.length) {
    ctx.fillStyle = "rgba(244, 243, 236, 0.82)";
    ctx.font = "18px Segoe UI, sans-serif";
    ctx.fillText(t("noBasinData"), 28, 42);
    ctx.fillStyle = "rgba(157, 180, 174, 0.92)";
    ctx.font = "14px Segoe UI, sans-serif";
    ctx.fillText(t("noBasinDataHint"), 28, 70);
    ctx.restore();
    return;
  }

  rendered.basinDiagnostics.basins.forEach((basin) => {
    if (!Number.isFinite(basin.score)) return;
    drawBasinPath(ctx, canvas, basin);
    ctx.fillStyle = scoreColor(basin.score);
    ctx.fill("evenodd");
  });
  ctx.strokeStyle = "rgba(244, 243, 236, 0.22)";
  ctx.lineWidth = 0.75 / view.scale;
  rendered.basinDiagnostics.basins.forEach((basin) => {
    if (!Number.isFinite(basin.score)) return;
    drawBasinPath(ctx, canvas, basin);
    ctx.stroke();
  });
  ctx.restore();
}

function drawBaseMap(surface) {
  const view = viewState[surface.key];
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

function renderMapToSurface(rendered, surface) {
  drawBaseMap(surface);
  if (!rendered || !rendered.active) return;
  if (rendered.state.mapUnit === "basin") {
    renderBasinMapToSurface(rendered, surface);
    return;
  }
  const view = viewState[surface.key];
  const { canvas, ctx } = surface;
  const cellWidth = canvas.width / cols;
  const cellHeight = canvas.height / rows;

  ctx.save();
  ctx.translate(view.offsetX, view.offsetY);
  ctx.scale(view.scale, view.scale);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const score = rendered.active.scoreGrid[row][col];
      const color = scoreColor(score);
      if (color === "rgba(0,0,0,0)") continue;
      ctx.fillStyle = color;
      ctx.fillRect(col * cellWidth, row * cellHeight, cellWidth + 0.2, cellHeight + 0.2);
    }
  }
  ctx.restore();
}

function renderMaps(rendered) {
  renderMapToSurface(rendered, surfaces.main);
  updateResetButton(surfaces.main);
  if (!elements.mapModal.classList.contains("hidden")) {
    renderMapToSurface(rendered, surfaces.modal);
    updateResetButton(surfaces.modal);
  }
}

function updateResetButton(surface) {
  const view = viewState[surface.key];
  const active = Math.abs(view.scale - 1) > 0.001 || Math.abs(view.offsetX) > 1 || Math.abs(view.offsetY) > 1;
  surface.resetButton.classList.toggle("hidden", !active);
}

function clampOffsets(surface) {
  const view = viewState[surface.key];
  const scaledWidth = surface.canvas.width * view.scale;
  const scaledHeight = surface.canvas.height * view.scale;
  const minOffsetX = Math.min(0, surface.canvas.width - scaledWidth);
  const minOffsetY = Math.min(0, surface.canvas.height - scaledHeight);
  view.offsetX = Math.max(minOffsetX, Math.min(0, view.offsetX));
  view.offsetY = Math.max(minOffsetY, Math.min(0, view.offsetY));
}

function dataPointFromEvent(surface, event) {
  const view = viewState[surface.key];
  const bounds = surface.canvas.getBoundingClientRect();
  const cssX = event.clientX - bounds.left;
  const cssY = event.clientY - bounds.top;
  const px = (cssX / bounds.width) * surface.canvas.width;
  const py = (cssY / bounds.height) * surface.canvas.height;
  const localX = (px - view.offsetX) / view.scale;
  const localY = (py - view.offsetY) / view.scale;
  const col = Math.floor((localX / surface.canvas.width) * cols);
  const row = Math.floor((localY / surface.canvas.height) * rows);
  const lonValue = (localX / surface.canvas.width) * 360 - 180;
  const latValue = 90 - (localY / surface.canvas.height) * 180;
  return { row, col, lon: lonValue, lat: latValue, cssX, cssY, bounds };
}

function cellValue(grid, cell) {
  if (!cell) return Number.NaN;
  return grid[cell.row][cell.col];
}

function dimensionCellScores(rendered, cell) {
  return Object.fromEntries(
    Object.entries(rendered.dimensionDiagnostics).map(([key, diagnostic]) => [key, cellValue(diagnostic.scoreGrid, cell)]),
  );
}

function basinAtPoint(rendered, point) {
  if (!rendered || rendered.state.mapUnit !== "basin") return null;
  return rendered.basinDiagnostics.basins.find((basin) => {
    const [minLon, minLat, maxLon, maxLat] = basin.bbox;
    if (point.lon < minLon || point.lon > maxLon || point.lat < minLat || point.lat > maxLat) return false;
    return pointInPolygon(point.lon, point.lat, basin.rings);
  }) || null;
}

function pointInRing(lonValue, latValue, ring) {
  let inside = false;
  let previous = ring[ring.length - 1];
  for (const current of ring) {
    const intersects = (current[1] > latValue) !== (previous[1] > latValue);
    if (intersects) {
      const xIntersection = ((previous[0] - current[0]) * (latValue - current[1])) / (previous[1] - current[1]) + current[0];
      if (lonValue < xIntersection) inside = !inside;
    }
    previous = current;
  }
  return inside;
}

function pointInPolygon(lonValue, latValue, rings) {
  let inside = false;
  rings.forEach((ring) => {
    if (pointInRing(lonValue, latValue, ring)) inside = !inside;
  });
  return inside;
}

function selectedBasin(rendered) {
  if (!runtime.selectedBasinId) return null;
  return rendered.basinDiagnostics.byId.get(String(runtime.selectedBasinId)) || null;
}

function topEvidence(rendered, cell = null, limit = 6) {
  const basin = selectedBasin(rendered);
  const sourceCodes = rendered.state.layer === "overview"
    ? allDiagnosticVariables()
    : variablesForLayer(rendered.state.layer);
  return sourceCodes
    .map((code) => {
      const diagnostic = rendered.variableDiagnostics[code];
      if (!diagnostic) return null;
      const score = rendered.state.mapUnit === "basin" && basin
        ? meanGridScoreForCells(diagnostic.scoreGrid, basin.cells).meanScore
        : cell ? cellValue(diagnostic.scoreGrid, cell) : diagnostic.summary.meanScore;
      const result = diagnostic.result;
      const z = rendered.state.mapUnit === "mesh" && cell ? adjustedZ(result, cell.row, cell.col, diagnostic.profile) : null;
      const diff = rendered.state.mapUnit === "mesh" && cell ? result.difference[cell.row][cell.col] : null;
      return { code, score, z, diff, unit: data.variables[code].unit };
    })
    .filter((item) => item && Number.isFinite(item.score))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function dominantDimension(rendered, cell = null) {
  const basin = selectedBasin(rendered);
  return Object.entries(rendered.dimensionDiagnostics)
    .map(([key, diagnostic]) => ({
      key,
      score: rendered.state.mapUnit === "basin" && basin
        ? meanGridScoreForCells(diagnostic.scoreGrid, basin.cells).meanScore
        : cell ? cellValue(diagnostic.scoreGrid, cell) : diagnostic.summary.meanScore,
    }))
    .filter((item) => Number.isFinite(item.score))
    .sort((a, b) => b.score - a.score)[0];
}

function renderHeader(rendered) {
  const layer = rendered.state.layer;
  elements.mapTitle.textContent = t(layer);
  elements.mapSubtitle.textContent = `${t(`window${rendered.state.window}`)} · ${t(`${layer}Desc`)}`;
}

function renderScoreCard(rendered) {
  const cell = runtime.selectedCell;
  const basin = selectedBasin(rendered);
  const isBasinMode = rendered.state.mapUnit === "basin";
  const selectedScore = isBasinMode && basin ? basin.score : cell ? cellValue(rendered.active.scoreGrid, cell) : null;
  const summary = isBasinMode ? rendered.basinDiagnostics.summary : rendered.active.summary;
  const displayScore = Number.isFinite(selectedScore) ? selectedScore : summary.meanScore;
  const dominant = dominantDimension(rendered, cell);
  const title = isBasinMode && basin ? t("selectedBasin") : cell && !isBasinMode ? t("selectedGrid") : t("globalSummary");
  const location = isBasinMode && basin
    ? `<div>${t("basinId")}: <strong>${basin.id}</strong></div><div>${t("basinCells")}: <strong>${basin.cellCount}</strong></div>`
    : cell
    ? `<div>${t("lon")}: <strong>${formatCoordinate(lon[cell.col], "E", "W")}</strong></div><div>${t("lat")}: <strong>${formatCoordinate(lat[cell.row], "N", "S")}</strong></div>`
    : `<div>${t("noCellSelected")}</div>`;
  const validLabel = isBasinMode ? t("basinCount") : t("validCells");

  elements.scoreCard.innerHTML = `
    <div class="score-card-header">
      <span>${title}</span>
      <strong>${formatNumber(displayScore, 0)}</strong>
    </div>
    <div class="score-level">${levelForScore(displayScore)}</div>
    <div class="diagnostic-meta">
      ${location}
      <div>${t("dominantDimension")}: <strong>${dominant ? t(dominant.key) : "N/A"}</strong></div>
      <div>${t("variableCount")}: <strong>${rendered.active.variables ? rendered.active.variables.length : 1}</strong></div>
    </div>
    <div class="summary-grid compact">
      <div class="summary-item"><span>${validLabel}</span><strong>${summary.valid}</strong></div>
      <div class="summary-item"><span>${t("meanScore")}</span><strong>${formatNumber(summary.meanScore, 1)}</strong></div>
      <div class="summary-item"><span>${t("maxScore")}</span><strong>${formatNumber(summary.maxScore, 1)}</strong></div>
      <div class="summary-item"><span>${t("highShare")}</span><strong>${formatNumber(summary.highShare, 1)}%</strong></div>
    </div>
  `;
}

function renderDimensionBars(rendered) {
  const cell = runtime.selectedCell;
  const basin = selectedBasin(rendered);
  const scores = rendered.state.mapUnit === "basin" && basin
    ? Object.fromEntries(Object.entries(rendered.dimensionDiagnostics).map(([key, diagnostic]) => [key, meanGridScoreForCells(diagnostic.scoreGrid, basin.cells).meanScore]))
    : dimensionCellScores(rendered, cell);
  elements.dimensionBars.innerHTML = Object.keys(DIMENSIONS).map((key) => {
    const diagnostic = rendered.dimensionDiagnostics[key];
    const score = cell ? scores[key] : diagnostic.summary.meanScore;
    const support = DIMENSIONS[key].support === "approximate" ? t("approximate") : t("full");
    const width = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
    return `
      <button class="dimension-row${rendered.state.layer === key ? " active" : ""}" type="button" data-layer="${key}">
        <span class="dimension-title">${t(key)}</span>
        <span class="dimension-value">${formatNumber(score, 0)}</span>
        <span class="dimension-track"><span style="width:${width}%"></span></span>
        <span class="dimension-support">${t("dataSupport")}: ${support}</span>
      </button>
    `;
  }).join("");
  elements.dimensionBars.querySelectorAll("[data-layer]").forEach((button) => {
    button.addEventListener("click", () => {
      elements.layerSelect.value = button.dataset.layer;
      render();
    });
  });
}

function renderEvidence(rendered) {
  const cell = runtime.selectedCell;
  const evidence = topEvidence(rendered, cell, 6);
  if (!evidence.length) {
    elements.evidenceList.innerHTML = `<div class="empty-note">N/A</div>`;
    return;
  }
  const center = 240;
  const radius = 110;
  const labelRadius = 168;
  const axisCount = evidence.length;
  const rings = [25, 50, 75, 100].map((score) => {
    const ringRadius = (score / 100) * radius;
    return `<circle cx="${center}" cy="${center}" r="${ringRadius}" class="radar-ring"></circle>`;
  }).join("");
  const axes = evidence.map((item, index) => {
    const angle = (Math.PI * 2 * index) / axisCount - Math.PI / 2;
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius;
    const labelX = center + Math.cos(angle) * labelRadius;
    const labelY = center + Math.sin(angle) * labelRadius;
    const labelLines = radarLabelLines(variableLabel(item.code));
    const score = formatNumber(item.score, 0);
    const lineOffset = labelLines.length > 1 ? -7 : 0;
    const labelTspans = labelLines.map((line, lineIndex) => {
      const dy = lineIndex === 0 ? lineOffset : 16;
      return `<tspan x="${labelX}" dy="${dy}">${escapeHtml(line)}</tspan>`;
    }).join("");
    return `
      <line x1="${center}" y1="${center}" x2="${x}" y2="${y}" class="radar-axis"></line>
      <text x="${labelX}" y="${labelY}" text-anchor="middle" class="radar-label">
        ${labelTspans}
        <tspan x="${labelX}" dy="18" class="radar-label-score">${score}</tspan>
      </text>
    `;
  }).join("");
  const points = evidence.map((item, index) => {
    const angle = (Math.PI * 2 * index) / axisCount - Math.PI / 2;
    const valueRadius = (Math.max(0, Math.min(100, item.score)) / 100) * radius;
    return `${center + Math.cos(angle) * valueRadius},${center + Math.sin(angle) * valueRadius}`;
  }).join(" ");
  const markers = evidence.map((item, index) => {
    const angle = (Math.PI * 2 * index) / axisCount - Math.PI / 2;
    const valueRadius = (Math.max(0, Math.min(100, item.score)) / 100) * radius;
    const x = center + Math.cos(angle) * valueRadius;
    const y = center + Math.sin(angle) * valueRadius;
    return `<circle cx="${x}" cy="${y}" r="4" class="radar-point"><title>${escapeHtml(variableLabel(item.code))}: ${formatNumber(item.score, 0)}</title></circle>`;
  }).join("");
  elements.evidenceList.innerHTML = `
    <div class="radar-wrap">
      <svg class="evidence-radar" viewBox="0 0 480 480" role="img" aria-label="${escapeHtml(t("mainEvidence"))}">
        <defs>
          <radialGradient id="radarGlow" cx="50%" cy="48%" r="56%">
            <stop offset="0%" stop-color="rgba(217, 242, 154, 0.13)" />
            <stop offset="42%" stop-color="rgba(92, 177, 184, 0.075)" />
            <stop offset="100%" stop-color="rgba(92, 177, 184, 0)" />
          </radialGradient>
          <linearGradient id="radarFill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="rgba(217, 242, 154, 0.34)" />
            <stop offset="100%" stop-color="rgba(92, 177, 184, 0.18)" />
          </linearGradient>
          <filter id="radarNeon" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx="${center}" cy="${center}" r="172" class="radar-halo"></circle>
        <circle cx="${center}" cy="${center}" r="124" class="radar-core"></circle>
        ${rings}
        ${axes}
        <polygon points="${points}" class="radar-area"></polygon>
        <polyline points="${points} ${points.split(" ")[0]}" class="radar-line"></polyline>
        ${markers}
      </svg>
    </div>
  `;
}

function renderMethod() {
  elements.methodBox.innerHTML = `<h3>${t("methodTitle")}</h3><p>${t("methodText")}</p>`;
}

function renderPanels(rendered) {
  renderHeader(rendered);
  renderScoreCard(rendered);
  renderDimensionBars(rendered);
  renderEvidence(rendered);
  renderMethod();
}

function renderTooltip(surface, event) {
  const rendered = runtime.rendered;
  if (!rendered) return;
  const point = dataPointFromEvent(surface, event);
  if (rendered.state.mapUnit === "basin") {
    const basin = basinAtPoint(rendered, point);
    if (!basin || !Number.isFinite(basin.score)) {
      surface.tooltip.classList.add("hidden");
      return;
    }
    const preferLeft = point.cssX > point.bounds.width * 0.5;
    const tooltipWidth = 236;
    let left = preferLeft ? point.cssX - tooltipWidth - 10 : point.cssX + 10;
    let top = point.cssY + 10;
    left = Math.max(12, Math.min(point.bounds.width - tooltipWidth - 12, left));
    top = Math.max(12, Math.min(point.bounds.height - 132, top));
    surface.tooltip.classList.remove("hidden");
    surface.tooltip.style.left = `${left}px`;
    surface.tooltip.style.top = `${top}px`;
    surface.tooltip.innerHTML = `
      <div><strong>${t("selectedBasin")}</strong></div>
      <div>${t("score")}: ${formatNumber(basin.score, 1)}</div>
      <div>${t("basinId")}: ${basin.id}</div>
      <div>${t("basinCells")}: ${basin.cellCount}</div>
    `;
    return;
  }
  if (point.row < 0 || point.row >= rows || point.col < 0 || point.col >= cols) {
    surface.tooltip.classList.add("hidden");
    return;
  }
  const score = rendered.active.scoreGrid[point.row][point.col];
  if (!Number.isFinite(score)) {
    surface.tooltip.classList.add("hidden");
    return;
  }
  const dominant = dominantDimension(rendered, { row: point.row, col: point.col });
  const preferLeft = point.cssX > point.bounds.width * 0.5;
  const tooltipWidth = 236;
  let left = preferLeft ? point.cssX - tooltipWidth - 10 : point.cssX + 10;
  let top = point.cssY + 10;
  left = Math.max(12, Math.min(point.bounds.width - tooltipWidth - 12, left));
  top = Math.max(12, Math.min(point.bounds.height - 132, top));
  surface.tooltip.classList.remove("hidden");
  surface.tooltip.style.left = `${left}px`;
  surface.tooltip.style.top = `${top}px`;
  surface.tooltip.innerHTML = `
    <div><strong>${t(rendered.state.layer)}</strong></div>
    <div>${t("score")}: ${formatNumber(score, 1)}</div>
    <div>${t("dominantDimension")}: ${dominant ? t(dominant.key) : "N/A"}</div>
    <div>${t("lon")}: ${formatCoordinate(lon[point.col], "E", "W")}</div>
    <div>${t("lat")}: ${formatCoordinate(lat[point.row], "N", "S")}</div>
  `;
}

function onCanvasClick(surface, event) {
  const point = dataPointFromEvent(surface, event);
  if (runtime.rendered && runtime.rendered.state.mapUnit === "basin") {
    const basin = basinAtPoint(runtime.rendered, point);
    runtime.selectedBasinId = basin ? basin.id : null;
    runtime.selectedCell = null;
    renderPanels(runtime.rendered);
    return;
  }
  if (point.row < 0 || point.row >= rows || point.col < 0 || point.col >= cols) return;
  runtime.selectedCell = { row: point.row, col: point.col };
  runtime.selectedBasinId = null;
  if (runtime.rendered) {
    renderPanels(runtime.rendered);
  }
}

function onWheel(surface, event) {
  event.preventDefault();
  const view = viewState[surface.key];
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
  renderMaps(runtime.rendered);
}

function onMouseDown(surface, event) {
  if (event.button !== 0 && event.button !== 1) return;
  const view = viewState[surface.key];
  event.preventDefault();
  view.dragging = true;
  view.startX = event.clientX;
  view.startY = event.clientY;
  view.startOffsetX = view.offsetX;
  view.startOffsetY = view.offsetY;
  surface.canvas.classList.add("dragging");
}

function onMouseMove(surface, event) {
  const view = viewState[surface.key];
  if (view.dragging) {
    event.preventDefault();
    view.offsetX = view.startOffsetX + (event.clientX - view.startX);
    view.offsetY = view.startOffsetY + (event.clientY - view.startY);
    clampOffsets(surface);
    renderMaps(runtime.rendered);
    return;
  }
  renderTooltip(surface, event);
}

function endDrag(surface) {
  viewState[surface.key].dragging = false;
  surface.canvas.classList.remove("dragging");
}

function resetView(surface) {
  viewState[surface.key] = makeView();
  surface.tooltip.classList.add("hidden");
  renderMaps(runtime.rendered);
}

function openMapModal() {
  elements.mapModal.classList.remove("hidden");
  elements.mapModal.setAttribute("aria-hidden", "false");
  renderMaps(runtime.rendered);
}

function closeMapModal() {
  surfaces.modal.tooltip.classList.add("hidden");
  elements.mapModal.classList.add("hidden");
  elements.mapModal.setAttribute("aria-hidden", "true");
}

async function render() {
  persistLanguagePreference();
  syncStaticText();
  populateControls();
  renderLayerTabs();
  const state = currentState();
  setLoading(true);
  await loadStateData(state);
  const rendered = buildDiagnosticState(state);
  runtime.rendered = rendered;
  setLoading(false);
  renderPanels(rendered);
  renderMaps(rendered);
}

function registerSurfaceEvents(surface) {
  surface.canvas.addEventListener("mousemove", (event) => onMouseMove(surface, event));
  surface.canvas.addEventListener("mousedown", (event) => onMouseDown(surface, event));
  surface.canvas.addEventListener("click", (event) => onCanvasClick(surface, event));
  surface.canvas.addEventListener("wheel", (event) => onWheel(surface, event), { passive: false });
  surface.canvas.addEventListener("mouseleave", () => surface.tooltip.classList.add("hidden"));
  surface.resetButton.addEventListener("click", () => resetView(surface));
}

function registerEvents() {
  elements.languageSelect.addEventListener("change", render);
  elements.layerSelect.addEventListener("change", render);
  elements.mapUnitSelect.addEventListener("change", () => {
    runtime.selectedCell = null;
    runtime.selectedBasinId = null;
    render();
  });
  elements.windowSelect.addEventListener("change", render);
  registerSurfaceEvents(surfaces.main);
  registerSurfaceEvents(surfaces.modal);
  window.addEventListener("mouseup", () => {
    endDrag(surfaces.main);
    endDrag(surfaces.modal);
  });
  elements.expandMapButton.addEventListener("click", openMapModal);
  elements.closeMapModalButton.addEventListener("click", closeMapModal);
  elements.mapModal.addEventListener("click", (event) => {
    if (event.target === elements.mapModal || event.target.classList.contains("map-modal-backdrop")) {
      closeMapModal();
    }
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.mapModal.classList.contains("hidden")) {
      closeMapModal();
    }
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
