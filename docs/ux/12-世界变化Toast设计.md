# UX12：世界变化 Toast 设计

> 状态：已实现（2026-09-14）；本文保留投影与验收契约。
> Module owner：`WorldToastProjection12`。
> 一句话定位：**把已经由 `useWorld.ts` 判重并转发的 `world_event`，压缩成短暂、可核验、可继续行动的世界变化提示；Toast 只陈述事件事实，绝不把活动、点击、文件监听或演出当作成功，更不是谜题解决证明。**

## 1. 一句话定位、范围与非目标

### 1.1 玩家问题

玩家在一次动作、作家轮或初始化之后，需要快速知道：

1. 世界记录了什么具体变化；
2. 哪个可核验对象受影响；
3. 现在可以去哪里继续查看。

Toast 是 `chrome` Depth 的瞬时信息投影，不替代阅读层、场景重取、ActionFeedback 或 Agent ActivityRail。它不承载世界正文、模型原话、思维链、完整路径或事件表浏览。

### 1.2 本篇范围

本篇冻结：

- 允许进入 Toast 投影的 `world_event.event.type` 白名单；
- `event.id` 的幂等与有界去重；
- 创建、移动、删除、编辑、选择、掷骰、使用物品、进入、初始化成功/失败的可读文案；
- 同层短时间批量合并、显示上限与 TTL；
- 世界切换、重连、事件失败、畸形事件、迟到事件和回放的处理；
- Toast 与 `ActivityRail`、ActionFeedback 的职责边界；
- `useWorld` 单一 WS 消费入口下的 store/selector 接线；
- 纯 reducer 测试、桌面与窄屏浏览器验收。

### 1.3 明确不做

- 不从 `tool_start`、`tool_end`、`fs.watch`、DOM 点击、拖拽落点、HTTP 2xx 文案或文件存在推测世界成功；
- 不写入 `history.db`、世界文件、`canvas.db` 或任何事件；
- 不增加组件级 `window` 原始 WS/`airp:agent-frame` 监听；
- 不把 Toast 当作事件历史、任务列表、聊天记录或谜题裁决；
- 不把 `layer_initialized` 当成“谜题已解决”，不把 `roll_resolved.passed` 当成“剧情已完成”；
- 不为 schema 中未列入本篇白名单的事件提供通用 fallback 文案，以免未知事件被误说成世界变化。

## 2. 权威契约与职责边界

### 2.1 必须服从的文档

本篇服从：

- [`docs/ux/08-niko功能迁移契约.md`](./08-niko功能迁移契约.md) §1、§3.2、§6、§7：文件与事件是真相、`useWorld` 是唯一 WS 消费入口、Toast 只消费已判重的 `world_event`、事件类型白名单、`event.id` 幂等；
- [`docs/ux/00-共同上下文.md`](./00-共同上下文.md) §2、§4.2、§4.4、§4.6、§4.7：事实先于演出、单一公开投影、失败可见、Reduced Motion/Effects/页面隐藏的降级；
- [`docs/tools/00-共同上下文.md`](../tools/00-共同上下文.md) §4、§5：事件表是世界变化日志，事件由动作实现落账，前端不另造事件；
- [`docs/tools/12-工具注册与路由统一.md`](../tools/12-工具注册与路由统一.md) §6.1–§6.6：演出帧与世界事件分离、`world_event` 帧形状、尾部读表广播、`event.id` 判重、`airp:world-event` 仅为既有刷新接缝；
- [`docs/agent-awareness/00-共同上下文.md`](../agent-awareness/00-共同上下文.md) §2、§3：Agent 活动是临时过程感知，不入事件表；
- [`docs/audio/00-共同上下文.md`](../audio/00-共同上下文.md) §1、§7：Toast 不自行触发成功音效，音频不可用时文本与行动仍有效。

本篇不修改上述共享契约。发现源码与契约差异只登记在 §11。

### 2.2 三种状态源的裁决顺序

| 玩家看到的东西 | 唯一事实来源 | Toast 是否消费 | 说明 |
|---|---|---:|---|
| 世界内容变化 | 文件 + 已落账 `world_event` | 是，仅消费事件 | 事件必须先由 `useWorld` 判重；Toast 不写回 |
| 单次请求状态 | `ActionFeedbackStore` | 否 | `accepted/conflict/failed/cancelled` 只说明该请求，不证明事件已到达 |
| Agent 正在执行什么 | `agentActivityStore` 的 `agent_activity` | 否 | started/completed/failed 是过程，不是世界事实 |

