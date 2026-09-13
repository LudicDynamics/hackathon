# 作家与功能 Agent 活动设计

> 状态：设计稿（2026-09-13）。归属 `docs/agent-awareness/02`，只负责服务端的 tool / command / subagent → `agent_activity` 来源、归一化、生命周期，以及 writer / functional 的活动语义。
>
> 本文服从 `docs/agent-awareness/00-共同上下文.md`（以下简称「共同契约」）的 `source`、`agentId`、`turnId`、`activityId`、帧形状、去重、超时和落账口径；不得在本文改变角色台词聚合、前端 CSS 或 TTS 清洗规则。活动胶囊永远不是台词，也不读 TTS；TTS 前后端只使用共同契约 §5 指定的同一个 shared 纯函数。

---

## 1. 一句话定位

**把 writer 的 RpcClient 工具事件、`airp-init` 命令和 in-process 子 agent 的工具事件，接成同一条服务端活动投影链：先赋予稳定身份和 turn，再用单一白名单归一化为 `agent_activity`，不泄漏原始参数、不改写既有 `tool_start/tool_end`、不写 `history.db`。**

玩家因此能看到「作家正在查看/修改」和「scene-init 正在初始化」等短暂状态，但不会看到作家 chat history、子 agent 原文、思维链或未经裁剪的路径。

### 1.1 本文不负责

- 不聚合角色同一 turn 的多条 assistant 台词；归 `01-角色多消息与TTS清洗设计.md`。
- 不决定全局/角色 activity rail 的布局、CSS、消散动画；归 `03-前端感知演出设计.md`。
- 不重新定义 TTS 括号清洗。活动帧不进入 TTS；共同纯函数和异常括号测试由角色/TTS 文档冻结。共同契约 §5.3 已冻结 fail-closed：单侧、交叉、无法闭合或跨行未闭合结构统一返回空串，不抛异常、不送厂商；页面保留原文，前端跳过 TTS 并走无语音 stinger。本篇不把该规则列为待拍板。
- 不用 `agent_activity` 代替 `agent_progress`、`tool_start/tool_end`、`world_event` 或 Chalk。

---

## 2. 现状事实与证据

下列是设计基线；行号是 2026-09-13 设计工作树的事实，落地前仍须按符号名复核。

1. `EventSource` 当前只有 `'writer' | 'character'`，且 `mapEngineEvent(source, event, toolArgs, characterId?, toolcallBuf?)` 位于 `apps/server/src/engine/event-bridge.ts:8,76-82`。现有 `tool_execution_start` 在 `:143-149` 发 `tool_start`，`tool_execution_end` 在 `:168-181` 发 `tool_end`，`agent_settled` 在 `:250-252` 发 `writer_idle/character_idle`。
2. `EventBridge.emitEngine()` 在 `apps/server/src/engine/event-bridge.ts:315-325` 将 lifecycle 事件送入映射器；`EventBridge.broadcast()` 在 `:290-312` 只做 WS 广播。`drainWorldEvents()` 在 `:336-367` 只读并广播已经 COMMIT 的世界事件。
3. `AgentLifecycleManager.handleEngineEvent()` 在 `apps/server/src/engine/lifecycle.ts:259-292` 维护阶段、turn 起止和既有 `eventSink`；当前没有 `turnId`，只在 `turnStartedAt` 里保存时间。writer 的 `RpcClient.onEvent` 绑定在 `:180-187`，character 绑定在 `:206-215`。
4. lifecycle 的 turn 超时在 `apps/server/src/engine/lifecycle.ts:294-316` 调 `client.abort()`，并发出 `turn_aborted{reason:'timeout'}`；当前没有逐个关闭已开始工具的玩家活动。
5. `extensions/toolkit/init-command.ts:167-174` 注册 `airp-init`；命令结果用 `pi.sendMessage({ customType:'airp_init', display:false }, { triggerTurn:false })`，不会直接成为玩家画布内容。有效请求在 `:247-255` 通过 `ctx.spawnAgent({ profileId:'scene-init'|'nook-init', customTools, timeoutMs })` 执行，`inFlight` 防线在 `:205-211`。
6. pi-rp 的 `spawnAgent` 通过 `vendor/pi-rp/packages/coding-agent/src/core/subagent/spawn.ts:21-46,78-137` 创建 in-process 子 session；`runSubagent` 的 `onSessionCreated` 回调在 `vendor/pi-rp/packages/coding-agent/src/core/subagent/run.ts:25-40,152-155`、**子 session 真正开始前**调用。子 session 不会自然成为父 `RpcClient` 的事件源。
7. `runSubagent()` 当前只在 `vendor/pi-rp/packages/coding-agent/src/core/subagent/run.ts:109-138` 转发父扩展的 tool handlers；`subagent` 工具调用 `runSubagent` 时在 `vendor/pi-rp/packages/coding-agent/src/core/subagent/extension.ts:127-130` 没有活动回调。这正是「子 agent 工具事件不能自然从 parent RpcClient 外泄」的接缝。
8. `extensions/world-context.ts:8-45` 的 `tool_call/tool_result` 只为原生 `write/edit` 落世界事件；不能把它当成 `agent_activity` 来源，否则会重复落账或把工具事件误当世界变更。
9. `apps/web/src/state/useWorld.ts:408-423` 当前以 writer 的 `tool_start/tool_end` 维护 footprint 忙计数；新帧必须并行发出，不能删除、改名或改变这条路径。
10. `docs/init/00-共同上下文.md:42-48` 已冻结：初始化子 agent 是作家进程内的 `ctx.spawnAgent`，服务端只有 RpcClient；`docs/init/02-brief与执行内核.md:191-203` 也明确 `customTools` 和 `timeoutMs` 是初始化成功链的硬条件。

> `[推断]` 父 RpcClient 的 JSON 事件流不会自动合并由 `runSubagent()` 创建的 in-memory child session；需由 child 的 `onSessionCreated`/`subscribe` 观察器将安全 envelope 回送 parent session，再由 parent RpcClient 输出，或新增等价的 RPC 内部通道。本文选择前者，因为它复用现有 extension message 通道，并可在服务端验证后才广播玩家帧。

