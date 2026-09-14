# 08 整理 Agent 运行时与动作工具设计

> 状态：契约已冻结，允许进入实现（2026-09-15）；只定义 B「独立 functional canvas-arranger Agent 的 spawn、lifecycle、preset、scope、工具白名单、动作事务、版本、取消与结果」；不改实现，不改 `docs/layout/06-画布重叠治理与整理Agent共同上下文.md`。本文严格引用 06 §4.5 canonical contract；若实现证据推翻本文，先登记并同回合回写。
>
> 关联设计篇：A `docs/layout/07-自动生成与坐标写入治理.md`（全层障碍、真实 AABB、`canvas_meta` 版本与原子落位）；F `docs/layout/12-整理Agent提示词设计.md`（唯一 system/task prompt、读—截图—整理—复核顺序）；C `docs/layout/09-画布感知与Playwright截图设计.md`（`CanvasSnapshotV1` 与同画布截图）；D `docs/layout/10-整理入口与过程反馈设计.md`（HTTP 入口、取消与本地请求态）；E `docs/layout/11-整理验收与回写设计.md`（验收与回写）。这些篇章不得互相复制归属。

## 1. 一句话定位

**`canvas-arranger` 是一个每次点击独立 spawn、独立 session、受控 functional Actor、只看当前层并通过 ActionService 原子整理 `canvas.db` 的功能 Agent；它不借 Writer turn、不写世界正文、不以工具成功冒充整理完成。**

## 2. 不可越过的上位边界

1. 06 §4.1 将世界正文/实体字段与画布坐标、尺寸、links、presence、viewpoint 分开：本 Agent 只能改变 `.airpworld/canvas.db` 当前值，不能写 `*.md`、`world.json` 或把布局写进正文。所有持久坐标写入必须通过 `LocalWorldStore` / `createActionService`（06:52-54）。
2. `flowColumns` 仍是自动新批、footprint 纠偏与幻影座位的唯一纯几何来源；B 不在 prompt、浏览器脚本或工具壳复制坐标算法（06:54）。A 负责把全层障碍、真实 `w/h`、AABB 验证接入专用动作。
3. 整理是玩家明确点击授权的整体动作，可移动稳定卡，但不伪装为自动生成；需要同一个 `operationId`、`agentId`、`turnId` 穿过接受、运行、每次工具调用、提交、回读、完成/失败/取消（06:55-56）。
4. 业务来源固定是 `functional`，稳定 `agentId = 'canvas-arranger'`；不能把 session id 当 turn id，不能使用 `writer`/`character`（06:60）。
5. `ActivityFrame.phase` 只允许 `started | completed | failed`；D 的 `accepted → processing → arranging → verifying → landed/completed` 是前端本地请求态，不是 B 新造的 Activity phase，也不能从 spawn 成功猜测完成（06:62、`apps/server/src/engine/agent-activity.ts:8-20`）。
6. 整理成功的必要条件是提交后再次读取**全层**最新 rows，按真实 `w/h` 得到零 AABB overlap，并确认版本未变；`canvas.db` 写入成功、Agent 返回一段文本、截图成功都不是充分条件（06:64、06:77-80）。

## 3. 当前事实与残留缺口

| 事实 | 证据 | 对本设计的后果 |
|---|---|---|
| 当前生命周期只有 Writer 与 Character RpcClient；Writer 有 queue/timeout，Character 有独立 session | `apps/server/src/engine/lifecycle.ts:61-86,135-157,175-233` | 必须增设独立 functional client/operation registry；不可把整理排进 `writerQueue` 或复用 Writer client |
| Writer 的 spawn 从 `writerLaunch` 得到 preset、session-dir、隔离 flags、extension/skill；`RpcClient` 在 `start` 前可注册 `onEvent` | `apps/server/src/engine/launch.ts:8-23,43-76,121-163`；`apps/server/src/engine/lifecycle.ts:186-207` | `canvasArrangerLaunch` 应复用 `LaunchSpec` 与 `RpcClient` 接缝，但使用独立 preset、显式扩展和独立 session 文件 |
| `installPreset` 只能接受 preset 顶层 `id` 并复制到世界 `.airpworld/prompt-presets/` | `apps/server/src/engine/presets.ts:12-38` | 启动前必须安装并校验 `canvas-arranger`；缺失/无效时失败，绝不静默掉回默认/Writer preset |
| `extensionArgs` 会扫描 repo/world 顶层扩展；`--no-extensions` 下显式 `--extension` 仍可加载 | `apps/server/src/engine/presets.ts:124-158`；`apps/server/src/engine/launch.ts:63-68` | functional 进程不能调用通用 `extensions/tools.ts`；采用 `--no-extensions` + 显式 `canvas-arranger.ts` |
| 通用扩展工具入口注册 17 个工具，`arrange` 只是现有 `arrangeCards` 包装 | `extensions/tools.ts:20-39,51-72`；`extensions/toolkit/arrange.ts:19-91` | 现有 `arrange` 工具面太宽且 layout 子集不避让未选卡（06:39）；新增专用工具而非让 Agent 盲调旧 `arrange` |
| 现有 `arrangeCards` 对 `paths` 计算、用 `placeCards` 做一事务，但不做全层碰撞判定 | `packages/shared/src/actions/canvas.ts:423-441,514-575`；`packages/shared/src/store/local-store.ts:1275-1303` | 新动作必须把全层最新 rows 交给 A 的安全求解/验证；模型传 x/y 不能算安全 |
| `ActionContext` 的 `actor`/`agentScope` 是动作权限输入，`createActionService` 默认从 `AIRP_AGENT_SCOPE` 取 scope | `packages/shared/src/actions/types.ts:7-26`；`packages/shared/src/actions/service.ts:135-156` | functional Actor/Scope 必须在 server 与工具壳显式绑定，不能信任模型给的字段 |
| 当前 `ActorType` 没有 functional，`AgentScope` 只有 writer/character/initializer/player/engine；`resolveAgentActor` 对未知角色回退 writer | `packages/shared/src/actions/actor.ts:9-49,78-83` | 不能复用 `engine`：06 已冻结 engine 是 trusted internal 且与 nook 放权耦合；必须增受控 functional actor 并对 functional 进程 fail-closed |
| `event-bridge` 当前 EventSource 只有 writer/character，`canvas_patched` 只在工具名 `link`/`arrange` 时发；functional relay 校验已支持 functional activity context | `apps/server/src/engine/event-bridge.ts:13-17,274-321`；`apps/server/src/engine/agent-activity.ts:3-47,135-171` | 扩 functional EngineEvent 映射，但复用 `agent_activity` 与 `canvas_patched`，不新增 WebSocket |
| `RpcClient` 的 `prompt` 只确认“已发送”，需 `waitForIdle`/事件等待；`abort` 单独发送；单次 RPC response 30s 超时 | `vendor/pi-rp/packages/coding-agent/src/modes/rpc/rpc-client.ts:268-296,643-693,813-861` | B 必须分开 command response、Agent idle、总时限与取消；不可把 prompt resolve 当完成 |
| `RpcClient.stop` 先 SIGTERM、1s 后 SIGKILL，并清空监听/请求 | `vendor/pi-rp/packages/coding-agent/src/modes/rpc/rpc-client.ts:156-184` | world switch、取消、超时后要取消等待、停止 client、关闭资源；已提交坐标不回滚 |
| 世界切换目前停角色、关闭旧 store 后重开 Writer | `apps/server/src/routes/world.ts:577-607` | 必须在关闭旧 store 前 `canvasArrangerRuntime.stopAll()`，防止 functional 子进程写入新 world 或旧连接已关闭的数据库 |

