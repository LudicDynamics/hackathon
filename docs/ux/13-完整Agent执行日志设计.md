# 完整 Agent 执行日志设计

> 状态：已实现（2026-09-14）；本文保留 selector/projection 与验收契约。
>
> 本文服从：`docs/ux/08-niko功能迁移契约.md`、`docs/ux/00-共同上下文.md`、`docs/agent-awareness/00-共同上下文.md`、`docs/agent-awareness/02-作家与功能Agent活动设计.md`、`docs/agent-awareness/03-前端感知演出设计.md`、`docs/agent-awareness/01-角色多消息与TTS清洗设计.md`。
>
> 本文只设计完整日志的前端 selector/projection 与邻接 UI；不改共享帧契约，不增加 WS listener，不替换角色台词聚合，不新增 store/reducer。凡“现状是”均带 `file:line`；无法由当前代码或冻结文档确认的内容标为“[未知]”。

---

## 1. 一句话定位

**在不展示 chat history、思维链或原始工具参数的前提下，把同一个 `agentActivityStore` 中已归一化的 writer、functional 与当前角色 activity 投影为可展开、可折叠的完整执行日志；底部 `ActivityRail` 继续承担低干扰的前三条即时胶囊，完整日志承担“这一次执行做过哪些公开动作、哪些动作失败或被中断”的可回看摘要。**

完整日志是玩家感知层，不是世界事实层：它只说明 Agent 的公开执行活动；世界是否真的改变，仍以文件和已提交 `world_event` 为准。`agent_activity` 不进入 `history.db`，不成为角色台词，不触发 TTS。

本篇明确不做：

- 不显示原始 `toolName`、`args`、`details`、绝对路径、文件全文、prompt、chat history 或模型思维；
- 不从 `tool_start`、文件监听、组件点击或日志条目推断世界写入成功；
- 不新建 `agentActivityLogStore`、第二 reducer 或组件级 `window` 原始帧监听；
- 不把完整日志变成 Writer stop、busy、phase 或 completion 的另一份真相；这些仍归 `writer-state.ts` 与既有 Writer public state；
- 不让角色 activity 混入全局 writer/functional 日志，也不让角色关闭后的条目泄漏到下一角色；
- 不把日志条目朗读为角色语音，不改变页面原始台词和 TTS 清洗语义。

---

## 2. 输入、签名与投影形状

### 2.1 输入：只接受冻结的 `agent_activity`

输入逐字复用 `docs/agent-awareness/00-共同上下文.md §3` 的 `AgentActivityFrame`：

```ts
interface AgentActivityFrame {
  type: 'agent_activity';
  source: 'writer' | 'character' | 'functional';
  agentId: string;
  turnId: string;
  activityId: string;
  phase: 'started' | 'completed' | 'failed';
  operation:
    | 'read' | 'create' | 'write' | 'edit' | 'delete' | 'move'
    | 'use' | 'look' | 'roll' | 'choose' | 'initialize' | 'other';
  subject?: string;
  toolName?: string;
  error?: string;
  timestamp: string;
}
```

服务端已经负责 operation 白名单、subject 裁剪和安全错误摘要；前端继续使用 `normalizeAgentActivityFrame` 作为边界守卫，不能从 `toolName` 或未知字段重新生成文案。

### 2.2 完整日志的纯投影签名（`apps/web/src/lib/agent-activity.ts`）

以下是新增的纯函数签名（NEW）；它们接收 store 中已经归一化的 `AgentActivity`，不接收 `unknown` 原始帧，也不做 I/O：

```ts
export type ActivityLogScope = 'rail' | 'character-modal';

export interface ActivityLogQuery {
  surface: ActivityLogScope;
  /** 角色日志必须传 character:<id>；全局日志省略。 */
  agentId?: string;
  /** 可选：只看一个 engine turn。 */
  turnId?: string;
  /** 角色 modal 新开时使用，避免复用上次打开的旧记录。 */
  since?: number;
  /** 默认包含 terminal；false 仅显示仍在工作的条目。 */
  includeTerminal?: boolean;
}

export interface AgentActivityLogTurn {
  source: ActivitySource;
  agentId: string;
  turnId: string;
  state: ActivityState;
  entries: readonly AgentActivity[];
  startedAt: number;
  endedAt?: number;
}

export function selectAgentActivityLog(
  records: readonly AgentActivity[],
  query: ActivityLogQuery,
): readonly AgentActivityLogTurn[];

export function selectAgentActivityLogEntries(
  records: readonly AgentActivity[],
  query: ActivityLogQuery,
): readonly AgentActivity[];
```

约束：

1. `surfaceForSource` 是唯一 surface 映射：writer/functional → `rail`，character → `character-modal`；不能按工具名猜 surface。
2. `agentId` 若存在必须逐字等于稳定 ID；角色只接受 `character:<characterId>`，不得从 `subject` 或旧 `characterId` 字段修复身份。
3. `turnId` 只用于分组和过滤，不在 UI 中显示，也不拆成 session/run 信息。
4. 同一 `activityId` 只出现一条；`started → completed/failed` 是同一行状态更新，不生成重复行。
5. `selectAgentActivityLog` 的 turn 状态按条目归并：有 running 即 `running`；无 running 但有 error 即 `error`；其余为 `ok`。这只是日志摘要，不是 `agent_progress` 或 `writer-state`。
6. 返回顺序固定为最新 turn 在前、同一 turn 内按 `startedAt` 升序；同一时间以 `activityId` 字典序稳定排序。
7. `since` 只用于 modal 会话隔离，不改变 store 中的记录，也不改变服务端帧。