`ActionFeedback.details.event` 即使包含事件副本，也不能直接喂给 Toast；Toast 等待同一事件由 `useWorld` 的 `world_event` 通道送达。这样不会因为 HTTP 响应和事件尾读表各到一次而显示两条 Toast。

## 3. 现状证据、差异与迁移结论

### 3.1 `useWorld` 已有的世界事件入口

- `WorldEventFrame` 定义在 `apps/web/src/state/useWorld.ts:112-128`，包含 `event.seq/id/projectId/type/actor/layer/subject/turn/detail/createdAt` 和广播层 `timestamp`；Toast 只读这些字段，不重新访问事件表。
- `useWorld` 在 `apps/web/src/state/useWorld.ts:156-158` 维护 `seenEventIdsRef` 与 FIFO 顺序；`noteWorldEvent` 在 `:314-327` 首次返回 `true`，超过 200 条淘汰最旧 id。
- WS 的 `world_event` 分支在 `apps/web/src/state/useWorld.ts:427-449` 执行“先判重，再转发，最后整层重取”；畸形且没有字符串 `id` 的帧在 `:430-434` 被丢弃，不污染集合。
- 当前 `forwardWorldEvent` 在 `apps/web/src/state/useWorld.ts:329-338` 只转发 `entity_created/entity_edited/entity_deleted/entity_moved` 四类事件；这满足现有背包刷新接缝，不满足本篇新增 Toast 的 11 类白名单，故 Toast 必须在同一判重分支内增加 store 投影接线，而不是添加新的 WS 监听器。
- `useWorld` 收到 `world_event` 后无论是否被 Toast 消费都会 `fetchLayer(layerRef.current)`（`apps/web/src/state/useWorld.ts:443-449`）；重取是事实接管，不是 Toast 成功依据。

### 3.2 当前 UI 反馈的证据

- App 当前只保存单条字符串 Toast：`apps/web/src/App.tsx:145-155`；`notify` 在 `apps/web/src/App.tsx:219-226` 以一个计时器覆盖旧消息，TTL 固定 3000ms。
- App 当前对 `airp:world-event` 的监听在 `apps/web/src/App.tsx:328-336` 只触发 `loadChromeData()`，不读事件详情；该自定义事件是既有背包/角色刷新接缝，不能成为 Toast 的第二条事件消费路径。
- App 当前把角色/Writer 的 notice 接到同一个 `notify`（`apps/web/src/App.tsx:264-268`）；迁移后世界变化 Toast 必须与通用 notice、角色台词、ActivityRail 在状态和文案上分开。
- `ActionFeedback` 明确是本地投影，`apps/web/src/lib/action-feedback.ts:8-23`；它携带 `eventId?`，但 `ActionFeedbackStore` 的一次性终态在 `:151-216`，不是世界事件消费器。

### 3.3 迁移结论

保留 `useWorld` 当前唯一判重入口和整层重取；新增 `apps/web/src/lib/world-event-toast.ts` 作为纯 reducer/store/selector 模块。`useWorld` 在已经通过 `noteWorldEvent` 的同一 `world_event` 分支中调用该模块；App 通过 selector 读取状态并渲染，不监听原始 WS 或新增 `window` 事件。

## 4. 事件白名单、对象字段与可见范围

### 4.1 允许展示的事件白名单

冻结为以下 11 类，顺序也是优先级/文案注册表的稳定顺序：

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

`packages/shared/src/schemas/events.ts:9-25` 的封闭枚举还包含 `character_moved`、`following_changed`、`character_talked`、`world_snapshot`、`world_rolled_back`；它们本篇**不进入 Toast**。新增类型必须先变更上位 schema、事件广播契约和本篇模板，不得由前端把未知值强制转成“世界已更新”。

### 4.2 事件字段依据

事件的完整 shape 来自 `packages/shared/src/schemas/events.ts:111-125`：`seq` 为正整数、`id` 为稳定 id、`projectId`、`type`、`actor`、可空 `layer/subject/turn`、自足 `detail`、事实时间 `createdAt`。细节字段依据：

- `entity_created`：`path/name/kind/summary?`（`events.ts:43-48`）；
- `entity_edited`：`path/name/kind`（`events.ts:49`）；
- `entity_deleted`：`path/name`（`events.ts:50`）；
- `entity_moved`：`from/to/name/near?/rewrote/dangling`（`events.ts:51-58`）；
- `choice_selected`：`path/name/choice/index`（`events.ts:74-79`）；
- `roll_resolved`：`path/name/dice/desc/expect/result/passed`（`events.ts:80-88`）；
- `use_item_on`：`item/itemName/target/targetName`（`events.ts:89-94`）；
- `layer_entered`：`layer/name/first`（`events.ts:95`）；
- `layer_initialized`：`layer/name/by/files`（`events.ts:96-101`）；
- `layer_init_failed`：`layer/reason/fallback`（`events.ts:102-106`）。