## 4. 裁决：新增受控 functional Actor，不复用 engine

### 4.1 身份形状

下列形状是本篇给评审冻结的跨模块建议；实现必须同时回写 `packages/shared/src/actions/actor.ts`、`packages/shared/src/schemas/events.ts`、事件协议和工具共同上下文，不能只在 functional 扩展里字符串比较。

```ts
// packages/shared/src/actions/actor.ts
export type ActorType = 'player' | 'god' | 'writer' | 'character' | 'engine' | 'functional'; // NEW
export interface Actor {
  type: ActorType;
  /** character carries character id; functional carries only 'canvas-arranger'. */
  id?: string;
}

export type AgentScope =
  | 'writer-top-level'
  | 'character'
  | 'initializer'
  | 'player'
  | 'engine'
  | 'functional-canvas-arranger'; // NEW

export const FUNCTIONAL_ARRANGER_ROLE = 'functional:canvas-arranger' as const; // NEW
export const FUNCTIONAL_ARRANGER_SCOPE = 'functional-canvas-arranger' as const; // NEW
```

- `AIRP_AGENT_ROLE` 只有精确值 `functional:canvas-arranger` 才能获得 functional actor；`AIRP_AGENT_SCOPE` 只有精确值 `functional-canvas-arranger` 才能进入专用动作。任一缺失、拼写变体、未知值、actor id 不符都在子进程第一次工具调用前抛 `forbidden`，不回退 writer/engine。
- 建议新增并由 functional 扩展唯一调用：

```ts
export function resolveFunctionalArrangerActor(
  rawRole: string | undefined,
  rawScope: string | undefined,
): { actor: { type: 'functional'; id: 'canvas-arranger' }; agentScope: 'functional-canvas-arranger' }; // NEW
```

此函数不是“检查后继续用 `agentActor()`”：它必须在不匹配时抛出英文 `Invalid functional arranger identity or scope.`。通用 Writer/Character 的兼容降级不得被此专用入口复用；否则当前 `resolveAgentActor` 的未知 role→writer 行为（`actor.ts:21-49`）会给错误进程整理能力。

- `readerOfActor({ type: 'functional', id: 'canvas-arranger' })` 返回 `null`：整理不消费世界事件，也不应创建 `read_cursors`。`actorLabel` 返回 `canvas-arranger`；`actorRef` 返回 `functional:canvas-arranger`。
- `canMutateCharacterNook` / `assertNookMutationAllowed` 对 functional scope 一律 false/拒绝；functional 不能借 engine 的 nook 放权。
- `ActorTypeSchema` / `ActorSchema` 与历史数据库 `actor_type` 注释/约束必须增 `functional`，但本动作不追加 `WorldEvent`。若评审不接受新增 ActorType，功能 Agent 不能落地，不能偷偷把 `engine` 当别名。

### 4.2 为什么不是 engine

现有 `engine` 的语义是 trusted internal caller；`AgentScope='engine'` 与 writer 等价放行 nook 变更（`packages/shared/src/actions/actor.ts:78-103`）。把外部模型进程标成 engine 会使工具白名单失效时仍可能取得内部权限。因此本篇选择受控 functional actor，即使需要同步 ActorType、Scope、reader、权限与事件 schema，也把“可整理画布”与“可执行内部引擎/生命轨迹”分开。

### 4.3 事件口径

功能 Agent 的 `agent_activity` context 使用：

```ts
export interface ActivityTurnContext {
  source: 'functional';
  agentId: 'canvas-arranger';
  turnId: `functional:canvas-arranger:${string}`;
} // NEW specialization of existing context
```

`agent_activity.phase` 仍只能 `started | completed | failed`；`turnId` 是操作身份，不能改成 session 文件名。整理不写 `arranged` world event，不进入 `WriterResult`、TTS、history tail 或 `appendEvent`。Functional Actor 只会出现在需要记录 actor 形状的内部审计/动作上下文；画布提交仍由 `canvas_patched` 表示当前值。

## 5. 对外操作与运行时类型

### 5.1 D 使用的 HTTP 输入/响应边界

B 不拥有按钮视觉，但为 D 冻结运行时所需的操作身份字段：
```ts

export interface CanvasArrangeRequest { // NEW; exact shape from 06 §4.5
  worldId: string;                 // opaque active-world manifest id
  layer: string;
  mode: 'grid' | 'circle' | 'row';
  requestId: string;
  expectedRevision: number;         // world history high-water mark
  expectedCanvasVersion: number;    // canvas.db per-layer position version
  snapshotId: string;               // CanvasSnapshotV1 identity
  screenshotPolicy: 'none' | 'before' | 'after' | 'before_and_after';
}

export interface CanvasArrangeAccepted { // NEW; HTTP 202
  ok: true;
  operationId: string;
  requestId: string;
  worldId: string;
  layer: string;
  agentId: 'canvas-arranger';
  turnId: `functional:canvas-arranger:${string}`;
  stage: 'accepted';
}
```

POST /api/canvas/arrange with the exact request above returns HTTP 202 and the exact ack above. `worldId` is opaque; server resolves it to the active world internally. Missing/unknown world, layer, version, snapshot or screenshot policy fails before spawn.

