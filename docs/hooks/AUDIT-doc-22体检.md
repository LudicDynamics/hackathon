# doc-22 体检报告

> 起因（2026-09-12 明月）：doc-22 写于早期，"可能有一些（大概率是很多）跟不上目前其他代码或文档预期的内容"。
> **不要假定它定死就安然无恙**；方向可信，但不是全面解、也不是最优解。
> 方法：每条 load-bearing 断言拿到 **当前代码**面前对（不是拿 doc-22 的转述互证），关键机制用**真引擎 spike 实测**。
>
> 本文件是体检**进行中**的记录。结论定型后并入 `docs/hooks/00-共同上下文.md` 的"与 doc-22 的差异"一节。

---

## 0. 实测结论（真引擎，非推断）

两个 spike：`tools/probe-inject-persistence.mjs` + `tools/probe-inject-extension.ts`（一次性，不进仓库）。
方法：`writerLaunch` 起真作家进程，灌确定性 provider，连发三个独立用户轮，用扩展在 `context` 钩子里观测**每次 LLM 调用实际收到的完整消息数组**。

### S1 — `before_agent_start` 的注入**会累积**（doc-22 §8 的核心断言为假）

观测（第 3 轮）：

```
"injectedBlocksVisible": 3,
"blockTags": ["<<<INJECTED_BLOCK_1>>>", "<<<INJECTED_BLOCK_2>>>", "<<<INJECTED_BLOCK_3>>>"]
```

**doc-22 §8 写「注入块天生有界……大小不随轮次增长，没有压缩的对象」——事实相反。**

机制链（源码级）：
1. `agent-session.ts:2107-2125` 把 `BeforeAgentStartEventResult.message` push 进交给 `_runAgentPrompt()` 的 `messages` 数组；
2. `agent-loop.ts:110-113` 对这批 prompts **逐个** `emit({type:'message_start'})` / `emit({type:'message_end'})`；
3. `agent-session.ts:936` 在 `message_end` 且 `role === 'custom'` 时调 `sessionManager.appendCustomMessageEntry(...)`；
4. `session-manager.ts:1266` 落成 `custom_message` **会话条目**（pi-rp 自己文档 `extensions.md:568` 也明写 "Inject a **persistent** message (stored in session, sent to LLM)"）。

于是第 N 轮上下文里有 N 个状态块。**这不是小事**：doc-22 §8 正是用"注入块有界"这个前提**撤销了 summary 压缩层**，并论证"没有压缩的对象"。前提假 → 该论证不成立。

### S2 — `context` 钩子的注入**不累积**（可做真正的每轮临时注入）

`context` 事件（`types.ts:758`「Fired before each LLM call. Can modify messages.」，`runner.ts:1133` 用 `structuredClone` 后接受**替换数组**）的同一观测：

```
turn 1: priorBlocksVisibleInIncomingPayload=0, messageCountIn=2, out=3
turn 2: priorBlocksVisibleInIncomingPayload=0, messageCountIn=4, out=5
turn 3: priorBlocksVisibleInIncomingPayload=0, messageCountIn=6, out=7
每次 agent_end: persistedBlocksInRunMessages=0
```

- `messageCountIn` 每轮 +2（只有 user + assistant，**无注入残留**）；
- `messageCountOut` 恒 = in + 1（只有本轮那一个新块）；
- `agent_end` 的 messages 里持久化的注入块**恒为 0**。

**结论：`context` 钩子返回替换数组 = 真正的临时注入（只影响本次 LLM 载荷，不落会话条目）。** 这是修 S1 的正确接缝，doc-22 §2.1/§9 选 `before_agent_start` 是**机制选错**，不只是"少考虑了一层"。

### S2 的附带发现

