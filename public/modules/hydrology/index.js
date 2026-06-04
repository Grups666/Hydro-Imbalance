/**
 * Hydrology Research Module
 */
window.HydrologyModule = class HydrologyModule {
  constructor(app) {
    this.app = app;
    this.modes = null;
    this.modeProfiles = null;
    this.highlightedRegions = null;
    this.referenceCatalog = null;
    this.basinData = null;
    this.preparedBasins = [];
    this.selectedBasin = null;
    this.layerIds = [];

    // Register event handler
    Foundation.eventBus.on(Foundation.Events.FEATURE_CLICK, (p) => {
      if (p.layer?.moduleId === 'hydrology') this.onFeatureClick(p);
    });
  }

  async onLoad() {
    // Load data
    this.modes = window.RESEARCH_EXPLORER?.modes || {};
    this.modeProfiles = window.RESEARCH_EXPLORER?.modeProfiles || {};
    this.highlightedRegions = window.RESEARCH_EXPLORER?.highlightedRegions || [];
    this.referenceCatalog = window.REFERENCE_CATALOG || {};
    this.basinData = window.BASIN_DATA?.basins || [];

    // Prepare basins
    this.preparedBasins = this.basinData.map(basin => {
      const region = this.findRegion(basin);
      return {
        basin,
        region,
        mode: region?.mode || this.inferMode(basin),
        rings: (basin.rings || []).filter(r => r.length >= 3)
      };
    });

    // Register layer
    const layerId = 'hydro-basins';
    this.layerIds.push(layerId);

    this.app.layerManager.addLayer({
      id: layerId,
      name: 'Hydrological Basins',
      type: 'vector',
      interactive: true,
      moduleId: 'hydrology',
      renderer: (ctx, layer, vp) => this.render(ctx, vp),
      hitTest: (lon, lat, vp, layer) => this.hitTest(lon, lat),
      metadata: { color: '#3b82f6' }
    });
  }

  getLayerIds() {
    return this.layerIds;
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
      const mode = this.modes[prep.mode] || this.modes.mixed || { color: '#9aa3ad' };

      let fillAlpha = prep.region ? 0.36 : 0.08;
      let strokeColor = prep.region ? 'rgba(17,24,39,0.28)' : 'rgba(17,24,39,0.08)';
      let lineWidth = prep.region ? 0.5 : 0.2;

      if (isSelected) {
        fillAlpha = 0.58;
        strokeColor = '#111827';
        lineWidth = 1.8;
      } else if (isHovered) {
        fillAlpha = Math.min(fillAlpha + 0.15, 0.5);
        strokeColor = 'rgba(17,24,39,0.6)';
        lineWidth = 1.2;
      }

      ctx.fillStyle = Foundation.UI.hexToRgba(mode.color, fillAlpha);
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
    let best = null, bestArea = Infinity;

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
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        if (((yi > lat) !== (yj > lat)) && lon < (xj - xi) * (lat - yi) / (yj - yi + 1e-10) + xi) {
          inside = !inside;
        }
      }
    }
    return inside;
  }

  onFeatureClick(payload) {
    const prep = this.preparedBasins.find(p => p.basin.id === payload.feature.id);
    if (!prep) return;

    this.selectedBasin = prep;
    this.app.draw();
    this.showProfile(prep);
  }

  showProfile(prep) {
    const basin = prep.basin;
    const region = prep.region;
    const mode = this.modes[prep.mode] || { label: 'Unknown', color: '#9aa3ad' };
    const modeProfile = this.modeProfiles[prep.mode] || {};
    const title = region?.name || basin.name;
    const refs = this.getReferences(prep);

    const content = `
      <div style="margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${mode.color}"></span>
          <span style="font-size:11px;color:#64748b;text-transform:uppercase">${mode.label}</span>
        </div>
        <h2 style="margin:0;font-size:18px;font-weight:600">${this.escape(title)}</h2>
        <p style="margin:4px 0 0;color:#64748b;font-size:12px">${this.escape(modeProfile.summary || 'Hydrological basin')}</p>
      </div>

      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:16px">
        <div style="background:#f8fafc;padding:12px;border-radius:6px">
          <div style="font-size:18px;font-weight:600">${Math.round(basin.areaKm2).toLocaleString()}</div>
          <div style="font-size:11px;color:#64748b">Area km²</div>
        </div>
        <div style="background:#f8fafc;padding:12px;border-radius:6px">
          <div style="font-size:18px;font-weight:600">${basin.region}</div>
          <div style="font-size:11px;color:#64748b">Region</div>
        </div>
      </div>

      ${modeProfile.cycle?.length ? `
        <div style="margin-bottom:16px">
          <h3 style="font-size:12px;font-weight:600;margin:0 0 8px;color:#64748b;text-transform:uppercase">Water Cycle</h3>
          <ul style="margin:0;padding-left:20px;font-size:13px;line-height:1.6">
            ${modeProfile.cycle.map(c => `<li>${this.escape(c)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      <div>
        <h3 style="font-size:12px;font-weight:600;margin:0 0 8px;color:#64748b;text-transform:uppercase">References</h3>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${refs.slice(0, 8).map(refId => {
            const ref = this.referenceCatalog[refId] || { title: refId };
            const hasUrl = ref.external_url || ref.doi;
            const url = ref.external_url || (ref.doi ? `https://doi.org/${ref.doi}` : null);
            return `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:8px 12px;font-size:12px">
              <div style="font-weight:500;color:#1e293b;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${this.escape(ref.title)}</div>
              <div style="color:#64748b;font-size:11px;margin-bottom:4px">${this.escape([ref.authors, ref.year].filter(Boolean).join(' · '))}</div>
              ${hasUrl ? `<a href="${url}" target="_blank" rel="noopener" style="color:#3b82f6;text-decoration:none;font-size:11px">Open Link →</a>` : ''}
            </div>`;
          }).join('')}
        </div>
      </div>
    `;

    this.app.showInspector(title, content);
  }

  showReference(refId) {
    const ref = this.referenceCatalog[refId];
    if (!ref) return;

    const hasUrl = ref.external_url || ref.doi;
    const url = ref.external_url || (ref.doi ? `https://doi.org/${ref.doi}` : null);

    const content = `
      <button id="btnBack" style="margin-bottom:12px;background:none;border:none;color:#3b82f6;cursor:pointer;font-size:12px;padding:0">← Back</button>
      <h2 style="margin:0 0 12px;font-size:16px;font-weight:600">${this.escape(ref.title)}</h2>
      <div style="display:grid;gap:8px;margin-bottom:16px;font-size:12px">
        <div><span style="color:#64748b">Authors:</span> ${this.escape(ref.authors || '—')}</div>
        <div><span style="color:#64748b">Year:</span> ${this.escape(ref.year || '—')}</div>
        <div><span style="color:#64748b">Venue:</span> ${this.escape(ref.venue || '—')}</div>
        ${hasUrl ? `<div><a href="${url}" target="_blank" rel="noopener" style="color:#3b82f6;text-decoration:none">Open Full Paper →</a></div>` : ''}
      </div>
      <h3 style="font-size:12px;font-weight:600;margin:0 0 8px;color:#64748b">Abstract</h3>
      <p style="font-size:13px;line-height:1.6;color:#334155">${this.escape(ref.abstract || 'No abstract.')}</p>
    `;

    this.app.showInspector(ref.title, content);

    setTimeout(() => {
      document.getElementById('btnBack').onclick = () => {
        if (this.selectedBasin) this.showProfile(this.selectedBasin);
      };
    }, 0);
  }

  getReferences(prep) {
    const modeProfile = this.modeProfiles[prep.mode] || {};
    const refs = [...(modeProfile.references || [])];
    for (const refId of prep.region?.references || []) {
      if (!refs.includes(refId)) refs.unshift(refId);
    }
    return refs.length ? refs : ['rodell2018Freshwater'];
  }

  findRegion(basin) {
    const lon = (basin.bbox[0] + basin.bbox[2]) / 2;
    const lat = (basin.bbox[1] + basin.bbox[3]) / 2;
    return this.highlightedRegions.find(r =>
      lon >= r.match.lon[0] && lon <= r.match.lon[1] &&
      lat >= r.match.lat[0] && lat <= r.match.lat[1]
    );
  }

  inferMode(basin) {
    const lon = (basin.bbox[0] + basin.bbox[2]) / 2;
    const lat = (basin.bbox[1] + basin.bbox[3]) / 2;
    const absLat = Math.abs(lat);

    if (absLat > 55) return 'boreal';
    if (absLat < 12 && ['SA', 'AF', 'AS'].includes(basin.region)) return 'tropical';
    if (absLat >= 12 && absLat <= 35 && basin.areaKm2 > 150000) return 'dryIrrigation';
    if (basin.region === 'EU' || (basin.region === 'NA' && absLat > 35)) return 'humid';
    return 'mixed';
  }

  escape(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
};