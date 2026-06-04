#!/usr/bin/env node
/**
 * GeoJSON 转 JavaScript 脚本
 * 将 GeoJSON 文件转换为前端可用的 JS 格式
 *
 * 使用方法：
 * node scripts/setup/geojson-to-js.js <input.geojson> <output-name>
 *
 * 示例：
 * node scripts/setup/geojson-to-js.js data/hydrobasins.geojson HYDROBASINS_LEVEL4
 */

const fs = require('fs');
const path = require('path');

function geoJsonToJs(inputPath, outputName) {
  // 读取 GeoJSON
  const geojson = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

  // 统计信息
  const featureCount = geojson.features?.length || 0;
  console.log(`读取 ${featureCount} 个要素`);

  // 创建 JS 内容
  const jsContent = `/**
 * ${outputName}
 * 自动生成自 GeoJSON
 * 要素数量: ${featureCount}
 * 生成时间: ${new Date().toISOString()}
 */

window.${outputName} = ${JSON.stringify(geojson, null, 2)};
`;

  // 输出路径
  const outputDir = path.join(__dirname, '../../public/assets');
  const outputPath = path.join(outputDir, `${outputName.toLowerCase()}.js`);

  // 确保目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 写入文件
  fs.writeFileSync(outputPath, jsContent);
  console.log(`输出: ${outputPath}`);

  // 文件大小
  const stats = fs.statSync(outputPath);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  console.log(`文件大小: ${sizeMB} MB`);
}

// 命令行参数
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('使用方法: node geojson-to-js.js <input.geojson> <output-name>');
  console.log('示例: node geojson-to-js.js hydrobasins.geojson HYDROBASINS_LEVEL4');
  process.exit(1);
}

const inputPath = args[0];
const outputName = args[1];

if (!fs.existsSync(inputPath)) {
  console.error(`文件不存在: ${inputPath}`);
  process.exit(1);
}

geoJsonToJs(inputPath, outputName);