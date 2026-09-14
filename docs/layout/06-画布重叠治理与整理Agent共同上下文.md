# 画布重叠治理与整理 Agent 共同上下文

> 状态：契约已冻结，允许进入实现（2026-09-15）。本文是 06–12 的唯一跨篇 canonical contract；各设计篇只能补充本模块细节，不得私改本文件的身份、真相源、工具、动作、HTTP、版本、事件和失败语义。实现前须按 §4.5 的机器可核验表逐项核对。
>
> 本批不是把画布再造一套布局系统，而是补上已落地 `flowColumns` 之外仍会制造重叠的写入/渲染竞态，并给玩家一个可验证的独立整理入口。

## 1. 预期结果与范围

玩家能得到两个互补结果：

1. 作家、初始化器、角色和玩家操作生成或移动卡片时，服务端最终状态与浏览器真实绘制盒尽量不重叠；尤其不能让 Chalk 的正文高度增长后压住另一张卡。
2. 左侧画布工具栏有「整理」入口。点击后触发一次**独立于 Writer 的功能 Agent 调用**；该 Agent 先读取当前层的准确卡片状态，必要时通过真实浏览器截图看用户所见，再以专用整理动作调整位置，最后给出真实完成/失败状态。它不能伪装成作家 turn，也不能直接改文件或绕过 action service。

本批包含：自动新卡/near/显式布局/玩家拖拽/footprint/幻影之间的残留碰撞边界、功能 Agent 生命周期、感知与整理工具、按钮与状态反馈、并发/取消/重试/验证。

本批不包含：持续自动重排所有卡、把玩家手动位置偷偷恢复成默认网格、改变 Chalk 正文或世界叙事、把布局状态写回正文、引入 `get_state`/`set_state`/`watch_state` 命名空间、让 Writer 自动被打断或自动起新 turn。

## 2. 权威层级

冲突按以下顺序裁决：

1. 本文冻结的真相源、身份、动作和跨端边界；
2. `docs/layout/00-共同上下文.md`：`flowColumns`、首次自动排座、旧卡稳定、Chalk 拖拽边界；
3. `docs/footprint/00-共同上下文.md`：`cards.width/height` 真实占位、测量回写和 I1/I2；
4. `docs/perform/00-共同上下文.md`：幻影只作临时投影、真实 `/layer` 接管；
5. `docs/tools/00-共同上下文.md` 与 `docs/tools/09-link与arrange.md`：ActionService、canvas.db、工具/事件/WS 形状；
6. `docs/agent-awareness/00-共同上下文.md`：`agent_activity` 的 functional 来源及玩家可见过程状态；
7. `docs/wiring/00-共同上下文.md`、现有实现与 Nodesign 参考。

若实现证据推翻本文某条，必须先停止沿用旧断言，在对应设计篇登记冲突；由评审裁决并同回合回写本文和受影响文档。

## 3. 当前已复核事实与残留问题

