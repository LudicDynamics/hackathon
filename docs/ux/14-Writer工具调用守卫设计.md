# Writer 工具调用守卫设计

> 状态：已实现（2026-09-14）
> 日期：2026-09-14
> 适用范围：Writer 顶层 engine session 的单轮工具调用总量
> 上位契约：`docs/ux/08-niko功能迁移契约.md` §5、`docs/ux/00-共同上下文.md`、`docs/agent-awareness/00-共同上下文.md`、`docs/tools/00-共同上下文.md`

## 1. 一句话定位

只给 `AIRP_AGENT_ROLE=writer` 且由 `writerLaunch` 启动的顶层进程加一条可配置的单轮工具调用总量上限：默认 24 次；每个 engine `turn_start` 清零；第 N+1 次在执行前被阻断，并把简短原因作为模型可见的 tool error 返回。它不是世界规则、事件记录器、Chalk 质量审查器或初始化策略。

本设计的“单轮”采用 pi-rp extension API 的 engine turn 口径：一次 `turn_start` 到对应 `turn_end`，即一次 assistant 响应及其工具调用批次；不是整个 agent run、session、玩家动作，也不是 `tool_execution_start` 到 `tool_execution_end` 的耗时窗口。

## 2. 输入与签名

### 2.1 外部输入

| 输入 | 来源 | 语义 |
|---|---|---|
| `AIRP_AGENT_ROLE` | `airpEnv({ role: 'writer' })` | 身份门禁；必须逐字等于 `writer` |
| `AIRP_AGENT_SCOPE` | `writerLaunch` | 顶层深度门禁；必须为 `writer-top-level` |
| `AIRP_WRITER_MAX_TOOL_CALLS` | server 环境，经 `airpEnv` 传入 agent | 上限配置；只有严格正整数覆盖默认值 |
| `turn_start` | Extension API | engine turn 的唯一清零边界 |
| `tool_call` | Extension API | 已通过工具解析/校验、即将执行的一次工具调用；每个事件计一次 |

`AIRP_AGENT_ROLE` 不通过 `agentActor()` 间接判断。共享 actor 解析对未设置或未知值有 writer fallback（`packages/shared/src/actions/actor.ts`），将其用于本守卫会把未知进程误纳入 Writer；本守卫只认原始环境变量。`AIRP_AGENT_SCOPE` 是已有 launch 级深度标记，不由模型输入提供。

### 2.2 新增纯函数与注册函数签名（NEW）

```ts
export const DEFAULT_WRITER_MAX_TOOL_CALLS = 24;

export function parseWriterMaxToolCalls(
  raw: string | undefined,
  fallback?: number,
): number;

export interface WriterToolCallGuardOptions {
  maxToolCalls?: number;
  role?: string;
  scope?: string;
}

export function registerWriterToolCallGuard(
  pi: ExtensionAPI,
  options?: WriterToolCallGuardOptions,
): void;
```

实现落点为 `extensions/toolkit/writer-beat-guard.ts`；上述导出是设计契约，不表示当前仓库已经存在这些符号。生产注册不传 `options`，由函数读取 `process.env.AIRP_WRITER_MAX_TOOL_CALLS`、`process.env.AIRP_AGENT_ROLE` 和 `process.env.AIRP_AGENT_SCOPE`。纯函数测试可以显式传入 options，避免测试依赖全局环境。

`ToolCallEventResult` 使用 Extension API 已有形状：

```ts
{ block: true, reason: string, terminate: true }
```

`reason` 是模型可见的错误正文；`terminate` 只提示引擎在“整个工具批次都为终止结果”时跳过自动 follow-up，不代表世界成功，也不代替 `ctx.abort()`。

## 3. 逐步行为契约及漏接后果

### 3.1 读取配置并固定本进程上限