---

## 3. 冻结接口与唯一来源

### 3.1 玩家帧形状

完全引用共同契约 §3，不在本篇复制第二种形状：

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

`agent_activity` 是临时玩家演出帧：不进入 `history.db`、不进世界 `events` 表、不替代 `world_event`；真实写盘/落账仍走既有动作层。任何 `tool_start/tool_end` 的既有字段（包括 footprint 所需字段）保持不变。

### 3.2 服务端模块（NEW）

新增 `apps/server/src/engine/agent-activity.ts`，只放服务端活动投影和纯归一化，不在 extension 工具壳里重复维护第二份 operation 表。

```ts
export type ActivitySource = 'writer' | 'character' | 'functional';

export interface ActivityTurnContext {
  source: ActivitySource;
  agentId: string;
  turnId: string;
}

export interface ChildActivityEnvelope {
  type: 'tool_start' | 'tool_end';
  // 这些字段来自同进程观察器，服务端仍须校验；不可直接信任并广播。
  context: ActivityTurnContext; // transport metadata; never copied as a player field
  toolCallId: string;
  toolName: string;
  args?: unknown;
  details?: unknown;
  isError?: boolean;
  errorKind?: 'tool_error' | 'timeout' | 'cancelled' | 'agent_stopped';
}

export function normalizeActivityOperation(toolName: string): AgentActivityFrame['operation'];
export function sanitizeActivitySubject(input: {
  toolName: string;
  args?: unknown;
  details?: unknown;
  cwd?: string;
}): string | undefined;
export function safeActivityError(kind: ChildActivityEnvelope['errorKind'] | 'unknown'): string;

export class ActivityProjector {
  acceptToolStart(context: ActivityTurnContext, event: ChildActivityEnvelope): Record<string, unknown>[];
  acceptToolEnd(context: ActivityTurnContext, event: ChildActivityEnvelope): Record<string, unknown>[];
  failTurn(context: ActivityTurnContext, reason: 'timeout' | 'cancelled' | 'agent_stopped'): Record<string, unknown>[];
  clear(): void;
}
```

`ActivityProjector` 是唯一负责 `activityId` 状态机、重复帧和未闭合活动收束的对象。它只返回待广播的 `agent_activity` 帧；不调用 store、不写文件、不修改 footprint。

### 3.3 归一化白名单（唯一一份）

实现放在 `agent-activity.ts` 的 `TOOL_OPERATION` 常量（导出只暴露 `normalizeActivityOperation`），writer、character、functional 和 child relay 全部调用同一映射。未知工具统一 `other`，不得把任意模型生成的工具名拼成玩家文案。

| 工具/命令名 | operation | 默认 subject 来源 | 说明 |
|---|---|---|---|
| `look_at`, `view_canvas` | `look` | `path` / `name` | 查看世界对象或画布 |
| 原生 `read` | `read` | `path` | 读文件；与 `look` 保持不同语义 |
| `write`, `chalk`, `create_file` | `write` | `path` / `details.path` / `name` | Chalk 仍是 writer 正文来源，但 activity 只说写入对象 |
| `edit` | `edit` | `path` / `name` | 原生编辑或未来编辑工具 |
| `delete` | `delete` | `path` / `name` | 删除对象 |
| `move`, `move_to`, `rename` | `move` | `from` / `to` / `path` | 只给裁剪后的对象名，不给绝对路径 |
| `choose`, `choose_option` | `choose` | `name` / `path` | 不展示自由输入的 choice 原文 |
| `roll_dice` | `roll` | `name` / `path` | 不展示原始骰子 JSON |
| `use_item`, `use_item_on` | `use` | `itemName` / `targetName` | 仅白名单名称 |
| `show`, `get_component` | `use` | `component` / `target` | `show_frame` 仍走既有演出链 |
| `link`, `arrange`, `set_following` | `edit` | `path` / `layer` / `name` | 画布关系/排座是编辑状态 |
| `generate_image` | `create` | `name` / `path` | `image_generation_progress` 仍保留 |
| `subagent` / `subagent_profiles` | `use` | 合法 `profileId` | parent writer 的委托动作；child 工具另有 functional 帧 |
| `airp-init`, `scene-init`, `nook-init` | `initialize` | 合法 `target` | 命令过程及初始化 profile 的统一语义 |
| 其它 | `other` | 省略 | 不显示未知参数或未知工具名 |

`look_at / read` 等别名的取舍在这一张表中固定，禁止各工具文档再发明映射。若新增 functional 工具，先加入本表和 `docs/tools/12 §6.2`，再实现。

### 3.4 subject 裁剪

服务端在 `sanitizeActivitySubject()` 中完成，不把 extension 的原始 args 直接传给 WS：

1. 只读取表中列出的字段：`path`、`from`、`to`、`name`、`itemName`、`targetName`、`layer`、`component`、`target`、合法 `profileId`。
2. 路径按 agent cwd 解析后只保留 world-relative 路径或最后一个对象名；剥除盘符、`..`、绝对前缀、查询串、换行、控制字符和密钥形状。不能确定相对归属时宁可省略。
3. 去掉 `.md` 等实现后缀，压缩连续空白；最多 80 个 Unicode code points。超长值取安全尾部或固定省略，不截断到半个 surrogate/控制序列。
4. 不读文件全文、不调用 LLM、不从 `result.content` 猜文案；`details` 也只取白名单字段。
5. 空值、数组、对象、自由输入、原始 JSON 均不成为 subject。

`toolName` 只在已知白名单中回传规范名称；未知名仍只产生 `operation:'other'`，`toolName` 省略。前端用 locale 模板把 operation 与 subject 合成胶囊，绝不把模型返回文案直接显示。

### 3.5 错误摘要

`error` 是有限安全枚举的展示摘要，不是 `Error.message`：