- `context` 在**一次 agent run 内的每个工具循环轮**都会触发（`extensions.md:294-297`）。所以若在此组装，要防"一轮内重复组装"（同一 run 的多个 tool-turn 会各注入一次，除非按 run 去重）。
- 注入块在 `context` 路径下是 `role:"custom"` 但仍可带 `customType` → 身份仍可辨识（doc-22 §2.1 说的"身份清楚"这条收益**不因换钩子而丢失**）。
- `before_agent_start` 的 `message` 仍在某些场景是对的（要**长期驻留**上下文的东西）；AIRP 的状态块是"每轮新鲜、旧的不该留"，正是 `context` 的用例。

---

## 1. 与 doc-22 逐节差异（两份独立子代理复核后）

### §2.1 接线：**选错了钩子**（FALSE）
见 S1/S2。`before_agent_start` 的 `message` 会累积；应改走 `context`。
doc-22 的三条理由（身份清楚 / 不炸缓存 / 每轮新鲜）在 `context` 下**全部仍成立**，只有"用 `before_agent_start` 的 message"这个具体落点错。
**附带**：doc-22 说 Nodesign"因为 pi 侧没有等价物所以拼进 prompt 文本"是**过时的**——Nodesign 自己就用 `pi.on('before_agent_start')`（`server/extensions/guards.ts:118`）。它把 turn-state 留在 session-loop 是架构原因（要 server 侧的 projectId / board-store）。

### §2 九条机制：**7 条捕获正确，1 条误述，1 条不完整**（NodesignRef 逐条核对）
正确：①按节组织 ②首轮全量后只报变化 ③清单报增删 ④未变点名 ⑤一节未变一句话 ⑥压缩后重置（pi-rp 的对应钩子确是 `session_compact`）⑦1/8 量化 ⑧fail-soft 到节 ⑨一份措辞两处复用。
- **误述（第 9 条）**：`describeViewpoint`（`viewpoint-store.js:60-76`）**不是人话方位生成器**——它打印**原始视口坐标**（`视口 (1234,567) 1920×1080`）。「在柜台附近」这类**方位词是 AIRP 自己的设计**，Nodesign 没有、抄不来。doc-22 §5 说"方位词是天然的量化"因此是**新设计而非继承**，要自己实现（`render/spatial.ts` 的 `dirPhrase` 是这个方向）。
- **不完整（第 8 条 fail-soft）**：Nodesign 有**三层**（逐节 try/catch → 采集器只在有内容时 push → 外层 try/catch **整块返回 null**）。doc-22 只写了第一层。
- **doc-22 §8「大小不随轮次增长」**：Nodesign 自己也不满足（每轮块落在该轮 user 消息里，N 轮 N 份近拷贝，只靠 diff 变小 + pi 压缩兜底）。**两份参考实现都在累积**——这条从来没人做到。

### doc-22 漏掉、而 Nodesign 有、AIRP 也用得上的机制
1. **节的 New/Vanished 生命周期**（`（新出现）`/`（已不存在：…）`，`turn-state.js:246,262-265`）——叙事上就是"实体进入/离开某层"，对 AIRP 直接有用。
2. **一次性节标记**（`hasBinaryDocs` 模式，仅在 absent→present 时附一次提示）——AIRP 可用来做"一次性叙事事实"（如"玩家现在拿着黄铜钥匙"）。
3. **外层 null 兜底**（整个状态块采不到就不注入，turn 照跑）。
4. **进程内 LRU 上限**（300 会话）+ `turns` 计数。
5. **`raw` 旁路**（斜杠命令跳过组装）。
6. **工具侧的补集**：Nodesign 的 `read_user_view` 在注入之外**多给**"视口中心坐标 + 按距离排序"，用于**把生成物摆进玩家视野**。AIRP 的 `look_at` 是工具侧对应物——要检查它是否需要这个能力（doc-22 §7 的"两层"只讲了一半）。

