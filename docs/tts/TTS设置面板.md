# TTS 设置与克制降级（niko）

2026-09-14 增补：初雪七海支持本机优先与线上兜底，请求增加可选 characterId / emotion；本机配置也计入 configured，失败以响应头通知浏览器警告。最新契约见 [10-本机角色语音与线上兜底](10-本机角色语音与线上兜底.md)。下文单供应商与 emo 仅立绘的旧描述以该增补为准。

顶部 Voice & connections 提供本浏览器语音开关、服务配置状态、当前模型和默认音色，以及 DashScope TTS、OpenAI-compatible、Flow media proxy 的服务地址和密钥输入。已有密钥不回显，不进入 localStorage；输入框留空保留原值，关闭面板销毁草稿。角色声明的音色优先；模型和默认音色仍只展示。

`GET/POST /api/connection-settings` 仅允许 loopback socket、localhost Host/Origin，拒绝转发来源；POST 还要求 JSON 和专用请求头，不能通过 Tailscale 展示地址修改。GET 密钥字段只返回是否配置。POST 白名单校验后原子保存仓库 `.env.local`（权限 0600），保留其他变量并更新当前进程环境。TTS 后续请求立即生效，已有 Agent 进程需重新启动；Flow 配置是媒体代理，不代表作家模型已切换。保存不是上游连通性验证，不自动发起付费调用。

`GET /api/tts/config` 返回 `{ configured, model, defaultVoice }`，不返回 key 或 gateway URL，禁止缓存。configured 只表示密钥存在，不表示上游调用已验证。

角色语音预取前共享一次配置检查。未配置时不发送合成请求，当前页面会话仅提醒一次，不阻塞文字。网络或合成失败后冷却 60 秒，面板可手动重新检查；关闭语音只阻止后续合成请求，不中断已经发送的请求。保存设置后自动重新检查。
