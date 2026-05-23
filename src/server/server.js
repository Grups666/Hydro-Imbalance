const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");
const HERE = __dirname;
const LOCAL_CONFIG_PATH = path.join(HERE, "atlas.local.json");
const PORT = Number(process.env.PORT || 8791);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".pdf": "application/pdf"
};

function readLocalConfig() {
  try {
    return JSON.parse(fs.readFileSync(LOCAL_CONFIG_PATH, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return {};
  }
}

const localConfig = readLocalConfig();

function setting(name, fallback = "") {
  return process.env[name] || localConfig[name] || fallback;
}

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function health(res) {
  send(res, 200, JSON.stringify({
    ok: true,
    llmConfigured: Boolean(setting("ANTHROPIC_API_KEY")),
    model: setting("ANTHROPIC_MODEL", setting("ANTHROPIC_DEFAULT_SONNET_MODEL", "not configured"))
  }));
}

async function research(req, res) {
  const payload = JSON.parse(await readBody(req) || "{}");
  const apiKey = setting("ANTHROPIC_API_KEY");

  if (!apiKey) {
    send(res, 200, JSON.stringify({ report: mockReport(payload) }));
    return;
  }

  const baseUrl = setting("ANTHROPIC_BASE_URL", "https://api.anthropic.com").replace(/\/$/, "");
  const model = setting("ANTHROPIC_MODEL", setting("ANTHROPIC_DEFAULT_SONNET_MODEL", "claude-3-5-sonnet-latest"));
  const prompt = buildPrompt(payload);

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      max_tokens: 1800,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    send(res, 502, JSON.stringify({ error: `LLM request failed: ${response.status}`, detail: text.slice(0, 500) }));
    return;
  }

  const data = await response.json();
  const report = Array.isArray(data.content)
    ? data.content.map((part) => part.text || "").join("\n")
    : JSON.stringify(data);
  send(res, 200, JSON.stringify({ report }));
}

function buildPrompt(payload) {
  const basin = payload.basin || {};
  const profile = basin.profile || {};
  return [
    "你是一个严谨的地理空间科研助理。请基于用户选择的 catchment 上下文，生成中文科研检索与综述报告。",
    "如果问题需要外部文献检索，但当前上下文不足，请明确给出推荐检索式和需要验证的文献类型，不要编造不存在的论文。",
    "",
    `用户问题：${payload.question || ""}`,
    `流域名称：${basin.name || ""}`,
    `HydroBASINS ID：${basin.id || ""}`,
    `区域：${basin.region || ""}`,
    `bbox：${JSON.stringify(basin.bbox || [])}`,
    `面积 km2：${basin.areaKm2 || ""}`,
    `水文循环模式：${basin.hydrologicalMode || ""}`,
    `已配置摘要：${profile.summary || ""}`,
    `水循环特点：${(profile.cycle || []).join("；")}`,
    `时空 pattern：${(profile.pattern || []).join("；")}`,
    `本地参考文献：${(profile.references || []).join("；")}`,
    "",
    "输出结构：",
    "1. 研究问题重述",
    "2. 流域背景与相关水文/生态机制",
    "3. 与用户主题相关的可能研究方向",
    "4. 已有本地文献如何支撑或不足",
    "5. 推荐检索式",
    "6. 证据强度与不确定性"
  ].join("\n");
}

function mockReport(payload) {
  const basin = payload.basin || {};
  const profile = basin.profile || {};
  const refs = profile.references || [];
  return [
    "离线示例报告",
    "",
    `研究问题：${payload.question || "未提供"}`,
    `流域：${basin.name || "未选择"}`,
    `水文循环模式：${basin.hydrologicalMode || "未知"}`,
    "",
    "流域背景：",
    profile.summary || "该 catchment 尚未配置专门 profile，当前仅使用 HydroBASINS 空间属性和系统默认水文模式。",
    "",
    "可能机制：",
    ...((profile.cycle || ["需要结合降水、蒸散、径流、地下水和人类活动数据进一步判定。"]).map((item) => `- ${item}`)),
    "",
    "时空 pattern：",
    ...((profile.pattern || ["尚未配置。"]).map((item) => `- ${item}`)),
    "",
    "本地参考文献：",
    ...(refs.length ? refs.map((item) => `- ${item}`) : ["- Rodell et al. 2018 Nature", "- Jasechko et al. 2024 Nature"]),
    "",
    "推荐检索式：",
    `- \"${basin.name || "selected basin"}\" \"${payload.question || "research"}\"`,
    `- \"${basin.name || "selected basin"}\" hydrology ecology climate`,
    `- \"${basin.name || "selected basin"}\" water management remote sensing`,
    "",
    "说明：当前返回的是无 API key 时的 fallback。配置本地 API key 后会请求真实 LLM。"
  ].join("\n");
}

function serveFile(req, res) {
  let requestPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  if (requestPath === "/") requestPath = "/index.html";

  let filePath;
  if (requestPath === "/basin-data.js") {
    filePath = path.join(ROOT, "projects", "basin-data.js");
  } else if (requestPath.startsWith("/references/")) {
    filePath = path.join(ROOT, requestPath.slice(1));
  } else {
    filePath = path.join(HERE, requestPath);
  }

  const allowed = filePath.startsWith(HERE) ||
    filePath.endsWith(path.join("projects", "basin-data.js")) ||
    filePath.startsWith(path.join(ROOT, "references"));

  if (!allowed) {
    send(res, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(res, 404, "Not found", "text/plain; charset=utf-8");
      return;
    }
    send(res, 200, data, mime[path.extname(filePath)] || "application/octet-stream");
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/api/health") return health(res);
    if (req.url === "/api/research" && req.method === "POST") return await research(req, res);
    serveFile(req, res);
  } catch (error) {
    send(res, 500, JSON.stringify({ error: error.message }));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`科研空间图谱 running at http://127.0.0.1:${PORT}`);
});