### 2.3 同一 store 的接口扩展

完整日志需要在 rail terminal TTL 消散之后仍能回看；因此扩展**现有** `AgentActivityStore`，而不是建立第二 store：

```ts
export interface AgentActivityStore {
  subscribe(cb: () => void): () => void;
  /** 既有：供 ActivityRail 的可见胶囊使用，继续受 TTL/3 条上限约束。 */
  getSnapshot(): readonly AgentActivity[];
  /** NEW：同一 store 的归一化、去重后日志记录；不含原始帧。 */
  getLogSnapshot(): readonly AgentActivity[];
  ingest(raw: unknown, now?: number): boolean;
  clearSurface(surface: ActivitySurface, now?: number): void;
  clearAll(): void;
  tick(now?: number): void;
}
```

`getLogSnapshot()` 不是第二状态源：`ingest`、`clearSurface`、`clearAll` 是唯一写入口；它与 `getSnapshot()` 共用同一份归一化和 `activityId` 吸收规则。实现可以在 `agent-activity-store.ts` 内维护两个**投影数组**（rail projection 与 bounded log projection），但不得暴露第二 reducer、第二订阅入口或让组件自行合并帧。

日志记录建议增加一个仅供实现的上限常量 `ACTIVITY_LOG_MAX_ENTRIES = 200`：优先淘汰最早的 terminal 记录；running 记录不得为满足软上限而静默删除。该数量仍需评审确认，见 §12。

### 2.4 React hook 与 UI 签名

在 `apps/web/src/state/useAgentActivity.ts` 增加同一 store 的读取 hook：

```ts
export interface AgentActivityLogView {
  turns: readonly AgentActivityLogTurn[];
  entryCount: number;
  runningCount: number;
  aria: string;
}

export function useAgentActivityLog(query: ActivityLogQuery): AgentActivityLogView;
```

在 `apps/web/src/components/chrome/ActivityRail.tsx` 邻接新增日志组件（NEW）：

```tsx
export function AgentActivityLog(props: {
  query: ActivityLogQuery;
  sessionLabel?: string;
  className?: string;
}): JSX.Element | null;
```

组件只从 `useAgentActivityLog` 读取投影；展开/折叠状态是组件局部 UI state，不是活动状态，不进入 store、不进入 WS、不持久化。

---

## 3. 逐步行为与漏接后果

### 3.1 帧进入唯一消费入口

1. 服务端按 `agent_activity` 发射安全帧；既有 `tool_start/tool_end`、`agent_progress` 和 `world_event` 继续各自服务原有职责。
2. `apps/web/src/state/useWorld.ts` 的唯一 WS `onMessage` 进入 `case 'agent_activity'`，调用 `agentActivityStore.ingest(msg)`。
3. store 先归一化，再按 `activityId` 幂等归并；同一条记录同时更新 rail projection 和 log projection。
4. hook 使用 `useSyncExternalStore` 订阅同一个 store；rail 调 `visibleActivities`，日志调 `selectAgentActivityLog`。

**漏了第 1 步：** 服务端没有安全帧，日志只能伪装成 UI 点击记录，无法覆盖真实模型工具循环。

**漏了第 2 步：** WS 帧成为 dark frame；ActivityRail 和完整日志都看不到，组件若自行监听则会产生第二消费路径。

**漏了第 3 步：**重复/乱序帧会造成两行同一动作，terminal 可能回退成 running；日志会把一次工具调用错误地显示为多次。

**漏了第 4 步：** rail 与日志会各自去重、各自定时，必然出现数量、顺序和终态不一致；这违反“同一 store 的 selector/projection”。

### 3.2 一条活动的完整生命周期

1. `started`：创建 running 记录；日志新增一行，显示本地化的“正在读取/写入/处理”，并把该 turn 标为 running。
2. `completed`：用相同 `activityId` 更新同一行到 ok；显示“已读取/写下/处理完成”。完成不代表世界事件已落账，只代表该工具调用收到成功 terminal。
3. `failed`：更新同一行到 error；只显示“未能完成该动作”“已停止”或“耗时过久”等安全摘要映射。
4. rail 按既有 `ACTIVITY_COMPLETE_TTL_MS = 2400`、`ACTIVITY_FAILED_TTL_MS = 4500` 消散；日志记录不因 rail TTL 消失而立即删除。
5. running 超过 `ACTIVITY_STALE_TTL_MS = 90000` 时，rail 与日志投影都转为 `errorKind: 'timeout'`；同一条记录仍只有一行。

**漏了终态更新：** 日志永久显示工作中，玩家无法知道该动作是完成、失败还是断线。

**把 completed 当世界成功：** 会在尚未收到 `world_event` 时造成“已解决/已写入世界”的假反馈，违反文件/事件真相。

### 3.3 turn 分组、完整性与折叠

1. `selectAgentActivityLog` 先按 `(source, agentId, turnId)` 分组，不能只按 `agentId` 合并；同一 Agent 的不同 engine turn 必须保持边界。
2. 每个 turn 显示一个摘要行：Agent 本地化名称、动作数量、`running/完成/失败/停止/超时` 之一；不显示 turnId。
3. 新打开日志时，最新的 running turn 自动展开；最新 terminal turn 也可显示其条目，较早 turn 默认折叠。没有活动时组件返回 `null`，不占位。
4. 展开 turn 后显示该 turn 的全部归一化条目，包括 queued 条目和已从 rail 消散的 terminal 条目；每条只展示 operation/state/subject 的本地化组合。
5. 折叠只改变可见 DOM，不删除记录，不暂停 TTL，不改变活动终态；再次展开仍从同一 store selector 得到同一结果。
6. 日志面板支持“全部折叠”和“全部展开”键盘操作；没有“重试”“执行”“确认世界变化”等动作按钮。Stop writing 仍走 `writer-state.ts` 的既有入口。