### §3.1 §5 视点：doc-22 与 doc-02 §3.2 冲突（**RISK，待裁决**）
- doc-22 §3.1/§5：「**不给坐标数字，给人话方位**……方位词的粒度就是天然的量化」；
- doc-02 §3.2（照抄 Nodesign）：「注入一行人话：`视口 (1234,567) 1920×1080 缩放 1.00；视口里有 5 件…`」——**带坐标数字**。
两份文档口径相反。**注意**：Nodesign 给坐标是因为它的 agent 要**往视口里摆东西**（`read-user-view.js:40-51` 给视口中心）。AIRP 的作家**也要摆**（`arrange`/落新卡）——所以"完全不给坐标"可能过头。**倾向**：注入给方位词 + 视口中心（人话），**坐标只走工具**（`look_at`）。待明月拍板。

### §2.1 关于量化的更正
doc-22 §5 说"前端与服务端**用同一个量化函数**"——**Nodesign 是理想**（两处内联表达式、两种语言：`useViewpointReport.js:33` vs `turn-state.js:158-160`）。AIRP 要做成**真正共享的一个 TS 函数**（新工作）。

### §6 viewpoint 表字段：**doc-22 的字段表不全**（NodesignRef 核）
Nodesign 实际存（`viewpoint-store.js:33-42`）：`{userId, camera{x,y,w,h}|null, zoom, layer, openWindow, openPage, selected[], at}`。
doc-22 的 `layer / focus / selected / bag_count / at` 缺 **`camera` 矩形与 `zoom`**（除非确定 AIRP 完全不需要——见 §3.1 的取舍）；`openPage` 在 Nodesign 是**死字段**（前端从不报），AIRP 可不要；**`bag_count` 存数量渲染不出 `bag` 节的清单**——要么改存清单（截断到条目上限），要么 `bag` 节只报数量。

### §9 落地落点：**部分失效**
- `packages/shared/src/protocol/` **当前是空目录**（B6 未做）；B2 的状态块**不属于**协议层，别顺手塞进去。
- `extensions/context.ts`（新建）方向正确，但**入口钩子要改 `context`**（S2），不是 `before_agent_start`。
- `presets/*.json` 的 `hiddenOverrides.compaction`：确认 4 个 preset **当前都没有** `hiddenOverrides` 键。
- doc-22 §9 说"扩展侧改不了压缩、也不需要改"**过头了**：`session_before_compact` 能返回整个 `CompactionResult`（`types.ts:1218-1221`）；只有**摘要提示词**是 preset 专属（`hiddenOverrides.compaction`）。结论（走 preset）仍对，理由要改。

---

## 2. 其余核实（源码级，PiRpSemantics 子代理 + 主控复核）

### 2.1 `before_agent_start` 的触发时机（doc-22 的隐含假设**成立**）
`emitBeforeAgentStart` 全仓**唯一调用点**是 `agent-session.ts:2108`，在 `prompt()` 内、`_runAgentPrompt()` 之前。工具循环在 `_runAgentPrompt` 内部（`agent-loop.ts:180-263`），**不会再进 `prompt()`**。所以**每个用户轮恰好一次**。

**但 doc-22 不知道的例外（都影响"每轮一次"）**：
- `steer` / `followUp` 排队消息在 `:2052-2055` 就 return 了，**不触发**；它们在 loop 中途由 `config.getSteeringMessages`（`agent-loop.ts:276`）取走 → **这些轮的状态是陈旧的**。
- `sendCustomMessage({triggerTurn:true})` 直接调 `_runAgentPrompt`（`:2356`），**不触发**。
- 续写 / 重试 / 溢出恢复走 `_runAgentContinue`（`:2468-2473`），**不触发**。

