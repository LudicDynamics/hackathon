# Agent 前端接线（2026-09-13）

前端继续复用 `useWorld` 的唯一 WebSocket，不在每个角色面板再建连接。收到帧后通过 `airp:agent-frame` 分发至作家状态和角色对话；世界文件仍由 `world_event/file_changed` 刷新画布，作家 chat 不当作正文卡片。

作家输入走 `writer_prompt` → `submitWriter` 串行队列。输入后显示工作状态，`writer_delta/tool_start/chalk_writing` 保持忙态，`writer_idle/error/turn_aborted` 结束；提供停止按钮发送 `writer_abort`。

角色打开走 `character_start`，提交走 `character_prompt`，关闭走 `character_stop`。移除随机回复与“尚未接线”占位，用真实 `character_delta` 增量、`character_message` 最终文本和 `character_idle` 收尾，保留 `[emo:]` 解析。所有角色引擎帧新增 `characterId`（lifecycle → event-bridge → WS），对话只接受当前角色的帧；错误原样显示而不伪装回复。模型使用 `AIRP_CHARACTER_MODEL`，未指定时沿用 `AIRP_WRITER_MODEL`，再未指定才用引擎默认。

引擎 assistant message_end 若 stopReason 为 error/aborted，桥接为现有 `error` 帧，防止空白回复被误认为成功。世界和角色身份不改变共享事件表契约。
