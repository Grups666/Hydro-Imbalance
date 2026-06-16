/**
 * Water Imbalance Module
 *
 * This module is intentionally isolated from Foundation domain logic. Foundation
 * supplies map rendering, basin geometry, module loading, and panel APIs. The
 * module supplies its own time series, imbalance classification, literature, and UI.
 */
window.WaterImbalanceModule = class WaterImbalanceModule {
  constructor(app, manifest = {}) {
    this.app = app;
    this.manifest = manifest;
    this.basePath = manifest.basePath || `/modules/${manifest.id || "water-imbalance"}/`;
    this.graph = null;
    this.timeSeriesMetadata = null;
    this.timeSeriesByBasin = new Map();
    this.timeSeriesLoadPromise = null;
    this.timeSeriesLoaded = false;
    this.classificationByBasin = new Map();
    this.regions = [];
    this.literature = new Map();
    this.authors = new Map();
    this.relationsByTarget = new Map();
    this.preparedBasins = [];
    this.preparedByBasinId = new Map();
    this.basinSpatialIndex = null;
    this.selectedBasin = null;
    this.chartModal = null;
    this.literatureModal = null;
    this.activeChartSeries = null;
    this.themeObserver = null;
    this.themeMode = null;
    this.themePoll = null;
    this.handleThemeChange = () => this.syncThemeMode(true);
    this.enhancedLayer = null;
    this.originalLayerState = null;
    this.staticLayerCache = { key: null, canvas: null, ctx: null };
    this.legendId = `${this.manifest.id || "water-imbalance"}-legend`;
    this.handleFeatureClick = (payload) => {
      if (payload.layer?.moduleId === this.manifest.id) this.onFeatureClick(payload);
    };

    Foundation.eventBus.on(Foundation.Events.FEATURE_CLICK, this.handleFeatureClick);
  }

  async onLoad() {
    this.graph = await this.fetchJson(this.resolveModulePath(this.manifest.knowledgeGraph || "./data/knowledge-graph.json"));
    await this.loadDatasetMetadata();
    this.indexGraph();
    const basinData = await this.loadBasinData();
    this.prepareBasins(basinData.basins || []);
    this.ensureThemeStyles();
    this.watchThemeChanges();
    this.enhanceFoundationBasinLayer();
    this.ensureLegend();
    this.ensureChartUI();
    this.ensureLiteratureUI();
  }

  onUnload() {
    if (this.enhancedLayer && this.originalLayerState) {
      Object.assign(this.enhancedLayer, this.originalLayerState);
      this.app.updateLayerList?.();
    }
    this.enhancedLayer = null;
    this.originalLayerState = null;
    this.selectedBasin = null;
    this.staticLayerCache = { key: null, canvas: null, ctx: null };
    Foundation.eventBus.off(Foundation.Events.FEATURE_CLICK, this.handleFeatureClick);
    this.closeTimeSeriesModal();
    this.closeLiteratureModal();
    this.themeObserver?.disconnect();
    this.themeObserver = null;
    document.removeEventListener("change", this.handleThemeChange, true);
    if (this.themePoll) window.clearInterval(this.themePoll);
    this.themePoll = null;
    this.app.unregisterLegend?.(this.legendId);
  }

  resolveModulePath(relativePath) {
    if (/^https?:\/\//i.test(relativePath) || relativePath.startsWith("/")) return relativePath;
    return this.basePath + relativePath.replace(/^\.\//, "");
  }

  async fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
    return response.json();
  }

  async loadDatasetMetadata() {
    const dataset = this.manifest.datasets?.find((item) => item.id === "basin-three-variable-timeseries-1962-2016");
    if (!dataset?.metadata) return;

    this.timeSeriesMetadata = await this.fetchJson(this.resolveModulePath(dataset.metadata));
    const classification = await this.fetchJson(this.resolveModulePath(
      dataset.metadata.replace(/[^/]+$/, "") + this.timeSeriesMetadata.classification.replace(/^\.\//, "")
    ));
    for (const [basinId, result] of Object.entries(classification.basins || {})) {
      this.classificationByBasin.set(String(basinId), result);
    }
  }

  async loadBasinData() {
    const basinDataPath = this.timeSeriesMetadata?.basinData;
    if (!basinDataPath) return { meta: {}, basins: window.BASIN_DATA?.basins || [] };
    const dataset = this.manifest.datasets?.find((item) => item.id === "basin-three-variable-timeseries-1962-2016");
    const url = this.resolveModulePath(dataset.metadata.replace(/[^/]+$/, "") + basinDataPath.replace(/^\.\//, ""));
    return this.fetchJson(url);
  }

  ensureTimeSeriesLoaded() {
    if (this.timeSeriesLoaded) return Promise.resolve();
    if (this.timeSeriesLoadPromise) return this.timeSeriesLoadPromise;

    const dataset = this.manifest.datasets?.find((item) => item.id === "basin-three-variable-timeseries-1962-2016");
    const csvUrl = this.resolveModulePath(
      dataset.metadata.replace(/[^/]+$/, "") + this.timeSeriesMetadata.file.replace(/^\.\//, "")
    );
    this.timeSeriesLoadPromise = fetch(csvUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load ${csvUrl}: ${response.status}`);
        return response.text();
      })
      .then((csvText) => {
        this.indexTimeSeries(csvText);
        this.timeSeriesLoaded = true;
      })
      .finally(() => {
        this.timeSeriesLoadPromise = null;
      });
    return this.timeSeriesLoadPromise;
  }

  indexTimeSeries(csvText) {
    const lines = csvText.trim().split(/\r?\n/);
    const headers = this.parseCsvLine(lines[0]);
    const indexes = Object.fromEntries(headers.map((header, index) => [header, index]));
    const variables = this.timeSeriesMetadata?.variables || [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i]);
      const basinId = String(values[indexes.basin_id]);
      if (!this.timeSeriesByBasin.has(basinId)) this.timeSeriesByBasin.set(basinId, []);

      const record = { year: Number(values[indexes.year]) };
      for (const variable of variables) {
        const raw = values[indexes[variable.id]];
        record[variable.id] = raw === "" || raw === "NaN" || raw === "nan" ? null : Number(raw);
      }
      this.timeSeriesByBasin.get(basinId).push(record);
    }
  }

  parseCsvLine(line) {
    const values = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < line.length; index++) {
      const char = line[index];
      if (char === "\"") {
        if (quoted && line[index + 1] === "\"") {
          value += "\"";
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (char === "," && !quoted) {
        values.push(value);
        value = "";
      } else {
        value += char;
      }
    }
    values.push(value);
    return values;
  }

  indexGraph() {
    this.regions = this.graph?.spatialContexts?.regions || [];

    for (const [id, record] of Object.entries(this.graph?.literature?.records || {})) {
      this.literature.set(id, record);
    }
    for (const [id, author] of Object.entries(this.graph?.authors?.records || {})) {
      this.authors.set(id, author);
    }

    for (const relation of this.graph?.relations || []) {
      if (!relation.type.includes("literature") && !relation.type.startsWith("paper_studies_")) continue;
      this.addRelationIndex(this.relationsByTarget, relation.target, relation);
    }
  }

  addRelationIndex(index, key, relation) {
    if (!key) return;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(relation);
  }

  prepareBasins(basins) {
    this.preparedBasins = basins.map((basin) => {
      const region = this.findRegion(basin);
      const classification = this.classificationByBasin.get(String(basin.id)) || null;
      return {
        basin,
        region,
        classification,
        rings: (basin.rings || []).filter((ring) => ring.length >= 3)
      };
    });
    this.preparedByBasinId = new Map(this.preparedBasins.map((prep) => [prep.basin.id, prep]));
    this.basinSpatialIndex = new Foundation.SpatialGridIndex(
      this.preparedBasins,
      (prep) => prep.basin.bbox,
      4
    );
    this.staticLayerCache = { key: null, canvas: null, ctx: null };
  }

  enhanceFoundationBasinLayer() {
    const layerId = "outlines-basins";
    const layer = this.app.layerManager.getLayer(layerId);
    if (!layer) return;

    this.enhancedLayer = layer;
    this.originalLayerState = {
      name: layer.name,
      visible: layer.visible,
      interactive: layer.interactive,
      moduleId: layer.moduleId,
      renderer: layer.renderer,
      hitTest: layer.hitTest,
      metadata: layer.metadata
    };

    layer.name = "Basins";
    layer.visible = true;
    layer.interactive = true;
    layer.moduleId = this.manifest.id;
    layer.renderer = (ctx, _layer, viewport) => this.render(ctx, viewport);
    layer.hitTest = (lon, lat) => this.hitTest(lon, lat);
    layer.metadata = {
      ...layer.metadata,
      classification: this.timeSeriesMetadata?.imbalanceMethod,
      graph: this.graph?.schema
    };
    this.app.updateLayerList?.();
  }

  render(ctx, viewport) {
    if (!viewport.interacting) {
      this.renderCachedStaticLayer(ctx, viewport);
      this.renderHighlightLayer(ctx, viewport);
      return;
    }

    this.renderDynamicLayer(ctx, viewport, { includeHighlights: true });
  }

  renderCachedStaticLayer(ctx, viewport) {
    const key = this.getStaticLayerCacheKey(viewport);
    if (this.staticLayerCache.key !== key) {
      this.buildStaticLayerCache(viewport, key);
    }
    if (this.staticLayerCache.canvas) {
      ctx.drawImage(this.staticLayerCache.canvas, 0, 0, viewport.width, viewport.height);
    }
  }

  getStaticLayerCacheKey(viewport) {
    const dpr = window.devicePixelRatio || 1;
    return [
      Math.round(viewport.width),
      Math.round(viewport.height),
      viewport.scale.toFixed(4),
      Math.round(viewport.offsetX),
      Math.round(viewport.offsetY),
      dpr.toFixed(2)
    ].join(":");
  }

  buildStaticLayerCache(viewport, key) {
    const dpr = window.devicePixelRatio || 1;
    const canvas = this.staticLayerCache.canvas || document.createElement("canvas");
    const width = Math.max(1, Math.round(viewport.width * dpr));
    const height = Math.max(1, Math.round(viewport.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const cacheCtx = canvas.getContext("2d");
    cacheCtx.setTransform(1, 0, 0, 1, 0, 0);
    cacheCtx.clearRect(0, 0, canvas.width, canvas.height);
    cacheCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.renderDynamicLayer(cacheCtx, viewport, { includeHighlights: false });
    this.staticLayerCache = { key, canvas, ctx: cacheCtx };
  }

  renderHighlightLayer(ctx, viewport) {
    const highlighted = new Set();
    const hovered = this.app.hoveredFeatureId ? this.preparedByBasinId.get(this.app.hoveredFeatureId) : null;
    const selected = this.selectedBasin || null;
    if (hovered) highlighted.add(hovered);
    if (selected) highlighted.add(selected);
    for (const prep of highlighted) this.renderPreparedBasin(ctx, viewport, prep, { highlight: true });
  }

  renderDynamicLayer(ctx, viewport, options = {}) {
    const includeHighlights = options.includeHighlights !== false;
    const base = (viewport.height / 180) * viewport.scale;
    const { width, height, offsetX, offsetY } = viewport;
    const leftLon = (-width / 2 - offsetX) / base;
    const rightLon = (width / 2 - offsetX) / base;
    const firstSeg = Math.floor(leftLon / 360);
    const lastSeg = Math.ceil(rightLon / 360);

    for (let seg = firstSeg; seg <= lastSeg; seg++) {
      const candidates = this.basinSpatialIndex.queryBounds(
        Math.max(-180, leftLon - seg * 360),
        -90,
        Math.min(180, rightLon - seg * 360),
        90
      );
      const lonOffset = seg * 360;

      for (const prep of candidates) {
        const isSelected = includeHighlights && this.selectedBasin?.basin.id === prep.basin.id;
        const isHovered = includeHighlights && this.app.hoveredFeatureId === prep.basin.id;
        const color = prep.classification?.color || "#e3e6e9";

        let fillAlpha = prep.classification ? 0.68 : 0.32;
        let strokeColor = "rgba(71,85,105,0.16)";
        let lineWidth = 0.28;

        if (isSelected) {
          fillAlpha = 0.9;
          strokeColor = "#111827";
          lineWidth = 1.8;
        } else if (isHovered) {
          fillAlpha = 0.82;
          strokeColor = "rgba(51,65,85,0.48)";
          lineWidth = 1;
        }

        ctx.fillStyle = Foundation.UI.hexToRgba(color, fillAlpha);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;

        for (const path of this.buildScreenPaths(prep, lonOffset, base, width, height, offsetX, offsetY)) {
          ctx.fill(path);
          ctx.stroke(path);
        }
      }
    }
  }

  renderPreparedBasin(ctx, viewport, prep, options = {}) {
    const base = (viewport.height / 180) * viewport.scale;
    const { width, height, offsetX, offsetY } = viewport;
    const leftLon = (-width / 2 - offsetX) / base;
    const rightLon = (width / 2 - offsetX) / base;
    const firstSeg = Math.floor(leftLon / 360);
    const lastSeg = Math.ceil(rightLon / 360);
    const isSelected = this.selectedBasin?.basin.id === prep.basin.id;

    ctx.fillStyle = Foundation.UI.hexToRgba(prep.classification?.color || "#e3e6e9", isSelected ? 0.9 : 0.82);
    ctx.strokeStyle = isSelected ? "#111827" : "rgba(51,65,85,0.48)";
    ctx.lineWidth = isSelected ? 1.8 : 1;

    for (let seg = firstSeg; seg <= lastSeg; seg++) {
      const lonOffset = seg * 360;
      for (const path of this.buildScreenPaths(prep, lonOffset, base, width, height, offsetX, offsetY)) {
        ctx.fill(path);
        ctx.stroke(path);
      }
    }
  }

  buildScreenPaths(prep, lonOffset, base, width, height, offsetX, offsetY) {
    return prep.rings.map((ring) => {
      const path = new Path2D();
      for (let i = 0; i < ring.length; i++) {
        const [lon, lat] = ring[i];
        const x = width / 2 + (lon + lonOffset) * base + offsetX;
        const y = height / 2 - lat * base + offsetY;
        if (i === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      }
      return path;
    });
  }

  hitTest(lon, lat) {
    const seg = Math.round(lon / 360);
    let best = null;
    let bestArea = Infinity;

    for (const prep of this.basinSpatialIndex.queryPoint(lon - seg * 360, lat)) {
      const minLon = prep.basin.bbox[0] + seg * 360;
      const maxLon = prep.basin.bbox[2] + seg * 360;

      if (lon >= minLon && lon <= maxLon &&
          lat >= prep.basin.bbox[1] && lat <= prep.basin.bbox[3]) {
        const testLon = lon - seg * 360;
        if (this.pointInPolygon(testLon, lat, prep.rings) && prep.basin.areaKm2 < bestArea) {
          best = prep.basin;
          bestArea = prep.basin.areaKm2;
        }
      }
    }
    return best;
  }

  pointInPolygon(lon, lat, rings) {
    let inside = false;
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (((yi > lat) !== (yj > lat)) && lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-10) + xi) {
          inside = !inside;
        }
      }
    }
    return inside;
  }

  onFeatureClick(payload) {
    const prep = this.preparedByBasinId.get(payload.feature.id);
    if (!prep) return;

    this.selectedBasin = prep;
    this.app.draw();
    this.showInspector(prep);
    this.ensureTimeSeriesLoaded()
      .then(() => {
        if (this.selectedBasin === prep) this.showInspector(prep);
      })
      .catch((error) => console.error("Failed to load basin time series:", error));
  }

  ensureThemeStyles() {
    if (document.getElementById("wi-theme-styles")) return;
    const style = document.createElement("style");
    style.id = "wi-theme-styles";
    style.textContent = `
      :root{
        --wi-surface:var(--modal-panel,rgba(255,255,255,.95));
        --wi-surface-soft:var(--panel-raised,rgba(255,255,255,.95));
        --wi-border:var(--panel-border,rgba(100,130,140,.14));
        --wi-border-strong:var(--panel-border-strong,rgba(80,120,130,.25));
        --wi-text:var(--text,#1a2a2e);
        --wi-muted:var(--muted,#5a7078);
        --wi-subtle:#94a3b8;
        --wi-button-bg:var(--panel-raised,rgba(255,255,255,.95));
        --wi-button-hover:var(--card-bg,rgba(0,0,0,.03));
        --wi-overlay:var(--modal-backdrop,rgba(200,210,220,.75));
        --wi-shadow:var(--shadow,0 22px 46px rgba(0,0,0,.1));
        --wi-danger:#b91c1c;
        --wi-link:#3b82f6;
        --wi-focus:var(--accent,#3a9a8a);
        --wi-focus-soft:rgba(58,154,138,.16);
        --wi-canvas-bg:#ffffff;
        --wi-grid:#e2e8f0;
        --wi-grid-soft:#edf2f7;
        --wi-hover-line:#64748b;
      }
      :root.wi-theme-dark,:root[data-theme="dark"],[data-theme="dark"],body.dark,body.theme-dark,body.dark-mode{
        --wi-surface:var(--modal-panel,rgba(7,16,18,.94));
        --wi-surface-soft:var(--panel-raised,rgba(18,32,36,.9));
        --wi-border:var(--panel-border,rgba(172,205,196,.16));
        --wi-border-strong:var(--panel-border-strong,rgba(132,190,185,.28));
        --wi-text:var(--text,#f4f3ec);
        --wi-muted:var(--muted,#9db4ae);
        --wi-subtle:#94a3b8;
        --wi-button-bg:var(--panel-raised,rgba(18,32,36,.9));
        --wi-button-hover:var(--card-bg,rgba(255,255,255,.07));
        --wi-overlay:var(--modal-backdrop,rgba(3,8,10,.72));
        --wi-shadow:var(--shadow,0 22px 46px rgba(0,0,0,.26));
        --wi-danger:#fca5a5;
        --wi-link:#93c5fd;
        --wi-focus:var(--accent,#9fd3c1);
        --wi-focus-soft:rgba(159,211,193,.18);
        --wi-canvas-bg:var(--bg,#071012);
        --wi-grid:rgba(172,205,196,.18);
        --wi-grid-soft:rgba(172,205,196,.09);
        --wi-hover-line:#cbd5e1;
      }
      :root.wi-theme-light,:root[data-theme="light"],[data-theme="light"],body.light,body.theme-light,body.light-mode{
        --wi-surface:var(--modal-panel,rgba(255,255,255,.95));
        --wi-surface-soft:var(--panel-raised,rgba(255,255,255,.95));
        --wi-border:var(--panel-border,rgba(100,130,140,.14));
        --wi-border-strong:var(--panel-border-strong,rgba(80,120,130,.25));
        --wi-text:var(--text,#1a2a2e);
        --wi-muted:var(--muted,#5a7078);
        --wi-subtle:#94a3b8;
        --wi-button-bg:var(--panel-raised,rgba(255,255,255,.95));
        --wi-button-hover:var(--card-bg,rgba(0,0,0,.03));
        --wi-overlay:var(--modal-backdrop,rgba(200,210,220,.75));
        --wi-shadow:var(--shadow,0 22px 46px rgba(0,0,0,.1));
        --wi-danger:#b91c1c;
        --wi-link:#3b82f6;
        --wi-focus:var(--accent,#3a9a8a);
        --wi-focus-soft:rgba(58,154,138,.16);
        --wi-canvas-bg:#ffffff;
        --wi-grid:#e2e8f0;
        --wi-grid-soft:#edf2f7;
        --wi-hover-line:#64748b;
      }
      .wi-inspector{color:var(--wi-text)}
      .wi-muted{color:var(--wi-muted)}
      .wi-section-title{font-size:12px;font-weight:600;margin:0 0 8px;color:var(--wi-muted);text-transform:uppercase}
      .wi-stat-card{background:var(--wi-surface-soft);border:1px solid var(--wi-border);padding:12px;border-radius:6px}
      .wi-stat-value{font-size:18px;font-weight:600;color:var(--wi-text)}
      .wi-stat-label{font-size:11px;color:var(--wi-muted)}
      .wi-button{border:1px solid var(--wi-border-strong);background:var(--wi-button-bg);border-radius:4px;padding:4px 8px;font-size:11px;cursor:pointer;color:var(--wi-text);transition:background .16s ease,border-color .16s ease,box-shadow .16s ease,transform .16s ease}
      .wi-button:hover{background:var(--wi-button-hover);border-color:var(--wi-focus);box-shadow:0 0 0 2px var(--wi-focus-soft);transform:translateY(-1px)}
      .wi-button:focus-visible{outline:0;border-color:var(--wi-focus);box-shadow:0 0 0 3px var(--wi-focus-soft)}
      .wi-preview{display:block;width:100%;height:132px;background:var(--wi-surface-soft);border:1px solid var(--wi-border);border-radius:4px;cursor:pointer;transition:border-color .16s ease,box-shadow .16s ease,filter .16s ease,transform .16s ease}
      .wi-preview:hover{border-color:var(--wi-focus);box-shadow:0 0 0 3px var(--wi-focus-soft),0 10px 24px rgba(0,0,0,.18);filter:brightness(1.08);transform:translateY(-1px)}
      .wi-preview:focus-visible{outline:0;border-color:var(--wi-focus);box-shadow:0 0 0 3px var(--wi-focus-soft)}
      .wi-metric-card{background:var(--wi-surface-soft);border:1px solid var(--wi-border);border-radius:4px;padding:8px 10px;color:var(--wi-text)}
      .wi-literature-card{background:var(--wi-surface-soft);border:1px solid var(--wi-border);border-radius:4px;padding:8px 12px;font-size:12px;cursor:pointer;color:var(--wi-text)}
      .wi-literature-card-title{font-weight:500;margin-bottom:3px;color:var(--wi-text)}
    `;
    document.head.appendChild(style);
  }

  watchThemeChanges() {
    if (this.themeObserver || typeof MutationObserver === "undefined") return;
    const repaintCharts = () => {
      if (this.selectedBasin) {
        const preview = document.querySelector(".wi-preview");
        const series = this.timeSeriesByBasin.get(String(this.selectedBasin.basin.id)) || [];
        if (preview && series.length) this.drawMiniPreview(preview, series);
      }
      if (this.activeChartSeries) this.drawExpandedCharts();
    };
    const syncAndRepaint = () => {
      const changed = this.syncThemeMode();
      if (changed) repaintCharts();
    };
    this.syncThemeMode();
    document.addEventListener("change", this.handleThemeChange, true);
    this.themeObserver = new MutationObserver(syncAndRepaint);
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"]
    });
    if (document.body) {
      this.themeObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ["data-theme", "class"]
      });
    }
    this.themePoll = window.setInterval(syncAndRepaint, 750);
  }

  syncThemeMode(forceRepaint = false) {
    const mode = this.detectThemeMode();
    const root = document.documentElement;
    const changed = this.themeMode !== mode;
    this.themeMode = mode;
    root.classList.toggle("wi-theme-dark", mode === "dark");
    root.classList.toggle("wi-theme-light", mode === "light");
    if ((changed || forceRepaint) && this.selectedBasin) {
      const preview = document.querySelector(".wi-preview");
      const series = this.timeSeriesByBasin.get(String(this.selectedBasin.basin.id)) || [];
      if (preview && series.length) this.drawMiniPreview(preview, series);
      if (this.activeChartSeries) this.drawExpandedCharts();
    }
    return changed;
  }

  detectThemeMode() {
    const explicit = this.explicitThemeMode();
    if (explicit) return explicit;
    const radioTheme = this.checkedThemeControlMode();
    if (radioTheme) return radioTheme;
    const computedTheme = this.computedThemeMode();
    return computedTheme || "light";
  }

  explicitThemeMode() {
    const root = document.documentElement;
    const body = document.body;
    const value = [
      root.getAttribute("data-theme"),
      body?.getAttribute("data-theme"),
      root.dataset?.theme,
      body?.dataset?.theme
    ].find(Boolean);
    if (/dark/i.test(value || "")) return "dark";
    if (/light/i.test(value || "")) return "light";
    const classText = `${root.className || ""} ${body?.className || ""}`.replace(/\bwi-theme-(dark|light)\b/g, "");
    if (/\b(dark|theme-dark|dark-mode)\b/i.test(classText)) return "dark";
    if (/\b(light|theme-light|light-mode)\b/i.test(classText)) return "light";
    return null;
  }

  checkedThemeControlMode() {
    const checkedControls = Array.from(document.querySelectorAll("input[type='radio']:checked,input[type='checkbox']:checked"));
    for (const control of checkedControls) {
      const text = [
        control.value,
        control.getAttribute("aria-label"),
        this.controlLabelText(control),
        control.closest("label")?.textContent,
        control.parentElement?.textContent
      ].filter(Boolean).join(" ").toLowerCase();
      if (/\bdark\b|深色|暗色/.test(text)) return "dark";
      if (/\blight\b|浅色|亮色/.test(text)) return "light";
    }
    return null;
  }

  controlLabelText(control) {
    if (!control.id || typeof CSS === "undefined" || typeof CSS.escape !== "function") return "";
    return document.querySelector(`label[for="${CSS.escape(control.id)}"]`)?.textContent || "";
  }

  computedThemeMode() {
    const styles = getComputedStyle(document.documentElement);
    const candidates = [
      styles.getPropertyValue("--bg"),
      styles.getPropertyValue("--modal-panel"),
      getComputedStyle(document.body).backgroundColor,
      styles.backgroundColor
    ];
    for (const color of candidates) {
      const luminance = this.colorLuminance(color);
      if (Number.isFinite(luminance)) return luminance < 0.5 ? "dark" : "light";
    }
    return null;
  }

  colorLuminance(color) {
    const text = String(color || "").trim();
    const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hex) {
      const value = hex[1].length === 3
        ? hex[1].split("").map((char) => char + char).join("")
        : hex[1];
      const r = Number.parseInt(value.slice(0, 2), 16) / 255;
      const g = Number.parseInt(value.slice(2, 4), 16) / 255;
      const b = Number.parseInt(value.slice(4, 6), 16) / 255;
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    const match = text.match(/rgba?\(([^)]+)\)/i);
    if (!match) return NaN;
    const parts = match[1].split(",").map((value) => Number.parseFloat(value));
    if (Number.isFinite(parts[3]) && parts[3] === 0) return NaN;
    const [r, g, b] = parts.slice(0, 3).map((value) => value / 255);
    if (![r, g, b].every(Number.isFinite)) return NaN;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  showInspector(prep) {
    const { basin, region, classification } = prep;
    const references = this.getLiteratureFor(prep);
    const title = region?.name || basin.name;
    const series = this.timeSeriesByBasin.get(String(basin.id)) || [];
    const previewId = `wi-preview-${basin.id}`;
    const expandId = `wi-expand-${basin.id}`;
    const classLabel = this.getClassLabel(classification);
    const metrics = classification?.metrics || {};

    const content = `
      <div class="wi-inspector">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="display:inline-block;width:12px;height:12px;border:1px solid #94a3b8;border-radius:3px;background:${this.escape(classification?.color || "#e3e6e9")}"></span>
        <span class="wi-muted" style="font-size:11px;text-transform:uppercase">${this.escape(classLabel)}</span>
      </div>
      <h2 style="margin:0 0 6px;font-size:18px;font-weight:600">${this.escape(title)}</h2>
      <p class="wi-muted" style="margin:0 0 14px;font-size:12px;line-height:1.5">
        Recent period 1997-2016 compared with historical period 1962-1996. A variable is imbalanced when its mean shift exceeds two historical standard deviations and 1 mm.
      </p>

      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:16px">
        <div class="wi-stat-card">
          <div class="wi-stat-value">${Math.round(basin.areaKm2).toLocaleString()}</div>
          <div class="wi-stat-label">Area km2</div>
        </div>
        <div class="wi-stat-card">
          <div class="wi-stat-value">${this.escape(this.getRegionName(basin.region))}</div>
          <div class="wi-stat-label">MRB region</div>
        </div>
      </div>

      <section style="margin-bottom:16px">
        <h3 class="wi-section-title">Imbalance Assessment</h3>
        ${this.renderMetricCards(metrics)}
      </section>

      <section style="margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <h3 class="wi-section-title" style="margin:0">1962-2016 Time Series</h3>
          ${series.length ? `<button id="${expandId}" class="wi-button" type="button">Expand</button>` : ""}
        </div>
        ${series.length
          ? `<canvas id="${previewId}" class="wi-preview" width="300" height="132" tabindex="0" role="button" aria-label="Open basin time series"></canvas>`
          : `<p class="wi-muted" style="font-size:12px;margin:0">${this.timeSeriesLoaded ? "No basin_id match in the module time-series dataset." : "Loading time series on demand..."}</p>`}
      </section>

      <section>
        <h3 class="wi-section-title">Literature Evidence</h3>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${references.slice(0, 10).map((item, index) => this.renderLiteratureCard(item, index)).join("") || "<p class=\"wi-muted\" style=\"font-size:12px\">No evidence linked by this module.</p>"}
        </div>
      </section>
      </div>
    `;

    this.app.showInspector(title, content);

    if (series.length) {
      setTimeout(() => {
        const preview = document.getElementById(previewId);
        const expand = document.getElementById(expandId);
        if (preview) {
          this.drawMiniPreview(preview, series);
          preview.onclick = () => this.openTimeSeriesModal(prep, series);
          preview.onkeydown = (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              this.openTimeSeriesModal(prep, series);
            }
          };
        }
        if (expand) expand.onclick = () => this.openTimeSeriesModal(prep, series);
      }, 0);
    }
    setTimeout(() => {
      document.querySelectorAll("[data-wi-literature-index]").forEach((card) => {
        const item = references[Number(card.dataset.wiLiteratureIndex)];
        if (!item) return;
        card.onclick = () => this.openLiteratureModal(item);
        card.onkeydown = (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            this.openLiteratureModal(item);
          }
        };
      });
    }, 0);
  }

  renderMetricCards(metrics) {
    const variables = this.timeSeriesMetadata?.variables || [];
    return `<div style="display:flex;flex-direction:column;gap:6px">${variables.map((variable) => {
      const metric = metrics[variable.key] || {};
      const status = metric.status === "evaluated"
        ? (metric.imbalanced ? "Imbalanced" : "Within historical variability")
        : "Insufficient data";
      const color = metric.imbalanced ? "var(--wi-danger)" : "var(--wi-muted)";
      return `
        <div class="wi-metric-card">
          <div style="display:flex;justify-content:space-between;gap:8px;font-size:12px">
            <strong>${this.escape(variable.label)}</strong>
            <span style="color:${color};white-space:nowrap">${this.escape(status)}</span>
          </div>
          ${metric.status === "evaluated" ? `
            <div class="wi-muted" style="margin-top:4px;font-size:11px">
              mean shift ${this.formatValue(metric.difference)} ${this.escape(variable.unit)} · historical SD ${this.formatValue(metric.historicalStdDev)}
            </div>` : ""}
        </div>`;
    }).join("")}</div>`;
  }

  getClassLabel(classification) {
    if (!classification) return "No matched time series";
    if (classification.classId === "none") return "No detected imbalance";
    const labels = {
      deficit: "Water-demand deficit",
      groundwater: "Groundwater storage",
      glacier: "Glacier storage"
    };
    return classification.imbalancedVariables.map((key) => labels[key] || key).join(" + ");
  }

  getRegionName(regionCode) {
    const names = {
      AF: "Africa",
      AR: "Arctic",
      AS: "Asia",
      AU: "Australia and Oceania",
      EU: "Europe",
      GR: "Greenland",
      NA: "North America",
      SA: "South America",
      SI: "Siberia"
    };
    return names[regionCode] || regionCode || "Unknown";
  }

  renderLiteratureCard(item, index) {
    const ref = item.record;
    return `
      <div class="wi-literature-card" data-wi-literature-index="${index}" tabindex="0" role="button">
        <div class="wi-literature-card-title">${this.escape(ref.title)}</div>
        <div class="wi-muted" style="font-size:11px;margin-bottom:4px">${this.escape(ref.authors || "Unknown authors")}${ref.year ? ` · ${this.escape(ref.year)}` : ""}</div>
        ${item.relation.confidence != null ? `<div class="wi-muted" style="font-size:11px">confidence ${this.escape(item.relation.confidence)}</div>` : ""}
      </div>
    `;
  }

  getArticleUrl(ref) {
    if (ref.external_url) return ref.external_url;
    if (ref.doi) return `https://doi.org/${ref.doi}`;
    return this.getScholarUrl(ref.title);
  }

  getScholarUrl(query) {
    return `https://scholar.google.com/scholar?q=${encodeURIComponent(query || "")}`;
  }

  getAuthors(ref) {
    return (ref.authorIds || [])
      .map((authorId) => this.authors.get(authorId))
      .filter(Boolean);
  }

  renderAuthor(author) {
    const label = this.escape(author.name);
    if (!author.scholar_url) return `<span class="wi-literature-author">${label}</span>`;
    return `<a class="wi-literature-author" href="${this.escape(author.scholar_url)}" target="_blank" rel="noopener">${label}</a>`;
  }

  ensureLiteratureUI() {
    const existing = document.getElementById("wi-literature-modal");
    if (existing) {
      this.literatureModal = existing;
      existing.onclick = (event) => {
        if (event.target === existing) this.closeLiteratureModal();
      };
      existing.querySelector("#wi-literature-close").onclick = () => this.closeLiteratureModal();
      return;
    }

    const style = document.createElement("style");
    style.textContent = `
      .wi-literature-modal{position:fixed;inset:0;background:var(--wi-overlay);z-index:310;display:none;align-items:center;justify-content:center;padding:28px}
      .wi-literature-modal.visible{display:flex}
      .wi-literature-dialog{width:min(820px,calc(100vw - 56px));max-height:min(820px,calc(100vh - 56px));background:var(--wi-surface);border:1px solid var(--wi-border);border-radius:8px;box-shadow:var(--wi-shadow);display:flex;flex-direction:column;overflow:hidden}
      .wi-literature-header{min-height:54px;padding:12px 18px;border-bottom:1px solid var(--wi-border);display:flex;align-items:center;justify-content:space-between;gap:16px}
      .wi-literature-heading{font-size:14px;font-weight:600;color:var(--wi-text)}
      .wi-literature-close{width:28px;height:28px;padding:0;border:0;background:transparent;border-radius:4px;cursor:pointer;color:var(--wi-muted);flex:0 0 auto;display:grid;place-items:center;font:400 22px/1 Arial,sans-serif}
      .wi-literature-close:hover{background:var(--wi-button-hover)}
      .wi-literature-body{overflow:auto;padding:20px;color:var(--wi-text)}
      .wi-literature-title{font-size:22px;line-height:1.3;margin:0 0 8px}
      .wi-literature-title a{color:var(--wi-text);text-decoration:none}
      .wi-literature-title a:hover{text-decoration:underline}
      .wi-literature-authors{font-size:13px;margin-bottom:14px}
      .wi-literature-author-list{display:flex;flex-wrap:wrap;gap:6px}
      .wi-literature-author{display:inline-flex;align-items:center;border:1px solid var(--wi-border);background:var(--wi-surface-soft);border-radius:999px;padding:3px 8px;color:var(--wi-muted)}
      .wi-literature-authors a{color:var(--wi-link);text-decoration:none}
      .wi-literature-authors a:hover{text-decoration:underline}
      .wi-literature-meta{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:18px}
      .wi-literature-chip{background:var(--wi-button-hover);border:1px solid var(--wi-border);border-radius:999px;padding:4px 8px;font-size:11px;color:var(--wi-muted)}
      .wi-literature-section{margin-top:18px}
      .wi-literature-section h3{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--wi-muted);margin:0 0 7px}
      .wi-literature-section p{font-size:13px;line-height:1.65;margin:0;color:var(--wi-text)}
      .wi-literature-section a{color:var(--wi-link);text-decoration:none}
      .wi-literature-section a:hover{text-decoration:underline}
    `;
    document.head.appendChild(style);

    const modal = document.createElement("div");
    modal.id = "wi-literature-modal";
    modal.className = "wi-literature-modal";
    modal.innerHTML = `
      <div class="wi-literature-dialog">
        <div class="wi-literature-header">
          <div class="wi-literature-heading">Literature Evidence</div>
          <button class="wi-literature-close" id="wi-literature-close" type="button" aria-label="Close">×</button>
        </div>
        <div class="wi-literature-body" id="wi-literature-body"></div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.onclick = (event) => {
      if (event.target === modal) this.closeLiteratureModal();
    };
    modal.querySelector("#wi-literature-close").onclick = () => this.closeLiteratureModal();
    this.literatureModal = modal;
  }

  openLiteratureModal(item) {
    this.ensureLiteratureUI();
    const ref = item.record;
    const relation = item.relation || {};
    const articleUrl = this.getArticleUrl(ref);
    const authors = this.getAuthors(ref);
    const doiUrl = ref.doi ? `https://doi.org/${ref.doi}` : "";
    const evidenceReason = relation.reason || ref.llm?.reason || "";
    const chips = [
      ref.year,
      ref.venue,
      relation.confidence != null ? `confidence ${relation.confidence}` : ""
    ].filter(Boolean);

    this.literatureModal.querySelector("#wi-literature-body").innerHTML = `
      <h2 class="wi-literature-title"><a href="${this.escape(articleUrl)}" target="_blank" rel="noopener">${this.escape(ref.title)}</a></h2>
      <div class="wi-literature-authors wi-literature-author-list">${authors.length
        ? authors.map((author) => this.renderAuthor(author)).join("")
        : "Unknown authors"}</div>
      <div class="wi-literature-meta">${chips.map((chip) => `<span class="wi-literature-chip">${this.escape(chip)}</span>`).join("")}</div>
      ${ref.abstract ? `<section class="wi-literature-section"><h3>Abstract</h3><p>${this.escape(ref.abstract)}</p></section>` : ""}
      ${ref.affiliations ? `<section class="wi-literature-section"><h3>Affiliations</h3><p>${this.escape(ref.affiliations)}</p></section>` : ""}
      ${evidenceReason ? `<section class="wi-literature-section"><h3>Evidence relationship</h3><p>${this.escape(evidenceReason)}</p></section>` : ""}
      ${ref.keywords?.length ? `<section class="wi-literature-section"><h3>Keywords</h3><p>${ref.keywords.map((keyword) => this.escape(keyword)).join(" · ")}</p></section>` : ""}
      ${doiUrl ? `<section class="wi-literature-section"><h3>DOI</h3><p><a href="${this.escape(doiUrl)}" target="_blank" rel="noopener">${this.escape(ref.doi)}</a></p></section>` : ""}
    `;
    this.literatureModal.classList.add("visible");
  }

  closeLiteratureModal() {
    this.literatureModal?.classList.remove("visible");
  }

  ensureLegend() {
    const colors = this.timeSeriesMetadata?.classColors || {};
    const items = [
      [colors.none || "#e2e2dc", "No detected imbalance"],
      [colors.deficit || "#e3b23c", "Water-demand deficit"],
      [colors.groundwater || "#c767b1", "Groundwater storage"],
      [colors.glacier || "#2fb7c8", "Glacier storage"],
      [colors["deficit+groundwater"] || "#d85f55", "Deficit + groundwater"],
      [colors["deficit+glacier"] || "#66b95a", "Deficit + glacier"],
      [colors["groundwater+glacier"] || "#4f7fd5", "Groundwater + glacier"],
      [colors["deficit+groundwater+glacier"] || "#3f4652", "All three variables"]
    ];
    this.app.registerLegend?.(this.legendId, {
      title: "Water imbalance classes",
      html: `
      <div class="legend-grid">
        ${items.map(([color, label]) => `<span class="legend-swatch" style="background:${this.escape(color)}"></span><span>${this.escape(label)}</span>`).join("")}
      </div>
      <div class="legend-note">1997-2016 mean shift beyond 2 historical SD and 1 mm.</div>`
    });
  }

  ensureChartUI() {
    const existing = document.getElementById("wi-chart-modal");
    if (existing) {
      this.chartModal = existing;
      existing.onclick = (event) => {
        if (event.target === existing) this.closeTimeSeriesModal();
      };
      existing.querySelector("#wi-chart-close").onclick = () => this.closeTimeSeriesModal();
      return;
    }

    const style = document.createElement("style");
    style.textContent = `
      .wi-chart-modal{position:fixed;inset:0;background:var(--wi-overlay);z-index:300;display:none;align-items:center;justify-content:center;padding:28px}
      .wi-chart-modal.visible{display:flex}
      .wi-chart-dialog{width:min(1040px,calc(100vw - 56px));height:min(820px,calc(100vh - 56px));background:var(--wi-surface);border:1px solid var(--wi-border);border-radius:8px;box-shadow:var(--wi-shadow);display:flex;flex-direction:column;overflow:hidden}
      .wi-chart-header{height:54px;padding:0 18px;border-bottom:1px solid var(--wi-border);display:flex;align-items:center;justify-content:space-between}
      .wi-chart-title{font-size:14px;font-weight:600;color:var(--wi-text)}
      .wi-chart-subtitle{font-size:11px;color:var(--wi-muted);margin-top:2px}
      .wi-chart-close{width:28px;height:28px;padding:0;border:0;background:transparent;border-radius:4px;cursor:pointer;color:var(--wi-muted);display:grid;place-items:center;font:400 22px/1 Arial,sans-serif}
      .wi-chart-close:hover{background:var(--wi-button-hover)}
      .wi-chart-grid{flex:1;overflow:auto;padding:12px 18px 18px;display:grid;grid-template-rows:repeat(3,minmax(150px,1fr));gap:8px}
      .wi-chart-row{position:relative;border-bottom:1px solid var(--wi-border);min-height:150px}
      .wi-chart-row:last-child{border-bottom:0}
      .wi-chart-row canvas{display:block;width:100%;height:100%;min-height:150px}
    `;
    document.head.appendChild(style);

    const modal = document.createElement("div");
    modal.id = "wi-chart-modal";
    modal.className = "wi-chart-modal";
    modal.innerHTML = `
      <div class="wi-chart-dialog">
        <div class="wi-chart-header">
          <div>
            <div class="wi-chart-title" id="wi-chart-title">Basin Time Series</div>
            <div class="wi-chart-subtitle" id="wi-chart-subtitle">Shared annual cursor across three variables</div>
          </div>
          <button class="wi-chart-close" id="wi-chart-close" type="button" aria-label="Close">×</button>
        </div>
        <div class="wi-chart-grid" id="wi-chart-grid"></div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.onclick = (event) => {
      if (event.target === modal) this.closeTimeSeriesModal();
    };
    modal.querySelector("#wi-chart-close").onclick = () => this.closeTimeSeriesModal();
    this.chartModal = modal;
  }

  drawMiniPreview(canvas, series) {
    const ctx = canvas.getContext("2d");
    const variables = this.timeSeriesMetadata?.variables || [];
    const width = canvas.width;
    const height = canvas.height;
    const padding = { left: 8, right: 8, top: 8, bottom: 8 };
    const rowHeight = (height - padding.top - padding.bottom) / variables.length;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = this.cssVar("--wi-canvas-bg", "#071012");
    ctx.fillRect(0, 0, width, height);
    for (let row = 0; row < variables.length; row++) {
      const variable = variables[row];
      const values = series.map((record) => record[variable.id]).filter(Number.isFinite);
      if (!values.length) continue;
      const min = Math.min(...values);
      const max = Math.max(...values);
      const span = max - min || 1;
      const top = padding.top + row * rowHeight + 5;
      const bottom = padding.top + (row + 1) * rowHeight - 5;

      ctx.strokeStyle = variable.color;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      series.forEach((record, index) => {
        const value = record[variable.id];
        if (!Number.isFinite(value)) return;
        const x = padding.left + (index / (series.length - 1)) * (width - padding.left - padding.right);
        const y = bottom - ((value - min) / span) * (bottom - top);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }

  openTimeSeriesModal(prep, series) {
    this.ensureChartUI();
    this.activeChartSeries = { prep, series, hoverIndex: null };
    this.chartModal.querySelector("#wi-chart-title").textContent = prep.region?.name || prep.basin.name;
    this.chartModal.querySelector("#wi-chart-subtitle").textContent =
      `${series[0].year}-${series[series.length - 1].year} · basin_id ${prep.basin.id} · exact ID join`;

    const grid = this.chartModal.querySelector("#wi-chart-grid");
    grid.innerHTML = (this.timeSeriesMetadata?.variables || []).map((variable) => `
      <div class="wi-chart-row">
        <canvas data-variable="${this.escape(variable.id)}"></canvas>
      </div>
    `).join("");

    grid.onmousemove = (event) => this.handleChartPointer(event);
    grid.onmouseleave = () => {
      if (!this.activeChartSeries) return;
      this.activeChartSeries.hoverIndex = null;
      this.drawExpandedCharts();
    };
    this.chartModal.classList.add("visible");
    this.drawExpandedCharts();
  }

  closeTimeSeriesModal() {
    this.chartModal?.classList.remove("visible");
    this.activeChartSeries = null;
  }

  handleChartPointer(event) {
    if (!this.activeChartSeries) return;
    const canvas = event.target.closest("canvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const plot = this.getChartPlot(rect.width, rect.height, false);
    const pointerX = event.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, (pointerX - plot.left) / Math.max(1, plot.right - plot.left)));
    this.activeChartSeries.hoverIndex = Math.round(ratio * (this.activeChartSeries.series.length - 1));
    this.drawExpandedCharts();
  }

  drawExpandedCharts() {
    if (!this.activeChartSeries) return;
    const variables = this.timeSeriesMetadata?.variables || [];
    const metrics = this.activeChartSeries.prep.classification?.metrics || {};
    const canvases = this.chartModal.querySelectorAll("canvas[data-variable]");
    canvases.forEach((canvas, index) => {
      const variable = variables[index];
      if (!variable) return;
      this.drawTimeSeriesChart(
        canvas,
        this.activeChartSeries.series,
        variable,
        metrics[variable?.key],
        this.activeChartSeries.hoverIndex,
        index === canvases.length - 1
      );
    });
  }

  cssVar(name, fallback) {
    const value = getComputedStyle(document.body).getPropertyValue(name).trim()
      || getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  chartTheme() {
    return {
      background: this.cssVar("--wi-canvas-bg", "#ffffff"),
      text: this.cssVar("--wi-text", "#334155"),
      muted: this.cssVar("--wi-muted", "#64748b"),
      subtle: this.cssVar("--wi-subtle", "#94a3b8"),
      grid: this.cssVar("--wi-grid", "#e2e8f0"),
      gridSoft: this.cssVar("--wi-grid-soft", "#edf2f7"),
      hoverLine: this.cssVar("--wi-hover-line", "#64748b"),
      danger: this.cssVar("--wi-danger", "#b91c1c")
    };
  }

  drawTimeSeriesChart(canvas, series, variable, metric, hoverIndex, showXAxis) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const width = rect.width;
    const height = rect.height;
    const plot = this.getChartPlot(width, height, showXAxis);
    const finiteValues = series.map((record) => record[variable.id]).filter(Number.isFinite);
    const theme = this.chartTheme();

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = theme.text;
    ctx.font = "600 12px sans-serif";
    ctx.fillText(variable.label, plot.left, 16);
    if (metric?.imbalanced) {
      const labelWidth = ctx.measureText(variable.label).width;
      ctx.fillStyle = theme.danger;
      ctx.font = "600 12px sans-serif";
      ctx.fillText("Imbalanced", plot.left + labelWidth + 14, 16);
    }
    ctx.fillStyle = theme.subtle;
    ctx.font = "11px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(variable.unit, plot.right, 16);
    ctx.textAlign = "left";

    if (!finiteValues.length) {
      ctx.fillStyle = theme.subtle;
      ctx.fillText("No valid values", plot.left, plot.top + 24);
      return;
    }

    const rawMin = Math.min(...finiteValues);
    const rawMax = Math.max(...finiteValues);
    const margin = (rawMax - rawMin || Math.max(Math.abs(rawMax), 1)) * 0.08;
    const min = rawMin - margin;
    const max = rawMax + margin;
    const span = max - min || 1;
    const xAt = (index) => plot.left + (index / (series.length - 1)) * (plot.right - plot.left);
    const yAt = (value) => plot.bottom - ((value - min) / span) * (plot.bottom - plot.top);

    const yearTicks = this.getYearTicks(series[0].year, series[series.length - 1].year);
    ctx.strokeStyle = theme.gridSoft;
    ctx.lineWidth = 1;
    for (const year of yearTicks) {
      const yearIndex = Math.max(0, Math.min(series.length - 1, year - series[0].year));
      const x = xAt(yearIndex);
      ctx.beginPath();
      ctx.moveTo(x, plot.top);
      ctx.lineTo(x, plot.bottom);
      ctx.stroke();
    }

    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const y = plot.top + (i / 3) * (plot.bottom - plot.top);
      ctx.beginPath();
      ctx.moveTo(plot.left, y);
      ctx.lineTo(plot.right, y);
      ctx.stroke();
      const value = max - (i / 3) * span;
      ctx.fillStyle = theme.subtle;
      ctx.font = "10px sans-serif";
      ctx.fillText(this.formatValue(value), 4, y + 3);
    }

    ctx.strokeStyle = variable.color;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    let started = false;
    series.forEach((record, index) => {
      const value = record[variable.id];
      if (!Number.isFinite(value)) {
        started = false;
        return;
      }
      const x = xAt(index);
      const y = yAt(value);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    if (showXAxis) {
      ctx.fillStyle = theme.muted;
      ctx.font = "10px sans-serif";
      for (const year of yearTicks) {
        const yearIndex = Math.max(0, Math.min(series.length - 1, year - series[0].year));
        const x = xAt(yearIndex);
        if (year === series[0].year) ctx.textAlign = "left";
        else if (year === series[series.length - 1].year) ctx.textAlign = "right";
        else ctx.textAlign = "center";
        ctx.fillText(String(year), x, height - 7);
      }
      ctx.textAlign = "left";
    }

    if (hoverIndex != null) {
      const record = series[hoverIndex];
      const value = record[variable.id];
      const x = xAt(hoverIndex);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = theme.hoverLine;
      ctx.beginPath();
      ctx.moveTo(x, plot.top);
      ctx.lineTo(x, plot.bottom);
      ctx.stroke();

      if (Number.isFinite(value)) {
        const y = yAt(value);
        ctx.beginPath();
        ctx.moveTo(plot.left, y);
        ctx.lineTo(plot.right, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = variable.color;
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = theme.text;
        ctx.font = "600 11px sans-serif";
        ctx.fillText(`${record.year}: ${this.formatValue(value)} ${variable.unit}`, plot.right + 10, Math.max(plot.top + 12, y + 4));
      } else {
        ctx.setLineDash([]);
        ctx.fillStyle = theme.muted;
        ctx.font = "600 11px sans-serif";
        ctx.fillText(`${record.year}: no data`, plot.right + 10, plot.top + 14);
      }
    }
  }

  formatValue(value) {
    if (!Number.isFinite(value)) return "no data";
    const abs = Math.abs(value);
    if (abs >= 1000) return value.toFixed(0);
    if (abs >= 10) return value.toFixed(1);
    if (abs >= 0.1) return value.toFixed(2);
    return value.toExponential(2);
  }

  getYearTicks(startYear, endYear) {
    const ticks = [startYear];
    const firstDecade = Math.ceil(startYear / 10) * 10;
    for (let year = firstDecade; year < endYear; year += 10) {
      if (year !== startYear) ticks.push(year);
    }
    if (endYear !== startYear) ticks.push(endYear);
    return ticks;
  }

  getChartPlot(width, height, showXAxis) {
    return {
      left: 58,
      right: width - 178,
      top: 32,
      bottom: height - (showXAxis ? 30 : 12)
    };
  }

  getLiteratureFor(prep) {
    const candidates = [];
    const seen = new Set();
    const targetIds = prep.region?.id ? [prep.region.id] : [];

    for (const targetId of targetIds) {
      for (const relation of this.relationsByTarget.get(targetId) || []) {
        if (!relation.type.includes("literature") && !relation.type.startsWith("paper_")) continue;
        const literatureId = relation.source;
        const record = this.literature.get(literatureId);
        if (!record || seen.has(literatureId)) continue;
        if (record.llm?.status === "reject") continue;
        seen.add(literatureId);
        candidates.push({ record, relation });
      }
    }

    return candidates.sort((a, b) => {
      const ac = a.relation.confidence ?? 0;
      const bc = b.relation.confidence ?? 0;
      return bc - ac;
    });
  }

  findRegion(basin) {
    const lon = (basin.bbox[0] + basin.bbox[2]) / 2;
    const lat = (basin.bbox[1] + basin.bbox[3]) / 2;
    return this.regions.find((region) =>
      lon >= region.match.lon[0] && lon <= region.match.lon[1] &&
      lat >= region.match.lat[0] && lat <= region.match.lat[1]
    );
  }

  escape(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
};