1. `registerWriterToolCallGuard` 注册时读取一次原始环境值，并调用 `parseWriterMaxToolCalls`。
2. 解析结果固定在当前 extension 实例闭包内；运行中的 session 不因 server 环境变化而热更新。
3. 未设置、空串、非字符串输入、零、负数、小数、指数写法、十六进制、含空白的非严格数字，以及超出 `Number.MAX_SAFE_INTEGER` 的数，均回退 `24`（或测试传入的合法 fallback）。
4. 合法值是 `/^[1-9]\d*$/` 且 `Number.isSafeInteger(value)` 的十进制字符串，例如 `1`、`24`、`100`。

**漏接后果：** 每次 `tool_call` 重新读取环境会让同一 session 在运行中改变预算，导致回放不可解释；把 `Number(raw) || 24` 当解析器会误接收指数/空白或把非法值混入配置；不检查 safe integer 会让比较和计数失去可预测性。

### 3.2 判定进程身份

1. 只有 `role === 'writer'` 且 `scope === 'writer-top-level'` 才启用守卫。
2. `character:<id>`、`scene-init`、`nook-init`、`functional:*`、`player`、空值和未知值均不启用。
3. Writer 子代理 initializer 的环境可能继承 `AIRP_AGENT_ROLE=writer`，但 `init-command.ts` 在 spawn 前暂时设为 `AIRP_AGENT_SCOPE=initializer`，且 `spawnAgent` 明确不继承父扩展工具/父 hook；因此初始化工具循环不进入本守卫。
4. 身份判定不得查看工具名、文件路径、Chalk frontmatter 或 prompt 内容。

**漏接后果：** 只判断 `AIRP_AGENT_ROLE` 会把继承 Writer role 的 initializer 误判为顶层 Writer；只判断 `agentActor().type` 会把 unset/unknown fallback 纳入；按工具名过滤会恢复 niko 原版额外黑名单。

### 3.3 在 engine turn 开始清零

1. 监听 `pi.on('agent_start', ...)`，把计数设为 0，作为新 agent run 的防御性起点。
2. 监听 `pi.on('turn_start', ...)`，把计数设为 0；这是每个 engine turn 的权威边界。`turnIndex` 只用于观测/测试，不作为跨 session 的计数键。
3. 不在 `turn_end` 做业务动作；下一次 `turn_start` 会重新清零。
4. 第一个 `tool_call` 若发生在正常首个 `turn_start` 前，使用闭包初始化的 0 计数；这类异常顺序不应被扩展伪造为一个成功 turn。

**漏接后果：** 只在 `agent_start` 清零会把工具循环中的后续 engine turn 继续累计，违反单轮语义；只在 `turn_end` 清零会在中断/异常时残留；按时间窗口清零无法对应引擎 turn。

### 3.4 预执行计数与阻断

对每个已到达的 Writer `tool_call`，按 Extension runner 的串行 handler 调度执行：

1. 计数先加一；因此第 1–N 个调用继续进入正常工具执行。
2. 若加一后 `count > limit`，不运行工具 body，返回 `{ block: true, reason, terminate: true }`。
3. 原因固定为短、可行动且不包含原始参数，例如：`Writer tool-call limit (24) reached for this engine turn. Stop using tools and return a concise response; the player can continue on the next turn.`；动态值使用已解析上限。
4. pi-rp 会把 `reason` 转成标准 `isError=true` 的 tool result message；模型能看到被阻断原因。守卫不自行生成 `content`，不调用工具，不修改输入。
5. 超限后同一 turn 的后续调用继续拒绝；计数可以继续递增，但不再做世界 I/O。下一 `turn_start` 后重新允许至多 N 次。
6. 只统计真正抵达 `tool_call` hook 的调用。工具不存在、参数在引擎校验阶段已失败的请求不会进入该 hook；它们由 pi-rp 自己产出工具错误，不伪装成守卫计数。

**漏接后果：** 在 `tool_execution_start` 才拦截已经太晚，工具可能已改世界；只返回 `undefined` 会让超限调用继续执行；返回普通成功结果会污染模型和世界真相；调用 `ctx.abort()` 会把“预算耗尽”变成无原因中断，模型拿不到稳定的可见原因。

