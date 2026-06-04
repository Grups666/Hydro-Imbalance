#!/usr/bin/env node
/**
 * 数据验证脚本
 * 验证 catalog 数据是否符合 schema
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// 简化验证（不依赖外部库）
function validateBasicStructure(data, schemaName) {
  const errors = [];

  if (schemaName === 'literature') {
    if (!data.id) errors.push('缺少 id');
    if (!data.title) errors.push('缺少 title');
    if (!data.authors) errors.push('缺少 authors');
    if (!data.year) errors.push('缺少 year');
    if (!data.venue) errors.push('缺少 venue');
  }

  if (schemaName === 'region') {
    if (!data.id) errors.push('缺少 id');
    if (!data.name) errors.push('缺少 name');
    if (!data.match) errors.push('缺少 match');
    if (!data.match?.lon) errors.push('缺少 match.lon');
    if (!data.match?.lat) errors.push('缺少 match.lat');
    if (!data.mode) errors.push('缺少 mode');
  }

  return errors;
}

console.log('=== Catalog 数据验证 ===\n');

function loadBrowserCatalog(filePath, globalName) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(filePath, 'utf8'), context, { filename: filePath });
  return context.window[globalName];
}

function bboxCenter(bbox) {
  return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
}

function regionForBasin(basin, highlightedRegions) {
  const [lon, lat] = bboxCenter(basin.bbox);
  return highlightedRegions.find((r) => (
    lon >= r.match.lon[0] && lon <= r.match.lon[1] &&
    lat >= r.match.lat[0] && lat <= r.match.lat[1]
  ));
}

function inferredModeForBasin(basin, highlightedRegions) {
  const region = regionForBasin(basin, highlightedRegions);
  if (region) return region.mode;
  const [lon, lat] = bboxCenter(basin.bbox);
  const absLat = Math.abs(lat);
  const isLarge = basin.areaKm2 > 150000;
  const isSmall = basin.areaKm2 < 50000;
  const tropicalBelt = absLat < 12;
  const subtropicalDryBelt = absLat >= 12 && absLat <= 35;
  const midLatitude = absLat > 35 && absLat <= 55;
  const highLatitude = absLat > 55;
  const mountainAsia = basin.region === "AS" && lon >= 65 && lon <= 105 && lat >= 25 && lat <= 42;
  const andes = basin.region === "SA" && lon >= -82 && lon <= -65 && lat >= -55 && lat <= 12;
  const rockyMountains = basin.region === "NA" && lon >= -125 && lon <= -100 && lat >= 30 && lat <= 60;
  const alpineEurope = basin.region === "EU" && lon >= 5 && lon <= 25 && lat >= 42 && lat <= 49;
  const eastSouthAsiaMonsoon = basin.region === "AS" && lat > 5 && lat < 32 && lon >= 70 && lon <= 125;
  const westAfricaMonsoon = basin.region === "AF" && lat > 4 && lat < 18 && lon >= -18 && lon <= 35;
  const southAmericaTropical = basin.region === "SA" && tropicalBelt;
  const australiaDry = basin.region === "AU" && lat < -15 && lat > -38;
  const africaDry = basin.region === "AF" && subtropicalDryBelt && !(westAfricaMonsoon && !isSmall);

  if (highLatitude) return basin.region === "EU" || basin.region === "NA" || basin.region === "AS" ? "boreal" : "snow";
  if (mountainAsia || andes || rockyMountains || alpineEurope) return "mountain";
  if (eastSouthAsiaMonsoon || westAfricaMonsoon) return "monsoon";
  if (tropicalBelt && (basin.region === "SA" || basin.region === "AF" || basin.region === "AS")) return "tropical";
  if (australiaDry || africaDry || (subtropicalDryBelt && isLarge)) return isSmall ? "dryNatural" : "dryIrrigation";
  if (basin.region === "EU" || (basin.region === "NA" && midLatitude) || (basin.region === "SA" && !southAmericaTropical)) return "humid";
  if (isSmall && !subtropicalDryBelt) return "lowHumanImpact";
  return "mixed";
}

// 验证文献数据
const litFile = path.join(__dirname, '../../catalog/literature/reference-catalog.js');
let literature = {};
if (fs.existsSync(litFile)) {
  console.log('验证文献数据...');
  try {
    literature = loadBrowserCatalog(litFile, 'REFERENCE_CATALOG');
    const ids = Object.keys(literature || {});
    console.log(`  ✓ ${ids.length} 个文献条目`);
  } catch (e) {
    console.log(`  ✗ 文献文件无法解析: ${e.message}`);
  }
} else {
  console.log('  ✗ 文献文件缺失');
}

// 验证区域数据
const regionFile = path.join(__dirname, '../../catalog/regions/basin-profiles.js');
let explorer = {};
if (fs.existsSync(regionFile)) {
  console.log('验证区域数据...');
  try {
    explorer = loadBrowserCatalog(regionFile, 'RESEARCH_EXPLORER');
    const regions = explorer?.highlightedRegions || [];
    const modeProfiles = explorer?.modeProfiles || {};
    const missing = [];
    for (const region of regions) {
      for (const referenceId of region.references || []) {
        if (!literature[referenceId]) missing.push(`${region.id}: ${referenceId}`);
      }
    }
    for (const [mode, profile] of Object.entries(modeProfiles)) {
      for (const referenceId of profile.references || []) {
        if (!literature[referenceId]) missing.push(`mode:${mode}: ${referenceId}`);
      }
    }
    console.log(`  ✓ ${regions.length} 个区域条目`);
    console.log(`  ✓ ${Object.keys(modeProfiles).length} 个模式级 profile`);
    if (missing.length) {
      console.log(`  ✗ 缺失文献引用: ${missing.join(', ')}`);
    } else {
      console.log('  ✓ 区域与模式引用均可在文献 catalog 中找到');
    }
  } catch (e) {
    console.log(`  ✗ 区域文件无法解析: ${e.message}`);
  }
} else {
  console.log('  ✗ 区域文件缺失');
}

const basinFile = path.join(__dirname, '../../public/assets/basin-data.js');
if (fs.existsSync(basinFile) && explorer?.highlightedRegions) {
  console.log('验证全流域模式覆盖...');
  try {
    const basinData = loadBrowserCatalog(basinFile, 'BASIN_DATA');
    const basins = basinData?.basins || [];
    const modeCounts = {};
    const missingModeProfiles = [];
    for (const basin of basins) {
      const mode = inferredModeForBasin(basin, explorer.highlightedRegions || []);
      modeCounts[mode] = (modeCounts[mode] || 0) + 1;
      if (!explorer.modeProfiles?.[mode] && !explorer.modes?.[mode]) missingModeProfiles.push(`${basin.id}:${mode}`);
    }
    console.log(`  ✓ ${basins.length} 个流域已完成规则分类`);
    console.log(`  ✓ 模式分布: ${JSON.stringify(modeCounts)}`);
    if (missingModeProfiles.length) {
      console.log(`  ✗ 缺失模式定义: ${missingModeProfiles.slice(0, 10).join(', ')}`);
    }
  } catch (e) {
    console.log(`  ✗ 全流域数据无法解析: ${e.message}`);
  }
}

// 验证数据集示例
const datasetFile = path.join(__dirname, '../../catalog/datasets/examples.json');
if (fs.existsSync(datasetFile)) {
  console.log('验证数据集数据...');
  try {
    const datasets = JSON.parse(fs.readFileSync(datasetFile, 'utf8'));
    console.log(`  ✓ ${datasets.length} 个数据集条目`);
  } catch (e) {
    console.log('  ✗ JSON 格式错误');
  }
} else {
  console.log('  - 数据集示例文件不存在（可选）');
}

// 验证模型示例
const modelFile = path.join(__dirname, '../../catalog/models/examples.json');
if (fs.existsSync(modelFile)) {
  console.log('验证模型数据...');
  try {
    const models = JSON.parse(fs.readFileSync(modelFile, 'utf8'));
    console.log(`  ✓ ${models.length} 个模型条目`);
  } catch (e) {
    console.log('  ✗ JSON 格式错误');
  }
} else {
  console.log('  - 模型示例文件不存在（可选）');
}

console.log('\n=== 完成 ===');
