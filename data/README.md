# 地理数据目录

本目录存放水文领域 Demo 所需的地理数据。

## 目录结构

```
data/
├─ raw/           # 原始数据文件（Shapefile 等）
├─ processed/     # 处理后的 GeoJSON 文件
└─ README.md
```

## 数据来源

详见 [docs/research-notes/GEO_DATA_REQUIREMENTS.md](../docs/research-notes/GEO_DATA_REQUIREMENTS.md)

## 下载命令

```bash
node scripts/setup/download-geo-data.js
```

## 处理流程

详见 [docs/research-notes/GEO_DATA_PROCESSING.md](../docs/research-notes/GEO_DATA_PROCESSING.md)

## 注意事项

- `raw/` 目录存放原始数据，不提交到 Git
- `processed/` 目录存放处理后的 GeoJSON，可根据需要提交
- 最终前端使用的数据在 `public/assets/` 目录