### 3.5 非守卫行为

通过身份门禁后，所有工具名称、参数、路径和结果一律不再审查。`chalk` 可重复调用；Chalk 可在同轮多次调用；原生 `write`/`edit` 可调用；长内容、多段内容、不同路径不因本守卫而拒绝。动作层自己的参数、权限、事件与文件规则仍照常生效。

**漏接后果：** 任意新增“方便的”Chalk 数量/重复/正文长度/路径策略都会把本设计重新变成 niko beat guard，破坏场景初始化和迁移边界。

## 4. 文件与副作用

### 4.1 生产文件

| 文件 | 设计动作 | 副作用 |
|---|---|---|
| `extensions/toolkit/writer-beat-guard.ts` | 新增纯解析函数、身份判定和 `registerWriterToolCallGuard` | 仅维护进程内闭包计数；无文件/数据库写入 |
| `extensions/tools.ts` | import 并调用注册函数 | 给当前 agent process 的 extension runner 增加一个 `tool_call` 与两个边界 handler |
| `apps/server/src/engine/presets.ts` | 将 `AIRP_WRITER_MAX_TOOL_CALLS` 纳入显式 env passthrough 白名单 | 让 server 配置可审计地到达 agent；不改 preset JSON |
| `apps/server/src/engine/launch.ts` | 保持现有 Writer role/scope 接线，必要时只补设计所需的显式传递 | Writer 仍由既有 `writerLaunch` 启动；Character 不获得守卫 |
| `presets/writer.json` | 不新增 deny 项或工具限制 | 预算是 runtime hook，不进入模型工具可见 deny 列表 |
| `presets/scene-init.json`、`presets/nook-init.json` | 不改 | initializer 不受本守卫限制 |

`AIRP_WRITER_MAX_TOOL_CALLS` 不写入 `worldRoot`、session JSONL、`history.db`、`canvas.db` 或 world 文件；它是进程启动配置，不是世界事实。

### 4.2 不做的副作用

守卫不调用 `worldStore`、`appendEvent`、`writeFile`、`ctx.ui`、WS 广播、activity frame、Toast 或前端 store。它不写 `world_event`，不制造 `entity_*`、`layer_initialized` 或任何成功反馈，也不把拒绝变成自动 Continue。

## 5. 状态、事件生命周期与落账

状态只有一个闭包字段 `toolCallsThisTurn: number`（以及固定 `maxToolCalls` 与身份结果）；不创建第二个 Writer state、事件 store、activity store 或按 tool id 的世界状态。

生命周期如下：

```text
extension load
  → parse env once / decide writer-top-level
  → agent_start: count = 0
  → turn_start(i): count = 0
  → tool_call #1..#N: count++, execute normally
  → tool_call #N+1..: count++, block + model-visible error
  → tool_execution_end / tool_result:由 pi-rp 正常发出；守卫不监听、不改写
  → turn_end(i): no write / no reset side effect
  → turn_start(i+1): count = 0
```

### 5.1 事件边界

- 守卫消费 `turn_start`、`agent_start` 和 `tool_call` 三类 extension event。
- 守卫不消费 `tool_execution_start`、`tool_execution_end`、`tool_result` 来推断成功或计数；这些事件仍由现有 Writer footprint、activity relay 和 world-context 等路径各自处理。
- 被阻断调用由 pi-rp 生成标准失败 tool result；它不会进入动作工具的执行体，因此不能落世界事件。
- `terminate: true` 是本轮工具批次的控制提示，不是 `world_event`、agent_activity 或 writer state 事件。

### 5.2 与唯一事实源的关系

守卫只决定“是否允许调用工具”。允许调用后的文件与事件仍由既有动作层和 native write/edit hook 决定；失败调用遵守“失败不落世界事件”的上位契约。前端若看到 tool error，只能把它当运行时失败/活动结果，不能把它渲染为世界已变化。

