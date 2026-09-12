# Qwen3-TTS 语音合成模型调用指南 (`qwen3-tts-flash-2025-11-27`)

本文档介绍如何调用阿里云百炼（DashScope）**`qwen3-tts-flash-2025-11-27`** 异步/非实时语音合成模型，包含服务 Base URL、接口参数详解、支持音色列表、不同语种配置及 Python / cURL / REST API 调用示例。

---

## 1. 服务地址与认证（统一使用新加坡地域）

> [!IMPORTANT]
> **本项目统一使用新加坡地域（ap-southeast-1）**。
> 新加坡和北京地域的 API Key 相互独立，北京地域的 Key 无法在新加坡端点使用，反之亦然。本项目申请的 API Key 适用于新加坡地域。

### 1.1 Base URL 与请求端点

| 项目 | 配置值 |
| :--- | :--- |
| **部署地域** | **新加坡地域 (ap-southeast-1)** |
| **HTTP Base URL** | `https://dashscope-intl.aliyuncs.com/api/v1` |
| **TTS 合成端点 (POST)** | `https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation` |
| **实时 WebSocket URL** | `wss://dashscope-intl.aliyuncs.com/api-ws/v1/realtime` |

### 1.2 认证方式

在 HTTP 请求头中添加 Bearer Token：
```http
Authorization: Bearer <YOUR_DASHSCOPE_API_KEY>
Content-Type: application/json
```

---

## 2. 请求参数详解

请求格式为 `POST` 请求，Body 为 JSON 对象。

### 2.1 顶层参数

| 参数名 | 类型 | 是否必填 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `model` | `string` | **是** | - | 模型名称，固定传入：`"qwen3-tts-flash-2025-11-27"`（或主版本号 `"qwen3-tts-flash"`） |
| `input` | `object` | **是** | - | 语音合成的输入载荷对象，详见下文 |

### 2.2 `input` 对象参数

| 参数名 | 类型 | 是否必填 | 默认值 | 详细说明 |
| :--- | :--- | :--- | :--- | :--- |
| `text` | `string` | **是** | - | 需要合成的文本内容。最大输入长度：**512 Token**（或约 600 字符）。支持单语种及多语种混输。 |
| `voice` | `string` | **是** | - | 朗读音色 ID。常用系统音色：`Cherry`（女声）、`Eric`（男声）、`Bella`（女声）等。 |
| `language_type` | `string` | 否 | `"Auto"` | 合成目标语种。指定语言能显著提升自然度与发音准确性。详见下文支持语种列表。 |

### 2.3 支持的 `language_type` 语种

- `Auto`：自动检测（适用于中英混合、多语言混杂等场景）
- `Chinese`：中文
- `English`：英文
- `Japanese`：日语
- `Korean`：韩语
- `German`：德语
- `French`：法语
- `Spanish`：西班牙语
- `Italian`：意大利语
- `Portuguese`：葡萄牙语
- `Russian`：俄语

---

## 3. 响应格式与字段解析

接口调用成功后返回 HTTP 200，并提供完整音频的 OSS 下载链接（有效期 24 小时）：

```json
{
  "status_code": 200,
  "request_id": "fa48ecc9-a8cc-968e-9ec5-d72ab75d0437",
  "code": "",
  "message": "",
  "output": {
    "text": null,
    "choices": null,
    "finish_reason": "stop",
    "audio": {
      "id": "audio_fa48ecc9-a8cc-968e-9ec5-d72ab75d0437",
      "url": "http://dashscope-result-sgp.oss-ap-southeast-1.aliyuncs.com/prod/qwen3-tts/.../xxx.wav?Expires=...",
      "data": "",
      "expires_at": 1789323655
    }
  },
  "usage": {
    "characters": 42
  }
}
```

### 关键字段说明
- `output.audio.url`：合成后的音频下载链接（通常为高质量无损 `.wav` 格式），可直接通过 HTTP GET 下载保存。
- `output.audio.expires_at`：该音频下载链接的 UNIX 过期时间戳（通常保留 24 小时）。
- `usage.characters`：本次请求计费/统计的字符数。

---

## 4. 调用示例

### 4.1 Python 调用示例（原生 requests，无需 SDK 兼容性烦恼）

```python
import os
import requests

API_KEY = os.getenv("DASHSCOPE_API_KEY", "your-dashscope-api-key")
# 统一使用新加坡地域端点
ENDPOINT = "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

payload = {
    "model": "qwen3-tts-flash-2025-11-27",
    "input": {
        "text": "おはようございます！今日も一日頑張りましょう。",
        "voice": "Cherry",
        "language_type": "Japanese"
    }
}

# 1. 发起语音合成请求
response = requests.post(ENDPOINT, headers=headers, json=payload)
data = response.json()

if response.status_code == 200:
    audio_url = data["output"]["audio"]["url"]
    print(f"语音合成成功！音频 URL: {audio_url}")
    
    # 2. 下载并保存音频
    audio_data = requests.get(audio_url).content
    with open("output_japanese.wav", "wb") as f:
        f.write(audio_data)
    print("音频已保存为 output_japanese.wav")
else:
    print(f"请求失败: [{data.get('code')}] {data.get('message')}")
```

### 4.2 Python SDK (`dashscope`) 调用示例

```python
import os
import dashscope

# 设置地域（新加坡地域需显式指定 base_http_api_url）
dashscope.base_http_api_url = "https://dashscope-intl.aliyuncs.com/api/v1"
dashscope.api_key = os.getenv("DASHSCOPE_API_KEY")

response = dashscope.MultiModalConversation.call(
    model="qwen3-tts-flash-2025-11-27",
    text="Today is a wonderful day to build something people love!",
    voice="Cherry",
    language_type="English"
)

if response.status_code == 200:
    print("Audio URL:", response.output.audio.url)
else:
    print("Failed:", response.code, response.message)
```

### 4.3 cURL 调用示例

```bash
curl -X POST 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation' \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen3-tts-flash-2025-11-27",
    "input": {
      "text": "Hello, this is a test using the Qwen3 TTS Flash model.",
      "voice": "Eric",
      "language_type": "English"
    }
  }'
```

---

## 5. 常见问题与注意事项

1. **实时与非实时模型的区别**：
   - 非实时模型（如 `qwen3-tts-flash-2025-11-27`）：通过 HTTP REST POST 传入完整文本，直接生成整段音频文件的 OSS URL。
   - 实时流式模型（如 `qwen3-tts-flash-realtime-2025-11-27`）：通过 WebSocket 全双工协议（`wss://dashscope-intl.aliyuncs.com/api-ws/v1/realtime`）实现流式文本输入和毫秒级分块音频返回。
2. **文本分段建议**：
   - 如果需要合成超过 500 字的长篇文章，请在客户端先按句号或段落将长文本拆分为句子进行并发或顺序请求，以保证生成质量与稳定性。
3. **音频文件过期处理**：
   - 接口返回的 `output.audio.url` 为阿里云 OSS 签名链接，有效期为 **24 小时**。请在获取到链接后及时下载并持久化保存至业务服务器或对象存储中。