Cancellation is `POST /api/canvas/arrange/:operationId/cancel` with `{ worldId:string, layer:string, requestId:string }`, HTTP 202, and `{ ok:true, operationId, requestId, worldId, layer, stage:'cancel_requested'|'already_completed'|'already_cancelled' }`. It only requests cancellation; it does not claim rollback.
### 5.2 专用动作：统一 ActionService/store 命名

整理专用模型工具名为 `arrange_canvas`；其唯一 ActionService 入口为 `arrangeCanvas(ctx,input)`，其唯一 store 内核为 `arrangeCanvasLayer(store,input)`。现有 `arrangeCards` 仍是旧调用，不是整理 Agent 安全入口。

```ts
export interface ArrangeCanvasInput { // NEW
  operationId: string;
  layer: string;
  mode: 'grid' | 'circle' | 'row';
  expectedRevision: number;
  expectedCanvasVersion: number;
  snapshotId: string;
  policy: 'deoverlap';
  allowMoveStableCards: true;
  preserveLinks: true;
}

export interface ArrangeCanvasDetails { // NEW
  kind: 'cards';
  action: 'arrangeCanvas';
  operationId: string;
  layer: string;
  mode: 'grid' | 'circle' | 'row';
  expectedRevision: number;
  revision: number;
  expectedCanvasVersion: number;
  canvasVersion: number;
  canvasRevision: string;
  snapshotIdBefore: string;
  snapshotIdAfter: string;
  cards: Array<{ path: string; x: number; y: number; z: number; w: number; h: number }>;
  movedCount: number;
  overlapCount: number;
  committed: boolean;
}

export async function arrangeCanvas(
  ctx: ActionContext,
  input: ArrangeCanvasInput,
): Promise<ActionResult<ArrangeCanvasDetails>>; // NEW
```

The store kernel is owned by A/LocalWorldStore and has the exact shape in 07 §4.2:
`arrangeCanvasLayer(store: WorldStore, input: ArrangeCanvasLayerInput): Promise<ArrangeCanvasLayerResult>`.
It owns the full-layer planner, snapshot/version fence, AABB guard and atomic commit. B does not define a second Agent-facing action or helper.

### 5.3 结果与版本语义

- `expectedRevision` 是历史数据库 `getMaxSeq()` 的世界高水位，只用来证明请求观察到的世界版本；不能代替画布位置版本，因为 arrange/drag 不落 history event。
- `expectedCanvasVersion` 是 A 设计的 `canvas_meta(layer PRIMARY KEY, position_version)` 当前值；它不是第二坐标真相，只有并发护栏；不能让 Agent 直接改。
- `snapshotId` 是 C 的 `CanvasSnapshotV1.snapshotId`；`canvasRevision` 是该 snapshot 对当前 canvas.db 值的 digest。B 只消费 C 的 identity，不复制 hash 算法，三者不能互换。
- 安全动作在事务前再次获得最新 snapshot identity；不匹配则返回 `conflict`（HTTP 409，带 expected/current snapshot/version），无任何写入。事务内 `BEGIN IMMEDIATE` 再检查 `expectedCanvasVersion`，防止两个整理或整理/拖拽同时通过同一版本。
- 事务提交后立即全层回读；若 `overlapCount !== 0`、最新 `canvasVersion` 不等于本次递增值、或 `canvasRevision`/snapshot 在提交窗口变化，结果是 `committed: true` 但 `completed` 不成立，报告 `partial` 或 `conflict`，坐标事实保留并要求重新读取。
- 正常 completed 只由 runtime 在 `committed: true`、最新全层 rows 零重叠且版本/identity 可证明时判定；screenshot/DOM 只提供证据，不能自授视觉完成。截图失败按 screenshotPolicy 在提交前为 failed/no-write、提交后为 partial/conflict。

### 5.4 ActionService 与工具壳

在 `packages/shared/src/actions/service.ts:32-77,80-107` 增加唯一 `arrangeCanvas(input: ActionInput): Promise<ActionResult>` 及注册名 `arrangeCanvas`；`packages/shared/src/actions/canvas-arranger.ts` 仅承载该 handler。旧 `arrangeCards` 仍存在但不属于整理 Agent。

新增独立工具壳（建议 `extensions/toolkit/arrange-canvas.ts`）只折叠 `mode/layer/operationId/expected*` 并调用专用 service：

```ts
export const arrangeCanvasTool: ToolDefinition = defineTool({
  name: 'arrange_canvas',
  label: 'Arrange Canvas Safely',
  description: 'Arrange the complete current layer using server-side collision safety.',
  parameters: /* exact TypeBox object for ArrangeCanvasInput, additionalProperties:false */,
  async execute(
    toolCallId: string,
    params: CanvasArrangeInput,
    signal: AbortSignal,
    onUpdate: (update: unknown) => void,
    ctx: ExtensionContext,
  ): Promise<ToolResult>, // NEW
});
```

工具壳必须：

1. 从受控 env 读取 operationId/turnId/role/scope，拒绝 params.operationId 与 env 不等；不接受模型自选 actor、world root 或 DB 路径。
2. 用 `createActionService(worldStore(ctx), { type: 'functional', id: 'canvas-arranger' }, { turn: envTurnId, agentScope: 'functional-canvas-arranger' })` 创建服务；不能调用通用 `getActionService(ctx)`，因为它会走进程级 `agentActor()`。
3. 将 `signal.aborted` 转换为 ActionError `cancelled` 前置检查；动作进入事务后由数据库提交边界决定是否保留已提交事实。
4. 用 `ok(result)`/`fail(error)`，不直接 `queryCanvas`/`execCanvas`，不打开第二个 DB 连接，不写文件。

## 6. Spawn、preset 与 scope

### 6.1 独立 LaunchSpec

在 `apps/server/src/engine/launch.ts` 新增：

```ts
export function canvasArrangerLaunch(
  repoRoot: string,
  worldRoot: string,
  vendorCliPath: string,
  operationId: string,
  turnId: string,
): LaunchSpec; // NEW
```

该函数必须：