### 2.2 子代理**不共享** hook（已核实，B5 相关）
`subagent/run.ts:81-83` 起子会话时 `extensions: []`；只把父扩展的 `tool_call` / `tool_result` / `tool_execution_*` 五类 handler 通过 `attachSyntheticExtension` 转过去（`:110-130`）。**`before_agent_start` / `context` / `session_compact` 都不转发。**
→ scene-init 子代理（B5）拿到的是**零注入**；它的上下文只能靠 `seedState`（`spawn.ts:117-124`）/ `inheritMessages` / `customTools` / preset slot。doc-22 完全没提，实现者极易踩错。
→ 反向仍成立：子代理里的工具调用**会**冒泡到父扩展的 `tool_execution_*`（B1 的 `turn.ts` 依赖它）。

### 2.3 `registerCustomType` 政策（名字与语义**正确**，三个坑）
`messages.ts:69-91`：`context` / `llmRole` / `compaction?` / `renderContent?`，默认 `{include,user,include}`。
- `compaction:"exclude"` 语义**如 doc-22 所述**——live 上下文可见（`:271`），总结输入剔除（`:274`，三个调用点都传 `forSummarization=true`）。
- **坑 1（首次声明生效）**：`loader.ts:210-214` `if (!customTypePolicies.has(customType)) set(...)`——重复注册是**静默空操作**，只能注册一次。
- **坑 2（不是有界机制）**：`compaction:"exclude"` 只过滤总结输入，**不能阻止累积**（见 S1）。
- **坑 3（身份跨 LLM seam 会丢）**：`convertToLlm` 把 custom 转成普通 user 消息时**丢掉 `customType`**（`messages.ts:268-283`）；要保住身份只能用 `renderContent` 包一层稳定标记。

### 2.4 `session_compact`（存在、压缩后触发；doc-22 的重置计划**不完整**）
`types.ts:665-673` 事件本身**不带 sessionId**，但 handler 第二参 `ctx.sessionManager` 可用（`runner.ts:810-814`）→ `getSessionId()` / `getSessionFile()`。
**缺口**：模块级 Map 是**进程级**，不是会话级。今天 AIRP 一个 agent 一个进程（进程==会话）所以撞不上，但 `/new`、`/resume`、`/fork`、`/tree` 换分支**都不触发 `session_compact`**——必须另外挂 `session_start`（`reason:new|resume|fork`）与 `leaf_changed`。

### 2.5 `read_cursors` 与累积的交互（**第二个被 S1 破坏的断言**）
doc-21 §5.4 说"注入即消费，不留尾巴"。走 `before_agent_start` 时注入文本在 transcript 里**永久留着** → 游标宣称"已消费"，文本却还在上下文里。改走 `context` 后文本不落盘，"注入即消费"才严格成立。


## 3. 对 B2 设计的直接影响（已定型，非"暂定"）

### 3.1 决定一：注入接缝从 `before_agent_start` 改为 `context`
理由见 S1/S2 + 2.1：`context` 是**引擎唯一的临时注入接缝**（返回替换数组 → 只进本次 LLM 载荷，永不落会话条目）。被否决的替代方案（**都会累积**）：`sendCustomMessage({deliverAs:'nextTurn'})`（进 `_pendingNextTurnMessages`，最终并入同一个持久数组）、`{triggerTurn:false}`（既 push state 又 append 条目）、`appendEntry('message',…)`。

**与 doc-22 §2.1 三条理由的对照**：
| doc-22 的说法 | 换到 `context` 后 |
|---|---|
| "身份清楚"（独立 custom_message） | **不丢**——注入块仍可带 `customType`；配 `renderContent` 包标记后，跨 `convertToLlm` 仍可辨（比 doc-22 原方案更强） |
| "不炸缓存"（不碰 systemPrompt） | **不丢**——两者都追加在数组尾部，尾部追加对缓存友好 |
| "每轮新鲜" | `context` **更强**（每次 LLM 调用都触发，含工具循环内的每一轮） |

