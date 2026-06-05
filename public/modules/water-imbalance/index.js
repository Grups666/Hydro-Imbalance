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
    this.classificationByBasin = new Map();
    this.regions = [];
    this.literature = new Map();
    this.relationsBySource = new Map();
    this.relationsByTarget = new Map();
    this.preparedBasins = [];
    this.selectedBasin = null;
    this.layerIds = [];
    this.chartModal = null;
    this.activeChartSeries = null;
    this.enhancedLayer = null;
    this.originalLayerState = null;
    this.handleFeatureClick = (payload) => {
      if (payload.layer?.moduleId === this.manifest.id) this.onFeatureClick(payload);
    };

    Foundation.eventBus.on(Foundation.Events.FEATURE_CLICK, this.handleFeatureClick);
  }

  async onLoad() {
    this.graph = await this.fetchJson(this.resolveModulePath(this.manifest.knowledgeGraph || "./data/knowledge-graph.json"));
    await this.loadTimeSeriesDataset();
    this.indexGraph();
    this.prepareBasins(window.BASIN_DATA?.basins || []);
    this.enhanceFoundationBasinLayer();
    this.ensureLegend();
    this.ensureChartUI();
  }

  onUnload() {
    if (this.enhancedLayer && this.originalLayerState) {
      Object.assign(this.enhancedLayer, this.originalLayerState);
      this.app.updateLayerList?.();
    }
    this.enhancedLayer = null;
    this.originalLayerState = null;
    Foundation.eventBus.off(Foundation.Events.FEATURE_CLICK, this.handleFeatureClick);
    this.closeTimeSeriesModal();
  }

  getLayerIds() {
    return this.layerIds;
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

  async loadTimeSeriesDataset() {
    const dataset = this.manifest.datasets?.find((item) => item.id === "basin-three-variable-timeseries-1962-2016");
    if (!dataset?.metadata) return;

    this.timeSeriesMetadata = await this.fetchJson(this.resolveModulePath(dataset.metadata));
    const csvUrl = this.resolveModulePath(
      dataset.metadata.replace(/[^/]+$/, "") + this.timeSeriesMetadata.file.replace(/^\.\//, "")
    );
    const response = await fetch(csvUrl);
    if (!response.ok) throw new Error(`Failed to load ${csvUrl}: ${response.status}`);
    this.indexTimeSeries(await response.text());
    const classification = await this.fetchJson(this.resolveModulePath(
      dataset.metadata.replace(/[^/]+$/, "") + this.timeSeriesMetadata.classification.replace(/^\.\//, "")
    ));
    for (const [basinId, result] of Object.entries(classification.basins || {})) {
      this.classificationByBasin.set(String(basinId), result);
    }
  }

  indexTimeSeries(csvText) {
    const lines = csvText.trim().split(/\r?\n/);
    const headers = lines[0].split(",");
    const indexes = Object.fromEntries(headers.map((header, index) => [header, index]));
    const variables = this.timeSeriesMetadata?.variables || [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",");
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

  indexGraph() {
    this.regions = this.graph?.spatialContexts?.regions || [];

    for (const [id, record] of Object.entries(this.graph?.literature?.records || {})) {
      this.literature.set(id, record);
    }

    for (const relation of this.graph?.relations || []) {
      this.addRelationIndex(this.relationsBySource, relation.source, relation);
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
    const base = (viewport.height / 180) * viewport.scale;
    const { width, height, offsetX, offsetY } = viewport;
    const leftLon = (-width / 2 - offsetX) / base;
    const rightLon = (width / 2 - offsetX) / base;
    const firstSeg = Math.floor(leftLon / 360);
    const lastSeg = Math.ceil(rightLon / 360);

    for (const prep of this.preparedBasins) {
      const isSelected = this.selectedBasin?.basin.id === prep.basin.id;
      const isHovered = this.app.hoveredFeatureId === prep.basin.id;
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

      for (let seg = firstSeg; seg <= lastSeg; seg++) {
        const lonOffset = seg * 360;
        for (const ring of prep.rings) {
          const path = new Path2D();
          for (let i = 0; i < ring.length; i++) {
            const [lon, lat] = ring[i];
            const x = width / 2 + (lon + lonOffset) * base + offsetX;
            const y = height / 2 - lat * base + offsetY;
            if (i === 0) path.moveTo(x, y);
            else path.lineTo(x, y);
          }
          ctx.fill(path);
          ctx.stroke(path);
        }
      }
    }
  }

  hitTest(lon, lat) {
    const seg = Math.round(lon / 360);
    let best = null;
    let bestArea = Infinity;

    for (const prep of this.preparedBasins) {
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
    const prep = this.preparedBasins.find((item) => item.basin.id === payload.feature.id);
    if (!prep) return;

    this.selectedBasin = prep;
    this.app.draw();
    this.showInspector(prep);
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
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="display:inline-block;width:12px;height:12px;border:1px solid #94a3b8;border-radius:3px;background:${this.escape(classification?.color || "#e3e6e9")}"></span>
        <span style="font-size:11px;color:#64748b;text-transform:uppercase">${this.escape(classLabel)}</span>
      </div>
      <h2 style="margin:0 0 6px;font-size:18px;font-weight:600">${this.escape(title)}</h2>
      <p style="margin:0 0 14px;color:#64748b;font-size:12px;line-height:1.5">
        Recent period 1997-2016 compared with historical period 1962-1996. A variable is imbalanced when its mean shift exceeds one historical standard deviation and 1 mm.
      </p>

      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:16px">
        <div style="background:#f8fafc;padding:12px;border-radius:6px">
          <div style="font-size:18px;font-weight:600">${Math.round(basin.areaKm2).toLocaleString()}</div>
          <div style="font-size:11px;color:#64748b">Area km2</div>
        </div>
        <div style="background:#f8fafc;padding:12px;border-radius:6px">
          <div style="font-size:18px;font-weight:600">${this.escape(this.getRegionName(basin.region))}</div>
          <div style="font-size:11px;color:#64748b">HydroBASINS region</div>
        </div>
      </div>

      <section style="margin-bottom:16px">
        <h3 style="font-size:12px;font-weight:600;margin:0 0 8px;color:#64748b;text-transform:uppercase">Imbalance Assessment</h3>
        ${this.renderMetricCards(metrics)}
      </section>

      <section style="margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <h3 style="font-size:12px;font-weight:600;margin:0;color:#64748b;text-transform:uppercase">1962-2016 Time Series</h3>
          ${series.length ? `<button id="${expandId}" type="button" style="border:1px solid #cbd5e1;background:#fff;border-radius:4px;padding:4px 8px;font-size:11px;cursor:pointer;color:#334155">Expand</button>` : ""}
        </div>
        ${series.length
          ? `<canvas id="${previewId}" width="300" height="132" style="display:block;width:100%;height:132px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;cursor:pointer"></canvas>`
          : `<p style="font-size:12px;color:#64748b;margin:0">No basin_id match in the module time-series dataset.</p>`}
      </section>

      <section>
        <h3 style="font-size:12px;font-weight:600;margin:0 0 8px;color:#64748b;text-transform:uppercase">Literature Evidence</h3>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${references.slice(0, 10).map((item) => this.renderLiteratureCard(item)).join("") || "<p style=\"font-size:12px;color:#64748b\">No evidence linked by this module.</p>"}
        </div>
      </section>
    `;

    this.app.showInspector(title, content);

    if (series.length) {
      setTimeout(() => {
        const preview = document.getElementById(previewId);
        const expand = document.getElementById(expandId);
        if (preview) {
          this.drawMiniPreview(preview, series);
          preview.onclick = () => this.openTimeSeriesModal(prep, series);
        }
        if (expand) expand.onclick = () => this.openTimeSeriesModal(prep, series);
      }, 0);
    }
  }

  renderMetricCards(metrics) {
    const variables = this.timeSeriesMetadata?.variables || [];
    return `<div style="display:flex;flex-direction:column;gap:6px">${variables.map((variable) => {
      const metric = metrics[variable.key] || {};
      const status = metric.status === "evaluated"
        ? (metric.imbalanced ? "Imbalanced" : "Within historical variability")
        : "Insufficient data";
      const color = metric.imbalanced ? "#b91c1c" : "#64748b";
      return `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:8px 10px">
          <div style="display:flex;justify-content:space-between;gap:8px;font-size:12px">
            <strong>${this.escape(variable.label)}</strong>
            <span style="color:${color};white-space:nowrap">${this.escape(status)}</span>
          </div>
          ${metric.status === "evaluated" ? `
            <div style="margin-top:4px;color:#64748b;font-size:11px">
              mean shift ${this.formatValue(metric.difference)} ${this.escape(variable.unit)} · historical SD ${this.formatValue(metric.historicalStdDev)}
            </div>` : ""}
        </div>`;
    }).join("")}</div>`;
  }

  getClassLabel(classification) {
    if (!classification) return "No matched time series";
    if (classification.classId === "none") return "No detected imbalance";
    const labels = {
      withdrawal: "Total water withdrawal",
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

  renderLiteratureCard(item) {
    const ref = item.record;
    const url = ref.external_url || (ref.doi ? `https://doi.org/${ref.doi}` : "");
    return `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:8px 12px;font-size:12px">
        <div style="font-weight:500;color:#1e293b;margin-bottom:2px">${this.escape(ref.title)}</div>
        <div style="color:#64748b;font-size:11px;margin-bottom:4px">${this.escape([ref.authors, ref.year].filter(Boolean).join(" · "))}</div>
        <div style="color:#64748b;font-size:11px;margin-bottom:4px">${this.escape(item.relation.type)}${item.relation.confidence != null ? ` · confidence ${this.escape(item.relation.confidence)}` : ""}</div>
        ${url ? `<a href="${this.escape(url)}" target="_blank" rel="noopener" style="color:#3b82f6;text-decoration:none;font-size:11px">Open Link</a>` : ""}
      </div>
    `;
  }

  ensureLegend() {
    if (document.getElementById("wi-imbalance-legend")) return;
    const legend = document.createElement("div");
    legend.id = "wi-imbalance-legend";
    legend.style.cssText = "position:fixed;left:18px;bottom:18px;z-index:120;background:rgba(255,255,255,.94);border:1px solid #cbd5e1;border-radius:6px;padding:10px 12px;box-shadow:0 3px 12px rgba(15,23,42,.12);font-size:11px;color:#334155;max-width:240px";
    const colors = this.timeSeriesMetadata?.classColors || {};
    const items = [
      [colors.none || "#eef2f7", "No detected imbalance"],
      [colors.withdrawal || "#e3b23c", "Total water withdrawal"],
      [colors.groundwater || "#c767b1", "Groundwater storage"],
      [colors.glacier || "#2fb7c8", "Glacier storage"],
      [colors["withdrawal+groundwater"] || "#d85f55", "Withdrawal + groundwater"],
      [colors["withdrawal+glacier"] || "#66b95a", "Withdrawal + glacier"],
      [colors["groundwater+glacier"] || "#4f7fd5", "Groundwater + glacier"],
      [colors["withdrawal+groundwater+glacier"] || "#3f4652", "All three variables"]
    ];
    legend.innerHTML = `
      <div style="font-weight:600;margin-bottom:7px">Water imbalance classes</div>
      <div style="display:grid;grid-template-columns:12px 1fr;gap:5px 7px;align-items:center">
        ${items.map(([color, label]) => `<span style="width:12px;height:12px;border:1px solid #64748b;background:${color}"></span><span>${label}</span>`).join("")}
      </div>
      <div style="margin-top:7px;color:#64748b;line-height:1.35">1997-2016 mean shift beyond historical SD and 1 mm.</div>`;
    document.body.appendChild(legend);
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
      .wi-chart-modal{position:fixed;inset:0;background:rgba(15,23,42,.34);z-index:300;display:none;align-items:center;justify-content:center;padding:28px}
      .wi-chart-modal.visible{display:flex}
      .wi-chart-dialog{width:min(1040px,calc(100vw - 56px));height:min(820px,calc(100vh - 56px));background:#fff;border-radius:8px;box-shadow:0 18px 48px rgba(15,23,42,.28);display:flex;flex-direction:column;overflow:hidden}
      .wi-chart-header{height:54px;padding:0 18px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between}
      .wi-chart-title{font-size:14px;font-weight:600;color:#1e293b}
      .wi-chart-subtitle{font-size:11px;color:#64748b;margin-top:2px}
      .wi-chart-close{width:28px;height:28px;border:0;background:transparent;border-radius:4px;cursor:pointer;font-size:20px;color:#64748b}
      .wi-chart-close:hover{background:#f1f5f9}
      .wi-chart-grid{flex:1;overflow:auto;padding:12px 18px 18px;display:grid;grid-template-rows:repeat(3,minmax(150px,1fr));gap:8px}
      .wi-chart-row{position:relative;border-bottom:1px solid #e2e8f0;min-height:150px}
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
          <button class="wi-chart-close" id="wi-chart-close" type="button" aria-label="Close">x</button>
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
    const canvases = this.chartModal.querySelectorAll("canvas[data-variable]");
    canvases.forEach((canvas, index) => {
      this.drawTimeSeriesChart(
        canvas,
        this.activeChartSeries.series,
        variables[index],
        this.activeChartSeries.hoverIndex,
        index === canvases.length - 1
      );
    });
  }

  drawTimeSeriesChart(canvas, series, variable, hoverIndex, showXAxis) {
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

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#334155";
    ctx.font = "600 12px sans-serif";
    ctx.fillText(variable.label, plot.left, 16);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(variable.unit, plot.right, 16);
    ctx.textAlign = "left";

    if (!finiteValues.length) {
      ctx.fillStyle = "#94a3b8";
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
    ctx.strokeStyle = "#edf2f7";
    ctx.lineWidth = 1;
    for (const year of yearTicks) {
      const yearIndex = Math.max(0, Math.min(series.length - 1, year - series[0].year));
      const x = xAt(yearIndex);
      ctx.beginPath();
      ctx.moveTo(x, plot.top);
      ctx.lineTo(x, plot.bottom);
      ctx.stroke();
    }

    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const y = plot.top + (i / 3) * (plot.bottom - plot.top);
      ctx.beginPath();
      ctx.moveTo(plot.left, y);
      ctx.lineTo(plot.right, y);
      ctx.stroke();
      const value = max - (i / 3) * span;
      ctx.fillStyle = "#94a3b8";
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
      ctx.fillStyle = "#64748b";
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
      ctx.strokeStyle = "#64748b";
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
        ctx.fillStyle = "#334155";
        ctx.font = "600 11px sans-serif";
        ctx.fillText(`${record.year}: ${this.formatValue(value)} ${variable.unit}`, plot.right + 10, Math.max(plot.top + 12, y + 4));
      } else {
        ctx.setLineDash([]);
        ctx.fillStyle = "#64748b";
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
