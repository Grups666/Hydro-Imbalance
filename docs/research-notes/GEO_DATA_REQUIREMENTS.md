# 水文领域 Demo 地理数据清单

本文档列出完成水文领域 Demo 所需的边界图和底图数据，包括下载来源、格式说明和使用建议。

## 1. 核心数据需求

根据白皮书和 MVP 计划，水文领域 Demo 需要以下地理数据：

| 数据类型 | 用途 | 优先级 | 推荐来源 |
|----------|------|--------|----------|
| 流域边界 | 核心空间对象、点击交互 | P0 | HydroBASINS |
| 陆地轮廓 | 地图底图 | P0 | Natural Earth |
| 国界边界 | 参考边界、跨境流域 | P1 | Natural Earth |
| 河流线 | 水系可视化 | P1 | HydroRIVERS |
| 湖泊水库 | 水体可视化 | P1 | HydroLAKES |
| 海洋背景 | 地图底图 | P0 | Natural Earth |
| 地形海拔 | 地形底图（可选） | P2 | SRTM |
| 含水层边界 | 地下水研究（可选） | P2 | WHYMAP |

---

## 2. 数据源详解

### 2.1 HydroBASINS - 全球流域边界

**来源**: [HydroSHEDS](https://www.hydrosheds.org/products/hydrobasins)

**特点**:
- 基于 SRTM DEM 衍生的全球流域边界
- 提供 12 级精度（level 1-12）
- Level 4 约 2000 个流域，适合全球浏览
- Level 6-8 适合区域研究

**下载链接**:
```
# 全球 Level 4 (推荐用于 Demo)
https://www.hydrosheds.org/downloads/hydrobasins/standard/HydroBASINS_v1c_level4.zip

# 分区域下载（更高精度）
https://www.hydrosheds.org/downloads/hydrobasins/standard/HydroBASINS_v1c_level6_as.zip  # 亚洲
https://www.hydrosheds.org/downloads/hydrobasins/standard/HydroBASINS_v1c_level6_eu.zip  # 欧洲
https://www.hydrosheds.org/downloads/hydrobasins/standard/HydroBASINS_v1c_level6_na.zip  # 北美
https://www.hydrosheds.org/downloads/hydrobasins/standard/HydroBASINS_v1c_level6_af.zip  # 非洲
https://www.hydrosheds.org/downloads/hydrobasins/standard/HydroBASINS_v1c_level6_sa.zip  # 南美
https://www.hydrosheds.org/downloads/hydrobasins/standard/HydroBASINS_v1c_level6_au.zip  # 澳洲
```

**格式**: Shapefile (.shp)

**关键字段**:
- `HYBAS_ID`: 流域唯一标识
- `NEXT_DOWN`: 下游流域 ID
- `NEXT_UP`: 上游流域 ID
- `MAIN_BAS`: 主流域 ID
- `SUB_AREA`: 流域面积 (km²)
- `PFAF_ID`: Pfafstetter 编码

---

### 2.2 Natural Earth - 陆地与国界

**来源**: [Natural Earth](https://www.naturalearthdata.com/downloads/)

**特点**:
- 三种精度：10m（高）、50m（中）、110m（低）
- 50m 精度适合全球 Demo
- 公共领域，无版权限制

**下载链接**:
```
# 50m 陆地轮廓
https://naciscdn.org/naturalearth/50m/physical/ne_50m_land.zip

# 50m 海洋
https://naciscdn.org/naturalearth/50m/physical/ne_50m_ocean.zip

# 50m 国界
https://naciscdn.org/naturalearth/50m/cultural/ne_50m_admin_0_countries.zip

# 50m 海岸线
https://naciscdn.org/naturalearth/50m/physical/ne_50m_coastline.zip

# 50m 河流（简化版）
https://naciscdn.org/naturalearth/50m/physical/ne_50m_rivers_lake_centerlines.zip

# 50m 湖泊
https://naciscdn.org/naturalearth/50m/physical/ne_50m_lakes.zip
```

**格式**: Shapefile (.shp)

---

### 2.3 HydroRIVERS - 全球河流网络

**来源**: [HydroSHEDS](https://www.hydrosheds.org/products/hydrorivers)

**特点**:
- 全球河流线状网络
- 分等级表示河流大小

**下载链接**:
```
https://www.hydrosheds.org/downloads/hydrorivers/HydroRIVERS_v10.zip
```

**格式**: Shapefile (.shp)

---

### 2.4 HydroLAKES - 全球湖泊水库

**来源**: [HydroSHEDS](https://www.hydrosheds.org/products/hydrolakes)

**特点**:
- 全球湖泊和水库数据
- 包含面积、深度、类型等信息

**下载链接**:
```
https://www.hydrosheds.org/downloads/hydrolakes/HydroLAKES_v10.zip
```

**格式**: Shapefile (.shp)

---

### 2.5 WHYMAP - 含水层边界

**来源**: [WHYMAP - World-wide Hydrogeological Mapping and Assessment Programme](https://www.whymap.org)

**特点**:
- 全球主要含水层边界
- 地下水系统分类

**下载链接**:
```
https://www.whymap.org/whymap_data/WHYMAP_Groundwater_Resources_of_the_World_2008.zip
```

---

### 2.6 SRTM - 地形海拔

**来源**: [NASA SRTM](https://earthdata.nasa.gov/data/nasa-gsfc-product-files/srtm)

**特点**:
- 全球地形海拔数据
- 30m 或 90m 分辨率

**替代方案**:
- GMTED2010 (全球多分辨率地形): https://topotools.cr.usgs.gov/gmted_viewer/
- GEBCO (海洋+陆地): https://www.gebco.net/data_and_products/gridded_bathymetry_data/

---

## 3. 数据下载脚本

使用 `scripts/setup/download-geo-data.js` 自动下载核心数据：

```bash
node scripts/setup/download-geo-data.js
```

该脚本会下载：
1. HydroBASINS Level 4（全球流域）
2. Natural Earth 50m 陆地、海洋、国界

---

## 4. 数据处理流程

### 4.1 Shapefile → GeoJSON

使用 ogr2ogr 或 QGIS 转换：

```bash
# 安装 ogr2ogr (GDAL)
# Windows: https://trac.osgeo.org/gdal/wiki/DownloadingGdalBinaries

# 转换 Shapefile 到 GeoJSON
ogr2ogr -f GeoJSON output.geojson input.shp

# 简化几何（减少文件大小）
ogr2ogr -f GeoJSON -simplify 0.01 output_simplified.geojson input.shp
```

### 4.2 GeoJSON → JavaScript

为前端使用，将 GeoJSON 转换为 JS 文件：

```javascript
// world-land.js
window.WORLD_LAND = {
  type: "FeatureCollection",
  features: [...]
};
```

---

## 5. 推荐文件结构

```
public/assets/
├─ world-land.js            # 陆地轮廓 (Natural Earth 50m)
├─ world-ocean.js           # 海洋背景
├─ world-countries.js       # 国界边界
├─ hydrobasins-level4.js    # 流域边界 (HydroBASINS)
├─ hydrobasins-level6-as.js # 亚洲高精度流域
├─ hydrorivers.js           # 河流线
├─ hydrolakes.js            # 湖泊水库
└─ whymap-aquifers.js       # 含水层边界（可选）

data/raw/                   # 原始 Shapefile（不提交到 Git）
├─ HydroBASINS_v1c_level4/
├─ ne_50m_land/
├─ ne_50m_ocean/
├─ ne_50m_admin_0_countries/
└─ ...
```

---

## 6. 数据体积估算

| 数据 | 原始大小 | 简化后 GeoJSON | JS 格式 |
|------|----------|----------------|---------|
| HydroBASINS Level 4 | ~15 MB | ~5 MB | ~3 MB |
| Natural Earth Land 50m | ~4 MB | ~1 MB | ~500 KB |
| Natural Earth Ocean 50m | ~3 MB | ~1 MB | ~400 KB |
| Natural Earth Countries | ~10 MB | ~4 MB | ~2 MB |
| HydroRIVERS | ~50 MB | ~15 MB | ~10 MB |
| HydroLAKES | ~20 MB | ~8 MB | ~5 MB |

**建议**:
- 简化几何减少体积
- 大文件（HydroRIVERS、HydroLAKES）可按区域裁剪
- 原始 Shapefile 不提交到 Git

---

## 7. 使用建议

### 7.1 全球浏览

使用 Level 4 流域 + 50m Natural Earth：
- 流域数量适中（~2000）
- 渲染性能好
- 足够识别主要水文区域

### 7.2 区域聚焦

当用户选择特定区域后：
- 动态加载 Level 6/8 高精度流域
- 加载 HydroRIVERS 河流线
- 加载 HydroLAKES 水体

### 7.3 点击交互

流域匹配策略：
```javascript
// 简化匹配：点是否在流域边界内
function findBasin(lon, lat, basins) {
  for (const basin of basins.features) {
    if (pointInPolygon([lon, lat], basin.geometry)) {
      return basin;
    }
  }
  return null;
}
```

---

## 8. 数据更新

- HydroBASINS: v1c (2014)，暂无更新计划
- Natural Earth: 定期更新，建议每年检查
- HydroRIVERS/HydroLAKES: v10 (2019)

---

## 9. 许可与引用

### HydroSHEDS 数据
```
HydroSHEDS data © WWF/USGS. Use and distribution of the data is permitted
with proper citation: Lehner, B., Grill, G. (2013): HydroSHEDS...
```

### Natural Earth 数据
```
Natural Earth data is in the public domain. No citation required,
but appreciated: Natural Earth. Free vector and raster map data.
```

---

## 10. 相关资源

- [HydroSHEDS 官网](https://www.hydrosheds.org)
- [Natural Earth 官网](https://www.naturalearthdata.com)
- [WHYMAP 官网](https://www.whymap.org)
- [USGS Earth Explorer](https://earthexplorer.usgs.gov)
- [FAO GeoNetwork](http://www.fao.org/geonetwork)