| 领域 | 当前事实 | 证据 | 本批含义 |
|---|---|---|---|
| 新批自动排座 | `/layer` 将完整页面交给 `seatUnplaced`，`withSeatLock` + `BEGIN IMMEDIATE` + `flowColumns`，再对 footprint 漂移卡调用 `reseatLayer` | `apps/server/src/routes/world.ts:821-877`；`packages/shared/src/store/local-store.ts:889-918,989-1090` | 这条是自动新批唯一权威；不得再造第三套自动几何 |
| 共享几何 | `flowColumns` 只读输入、按列流排座，旧障碍不动；耗尽时仍可能返回最后候选并标记 exhausted | `packages/shared/src/layout/flow-columns.ts:148-262`；`docs/layout/00 §4` | 需处理 exhaustion 的真实诊断/补救，但不能回中心重叠 |
| near 落座 | `seatNear` 先读 occupied/maxZ，计算 spiral，最后单独 INSERT/UPSERT，没有 `withSeatLock` 或事务包住全段 | `packages/shared/src/store/local-store.ts:1462-1544` | 并发 near 同一 anchor 仍可产生同座位/同 z；属 P0 残留 |
| 显式 arrange | `arrangeCards` 的 grid/circle/row 只对 `paths` 计算，未参与卡片不是障碍；`placeCards` 只做事务，不做碰撞判定 | `packages/shared/src/actions/canvas.ts:327-379,423-597`；`local-store.ts:1275-1303` | 整理 Agent 不能盲调现有 layout 期待全层无重叠；须定义安全的整理动作/全层障碍输入 |
| 玩家拖拽 | Canvas 直接写 DOM、软推/relax 后对每张变化卡并发调用 `onMoveCard`；`moveCard` 乐观更新未立即同步 `stateRef`，HTTP 坐标写入是逐卡 last-writer | `apps/web/src/components/canvas/Canvas.tsx:468-512`；`apps/web/src/state/useWorld.ts:292-309`；`apps/server/src/routes/world.ts:1115-1132` | 需防止拖拽、整理 Agent、卡片位置帧互相覆盖；不以前端乐观态冒充最终事实 |
| footprint | 浏览器测量只写 `w/h + metadata`，更新后再触发当前层重取与 `reseatLayer` | `apps/web/src/state/useWorld.ts:403-440`；`apps/server/src/routes/world.ts:1135-1150` | 测量与整理需有明确锁/版本/重试顺序，防止用旧高度布局 |
- 幻影 | Chalk/component 幻影使用共享 `flowColumns`，但输入是上次层快照+当前幻影；真实卡由 `/layer` 坐标接管。ChalkMark 正文增长期间可能溢出临时 seat，当前是玩家可见灾难风险 | `apps/web/src/state/useWorld.ts:624-656`；`apps/web/src/lib/phantom-seat.ts:57-88`；`apps/web/src/components/performance/WriterInkLayer.tsx` | 生成中的 Chalk 也不得把字绘到邻卡上；07 已冻结延迟可读演出：仅显示 provisional shell/ink-tip，正文延迟至真实文件落地并由正式卡 renderer 接管；不能用幻影改写 cards |
| 感知工具 | `view_canvas(auto)` 能读 `cards`/links/presence 并返回 `items` 与 `overlaps`；`mode:image` 明确 unsupported | `packages/shared/src/actions/look-at.ts:399-490`；`extensions/toolkit/look-at.ts:67-121` | 可复用结构化感知；真实截图是新能力，失败必须可见，不能假装摘要就是截图 |
- 整理工具 | `arrange` 经 ActionService 写 canvas.db，现有 layout 支持 grid/circle/row；`link` 同样只写画布状态，均不落 history event，由工具结果映射 `canvas_patched` | `extensions/toolkit/arrange.ts:19-91`；`packages/shared/src/actions/canvas.ts:423-597`；`apps/server/src/engine/event-bridge.ts:291-320` | 整理 Agent 只能调用冻结的 `arrange_canvas` 专用工具（ActionService `arrangeCanvas` → store `arrangeCanvasLayer`）；旧 `arrange` 不得作为其安全入口，禁止直接 SQL |
| Agent 运行时 | 当前只有 Writer 与 Character RpcClient；Writer 有 queue/timeout，Character 有独立 session；`functional` 只在 initializer 子代理 activity relay 中出现 | `apps/server/src/engine/lifecycle.ts:61-83,135-232`；`extensions/toolkit/init-command.ts:208-317`；`docs/agent-awareness/00 §2` | 整理 Agent 必须有独立 identity/scope/session/timeout/cancel，不能占 Writer 客户端或 Writer queue |
| 截图基础设施 | AIRP 没有 Playwright screenshot 实现；`view_canvas image` 未实现；Nodesign 有同一用户画布真实 Chromium + 串行 gate 模式 | `packages/shared/src/actions/look-at.ts:403-407`；`../Nodesign/server/engine/mcp/tools/look-at-board.js:45-120` | 设计必须明确浏览器 owner/auth/origin/ready/关闭/并发/成本与失效边界 |
| Writer 自激生成 | 同一 `agent_start` 内，`context` handler 在每次 provider request 末尾追加同一 `llmRole:'user'` 状态块；工具结果后再次 `turn_start`，可能让模型把未变化的 next-step 当新指令，重复调用 Chalk。跨进程实测旧 guard 在 max=2 时 50 次均放行；guard 只能限流，不能根治上下文自激 | `extensions/context.ts:125-193`；同事回归探针记录（2026-09-14） | 07 必须把“同一 Agent run 的重复 Chalk/生成收束”列为生成源风险，不能只修座位碰撞；实现前需有非空重复生成回归 |