首层只使用 `name`、对象名、层名、数量和结果；`path`、`seq`、`event.id`、`actor`、`turn` 放进可展开“详情”，避免把内部路径冒充玩家需要的下一步。禁止显示绝对路径、原始 args、正文、模型思维或未经裁剪的错误堆栈。

### 4.3 世界范围与层范围

`event.projectId` 必须与当前 active world 相符；不相符的事件丢弃且不加入 Toast seen。`event.layer` 或 detail.layer 若存在，用于标注对象所在层；没有 layer 时只显示全局对象名。层切换不改变世界事实，也不重新播放已见 id；切换时可以清除尚未显示的旧层批量项，避免 Toast 越过当前 active projection。

## 5. 输入、签名与纯投影接口

### 5.1 内部接口（NEW，不是网络 payload）

实现时在 `apps/web/src/lib/world-event-toast.ts` 直接引用 `WorldEvent` 与 `WorldEventType`，不得复制 schema：

```ts
export const WORLD_TOAST_EVENT_TYPES = [
  'entity_created', 'entity_moved', 'entity_deleted', 'entity_edited',
  'choice_selected', 'roll_resolved', 'use_item_on',
  'layer_entered', 'layer_initialized', 'layer_init_failed',
] as const;

export interface WorldToastEntry {
  key: string;                 // 单条为 event.id；合并条为第一个 id
  eventIds: readonly string[]; // 合并成员，审计/去重用
  latestSeq: number;
  type: WorldToastEventType | 'entity_batch';
  layer: string | null;
  status: 'changed' | 'recorded' | 'failed';
  message: string;             // 第一层：状态 → 对象/理由 → 下一步
  detail: string | null;       // 可展开，不能与 message 矛盾
  createdAt: string;
  expiresAt: number;
}

export interface WorldToastState {
  visible: readonly WorldToastEntry[];
  queued: readonly WorldToastEntry[];
  seenIds: ReadonlySet<string>; // 与 useWorld 的 200-id 窗口同边界，非世界真相
  lastSeq: number | null;
}

export type WorldToastAction =
  | { type: 'world-event'; event: WorldEvent; now: number }
  | { type: 'tick'; now: number }
  | { type: 'dismiss'; key: string }
  | { type: 'reset'; reason: 'world-switch' | 'reconnect' | 'layer-switch' };

export function reduceWorldToast(
  state: WorldToastState,
  action: WorldToastAction,
): WorldToastState;
```

`reduceWorldToast` 是无 DOM、无网络、无时钟副作用的纯 reducer；`now` 由调用方传入。真实 timer 只在 store adapter 中调用 `tick(Date.now())`，便于 deterministic `node:test`。

### 5.2 `useWorld` 接线签名

在 `useWorld.ts` 的现有 `world_event` 分支中，顺序固定为：

```ts
if (!ev || typeof ev.id !== 'string') break;
if (!noteWorldEvent(ev.id)) break;
worldEventToastStore.ingest(ev as WorldEvent);
forwardWorldEvent(msg);       // 既有刷新接缝
handleLayerInitEvent(ev);      // 既有 ghost 清理
void fetchLayer(layerRef.current);
```

实际实现可调整函数名，但不得改变顺序或另开监听器。`worldEventToastStore.ingest` 只接收已经通过 `noteWorldEvent` 的事件；reducer 仍以 `event.id` 做投影幂等防线，避免测试/未来 adapter 误送重复副本。ActionFeedback 的 `details.event` 不调用 `ingest`。

### 5.3 Store/selector 接口

```ts
export const worldEventToastStore: WorldEventToastStore;
export function useWorldToasts(): readonly WorldToastEntry[];
export function selectWorldToastSnapshot(): WorldToastState;
export function resetWorldToasts(reason: WorldToastAction['reason']): void;
```

App 只消费 `useWorldToasts()`，Toast 组件只接收已经完成文案归一化的 `WorldToastEntry`。组件不得从 entry 重新读取 `detail` 猜 success，也不得直接操作 `seenIds`。

## 6. 逐步行为与漏接后果

### 6.1 正常事件路径

