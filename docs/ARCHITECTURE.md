# Spatial Research Operating System 技术架构

本文档描述系统的技术架构、组件关系和实现细节。

## 1. 系统概览

Spatial Research OS 是一个以地理空间为索引的科研知识平台。当前原型采用轻量化架构，便于快速迭代验证。

```
┌─────────────────────────────────────────────────────────────┐
│                        用户界面层                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  地图视图   │  │  区域面板   │  │  输入入口   │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                        应用逻辑层                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ 区域匹配   │  │ 文献检索   │  │ 综述生成   │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                        数据与知识层                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  catalog/   │  │  assets/    │  │  config/    │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                        服务接口层                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  AI API     │  │  文件路由   │  │  健康检查   │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

## 2. 前端架构

### 2.1 技术栈

- **无框架**: 纯 JavaScript + CSS，减少依赖复杂度
- **地图渲染**: Canvas 2D API
- **语音输入**: Web Speech API

### 2.2 核心模块

| 文件 | 职责 |
|------|------|
| `public/index.html` | 页面结构、地图容器、面板布局 |
| `public/app.js` | 核心应用逻辑、地图渲染、交互处理 |
| `public/styles.css` | 样式定义、响应式布局 |
| `public/assets/world-land.js` | Natural Earth 陆地轮廓数据 |

### 2.3 数据流

```
用户点击地图 → 坐标转换 → 流域匹配 → 加载区域档案 → 渲染面板
                                    ↓
                              关联文献 ← 查询 reference-catalog
                                    ↓
                              AI 综述 ← 调用 /v1/messages
```

### 2.4 地图渲染

- 使用 Canvas 2D 绘制
- 坐标系：Web Mercator (EPSG:3857)
- 数据源：
  - 陆地轮廓：Natural Earth 50m（简化抽样）
  - 流域边界：HydroBASINS level-4（GeoJSON）
  - 海洋背景：纯色填充

### 2.5 区域匹配算法

```javascript
// 简化的矩形范围匹配
function matchRegion(lon, lat) {
  for (const region of regions) {
    const { lon: [minLon, maxLon], lat: [minLat, maxLat] } = region.match;
    if (lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat) {
      return region;
    }
  }
  return null;
}
```

未来可升级为：
- Point-in-polygon 精确匹配
- 空间索引（R-tree）加速
- 多层级区域（流域 → 子流域）

## 3. 后端架构

### 3.1 技术栈

- **运行时**: Node.js
- **框架**: Express
- **配置**: 环境变量 + JSON 文件

### 3.2 API 端点

| 端点 | 方法 | 功能 |
|------|------|------|
| `/` | GET | 静态文件服务 |
| `/health` | GET | 健康检查 |
| `/v1/messages` | POST | AI 模型代理 |
| `/literature/:filename` | GET | 本地 PDF 文件 |

### 3.3 AI 模型集成

当前支持 Anthropic Messages API 兼容接口：

```javascript
// 请求格式
POST /v1/messages
{
  "model": "glm-5.1",
  "messages": [{ "role": "user", "content": "..." }],
  "max_tokens": 4096
}

// 响应格式
{
  "content": [{ "type": "text", "text": "..." }],
  "model": "glm-5.1",
  "usage": { "input_tokens": 100, "output_tokens": 500 }
}
```

配置优先级：
1. 环境变量 `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL`
2. `config/atlas.local.json` 文件
3. 离线 fallback 模式

### 3.4 离线 Fallback

当无 API 配置时，服务端返回预设的示例综述：

```javascript
function generateOfflineReport(region) {
  return `## ${region.name} 水文研究综述\n\n[离线示例内容...]`;
}
```

## 4. 数据与知识架构

### 4.1 目录结构

```
catalog/
├── literature/          # 文献元数据
│   └── reference-catalog.js
├── regions/             # 区域知识包
│   └── basin-profiles.js
├── datasets/            # 数据集元数据（规划中）
└── models/              # 模型元数据（规划中）
```

### 4.2 文献数据结构

```javascript
{
  id: "scanlon2012",
  title: "Groundwater depletion...",
  authors: "Scanlon, B. R., et al.",
  year: "2012",
  venue: "PNAS",
  doi: "10.1073/pnas.1200311109",
  file: "scanlon-et-al-2012.pdf",
  abstract: "..."
}
```

### 4.3 区域数据结构

```javascript
{
  id: "north-china-plain",
  name: "North China Plain",
  match: { lon: [112, 121.5], lat: [34, 41.5] },
  mode: "managed",
  label: "强人类干预下的治理恢复系统",
  summary: "...",
  cycle: ["...", "...", "..."],
  pattern: ["...", "..."],
  references: ["leng2014NorthChina", "long2025NorthChina", ...]
}
```

### 4.4 水文模式分类

| 模式 ID | 标签 | 颜色 | 典型区域 |
|---------|------|------|----------|
| snow | 积雪与冰川融水补给型 | #39b8c4 | 高山流域 |
| monsoon | 季风洪泛补给型 | #48c78e | Ganges |
| dryIrrigation | 干旱区灌溉与地下水依赖型 | #e85d75 | High Plains, Indus |
| reservoir | 水库调节与季节流量重组型 | #8f72d8 | Mekong, Nile |
| humid | 湿润径流主导型 | #4f8ce8 | 热带雨林 |
| managed | 治理恢复或外源调水缓冲型 | #d89b35 | North China Plain |
| mixed | 混合或弱诊断型 | #9aa3ad | 过渡区 |

## 5. 配置管理

### 5.1 配置文件

| 文件 | 用途 | Git 状态 |
|------|------|----------|
| `config/atlas.local.example.json` | 配置模板 | 已提交 |
| `config/atlas.local.json` | 本地配置 | 已忽略 |

### 5.2 环境变量

```bash
ANTHROPIC_API_KEY=...      # API 密钥
ANTHROPIC_BASE_URL=...     # API 基础 URL
ANTHROPIC_MODEL=...        # 模型名称
```

## 6. 扩展规划

### 6.1 短期（v0.2-v0.4）

- 引入 SQLite/PostgreSQL 存储结构化数据
- 添加 OpenAlex/Crossref API 集成
- 实现 Markdown/PDF 导出
- 增加数据集 catalog

### 6.2 中期（v0.5-v0.7）

- 引入 PostGIS 空间查询
- 建立 model registry
- 实现用户系统
- 多主题扩展

### 6.3 长期（v1.0+）

- 向量检索引擎（文献语义搜索）
- 实时文献监测 pipeline
- 社区知识包生态
- 云端部署与扩展

## 7. 部署

### 7.1 本地开发

```bash
node src/server/server.js
# 访问 http://127.0.0.1:8791
```

### 7.2 生产部署（规划）

- 容器化：Docker + Docker Compose
- 反向代理：Nginx
- 进程管理：PM2
- 监控：日志 + 健康检查

## 8. 安全考虑

- API 密钥不提交到 Git（`.gitignore`）
- CORS 配置限制（当前开发模式开放）
- 输入验证（待增强）
- 文件访问控制（待实现）