## 4. 跨模块冻结契约

### 4.1 真相源与布局动作

- 世界正文、实体和互动字段仍由世界文件真相；画布坐标、尺寸、links、presence、viewpoint 仍由 `.airpworld/canvas.db` 派生/存储。
- 生成/整理/玩家位置写入不得产生第二份坐标状态；所有持久坐标写入必须经过 `LocalWorldStore` / `createActionService` 的既有动作接缝。
- `flowColumns` 是自动新批/footprint 纠偏/幻影座位的唯一纯几何来源。整理 Agent 可以读取其结果，但不得在 Agent prompt、浏览器脚本或前端组件中复制一套隐式坐标算法；**整理动作自身必须由服务端统一碰撞求解或全层 AABB 校验兜底**，不能把“模型按提示词给了坐标”当作安全证明。
- 任何对已有卡的移动都必须显式区分「自动新批」「footprint 变化」「玩家拖拽」「玩家点击整理」；整理是玩家确认的整体动作，可移动稳定卡，但不得伪装成自动生成或偷偷发生。
- 一个整理请求必须以一次可追踪的操作身份贯穿：接受、运行、每次动作、完成/partial/失败/冲突/取消；重复请求不得并发覆盖同一层。唯一接口形状见 §4.5；整理专用 action 不复用旧 `arrangeCards` 安全语义。
- Nodesign 的“先读后写”与“截图后复核”主要是提示词/流程纪律，不是服务端自动闸；AIRP 必须额外用最新结构化 rows 的全层重叠断言决定是否允许 `completed`。若采用 staging，只能是不可持久化的前端视觉草稿，不能成为第二份坐标真相。

### 4.2 整理 Agent 身份与执行边界

- 新 Agent 的业务来源统一称 `functional`，稳定 `agentId = 'canvas-arranger'`；一次点击使用独立 `turnId`，固定形状为 `functional:canvas-arranger:<uuid>`，不能使用 `writer`/`character` 或把 session id 当 turn id。
- 整理写入采用**受控 functional Actor/Scope**，不复用 `engine`：exact role/scope、reader/权限/事件与未知 role fail-closed 见 §4.5；不得让未知 `AIRP_AGENT_ROLE` 静默回退成 writer。
- Activity 帧的 `phase` 仍严格使用既有封闭集合 `started | completed | failed`（`apps/server/src/engine/agent-activity.ts:14`；前端 `apps/web/src/lib/agent-activity.ts:36`）。`accepted → processing → arranging → verifying → landed → completed/partial/failed/conflict/cancelled` 只属于 D 的整理请求本地展示状态，必须有唯一映射，不得扩写 `agent_activity.phase` 或让 UI 猜测 spawn 即完成。
- 整理 Agent 可调用只读感知与专用画布动作；不得调用 `chalk`、原生 `write`/`edit` 改世界内容、`move` 搬文件、`choose`/`roll_dice`/`use_item_on` 改玩法，也不得启动 Writer prompt。
- Agent 看到的状态必须带 layer、路径、真实 row `x/y/w/h/z`、占用/重叠结果和状态快照身份；截图只作为视觉证据，不替代结构化几何事实。
- 整理写入后必须重新读取结构化状态；若仍有重叠或有并发版本变化，必须报告未完成/冲突，不得把工具调用成功当整理成功。

### 4.3 截图与前端状态

- 左侧按钮的玩家状态使用真实阶段：`accepted → processing → arranging → verifying → landed → completed/partial/failed/conflict/cancelled`；`conflict` 是并发/版本或无法证明最新状态的独立本地终态，不得压扁成成功或普通取消。按钮不能显示「完成」而只代表 Agent 已被 spawn。
- 截图应按当前 layer 和可选局部区域限制；浏览器 gate 串行，超时/无 origin/未 ready/权限/浏览器缺失都返回可见失败；不得静默降级为「已看图」。
- functional 活动沿用 `agent_activity` 全局 rail；Agent 的总结不是 Writer 台词，不进 WriterResult/TTS/世界事件。真实 canvas.db 坐标变化仍由现有 `canvas_patched` 或专门明确的画布帧消费。
- 不增加第二个 WebSocket；若新增帧，必须同批更新服务端发射、`useWorld` 唯一消费点、契约门禁和文档。能复用既有 `agent_activity`/`canvas_patched` 就不新增。