1. **WS 入站**：server 尾读 `history.db.events` 后发送 `{type:'world_event',event}`；`event.createdAt` 是落账事实时间，外层 `timestamp` 是广播时间（`docs/tools/12-工具注册与路由统一.md:610-632`）。
2. **结构检查**：没有字符串 `id` 的帧立即丢弃；`event.type` 不在白名单也不进入 Toast。
3. **唯一判重**：调用现有 `noteWorldEvent`，首次事件继续，重复 id 停止；窗口上限 200、FIFO 淘汰沿用 `useWorld.ts:109-110,314-327`。
4. **纯归一化**：按 type 读取 schema 约定的 detail 字段，生成状态、对象、理由、下一步和详情层。
5. **批量决策**：仅符合 §8 合并条件的实体事件进入同一批；选择/骰子/使用物品/初始化保持独立语义。
6. **投影入队**：新 entry 进入 visible 或 queued；更新 `lastSeq`，不修改世界、不触发动作、不触发 Writer。
7. **事实接管并行发生**：`useWorld` 继续按现状重取 layer；Toast 文案不等待 DOM、文件监听或网络再次确认，也不把重取成功当事件成功。
8. **可见与消失**：App 渲染 `role="status"`；TTL 到期由 `tick` 移除。用户可关闭单条，但关闭不影响 seen id。

### 6.2 每一步漏接的后果

| 漏接步骤 | 可见后果 | 违反的边界 |
|---|---|---|
| 结构检查 | 坏帧污染 seen，之后真实同 id 被吞掉 | 畸形帧不能影响判重 |
| 唯一判重 | HTTP 事件副本与尾读事件显示两次 | `event.id` 幂等失效 |
| schema/detail 检查 | 缺字段时文案出现 `undefined` 或虚构对象 | 不能从路径/点击补事实 |
| 批量边界 | 多条更新霸屏，或把不同层/动作误合成一条 | 合并不能丢语义 |
| 事实与投影分离 | Toast 被误读为再次写入/再次执行 | Toast 只读 |
| TTL/tick | stale 事件长期遮挡，或页面隐藏后回放旧提示 | 瞬时 chrome 必须可恢复 |
| world reset | 上一个世界的 Toast 泄漏到新世界 | projectId 作用域错误 |
| 错误降级 | `layer_init_failed` 被当成成功，谜题被误判已解 | 失败必须可见、不可软化 |

## 7. 文案层级与逐类模板

### 7.1 统一文案层级

每条 Toast 第一层必须按以下顺序组织：

```text
当前状态/结论 → 可核验对象或理由 → 当前有效下一步
```

第一层长度目标为桌面不超过两行、窄屏不超过三行；详情层再披露 `event.id`、`seq`、类型、actor、layer、subject、路径和 `turn`。技术诊断只在详情或独立 alert 中出现，不能把 `evt-41` 当玩家文案。

模板中的“已记录”只表示事件已经到达前端，不能替代文件阅读；“已落定”只适用于骰子结果已在事件 detail 中明确存在。所有“已”都必须有对应事件字段。

### 7.2 单事件模板

| 事件 | 第一层（状态 → 对象/理由 → 下一步） | 详情层与限制 |
|---|---|---|
| `entity_created` | **“已创建「{name}」。对象已出现在 {layerName}。下一步：打开它查看内容。”** | `kind/path/summary` 作为详情；不得说“线索已解开”。 |
| `entity_moved` | **“「{name}」已移至 {toLabel}。对象位置已更新。下一步：在新位置查看它。”** | 可显示 `from → to`、`near`、`rewrote/dangling`；`dangling > 0` 时补“有 {n} 个引用待检查”，不掩盖风险。 |
| `entity_deleted` | **“已删除「{name}」。该对象不再出现在原位置。下一步：重新查看当前场景。”** | 显示 `path`；不得暗示相关谜题、角色记忆或结局被删除。 |
| `entity_edited` | **“「{name}」已更新。对象内容已记录修改。下一步：重新打开查看。”** | 显示 `kind/path`；不显示正文，不把编辑者当作故事角色发言。 |
| `choice_selected` | **“已记录选择「{choice}」。对象：{name}。下一步：查看场景或等待后续响应。”** | 显示 `index/path/actor`；明确：选择记录本身不保证文件变化、不保证作家已回应。 |
| `roll_resolved` | **“「{name}」的掷骰已落定：{result}，{通过/未通过}。下一步：按结果查看场景。”** | 显示 `dice/desc/expect/rolls`；`passed` 是本次检定事实，不是谜题解决证明、结局证明或权限绕过。失败检定仍是已落账的结果。 |
| `use_item_on` | **“已记录将「{itemName}」用于「{targetName}」。下一步：查看目标是否出现明确变化。”** | schema 当前字段只保证 item/target 名称；若未来 detail 有 `handled/reason/presentation`，只能在详情层说“目标已响应/未生效”，不能由 Toast 自行变成“已解锁”，也不能消费物品。 |
| `layer_entered` | **“已进入「{name}」。当前场景已切换。下一步：查看本层的线索。”** | 显示 `layer/first`；`first:true` 只表示入口 gate 的 first 语义，不表示初始化完成。 |
| `layer_initialized` | **“「{name}」已完成初始化。场景内容已落地。下一步：打开场景查看。”** | 显示 `by/files.length` 与可裁剪文件名；不写“谜题已解决”，不把文件数量当叙事完成度。 |
| `layer_init_failed` | **“「{layerName}」尚未完成初始化。原因：{safeReason}。下一步：{fallback=template ? ‘查看模板并重试’ : ‘返回上一层或稍后重试’}。”** | 原因必须是服务端安全摘要；不得显示堆栈、绝对路径或“初始化成功”。该 Toast 为失败事实提示，即使它没有创建内容。 |

