# 配置文件示例

本目录包含项目的配置文件示例和模板。

## 文件说明

| 文件 | 说明 | Git 状态 |
|------|------|----------|
| `atlas.local.example.json` | 本地配置模板 | 已提交 |
| `atlas.local.json` | 本地配置 | 已忽略 |

## 配置项

```json
{
  "ANTHROPIC_API_KEY": "your-api-key-here",
  "ANTHROPIC_BASE_URL": "https://api.anthropic.com",
  "ANTHROPIC_MODEL": "claude-sonnet-4-6"
}
```

### 环境变量替代

也可以通过环境变量配置：

```bash
export ANTHROPIC_API_KEY="your-api-key"
export ANTHROPIC_BASE_URL="https://api.anthropic.com"
export ANTHROPIC_MODEL="claude-sonnet-4-6"
```

## 支持的模型服务

任何兼容 Anthropic Messages API 的服务：

- Anthropic Claude
- 兼容 API 网关
- 本地模型服务（如 vLLM）