- 安装 `presets/canvas-arranger.json`，session 目录使用 `sessionsDirOf(worldRoot)`；每个 operation 使用唯一 `.airpworld/sessions/canvas-arranger-${operationId}-attempt-${n}.jsonl`，不与 Writer/Character session 重用。
- `cwd = worldRoot`，`PI_PROJECT_CONFIG_DIR = .airpworld`，`PI_CODING_AGENT_DIR` 仍由 `agentDirEnv(repoRoot)` 固定；传 `AIRP_AGENT_ROLE=functional:canvas-arranger`、`AIRP_AGENT_SCOPE=functional-canvas-arranger`、`AIRP_ARRANGER_OPERATION_ID=operationId`、`AIRP_ARRANGER_TURN_ID=turnId`。
- args 至少包含 `--approve --preset canvas-arranger --session-dir <sessions> --session <per-operation-file> --no-extensions --no-skills --no-context-files --no-prompt-templates --no-themes --tools view_canvas,screenshot_canvas,arrange_canvas --extension <repoRoot>/extensions/canvas-arranger.ts`。显式 extension 是唯一允许的 extension；不得传 `extensionArgs(repoRoot, worldRoot)`，否则会加载 `tools.ts` 与世界扩展。
- 任意 preset 安装失败、显式扩展不存在、scope/role 不精确时拒绝 spawn；不能把 `--tools` 无法生效降级成全工具。
- `--tools` 是 pi-rp 官方 allowlist：CLI `vendor/pi-rp/packages/coding-agent/src/cli/args.ts:123-136,325-330`，SDK 的 options 也确认它覆盖 built-in/extension/custom tools（`vendor/pi-rp/packages/coding-agent/src/core/sdk.ts:84-105,293-309`）。

### 6.2 专用 preset

新文件 `presets/canvas-arranger.json`（NEW）只拥有整理 Agent 必需的工具与 F 提供的静态 prompt 插槽；B 不在该文件重新写 F 的 system/task prompt。建议最小形状：

```json
{
  "schemaVersion": 1,
  "id": "canvas-arranger",
  "name": "Canvas Arranger",
  "description": "AIRP functional canvas arrangement agent",
  "tools": { "allow": ["view_canvas", "screenshot_canvas", "arrange_canvas"] },
  "items": [
    { "kind": "slot", "id": "tools", "slot": "tools", "options": { "onlyWithSnippets": true } },
    { "kind": "slot", "id": "tool-guidelines", "slot": "tool-guidelines", "options": { "includePiDefaultGuidelines": false, "heading": "Guidelines:" } }
  ]
}
```

F 篇（`docs/layout/12-整理Agent提示词设计.md`）拥有 system/task prompt 与工具顺序，runtime 只传入 F 生成的 task payload（含 operation/layer/version/snapshot identity），不能将 prompt 拼接在 Writer prompt 或调用 `submitWriter`。Preset 中不能加入 `chat-history`、Writer skills 或 `subagent`；即使误加载，`--tools` allowlist 也必须再次拒绝。

### 6.3 专用顶层扩展与白名单矩阵

新文件 `extensions/canvas-arranger.ts`（NEW）只注册 `view_canvas`、`screenshot_canvas` 与 `arrangeCanvasTool`。它不得 import `extensions/tools.ts`；只可 import C 的只读 view/screenshot shell、B 的专用 arrange shell、`worldStore` 与 `resolveFunctionalArrangerActor`。

| 能力 | functional Agent | 原因/失败 |
|---|---:|---|
| `view_canvas`（结构化；C 的 canonical `CanvasSnapshotV1`） | 允许 | 首次读取与提交后复核；只读，不替代版本校验 |
| `screenshot_canvas`（C 的同画布只读截图） | 允许 | 按 screenshotPolicy/提示词按需调用；失败显式 |
| `arrange_canvas` | 允许 | 唯一写入入口；ActionService + 全层安全动作 |
| 旧 `arrange` / `link` | 禁止 | 避免 subset overlap、关系线副作用与旧语义 |
| `read`、原生 `write`/`edit`、`bash`、`grep`、`find`、`ls`、`move`/`delete` | 禁止 | 防止世界正文/文件系统写入与路径探测 |
| `chalk`、`generate_image` | 禁止 | 不得产生叙事/TTS/图片副作用 |
| `choose`、`roll_dice`、`use_item_on`、`move_to`、`set_following` | 禁止 | 不得改变玩法或角色行为 |
| `get_state`、`state_update`、`subagent`、`subagent_profiles` | 禁止 | 不引入状态命名空间、不 spawn 子 Agent、不占 Writer |

白名单是三层防线：显式扩展注册集、preset `tools.allow`、CLI `--tools`。任一层出现额外工具都应在启动探针失败；不能只写一张文档清单。

## 7. FunctionalArrangerRuntime 生命周期

### 7.1 完整运行时接口

在 `apps/server/src/engine/canvas-arranger-lifecycle.ts` 新增独立运行时，不把字段塞进现有 Writer queue：

```ts
export interface CanvasArrangerRuntimeOptions { // NEW
  repoRoot: string;
  vendorCliPath: string;
  getActiveStore: () => LocalWorldStore | null;
  eventSink?: (
    source: 'functional',
    event: JsonAgentSessionEvent,
    characterId: undefined,
    turnId: string,
  ) => void;
  activityFailureSink?: (
    source: 'functional',
    characterId: undefined,
    turnId: string,
    reason: 'timeout' | 'cancelled' | 'agent_stopped',
  ) => void;
  onRuntimeSignal?: (signal: CanvasArrangerRuntimeSignal) => void;
}

export interface CanvasArrangerRuntimeSignal { // NEW; not a WS frame
  type: 'spawned' | 'tool_started' | 'tool_completed' | 'committed' | 'verified' | 'failed' | 'cancelled' | 'conflict';
  operationId: string;
  requestId: string;
  worldId: string;
  layer: string;
  agentId: 'canvas-arranger';
  turnId: `functional:canvas-arranger:${string}`;
  toolName?: 'view_canvas' | 'screenshot_canvas' | 'arrange_canvas';
  error?: 'invalid_request' | 'tool_error' | 'timeout' | 'cancelled' | 'agent_stopped' | 'conflict' | 'verification_failed' | 'unproven_latest';
  outcome?: 'completed' | 'partial' | 'failed' | 'cancelled' | 'conflict';
  result?: ArrangeCanvasDetails;
}

export interface CanvasArrangerOperation { // NEW
  operationId: string;
  requestId: string;
  worldId: string;
  layer: string;
  agentId: 'canvas-arranger';
  turnId: `functional:canvas-arranger:${string}`;
  expectedRevision: number;
  expectedCanvasVersion: number;
  snapshotId: string;
  screenshotPolicy: 'none' | 'before' | 'after' | 'before_and_after';
  cancelRequested: boolean;
  committed: boolean;
  terminal: boolean;
  outcome?: 'completed' | 'partial' | 'failed' | 'cancelled' | 'conflict';
  result?: ArrangeCanvasDetails;
}

export class CanvasArrangerRuntime { // NEW
  constructor(options: CanvasArrangerRuntimeOptions);
  start(request: CanvasArrangeRequest): Promise<CanvasArrangeAccepted>;
  get(operationId: string): CanvasArrangerOperation | null;
  cancel(operationId: string): Promise<{ ok: true; operationId: string; requestId: string; worldId: string; layer: string; stage: 'cancel_requested' | 'already_completed' | 'already_cancelled' }>;
  stopAll(): Promise<void>;
}
```