### 7.3 角色与系统语气

Toast 是系统状态，不伪装成角色、Writer 或玩家第一人称。`actor` 只在详情显示“由玩家/作家/引擎记录”，除非上位文案契约明确要求，否则第一层不写“某角色说”。角色台词仍只进 CharacterModal；Writer 正文仍只经 Chalk。

“下一步”必须是现有可做动作：打开/重新打开对象、查看当前层、等待后续响应、重试或返回；不能写没有入口的“继续探索”。文案不能将“世界已变化”扩写为“你已找到答案”。

## 8. 批量合并、TTL 与生命周期

### 8.1 冻结常量（实现落在模块导出）

```ts
export const WORLD_TOAST_BATCH_WINDOW_MS = 900;
export const WORLD_TOAST_CHANGED_TTL_MS = 3600;
export const WORLD_TOAST_FAILED_TTL_MS = 6000;
export const WORLD_TOAST_MAX_VISIBLE = 3;
export const WORLD_TOAST_MAX_QUEUE = 12;
export const WORLD_TOAST_SEEN_LIMIT = 200;
```

计时只用于视觉投影，不代表世界事件的有效期；`event.createdAt` 不被改写。页面隐藏、Effects off、Reduced Motion 只取消动效，不取消文本或延长 TTL。

### 8.2 合并规则

只合并以下实体变化：`entity_created/entity_edited/entity_moved/entity_deleted`，且必须满足：

- 同一 `projectId`、同一 `layer`（`null` 只与 `null` 合并）；
- 按 `event.seq` 递增；
- 前一条入队与当前 `now` 相差不超过 900ms；
- 不跨越 `choice_selected`、`roll_resolved`、`use_item_on`、`layer_*` 或失败条目；
- 同一对象的连续 edit/move 可合并，但 `delete` 作为批次最后动作保留“已删除”结论，不写成“已更新”。

批次显示：

- 同类：`已创建 3 个对象。对象：钥匙、信件等。下一步：打开场景查看。`；
- 混合实体变更：`场景已更新 3 项。对象：钥匙、门、信件。下一步：重新查看当前层。`；
- 超过三个对象只显示前两个和“等 {n} 项”，详情层保留全部 `eventIds` 和对象名；
- 选择、掷骰、使用物品、进入和初始化永不与实体批次合并，因为合并会隐藏行动语义和结果边界。

批次 `key` 为首事件 id，`eventIds` 保留所有成员，`latestSeq` 取最大值；批次不丢事件，只合并视觉通知。事件 id 全部标记 seen，后续重复帧不重新出现。

### 8.3 可见上限、队列和 TTL

最多同时展示 3 条；新增条目按 `latestSeq` 正序进入。超过上限的条目进入长度最多 12 的队列，队列满时优先保留失败、初始化失败和最新 seq，淘汰最旧且已过 TTL 的 changed 条目；不得静默淘汰未过期失败提示。

- changed（创建/移动/删除/编辑/选择/骰子/使用物品/进入/初始化成功）默认 3600ms；
- `layer_init_failed` 默认 6000ms；
- 批次合并后 TTL 从最后一次纳入批次的 `now` 重新计算；
- `tick(now)` 先移除 `expiresAt <= now`，再把 queued 中仍有效的条目补入 visible；
- `dismiss` 只移除当前投影，不清除 event id，也不触发 refresh、重试或动作。

## 9. 前后端接线、Toast/ActivityRail 区别与错误边界

### 9.1 前后端接线

```text
动作函数 / 玩家路由 / agent 工具
  → appendEvent（已提交 history.db）
  → server event bridge 尾读 events
  → WS { type: 'world_event', event }
  → useWorld.ts 唯一 onMessage
  → noteWorldEvent(event.id)
  → worldEventToastStore.ingest(event)
  → useWorldToasts selector
  → App / WorldToastRegion
```

