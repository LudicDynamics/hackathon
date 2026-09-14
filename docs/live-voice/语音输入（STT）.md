# 语音输入（STT）

> 2026-09-14 · niko 需求：玩家用自己的声音输入 RP 行动。与实时通话（`00-共同上下文.md`）不同，这里只做「录一句 → 转成文字 → 放进输入框」。

## 1. 行为

- 作家输入栏（`WriterBar`）与角色对话输入框（`CharacterModal`）各有一个麦克风按钮：按一下开始录，再按一下停止；最长 60 秒自动停止。
- 录音结束后转写，结果**只追加到输入框草稿**，由玩家确认后按发送。不会自动发给作家或角色。
- 麦克风只在玩家点击时打开，录音一停就释放。
- 语言提示跟随界面语言：`ja` / `zh`（`zh-CN`）/ `en`。

## 2. 接口

| 路由 | 请求 | 响应 |
|---|---|---|
| `GET /api/stt/config` | 无 | `{ available: boolean, model: string }`，不含任何密钥 |
| `POST /api/stt?language=ja\|zh\|en` | 请求体为录音原始字节，`Content-Type: audio/webm`（Safari 为 `audio/mp4`），上限 10MB | `{ ok: true, text }` |

错误：没配 `OPENAI_API_KEY` → 503 `stt_unavailable`；空录音或非音频 → 400 `invalid_audio`；上游失败或超时（30 秒）→ 502 `stt_failed`，文案不含密钥与地址。

请求体是二进制而不是 JSON，所以不进 `tools/check-request-bodies.mjs` 的契约清单。

## 3. 配置

每次请求重新读取环境变量，与 TTS 相同，改连接设置后无需重启：

- `OPENAI_API_KEY`、`OPENAI_BASE_URL`（默认 `https://api.openai.com/v1`）：复用连接设置里的 OpenAI 兼容服务。
- `AIRP_STT_MODEL`：转写模型，默认 `gpt-4o-mini-transcribe`。

每次转写都是一次付费调用。

## 4. 代码与验证

- 服务端：`apps/server/src/routes/stt.ts`；测试 `apps/server/test/stt-route.test.mjs`（本地桩替代上游，不产生费用）。
- 前端：`apps/web/src/lib/voice-input.ts`（录音 hook）、`apps/web/src/components/chrome/VoiceInputButton.tsx`。
