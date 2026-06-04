# 更新日志

本文件记录 Spatial Research Operating System 的版本更新历史。

格式基于 [Keep a Changelog](https://keepachangelog.com/)。

---

## [Unreleased]

### Added
- ROADMAP.md 版本路线图
- CHANGELOG.md 变更日志
- docs/ARCHITECTURE.md 技术架构文档
- docs/MVP_PLAN.md MVP 计划文档
- docs/PRODUCT_SPEC.md 产品规格文档
- docs/research-notes/ 研究笔记目录
- catalog/ 结构化目录（literature, regions, datasets, models）
- scripts/ 脚本目录（ingest, validate, export, setup, maintenance）
- examples/ 示例目录（hydrology-demo, reports）
- tests/ 测试目录
- config/ 配置目录及示例文件

---

## [0.1.0] - 2025-05-23

### Added
- 全屏世界地图界面，基于 Natural Earth 50m 陆地轮廓
- HydroBASINS level-4 全球流域边界数据
- 流域点击交互，显示空间属性和推断水文模式
- 11 个重点水文区域知识包：
  - High Plains / Ogallala
  - California Central Valley
  - Indus / Northwest India
  - Ganges-Brahmaputra Plain
  - North China Plain
  - Yellow River Basin
  - Tigris-Euphrates-Western Iran
  - Aral Sea / Amu Darya-Syr Darya
  - Lower Mekong
  - Nile Basin
  - Murray-Darling Basin
- 本地文献元数据 catalog（12 篇核心水文文献）
- 7 种水文循环模式分类：
  - 积雪与冰川融水补给型
  - 季风洪泛补给型
  - 干旱区灌溉与地下水依赖型
  - 水库调节与季节流量重组型
  - 湿润径流主导型
  - 治理恢复或外源调水缓冲型
  - 混合或弱诊断型
- AI 区域综述生成（支持 Anthropic API 兼容模型）
- 离线 fallback 综述示例
- 参考文献详情弹窗
- 本地 PDF 文件路由
- Web Speech API 语音输入入口
- Node.js 服务端代理（health endpoint, research endpoint）

### Technical
- 纯前端 JavaScript + CSS（无框架依赖）
- Node.js Express 服务端
- 简化的 GeoJSON/JS 文件存储
- 支持 `atlas.local.json` 配置文件

---

## 版本命名规则

- **主版本 (Major)**: 架构重大变化或核心能力升级
- **次版本 (Minor)**: 新功能模块或重要改进
- **修订版本 (Patch)**: Bug 修复、小改进、文档更新

版本号遵循 [语义化版本](https://semver.org/)。