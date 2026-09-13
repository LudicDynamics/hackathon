# niko 功能迁移：共享契约

> 状态：实现契约已冻结（2026-09-14）
> 日期：2026-09-14
> 范围：物品行动草稿、Continue／下一步提示、音频独立音量设置、世界变化 Toast、完整 Agent 执行活动日志、Writer 单轮工具调用上限。
> 来源：`origin/niko@8a2df60` 的功能增量；不迁移其内容编译器模块。
>
> 本文只冻结跨功能的共同边界。各功能设计文档不得自行改变事件来源、状态真相、Writer guard 语义或现有组件职责；发现冲突必须回写本文并在评审门裁决。

## 1. 共同权威

1. 文件是世界内容真相，`history.db.events` 是已落账世界变化真相。
2. `docs/agent-awareness/00-共同上下文.md` 是 Agent frame、身份、公开范围和去重的上位契约。
3. `docs/audio/00-共同上下文.md` 是音频通道、降级和服务端解析的上位契约。
4. `docs/tools/00-共同上下文.md` 是动作、事件和 Writer 工具的上位契约。
5. `docs/ux/00-共同上下文.md` 是前端状态投影、动作阶段和失败反馈的上位契约。
6. 当前实现中的唯一 WS 消费入口是 `apps/web/src/state/useWorld.ts`；组件不得自行监听 `airp:agent-frame` 或另造 WS 消费路径。

## 2. 功能范围与明确不做

本批只迁移六项用户或运行时功能：

- 物品行动草稿；
- Continue／下一步提示辅助；
- 音频独立音量设置 UI；
- 世界变化 Toast；
- 完整 Agent 执行活动日志；
- Writer 单轮最多 N 次工具调用的可配置守卫。

本批明确不迁移：

- niko 的 `tools/experiences/*.mjs` 新内容编译模块及其配套规则；
- Writer 的 Chalk 去重守卫；
- Writer 原生 `write`／`edit` 拦截；
- 自动消耗、自动移动或自动执行物品；
- 第二套 Writer state、第二套 Agent frame reducer 或组件级原始帧监听；
- 把 Toast、活动日志或 hint 当作世界事实。

## 3. 共同事件与投影口径

### 3.1 Agent activity

Agent 活动只消费当前已冻结的 `agent_activity` 帧，并通过：

```text
useWorld.ts → agentActivityStore → useAgentActivity → ActivityRail / activity log
```

完整日志是 `agentActivityStore` 的更丰富投影，不是第二个 reducer。它可以展示已归一化的 operation、subject、phase、error 和 turn 汇总，但不得展示原始 tool args、绝对路径、模型思维或完整文件正文。

### 3.2 World event

世界变化 Toast 只消费当前 `useWorld.ts` 已判重并转发的 `world_event`。它不得从 `tool_start`、文件监听或组件点击推测成功。

允许展示的事实类型限定为：

```text
entity_created
entity_moved
entity_deleted
entity_edited
choice_selected
roll_resolved
use_item_on
layer_entered
layer_initialized
layer_init_failed
```

Toast 文案必须说明：当前状态 → 可核验对象 → 下一步；不把“事件已落账”写成“谜题已解决”。重复 `event.id` 必须幂等。

### 3.3 Writer state

Continue 按钮只能从当前 `writer-state` 的 settled／idle 投影出现；Writer working、error、aborted 或 world frozen 时不得允许重复提交。点击 Continue 走现有 `beginWriterPrompt`／Writer 请求接缝，不得直接操作事件表或动作层。

物品行动草稿同样只修改本地输入草稿。选择、取消、关闭弹窗和重复点击都不得写世界、消耗物品或启动 Writer；只有玩家明确 Send 后才进入现有 Writer prompt 接缝。

## 4. 音频偏好

音量 UI 只操作已有 `apps/web/src/lib/audio.ts` 的：

```ts
getChannelVolume('music' | 'voice')
setChannelVolume('music' | 'voice', value)
```

范围为 `[0, 1]`，UI 以 0–100 展示。偏好保存在当前浏览器；静音仍由 master mute 控制。音频不可用、Effects 关闭、Reduced Motion、页面隐藏时，文本、动作和世界事实仍然可用。