## 6. 前后端接线（含 WS 边界）

这是 agent 进程内的运行时门，不新增 HTTP、WS 或前端组件接线。

1. server 的 `writerLaunch` 继续提供 `cwd=worldRoot`、`AIRP_AGENT_ROLE=writer`、`AIRP_AGENT_SCOPE=writer-top-level` 和 preset/session 参数。
2. `airpEnv` 将 `AIRP_WRITER_MAX_TOOL_CALLS` 作为受控环境项传入；RpcClient 的子进程环境最终可读取该值。
3. `extensions/tools.ts` 作为顶层唯一 registerTool 入口，在注册 AIRP 工具前调用 `registerWriterToolCallGuard(pi)`；它不是 `AIRP_TOOLS` 成员，因此不进入 `AIRP_TOOL_NAMES` 和模型 Available tools 清单。
4. Extension runner 的 `tool_call` 返回值进入 pi-rp agent loop；被阻断调用由 engine 追加失败 tool result，并按现有 turn 事件路径发送 `turn_end`。
5. server `event-bridge` 不新增 frame 映射；`useWorld.ts` 不需要新增消费分支；不新增 `agent_activity` 或 `world_event`。
6. 前端 WriterResult、ActivityRail、Toast 和 writer-state 不显示守卫内部计数。若未来要展示“工具预算耗尽”，必须另立公开状态契约，本设计不暗中扩展。

**漏接后果：** 在某个 React 组件或 `window` 上监听工具帧会违反 `useWorld.ts` 唯一 WS 消费入口；把 guard 加到 AIRP tool definition 包装器会漏掉 native 工具或影响 initializer；把 guard 事件广播到 WS 会把临时运行限制误当世界事实。

## 7. 错误边界

| 情况 | 处理 | 不允许 |
|---|---|---|
| env 缺失/非法 | 使用 24 | 抛异常、拒绝启动、把 NaN 作为上限 |
| Writer 未设置 scope | fail-open，不启用（不是由 `writerLaunch` 正常产生的顶层 Writer） | 用 actor fallback 擅自启用 |
| Character role | 直接跳过 | 共享 Writer 计数器 |
| initializer scope / 子代理 | 不限制 | 用 `AIRP_INIT_IN_FLIGHT` 伪装成预算来源 |
| 第 N+1 个合法调用 | block + reason + terminate | 执行后再撤销、伪造成功 |
| 工具自身失败 | 由原有工具/engine 返回失败，仍计为一次已到达的 call | 守卫重写为成功 |
| 中断 signal 已 aborted | pi-rp 处理为 Operation aborted；guard 不吞掉、不补成功 | 在 guard 里 reset 后重放 |
| `tool_call` handler 异常 | 依 Extension runner 既有错误语义失败本次调用；实现应让解析/比较纯且不抛 | `catch` 后放行超限调用 |
| 并发超限 | 依 runner 对 hook 的 await 顺序逐个计数；先到者按序占用预算 | 以异步读写共享计数造成双放行 |

模型可见原因只包含上限和下一步，不包含 cwd、绝对路径、tool args、密钥、堆栈或模型思维。日志若需要诊断，使用现有进程日志机制且不得因此新增世界事件。

## 8. 代码落点、注册点与实现顺序

### 8.1 代码落点

1. `extensions/toolkit/writer-beat-guard.ts`：删除 niko 版 `target`、`landed`、`edits`、frontmatter/path 扫描、重复 Chalk 判断、内容长度判断和 `ctx.abort`；保留文件名以最小迁移成本承接，但导出改为 `registerWriterToolCallGuard`，避免“beat”名称继续暗示单 Chalk 语义。
2. 同文件新增 `parseWriterMaxToolCalls`、默认常量、严格身份 gate 和纯计数测试 seam。
3. `extensions/tools.ts:18-40,73-91`：新增 import，并在 `registerAirpTools` 内、`registerTurnTracking` 附近注册一次；不把 guard 放进 `AIRP_TOOLS`。
4. `apps/server/src/engine/presets.ts:47-57`：把配置键加入 `AIRP_ENV_PASSTHROUGH`；不把整个 `process.env` 复制为新的契约。
5. `apps/server/src/engine/launch.ts:130-163`：核验现有 writer role/scope 保持；不新增 initializer 限制，不改变 `--preset`、session 或 model 参数。
6. `presets/writer.json:15-31`：保持 deny list 原状，明确不能以 preset deny 实现上限。