**只取 rail 的前三条：** 第四条及以后会在完整日志中消失，玩家不能核对一次复杂 Writer turn 是否真的完成。

**用 `activityId`/`toolName` 作标题：** 会暴露内部实现标识，并让模型工具命名成为未经本地化的 UI 文案。

**折叠时删除数据：** 重新展开会出现“日志断层”，且 React 局部状态偷偷变成第二真相。

### 3.4 Writer、functional 与角色的范围

- 全局 `surface: 'rail'` 日志只包含 `source: 'writer' | 'functional'`；Writer 和 `scene-init`/`nook-init` 可以同时存在，按各自 `agentId + turnId` 分组。
- 角色 `surface: 'character-modal'` 日志只包含当前 `agentId = character:<characterId>`；不能把角色工具循环拼入 Writer 全局日志。
- 角色对话纸的 assistant message、delta、idle 仍由 `CharacterModal`/角色 turn 纯模块处理；完整日志不参与分页、文本累计和 TTS。
- functional 的初始化过程只显示“准备场景/准备私人空间”等安全活动；最终是否初始化成功由 `layer_initialized`/`layer_init_failed` 等 `world_event` 和重取画布决定。

**漏掉 functional：** 初始化真实写盘但玩家看不到中间过程；漏掉角色过滤：换角色时旧活动串台。

### 3.5 角色关闭与会话隔离

1. `App.closeCharacter` 先沿用既有 `character_stop` 请求。
2. 同一调用继续 `agentActivityStore.clearSurface('character-modal')`：所有 running 角色记录转为 `errorKind: 'cancelled'`，不得继续显示“正在工作”。
3. `CharacterModal` 卸载，角色日志面板消失；全局日志从 surface 过滤上永远看不到角色记录。
4. 下一次打开角色时创建新的 modal session `since` 时间戳；旧角色记录即使仍在 bounded log 中，也因 `since` 被排除，不能继承到下一次对话。
5. 若服务端迟到 terminal 帧到达，store 的 terminal absorbing 规则只更新原记录，不会重新打开旧 modal 或产生新胶囊。

**漏了第 2 步：** 关闭后角色胶囊会卡在 running，或下一角色看到上一角色的 pending 工具。

**漏了第 4 步：** 同一个角色再次打开时会看到上一次已完成的旧动作，玩家会误以为正在重复执行。

### 3.6 日志、世界事实与 TTS 的硬隔离

- `agent_activity` completed/failed 只更新日志状态；不得调用 `record*`、`appendEvent`、文件写入或 `fetchLayer`。
- `world_event` 仍只由 `useWorld.ts` 现有判重/转发链消费；日志不反过来监听或推断 world event。
- `CharacterModal` 的页面原文、`dialogue-pages.ts` 聚合、共享 `sanitiseTtsText` 和 TTS 请求链完全不读日志；日志文案永远不调用 `prefetchVoice`、`playVoice` 或 `/api/tts`。

**漏了隔离：** 工具 subject 可能被当作台词朗读，或日志“已写入”被误当作世界事实。

---

## 4. 文件与副作用

| 文件 | 设计改动 | 允许副作用 | 明确禁止 |
|---|---|---|---|
| `apps/web/src/lib/agent-activity.ts` | 增加 log query/turn 类型、`selectAgentActivityLog`、`selectAgentActivityLogEntries`、必要的日志上限常量 | 纯数组投影、稳定排序、文案辅助 | React、DOM、WS、文件、TTS、原始参数 |
| `apps/web/src/lib/agent-activity-store.ts` | 在同一 store 增加 bounded log projection 与 `getLogSnapshot()` | `ingest/clearSurface/clearAll/tick` 更新同一 store，并通知既有 subscribers | 第二 store、第二 reducer、组件 listener、DB 写入 |
| `apps/web/src/state/useAgentActivity.ts` | 增加 `useAgentActivityLog(query)` | `useSyncExternalStore` 读取同一 store；locale 变化重算 aria | 直接读 WS、直接写 store、拼接帧 |
| `apps/web/src/components/chrome/AgentActivityLog.tsx` | NEW；邻接 `ActivityRail.tsx` 的可展开 panel/drawer | 局部展开 state、DOM aria、响应式渲染 | 世界动作、Writer stop、TTS、参数展示 |
| `apps/web/src/components/chrome/ActivityRail.tsx` | 保持既有即时 rail；必要时共用日志触发按钮样式 | 继续展示最多 3 条 capsule | 变成完整日志唯一容器、改变 TTL |
| `apps/web/src/state/useWorld.ts` | 保持唯一 `case 'agent_activity'` ingest；不得新建 listener | 将帧交给 store | 新增 `window` 原始帧监听或第二 WS |
| `apps/web/src/App.tsx` | 全局挂载 `AgentActivityLog`；角色打开时传入 session 起点 | 视图挂载和角色 session 参数 | 复制 activity 数组到 App state、推断成功 |
| `apps/web/src/components/overlay/CharacterModal.tsx` | 在角色 rail 邻接挂载角色日志（可按窄屏改为抽屉） | 当前 characterId 与 session since 传入 | 将活动写入台词、分页或 TTS |
| `apps/web/src/scene-shell.css` / `apps/web/src/index.css` | 日志 panel、折叠行、窄屏 drawer 的样式 | 视觉层级、`pointer-events` 与响应式 | 用 CSS 藏掉语义状态或让日志拦截 Canvas |
| `apps/web/src/lib/messages.json` | 补齐固定 operation/state/summary 文案 | locale 翻译 | 动态把 toolName/原文作为 key |

