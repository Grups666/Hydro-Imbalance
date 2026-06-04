#!/usr/bin/env node
/**
 * 将 HydroBASINS Shapefile 转换为前端可用的 JS 格式
 *
 * 使用方法:
 * 1. 确保已安装 GDAL/ogr2ogr
 * 2. 运行: node scripts/setup/process-hydrobasins.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const DATA_RAW = path.join(PROJECT_ROOT, 'data/raw');
const DATA_PROCESSED = path.join(PROJECT_ROOT, 'data/processed');
const PUBLIC_ASSETS = path.join(PROJECT_ROOT, 'public/assets');

// 确保目录存在
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 检查 ogr2ogr 是否可用
function checkOgr2Ogr() {
  try {
    execSync('ogr2ogr --version', { stdio: 'pipe' });
    return true;
  } catch (e) {
    return false;
  }
}

// 转换 Shapefile 到 GeoJSON
function shpToGeoJSON(shpPath, geojsonPath, simplify = 0.02) {
  const cmd = `ogr2ogr -f GeoJSON -simplify ${simplify} "${geojsonPath}" "${shpPath}"`;
  console.log(`执行: ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit' });
    return fs.existsSync(geojsonPath);
  } catch (e) {
    console.error('转换失败:', e.message);
    return false;
  }
}

// 将 GeoJSON 转换为前端可用的简化格式
function convertToBasinData(geojson, regionCode) {
  const basins = [];

  if (!geojson.features) {
    console.error('GeoJSON 没有 features');
    return { basins: [] };
  }

  console.log(`处理 ${geojson.features.length} 个流域...`);

  for (const feature of geojson.features) {
    const props = feature.properties || {};
    const geom = feature.geometry;

    if (!geom || !geom.coordinates) continue;

    // 计算 bbox
    let minLon = Infinity, maxLon = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;

    const processCoords = (coords) => {
      if (typeof coords[0] === 'number') {
        minLon = Math.min(minLon, coords[0]);
        maxLon = Math.max(maxLon, coords[0]);
        minLat = Math.min(minLat, coords[1]);
        maxLat = Math.max(maxLat, coords[1]);
      } else {
        for (const c of coords) processCoords(c);
      }
    };
    processCoords(geom.coordinates);

    // 提取外环（简化）
    const rings = [];
    if (geom.type === 'Polygon') {
      rings.push(simplifyRing(geom.coordinates[0], 0.5)); // 0.5度简化
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates) {
        rings.push(simplifyRing(poly[0], 0.5));
      }
    }

    basins.push({
      id: props.HYBAS_ID || `unknown_${basins.length}`,
      name: props.MAIN_BAS ? `Basin ${props.MAIN_BAS}` : `Catchment ${basins.length}`,
      region: regionCode,
      bbox: [minLon, minLat, maxLon, maxLat],
      areaKm2: Math.round(props.SUB_AREA || 0),
      rings: rings
    });
  }

  return { basins };
}

// 简化坐标环
function simplifyRing(coords, tolerance) {
  if (!coords || coords.length < 3) return [];

  const result = [];
  let lastAdded = null;

  for (let i = 0; i < coords.length; i++) {
    const [lon, lat] = coords[i];
    if (lastAdded === null ||
        Math.abs(lon - lastAdded[0]) >= tolerance ||
        Math.abs(lat - lastAdded[1]) >= tolerance) {
      result.push([lon, lat]);
      lastAdded = [lon, lat];
    }
  }

  // 确保闭合
  if (result.length > 0 &&
      (result[0][0] !== result[result.length-1][0] ||
       result[0][1] !== result[result.length-1][1])) {
    result.push(result[0]);
  }

  return result;
}

// 主函数
async function main() {
  console.log('=== HydroBASINS 数据处理 ===\n');

  // 检查 ogr2ogr
  if (!checkOgr2Ogr()) {
    console.log('警告: ogr2ogr 未安装');
    console.log('请安装 GDAL:');
    console.log('  Windows: https://trac.osgeo.org/gdal/wiki/DownloadingGdalBinaries');
    console.log('  macOS: brew install gdal');
    console.log('  Linux: sudo apt-get install gdal-bin');
    console.log('\n尝试使用内置简化处理...\n');
  }

  ensureDir(DATA_PROCESSED);
  ensureDir(PUBLIC_ASSETS);

  // 要处理的区域
  const regions = [
    { code: 'AS', name: 'Asia', file: 'hybas_as/hybas_as_lev04_v1c.shp' },
    { code: 'EU', name: 'Europe', file: 'hybas_eu/hybas_eu_lev04_v1c.shp' },
    { code: 'AF', name: 'Africa', file: 'hybas_af/hybas_af_lev04_v1c.shp' },
    { code: 'NA', name: 'North America', file: 'hybas_na/hybas_na_lev04_v1c.shp' },
    { code: 'SA', name: 'South America', file: 'hybas_sa/hybas_sa_lev04_v1c.shp' },
    { code: 'AU', name: 'Australia', file: 'hybas_au/hybas_au_lev04_v1c.shp' }
  ];

  const allBasins = [];

  for (const region of regions) {
    const shpPath = path.join(DATA_RAW, region.file);

    if (!fs.existsSync(shpPath)) {
      console.log(`跳过 ${region.name}: 文件不存在 (${shpPath})`);
      continue;
    }

    console.log(`\n处理 ${region.name}...`);

    // 尝试转换为 GeoJSON
    const geojsonPath = path.join(DATA_PROCESSED, `hybas_${region.code.toLowerCase()}_lev04.geojson`);

    if (checkOgr2Ogr() && !fs.existsSync(geojsonPath)) {
      shpToGeoJSON(shpPath, geojsonPath, 0.02);
    }

    // 如果 GeoJSON 存在，读取并处理
    if (fs.existsSync(geojsonPath)) {
      console.log(`读取 ${geojsonPath}`);
      const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
      const basinData = convertToBasinData(geojson, region.code);
      allBasins.push(...basinData.basins);
      console.log(`  提取 ${basinData.basins.length} 个流域`);
    } else {
      console.log(`  GeoJSON 不存在，跳过`);
    }
  }

  // 写入合并的 basin-data.js
  if (allBasins.length > 0) {
    const outputPath = path.join(PUBLIC_ASSETS, 'basin-data.js');
    const jsContent = `/**
 * 全球流域数据 (HydroBASINS Level 4)
 * 自动生成自 HydroBASINS 数据
 * 流域数量: ${allBasins.length}
 * 生成时间: ${new Date().toISOString()}
 */

window.BASIN_DATA = ${JSON.stringify({ basins: allBasins }, null, 2)};
`;
    fs.writeFileSync(outputPath, jsContent);
    console.log(`\n输出: ${outputPath}`);
    console.log(`总流域数: ${allBasins.length}`);

    // 文件大小
    const stats = fs.statSync(outputPath);
    console.log(`文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  } else {
    console.log('\n警告: 没有处理任何流域数据');
    console.log('请先解压 HydroBASINS 数据或安装 ogr2ogr');
  }
}

main().catch(console.error);
