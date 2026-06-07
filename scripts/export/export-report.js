#!/usr/bin/env node
/**
 * 报告导出脚本
 * 将区域研究上下文导出为 Markdown 文档
 */

const fs = require('fs');
const path = require('path');

function generateMarkdownReport(region, references) {
  const date = new Date().toISOString().split('T')[0];

  let md = `# ${region.name} 水文研究综述\n\n`;
  md += `生成时间: ${date}\n\n`;
  md += `---\n\n`;

  md += `## 区域概况\n\n`;
  md += `**水文模式**: ${region.label || region.mode}\n\n`;
  md += `**研究摘要**: ${region.summary || '待补充'}\n\n`;

  if (region.cycle && region.cycle.length > 0) {
    md += `### 水文循环特征\n\n`;
    for (const item of region.cycle) {
      md += `- ${item}\n`;
    }
    md += '\n';
  }

  if (region.pattern && region.pattern.length > 0) {
    md += `### 空间格局\n\n`;
    for (const item of region.pattern) {
      md += `- ${item}\n`;
    }
    md += '\n';
  }

  md += `## 参考文献\n\n`;
  if (references && references.length > 0) {
    for (const ref of references) {
      md += `### ${ref.title}\n\n`;
      md += `- **作者**: ${ref.authors}\n`;
      md += `- **年份**: ${ref.year}\n`;
      md += `- **期刊**: ${ref.venue}\n`;
      if (ref.doi) md += `- **DOI**: [${ref.doi}](https://doi.org/${ref.doi})\n`;
      if (ref.abstract) md += `- **摘要**: ${ref.abstract}\n`;
      md += '\n';
    }
  } else {
    md += '暂无关联文献。\n\n';
  }

  md += `---\n\n`;
  md += `*本报告由 Spatial Research Operating System 生成*\n`;

  return md;
}

// 示例用法
console.log('=== 报告导出脚本 ===\n');
console.log('用法: node export-report.js <region-id>');
console.log('输出: examples/reports/<region-id>-report.md\n');

// 导出函数供其他模块使用
module.exports = { generateMarkdownReport };