# 地理数据处理指南

本文档说明如何从原始 Shapefile 到前端可用 JS 格式的完整处理流程。

## 前置要求

### 安装 GDAL/ogr2ogr

**Windows**:
1. 下载 GDAL: https://trac.osgeo.org/gdal/wiki/DownloadingGdalBinaries
2. 或使用 OSGeo4W: https://trac.osgeo.org/osgeo4w/
3. 添加到 PATH 环境变量

**macOS**:
```bash
brew install gdal
```

**Linux (Ubuntu/Debian)**:
```bash
sudo apt-get install gdal-bin
```

验证安装:
```bash
ogr2ogr --version
```

---

## 处理流程

### 步骤 1: 下载数据

```bash
node scripts/setup/download-geo-data.js
```

或手动下载：
- HydroBASINS: https://www.hydrosheds.org/products/hydrobasins
- Natural Earth: https://www.naturalearthdata.com/downloads/

### 步骤 2: 解压文件

```bash
# Windows (PowerShell)
Expand-Archive -Path data/raw/HydroBASINS_v1c_level4.zip -DestinationPath data/raw/HydroBASINS_v1c_level4

# Linux/macOS
unzip data/raw/HydroBASINS_v1c_level4.zip -d data/raw/HydroBASINS_v1c_level4
```

### 步骤 3: 转换 Shapefile 到 GeoJSON

```bash
# 基础转换
ogr2ogr -f GeoJSON data/processed/hydrobasins_level4.geojson data/raw/HydroBASINS_v1c_level4/HydroBASINS_v1c_level4.shp

# 简化几何（减少文件大小）
ogr2ogr -f GeoJSON -simplify 0.01 data/processed/hydrobasins_level4_simple.geojson data/raw/HydroBASINS_v1c_level4/HydroBASINS_v1c_level4.shp
```

### 步骤 4: 转换 GeoJSON 到 JS

```bash
node scripts/setup/geojson-to-js.js data/processed/hydrobasins_level4.geojson HYDROBASINS_LEVEL4
```

### 步骤 5: 验证

在浏览器中打开 `public/index.html`，检查控制台是否加载成功：
```javascript
console.log(window.HYDROBASINS_LEVEL4);
```

---

## 各数据集处理命令

### Natural Earth Land 50m

```bash
# 解压
unzip data/raw/ne_50m_land.zip -d data/raw/ne_50m_land

# 转换
ogr2ogr -f GeoJSON -simplify 0.01 data/processed/ne_50m_land.geojson data/raw/ne_50m_land/ne_50m_land.shp

# 转 JS
node scripts/setup/geojson-to-js.js data/processed/ne_50m_land.geojson WORLD_LAND
```

### Natural Earth Ocean 50m

```bash
unzip data/raw/ne_50m_ocean.zip -d data/raw/ne_50m_ocean
ogr2ogr -f GeoJSON -simplify 0.01 data/processed/ne_50m_ocean.geojson data/raw/ne_50m_ocean/ne_50m_ocean.shp
node scripts/setup/geojson-to-js.js data/processed/ne_50m_ocean.geojson WORLD_OCEAN
```

### Natural Earth Countries 50m

```bash
unzip data/raw/ne_50m_countries.zip -d data/raw/ne_50m_countries
ogr2ogr -f GeoJSON -simplify 0.02 data/processed/ne_50m_countries.geojson data/raw/ne_50m_countries/ne_50m_admin_0_countries.shp
node scripts/setup/geojson-to-js.js data/processed/ne_50m_countries.geojson WORLD_COUNTRIES
```

### HydroBASINS Level 4

```bash
unzip data/raw/HydroBASINS_v1c_level4.zip -d data/raw/HydroBASINS_v1c_level4
ogr2ogr -f GeoJSON -simplify 0.02 data/processed/hydrobasins_level4.geojson data/raw/HydroBASINS_v1c_level4/HydroBASINS_v1c_level4.shp
node scripts/setup/geojson-to-js.js data/processed/hydrobasins_level4.geojson HYDROBASINS_LEVEL4
```

---

## 简化参数说明

`-simplify` 参数控制几何简化程度：

| 参数值 | 效果 | 适用场景 |
|--------|------|----------|
| 无 | 保留原始精度 | 需要精确边界 |
| 0.005 | 轻微简化 | 区域分析 |
| 0.01 | 中等简化 | 全球浏览 |
| 0.02 | 较大简化 | 性能优先 |
| 0.05 | 大幅简化 | 快速预览 |

单位：度（约 1 度 ≈ 111 km）

---

## 区域裁剪

如果只需要特定区域的数据：

```bash
# 裁剪亚洲区域
ogr2ogr -f GeoJSON -clipsrc 60 0 150 60 data/processed/hydrobasins_asia.geojson data/raw/hydrobasins.shp

# 裁剪中国区域
ogr2ogr -f GeoJSON -clipsrc 73 18 135 54 data/processed/hydrobasins_china.geojson data/raw/hydrobasins.shp
```

参数格式：`-clipsrc <min_lon> <min_lat> <max_lon> <max_lat>`

---

## 文件大小优化

### 1. 简化几何
使用 `-simplify` 参数

### 2. 选择字段
只保留需要的字段：

```bash
ogr2ogr -f GeoJSON -select "HYBAS_ID,NAME,SUB_AREA" output.geojson input.shp
```

### 3. GeoJSON 压缩
转换为 TopoJSON（更小）：

```bash
# 安装 topojson
npm install -g topojson

# 转换
topojson -o output.topo.json input.geojson
```

---

## 批量处理脚本

创建 `scripts/setup/process-all-geo-data.sh`：

```bash
#!/bin/bash

# 处理所有 Natural Earth 数据
for file in data/raw/ne_50m_*.zip; do
  name=$(basename "$file" .zip)
  unzip -o "$file" -d "data/raw/$name"
  ogr2ogr -f GeoJSON -simplify 0.01 "data/processed/${name}.geojson" "data/raw/${name}/${name}.shp"
done

# 处理 HydroBASINS
unzip -o data/raw/HydroBASINS_v1c_level4.zip -d data/raw/HydroBASINS_v1c_level4
ogr2ogr -f GeoJSON -simplify 0.02 data/processed/hydrobasins_level4.geojson data/raw/HydroBASINS_v1c_level4/HydroBASINS_v1c_level4.shp

echo "处理完成"
```

---

## 常见问题

### Q: ogr2ogr 报错 "Unable to open datasource"

检查文件路径和格式是否正确。

### Q: 输出文件太大

1. 使用 `-simplify` 参数
2. 使用 `-select` 只保留必要字段
3. 考虑按区域裁剪

### Q: 前端加载慢

1. 减少几何精度
2. 使用异步加载
3. 考虑瓦片化方案

---

## 目录结构

处理完成后的目录结构：

```
data/
├─ raw/                        # 原始数据（不提交）
│  ├─ HydroBASINS_v1c_level4/
│  ├─ ne_50m_land/
│  └─ ...
├─ processed/                  # 处理后 GeoJSON（可选提交）
│  ├─ hydrobasins_level4.geojson
│  ├─ ne_50m_land.geojson
│  └─ ...
└─ README.md

public/assets/
├─ world-land.js               # 陆地轮廓
├─ world-ocean.js              # 海洋
├─ world-countries.js          # 国界
├─ hydrobasins-level4.js       # 流域边界
└─ ...
```