`outcome: 'conflict'` 是独立终态：任何并发版本变化、snapshot 不一致、无法证明最新 rows、提交后无法判断事实归属都必须发 conflict，不能压成 failed 或 cancelled。`outcome` 只存在 server operation/runtime signal，不扩写 `agent_activity.phase`，也不新增 WS 帧。

`onRuntimeSignal` 只供 D 的 server-side operation registry 记录事实，不转成新的 WebSocket frame；D 本地状态仍按 06/4.3 映射。`eventSink` 调 `eventBridge.emitEngine('functional', ...)`；functional 的 `characterId` 始终 `undefined`。

### 7.2 生命周期时序

```mermaid
sequenceDiagram
  participant UI as D UI
  participant S as server route/runtime
  participant A as canvas-arranger RpcClient
  participant C as view_canvas / C snapshot
  participant DB as canvas.db
  participant W as Writer RpcClient

  UI->>S: POST /api/canvas/arrange (worldId, layer, mode, versions, snapshotId, screenshotPolicy)
  S->>S: active-world + one-flight + requestId check
  S-->>UI: 202 accepted(operationId, functional turnId)
  S->>A: spawn isolated session/preset/extension
  S-->>UI: runtime signal spawned (D maps local state)
  A->>C: view_canvas structured snapshot
  opt screenshot requested by task
    A->>C: screenshot_canvas(snapshotId)
  end
  A->>A: F task decides one arrange_canvas call
  A->>DB: arrangeCanvasLayer(store,input) (version check + one transaction)
  DB-->>A: cards + canvasVersion + snapshotIdAfter
  A->>C: view_canvas structured re-read
  A-->>S: agent_settled + tool events
  S->>DB: server postcondition re-read (same active world)
  S-->>UI: canvas_patched + functional activity; D maps terminal local state
  S->>A: stop/close isolated client
  W-->>DB: may write concurrently; version check/postcondition detects conflict
```

编号行为与漏项后果：

1. **捕获 active world 与请求身份**：校验 opaque `worldId` 能解析到 `getActiveStore()`、layer 存在、版本/快照字段完整；内部只用 active store.worldRoot。漏掉会把旧页面请求写进新 world，或让模型在无层状态下自行猜层。
2. **按 world（至少按 layer）单飞登记**：先登记 `requestId → operationId`，再返回 202。漏掉会让双击 spawn 两个 client，两个模型基于同一 snapshot 覆盖坐标。
3. **先注册 event listener 再 `client.start()`**：监听须把 `source='functional'`、固定 `agentId/turnId` 传给 EventBridge。漏掉会丢掉首个 `agent_start`/tool start，Activity rail 永久悬挂或无法证明独立 Agent。
4. **spawn 只加载专用 preset/extension**：参数必须由 `canvasArrangerLaunch` 生成。漏掉 `--no-extensions` 或 `--tools` 会暴露原生 write/edit/bash 或全套 AIRP 工具，等同取消文件写保护。
5. **runtime 传 F 的 task payload，不传 Writer 上下文**：任务带 worldId、layer、operationId、expectedRevision、expectedCanvasVersion、snapshotId 与 screenshotPolicy。漏掉 snapshot 身份会让 Agent 看完旧层仍能写新层；注入 Writer chat 会把整理伪装成叙事 turn。
6. **Agent 先 `view_canvas`，按 F 要求可选截图，再一次 `arrange_canvas`，再 `view_canvas`**。漏掉首次结构化读取/复读会把工具成功当作事实；漏掉复读会掩盖并发写或残余 overlap。
7. **动作只收服务器求解结果**：`arrange_canvas` 不接受模型 x/y；`arrangeCanvasLayer(store,input)` 在事务内全层 AABB 校验。漏掉服务端求解会让“模型说不重叠”成为伪证明。
8. **Agent settled 后 server 再验证 active Store**：检查同一 worldId、全层最新 rows、canvasVersion、canvasRevision、snapshotId、overlapCount，才能发 landed/completed/partial/conflict 的终态信号。漏掉 server 后读会把异常 client 的自然语言/工具 result 冒充最终值。
9. **最后清理 client 与 operation registry**：`stop`、取消 timer、删除临时监听；保留 operation 的 terminal result 供幂等查询。漏掉会泄漏 child process，或重复终态覆盖下一次操作。

### 7.3 Agent run 与 provider turn 的边界

pi-rp 同时暴露 `agent_start`、`agent_end`、`agent_settled` 与 `turn_start`：`AgentSessionEvent` 在 `vendor/pi-rp/packages/coding-agent/src/core/agent-session.ts:239-247` 声明前两类与 settled，扩展事件类型和 `turnIndex` 则在 `vendor/pi-rp/packages/coding-agent/src/core/extensions/types.ts:800-833` 声明。现有 `AgentLifecycleManager.handleEngineEvent` 也分别处理 `agent_start` 与 `turn_start`（`apps/server/src/engine/lifecycle.ts:301-317`）。并行复现证明一次 provider request 可能再次触发 `turn_start`；因此：

1. **operation 边界只认 `agent_start → agent_end/agent_settled`**：在第一次 `agent_start` 建立总预算、`operationId` 与 cancel guard；`agent_end`/`agent_settled` 后才允许终态复核与清理。漏把 provider turn 当 run 会在中途重置预算、重复发 completed 或提前释放单飞锁。
2. **`turn_start` 只更新内部 provider-turn 观测，不重置 operation**：它可用于诊断当前 provider request，但不改变固定的 functional `turnId`、不清除 `cancelRequested`、不重开 session、不重新 arm total timer。漏掉会让一个长期 Agent 绕过总超时并二次执行整理。
3. **idle timer 与 total timer 分开**：message/tool activity 可刷新 idle timer；total deadline 从 agent_start 计算一次。`RpcClient.waitForIdle` 以 `agent_settled` 为完成条件（`vendor/pi-rp/packages/coding-agent/src/modes/rpc/rpc-client.ts:643-661`），但不能把一次 `turn_start` 或 prompt command response 当 operation 完成。
4. **自动重试只允许 agent_start 前 spawn/初始化失败**：`agent_end` 的 retry/settled 事件不能触发第二次 `arrange_canvas`；若 tool 已开始而提交归属不明，走独立 `outcome='conflict'`，不重试。

