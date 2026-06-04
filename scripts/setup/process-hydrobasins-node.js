#!/usr/bin/env node
/**
 * 使用 shapefile 库直接处理 HydroBASINS 数据
 * 无需 ogr2ogr
 */

const shapefile = require('shapefile');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const DATA_RAW = path.join(PROJECT_ROOT, 'data/raw');
const PUBLIC_ASSETS = path.join(PROJECT_ROOT, 'public/assets');

// 区域配置
const REGIONS = [
  { code: 'AS', dir: 'hybas_as', levels: [4] },
  { code: 'EU', dir: 'hybas_eu_lev01-12_v1c', levels: [4] },
  { code: 'AF', dir: 'hybas_af_lev01-12_v1c', levels: [4] },
  { code: 'NA', dir: 'hybas_na_lev01-12_v1c', levels: [4] },
  { code: 'SA', dir: 'hybas_sa_lev01-12_v1c', levels: [4] },
  { code: 'AU', dir: 'hybas_au_lev01-12_v1c', levels: [4] }
];

// 计算 bbox
function computeBbox(coords) {
  let minLon = Infinity, maxLon = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;

  const process = (c) => {
    if (typeof c[0] === 'number') {
      minLon = Math.min(minLon, c[0]);
      maxLon = Math.max(maxLon, c[0]);
      minLat = Math.min(minLat, c[1]);
      maxLat = Math.max(maxLat, c[1]);
    } else {
      c.forEach(process);
    }
  };
  process(coords);
  return [minLon, minLat, maxLon, maxLat];
}

// Douglas-Peucker 简化算法 - 保持边界精度
function douglasPeuckerSimplify(coords, tolerance = 0.1) {
  if (coords.length < 3) return coords;

  // 计算点到线段的垂直距离
  function perpendicularDistance(point, lineStart, lineEnd) {
    const dx = lineEnd[0] - lineStart[0];
    const dy = lineEnd[1] - lineStart[1];
    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag === 0) return Math.sqrt(
      (point[0] - lineStart[0]) ** 2 + (point[1] - lineStart[1]) ** 2
    );
    const u = ((point[0] - lineStart[0]) * dx + (point[1] - lineStart[1]) * dy) / (mag * mag);
    if (u < 0) return Math.sqrt((point[0] - lineStart[0]) ** 2 + (point[1] - lineStart[1]) ** 2);
    if (u > 1) return Math.sqrt((point[0] - lineEnd[0]) ** 2 + (point[1] - lineEnd[1]) ** 2);
    const intersectX = lineStart[0] + u * dx;
    const intersectY = lineStart[1] + u * dy;
    return Math.sqrt((point[0] - intersectX) ** 2 + (point[1] - intersectY) ** 2);
  }

  // 递归简化
  function simplify(points, first, last, tolerance, result) {
    let maxDist = 0;
    let maxIndex = 0;

    for (let i = first + 1; i < last; i++) {
      const dist = perpendicularDistance(points[i], points[first], points[last]);
      if (dist > maxDist) {
        maxDist = dist;
        maxIndex = i;
      }
    }

    if (maxDist > tolerance) {
      simplify(points, first, maxIndex, tolerance, result);
      result.push(points[maxIndex]);
      simplify(points, maxIndex, last, tolerance, result);
    }
  }

  const result = [coords[0]];
  simplify(coords, 0, coords.length - 1, tolerance, result);
  result.push(coords[coords.length - 1]);

  return result;
}

// 简化坐标环 - 使用更精确的算法
function simplifyRing(coords, tolerance = 0.15) {
  if (!coords || coords.length < 3) return [];

  // 使用 Douglas-Peucker 算法
  const simplified = douglasPeuckerSimplify(coords, tolerance);

  // 确保闭合
  if (simplified.length > 0) {
    const first = simplified[0];
    const last = simplified[simplified.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      simplified.push([first[0], first[1]]);
    }
  }

  return simplified;
}