设计上不产生世界目录、`history.db`、TTS cache、agent chat history 或新的 WS 帧。唯一可能的 engine transport 副作用仍是既有隐藏 custom relay；它不进入玩家日志，具体由 `docs/agent-awareness/02` 负责。

---

## 5. 状态、事件与生命周期边界

### 5.1 两个视图、一个 store

```text
agent_activity frame
        │
        ▼
useWorld.ts（唯一 WS 消费）
        │
        ▼
agentActivityStore
   ┌────┴──────────────┐
   │                   │
   ▼                   ▼
getSnapshot()       getLogSnapshot()
rail projection     bounded log projection
   │                   │
   ▼                   ▼
ActivityRail        selectAgentActivityLog
                         │
                         ▼
                  AgentActivityLog
```

`getSnapshot()` 继续服务即时胶囊的 `visibleAt`、3 条上限和 TTL；`getLogSnapshot()` 服务完整日志的全量归一化记录。二者由同一 `ingest`、同一 `activityId` 去重和同一 terminal absorbing 规则驱动。

### 5.2 终态与迟到帧

- `running + started`：不刷新 `startedAt`，不增加条目。
- `running + completed/failed`：原地更新 operation/subject（若 terminal 提供）及 error/endedAt。
- `ok/error + 任何后续帧`：保持终态，不能回退。
- terminal 先到时允许创建 terminal 记录；日志显示“已完成/失败”的一行，等待不到 start 不伪造 running。
- `tick` 只推进时基和既有 rail TTL；日志条目不因为 rail terminal TTL 消失而丢失。

### 5.3 清理边界

| 触发 | rail projection | log projection | 玩家可见结果 |
|---|---|---|---|
| completed/failed TTL | 移除胶囊 | 保留记录 | rail 消失，日志可回看 |
| stale 90s | 转 timeout 后按 error TTL 消散 | 保留 timeout 记录至上限 | 不再假装工作中 |
| 角色关闭 | running → cancelled；随后 modal 卸载 | 保留 bounded 记录，但以 `since` 隔离 | 不泄漏给全局/下一次 modal |
| 世界切换 | `clearAll()` | `clearAll()` | 不把上一世界活动带进新世界 |
| WS 断线 | 既有 `clearAll()` | 既有 `clearAll()` | 不留下虚假的“正在工作” |

### 5.4 与 `agent_progress`、Writer state、world event 的界线

- `agent_progress`：阶段/生命周期；日志不得据此新建 activity 行。
- `writer-state.ts`：Writer phase、stop、completion、lastMessage 的唯一真相；日志只能作为工具粒度的旁路投影。
- `agent_activity`：某个已归一化工具/命令活动；不能替代 idle 或 completion。
- `world_event`：已提交世界变化；不能由日志 terminal 推导。
- `writer_delta`/`character_delta`：正文；日志不得读写正文缓存。

---

## 6. 前后端接线

### 6.1 后端帧来源（引用，不在本文重定义）

`docs/agent-awareness/02-作家与功能Agent活动设计.md` 已规定：writer/character 工具事件经 `ActivityProjector` 生成安全 `agent_activity`；`airp-init`/child session 通过既有 relay 传回 functional 活动；`agent_activity` 只广播、不落账。本文不添加新的服务端发射器，不改变 `AgentActivityFrame` 字段。

任何新增 functional 工具必须先修改共同 operation 白名单及 `docs/tools/12-工具注册与路由统一.md §6.2`，再接线；完整日志不得为了“看起来完整”直接接收未知工具参数。

### 6.2 前端 WS 接线

`useWorld.ts` 的 `onMessage` 保持唯一入口，在现有 `case 'agent_activity'` 调用：

```ts
case 'agent_activity':
  agentActivityStore.ingest(msg);
  break;
```

这一步与既有 `tool_start`/`tool_end` footprint 路径并行，不能删除或让完整日志消费旧帧。`ActivityRail` 与 `AgentActivityLog` 都不得监听 `airp:agent-frame`。

### 6.3 全局挂载

`App.tsx` 的全局 rail 旁新增日志触发器/面板：

```tsx
<ActivityRail surface="rail" className="prototype-chrome" />
<AgentActivityLog
  query={{ surface: 'rail' }}
  className="prototype-chrome"
/>
```

全局日志仅展示 writer/functional；即使角色 modal 或 Nook 打开仍可见，面板不拥有 Canvas focus，不遮挡 Chalk、Writer dock、action toggle、Stop writing。

### 6.4 角色挂载

角色纸上沿之外继续挂载角色 rail；同一邻接区域可挂一个“执行详情”按钮，打开当前角色的完整日志：

```tsx
<ActivityRail surface="character-modal" agentId={`character:${characterId}`} />
<AgentActivityLog
  query={{
    surface: 'character-modal',
    agentId: `character:${characterId}`,
    since: activitySessionStartedAt,
  }}
/>
```

角色日志不进入 `.speech-paper` 的台词内容，不改变纸张高度；角色关闭时面板随 modal 卸载，并由 `clearSurface` 收束 running。

### 6.5 i18n 与无障碍

- `activityLabel` 和日志行使用 operation/state/subject 插槽；固定 key 必须在 `messages.json` 有 `en`、`zh-CN`、`ja` 非空值。
- 日志 panel 的摘要 `aria` 只读条目计数、Agent 本地化名称、状态计数，不包含 activityId、turnId、toolName、路径或错误原文。
- rail 保持已有 `role="status" aria-live="polite"`；日志面板默认不使用高频 live region，打开/折叠只通过按钮 `aria-expanded` 传播，避免把历史回看朗读成持续告警。
- collapsed group 的隐藏 rows 不进可见读屏树；展开后每条行文案遵循 `activityAriaText` 的安全输入约束。

