#!/usr/bin/env node
/**
 * Process Natural Earth 50m land data for frontend rendering
 * Extracts polygon coordinates from shapefile
 */

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const BASEMAPS_DIR = path.join(PROJECT_ROOT, 'data/basemaps');
const PUBLIC_ASSETS = path.join(PROJECT_ROOT, 'public/assets');

function parseShp(buffer) {
  const parts = [];
  let offset = 100;

  while (offset + 8 < buffer.length) {
    const contentWords = buffer.readInt32BE(offset + 4);
    const contentBytes = contentWords * 2;
    offset += 8;

    const record = buffer.slice(offset, offset + contentBytes);
    offset += contentBytes;

    if (record.length < 44) continue;

    const shapeType = record.readInt32LE(0);
    if (shapeType !== 5 && shapeType !== 15 && shapeType !== 25) continue;

    const numParts = record.readInt32LE(36);
    const numPoints = record.readInt32LE(40);

    const partIndices = [];
    for (let i = 0; i < numParts; i++) {
      partIndices.push(record.readInt32LE(44 + i * 4));
    }
    partIndices.push(numPoints);

    const pointStart = 44 + numParts * 4;
    for (let i = 0; i < numParts; i++) {
      const start = partIndices[i];
      const end = partIndices[i + 1];
      if (end - start < 3) continue;

      const ring = [];
      for (let j = start; j < end; j++) {
        const x = buffer.readDoubleLE(buffer.length - record.length + pointStart + j * 16);
        const y = buffer.readDoubleLE(buffer.length - record.length + pointStart + j * 16 + 8);
        ring.push([x, y]);
      }
      parts.push(ring);
    }
  }

  return parts;
}

function processShapefile(zipPath, outputPath, name) {
  console.log(`Processing ${zipPath}...`);

  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  const shpEntry = entries.find(e => e.entryName.toLowerCase().endsWith('.shp'));
  if (!shpEntry) {
    console.error('No .shp file found in zip');
    return;
  }

  const shpBuffer = shpEntry.getData();

  // Parse manually - simplified approach
  // Natural Earth shapefiles can be complex, use a different approach
  const parts = [];

  // Read as raw binary and extract coordinates
  let offset = 100;
  while (offset + 12 < shpBuffer.length) {
    const recordNumber = shpBuffer.readInt32BE(offset);
    const contentLength = shpBuffer.readInt32BE(offset + 4) * 2;
    offset += 8;

    if (offset + contentLength > shpBuffer.length) break;

    const record = shpBuffer.slice(offset, offset + contentLength);

    if (record.length >= 44) {
      const shapeType = record.readInt32LE(0);

      if (shapeType === 5 || shapeType === 15 || shapeType === 25) { // Polygon
        const numParts = record.readInt32LE(36);
        const numPoints = record.readInt32LE(40);

        if (numPoints > 0 && numParts > 0) {
          const partIndices = [];
          for (let i = 0; i < numParts; i++) {
            partIndices.push(record.readInt32LE(44 + i * 4));
          }
          partIndices.push(numPoints);

          const pointStart = 44 + numParts * 4;

          for (let p = 0; p < numParts; p++) {
            const startIdx = partIndices[p];
            const endIdx = partIndices[p + 1];

            if (endIdx - startIdx < 3) continue;

            const ring = [];
            for (let i = startIdx; i < endIdx; i++) {
              const x = record.readDoubleLE(pointStart + i * 16);
              const y = record.readDoubleLE(pointStart + i * 16 + 8);
              ring.push([parseFloat(x.toFixed(4)), parseFloat(y.toFixed(4))]);
            }
            parts.push(ring);
          }
        }
      }
    }

    offset += contentLength;
  }

  console.log(`Extracted ${parts.length} polygon parts`);

  // Write JS file
  const jsContent = `/**
 * ${name} - from Natural Earth 50m
 * Parts: ${parts.length}
 * Generated: ${new Date().toISOString()}
 */

window.${name.toUpperCase().replace(/\s+/g, '_')} = ${JSON.stringify(parts)};
`;

  fs.writeFileSync(outputPath, jsContent);

  const stats = fs.statSync(outputPath);
  console.log(`Output: ${outputPath}`);
  console.log(`Size: ${(stats.size / 1024).toFixed(1)} KB`);
}

// Process land
const landZip = path.join(BASEMAPS_DIR, 'ne_50m_land.zip');
const landOutput = path.join(PUBLIC_ASSETS, 'land-50m.js');

if (fs.existsSync(landZip)) {
  processShapefile(landZip, landOutput, 'LAND_50M');
} else {
  console.log('Land zip not found, please download Natural Earth data');
}