| 内部原因 | `phase` | 安全摘要（前端可本地化/映射） |
|---|---|---|
| `isError === true` | `failed` | `tool_error` |
| init/turn timeout | `failed` | `timeout` |
| 用户 stop、session dispose | `failed` | `cancelled` |
| agent/client 死亡、world switch | `failed` | `agent_stopped` |
| envelope 不完整但有 terminal | `failed` | `unknown` |

完整错误只写服务端 stderr/诊断日志（若已有错误日志路径允许），不进入 `agent_activity`、`history.db` 或自定义 message 的可见内容。

---

## 4. 身份、turn 与 activityId 生成

### 4.1 writer

- `source = 'writer'`，`agentId = 'writer'`，完全遵守共同契约。
- `AgentLifecycleManager.handleEngineEvent()` 在每个 pi-rp `turn_start` 生成一次 `turnId`（建议内部键为 `${agentId}:${runId}:${turnIndex}`，对外只发 opaque `turnId`），存入当前 agent/run 上下文；同一个 engine turn 的工具 start/end 共用该值。`agent_start` 只建立 run，不生成 turn。
- `turn_end` 结束当前 engine turn；`agent_settled`、timeout、abort、stopWriter 再关闭该 run 内仍 open 的 activity，并清理 run 上下文。
- 如果 agent 尚未收到 `turn_start` 就收到 tool event，创建 `orphan:<randomUUID>` turn 并记录诊断；不可把事件塞进上一个 turn。[推断] 正常 pi-rp 顺序不会走此分支，但它是断线/协议异常的安全边界。

### 4.2 functional

稳定的功能名是 `agentId`，本次并发靠 `turnId` 分开：

- scene 初始化：`agentId = 'scene-init'`。
- nook 初始化：`agentId = 'nook-init'`。
- 未来 profile/命令：注册表中的稳定功能名，例如 `inventory-sync`；不得用随机展示名。
- 每次命令型初始化在命令开始处生成 `turnId = functional:<randomUUID>()` 作为 root initialize activity；若 child session 产生真实 `turn_start`，其工具活动使用 child turnId，不能与 root 混用。
- R1 writer 委托的子 profile 由 profile id 作为 `agentId`，例如 `scene-init`；child 的每个 `turn_start` 另绑定 opaque turnId，不能伪装成 `writer`。

建议 `ActivityTurnContext` 在服务端内部保留 `requestId`/`parentTurnId` 诊断字段，但不加进冻结的玩家帧。

### 4.3 character（补齐角色工具生产链）

- `source = 'character'`，`agentId = \`character:${characterId}\``；`characterId` 来自 lifecycle 为该 RpcClient 注册时的稳定 id，不从 tool args 推导；
- character 的 turnId 在 `AgentLifecycleManager.handleEngineEvent()` 收到该角色 `turn_start` 时绑定；同一 engine turn 的 `tool_start`/`tool_end` 共用，角色正文跨多个 turn 由 turn buffer 按 `character_idle` 封口；
- `mapEngineEvent('character', tool_execution_start/end, ...)` 在已有 `characterId` 参数下交给同一个 `ActivityProjector` 产出 `agent_activity`；不要等待前端从 `tool_start` 猜 activity；
- `agent_settled` / `character_stop` / timeout 必须关闭该角色 turn 内 open activity；角色 modal 关闭只负责清理展示面，不代替服务端终态帧；
- 多角色并发按 `agentId` + `turnId` 隔离，不能复用 writer 的 turn map key。

### 4.4 activityId

- 工具调用：`activityId = \`${turnId}:${toolCallId}\``；只作为 opaque 去重键，禁止 UI 拆解显示；
- `toolCallId` 缺失/非法时由 relay 在该 turn 内分配递增 `tool-1`, `tool-2`，并在 server 端再次校验；不得用 subject 或时间戳作为唯一键；
- `airp-init` 命令自身的初始化过程：`activityId = \`${turnId}:initialize\``。它与 child 的 `write/edit/...` activity 分开，避免把「初始化」和其内部第一笔写盘混成一个胶囊；
- start/end/failed 永远复用同一 activityId；不同 turn、不同 child、不同 toolCall 不得碰撞。


---

## 5. 服务端事件链与逐步行为

### 5.1 writer 直接工具

**步骤 1：lifecycle 建立 turn。**

`handleEngineEvent('writer', turn_start, ...)` 先绑定当前 engine `turnId`，然后保留既有 `agent_progress` 和 `eventSink` 行为。

- 漏了会怎样：没有 turnId，start/end 只能用 session id 或时间拼接，多个工具并发时无法去重；重连或重放会出现重复胶囊。

**步骤 2：工具 start 双路映射。**

`event-bridge.ts` 的 `mapEngineEvent` 保留原有 `tool_start`（包括原始 args，供 footprint/既有逻辑），并将同一事件以 `ActivityTurnContext` 交给 `ActivityProjector.acceptToolStart()`。projector 只生成安全 `agent_activity{phase:'started'}`。

- 漏了会怎样：旧 footprint 若被替换会停止测量；只发新帧则既有 Chalk/忙状态回归；只发旧帧则玩家仍没有活动胶囊。

**步骤 3：工具 end 成功/失败。**

`tool_execution_end` 继续发原有 `tool_end`、`chalk_landed`、`canvas_patched`、`dice_result` 等帧；并按 `isError` 生成 completed/failed。路径只给 `chalk_landed` 等既有演出帧使用，activity subject 经过 3.4 再生成。

- 漏了会怎样：失败工具会留下永远「正在」的胶囊，成功变更也不会给玩家完成反馈；若把 `tool_end` 删除会破坏 footprint。

**步骤 4：turn 封口。**

`agent_settled` 维持既有 idle 帧，并调用 `failTurn` 处理仍 open 的 activity（安全原因 `agent_stopped`，只在确实未收到 end 时）。正常 completed 不得二次变 failed。

- 漏了会怎样：provider 在工具结束帧丢失时，前端只能依赖 90s 客户端兜底；服务端无法给出确定的失败收束。

### 5.2 `airp-init` 命令