### 8.2 注册顺序

推荐：

```text
registerWriterToolCallGuard(pi)
registerTurnTracking(pi)
registerInitCommand(pi)
for AIRP_TOOLS: pi.registerTool(tool)
```

注册顺序只影响同一 extension 内 handler 的先后，不改变总量语义；放在工具注册前可让“预算是全局工具入口策略”更清楚。不得为 guard 注册新的工具名、promptSnippet 或 promptGuidelines。

### 8.3 实现顺序

1. 先落纯配置解析和身份判定；
2. 再接 `agent_start`/`turn_start` 清零和 `tool_call` block；
3. 再接 `tools.ts` 与 env passthrough；
4. 用单元测试和真实 Writer 探针验证后，回写本设计中的任何签名或事件差异；
5. 本设计阶段不执行 formatter、lint、全量测试、全量构建或项目级验证命令。

## 9. 与现状差异

### 9.1 主线现状

- `extensions/tools.ts:1-17,18-39` 已是唯一 AIRP 工具注册入口，当前注册 turn tracking、initializer command 和 `AIRP_TOOLS`，尚未注册 Writer guard。
- `extensions/tools.ts:51-72` 的 `AIRP_TOOLS` 是动作工具列表；本设计不向其中添加 guard。
- `extensions/toolkit/turn.ts:14-19` 当前只在 `turn_start` 更新 `currentTurnIndex`；其模块级状态不能替代 guard 自己的计数闭包。
- Extension API 的 `TurnStartEvent`、`ToolCallEvent` 和 `ToolCallEventResult` 形状在 `vendor/pi-rp/packages/coding-agent/src/core/extensions/types.ts:828-885,954-1013,1172-1181`；`tool_call` 是“执行前可阻断”事件，`reason` 会进入失败工具结果。
- `vendor/pi-rp/packages/coding-agent/src/core/extensions/runner.ts:1081-1102` 按注册顺序 await handler；`vendor/pi-rp/packages/agent/src/agent-loop.ts:600-667` 在工具存在且参数验证后调用 before-tool hook。因此本守卫计数的是到达 `tool_call` 的有效调用。
- `apps/server/src/engine/launch.ts:130-163` 已在 Writer 环境注入 `AIRP_AGENT_ROLE=writer`、`AIRP_AGENT_SCOPE=writer-top-level`；`launch.ts:177-212` 的 Character 使用 `character:<id>` 和 `character` scope。
- `apps/server/src/engine/presets.ts:47-93` 当前有 env 白名单、`airpEnv` role 注入和 extra 机制，但白名单尚未登记 `AIRP_WRITER_MAX_TOOL_CALLS`。
- `extensions/toolkit/init-command.ts:298-325` 已在 spawn initializer 时设置 `AIRP_AGENT_SCOPE=initializer`、`AIRP_INIT_IN_FLIGHT=1`，并在 finally 恢复；`vendor/pi-rp/packages/coding-agent/src/core/subagent/spawn.ts:63-99` 明确 `spawnAgent` 不继承父 extension tools。

### 9.2 niko 原版行为（迁移基线）