## 8. 并发、幂等、取消、超时与重试

### 8.1 单飞与幂等

- registry `inFlightByWorld: Map<string, CanvasArrangerOperation>`（实现私有字段，NEW）对一个 active world 只允许一个整理 operation；这比“同 layer”最低要求更强，避免跨层共用一张 DB 的版本序列。若 D 要并行不同层，必须先由评审证明 A 的 `canvas_meta`/SQLite 锁覆盖，并把 map 改为 `Map<string /*world/layer*/,...>`，不能自行放宽。
- 同 `requestId` + 同 world/layer + 同输入版本：若进行中返回现有 `operationId`（或 409 `in_progress`，由 D 冻结）；若已 terminal 返回原结果，绝不 spawn 第二个 Agent。相同 requestId 改 layer/world/版本返回 409 `request_reuse_mismatch`。
- `operationId` 由 server `randomUUID()` 生成；turnId 固定 `${FUNCTIONAL_ARRANGER_ROLE}:${randomUUID()}`，每次全新 operation 都不同。重试不得复用另一个 operation 的 turnId。
- client session 文件可因重启保留，但不能 `--continue` 一个未确认是否提交的 session；否则同一模型可能再次调用动作。任何尝试都必须先检查 operation registry/versions。

### 8.2 与 Writer、生成、footprint、拖拽的并发

- functional client 与 Writer client 是不同 `RpcClient`、不同 session 文件、不同 turnId；`start`/`prompt` 绝不调用 `submitWriter`。Writer 的 `writerQueue`（`lifecycle.ts:83,135-157`）不增加 queued beat，不 abort Writer。
- 06 §3 的最新复核指出 `apps/server/src/engine/context.ts:125-193` 会在每个 provider request 追加同一 `llmRole=user` 状态块，`turn_start` 重入可令 Writer 自激重复 Chalk；因此 B 不能以“Writer idle/本轮未写入”作为并发证明，只能依赖 functional 自己的版本快照与提交后全层复读，发现 revision/canvasVersion 不可证明时发独立 conflict。
- 与 Writer/生成/footprint/拖拽并发时，每一方的 canvas 写动作必须递增 `canvas_meta.position_version`；整理事务检查 expected version，冲突则无写入并回读最新 rows。`expectedRevision` 仅作为世界文件变更的额外护栏，不能替代 canvas version。
- Writer 正在写正文但尚未写 canvas 时，整理可以提交其捕获版本；提交后的 server verification 若内容/事件 revision 已变化，保守报告 conflict 而非完成。已提交位置不自动撤销。
- 旧前端乐观 `reqSeqRef`/HTTP 返回顺序不是并发保证（06:40）；`canvas_patched` 的 `canvasVersion` 必须由 A/D 在同批前端消费按版本丢旧。

### 8.3 取消边界

1. `cancel(operationId)` 先把 `cancelRequested=true`，阻止尚未 spawn/尚未开始动作的工作，再调用 client.abort()。漏掉先置位会出现 abort 与 tool start 竞态，取消后仍可能提交。
2. 事务开始前收到取消：不调用 `arrangeCanvasLayer`，activity 未完成的 tool 由 `failActivity('functional', undefined, turnId, 'cancelled')` 收尾，结果 `committed=false`。
3. `arrangeCanvasLayer` 已提交后收到取消：只能停止模型/复核，不能回滚 canvas.db；若复核证明提交且没有并发/版本不确定，终态才是 `cancelled` 或 `partial`；只要版本变化或无法证明最新事实，终态必须是独立 `conflict`，不能压成 cancelled。D 必须显示“已完成部分/坐标已保留”。漏掉会让取消按钮制造第二次坐标写入或伪造回滚。
4. world switch / server shutdown 等价于 cancellation：先 stop functional clients，再 close old Store；不把取消帧送给新 world 的 Agent。

### 8.4 超时、进程死亡、失败与有限重试

- 建议常量（数值需 E/评审拍板）为单次 idle 60s、operation total 120s；`RpcClient` 自身 command response 30s 仍是更短的底层上限。超时调用 `abort`，发 functional activity failed（`error='timeout'`），不发完成。
- `agent_start` 前 spawn/初始化失败可最多重新 spawn 1 次，使用同一 `requestId` 但新的 operation attempt/session 文件；重试前检查 active world、snapshot/version 未变。若 tool 已开始或提交状态不明，禁止自动重复 action。
- `agent_settled` 缺失、`getSessionStats`/wait 失败、child exit、invalid role/scope、preset/extension 缺失均是显式 `agent_stopped`/`tool_error`；不能以空结果或旧 snapshot 降级成功。若 action 已开始但提交归属/最新 rows 无法证明，必须另发 `outcome:'conflict'` 与 `error:'unproven_latest'`，不能改报 failed/cancelled。
- screenshot requested 时 C 返回 timeout、无 origin、未 ready、权限、浏览器缺失：若尚未提交则 outcome=`failed`；若已提交但 screenshot/snapshot 版本无法证明则 outcome=`partial` 或 `conflict`。snapshot mismatch 一律是 conflict；不得把结构化摘要说成“已截图”。
- action `conflict`：重读最新 rows/version 并终止本 operation，不在 Agent 内循环重排；用户下一次点击以新 snapshot 重试。`no_free_seat` / AABB residual overlap：事务回滚，返回失败，不能提交“最后候选重叠”。

## 9. EventBridge、canvas.db 与可见闭环

### 9.1 EventBridge 精确改动

在 `apps/server/src/engine/event-bridge.ts`：

1. `EventSource` 扩为 `'writer' | 'character' | 'functional'`；`AgentLifecycleManager` 的 `EventSink`/`ActivityFailureSink` 同步扩 functional。
2. `emitEngine('functional', event, undefined, turnId)` 构造 `ActivityTurnContext { source:'functional', agentId:'canvas-arranger', turnId }`。
3. `tool_execution_start/end` 继续映射既有 `agent_activity`，`phase` 仅 started/completed/failed。增加 `arrange_canvas` 到 `agent-activity.ts` 的 `TOOL_OPERATION` 与 `SUBJECT_FIELDS`，operation 为 `edit`，subject 取 layer/path（不得把版本或绝对路径展示给玩家）。
4. `tool_execution_end` 对 `arrange_canvas` 复用既有 `canvas_patched` 分支，携带 `source:'functional'`、`kind:'cards'`、`action:'arranged'`、`layer`、`cards`，并增补 A/D 冻结的 `canvasVersion`、`operationId`、`snapshotIdAfter`。`useWorld` 唯一消费 `canvas_patched`，按 layer 与 version 合并；不增加第二 WebSocket。
5. functional 的普通 assistant text 不得映射成 `writer_message` 或 `character_message`；Agent 总结不进入叙事。functional `agent_settled` 不发 `writer_idle`/`character_idle`；只完成 runtime signal/Activity 收尾。
6. 不新增 `arranged` world event：现有 `link`/`arrange` 语义是 canvas 当前值，`canvas.ts:1-7` 明确不 append event；functional activity 与 canvas patch 是 transient/presentation 通道。