**步骤 1：服务端 fire-and-forget 触发不变。**

`apps/server/src/index.ts:158-175` 的 writer `prompt('/airp-init <json>')` 仍不把长初始化同步等待当 HTTP 成功条件；沿用 `docs/init/03-触发链路与前端.md` 的 RPC 超时裁决。命令的玩家活动不依赖 prompt response，而从 parent RpcClient 事件流回流。

- 漏了会怎样：scene 60s/nook 45s 初始化撞 RpcClient 30s response window，服务端误报失败；活动帧和最终 world event 会出现错序。[现状/上位文档冲突见 §13。]

**步骤 2：命令建立 functional turn。**

`extensions/toolkit/init-command.ts` 在参数合法且进入实际处理前调用 relay，发一个安全的 `tool_start{toolName:'airp-init'}` envelope，固定 `agentId`，生成带 `functional:` 前缀的合成 `turnId`；该 envelope 作为 parent custom message 传回。服务端只检查固定 custom type、字段 schema、functional allowlist 和长度/字符集，不声称存在运行时 relay registry。非法 JSON、非法 kind/target 不产生玩家活动，也不落世界事件。

- 漏了会怎样：玩家看到没有任何初始化开始反馈，或错误输入被误演成一次真实初始化。

**步骤 3：短路/模板分支仍闭环。**

- 已有内容：`initialize/started → completed`，subject 为合法 target，表示「检查后无需动作」；不 spawn、不写事件。
- in-flight 命中：第二次请求 `initialize/started → failed(cancelled/unknown 的业务摘要)`，不启动第二个 child；若产品决定不显示重复请求，必须在前端按同 `agentId/target` 抑制，而不能无声丢帧。[待拍板，见 §14。]
- `template:true` scene：`initialize/started → completed`，与 `recordLayerInitialized` 同一命令成功点；不伪造 child tool activity。

漏了会怎样：短路和零 AI 成功会让胶囊永远显示 working，或者玩家误以为模型已运行而实际只走 W2。

**步骤 4：spawn 子 agent。**

命令在已有 `ctx.spawnAgent({profileId, customTools, timeoutMs})` 调用周围安装 `onSessionCreated` 观察器。观察器在 child `continue()` 之前订阅工具事件，metadata 固定为当前 functional `ActivityTurnContext`；每个 child tool start/end 送到 parent relay，而不是尝试从 server 直接取 child RpcClient。

- 漏了会怎样：`scene-init`/`nook-init` 虽真实写盘，但 parent RpcClient 只有命令外层事件，玩家永远没有「正在写入/完成」胶囊；这是旧实现没有 functional agent 活动的根因。

**步骤 5：结果分流决定初始化 terminal。**

- `status:'completed'` 且 `hasInitProduct`：`initialize/completed`，随后既有 `recordLayerInitialized` 落账。
- `status:'failed'|'timed-out'|'cancelled'` 或 completed 但无产物：`initialize/failed`，error 取安全 reason；随后保持既有 scene W2 / nook no-fallback 分支和 `recordLayerInitFailed`。
- 命令抛异常：同样 terminal failed，`finally` 释放 `inFlight`。

漏了会怎样：world event 可能已经是 `layer_init_failed`，但玩家胶囊仍停在 working；或模型失败被伪报 completed，演出层与世界真相冲突。

### 5.3 child tool 观察接缝

选择 `onSessionCreated` 而不是在 `spawnAgent()` 返回后读取结果：

1. `runSubagent` 创建 session。
2. 执行已有 `onSessionCreated`，观察器立即 `sub.subscribe(listener)`。
3. `continue()` 开始，listener 捕获每一个 `tool_execution_start/update/end`。
4. listener 只把 start/end 的安全 envelope 通过 parent extension 的 `sendMessage` 传回，`update` 不直接生成 activity（长任务进度仍由既有 `image_generation_progress` 等帧处理）。
5. child run 返回状态，命令发 functional initialize terminal。
6. finally unsubscribe/释放 relay；parent stop/world switch 时 open child activity 由服务端 `failTurn` 收束。

- 漏了第 2 步：第一笔工具可能在订阅前发生，出现「只见完成不见开始」。
- 漏了第 4 步：child event 只存在内存，parent RpcClient 不会自然外泄，服务端无法广播。
- 漏了第 6 步：重复命令/重载会重复监听，一个工具产生 N 个胶囊。

### 5.4 R1 writer subagent 与未来 functional

通用 subagent profile 也必须走同一 observer。具体接线：

- `vendor/pi-rp/packages/coding-agent/src/core/subagent/extension.ts:79-140` 的 `createSubagentToolDefinition` 给 `runSubagent` 传入 AIRP activity observer；
- `run.ts:25-40` 扩展 `RunSubagentOptions.onSessionCreated` 的封装仍保留，并在 `:152-155` 前完成 subscribe；
- parent 的 `subagent` tool 本身仍由 lifecycle/event-bridge 映射成 writer 的 `use` activity；child 的工具动作则是 functional activity，不重复冒充 writer。该能力需要 pi-rp vendor 在 `createSubagentToolDefinition` 注入 observer/sink，见施工表第 7 行和 `pnpm pi commit` 红线。

推荐新增 `extensions/toolkit/activity-relay.ts`（NEW）作为 AIRP relay 适配层，导出：

```ts
export const AGENT_ACTIVITY_CUSTOM_TYPE = 'airp_agent_activity';
export type ActivityRelay = (envelope: ChildActivityEnvelope) => void;
export function relayActivityViaParentMessage(
  sendMessage: (message: { customType: string; content: string; display: boolean }, options: { triggerTurn: false }) => Promise<void> | void,
  context: ActivityTurnContext,
  event: ChildActivityEnvelope,
): void;
export function observeSubagentSession(
  session: { subscribe(listener: (event: unknown) => void): () => void },
  context: ActivityTurnContext,
  relay: ActivityRelay,
): () => void;
```