// 处理单个 Shapefile
async function processShapefile(shpPath, dbfPath, regionCode) {
  const basins = [];

  console.log(`处理: ${shpPath}`);

  try {
    const source = await shapefile.open(shpPath, dbfPath);

    let count = 0;
    while (true) {
      const result = await source.read();
      if (result.done) break;

      const feature = result.value;
      const props = feature.properties || {};
      const geom = feature.geometry;

      if (!geom || !geom.coordinates) continue;

      // 计算 bbox
      const bbox = computeBbox(geom.coordinates);

      // 提取所有多边形（保持完整边界）
      const rings = [];
      if (geom.type === 'Polygon') {
        const ring = simplifyRing(geom.coordinates[0], 0.15);
        if (ring.length >= 4) rings.push(ring);
      } else if (geom.type === 'MultiPolygon') {
        // 保留所有多边形，不只是最大的
        for (const poly of geom.coordinates) {
          const ring = simplifyRing(poly[0], 0.15);
          if (ring.length >= 4) rings.push(ring);
        }
      }

      if (rings.length === 0 || rings[0].length < 4) continue;

      basins.push({
        id: props.HYBAS_ID || `basin_${count}`,
        name: `Catchment ${props.HYBAS_ID || count}`,
        region: regionCode,
        bbox: bbox,
        areaKm2: Math.round(props.SUB_AREA || 0),
        rings: rings
      });

      count++;
    }

    console.log(`  提取 ${basins.length} 个流域`);
    return basins;

  } catch (err) {
    console.error(`  错误: ${err.message}`);
    return [];
  }
}

// 主函数
async function main() {
  console.log('=== 处理 HydroBASINS 数据 ===\n');

  const allBasins = [];

  for (const region of REGIONS) {
    const regionDir = path.join(DATA_RAW, region.dir);

    if (!fs.existsSync(regionDir)) {
      console.log(`跳过 ${region.code}: 目录不存在`);
      continue;
    }

    for (const level of region.levels) {
      const shpFile = path.join(regionDir, `hybas_${region.code.toLowerCase()}_lev0${level}_v1c.shp`);
      const dbfFile = path.join(regionDir, `hybas_${region.code.toLowerCase()}_lev0${level}_v1c.dbf`);

      // 尝试不同的文件名格式
      let actualShp = shpFile;
      let actualDbf = dbfFile;

      // 检查是否有直接命名格式（如 hybas_as_lev04_v1c.shp）
      if (!fs.existsSync(shpFile)) {
        const files = fs.readdirSync(regionDir);
        const shpMatch = files.find(f => f.endsWith(`_lev0${level}_v1c.shp`));
        if (shpMatch) {
          actualShp = path.join(regionDir, shpMatch);
          actualDbf = path.join(regionDir, shpMatch.replace('.shp', '.dbf'));
        }
      }

      if (!fs.existsSync(actualShp)) {
        console.log(`跳过 ${region.code} Level ${level}: Shapefile 不存在`);
        continue;
      }

      const basins = await processShapefile(actualShp, actualDbf, region.code);
      allBasins.push(...basins);
    }
  }

  console.log(`\n总计: ${allBasins.length} 个流域`);

  // 写入 JS 文件
  if (allBasins.length > 0) {
    const outputPath = path.join(PUBLIC_ASSETS, 'basin-data.js');

    const jsContent = `/**
 * 全球流域数据 (HydroBASINS Level 4)
 * 流域数量: ${allBasins.length}
 * 生成时间: ${new Date().toISOString()}
 */

window.BASIN_DATA = ${JSON.stringify({ basins: allBasins }, null, 0)};
`;

    fs.writeFileSync(outputPath, jsContent);

    const stats = fs.statSync(outputPath);
    console.log(`\n输出: ${outputPath}`);
    console.log(`大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  } else {
    console.log('\n警告: 没有处理任何流域数据');
  }
}

main().catch(err => {
  console.error('处理失败:', err);
  process.exit(1);
});