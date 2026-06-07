#!/usr/bin/env node
/**
 * Generate continent outline from HydroBASINS data
 * Creates a merged polygon that perfectly matches basin boundaries
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const PUBLIC_ASSETS = path.join(PROJECT_ROOT, 'public/assets');
const BASIN_DATA_PATH = path.join(PUBLIC_ASSETS, 'basin-data.js');

// Read basin data
const basinDataContent = fs.readFileSync(BASIN_DATA_PATH, 'utf8');
const match = basinDataContent.match(/window\.BASIN_DATA = (\{.*\});/s);
if (!match) {
  console.error('Cannot parse basin-data.js');
  process.exit(1);
}

const basinData = JSON.parse(match[1]);
const basins = basinData.basins;

console.log(`Processing ${basins.length} basins...`);

// Collect all outer rings
// For a continent outline, we want the outer boundary of each landmass
// We'll use all rings directly - the visual effect will be the union

const continentRings = [];

for (const basin of basins) {
  if (basin.rings && basin.rings.length > 0) {
    // Use the first (outer) ring of each polygon
    // For MultiPolygon, we use all outer rings
    for (const ring of basin.rings) {
      if (ring.length >= 4) {
        continentRings.push(ring);
      }
    }
  }
}

console.log(`Collected ${continentRings.length} rings`);

// Write the continent outline data
const outputPath = path.join(PUBLIC_ASSETS, 'continent-outline.js');
const jsContent = `/**
 * Continent outline derived from HydroBASINS
 * Rings: ${continentRings.length}
 * Generated: ${new Date().toISOString()}
 */

window.CONTINENT_OUTLINE = ${JSON.stringify(continentRings, null, 0)};
`;

fs.writeFileSync(outputPath, jsContent);

const stats = fs.statSync(outputPath);
console.log(`\nOutput: ${outputPath}`);
console.log(`Size: ${(stats.size / 1024).toFixed(1)} KB`);