`airp_agent_activity` 必须注册为 `context:'exclude'`、`compaction:'exclude'`、`display:false` 的内部 custom type；它是跨 parent session 的传输封套，不是 chat history。pi-rp 当前 custom message 仍可能存在 parent session JSONL，但不进入 `history.db`/世界事件，不能在玩家聊天面板或模型 context 出现；若上游新增 transient RPC message API，应迁移而不改变 envelope/服务端投影。[推断]

---

## 6. parent relay 的安全边界

### 6.1 Envelope 不等于玩家帧

child relay 的 envelope 只在同进程/parent session 内传输，服务端收到后必须：

1. 检查 custom type 恰为 `airp_agent_activity`；其它 custom message 仍按既有 `airp_init`/普通 session 处理。
2. 检查 `toolCallId`、`toolName`、phase 字段形状；缺失或过长直接丢弃并记录诊断，不广播。
3. 不把 child envelope 的身份 metadata 原样当玩家字段；parent observer 生成并闭包绑定 `ActivityTurnContext`，server 只允许固定 functional allowlist（当前 `scene-init`、`nook-init`，未来新增功能先改本文）与合法 UUID/前缀的 `turnId`，不依赖不存在的 registry。未经 allowlist 的 functional id 直接丢弃。
4. 对 start/end 按 `activityId` 做幂等状态机；同一 terminal 重复到达只忽略。
5. 解析失败不得把 content 原文广播为 `error`，避免 JSON、prompt、密钥和模型思考泄漏。

### 6.2 relay 与长运行进度

`tool_execution_update` 不转成新的 `activityId`，防止一个长任务堆出无限胶囊；已存在的 `image_generation_progress` 继续由 `event-bridge.ts:151-165` 映射。若未来 functional tool 有用户可感知阶段，必须新增 operation/phase 契约并经 `docs/tools/12 §6.2` 回写，不能把 partial result 原样塞进 subject。

### 6.3 多个并发工具

一个 turn 可同时存在多个 toolCall：每个 `toolCallId` 一个 activityId，projector 维护 `Map<activityId, ActivityState>`。开始顺序决定前端 rail 顺序，结束顺序不改 activityId。服务端不做全局串行化；只保证单 EventBridge 实例的 projector 状态更新顺序。

- start A、start B、end B、end A：输出四帧，B 先完成；不能把 B 的 subject/terminal 贴到 A。
- 重复 start：只保留第一帧。
- 重复 end：只保留第一 terminal。
- end 无 start：为防止永远悬挂，服务端可补一帧 started 再发 terminal；该分支必须在测试中固定，不得一会儿丢 terminal、一会儿只发 terminal。
- world switch/bridge.clear：旧 world 的 projector 状态全部清理；不能把旧功能 agent 的 terminal 送给新世界。

---

## 7. 生命周期与前端可见语义

本篇只规定服务端帧语义；消散时长、最多 3 个、队列和 rail 归 `03-前端感知演出设计.md`，但共同契约 §3.2 已冻结前端纯函数落点：`apps/web/src/lib/agent-activity.ts`（NEW）必须导出 `ACTIVITY_COMPLETE_TTL_MS=2400`、`ACTIVITY_FAILED_TTL_MS=4500`、`ACTIVITY_STALE_TTL_MS=90000`、`MAX_VISIBLE_ACTIVITIES=3`，以及可由 `node:test` 直接调用的去重/归并/过期清理函数。本文不把 TTL 或上限藏进服务端帧，也不重新定义这些常量。

服务端必须保证以下生命周期输入：

| 时刻 | 服务端帧 | 玩家语义 |
|---|---|---|
| 工具开始 | `started` | 正在读取/修改/初始化 |
| 工具成功 | `completed` | 已读取/写下/初始化完成 |
| 工具错误 | `failed,error:'tool_error'` | 动作失败 |
| turn timeout | 所有 open activity `failed,error:'timeout'` | 超时收束 |
| stop/cancel/dispose | 所有 open activity `failed,error:'cancelled'` | 已取消，不继续 working |
| process/world stop | 所有 open activity `failed,error:'agent_stopped'` | agent 已停止 |

`agent_progress` 仍由 lifecycle 负责 agent 阶段；`agent_activity` 只表示具体工具动作。writer 的 `writer_idle` 仍在 settled 事件发出；functional 没有既定 `functional_idle` 帧，不另造帧，initialize terminal 作为该命令的活动封口。

activity rail 的 surface：`writer` 与 `functional` 均进入全局 rail；作家不展示 chat history；functional `SubagentResult.text` 不直接冒充玩家台词。world event `layer_initialized/layer_init_failed` 是初始化事实，activity 只作过程感知。

---

## 8. 文件副作用、事件与既有落账

### 8.1 写盘副作用

- 直接 writer tool 的写盘、Chalk、动作层行为不改。
- `scene-init`/`nook-init` child 继续由原 extension/tool/action 写入世界目录；`airp-init` 继续通过 `recordLayerInitialized` / `recordLayerInitFailed` 落世界事件。
- `agent_activity` projector、relay、WS broadcast 不写世界目录、不打开 `LocalWorldStore`、不改 `canvas.db`/`history.db`。
- 自定义 relay message 的隐藏 parent session JSONL 是 engine transport 的副作用，不是玩家 history/world event；必须 `context:'exclude'`、`display:false`，不能进入模型上下文。[推断：若后续 pi-rp 提供 transient extension frame，应替换该 transport。]

### 8.2 事件/落账

- `agent_activity`：只广播，**不落账**。
- `tool_start/tool_end`：保留既有瞬时帧，继续供 footprint/调试路径；不因新增 activity 重复广播或删除。
- `world_event`：只来自已 COMMIT 的 action/event 链；初始化成功/失败仍通过既有 layer action。不能由 activity completed 推导 world event，也不能由 world event 猜工具 start。
- `history.db`：不写 activity；TTS 也不读 activity。

### 8.3 前端接线（仅接口边界）

