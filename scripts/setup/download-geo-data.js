#!/usr/bin/env node
/**
 * 地理数据下载脚本
 * 下载水文领域 Demo 所需的核心地理数据
 *
 * 数据来源：
 * - HydroBASINS (HydroSHEDS)
 * - Natural Earth
 *
 * 使用方法：
 * node scripts/setup/download-geo-data.js
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 配置
const DATA_DIR = path.join(__dirname, '../../data/raw');
const ASSETS_DIR = path.join(__dirname, '../../public/assets');

// 数据源定义
const DATA_SOURCES = [
  {
    name: 'HydroBASINS Level 4',
    description: '全球流域边界 (约 2000 个流域)',
    url: 'https://data.hydrosheds.org/file/HydroBASINS/standard/HydroBASINS_v1c_level4.zip',
    filename: 'HydroBASINS_v1c_level4.zip',
    priority: 'P0',
    required: true
  },
  {
    name: 'Natural Earth Land 50m',
    description: '陆地轮廓',
    url: 'https://naciscdn.org/naturalearth/50m/physical/ne_50m_land.zip',
    filename: 'ne_50m_land.zip',
    priority: 'P0',
    required: true
  },
  {
    name: 'Natural Earth Ocean 50m',
    description: '海洋背景',
    url: 'https://naciscdn.org/naturalearth/50m/physical/ne_50m_ocean.zip',
    filename: 'ne_50m_ocean.zip',
    priority: 'P0',
    required: true
  },
  {
    name: 'Natural Earth Countries 50m',
    description: '国界边界',
    url: 'https://naciscdn.org/naturalearth/50m/cultural/ne_50m_admin_0_countries.zip',
    filename: 'ne_50m_countries.zip',
    priority: 'P1',
    required: false
  },
  {
    name: 'Natural Earth Rivers 50m',
    description: '河流线',
    url: 'https://naciscdn.org/naturalearth/50m/physical/ne_50m_rivers_lake_centerlines.zip',
    filename: 'ne_50m_rivers.zip',
    priority: 'P1',
    required: false
  },
  {
    name: 'Natural Earth Lakes 50m',
    description: '湖泊',
    url: 'https://naciscdn.org/naturalearth/50m/physical/ne_50m_lakes.zip',
    filename: 'ne_50m_lakes.zip',
    priority: 'P1',
    required: false
  }
];

// 创建目录
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`创建目录: ${dir}`);
  }
}

// 下载文件
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    console.log(`下载中: ${url}`);
    const file = fs.createWriteStream(dest);

    protocol.get(url, (response) => {
      // 处理重定向
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        console.log(`重定向到: ${redirectUrl}`);
        downloadFile(redirectUrl, dest).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloaded = 0;

      response.on('data', (chunk) => {
        downloaded += chunk.length;
        const percent = totalSize ? Math.round((downloaded / totalSize) * 100) : 0;
        process.stdout.write(`\r下载进度: ${percent}%`);
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log('\n下载完成');
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

// 解压文件
function unzipFile(zipPath, destDir) {
  const filename = path.basename(zipPath, '.zip');
  const extractDir = path.join(destDir, filename);

  ensureDir(extractDir);

  try {
    // 尝试使用系统 unzip
    if (process.platform === 'win32') {
      execSync(`powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}'"`, { stdio: 'inherit' });
    } else {
      execSync(`unzip -o "${zipPath}" -d "${extractDir}"`, { stdio: 'inherit' });
    }
    console.log(`解压完成: ${extractDir}`);
    return extractDir;
  } catch (e) {
    console.log('解压失败，请手动解压:', zipPath);
    console.log('建议使用 7-Zip 或其他解压工具');
    return null;
  }
}

// 主函数
async function main() {
  console.log('=== Spatial Research OS 地理数据下载 ===\n');

  ensureDir(DATA_DIR);
  ensureDir(ASSETS_DIR);

  console.log('数据下载列表:\n');
  DATA_SOURCES.forEach((source, i) => {
    console.log(`${i + 1}. [${source.priority}] ${source.name}`);
    console.log(`   ${source.description}`);
    console.log(`   URL: ${source.url}`);
    console.log('');
  });

  console.log('开始下载...\n');

  const results = [];

  for (const source of DATA_SOURCES) {
    const destPath = path.join(DATA_DIR, source.filename);

    // 检查是否已下载
    if (fs.existsSync(destPath)) {
      console.log(`\n已存在: ${source.filename}`);
      console.log('跳过下载 (如需重新下载，请删除现有文件)');
      results.push({ ...source, status: 'skipped', path: destPath });
      continue;
    }

    try {
      await downloadFile(source.url, destPath);
      results.push({ ...source, status: 'downloaded', path: destPath });
    } catch (err) {
      console.error(`\n下载失败: ${source.name}`);
      console.error(`错误: ${err.message}`);
      results.push({ ...source, status: 'failed', error: err.message });
    }
  }

  console.log('\n=== 下载结果 ===\n');

  let success = 0;
  let failed = 0;
  let skipped = 0;

  results.forEach(r => {
    const icon = r.status === 'downloaded' ? '✓' :
                 r.status === 'skipped' ? '-' : '✗';
    console.log(`${icon} ${r.name}: ${r.status}`);
    if (r.status === 'downloaded') success++;
    else if (r.status === 'skipped') skipped++;
    else failed++;
  });

  console.log(`\n成功: ${success}, 跳过: ${skipped}, 失败: ${failed}`);

  // 提示下一步
  console.log('\n=== 下一步操作 ===\n');
  console.log('1. 解压下载的 ZIP 文件到 data/raw/ 目录');
  console.log('2. 使用 ogr2ogr 转换 Shapefile 为 GeoJSON:');
  console.log('   ogr2ogr -f GeoJSON output.geojson input.shp');
  console.log('3. 将 GeoJSON 转换为 JS 格式用于前端:');
  console.log('   参考现有的 public/assets/world-land.js');
  console.log('\n详细说明见: docs/research-notes/GEO_DATA_REQUIREMENTS.md');
}

main().catch(console.error);