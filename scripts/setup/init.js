#!/usr/bin/env node
/**
 * 环境初始化脚本
 * 用于首次运行项目时检查和配置环境
 */

const fs = require('fs');
const path = require('path');

console.log('=== Spatial Research OS 环境初始化 ===\n');

// 1. 检查 Node.js 版本
const nodeVersion = process.version;
const minVersion = 'v18.0.0';
console.log(`Node.js 版本: ${nodeVersion}`);
if (nodeVersion < minVersion) {
  console.warn(`警告: 推荐 Node.js ${minVersion} 或更高版本`);
}

// 2. 检查配置文件
const configDir = path.join(__dirname, '../../config');
const localConfig = path.join(configDir, 'atlas.local.json');
const exampleConfig = path.join(configDir, 'atlas.local.example.json');

if (!fs.existsSync(localConfig)) {
  console.log('\n配置文件检查: atlas.local.json 不存在');
  if (fs.existsSync(exampleConfig)) {
    console.log('正在从示例文件创建...');
    fs.copyFileSync(exampleConfig, localConfig);
    console.log('已创建 atlas.local.json，请编辑配置 API 参数');
  }
} else {
  console.log('配置文件检查: atlas.local.json 已存在');
}

// 3. 检查目录结构
const requiredDirs = [
  'catalog/literature',
  'catalog/regions',
  'catalog/datasets',
  'catalog/models',
  'docs',
  'public/assets',
  'src/server',
  'tests'
];

console.log('\n目录结构检查:');
for (const dir of requiredDirs) {
  const fullPath = path.join(__dirname, '../../', dir);
  if (fs.existsSync(fullPath)) {
    console.log(`  ✓ ${dir}`);
  } else {
    console.log(`  ✗ ${dir} (缺失)`);
  }
}

// 4. 检查关键文件
const keyFiles = [
  'public/index.html',
  'public/app.js',
  'src/server/server.js',
  'catalog/literature/reference-catalog.js',
  'catalog/regions/basin-profiles.js'
];

console.log('\n关键文件检查:');
for (const file of keyFiles) {
  const fullPath = path.join(__dirname, '../../', file);
  if (fs.existsSync(fullPath)) {
    console.log(`  ✓ ${file}`);
  } else {
    console.log(`  ✗ ${file} (缺失)`);
  }
}

// 5. API 配置提示
console.log('\n=== API 配置 ===');
if (fs.existsSync(localConfig)) {
  try {
    const config = JSON.parse(fs.readFileSync(localConfig, 'utf8'));
    if (config.ANTHROPIC_API_KEY) {
      console.log('API Key: 已配置');
    } else {
      console.log('API Key: 未配置 (将使用离线模式)');
    }
    if (config.ANTHROPIC_BASE_URL) {
      console.log(`API Base URL: ${config.ANTHROPIC_BASE_URL}`);
    }
    if (config.ANTHROPIC_MODEL) {
      console.log(`模型: ${config.ANTHROPIC_MODEL}`);
    }
  } catch (e) {
    console.log('配置文件格式错误，请检查 JSON 格式');
  }
}

console.log('\n=== 完成 ===');
console.log('运行服务: node src/server/server.js');
console.log('访问地址: http://127.0.0.1:8791');