`apps/web/src/state/useWorld.ts` 增加 `case 'agent_activity'`，转发给全局 rail；不改现有 `tool_start/tool_end` case。`App.tsx`/全局 rail 按 `source`（writer/functional）和 `agentId/turnId` 收束。`apps/web/src/lib/agent-activity.ts` 负责前端可直接测试的去重、归并、TTL 清理和最多 3 个可见项；本文不规定 CSS、文案 locale 或动画实现，这些必须引用共同契约与 03 篇。

漏了 `useWorld` case 会怎样：服务端帧被发出但 `check:ws` 判为未消费，玩家仍看不到胶囊；仅改 frontend 不改 server 则是 dark frame。漏了 `apps/web/src/lib/agent-activity.ts` 的纯函数导出会怎样：去重/过期只藏在 React effect/CSS，node:test 无法直接证明重复帧、TTL 和 MAX_VISIBLE_ACTIVITIES，旧实现可能假绿。新增帧必须同步 `docs/tools/12 §6.2` 和 `tools/check-ws-contract` 的 emit/consume/contract 集合。

---

## 9. 精确代码落点与施工顺序

| 顺序 | 文件/符号 | 设计改动 |
|---:|---|---|
| 1 | `apps/server/src/engine/agent-activity.ts`（NEW） | `ActivityTurnContext`、`ChildActivityEnvelope`、`normalizeActivityOperation`、subject/error sanitizer、`ActivityProjector`；唯一白名单与幂等状态机 |
| 2 | `apps/server/src/engine/lifecycle.ts` `AgentLifecycleManager` | `agent_start` 只建立 run；`turn_start/turn_end` 绑定和结束 opaque turnId；settled/timeout/stop 调 `failTurn`；扩展 `EventSink` context 参数但不破坏既有调用者 |
| 3 | `apps/server/src/engine/event-bridge.ts` `mapEngineEvent` / `EventBridge.emitEngine` | 接入 `ActivityTurnContext`；保留全部既有 frame；tool start/end 额外交给 projector；在 `message_end` 的 assistant 分支旁新增 `role:'custom' && customType:'airp_agent_activity'` 分支；广播新增帧 |
| 4 | `apps/server/src/index.ts` 与 `agent-activity.ts` | 只保留既有 fire-and-forget `/airp-init` prompt 注入；不要同步等待长命令；确认 functional relay 的 parent custom event 进入 bridge |
| 5 | `extensions/toolkit/activity-relay.ts`（NEW） | `AGENT_ACTIVITY_CUSTOM_TYPE`、observer、parent `sendMessage` relay；custom type policy 排除模型 context |
| 6 | `extensions/toolkit/init-command.ts` handler | 在合法请求处理前建立 `scene-init/nook-init` context；`onSessionCreated` 安装 observer；短路/template/spawn/result 分支均发送 terminal；继续原有 inFlight、W2、layer action |
| 7 | `vendor/pi-rp/packages/coding-agent/src/core/subagent/extension.ts` + `run.ts`（**必须 vendor 变更**） | 为通用 `subagent` tool 注入 AIRP observer/sink，向 `runSubagent` 传 `onSessionCreated`；child 工具动作不丢、不冒充 writer；完成后按 `pnpm pi build`/`pnpm pi commit` 红线同步子模块指针 |
| 8 | `docs/tools/12-工具注册与路由统一.md §6.2`、WS checker | 登记 `agent_activity`；发射/消费/contract 三侧同步 |
| 9 | `apps/web/src/state/useWorld.ts`、全局 rail（归 03） | 只按冻结帧接线，保留 footprint 旧分支 |

### 9.1 不应新增的落点

- 不在每一个 `extensions/toolkit/*.ts` 中各写 operation 映射。
- 不在 `world-context.ts` 里写 activity；那会把原生 write/edit 的 world-event 落账逻辑和临时演出混合。
- 不在 `history.db` 增加 activity 表；不要以 store tail reader 回放临时胶囊。
- 不让 frontend 从 `tool_start` 的原始 args 自己推断 activity；服务端才是安全裁剪和白名单唯一来源。
- **禁止用全局 `pi.on('tool_execution_start'|'tool_execution_end'|...)` handler 作为 child relay 接缝**：`runSubagent` 会把父扩展 handler 复制进 child，且事件无 parent/child 标记，会造成重复帧和错误归属；child 只能通过已绑定 `onSessionCreated` observer + 明确的 `airp_agent_activity` relay 送回 parent。

---

## 10. 与现状差异

| 现状 | 新设计 | 不改会怎样 |
|---|---|---|
| `EventSource` 只有 writer/character，map 只发 tool_start/end | lifecycle context + projector 额外发 agent_activity | writer 只有调试帧，没有玩家活动胶囊 |
| lifecycle 只有 `turnStartedAt` 时间，没有 turnId | `turn_start/turn_end` 绑定 opaque engine turnId；agent_start 只建 run | 并发/重放无法稳定去重 |
| child session 的工具事件只在 child 内存；parent 只有命令结果 | `onSessionCreated` pre-run observer + parent custom relay | scene-init/nook-init 中间过程完全不可见 |
| `airp-init` 只 `display:false` 回报结果 | 命令开始、child 工具、命令结果都形成 functional activity 生命周期 | 玩家看不到初始化正在做什么 |
| tool args 在 `tool_start` 既有帧中完整存在 | 保留旧帧，但新 activity 严格裁剪参数 | 若把旧 args 复用给 UI，会泄漏路径/密钥/原文 |
| timeout 只发 `turn_aborted` | timeout/cancel/stop 对 open activity 发 failed | 胶囊永久 working，旧 agent 状态污染新 world |
| `agent_activity` 未纳入 WS contract/consume | tools contract、server emitter、useWorld consumer 同批接线 | dark frame/ghost frame，功能实现看似成功但玩家无感知 |

**非空性对照（必须保留）**：旧实现即使 scene-init child 真写出了 README，也只有隐藏 `airp_init` 回报和 world event；没有任何 functional `agent_activity` frame。新实现用相同 fixture，在 child observer 产生 `tool_execution_start(write)` 与 `tool_execution_end(write,false)`，必须得到非空的 `started` 与 `completed` 两帧。该断言不能改成「允许 0 帧」，否则旧实现也会假绿。

