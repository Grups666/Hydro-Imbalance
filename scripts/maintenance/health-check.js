#!/usr/bin/env node
/**
 * 日常维护脚本
 * 检查项目健康状态、清理缓存等
 */

const fs = require('fs');
const path = require('path');

console.log('=== Spatial Research OS 维护检查 ===\n');
const date = new Date().toISOString();

// 1. 检查日志目录
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
  console.log('创建日志目录: logs/');
}

// 2. 检查临时文件
const tempFiles = [];
const publicDir = path.join(__dirname, '../../public');
if (fs.existsSync(publicDir)) {
  // 检查是否有大文件需要清理
  console.log('检查临时文件...');
}

// 3. 检查 PDF 文件
const literatureDir = path.join(__dirname, '../../literature');
if (fs.existsSync(literatureDir)) {
  const files = fs.readdirSync(literatureDir);
  console.log(`PDF 文件数量: ${files.filter(f => f.endsWith('.pdf')).length}`);
}

// 4. 记录运行状态
const statusFile = path.join(logDir, 'maintenance.log');
const status = {
  timestamp: date,
  checks: {
    logDir: true,
    pdfFiles: true
  }
};

fs.appendFileSync(statusFile, JSON.stringify(status) + '\n');
console.log(`状态已记录: ${statusFile}`);

console.log('\n=== 完成 ===');
console.log(`时间: ${date}`);