服务端只负责事件落账和广播；不新增 Toast 专用 HTTP/WS 帧、不写“Toast 已读”事件。现有 `file_changed` 仍可触发 `fetchLayer`，但不能触发世界成功 Toast。`fs.watch` 只是重取触发源，不能进入 `worldEventToastStore`。

App 接线建议为 `useWorldToasts()` + `<WorldToastRegion entries={...} />`，挂在 shell 的 `chrome` 区域，`aria-live="polite"`、每条 `role="status"`；失败初始化可使用 `role="alert"` 的独立错误层，但不改变事件事实。组件只渲染 entry，不监听 `airp:world-event`、`airp:agent-frame` 或原生 WebSocket。

### 9.2 Toast 与 ActionFeedback 的区别

| 维度 | Toast | ActionFeedback |
|---|---|---|
| 回答 | 世界发生了什么 | 本次请求处于什么状态 |
| 输入 | 已判重 `world_event` | `ActionFeedbackStore.begin/settle/cancel` |
| 生命周期 | 事件到达后短暂显示，可批量 | 一次 key 的 pending 到终态，见 `action-feedback.ts:151-216` |
| 失败 | `layer_init_failed` 等世界/初始化事件事实 | rejected/conflict/failed/cancelled 的请求事实 |
| 是否写世界 | 否 | 否，明确见 `action-feedback.ts:8-9` |
| 成功依据 | event detail 的权威字段 | ActionResult 的结构化 details，不是 HTTP 2xx alone |

例如 `/api/use-item` 返回 accepted 不直接 Toast；只有对应 `world_event{use_item_on}` 到达，Toast 才提示“已记录使用”。反过来，作家或引擎落账而没有当前组件 ActionFeedback 时，仍可显示世界 Toast。

### 9.3 Toast 与 ActivityRail 的区别

`agentActivityStore` 是 Agent activity 唯一状态源；它消费 `agent_activity`，而不是世界事件。其既定路径是 `useWorld.ts → agentActivityStore → useAgentActivity → ActivityRail/activity log`（`docs/ux/08-niko功能迁移契约.md:41-49`）。

| 维度 | 世界 Toast | Agent ActivityRail |
|---|---|---|
| 事实级别 | 已落账世界变化 | 临时执行过程/阶段 |
| 允许输入 | 白名单 `world_event` | `agent_activity`；不读 `tool_start` 作为玩家事实 |
| 示例 | “「钥匙」已移至背包” | “正在读取钥匙” → “读取了钥匙” |
| 丢失含义 | world_event 丢失需重连/重取诊断 | 活动帧丢失不改变世界真相 |
| 作用域 | 当前世界，按层标注 | writer/functional 全局，character 仅当前角色 rail |
| 是否证明世界变化 | 是，且仅证明 detail 所写的事实 | 否；completed 不是落账证明 |
| 是否是台词 | 否 | 也不是；角色台词仍在 CharacterModal |

角色版 ActivityRail 必须保持在当前角色对话纸外沿，不进入 Toast 区域，不把“角色正在 use”写成“物品已生效”。World Toast 也不能把 activity 的 `completed`、`tool_end` 或 `chalk_landed` 当作 `entity_created`。

### 9.4 错误、失败、回放和重连

1. **未知 type**：不进入 Toast；开发/诊断可记录安全的契约漂移信息，但不显示成功文案、不写事件。
2. **白名单 type 但 detail 缺字段/类型错误**：不合成对象名，不从 `subject`、文件名、点击目标补值；显示一次独立系统错误“世界更新暂时无法显示，请重新读取”，或交给既有 notice；该错误不是世界变化 Toast。
3. **`layer_init_failed`**：进入失败 Toast，保留 fallback 语义；不能被 `fetchLayer` 成功、ghost 消失或文件存在覆盖。
4. **网络断开/重连**：socket close 不制造世界变化 Toast；沿用 `useWorld.ts:677-685` 的重连。重连不回放旧历史；后续新 `event.id` 正常投影，已见 id 仍由 200-id 窗口拦截。连接失败提示走通用 notice，不伪装成世界事件。
5. **世界切换**：`airp:world-unavailable` 时清空 Toast visible/queue/seen，和 `useWorld.ts:144-154` 清空 state/去重集合保持同一边界；新 `projectId` 的事件才可显示。旧世界 TTL 到期不应泄漏。
6. **层切换**：不回放历史；清除尚未显示且绑定旧 active layer 的 queued 条目，已显示条目可立即 dismiss。迟到旧层事件仍按 id/seq 接收但只在其事实适合当前世界时显示层标签，不改变当前层。
7. **浏览器回放/历史查看**：若未来历史面板主动传入 event，必须使用 `mode:'replay'` 的纯 projection API；默认不调用 live `ingest`，不播音、不重置 TTL、不触发 action。历史回放必须另有“回放”标记，不能冒充刚刚发生。
8. **事件落账失败**：没有 `world_event` 就没有世界 Toast；ActionFeedback 或 ActivityRail 可显示失败/处理中。若后续确有事件到达，以事件为准，不能补发第二条。
9. **刷新/页面隐藏**：刷新只显示新到且未过期的实时事件，不从 localStorage 恢复旧 Toast；页面隐藏时保留状态但不补播动画，回到页面由 TTL 决定是否仍可见。