---

## 11. 验收测试设计（不在本文运行）

### 11.1 新增测试文件与导出

1. `apps/server/test/agent-activity.test.mjs`（NEW，按现有 `apps/server/test/map-engine-event.test.mjs:11` 从 `../dist/engine/*.js` 导入）：
   - `normalizeActivityOperation` 覆盖表中每个白名单和 unknown→other；
   - subject 只取白名单字段，绝对路径、JSON、密钥、超长值、自由 choice 均不泄漏；
   - `ActivityProjector` 并发 A/B、重复 start/end、terminal 无 start、clear/world switch；
   - timeout/cancel/agent_stopped 将 open activity 变 failed，已 completed 不回滚；
   - 旧映射 fixture：只构造 child session 事件，不经 parent relay，断言旧行为没有 functional activity；新 relay envelope 经 bridge 后断言 `started + completed` **非空**。
2. 扩充 `apps/server/test/map-engine-event.test.mjs`：writer `tool_execution_start/end` 同时保留 `tool_start/tool_end` 和新增 `agent_activity`；角色既有帧断言不改语义；未知工具不泄漏名字/args。
3. `apps/server/test/event-bridge.test.mjs`：custom `airp_agent_activity` 合法 envelope 转 activity；伪造 custom type、坏 JSON、未注册 context 不广播；world switch 后旧 activity 不出现在新广播。
4. `apps/server/test/turn-timeout.test.mjs`：真实 lifecycle timeout/abort 之后 open activity 有单个 failed terminal，且既有 `turn_aborted` 仍存在。
5. `apps/server/test/init-activity.test.mjs`（NEW，若 init 测试 harness 可复用）：scene-init/nook-init、template、already-initialized、failed、timed-out、cancelled 各有 initialize terminal；只断言 event 表仍是既有 layer event，不把 activity 写入 store。
6. `extensions/toolkit/activity-relay.test.mjs` 或现有 extension 测试目录：确认 observer 在 `onSessionCreated` 回调时先 subscribe，再 `continue`；同一 child listener 只注册一次；relay custom type `display:false`、`context/compaction exclude`。
7. `apps/web/test/agent-activity.test.mjs`（NEW，或 03 篇指定的同等 node:test 文件）直接导入 `apps/web/src/lib/agent-activity.ts` 编译产物，断言四个 TTL/上限常量的数值、相同 `activityId` 重复帧只保留一项、started→completed/failed 归并、completed/failed/stale 到期清理，以及第 4 项后进入短队列而不丢 completed/failed。不得把这些断言改成只驱动 React effect 或等待 CSS。

### 11.2 具体“旧实现必失败”的测试方案

测试 fixture：构造一个假的 parent writer session，child `onSessionCreated` 回调触发两个事件：

```text
tool_execution_start { toolCallId:'child-1', toolName:'write', args:{path:'/secret/world/scene/README.md'} }
tool_execution_end   { toolCallId:'child-1', toolName:'write', isError:false, result:{details:{path:'world/scene/README.md'}} }
```

- **旧实现断言**：直接检查 parent `RpcClient`/旧 `mapEngineEvent` 收集到的 `agent_activity` 数量为 0（child session 没有 parent sink；这是已登记缺陷，不是让测试 skip）。
- **新实现断言**：observer relay envelope 进入 parent custom event，`ActivityProjector` 输出 `agent_activity` 数量为 2，`source:'functional'`、`agentId:'scene-init'`、同一 `turnId`/`activityId`，phase 依次 `started`、`completed`，subject 不包含 `/secret` 绝对前缀和原始 args。

这条用例同时证明「没有 child relay 就没有功能 agent 胶囊」，避免只测试空列表或只断言 world event 的假绿。

### 11.3 既有回归护栏

- `tool_start/tool_end` 仍让 `apps/web/src/state/useWorld.ts:408-423` 的 writer footprint 计数正确。
- Chalk 的 `chalk_writing/chalk_landed`、writer Chalk delta、角色 `character_delta/message/idle` 不因新 context 参数消失。
- `layer_initialized/layer_init_failed` 数量和 details 不变；`agent_activity` 不出现在 `history.db/events`。
- `tools/check-ws-contract.mjs` 新增 `agent_activity` 后 emit/consume/contract 三者均有一处且没有 ghost/dark。
- activity subject 不进入 TTS 请求；TTS 测试由 01/04 按共同纯函数负责。

---

## 12. 需要回写的文档与门禁

实现同批必须回写，不能只在代码里对齐：

### 12.1 `docs/tools`

- `docs/tools/12-工具注册与路由统一.md §3.3/§6.2`：增加 `agent_activity` 发射、载荷、消费与 `agent-activity.ts` 唯一归一化来源；注明它不替代 `tool_start/tool_end`、不落事件。
- `docs/tools/00-共同上下文.md`：若 B1 文档仍把工具帧视为仅调试，补充共同契约的 activity 投影引用；不得另发映射表。
- 受影响的工具文档（至少 `02-chalk`、`03-look-at`、`04-move与delete`、`06-choose`、`07-roll-dice`、`08-use-item-on`、`09-link与arrange`、`10-组件`、`11-generate-image`）：只补「activity subject 取白名单字段」和回指本篇，不在各篇复制 operation 表。
- `tools/check-ws-contract.mjs` 与 `tools/check-ws-contract.test.mjs`：把新帧加入 contract/emitter/consumer 集合。

### 12.2 `docs/perform`

- `docs/perform/00-共同上下文.md`：补 writer/functional activity rail 的来源和「旧 tool_start/end 仍服务 footprint」边界；不得把 activity 当 Chalk 正文。
- `docs/perform/01-作家演出通道.md`：说明 writer Chalk 活动与 Chalk 正文分离、失败/timeout/取消收束；不得把 activity 送 TTS。
- `docs/perform/06-文档回写.md`：登记 `agent_activity` 的 WS 回写项、前后端同批接线和检查命令。

