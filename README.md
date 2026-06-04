# Spatial Research Operating System

**从地图出发的科研知识探索系统**

Spatial Research OS 是一套以地理空间为统一索引的科研基础设施。它将文献、数据、模型与科研写作重新组织到同一个空间交互界面中，使研究者可以从"选择一个区域"开始，自动获得该区域相关的科学知识、可用数据和研究上下文。

## 功能特性

- 🗺️ **地图原生交互**：全屏世界地图，点击流域建立研究上下文
- 📚 **文献聚合**：自动关联区域相关文献，支持详情查看和 PDF 访问
- 🤖 **AI 辅助综述**：基于区域上下文生成可追溯引用的研究综述
- 🌊 **水文模式分类**：7 种水文循环模式，帮助理解区域特征
- 🔗 **数据入口**：关联数据集元数据和下载链接（规划中）
- 📄 **报告导出**：支持 Markdown/PDF 导出（规划中）

## 快速开始

### 环境要求

- Node.js 18+
- 现代浏览器（Chrome、Firefox、Safari、Edge）

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/your-org/Spatial_Research_Operating_System.git
cd Spatial_Research_Operating_System

# 初始化环境
node scripts/setup/init.js

# 启动服务
node src/server/server.js

# 访问
# http://127.0.0.1:8791
```

### 配置 AI 模型

系统支持 Anthropic Messages API 兼容的模型服务。

**方式一：环境变量**

```bash
export ANTHROPIC_API_KEY="your-api-key"
export ANTHROPIC_BASE_URL="https://api.example.com"
export ANTHROPIC_MODEL="glm-5.1"
node src/server/server.js
```

**方式二：配置文件**

复制 `config/atlas.local.example.json` 为 `config/atlas.local.json`：

```json
{
  "ANTHROPIC_API_KEY": "your-api-key",
  "ANTHROPIC_BASE_URL": "https://api.example.com",
  "ANTHROPIC_MODEL": "glm-5.1"
}
```

无 API 配置时，系统将返回离线示例综述。

## 目录结构

```
Spatial_Research_Operating_System/
├─ README.md                 # 项目入口文档
├─ ROADMAP.md                # 版本路线图
├─ CHANGELOG.md              # 变更日志
├─ docs/
│  ├─ WHITEPAPER.md          # 白皮书（长期愿景）
│  ├─ ARCHITECTURE.md        # 技术架构
│  ├─ MVP_PLAN.md            # MVP 计划
│  ├─ PRODUCT_SPEC.md        # 产品规格
│  └─ research-notes/        # 研究笔记
├─ public/                   # 前端静态文件
│  ├─ index.html
│  ├─ app.js
│  ├─ styles.css
│  └─ assets/
├─ src/
│  ├─ server/                # 服务端代码
│  ├─ data/                  # 示例数据
│  ├─ services/              # 服务模块
│  └─ schemas/               # 数据 schema
├─ catalog/                  # 知识库目录
│  ├─ literature/            # 文献元数据
│  ├─ regions/               # 区域知识包
│  ├─ datasets/              # 数据集元数据
│  └─ models/                # 模型元数据
├─ scripts/                  # 脚本工具
│  ├─ setup/                 # 初始化脚本
│  ├─ ingest/                # 数据导入
│  ├─ validate/              # 数据验证
│  ├─ export/                # 报告导出
│  └─ maintenance/           # 维护脚本
├─ examples/                 # 示例文件
│  ├─ hydrology-demo/
│  └─ reports/
├─ config/                   # 配置文件
│  ├─ atlas.local.example.json
│  └─ atlas.local.json       # 本地配置（不提交）
└─ tests/                    # 测试文件
```

## 已配置流域

当前版本内置 11 个重点水文区域：

| 区域 | 水文模式 | 核心特征 |
|------|----------|----------|
| High Plains / Ogallala | 干旱区灌溉 | 地下水支撑的半干旱农业灌溉 |
| California Central Valley | 干旱区灌溉 | 地表水短缺下的地下水替代抽采 |
| Indus / Northwest India | 干旱区灌溉 | 灌溉抽采驱动的地下水亏损 |
| Ganges-Brahmaputra Plain | 季风洪泛 | 季风补给抵消的洪泛平原系统 |
| North China Plain | 治理恢复 | 强人类干预下的治理恢复系统 |
| Yellow River Basin | 水库调节 | 人类调控主导的径流特征变化 |
| Tigris-Euphrates | 干旱区灌溉 | 干旱区抽采与水库压力叠加 |
| Aral Sea | 水库调节 | 端流湖泊引水与灌溉损失 |
| Lower Mekong | 水库调节 | 水电调度改变洪泛脉冲 |
| Nile Basin | 水库调节 | 大型水库与跨境分配控制 |
| Murray-Darling Basin | 水库调节 | 干旱河流管理与生态流量调控 |

## 版本历史

- **v0.1.0** (2025-05): 地图 + 流域点击 + 本地文献 + AI 综述

详见 [CHANGELOG.md](CHANGELOG.md)

## 开发路线

详见 [ROADMAP.md](ROADMAP.md)

- v0.2: 数据入口 catalog
- v0.3: AI 区域综述增强
- v0.4: 报告导出
- v0.5: OpenAlex / Crossref 文献接入
- v1.0: Hydrology-first Spatial Research OS

## 技术架构

详见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

- 前端：纯 JavaScript + Canvas 2D（无框架依赖）
- 后端：Node.js + Express
- 数据：JSON/JS 文件存储（未来可迁移至数据库）
- AI：Anthropic Messages API 兼容接口

## 知识库贡献

### 添加新流域

编辑 `catalog/regions/basin-profiles.js`，添加流域档案：

```javascript
{
  id: "new-basin",
  name: "New Basin Name",
  match: { lon: [min, max], lat: [min, max] },
  mode: "dryIrrigation",
  label: "模式描述",
  summary: "研究摘要...",
  cycle: ["特征1", "特征2"],
  pattern: ["格局1", "格局2"],
  references: ["ref-id-1", "ref-id-2"]
}
```

### 添加新文献

编辑 `catalog/literature/reference-catalog.js`，添加文献元数据：

```javascript
{
  id: "author2024",
  title: "Paper Title",
  authors: "Author, A., et al.",
  year: "2024",
  venue: "Journal Name",
  doi: "10.xxxx/xxxx",
  abstract: "摘要内容..."
}
```

## 许可证

MIT License

## 引用

如果本项目对您的研究有帮助，请引用：

```bibtex
@software{spatial_research_os_2025,
  title = {Spatial Research Operating System},
  author = {Your Name},
  year = {2025},
  url = {https://github.com/your-org/Spatial_Research_Operating_System}
}
```

## 联系与反馈

- 问题反馈：GitHub Issues
- 邮件：your-email@example.com