`origin/niko:extensions/toolkit/writer-beat-guard.ts:6-20,22-56` 除了 24 次工具预算，还维护 landed/target/edits，并拦截重复或不同路径 Chalk、Chalk 内容长度、重复内容，以及 native `write`/`edit`；`origin/niko:extensions/toolkit/writer-beat-guard.ts:16-18` 在拒绝时调用 `ctx.abort()`；`origin/niko:extensions/toolkit/writer-beat-guard.ts:13` 只在 `agent_start` 清零。其测试 `origin/niko:tools/writer-beat-guard.test.mjs:7-30` 把“一轮只落一张 Chalk/重复违规最终 abort”当成预期，`:32-45` 只覆盖 24 次 read 后 abort。

### 9.3 本设计的迁移差异

| 维度 | niko 原版 | 新版裁决 |
|---|---|---|
| 计数边界 | `agent_start` | `turn_start`，并以 agent_start 仅作防御性初始清零 |
| 上限 | 写死 24 | 默认 24；正整数 env 可覆盖；非法回退 |
| 拦截时机 | `tool_call` | `tool_call` |
| 超限反馈 | `ctx.abort()` + 部分 reason | block + 模型可见 reason + terminate；不 abort |
| Chalk 单轮数量 | 限制 | 不限制 |
| 重复 Chalk | 拦截 | 不判断 |
| native write/edit | 拦截 Chalk 写入 | 不拦截 |
| Chalk 正文长度/段落 | 拦截 | 不判断 |
| initializer | 依 env flag 绕过 | 通过顶层 hook/initializer scope 设计确保不限制 |
| 世界/事件副作用 | 读取 store 并追踪结果 | 零 I/O、零事件、零成功反馈 |

### 9.4 Merge 规范理由（必须原文保留）

之所以删减 niko 原版的“单轮只能一张 Chalk／重复 Chalk 拦截／原生 write 禁止”，不是遗漏，而是产品和初始化语义的有意裁决：这些限制会直接导致作家无法完整初始化一个场景。场景初始化可能需要连续创建、编辑多个文件，也可能需要通过原生写入完成初始化阶段的结构准备；把它们误判为普通叙事轮会让合法初始化在中途被守卫截断。故本批只保留可配置的 Writer 单轮工具调用总量上限，作为失控循环保护；其余约束继续由动作层、初始化流程和现有契约负责。

因此严禁恢复：单轮 Chalk 限制、重复 Chalk 检测、原生 `write`/`edit` 禁止、内容长度限制、路径黑名单、工具黑名单、Character 限制或 initializer 限制。上限也不迁移到 Character/functional agent。

## 10. 验收测试、旧行为失败测试与浏览器/探针验收

本节只定义验收，不在本设计阶段运行验证命令。

### 10.1 纯函数与 hook 单测

测试文件建议：`tools/writer-beat-guard.test.mjs`（或与现有 toolkit 纯函数测试同目录的对应测试）。测试通过 `createJiti` 加载真实 TS 模块，以注册的 handler 和 fake `ExtensionContext` 验证可观察行为。

1. **默认与合法配置**：缺失、`undefined`、`24`、`1`、`100` 分别得到 24/24/24/1/100；`0`、`-1`、`1.5`、`1e2`、`0x10`、空串、空白和超 safe integer 回退 24。
2. **唯一非空预算断言**：旧实现（固定 24）在 raw env `AIRP_WRITER_MAX_TOOL_CALLS=2` 时会错误放行第 3 次；新实现第 3 次必须返回 `block=true`、`isError` tool result 原因包含上限 2。该用例证明配置功能不是假绿。
3. **边界**：1–N 次 `tool_call` 返回 undefined；第 N+1 次 block；每次 block 的 reason 非空；fake tool execute 没有被调用。
4. **turn reset**：同一注册实例在 turn 0 消耗 N 次后，调用 `turn_start({ turnIndex: 1, timestamp })`，下一次调用再次放行。旧 niko 实现没有 `turn_start` handler，该断言在旧实现中失败。
5. **失败调用仍计数**：允许的工具之后模拟工具执行失败（通过独立 engine fixture 或只验证 preflight），下一 `tool_call` 仍按序占用预算；守卫不能从 `tool_result` 猜成功后才计数。
6. **身份矩阵**：writer + writer-top-level 受限；character、functional、initializer scope、未知、空 role 不受限。不要把 actor fallback 当成通过条件。
7. **所有工具同一口径**：在 N 次中混合 `chalk`、重复 `chalk`、不同 path、`write`、`edit`、`read` 和任意自定义工具；均只受数量影响。
8. **并发批次**：用真实 agent loop 的 parallel tool batch 产生 N+2 个调用；断言前 N 个进入执行、后两个成为 `isError` 且 reason 可见，计数没有双放行。验证 extension runner 的 await preflight 顺序，而不是依赖工具完成顺序。
9. **无世界副作用**：超限路径前后 history/canvas/events 文件 checksum 不变；没有 `world_event`、`agent_activity` 或成功 details。
10. **错误路径**：中断 signal、未知工具、参数校验失败分别由 engine 既有错误语义处理；守卫不吞异常、不补成功、不写事件。

