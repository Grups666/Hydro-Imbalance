# 科研空间图谱 Demo

这是一个“基于地理空间的科研知识探索系统”demo，独立于 `basin_literature_atlas`。

## 功能

- 全屏世界地图式界面，本地 Natural Earth 陆地/海岸线、海洋背景和全球 HydroBASINS level-4 catchment 边界。
- 所有流域均可点击；未配置文献档案的流域会显示基础空间属性和推断水文循环模式。
- 重点流域配置了本地文献和水文循环模式，包括 High Plains、Central Valley、Indus、Ganges、North China Plain、Yellow River、Tigris-Euphrates、Aral、Mekong、Nile、Murray-Darling。
- 底部麦克风入口使用浏览器 Web Speech API；不支持语音的浏览器可直接使用文本输入。
- `server.js` 提供可选模型 API 代理。无 API key 时返回离线示例报告；配置环境变量或 `atlas.local.json` 后请求 `/v1/messages`。

## 运行

在本目录执行：

```powershell
node server.js
```

然后打开：

```text
http://127.0.0.1:8791
```

## 模型配置

服务端会优先读取环境变量，也会读取本目录下的 `atlas.local.json`。该文件已加入 `.gitignore`，只用于本地 demo。

可复制 `atlas.local.example.json` 为 `atlas.local.json` 后填写本地模型参数，或在 shell 中设置环境变量：

```powershell
$env:ANTHROPIC_API_KEY="..."
$env:ANTHROPIC_BASE_URL="https://api.example.com"
$env:ANTHROPIC_MODEL="glm-5.1"
node server.js
```

当前服务使用 Anthropic Messages API 形态：

```text
POST {ANTHROPIC_BASE_URL}/v1/messages
```

打开页面后，右上角状态显示“模型：已连接”即表示服务端已读到配置。底部输入框会将当前选中流域的上下文发送给模型生成中文研究综述。

## 参考文献弹窗

右侧流域详情中的参考文献显示论文标题。点击标题会在页面中央打开文献详情，包括作者、年份、期刊、DOI、摘要和本地 PDF 入口。文献元数据维护在 `reference-catalog.js`，流域档案只引用文献 id。

## 验证

已做的静态验证包括：

- JavaScript 语法检查。
- `server.js` health endpoint。
- 无 key fallback research endpoint。
- 本地 PDF 路由。
- 本地 `world-land.js` 来自 Natural Earth 50m land shapefile 的简化抽样，用于离线真实陆地轮廓。

浏览器语音识别能力取决于实际浏览器支持和权限设置。