## 10. 测试、桌面/窄屏浏览器验收

### 10.1 纯 reducer 测试（`node:test`，不依赖 DOM/网络）

建议测试文件：`apps/web/test/world-event-toast.test.mjs`，通过可直接导入的纯函数/编译产物测试；本设计阶段不执行命令。

每个测试必须构造完整合法的 `WorldEvent` fixture，并断言 observable state：

| 编号 | 测试 | 必须证明 |
|---|---|---|
| T01 | 首次白名单 `entity_created` | 产生一条 changed entry，包含 name、对象下一步和 event id |
| T02 | 同 id 重复两次 | visible/queue 数量不变，`eventIds` 不重复，message 不重复 |
| T03 | 两个不同 id、900ms 内、同 layer 的 create | 合并为一条，count=2，两个 id 都被记忆 |
| T04 | 不同 layer 的 create | 不合并，顺序按 seq 保持 |
| T05 | 选择后紧接 roll/use item | 三条语义不被混成 entity batch；每条可单独说明下一步 |
| T06 | 200+1 事件 | seen 窗口 FIFO 淘汰最旧；未淘汰 id 重放不重复，已淘汰 id 可按窗口语义再次接收 |
| T07 | `layer_init_failed` | status=failed、TTL=6000、fallback 影响下一步，不显示成功词 |
| T08 | malformed detail / unknown type | 不创建世界变化 entry；只能得到可观测的 projection error，不虚构对象 |
| T09 | `tick` 边界 | `expiresAt === now` 被移除，queued 只按有效 TTL 补入 |
| T10 | visible=3 与 queue=12 | 失败优先/新 seq 规则可观察，未过期失败不被静默丢失 |
| T11 | reset world-switch | visible、queue、seen 全清空；新 projectId 事件可进入 |
| T12 | replay mode | 不改变 live seen、不过期计时、不触发音频/action side effect |
| T13 | `roll_resolved.passed=false` | 显示“未通过”检定事实，且断言文案不包含“谜题已解决/答案已确认/结局已完成” |
| T14 | use item detail 只有 schema 字段 | 只说“已记录将…用于…”，不猜 handled/消耗/解锁 |

另外在 `useWorld` 接线测试中证明：同一 `world_event` 只调用一次 Toast ingest；`file_changed`、`tool_start`、`fs.watch` 模拟输入不会调用 Toast reducer；组件无需注册任何原始 WS listener。

### 10.2 桌面浏览器验收

浏览器验收尺寸至少包含 1440×960：

1. 通过真实 WS 事件或受控事件注入让同层连续创建/编辑 3 个对象：只显示一个合并 Toast，仍能展开详情看到 3 个 `event.id`；
2. 依次触发 choice、roll（passed=false）、use item：每条按 seq 独立出现，骰子“未通过”不出现 puzzle solved 文字；
3. 初始化成功与失败各走一条真实事件路径：成功可见“内容已落地”，失败可见原因和重试/返回下一步；
4. 触发同一 id 的重复广播：只出现一次；刷新或重连：不回放旧 Toast；切换世界：旧 Toast、队列、seen 清空；
5. 同时打开 ActivityRail：Toast 与 ActivityRail 分区明确，`tool_start`/activity completed 不制造世界 Toast；角色对话台词不进入 Toast；
6. `prefers-reduced-motion`、Effects off、页面隐藏：Toast 文本仍可读，动画可消失或不播放，不新增成功音效。

### 10.3 窄屏浏览器验收

在 390×844（另测桌面窄窗）验收：