### 10.2 旧行为必须失败的回归

将 `origin/niko` 的旧断言反向改写成新契约断言，防止“迁移后又把旧限制加回来”：

- **第二张 Chalk 应允许**：同一 engine turn 内连续两次 `chalk`，只要未超过总量，均不 block。旧 `landed` 检查会失败。
- **重复/相同内容 Chalk 应允许**：相同 path 或相同正文再次调用不被 guard 拦截。旧重复扫描会失败。
- **native write/edit 不因 Chalk 身份被拦截**：写入/编辑含 Chalk frontmatter 的 Markdown，只要在总量内可进入工具执行。旧 raw write/edit 规则会失败。
- **长内容不由 guard 拒绝**：超过 1000 字符或多段内容仅由底层工具/动作契约决定，不由本 guard block。旧长度检查会失败。
- **超限是可见失败而非 abort 假象**：第 N+1 次有 `block` 和 reason，fake context 的 `abort` 调用数保持 0。旧 `ctx.abort()` 规则会失败。
- **turn 而非 agent run 计数**：同一 agent run 的两个 `turn_start` 各有完整 N 次预算。旧只监听 agent_start 的实现会失败。

### 10.3 真实 Writer 探针

建议新增一次性探针（不替代专项单测），沿用 `tools/probe-writer.mjs` 的真实 `writerLaunch` + `RpcClient` + deterministic provider 范式：

1. 复制一个临时 world，删除 `.airpworld/sessions`，用当前 `writerLaunch` 启动真实 Writer。
2. 在 provider 返回一个 assistant message，其中包含可控数量的合法工具调用；工具调用前 N 个使用 `read` 或无副作用工具，N+1 个使用可观测但不会改变世界的 fixture 工具。
3. 采集 RPC/agent 事件，断言前 N 个 `tool_execution_start`/`tool_execution_end` 正常出现；第 N+1 个没有工具执行体副作用，但 tool result 文本包含 `Writer tool-call limit` 和实际配置值。
4. 使用 `AIRP_WRITER_MAX_TOOL_CALLS=2` 与默认未设置两组对照；第 3 次分别被阻断/放行，证明 env 确实经 `launch.ts → airpEnv → child process` 生效。
5. 让 provider 在下一 engine turn 再发工具调用，断言计数清零；同时检查世界文件与 `history.db.events` 没有守卫新增事件。
6. 分别以 Character launch 和 initializer `airp-init`/`spawnAgent` fixture 运行超过 24 次工具调用，断言不存在 Writer guard 的 block；初始化成功仍以既有产品文件与 `layer_initialized` 事实判断。
7. 探针记录未配置、合法配置、非法配置三组结果，不得只跑一组就推断解析口径。

### 10.4 浏览器验收边界