### 3.2 决定二：**放弃"只报变化"的指纹差分**（最反直觉的一条）
`context` 注入是**无状态的**——请求 N 的载荷里只有**当前**状态块 + 持久 transcript，**上一轮的块已经不在**。所以 doc-22 §4 规则 2/3/4 的"标（有变化）/ 未变点名 /「与上一轮相同」"**没有指代对象**。

→ **状态块必须是自足的全量**（受 doc-22 §10 的条目上限约束），**"有界"由条目上限保证，而不是由差分保证**。

这与 doc-22 直接冲突，但它是 S1/S2 的必然推论：
- 走 `before_agent_start`（doc-22 原方案）时，差分**能**省 token（旧块还躺在上下文里），代价是**无界增长**；
- 走 `context`（本方案）时，差分**做不到**（没有旧块），但**每轮恰好一份**、天然有界。
- **有界 > 省 token**。doc-22 §8 撤销 summary 压缩层的**目标**是对的，错的是**手段**。

### 3.3 决定三：`session_compact` 的重置职责大幅缩小
每轮都是全量、且不落盘，**就不需要"压缩后重置指纹"**（没有指纹）。doc-22 §2 第 6 条 / §4 规则 5 相应作废。若将来为省 token 引入进程内缓存，才需按 2.4 挂 `session_start` + `leaf_changed`。

### 3.4 其余待裁决（需明月拍板或下游文档回写）
- **doc-02 §3.2 要改**：它按 Nodesign 原样写了"注入 `视口 (1234,567) 1920×1080 缩放 1.00`"，**带坐标数字**；doc-22 §3.1/§5 主张"不给坐标、给人话方位"。二选一。
- **doc-22 §6 的 `bag_count` 字段**：`bag` 节要"只列不灌"的**清单**，存一个**数量**渲染不出清单。要么改存清单（截断到条目上限），要么 `bag` 节改为只报数量——待 NodesignRef 复核后定。

### 3.5 `before_agent_start` 还留着吗
留，但**只当轮边界信号**（算好并缓存状态块，返回 `undefined` 不注入），或改用 `agent_start`。理由：`context` 在**每个工具循环轮**都会触发，逐轮扫盘 + 读两个 db 太贵；用轮边界算一次、`context` 里只做纯字符串拼接。`context` 还会被 `previewPrompt()`（`/prompt` 预览）调用，所以 handler **必须纯且廉价**。


## 4. 代码落点核查（Doc22Diff 子代理，31 条发现）

### 4.1 已有、可直接复用（好消息）
| 需要的东西 | 现成在哪 | 备注 |
|---|---|---|
| `layer_files` 的"路径 + 一行这是什么" | `render/layer-page.ts`：`summaryOf`(66, 90 字摘要) / `kindWordOf`(117) / `renderLayerBlock`(172) | **已存在**，doc-22 以为要新写 |
| 层的目录枚举与派生 | `store/layers.ts`：`cardsOfLayer`(102) / `childLayers`(117) / `deriveLayers`(52) | 已存在 |
| 方位人话 | `render/spatial.ts`：`dirPhrase`(42) / `nearestNeighbours`(67) | 已存在，但**签名要 Box 相对锚点**——presence 是**点**，喂不进去（见 4.3） |
| 事件读取 | `store/local-store.ts`：`getEventsSince`(408) / `readCursor`(440) / `writeCursor`(448) / `getMaxSeq`(437) | 数据层齐；`writeCursor` **无生产调用点** |
| 游标 reader id | `actions/actor.ts`：`readerOfActor`(53) → `'writer'` / `'character:<id>'` | 已存在，**无生产调用点** |
| 角色标记 | `presets.ts::airpEnv`(88-107) | 唯一注入点，doc-22 依赖它 |