---

## 7. 错误边界、取消与服务不可用

### 7.1 安全错误映射

日志只消费服务端安全摘要：

| `errorKind` | UI 状态 | 日志文案 | 不得显示 |
|---|---|---|---|
| `timeout` | error | “处理时间过长” | 原始 timeout 堆栈、路径 |
| `cancelled` | error | “已停止” | stop 请求体、内部原因 |
| `agent_stopped` | error | “执行已中止” | session/进程信息 |
| `tool_error` / `unknown` | error | “该动作未完成” | `Error.message`、ENOENT、密钥 |

未知 operation 只落 `other`；未知 error 不得用原文填充行。

### 7.2 中断矩阵

| 场景 | 来源 | 日志处理 | 世界处理 |
|---|---|---|---|
| Writer Stop writing | Writer state + server terminal | 收到 `failed/cancelled` 后更新原行 | 不由日志写事件；既有动作层决定 |
| 角色关闭 | `clearSurface('character-modal')` | running 立即变 cancelled；面板卸载 | `character_stop` 维持现有链路 |
| engine turn timeout | lifecycle/projector | failed/timeout；未闭合活动逐条收束 | 不制造成功事实 |
| child functional 失败 | relay/projector | child 工具和 root initialize 分开显示，分别终止 | `layer_init_failed` 仍是事实 |
| WS 断线 | `useWorld` `onclose` | `clearAll`，不等待 90s stale | 重连/重取沿用现有世界链 |
| 日志 UI 组件异常 | React 边界 | rail 仍可独立显示；日志面板返回安全空态 | 不影响 WS/store/世界 |

### 7.3 服务/资源不可用

日志是内存 projection；没有活动帧时不能显示“服务失败”作为推断。若服务端明确发出 `failed`，显示安全失败；若 socket 断开，按 `clearAll` 清空 running，不伪造一条成功或失败世界事件。Effects off、Reduced Motion、页面隐藏、音频/TTS 不可用时，日志文字和键盘操作仍必须可用。

### 7.4 参数和隐私边界

前端不得尝试从 `tool_start`、`airp:agent-frame` 或 `result.details` 补齐 subject。服务端已经裁剪的 subject 仍按“可能暴露实现细节”的最小公开原则展示；若 `subject` 不存在，使用无对象本地化句式。禁止把 `activityId`、turnId、绝对路径、文件正文、prompt、原始 JSON 放入 text、`aria-label`、`title`、`data-*` 或浏览器 URL。

---

## 8. 代码落点与当前现状事实

### 8.1 当前消费与 store 事实

1. **现状是** `useWorld.ts` 已有唯一 `case 'agent_activity'`，在 `apps/web/src/state/useWorld.ts:473-481` 调用 `agentActivityStore.ingest(msg)`；落地时不应再添加另一个 WS 消费口。
2. **现状是** `agentActivityStore` 当前接口只有 `getSnapshot/ingest/clearSurface/clearAll/tick`，见 `apps/web/src/lib/agent-activity-store.ts:25-37`；`createAgentActivityStore` 当前只维护一个 `list`，见 `:41-45`，因此完整日志若要跨 rail TTL 保留，必须按 §2.3 明确扩展同一个接口，而不是在组件中偷偷缓存历史。
3. **现状是** 当前 `ingest` 先按活动时间 `pruneActivities`，再 `upsertActivity` 和 `promoteActivities`，见 `apps/web/src/lib/agent-activity-store.ts:79-95`；`pruneActivities` 会移除可见 terminal，见 `apps/web/src/lib/agent-activity.ts:236-268`。这正是“rail 胶囊”和“完整日志回看”不能只共用一个会被 TTL 删除的数组的实现缺口。
4. **现状是** 当前 store 的 `clearSurface` 会把指定 surface 的 running 变为 `error/cancelled` 并设置 `endedAt/visibleAt`，见 `apps/web/src/lib/agent-activity-store.ts:97-114`；完整日志必须复用这个收束入口。
5. **现状是** WS 关闭时 `useWorld.ts:677-684` 调用 `agentActivityStore.clearAll()`；完整日志不能在断线后保留虚假的 running 条目。

### 8.2 当前 hook、rail 与挂载事实

1. **现状是** `useAgentActivity` 当前只通过 `useSyncExternalStore` 读取 `getSnapshot`，再用 `visibleActivities` 和可选 agentId 过滤，见 `apps/web/src/state/useAgentActivity.ts:24-35`；新增日志 hook 必须沿用同一订阅，不得引入独立 state source。
2. **现状是** `ActivityRail` 当前 `items.length === 0` 返回 `null`，并以 `activityId` 作为 React key、以 `activityAriaText/activityLabel` 渲染，见 `apps/web/src/components/chrome/ActivityRail.tsx:25-56`；完整日志不可复制一套 raw label 或把 key 渲染到 DOM。
3. **现状是** 全局 rail 已在 `App.tsx:722-725` 挂载，且注释明确 writer/functional 不因角色或 Nook 打开而消失；完整日志应作为邻接投影，不替换这一挂载。
4. **现状是** 角色关闭 `App.tsx:578-589` 发送 `character_stop`、调用 `clearSurface('character-modal')`、清理 frame queue 并恢复机位；设计只补日志 session 隔离，不改变关闭顺序。
5. **现状是** 角色 rail 已在 `CharacterModal.tsx:764-772` 的 speech paper 上沿之外以 `agentId=character:<characterId>` 挂载（代码中实际为反引号模板字符串）；完整日志必须保持同一角色过滤，并不进入台词纸内容。