本批不改变音频资源、服务端 TTS 合成、BGM 解析链或音量底层 API。

## 5. Writer guard 冻结语义

### 5.1 唯一职责

守卫唯一负责：**限制 Writer 单轮工具调用次数**。

- 默认上限：`24`；
- 配置入口：`AIRP_WRITER_MAX_TOOL_CALLS`；
- 配置值必须是正整数；无效、缺失或非正数回退默认值；
- 每个 Writer engine turn 开始时计数归零；
- 每次 Writer `tool_call` 递增一次；
- 达到上限后拒绝后续 Writer 工具调用，并返回模型可见的简短原因；
- Character、functional agent、scene-init、nook-init 不受此守卫影响；
- 守卫不得修改世界、写事件或制造成功反馈。

### 5.2 刻意不做的守卫

本批**不做**以下行为：

- 不限制单轮 Chalk 数量；
- 不判断 Chalk 是否重复；
- 不禁止 Writer 使用原生 `write`／`edit`；
- 不按工具名称或文件路径额外设黑名单；
- 不替代动作层权限检查、事件落账或初始化流程。

### 5.3 Merge 登记理由（冻结）

> 之所以删减 niko 原版的“单轮只能一张 Chalk／重复 Chalk 拦截／原生 write 禁止”，不是遗漏，而是产品和初始化语义的有意裁决：这些限制会直接导致作家无法完整初始化一个场景。场景初始化可能需要连续创建、编辑多个文件，也可能需要通过原生写入完成初始化阶段的结构准备；把它们误判为普通叙事轮会让合法初始化在中途被守卫截断。故本批只保留可配置的 Writer 单轮工具调用总量上限，作为失控循环保护；其余约束继续由动作层、初始化流程和现有契约负责。

## 6. 文件归属与接线边界

| 功能 | 主要落点 | 不得触碰 |
|---|---|---|
| 物品行动草稿 | `BagItemDialog.tsx`、`WriterBar.tsx`、`App.tsx`、纯函数测试 | 动作层、物品事实、消费/移动语义 |
| Continue hint | `play-hints.ts`、当前 `WriterResult.tsx`、App 接线、i18n | writer state 真相、world event、自动推进 |
| 音频设置 | `TtsSettings.tsx`、设置样式、音频偏好测试 | 音频底层 API、TTS provider、服务端合成 |
| 世界 Toast | 新 Toast 投影、world-event selector、App/shell 接线 | 原始 WS listener、事件写入、动作成功判断 |
| Agent 完整日志 | Agent activity selector/projection、ActivityRail 邻接 UI | 第二个 store、原始帧监听、角色台词/TTS |
| Writer guard | `extensions/toolkit/writer-beat-guard.ts`、注册入口、纯函数测试、配置说明 | Chalk 去重、原生 write/edit 拦截、Character/initializer |

跨功能共享的 `App.tsx` 与 `WriterResult.tsx` 必须由同一实现者协调；任何新增 i18n key 必须同批补齐并运行 `pnpm check:i18n`。

## 7. 统一验收

每项功能必须同时具备：

1. 一个没有该功能时会失败的非空行为测试；
2. 当前成功、失败、取消、重复触发和服务不可用路径；
3. 不改变世界事实的路径明确证明没有新增事件；
4. `useWorld` 单一消费入口保持不变；
5. `pnpm build`、相关专项测试、`pnpm check:ws`、`pnpm check:bodies`、`pnpm check:i18n` 通过；
6. UI 功能完成浏览器冒烟，验证桌面和窄屏至少各一条路径。

## 8. 设计冲突记录

- niko 的 `AgentActivity`／`WorldActivityToast` 使用 `window` 原始事件监听；当前 UX 与 Agent awareness 契约要求单一 `useWorld` 消费入口，因此只能迁移为 store/selector 投影。
- niko 的 `WriterResult` 重新监听原始帧并维护本地生命周期；当前主线 `writer-state.ts` 已是 Writer state 唯一真相，因此只迁移 Continue 行为，不替换当前状态机。
- niko 的 Writer guard 将场景初始化与普通 Writer 轮混用；本批以“直接导致作家无法完整初始化一个场景”为理由删减为可配置总量上限，详见 §5.3。