- Toast 不遮挡发送栏、背包按钮、角色入口、门卡和 ActivityRail 的可操作区域；
- 多行文案最多三行，长对象名截断但详情仍可访问；批次显示“等 N 项”而不是横向溢出；
- `aria-live` 更新一次只播报一次，不因 React 重渲染重复朗读；键盘/触摸可关闭；
- 三条 visible + queue 条件下，最新失败 Toast 可见且不被旧 changed 条目挤出；
- 窄屏切层、断线、回到页面后文本仍符合当前 layer/world，不出现上一个世界的 Toast。

## 11. 发现的冲突 / 需要修订的上位文档

1. **`useWorld` 当前转发集合与迁移契约的白名单不一致。** `apps/web/src/state/useWorld.ts:329-338` 只转发四个 `entity_*` 类型，但 `docs/ux/08-niko功能迁移契约.md:51-70` 要求 Toast 覆盖 11 类。建议不修改现有 `airp:world-event` 刷新语义，而是在同一 `noteWorldEvent` 成功分支内直接调用 Toast store；若实现者选择扩大 `forwardWorldEvent`，必须先与 App/Nook owner 协调噪音和刷新范围。
2. **共享 schema 的 `use_item_on` 没有 `handled/reason/presentation`。** `packages/shared/src/schemas/events.ts:89-94` 只冻结 item/target 四个名称字段；而 `docs/tools/12-工具注册与路由统一.md:601-602,707-708` 要求演出按 `detail.handled/targetKind` 驱动。本文因此只设计“已记录使用”安全文案，不把可选字段当成功依据。若产品必须展示“目标未生效/已响应”，应由工具/schema owner 先回写字段契约和测试，本篇再补模板。
3. **现有 App Toast 是单字符串单计时器。** `apps/web/src/App.tsx:145-155,219-226` 不支持多条、批量、失败 TTL 和事件 id。该设计要求新增投影组件/store，但不应把 `notify` 继续扩展成第二套世界事件状态；角色/Writer notice 迁移由 App owner 单独协调。
4. **共享文档同时保留 `airp:world-event` 自定义事件刷新接缝。** `docs/tools/12-工具注册与路由统一.md:681-699` 允许其作为背包刷新优化，但本篇禁止 Toast 监听它，以免 `file_changed` 和 `world_event` 重复。若未来删除该自定义事件，必须同步迁移 Nook/Chrome 刷新 owner，不能由本文单独删。

## 12. 仍未知待拍板与完成判据

### 12.1 仍未知 / 待评审

1. 最终 `WorldToastRegion` 的 DOM 挂载点和视觉 token（由 `docs/ux/01`、`02`、`03` owner 确定）；本篇只冻结 `chrome` 语义、ARIA 和不遮挡动作区。
2. “详情”交互采用展开按钮、hover/focus 还是专用历史入口；必须兼容键盘、触摸和窄屏，不改变第一层文案。
3. `projectId` 当前 active 值由 `useWorld` 暴露还是由 App manifest 接线提供；实现前必须选一个唯一 owner，不能允许 Toast 读两个可能不同的 world id。
4. `layer` 切换时已显示 Toast 是立即清空还是保留至 TTL；本文冻结 queued 旧层清除，visible 具体策略待 App chrome 评审。
5. 是否为 replay mode 建立现有历史面板调用接缝；在未拍板前，live Toast 不接受历史事件注入。

### 12.2 完成判据

- [ ] `useWorld.ts` 仍是唯一 WS 入站和 `world_event` 判重入口；没有组件级原始 WS/`airp:agent-frame` listener。
- [ ] 11 类白名单有逐类模板；schema 外类型没有通用成功 fallback；`event.id` 重复只产生一次投影。
- [ ] 创建/移动/删除/编辑/选择/掷骰/使用物品/进入/初始化成功与失败均按“状态 → 对象/理由 → 下一步”显示。
- [ ] 明确写出并测试：Toast 不是谜题解决证明；`roll_resolved.passed`、`layer_initialized`、`use_item_on` 都不会被扩写为解谜/结局成功。
- [ ] 合并只发生在同层实体事件；900ms、visible=3、queue=12、changed=3600ms、failed=6000ms 可由纯 reducer 测试观察。
- [ ] world switch 清空跨世界投影，reconnect 不回放历史，失败/畸形/未知/回放行为不制造成功假象；不写任何事件。
- [ ] ActionFeedback 继续负责请求终态，ActivityRail 继续负责 Agent 过程；两者与 Toast 不共享第二套世界真相。
- [ ] 桌面 1440×960 与窄屏 390×844 浏览器验收均通过：不遮挡操作、不会重复朗读、Reduced Motion/Effects off/hidden 仍保留文本和下一步。
- 实现已由主代理完成；专项测试、`pnpm check:ws`、`pnpm check:i18n` 和浏览器冒烟结果登记在本次交付记录中。