### 8.3 建议的落点清单

| 顺序 | 文件 | 精确落点 |
|---|---|---|
| 1 | `apps/web/src/lib/agent-activity.ts` | `AgentActivity` 类型之后增加 query/turn 类型；归并函数之后增加 selector |
| 2 | `apps/web/src/lib/agent-activity-store.ts` | `AgentActivityStore` 增加 `getLogSnapshot`；工厂内在 `ingest/clearSurface/clearAll` 同步 log projection |
| 3 | `apps/web/src/state/useAgentActivity.ts` | 保留 `useAgentActivity`；新增 `useAgentActivityLog`，读取 `getLogSnapshot` |
| 4 | `apps/web/src/components/chrome/AgentActivityLog.tsx` | NEW；只消费 hook，局部管理 expanded turn set |
| 5 | `apps/web/src/App.tsx` | 全局 rail 旁挂载全局 log；打开角色时记录 session 起点并传给 modal |
| 6 | `apps/web/src/components/overlay/CharacterModal.tsx` | 角色 rail 邻接挂载角色 log；关闭由 App 现有 clearSurface 收束 |
| 7 | `apps/web/src/scene-shell.css` / `index.css` | desktop/窄屏布局、drawer、focus、Reduced Motion 样式 |
| 8 | `apps/web/src/lib/messages.json` | 固定日志 key 的三语种翻译 |

所有落点只属于前端投影/UI；服务端帧来源继续由 `docs/agent-awareness/02` 负责，`useWorld.ts` 继续是唯一 WS 消费者。

---

## 9. 与现状、角色版和 ActivityRail 的差异矩阵

### 9.1 与当前实现的差异

| 维度 | 当前实现（证据） | 完整日志设计 |
|---|---|---|
| 可见数据 | `getSnapshot()` 的 rail 条目（`agent-activity-store.ts:25-37`） | 同一 store 增加 `getLogSnapshot()`，保留 bounded 归一化记录 |
| 保留时间 | terminal 按 `visibleAt + TTL` 清除（`agent-activity.ts:250-267`） | rail 仍按 TTL；日志 projection 独立保留到世界切换/断线/上限 |
| 读取 hook | `useAgentActivity(surface, agentId?)` 只返回 items/aria（`useAgentActivity.ts:19-49`） | 新增 `useAgentActivityLog(query)`，同一 `useSyncExternalStore` |
| UI | `ActivityRail` 最多可见 3 条 capsule（`ActivityRail.tsx:25-56`） | rail 保持；旁边增加可展开/折叠 turn 日志 |
| 分组 | rail 按 visibleAt/startedAt 排序，无 turn 摘要 | 按 source+agentId+turnId 分组，保留全部规范化活动 |
| 角色关闭 | 已有 `clearSurface` 收束 running（`App.tsx:578-589`） | 复用收束，新增 modal `since` 隔离防旧记录继承 |

### 9.2 与角色版设计的差异

| 维度 | 完整 Agent 执行日志（本文） | 角色版 `01-角色多消息与TTS清洗设计.md` | 关系 |
|---|---|---|---|
| 目标 | 回看 Agent 一次或多次 engine turn 的公开工具活动 | 保留同一角色 turn 内多 assistant message 的可说文本 | 互补，不能互相替代 |
| 范围 | 全局 writer/functional；角色面仅当前 character | 角色 `agent_activity` 只作为角色 rail 胶囊 | 本文不改角色文本聚合 |
| 输入 | 归一化 `AgentActivity` 记录 | `character_delta/message/idle` 与角色 activity 过滤 | 两者共享 WS 入口，但消费 projection 不同 |
| 状态 | running/ok/error 的活动行与 turn 摘要 | character turn 的文本序列与 idle 封口 | activity completed 不等于 character idle |
| 保留 | rail 消散后日志仍可回看 bounded 记录 | 角色页按既有分页/翻页语义展示，不变成 chat history | 日志不能把台词变成长日志 |
| 折叠 | 按 turn 折叠/展开，展开显示所有安全活动 | 不折叠角色可说文本；工具胶囊不进入文本页 | 折叠只属于日志 UI |
| 关闭 | running 变 cancelled，modal session 过滤旧记录 | 角色关闭收束未完成胶囊、下一角色不继承 | 复用 `clearSurface`，不复制 reducer |
| TTS | 完全不触发 TTS | 台词经 shared `sanitiseTtsText` 后才请求 TTS | 日志永不进入 TTS |
| 事实 | 不落 `history.db`，不推断 `world_event` | 同样不把胶囊当事实 | 共同上位契约 |

### 9.3 与 `ActivityRail` 的差异

| 维度 | 完整日志 | `ActivityRail` |
|---|---|---|
| 信息密度 | 当前 bounded 窗口内全部归一化条目 | 每个 surface 同时最多 3 条 |
| 时间 | 跨即时 capsule TTL 回看 | completed 2.4s、failed 4.5s；running 最多 90s |
| 组织 | Agent → turn → entry | 平铺 capsule，按开始/可见时间排序 |
| 默认状态 | 面板关闭；最新 running turn 展开 | 直接显示，无面板交互 |
| 交互 | 打开、展开、折叠、全部收起/展开；不执行动作 | `pointer-events:none` 的状态提示，不是控制 |
| surface | 全局只 writer/functional；modal 只当前 character | 同样按 `surfaceForSource` 过滤 |
| a11y | 面板按钮和 group `aria-expanded`；历史不进 live region | 既有 `role=status`/`aria-live=polite` |
| 数据源 | `getLogSnapshot()` + selector | `getSnapshot()` + `visibleActivities()` |
| 真相边界 | 同样不是 world event、Writer state 或正文 | 同样不是 world event、Writer state 或正文 |

