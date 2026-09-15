# 语音输入（STT）

> 2026-09-14 · niko 需求：玩家用自己的声音输入 RP 行动，边说边出字。与实时通话（`00-共同上下文.md`）不同，这里只做「说话 → 文字进输入框草稿」。

- **与通话模式的关系（L2 补充，2026-09-15）**：STT 与「对话框实时通话」（`docs/live-voice/10`）**互斥，且无需额外代码**。话筒按钮是文字输入行的兄弟节点（`CharacterModal.tsx` 的 `speech-input-row` 内），通话模式按 `10 §3.1` 冻结 4 **不渲染该输入行** → `useVoiceInput` 卸载清理释放麦克风轨并关 `/ws/stt`（`lib/voice-input.ts`）。**MUST NOT** 用 `display:none` 保留挂载——那样麦克风仍开着，会与通话的 `getUserMedia` **抢麦**。本文 §2 的两条 STT 路径（`/ws/stt`、`POST /api/stt`）与 `/api/live/*` 无交集；`POST /api/stt` 是二进制体，本就不进 `check-request-bodies.mjs`。

## 1. 行为

- 作家输入栏（`WriterBar`）与角色对话输入框（`CharacterModal`）各有一个麦克风按钮：按一下开始，再按一下停止；最长 60 秒自动停止。
- 说话时文字**实时**出现在输入框里，接在玩家已经打的字后面；每句话定稿后替换它的临时文字。停止后最多等 4 秒收尾。
- 结果只是草稿，由玩家确认后按发送；不会自动发给作家或角色。
- 麦克风只在玩家点击时打开，停止即释放。
- 不传语言提示，由模型自动识别（玩家说的语言常与界面语言不同，错误的提示会严重拉低准确率）。

## 2. 接口

### 2.1 实时转写（主路径）

浏览器 ⇄ `/ws/stt`（开发时经 Vite `/ws` 代理）⇄ OpenAI Realtime 转写会话（GA：`wss://…/v1/realtime?intent=transcription`）。密钥只在服务端。

| 方向 | 消息 |
|---|---|
| 浏览器 → 服务端 | 二进制帧：24kHz 单声道 PCM16（约 100ms 一帧）；文本 `{type:'stop'}` 提交最后一句 |
| 服务端 → 浏览器 | `{type:'ready'}`、`{type:'delta', itemId, delta}`、`{type:'completed', itemId, transcript}`、`{type:'error', code}` |

会话配置：`session.type = 'transcription'`，`audio.input.format = { type: 'audio/pcm', rate: 24000 }`，服务端 VAD（静音 500ms 断句）。错误码：`stt_unavailable`（没配 key）、`stt_failed`（上游拒绝、出错）。单次会话上限 90 秒。旧 beta 协议（`transcription_session.update`）已被 OpenAI 停用，2026-09-14 探测确认。

### 2.2 整段转写（保留）

| 路由 | 请求 | 响应 |
|---|---|---|
| `GET /api/stt/config` | 无 | `{ available, model }`，不含密钥 |
| `POST /api/stt?language=ja\|zh\|en` | 原始音频字节（`audio/webm` 等），上限 10MB | `{ ok: true, text }` |

没配 key → 503 `stt_unavailable`；空或非音频 → 400 `invalid_audio`；上游失败或超时（30 秒）→ 502 `stt_failed`。请求体是二进制，不进 `tools/check-request-bodies.mjs` 的契约清单。

## 3. 配置

每次连接或请求重新读取环境变量，改连接设置后无需重启：

- `OPENAI_API_KEY`、`OPENAI_BASE_URL`（默认 `https://api.openai.com/v1`）：复用连接设置里的 OpenAI 兼容服务。
- `AIRP_STT_MODEL`：转写模型，默认 `gpt-4o-transcribe`。

按音频时长付费。

## 4. 代码与验证

- 服务端：`apps/server/src/engine/stt-stream.ts`（实时中继，挂在 `index.ts` 的 WebSocket 连接上，按路径 `/ws/stt` 分流）、`apps/server/src/routes/stt.ts`（整段转写）。
- 前端：`apps/web/src/lib/voice-input.ts`（AudioWorklet 以浏览器原生采样率采集，前端线性重采样到 24kHz 再转 PCM16，逐句拼接）、`apps/web/src/components/chrome/VoiceInputButton.tsx`。
- 不要把 `AudioContext` 直接设成 24kHz：2026-09-14 实测 Chrome 在 48kHz 麦克风下给 24kHz 上下文的输入全是静音，模型会凭空转写出无关短词。
- 测试：`apps/server/test/stt-stream.test.mjs`、`apps/server/test/stt-route.test.mjs`，均用本地桩替代上游，不产生费用。