本功能没有 UI，因此不存在新增浏览器控件、Toast、ActivityRail 或 WS 帧；浏览器验收只做一次负向回归：通过现有 Writer 输入触发探针/fixture 后，确认超限错误不会在画布上生成 Chalk、Toast 或活动成功胶囊，页面仍可继续发送下一轮请求。不得以浏览器看不到 guard 内部计数作为功能通过依据；计数和 model-visible reason 以 engine 探针为准。

## 11. 发现的冲突 / 需要修订的上位文档

1. **niko 旧 guard 与迁移契约冲突。** `origin/niko:extensions/toolkit/writer-beat-guard.ts:22-56` 的 Chalk 单轮、重复、长度和 native write/edit 拦截，与 `docs/ux/08-niko功能迁移契约.md:106-118` 明确“不做”相冲突。本设计服从迁移契约，并保留“这些限制会直接导致作家无法完整初始化一个场景”的原文理由；不修改上位文档。
2. **`docs/tools/00-共同上下文.md:110-121` 的身份表只把 `AIRP_AGENT_ROLE` 作为身份差异，而 `apps/server/src/engine/launch.ts:159-162` 另有 `AIRP_AGENT_SCOPE=writer-top-level` 深度标记。** 若评审要求共享契约只允许 role gate，则需上位文档明确 initializer hook 不会触发 parent extension；否则应将 scope 的“顶层/initializer”语义回写到 tools 共享契约。本设计暂用已有 scope 做 fail-closed 深度门禁，不扩写新的身份类型。
3. **`apps/server/src/engine/presets.ts:42-57` 声称 env 使用白名单，但 `vendor/pi-rp/packages/coding-agent/src/modes/rpc/rpc-client.ts:108-111` 的 spawn 仍合并父进程 `process.env`。** 这是既有可审计性差异，不在 guard 文档内修复；本设计仍要求把新键加入 `AIRP_ENV_PASSTHROUGH`，以保持显式 launch 契约。评审若要“白名单即实际隔离”，应另立 launch 安全修订。
4. **Extension API 文档中的 `TurnStartEvent` 含 `turnIndex/timestamp`，底层 agent loop 的内部 `turn_start` 事件可不带字段**（`vendor/pi-rp/packages/agent/src/agent-loop.ts:109-111,175-179`，再由 coding-agent session 补齐 `agent-session.ts:1055-1061`）。本设计只依事件名清零，不依赖字段；若上游改变映射，不影响 guard 语义。

这些冲突由主代理在评审门统一裁决；本篇不直接改共享契约。

## 12. 仍未知待拍板

1. **配置 whitespace 口径：** 本设计采用严格十进制字符串，`" 24 "` 回退 24；若产品希望 shell 常见空白可容忍，需要在上位配置规范中明确 trim，并同步纯函数测试。不能由实现者自行两边接受。
2. **上限极大值是否需要产品上界：** 当前只按正 safe integer 约束，不另设小于某值的产品上限；若需要防止配置失误导致“实际上无保护”，必须由产品另行冻结一个最大值。
3. **未走 `writerLaunch` 的手工 Writer：** 当前设计对缺失 `AIRP_AGENT_SCOPE` fail-open。若开发工具需要手工启动也受守卫，需提供不可由模型伪造的启动方式，而不是放宽 role-only gate。
4. **初始化探针具体 provider fixture：** 需要实现阶段选定一个真实可调用且不会污染世界的工具 fixture；本设计不新增工具名，也不把 fixture 误写入生产 `AIRP_TOOLS`。
5. **浏览器负向回归的触发入口：** Writer UI 当前由既有 `WriterBar`/`WriterResult` 接线驱动；探针应优先观测 RPC tool result，浏览器只确认没有错误被误投影为世界成功。若要显示预算耗尽，需要另立 Writer state 字段与 UI 契约。
6. **是否改文件名：** 迁移期可保留 `writer-beat-guard.ts` 以减少注册路径变化，但导出和注释必须完全改成 tool-call total guard；若改名为 `writer-tool-call-guard.ts`，须同步 `extensions/tools.ts`、探针和文档引用，不能留下旧别名。