---

## 10. 验收测试与浏览器验收

### 10.1 非空纯函数测试（旧实现必须失败）

测试文件建议扩展 `apps/web/test/agent-activity.test.mjs`，或新增只测试 selector 的 `apps/web/test/agent-activity-log.test.mjs`；必须使用现有 jiti/node:test bootstrap，不跑全量验证。以下每项都是有实际行为断言的非空测试：

1. **完整性超过 rail 上限（旧实现必失败）**：构造同一 writer turn 的 4 个 started+terminal 活动；断言 `visibleActivities(...).length === 3`，但 `selectAgentActivityLog(...).flatMap(turn => turn.entries).length === 4`，并且第 4 条没有被静默丢失。
2. **terminal TTL 后仍可回看（旧 store 必失败）**：ingest completed，推进 `ACTIVITY_COMPLETE_TTL_MS` 使 rail snapshot 移除；断言 `getSnapshot()` 没有该胶囊而 `getLogSnapshot()` 仍有一条 ok entry。
3. **同 activityId 原地更新**：started 后 completed；断言日志只有一行，state 为 ok，`startedAt` 未刷新；再发 out-of-order started，仍为 ok。
4. **turn 边界**：同一 agent 两个 turn 各有活动；断言 selector 返回两个 group，不能按 agentId 合成一个 group；group 最新排序稳定。
5. **global/character 隔离**：writer、scene-init、character:a 三类活动并发；global query 只返回前两类，character query 只返回 `character:a`，没有角色泄漏。
6. **角色 session 隔离**：先写入角色旧条目，使用更晚 `since` 查询；断言旧条目不出现；新条目出现。调用 `clearSurface('character-modal')` 后，旧 running 变 `cancelled` 而不是继续 running。
7. **折叠不改 store**：selector 返回 2 个 turn；模拟 UI 折叠其中一个只改变展开集合，重复 selector 仍返回相同条目和状态。
8. **错误摘要不泄漏**：subject 只取已裁剪值；构造 `error='ENOENT /home/user/.ssh/id_rsa'` 的输入，断言日志文案、aria、序列化 DOM 预期值均不包含原错误、绝对路径、activityId、toolName、args。
9. **事实隔离**：完整日志 selector/ingest 纯测试中无 `world_event`、`history.db` 写入调用；completed 不生成任何世界事件对象。
10. **断线清理**：store `clearAll()` 后 `getSnapshot()`、`getLogSnapshot()` 均为空，日志 aria 为空，不留下“正在工作”。
11. **超时**：running 记录推进 `ACTIVITY_STALE_TTL_MS`，rail 和 log 都变为 `errorKind='timeout'`，而不是永久 running。
12. **locale/a11y**：同一 selector 在 `en/zh-CN/ja` 文案函数下只改变本地化文字；不改变分组数量和条目身份；summary 不含内部 ID。

### 10.2 前端组件行为测试

使用仓库已有 React 测试约定（若当前无组件测试，则为实现阶段新增最小 browser/component fixture）：

- 无条目时 `AgentActivityLog` 返回 `null`，不创建空 live region；
- 点击“Activity details”后面板出现，最新 running turn 展开、旧 turn 折叠；点击 group 后 `aria-expanded` 翻转，条目完整性不变；
- 关闭面板不调用 store 清理，不影响 rail；刷新 snapshot 后再次打开仍能看到 bounded terminal 记录；
- 全局面板不渲染 `character:a`；角色面板不渲染 writer/functional；
- Writer busy/stop/completion 改变时日志不拥有或覆盖 `WriterPublicState`；日志没有 Stop writing 按钮的替代实现；
- TTS mock 的请求计数在打开/展开日志前后保持 0 增量；角色页文字与 TTS 输入不包含日志文案。

### 10.3 浏览器验收（不以 node 测试替代）

桌面至少 1440×960：

1. 触发真实 Writer turn，包含至少 4 个公开工具活动；确认底部 rail 同时最多 3 条，打开 Activity details 后能看到同一 turn 全部安全条目，且 Writer dock、Chalk、Stop writing 均可操作。
2. 触发 `scene-init` 或 `nook-init`；确认全局日志显示 functional 名称/安全本地化名称和 initialize/工具条目，最终成功/失败以画布和 world event 反馈为准，不把日志 terminal 当作初始化事实。
3. 打开角色并触发包含工具循环的 turn；确认角色 rail/日志只显示 `character:<id>` 的归一化动作，角色台词顺序和 TTS 不受影响。
4. 在角色工具 running 时关闭 modal，再打开另一角色；确认旧 running 胶囊停止/收束，下一角色没有继承旧 activity；全局日志不出现角色行。
5. 制造一次明确失败、一次 Stop writing、一次服务端超时；确认三者文案可区分但都不显示堆栈、原始参数或绝对路径；成功音效/世界成功文案不由日志触发。
6. 断开并重连 WS；确认日志和 rail 都没有上一连接的 running 残留，重连后新活动从新条目开始。

窄屏至少 390×844：