### 4.2 必须新写（doc-22 未点名）
1. **`render/*` 没从 barrel 导出**：`packages/shared/src/index.ts` **没有** `export * from './render/*'` → `dirPhrase` / `renderLayerBlock` / `summaryOf` **扩展与前端都够不到**。doc-22 §9「formatter 共用一份」这一行**依赖一个不存在的导出**。
2. **事件段的"人话渲染器"全仓不存在**：`schemas/events.ts` 只有 15 个类型的 `detail` schema，**没有任何 per-type 人话渲染**（doc-21 §3.5 要求"不存渲染后的句子"，于是渲染器得新写）。这是 B2 的**最大新增件**。
3. **共享量化函数不存在**（Nodesign 是两处内联；见 §1）。
4. **`viewpoint` 表不存在**（doc-22 标注正确）。

### 4.3 与代码直接冲突
+- **doc-22 §6「扩展侧只读连接」为假**：`LocalWorldStore` 构造时**读写打开两个 db 并跑 DDL**（`local-store.ts:63-72`），扩展用的就是它（`extensions/toolkit/deps.ts:28`）。要"只读"得**新开一条 `{readonly:true}` 路径**，不是现状。
+- **`dirPhrase` 喂不进 presence**：它要 `Box`（w/h），presence 只有点。所以 `cast` 节的"大致在哪"**不能**直接复用方位词器——要么给 presence 造个伪 Box，要么新写一个点→方位词函数。
+- **`cardsOfLayer` 不排序**（`listFiles` 无排序）：doc-22 §3.2「层内 chalk 按时间排」**没有排序可依赖**，要新写。
+- **doc-22 §9「角色 preset 配 compaction」漏了绝大多数角色**：`launch.ts:109-113` 的角色 preset **优先取 `worldRoot/characters/<id>/preset.json`**，仓库 `presets/character.json` 只是**兜底**；7 个模板角色里 **6 个自带 preset.json**。照 doc-22 字面改 `presets/character.json` 会**静默失效**。正确落点是**每个角色自己的 preset.json**（或改造加载：把平台口径下沉到 slot，见 doc-23 §3.1）。
+- **doc-22 §6「presence 跟着快照回滚」目前无法实现**：`snapshotWorld`/`rollbackWorld` 在 `service.ts` 只有签名与 `ACTION_METHODS` 登记，**没有 handler**。
+- **doc-22 引用的三个 doc-18 章节号是死的**（§124/§125/§157）：doc-18 在 2026-09-10 重构后实际是 §3.1(122-129) 与 §3.1 item 4(127)。

### 4.4 待确认的小项
+- `presence` 表现有列：`id / character_id(UNIQUE) / layer / x / y / following / updated_at` + `idx_presence_layer`——`cast` 节需要的"谁在这层"有索引可查（`getPresence`(1087) / `getPresenceOf`(1097)）。
+- `GET /backpack`(292) 是目前**唯一**背包读者（扫 `player/`，**shared 里没有 helper**）——`bag` 节要么抽 helper，要么复用这条路由的逻辑。
+- `look-at.ts::resolveDefaultLayer`(171) **也探 `viewpoint` 表**——与扩展侧 `currentLayer` 重复实现，落地时应收成一处。

---

## 5. 体检结论（一句话）

**方向对、钩子错、机制落空、落点漂。** doc-22 的目标（每轮让 agent 知道世界什么样 + 刚变了什么，且不让上下文无界增长）成立；但：
1. **接缝选错**（`before_agent_start` → `context`）——引擎级硬伤，也是唯一能让"有界"成真的路径（S1/S2 实测）；
2. **"只报变化"的基石不存在**（无状态注入没有"上一轮"可差分）→ 改**全量 + 条目上限**；
3. **九条机制里 1 条误述、1 条不完整**，另有 4 条 Nodesign 有而 doc-22 漏的机制值得补；
4. **两个参考实现都在累积**——"有界"这件事从来没人做对，AIRP 用 `context` 才能第一个做对；
5. **落点表多处失效**（render 未导出、事件渲染器不存在、角色 preset 覆盖、只读连接不成立）。

这些都写进 `docs/hooks/` 的设计批次契约。