### 4.4 并发、幂等与失败

- 整理与生成/footprint/玩家拖拽同时写入时，服务端必须有明确的版本或按层串行策略；不能依赖 `reqSeqRef`、HTTP 返回顺序或 Agent 自己记忆。
- 整理动作必须是数据库事务或等价原子批量写入：要么整批坐标落地，要么不落地；冲突需回读最新 rows 后停止或有限重试。稳定卡是否允许被整理移动由玩家点击这一明确授权决定，但必须记录在结果中。
- 自动布局正常目标是零 AABB 重叠（至少按 row 的真实 `w/h`，并在浏览器用真实绘制高度复核）；保护阀 exhausted、无法取得截图、无法证明最新版本等均不能伪装成功。
- 失败不写世界事件；canvas 当前值的整理写入沿用 `canvas.db` 语义，不新增 `arranged` 世界事件，除非评审证明玩家需要历史语义且同步修改封闭事件契约。过程状态只走 functional activity/临时帧。
- 取消只能停止未提交工作；已经提交的坐标事实保留，并在 UI 明示「已完成部分」或事务回滚结果。重复点击必须复用/拒绝同一层的进行中请求，不得双开两个整理 Agent。

## 4.5 Canonical contract（唯一机器核验口径）
以下集合和字段是 06–12 的唯一真相；其余文档只能引用本节。`NEW` 表示实现前新增能力，不表示当前代码已存在。


| 项 | canonical contract |
|---|---|
| Model tools | `view_canvas(auto)`, `screenshot_canvas`, `arrange_canvas`；不提供图像模式或其他 arrange 别名 |
| HTTP arrange request | `POST /api/canvas/arrange` JSON `{ worldId:string, layer:string, mode:'grid'|'circle'|'row', requestId:string, expectedRevision:number, expectedCanvasVersion:number, snapshotId:string, screenshotPolicy:'none'|'before'|'after'|'before_and_after' }` |
| HTTP arrange ack | HTTP `202`; JSON `{ ok:true, operationId:string, requestId:string, worldId:string, layer:string, agentId:'canvas-arranger', turnId:\`functional:canvas-arranger:<uuid>\`, stage:'accepted' }` |
| HTTP cancel | `POST /api/canvas/arrange/:operationId/cancel` JSON `{ worldId:string, layer:string, requestId:string }`; HTTP `202`; JSON `{ ok:true, operationId:string, requestId:string, worldId:string, layer:string, stage:'cancel_requested'|'already_completed'|'already_cancelled' }` |
| External identity | HTTP exposes only opaque `worldId`; server resolves it to the active world internally. `worldRoot`, DB paths, URLs, executable paths and proxy settings are never request fields |
| Actor/scope | exact role `AIRP_AGENT_ROLE=functional:canvas-arranger`; exact scope `AIRP_AGENT_SCOPE=functional-canvas-arranger`; Actor `{type:'functional',id:'canvas-arranger'}`; missing/unknown/mismatched values fail closed, never writer/engine fallback |
| Versions | `canvasVersion:number` is monotonic per-layer `canvas.db` position-write version; `canvasRevision:string` is the canonical digest of current canvas values; `snapshotId:string` binds layer rows plus source/content digests. They are not interchangeable; `expectedRevision` remains the world history high-water mark |
| Screenshot request | `POST /api/canvas/screenshot` JSON `{ worldId:string, layer:string, snapshotId:string, captureCapability:string, viewport:{width:number,height:number}, region?:{x:number,y:number,w:number,h:number} }`; `captureCapability` is short-lived, server-issued, operation/world/layer-bound and opaque |
| Screenshot transport | server accepts only active `worldId` plus valid capability; same-origin/loopback, ready signal, serial browser gate, bounded timeout/rate/size; missing capability/origin/browser/ready is explicit failure; child never guesses active world and never receives root/URL/executable/proxy |
| Snapshot fence | snapshot reader fences DB `canvasVersion` and content/source digest before and after its read; any mismatch returns machine `conflict`, never a torn snapshot or silent hash |
| Activity vs local state | `agent_activity.phase` exactly `started|completed|failed`; D local phases exactly `idle|accepted|processing|arranging|verifying|landed|completed|failed|partial|conflict|cancelled`; runtime outcomes exactly `completed|partial|failed|conflict|cancelled`; conflict is never failed/cancelled |
| Geometry proof | completion requires fresh same-layer rows and full-layer real-row AABB `overlaps=[]`; screenshot/DOM is evidence and cannot self-certify completion. Post-commit visual/DOM proof failure retains rows and yields `partial` or `conflict`; pre-commit screenshot failure yields failed/no-write |
| Structure guarantee | only links and card identity/count are machine-verifiable commitments; no unbacked reading-order, grouping, adjacency or relative-structure promise |
| Events | reuse `agent_activity` and `canvas_patched` (and existing `card_position` where required); no second WebSocket and no `arranged` world event |