1. rail 降为不遮挡 Writer dock、手牌和角色纸的单列短提示；Activity details 改为屏幕内抽屉/底部 sheet，面板内可滚动但 Canvas 与台词纸不被永久挤高。
2. 角色 modal 中日志触发器位于纸张上沿之外；打开后不覆盖 Continue/输入框，Escape/关闭按钮可回到角色纸。
3. 开启 `prefers-reduced-motion`、关闭 Effects、页面切后台再返回；不依赖 pulse/fade 才能读取状态，回到前台会执行既有 `tick`，文字和关闭路径仍可用。

---

## 11. 发现的冲突 / 需要修订的上位文档

1. **`docs/agent-awareness/00-共同上下文.md §3.2/§3.3` 与现有 store 生命周期的表达不够完整。** 上位契约要求“完整日志是 `agentActivityStore` 的更丰富投影”，但 `apps/web/src/lib/agent-activity.ts:250-267` 和 `agent-activity-store.ts:79-95` 当前会在 rail TTL 后移除 terminal；若只保留当前 list，完整日志无法实现“rail 消散后回看”。建议评审后在共同契约明确：同一 `agentActivityStore` 可以拥有 rail snapshot 与 bounded log snapshot 两个投影，必须共用一个 ingest/reducer/订阅源，禁止第二 store。
2. **`docs/agent-awareness/03-前端感知演出设计.md §3.3/§7.3` 把“完整 store 队列”描述为 queued capsule，但没有规定 terminal TTL 后的可回看窗口。** 建议增补“queued/terminal log records 与可见 capsule 是两个投影；`visibleActivities` 仍按既有 TTL，完整日志 selector 可读取 bounded records”，并注明上限、世界切换与断线清理。
3. **`docs/ux/08-niko功能迁移契约.md §6（Agent 完整日志）只写“Agent activity selector/projection、ActivityRail 邻接 UI”，未决定 store API。** 本文提出 `getLogSnapshot()`；主代理应在评审门确认是否接受该接口，若接受需同步 §3.1 和 `docs/agent-awareness/03`，若不接受必须提供等价的同-store selector 输入，不能让组件保存历史。
4. **现状文档与代码的“NEW”状态漂移。** `docs/agent-awareness/03-前端感知演出设计.md:211-240` 仍把 `ActivityRail` 标作 NEW，但源码 `apps/web/src/components/chrome/ActivityRail.tsx:25-58` 已存在。设计实现前应由维护者回写文档状态；本文不把代码现状偷偷改写为已完成产品验收。
5. **`docs/agent-awareness/03 §1.1/§3.3` 与 UX Chrome owner 的边界。** 03 已规定 rail 不拥有 writer busy/phase/stop/completion；完整日志若显示 turn summary，必须继续标为 activity summary，不得称为“Writer 正在工作”的 canonical phase。必要时在 `docs/ux/03-Chrome与公开状态.md` 增加“activity log 是旁路投影”的说明。
6. **角色关闭的“保留记录”与“不可泄漏”需要上位口径确认。** 本文用 `since` 过滤保留 bounded 记录以支持本次会话审计，同时 modal 卸载、全局 surface 过滤保证不可见；若上位契约要求关闭即删除角色所有记录，则应让同一 `clearSurface` 清理 log projection，而不是由 `CharacterModal` 私自维护删除逻辑。
7. **ActivityRail 目前样式中的 `pointer-events:none` 与日志按钮交互存在布局接缝。** `apps/web/src/scene-shell.css:189-212` 明确 rail 不拦截画布；日志触发按钮必须是 rail 的邻接元素或独立 wrapper，不能把按钮嵌入该不可交互 DOM 并用 CSS 反向放开，从而破坏既有拖拽边界。

本文不直接修改以上共享契约；由主代理在评审门裁决后统一回写并广播。

---

## 12. 仍未知、待拍板项

1. **日志入口文案和图标：** 暂定“Activity details/执行详情”，具体英文、中文、日文 key 和在沉浸模式中的显示策略尚未由 Chrome 文档冻结。
2. **`ACTIVITY_LOG_MAX_ENTRIES` 的数值：** 本文建议 200，属于 bounded 内存窗口而非产品事实；需要以真实模型高工具调用 turn 与低性能移动设备的内存 trace 评审。若改数值，必须同步纯函数测试和本文。
3. **functional 展示名：** 当前 `SOURCE_NAME_KEYS.functional` 为通用 `Background task`（`apps/web/src/lib/agent-activity.ts:352-357`）；是否为 `scene-init`、`nook-init` 各提供本地化名称，需由产品/Chrome owner 拍板。不得直接显示内部 agentId 作为临时答案。
4. **角色日志是否默认提供入口：** 本文建议角色 rail 邻接提供与全局相同的详情入口；若移动端空间不足，可只保留角色 rail 并把完整日志入口放进 modal 的辅助菜单，但不得因此删除 store projection 或让角色活动进入全局日志。
5. **bounded log 是否在同一世界的 layer 切换中保留：** 本文遵守共同契约的 global rail“不随当前世界层切换而清空”，因此暂定保留；若层切换被确定为新的 execution context，应在上位契约定义清除边界，不能由 App 局部判断。
6. **错误摘要是否允许展示“未完成”与“已停止”的更细状态：** 当前帧只有安全 `error` 字符串；若需要区分用户 stop、world switch、provider abort，必须先扩充共同安全枚举，不得把服务端异常原文下传。
7. **日志 panel 的浏览器焦点管理：** Escape 关闭、打开后是否把焦点放到第一个 group、移动 sheet 是否使用 focus trap，需结合现有 Nook/Writer panel 的可访问性实现确认；无论选哪种，日志不得抢占 Canvas active projection。

在上述项目拍板前，已落地纯 selector 测试和无 UI 的 store projection；未知项仍不得伪装成冻结契约或在组件中留下临时回退路径。
