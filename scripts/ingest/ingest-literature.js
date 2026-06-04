#!/usr/bin/env node
/**
 * 文献元数据导入脚本
 * 从外部 API（如 OpenAlex）获取文献元数据
 */

const https = require('https');

/**
 * 从 OpenAlex 获取文献元数据
 * @param {string} doi - DOI 标识符
 */
async function fetchFromOpenAlex(doi) {
  const url = `https://api.openalex.org/works/doi:${doi}`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            resolve({
              id: json.id,
              title: json.title,
              authors: json.authorships?.map(a => a.author.display_name).join(', '),
              year: json.publication_year?.toString(),
              venue: json.primary_location?.source?.display_name,
              doi: json.doi,
              abstract: json.abstract
            });
          } catch (e) {
            reject(new Error('JSON 解析失败'));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * 将获取的元数据转换为 catalog 格式
 */
function convertToCatalogFormat(metadata) {
  const id = metadata.doi?.split('/')[1]?.split('.')[0] ||
             metadata.title?.toLowerCase().replace(/\s+/g, '-').substring(0, 20);

  return {
    id: id,
    title: metadata.title,
    authors: metadata.authors,
    year: metadata.year,
    venue: metadata.venue,
    doi: metadata.doi?.replace('https://doi.org/', ''),
    abstract: metadata.abstract
  };
}

// 示例用法
console.log('=== 文献导入脚本 ===\n');
console.log('用法: node ingest-literature.js <doi>');
console.log('示例: node ingest-literature.js 10.1073/pnas.1200311109\n');

// 导出函数供其他模块使用
module.exports = { fetchFromOpenAlex, convertToCatalogFormat };