Canonical enum sets are exact, not unions. A doc or implementation that adds a member or alias is a contract failure.
## 5. 设计篇边界

并行设计篇必须交叉引用本文，并负责以下互不重叠模块：

- **A：自动生成与坐标写入治理**：`seatNear`、批量/显式 arrange 的碰撞安全、拖拽并发、footprint 排序、幻影临时溢出与真实接管；不得设计 Agent 生命周期、按钮或截图。
- **B：整理 Agent 运行时与动作工具**：独立 RpcClient/launch/preset/scope、工具白名单、事务/版本/取消/结果；不得重新定义前端按钮视觉或复制 A 的几何实现。
- **C：感知与真实截图工具**：结构化画布状态、Playwright 同画布截图、快照身份、截图 gate/权限/资源/错误；不得拥有坐标写入或 Agent spawn。
- **D：前端整理入口与过程反馈**：左侧按钮、请求 HTTP/WS、functional activity、阶段/取消/并发和 canvas refresh；不得在前端实现坐标整理算法或直接写 DB。
- **E：验证与回写**：端到端场景、几何/浏览器双重证明、并发/失败/取消矩阵、契约门禁；不得实现功能。
- **F：整理 Agent 提示词**：独立 system/task prompt、工具使用顺序、读—截图—整理—复核纪律、禁止越权与结果报告；不得重新定义 B 的运行时、C 的感知返回或 D 的 UI 阶段。

## 6. 设计文档统一要求

每篇必须写：

1. 一句话定位；
2. 当前事实（精确 `file:line`/函数锚点）与残留缺口；
3. 完整输入/输出/副作用与身份；
4. 编号行为步骤，每步写漏掉的后果；
5. 精确代码落点；新增函数标 `NEW` 并给完整签名；
6. 并发、幂等、取消、重试、失败与可见状态；
7. 与本文件及上位契约的交叉引用；
8. 至少一条修复前必失败的**非空性**验收用例；
9. 发现的冲突/需要回写的文档；
10. 仍未知、明确交给评审的事项。

文档只写事实或标 `[推断]`；示例只能使用真实符号，新函数/新字段显式标 `NEW`。设计代理跳过全量 build/test/lint；评审完成后主代理统一验证。

## 7. Nodesign 借鉴清单与禁止照搬

可借鉴：

- `read_board` 先输出真实座位、包围盒、组/行/关系、用户视口，再执行移动（`../Nodesign/server/engine/mcp/tools/read-board.js:58-69,134-180`）；
- `look_at_board` 使用同一真实浏览器页截图、owner 认证、ready 信号、串行 Chromium gate 和显式失败（`../Nodesign/server/engine/mcp/tools/look-at-board.js:45-120`）；
- `edit_board` 使用相对意图、调用内 live 副本、统一避让、逐步报告和单次 patch（`../Nodesign/server/engine/mcp/tools/edit-board.js:92-127,143-190,236-287,392-415,497-508`）；
- `resolvePlacement` 的 AABB/PAD/环搜/无失败分支与 `board-seater` 的磁盘存在、幂等跳过、同批占用（`../Nodesign/server/lib/board-place.js:20-39,44-108,183-277`；`../Nodesign/server/engine/runs/board-seater.js:53-131`）。

禁止照搬：Nodesign 的 artifact 文件搬迁、`tag/lane/roll/staging`、HTML deck/iframe 特有工具、板书文件署名/软删语义，以及任何绕开 AIRP 世界文件与 `canvas.db` 分工的第二状态。