### 12.3 初始化、根规范与测试文档

- `docs/init/00-共同上下文.md`、`docs/init/02-brief与执行内核.md`、`docs/init/03-触发链路与前端.md`：增加 `scene-init/nook-init` activity 的 start/child-tool/terminal 接缝，明确 fire-and-forget 与 world event 仍是事实来源。
- `AGENTS.md`：在架构表/事件通道/检查命令处登记 `agent-activity.ts`、`activity-relay.ts`、`agent_activity` WS 帧、child `onSessionCreated` 观察接缝；注明不改 history.db、TTS 和角色台词。
- `docs/agent-awareness/04-测试与文档回写设计.md`：引用本篇确切模块/导出和上面的旧实现必失败非空断言；引用 01 的 shared TTS helper，不复制正则。
- 若 `docs/wiring/00-共同上下文.md` 的转发集合仍是闭集，增加 `agent_activity` 的全局 rail 消费口径；冲突须在回写篇统一裁决。

---

## 13. 发现的冲突 / 需要修订的上位文档

1. **`docs/tools/12 §6.2` 当前既有帧清单未包含 `agent_activity`，但共同契约 §3 明确本批新增该帧。** 本文不直接改 `docs/tools/12`；由 `04`/文档回写篇统一登记 contract、server emitter、`useWorld` consumer 三侧，解决新帧的 ghost/dark。
2. **`apps/server/src/engine/event-bridge.ts:8` 的 `EventSource` 只有 writer/character，与共同契约的 functional source 不一致。** 这是实现接线缺口，不把 functional 假装成 writer；由本篇的 `ActivityTurnContext`/relay 增加 functional 投影，同时保持既有 `EventSource` 在角色/作家事件映射的兼容。若上位文档要求 EventSource 三值，应由主 agent 在评审门统一修改。
3. **当前 `airp-init` 的 `display:false` custom message 是内部回报，但 child activity 若复用同一通道可能进入 parent session JSONL。** 共同契约只禁止 `history.db`/玩家 chat history；本篇要求 `context:'exclude'`、`display:false`。若评审要求“连 session JSONL 也绝不写”，需要 pi-rp 提供 transient RPC extension frame；本文不私自发明不存在的 API，登记为上游能力冲突。
4. **`docs/init/03-触发链路与前端.md` 已裁决 R2 fire-and-forget，但部分旧段落仍把 RPC response 当完成信号。** 活动 terminal 和 `world_event` 必须来自命令/事件流，不得等待 prompt response；由初始化文档回写篇统一清掉旧口径。
5. **`docs/perform/00` 当前“不新增帧名”的演出批次范围与共同契约新增 `agent_activity` 冲突。** 本文不把它解释成角色演出新增，仍需在 `docs/perform/06` 回写明确本批新增帧由 agent-awareness 契约授权。
6. **子 agent `onSessionCreated` 观察器需要一个 parent relay sink；pi-rp 现有 `ExtensionContext` 没有 `sendMessage`（`vendor/.../extensions/types.ts:315-403`），而 command 的 `pi` closure 有 `sendMessage`。** 因此 `airp-init` 可直接接，通用 `subagent` 需要在 `runSubagentOptions`/AgentSession 或 extension runner 增加可注入 sink。本文只冻结观察时序和 envelope，不擅自改 vendor API 形状；实现前必须由主 agent 选“transient RPC frame”或“注册 sink 的最小 vendor API”。

---

## 14. 仍未知 / 待拍板

1. `ActivityProjector` 放在 `event-bridge.ts` 内部还是独立 `agent-activity.ts` 并由 bridge 持有实例：本文推荐独立文件，避免 `mapEngineEvent` 纯映射和状态 projector 混成不可测试函数；路径/导出已按 §3.2 提案，评审若改必须同步 04。
2. `inFlight` 命中时第二个 `/airp-init` 是否显示一个短暂 failed activity，还是只显示已有 turn 的 started：本文暂采用显示 failed（玩家知道重复请求被拒绝），前端不得制造第三个 capsule；需产品语义拍板。
3. end 无 start 时是否严格补 `started` 再 terminal，或只发 terminal：本文推荐补齐生命周期，避免 UI 端收到未知完成；必须在 projector 单测中固定。
4. `subject` 对相对路径应显示最后 basename，还是保留 world-relative `world/...`：本文限制数据形状而不冻结 locale 文案；前端只接安全 subject，视觉 wording 归 03。
5. parent custom message transport 的 session JSONL 副作用能否接受：若不能，pi-rp 必须提供 parent-directed transient event API；在该裁决前禁止把 activity envelope 写进世界 store 或 history.db 代替它。
6. 通用 `subagent` tool 的 sink 注入落点（AgentSession 新字段、ExtensionAPI 注册、还是 vendor 的 `RunSubagentOptions` 直接回调）需在实现评审时选一条；三种方案都必须保留 `onSessionCreated` 先订阅、父 RpcClient 可观察、source/agentId/turnId 不伪装 writer 三条硬约束。

---

## 15. 评审出口

评审通过的必要条件：

- writer direct tool、`airp-init`、scene-init/nook-init child、未来 functional profile 都有明确 source/agentId/turnId/activityId 来源；
- operation 只有本文引用共同契约的单一白名单，subject/error 不泄漏原始参数；
- child observer 在 `onSessionCreated`、`continue()` 之前安装，且 parent RpcClient 可收取 relay；
- successful/failed/timeout/cancelled/duplicate/concurrent/world-switch 均有单测，且旧实现无 functional activity、新实现有非空 `started+completed` 对照；
- 新帧与旧 `tool_start/tool_end` 并行，footprint/history/world_event/Chalk 不回归；
- `docs/tools`、`docs/perform`、`docs/init`、`AGENTS.md` 和 `04` 的回写任务被同一批登记；
- 所有未决项在实现前由主 agent 统一拍板，不能由某个 extension/toolkit 私自改共同契约。
