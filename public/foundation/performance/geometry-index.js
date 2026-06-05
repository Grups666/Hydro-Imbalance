/**
 * Reusable geometry acceleration for vector features.
 * Paths are built once, while spatial queries only inspect nearby features.
 */
window.Foundation = window.Foundation || {};

Foundation.PathCache = class PathCache {
  constructor(getRings) {
    this.getRings = getRings;
    this.paths = new WeakMap();
  }

  get(feature) {
    let paths = this.paths.get(feature);
    if (paths) return paths;

    paths = (this.getRings(feature) || []).filter((ring) => ring.length >= 3).map((ring) => {
      const path = new Path2D();
      for (let i = 0; i < ring.length; i++) {
        const [x, y] = ring[i];
        if (i === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      }
      path.closePath();
      return path;
    });
    this.paths.set(feature, paths);
    return paths;
  }
};

Foundation.SpatialGridIndex = class SpatialGridIndex {
  constructor(features, getBounds, cellSize = 10) {
    this.getBounds = getBounds;
    this.cellSize = cellSize;
    this.cells = new Map();
    for (const feature of features) this.insert(feature);
  }

  insert(feature) {
    const bounds = this.getBounds(feature);
    if (!bounds) return;
    const [minX, minY, maxX, maxY] = bounds;
    for (let x = Math.floor(minX / this.cellSize); x <= Math.floor(maxX / this.cellSize); x++) {
      for (let y = Math.floor(minY / this.cellSize); y <= Math.floor(maxY / this.cellSize); y++) {
        const key = `${x}:${y}`;
        if (!this.cells.has(key)) this.cells.set(key, []);
        this.cells.get(key).push(feature);
      }
    }
  }

  queryPoint(x, y) {
    return this.cells.get(`${Math.floor(x / this.cellSize)}:${Math.floor(y / this.cellSize)}`) || [];
  }

  queryBounds(minX, minY, maxX, maxY) {
    const results = new Set();
    for (let x = Math.floor(minX / this.cellSize); x <= Math.floor(maxX / this.cellSize); x++) {
      for (let y = Math.floor(minY / this.cellSize); y <= Math.floor(maxY / this.cellSize); y++) {
        for (const feature of this.cells.get(`${x}:${y}`) || []) results.add(feature);
      }
    }
    return [...results];
  }
};