### 9.2 操作状态与 D 的本地态

- landed/completed：仅 server verification 全部通过；
- conflict：并发/版本变化、无法证明最新 rows、提交归属不明；这是独立终态，不能映射为 failed 或 cancelled；
- failed/cancelled：分别表示未提交的动作/工具失败，或已确认未提交而被取消；
- accepted：HTTP 202 已经登记，不代表 spawn 完成；
- processing：runtime signal `spawned` 后可显示；
- arranging：收到合法 `arrange_canvas` tool start；
- verifying：收到 action end 后等待 server 全层复核；

不要把这些词写入 `AgentActivityFrame.phase`，也不要新增 `canvas_arrange_status` WS 帧，除非 D/06 共同契约另行冻结并同批更新 server、useWorld、门禁。

### 9.3 canvas.db 允许/禁止副作用矩阵

| 目标 | 允许 | 事务/来源 |
|---|---|---|
| `cards.x/y/z_index` | 允许 | `arrangeCanvasLayer(store,input)` + A 全层 planner；单次 SQLite `BEGIN IMMEDIATE` |
| `cards.width/height` | 仅 footprint 既有 owner；整理动作不得写 | 真实浏览器测量路径；整理读取真实值 |
| `canvas_meta(layer, position_version)` | 允许 A 的并发护栏递增，Agent 不可直接写 | 与 cards 坐标事务同一 SQLite 事务 |
| `.airpworld/sessions/canvas-arranger-*.jsonl` | 允许运行时 session 记录 | 不是世界正文/坐标真相；watcher 可忽略 sessions |
| `links`、`presence`、`viewpoint` | 整理动作禁止写 | view_canvas 只读；旧 link/move 各自 owner |
| `*.md`、`world.json`、`history.db`、`.airpworld/state*` | 禁止 | 白名单/ActionService/ActorScope 三层拒绝 |

## 10. Nodesign 可借鉴语义与不可照搬语义

可借鉴但不改变 AIRP 事实源：

- `read_board` 的先读真实座位、包围盒、关系与用户视口再移动，对应 C `view_canvas` 的结构化 snapshot；
- `look_at_board` 的同一真实浏览器页、owner/auth、ready、串行 gate 与显式失败，对应 C screenshot 工具；
- `edit_board` 的相对意图、live 副本、统一避让、逐步报告与单次 patch，对应 A 的 server-side planner/事务；
- `resolvePlacement`/`board-seater` 的 AABB/PAD/环搜/磁盘幂等思路，只能作为 A 几何实现参考。

不能照搬：Nodesign 的 artifact 文件搬迁、`tag/lane/roll/staging`、HTML deck/iframe 工具、板书文件署名/软删、把 staging 当持久坐标、任何绕开 AIRP 世界文件与 `canvas.db` 分工的第二状态（06:112-119）。AIRP 的 staging 若存在，只能是 D 前端不可持久临时草稿；B 不创建它。

## 11. 精确代码落点与改动顺序

1. `packages/shared/src/actions/actor.ts`：增 functional ActorType/Scope、`resolveFunctionalArrangerActor`、reader/label/ref 与 nook deny；未知 functional role fail-closed。
2. `packages/shared/src/schemas/events.ts`：`ActorTypeSchema` 增 functional；同步事件协议/数据库 actor_type 说明。整理不新增 event type。
3. `packages/shared/src/actions/service.ts`：ActionService/ACTION_METHODS 增 `arrangeCanvas`；`packages/shared/src/actions/canvas-arranger.ts` 新动作注册与签名校验。
4. `packages/shared/src/store/world-store.ts` / `packages/shared/src/store/local-store.ts`：采纳 A（`docs/layout/07-自动生成与坐标写入治理设计.md`）的 `canvas_meta`、`canvasVersion` 与 `arrangeCanvasLayer` 原子接缝；不可让 ActionService 直接拼 SQL；精确存储签名由 A 篇冻结。
5. `extensions/toolkit/arrange-canvas.ts` + `extensions/canvas-arranger.ts`：仅注册 `view_canvas`/`arrange_canvas`；显式 actor/scope；不 import 通用 `tools.ts`。
6. `presets/canvas-arranger.json`：allowlist 与 F（`docs/layout/12-整理Agent提示词设计.md`）prompt 插槽；`apps/server/src/engine/launch.ts` 的 `canvasArrangerLaunch`：隔离 args/env/session。
7. `apps/server/src/engine/canvas-arranger-lifecycle.ts`：实现 `CanvasArrangerRuntime` 的 map、timeout、abort、stop、retry、postverify、signals；`apps/server/src/engine/lifecycle.ts` 不把它并进 Writer queue。
8. `apps/server/src/index.ts:56-74,345-350`：构造 runtime，注入 EventBridge 与 `getActiveStore`，shutdown 停 functional；`apps/server/src/routes/world.ts:462-490,577-607`：挂 runtime/active-world/cancel 路由，world switch 先停 runtime。
9. `apps/server/src/engine/event-bridge.ts:13,114-121,274-375,438-465`：functional EventSource、tool mapping、canvas patch 与 activity；不要把 functional text 变成 narrative。
10. `apps/server/src/engine/agent-activity.ts:39-61` 与 `apps/web/src/lib/agent-activity.ts:111-177`：增加 `arrange_canvas` 的 operation/subject，保持 phase 封闭。
11. `apps/web/src/state/useWorld.ts:546-550,708-740` 与 `apps/web/src/lib/canvas-patch.ts`：按 A/D 冻结的 `canvasVersion` 丢旧 patch，保持唯一消费点；B 不在前端算坐标。
12. `docs/tools/00-共同上下文.md`、`docs/tools/01-动作内核与事件落账.md`、`docs/tools/09-link与arrange.md`、`docs/agent-awareness/00-共同上下文.md`、`docs/protocols/doc-21-事件表协议.md`：评审后同批回写 functional actor、`arrangeCanvas`、`canvas_meta`、`canvas_patched` 版本、无 arranged event、Activity phase 集合。共享契约 06 不由本篇私改。

## 12. 验收用例（至少一条修复前必失败的非空性）

以下是 E 的实现验收输入；不是本轮运行项目级命令。

### 12.1 非空性：独立 Agent 与 Writer 并发且原有重叠真的被修复

Fixture：当前 active world 的同一 layer 有 `a.md` 与 `b.md` 两个真实 `cards` rows，`w/h > 0` 且 AABB 重叠（`overlapCount > 0`）；Writer client 已在一个慢 turn 中，`writerQueue`/`turnStartedAt('writer')` 非空。

步骤：

1. 读取 `/layer`/C snapshot，拿到 `expectedRevision`、`expectedCanvasVersion`、`snapshotId`；POST `/api/canvas/arrange`。
2. 断言 202 的 `agentId='canvas-arranger'`、`turnId` 匹配 `^functional:canvas-arranger:`，Writer 原 `turnId` 不变且没有 abort。
3. 观察独立 session 文件与 runtime event：functional client 使用不同 RpcClient/session，工具序列至少 `view_canvas → arrange_canvas → view_canvas`；Agent 未调用 Writer。
4. 读取 action details/`canvas_patched`，再取同 layer 最新全量 rows，断言 `overlapCount === 0`、`canvasVersion` 单调增加、`snapshotIdAfter` 与复读一致。

**修复前必失败理由（非空）**：旧 `arrangeCards` 的子集 grid/circle/row 只计算 `paths`，不把未选卡作为障碍（06:39；`canvas.ts:514-575`）；若把该 fixture 交给旧动作，至少保留一对 overlap，或在 Writer 正忙时错误复用 Writer queue/拒绝请求。因此该用例不能在无本批修复的实现上假绿。

### 12.2 白名单与文件边界

启动 functional client 后通过 RPC/工具目录断言可见工具集合恰为 `{view_canvas, arrange_canvas}`；尝试调用 `write`/`edit`/`bash`/`arrange`/`link`/`choose` 返回不可用，不触碰任意 world `*.md`、`world.json`、history.db；只允许 session JSONL 增长。未知 `AIRP_AGENT_ROLE`、scope 变体与缺失 env 在首个动作前 fail-closed。

### 12.3 版本冲突与事务

两个请求使用同一 `snapshotId`/`expectedCanvasVersion` 并发；只有一个获得 `canvas_meta` 写锁并提交，另一个得到 HTTP 409 `conflict`，details 含 expected/current version, revision and snapshot identity，未产生半批 rows。一个 action 中途抛错时，所有 cards 坐标保持事务前快照；不能出现一半新一半旧。

### 12.4 取消/超时/重试

- 在 `arrange_canvas` tool start 前取消：无坐标写入，functional Activity failed/cancelled，下一次相同 requestId 可复用或显式拒绝。
- 提交后取消：坐标保留，结果明确 `committed=true` 与“已完成部分”，不能回滚伪造。
- Agent timeout/child death：无 terminal success；若提交状态不明或最新 rows/version 无法证明，server 复读后必须发独立 `outcome='conflict'`/`error='unproven_latest'`，不能压成 failed/cancelled，也不能自动重复动作；只有 spawn 前失败允许一次新 session retry。
- Provider request 期间再次收到 `turn_start` 的回归场景：同一个 `agent_start → agent_end/agent_settled` operation 必须保持一个 total deadline、一个 operationId、一个 single-flight；`turn_start` 只能记录内部 request，不得让 timeout 重新计时或再次调用 `arrange_canvas`。否则会在慢 provider 下绕过超时并重复写坐标。
- world switch 时 old functional client 停止，旧操作不会写入新 active world。

### 12.5 截图失败与真实完成

`screenshotPolicy` requesting browser evidence and C gate failure (no browser/origin/ready/permission): before commit, outcome=`failed` with no write; after commit, outcome=`partial` unless identity/currentness is also unproven, then `conflict`. Snapshot mismatch is always conflict. Screenshot success still needs structured full-layer zero-overlap and version proof for completed; never call a screenshot summary a structured image.

## 13. 发现的冲突 / 需要回写的上位文档

1. **06 之前版本的 Actor 二选一已被 BB6A/1D3A 裁决为 functional**：不能沿用旧“engine 或 functional”文字；本篇采用 functional，并要求 06 保持该冻结。
2. `packages/shared/src/actions/actor.ts:9,26-49,83` 与 `packages/shared/src/schemas/events.ts:30-32` 没有 functional，且未知 role 会回退 writer；实现前必须同步 ActorType/Scope/reader/权限/schema，不能只加 env 字符串。
3. `docs/tools/00` 的 ActionService 方法表、Actor 表、preset/角色表仍主要描述 writer/character；须回写 `arrangeCanvas`、functional identity、`canvas_meta` 版本与 fail-closed 规则。
4. `docs/tools/09-link与arrange.md:214-223,287-305` 仍把旧 `arrange` subset 不避让写作已知边界；实现后该边界只能保留给旧 arrange，点击整理必须走 `arrangeCanvas`，并把“模型坐标不算安全”写进上位工具门禁。
5. `event-bridge.ts:309-321` 与前端 `useWorld.ts:708-740` 尚无 `arrange_canvas`/functional/version 分支；必须同批回写 server 发射与唯一前端消费，不能只登记一个新 tool 名。
6. 06 要求功能过程复用 `agent_activity`/现有 `canvas_patched`；本篇明确不创建 `canvas_arrange_status` WS，D 的本地阶段只能从 runtime/既有帧映射，需在 D/E 文档保持一致。
6. 06 canonical contract 已冻结 `canvas_meta`/`canvasVersion`、`canvasRevision`、`snapshotId` 与 machine outcome `conflict`；B 不得恢复任何旧的 canvas-specific conflict/stale 别名。

## 14. 仍未知、明确交评审拍板

1. D 的单飞粒度是整个 active world 还是 layer；本文选择 world 级最保守实现，放宽为 layer 级需 A 证明跨层 DB/version/Writer 并发安全。
2. `safeFallback` 是否进入自然语言 receipt；机器字段和安全行为已由 06/07 冻结，不得改变。
3. `canvasArrangerLaunch` 的具体 process timeout 数值与 browser budget 仍由实现验证；不改变 canonical fields/status。
