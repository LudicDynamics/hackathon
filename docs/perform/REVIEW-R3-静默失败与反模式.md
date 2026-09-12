# REVIEW-R3 — 静默失败与反模式（只读评审）

> 2026-09-13。视角：**失败会不会被静默吃掉** / **设计是否违反硬约束**。
> 评审对象：`docs/perform/00`–`06`（6 篇设计 + 改写单），并实读源码复核。
> 未改任何设计文件；本文件是唯一产出。所有结论带 `file:line` 或文档章节号；实读的源码证据标「实读」。

---

## 1. 结论

**需回写后再放行**（不是阻断）。

设计整体上**没有**踩 `docs/perform/00 §9` 的 8 条反模式；失败可见性的主线（幻影撤离、错误封条、`console.warn` 不作为交付）是清醒的、有论证的。但有 **3 条设计自己埋下的静默失败**必须先修，否则「旗舰功能（湿墨逐字）」会以**零报错**的方式表现为「什么都没有」：

- **P0-1**：`writer_delta` 与 `chalk_writing` 的广播**时序与消费时序相反** → 湿墨被静默丢弃（§2.1）。
- **P1-1**：`01 §3.2.1` 的一致性兜底 `delta: authoritative` 与 `appendInk` 的**累积语义**自相矛盾 → 兜底触发时正文**翻倍**（§2.2）。
- **P1-2**：WS 重连后 `writer-state.phase` 无归位路径 → `WriterBar` 永久禁用、玩家输入**静默丢失**（§2.3）。

另有 2 条「静默忽略」判定为**正确的设计**（§3），以及若干 P2/P3 核验偏差。

---

## 2. Findings

### P0-1 · `writer_delta` 先于 `chalk_writing` 到达，湿墨静默丢弃

- **位置**：`docs/perform/01` §3.1 / §3.2.2 / §6.1 / §6.3 / §6.6；`apps/server/src/engine/event-bridge.ts:84-91`、`:64-74`（改造后）。
- **问题**：设计把 `writer_delta` 挂在 **`toolcall_end`**（`01 §3.2` 步骤图 `:74-81`），把 `chalk_writing` 挂在 **`tool_execution_start`**（现状 `event-bridge.ts:87-89`）。契约 §3.1 的 spike 实锤时序是：

  ```
  toolcall_start → toolcall_delta… → toolcall_end → tool_execution_start
  ```

  即 **`writer_delta` 一定先于 `chalk_writing` 广播**。前端 `case 'writer_delta'` 只做 `phantoms.appendInk(msg.toolCallId, msg.delta)`（`01 §6.3:370`），而幻影登记发生在 `case 'chalk_writing'`（`01 §6.1:240`）。**第一条 delta 到达时该 `toolCallId` 的幻影尚不存在**：`appendInk` 对未知 id 无定义/无操作（`01 §7` 只规定 `evict` 对未知 id 记 `evictOrphans`，`appendInk` 未规定缓冲），正文**丢失**；随后 `chalk_writing` 登记一张**空壳**幻影。
- **证据**：
  - 时序：`docs/perform/00 §3.1` item 2 实测序列 `msg_update:toolcall_start/toolcall_delta/toolcall_end → TOOL_START name=write → TOOL_END`；源码复核 `vendor/pi-rp/packages/agent/dist/agent-loop.js:240-251`（`message_end` 在 `executeToolCalls` 之前）→ 工具执行事件必在生产流消息之后。
  - 消费：`01 §6.3:368-371`（`appendInk`）与 `01 §6.1:237-244`（`register`）是**两个不同 case**，无前后置保证。
  - 设计全篇**没有一行**承认或处理这个次序（`01 §7` 边界表无此情形；`01 §12` 未知项也无）。
- **后果**：湿墨这一拍**永远不会出现**（或只在极少数时序下出现），玩家只看到「空白幻影壳 → 正文突然整段落地」。且**零报错、零 warn**——门禁也绿（`case` 字面量存在）。这正是契约 §10 点名的「假绿」最坏形态。
- **建议（三者择一，写进 `01`）**：
  1. `phantom.ts` 的 `appendInk(toolCallId, delta)` **对未知 id 也建缓冲**（pending ink），`register` 时把缓冲灌进 `text`；或
  2. 前端把 `chalk_writing` 视为「创建 + 回填」：收到 `chalk_writing` 时若 `writer_delta` 已先行到达（按 `toolCallId` 缓存），一次性合并；或
  3. 服务端把 `chalk_writing` 的发射点从 `tool_execution_start` 提到 `toolcall_end`（与 `writer_delta` 同批、**且排在 delta 之前**）。
- **可核验判据**：`01 §10.2` 判据 1/2 必须在**断言顺序**维度加一条：湿墨首字必须出现在幻影壳**之后**（即壳已存在于 `getPhantomsSnapshot()`）。当前判据 1 只说「出现半透明壳」、判据 2 只说「文字逐字增长」，**两者独立断言，掩盖了顺序缺陷**。

### P1-1 · 兜底 `delta: authoritative` 与 `appendInk` 累积语义冲突，正文翻倍

- **位置**：`docs/perform/01 §3.2.1:100-102`（服务端）↔ `§6.3:375-376`（前端）。
- **问题**：`§3.2.1` 的一致性命底写：

  ```ts
  if (prev !== authoritative) push({ type:'writer_delta', source, delta: authoritative, toolCallId: tc.id })
  ```

  注释与 `§7` 表（`:512`）都声称语义是「**用权威正文补一条**」「宁可与权威正文逐字一致」。但前端 `§6.3` 明确 `appendInk` 是**累积**（「拼在 `entry.text` 尾部」）。于是兜底触发时，前端看到的最终正文 = `prev`（已渗出的部分）**+ 整段 `authoritative`** → **正文翻倍**。
- **证据**：`01 §3.2.1:101` 的 push 载荷是 `delta: authoritative`（整段）；`01 §6.3:375` 「累积而非替换」；`01 §6.2:316` `appendInk` 签名 `(toolCallId, delta)` 且未定义「替换」入口。
- **后果**：兜底正是为「提取器漏了某个转义形态」而存在（`§3.2.1` 自述）。也就是说，**这个分支一旦被触发，产出的就是坏数据**，且没有崩溃、没有 warn——玩家看到一段被复制两遍的正文，落定后被真实文件覆盖（`chalk_landed` + `file_changed`），表现为「作家瞬间改稿」。`§10.3` 的 13 条单测**只测提取器**，测不到这条服务端拼接逻辑。
- **建议**：把兜底改成**替换语义**——新增 `setInk(toolCallId, text)`（或让 `writer_delta` 带一个 `mode:'replace'` 标志），兜底时整段覆盖；或让兜底只推**缺失的后缀** `authoritative.slice(prev.length)`（并断言 `authoritative.startsWith(prev)`，否则退回 setInk）。同时补一条服务端单测：**「提取器故意漏一处 → 拼接结果 == authoritative（不重复）」**（这才是有非空性的用例）。

### P1-2 · WS 重连后 `writer-state.phase` 无归位，输入静默禁用

- **位置**：`docs/perform/01 §6.4:409-412`（状态迁移）、`§6.7`（与 `writerToolsInFlight` 的关系）；`apps/web/src/state/useWorld.ts:311-313`（`onopen` 重置）。
- **问题**：`phase: writing` 的唯一出口是 `writer_idle`（`§6.4`：「`writing ──writer_idle（agent_settled）──▶ idle`」）。`agent_settled` 只在**那次 turn 的 finally** 里发（实读 `vendor/pi-rp/.../agent-session.js:1497-1501`）。若 WS 在 `writing` 期间断开（dev 热重载、网络抖动、休眠恢复），`writer_idle` 落在断线窗口里 → **`phase` 永远停在 `writing`**。既有代码对同类问题有防线：`useWorld.ts:311-313` 的 `ws.onopen` 会 `writerToolsInFlight.current = 0`（重连守卫）。**新状态机没有对应的重连守卫**。
- **证据**：`useWorld.ts:311-313`（既有重连守卫只覆盖 footprint 计数）；`01 §6.4` 的状态机图无 `reconnect` 边；`01 §7` 边界表无此行。而 `01 §6.7:495` 自己写明这类失灵的后果是「玩家的输入**静默丢失**」——设计认知到了风险，却没给这条路径兜底。
- **后果**：`WriterBar` 的 `disabled={disabled || writing}` 永久为真（`§6.4:416`），placeholder 永远停在「作家正在写……」。玩家点不动、没有任何报错，且**刷新才能恢复**。
- **建议**：`useWorld.ts:311` 的 `ws.onopen` 里同时 `writerState.reset()`；并给 `writer-state.ts` 的 `idle` 迁入加一条「重连」边。同时 `01 §7` 表补一行。
- **可核验判据**：浏览器实测——`writing` 期间在 DevTools Network 里掐断 WS，重连后 `WriterBar` 必须解禁。

---

### P2-1 · `05` 的「服务端文案已进模型上下文，模型会解释」是未验证假设

- **位置**：`docs/perform/05 §7:448`、`§12.7:695`。
- **问题**：`show` 的 target 卡不在当前层时，设计选择**不演 + `console.warn`**，理由之一是「服务端已给出玩家可见的反馈（`show` 的返回文案进模型上下文，模型会在下一轮叙事里说明）」。这个链条有**两处没有机制保证**：① 模型是否真的复述；② 复述到玩家可见的通道（chalk）是否发生。`show.ts` 的返回文案（`show.ts:169-177`）只是给模型的 tool result——**不是玩家可见帧**。
- **证据**：`05 §3.4` 表把 `spotlight/camera_focus/ink_burst` 的「卡不在 DOM」定为「不演 + warn」；`05 §7:448` 的论证；`05 §12.7:695` 自己已把它列为待拍板。对照 `docs/tools/00:311`（`isError` 必须**可见**失败）——但这里失败发生在**前端渲染**而非工具调用，服务端确实成功返回了。
- **判定**：**已登记、非隐藏缺陷**，但论证不充分。建议在 `05` 明说「此路径玩家**可能完全无感**，可见性由模型自觉承担（无机制保证）」——不要写成「服务端文案已说」。若要求更强可见性，最小改法是 `cancelShow` 之外给 `WriterBar` 一条 `airp:` 提示（但那超出本批「零服务端改动」边界）。

### P2-2 · `05` 「`evidence_burst` 画在 `PerformanceLayer` 自己的 svg」与契约 §6 逐字冲突

- **位置**：`docs/perform/00 §6`（`:160`：「画在 `LinkLayer` 上」）↔ `docs/perform/05 §3.3:166`（「`PerformanceLayer` 内自己的 `<svg>`，**不进 `LinkLayer.registry`**」）。
- **问题**：两条断言都同意「只演不留/绝不写 `canvas.db`」（反模式 7 未违反），但**画在哪**相反。契约 §0 规定「本文件冻结的形状子文档 MUST NOT 自行改动，发现问题写进冲突节」。`05` 没有把这条写进它自己的 §11 冲突清单。
- **后果**：不是失败可见性问题，但影响「设计是否自洽」。实现者按契约 §6 去挂 `LinkLayer` 会撞上 `05` 的「不进 registry」纪律（那条纪律是对的——进 registry 会增加清理负担、且 registry 由 `[links]` 重建，演出线会被 `buildPaths` 抹掉）。**契约 §6 的措辞应回写**。
- **建议**：`06` 回写 `docs/perform/00 §6`？——不行，`00` 是冻结契约（`06 §4` 划界：`00` 不改）。故应由主 agent 在验收阶段**单开一节更正**并广播，或让 `05` 在 §11 补一条「与契约 §6 措辞冲突」。

### P2-3 · `01 §5:220` 的「grep `appendEvent` 零命中」是错的

- **位置**：`docs/perform/01 §5`（机械判据）。
- **问题**：`grep -c appendEvent apps/server/src/engine/event-bridge.ts` 实读 = **1**（`:265` 的**注释词**，非调用）。`01` 写「**零命中**（实读确认）」。对照 `04 §5:269` 写的是「仍为 1（`:265` 是注释词）」——`04` 是对的。
- **判定**：P3 级别的核验偏差，但它是「机械判据」，主 agent 会照着 grep 验收 → 会误判。**建议** `01` 改成与 `04` 同款措辞（`grep -c` = 1 且说明是注释）。

### P2-4 · `01`/`03` 对「幻影座位 = 成品座位」的断言互相矛盾

- **位置**：`docs/perform/01 §6.6:477`（「seat = 成品座位，与真实卡**叠在同一座位**」）↔ `docs/perform/03 §8.5:447`（「落地后若真实坐标与幻影不同（不同的 occupied 集合），按契约 §5 以**真实重取为准**」）。
- **问题**：`01` 声称**同一座位**（隐含：幻影 `seatSpiral` 与服务器 `seatUnplaced` 因同构常量必然一致）；`03` 承认**可能不同**（幻影的 `occupied` 集合 = 前端 `items` ∪ 幻影，服务器 `occupied` = 服务器视角的层卡）。两者不能同时为真。
- **证据**：幻影排座用前端本地 `items`（`03 §8.5:433-441`），服务器排座用 `seatUnplaced`（`packages/shared/src/store/local-store.ts:580-620`）——**两者输入集合不同**（前端 `items` 不含 `scene` README、不含未落盘卡；服务器含 `pageOfLayer` 的另一套）。常量同构（`apps/web/src/lib/seat.ts:11-13` vs `local-store.ts:21-23`）只保证**算法相同**，不保证**输入相同 ⇒ 输出相同**。
- **后果**：若两 `occupied` 不同，`chalk_landed → file_changed → fetchLayer` 后真实卡**跳位**到幻影座位之外；而 `01 §6.6` 声称「叠在同一座位」，实现者会据此**不做补偿**。这是一处「双真相源」隐患（契约 §5 要求「绝不出现内容到了但卡在别处」，这句话只对座位**拍板**，没写清不一致时谁赢——`03` 补了「真实重取为准」，`01` 没接）。
- **建议**：以 `03` 为准（真实坐标赢），并让 `01 §6.6` 的措辞降级为「期望同座；实际以重取为准，`reconcileLanded` 负责撤销幻影」。`01 §10.2` 判据 3 的「差 ≤1px」应改成「幻影节点消失 + 真实卡出现在符合服务器排座的位置」——否则判据会因这条未定的分歧而摇摆。

### P3-1 · `05` 未知 `component` 连 `console.warn` 都不打

- **位置**：`docs/perform/05 §3.2:148-149`、`§7` 表 S2。
- **判定**：**不违反反模式 6/3**（契约 §6 明令静默跳过）；但 `05 §7:446-450` 只在 S3 允许 warn。未知 id 是**版本错配信号**，与 `04 §7:346` 对「未知 kind → 可见 warn」的处理不一致。建议同构处理（warn 是开发者诊断，非玩家失败信号），成本 0。

---

## 3. 反模式清单逐条核（契约 §9）

| # | 反模式 | 判定 | 证据 / 说明 |
|---|---|---|---|
| 1 | 前端再造帧名常量 | **未违反** | 全部消费走 `case 'x'` 字面量（`01 §6.0`、`03 §6`、`04 §6.0`、`05 §3.1`）；无共享常量表。`check-ws-contract.mjs:124-134` 的正则也正是靠字面量。 |
| 2 | 在 `useWorld` 外再开 WS | **未违反** | 实读 `grep -rn "new WebSocket" apps/web/src/` → 唯一命中 `useWorld.ts:308`。各篇 `§6.0` 均声明遵守。 |
| 3 | `console.warn` 当失败可见 | **未违反（两处边界已论证）** | 幻影失败走**可见撤离**（`01 §7:506`、`03 §3.2 步5:163`、`03 §7:315-317`）；`03 §7:323` 明写「淡出 + 可见文字 + 玩家语言」三段。`04 §7:346-348` 的 warn 是**畸形帧诊断**且它**显式区分**「畸形（warn）vs 正常忽略（静默）」（`:356`），正确。`05 §7:446-452` 划清允许/禁止边界，正确（仅 P2-1/P3-1 的论证强度不足）。 |
| 4 | `writer_delta` 从 `text_delta` 喂 | **未违反** | 设计明确改掉：`01 §3.2:67-69`（writer `text_delta` → 不产帧）、`01 §9:545`。**独立复核见 §4——结论成立**。 |
| 5 | 幻影自行排座后与真实坐标打架 | **未违反（有一条未收敛的分歧）** | 契约 §5「落地时以真实重取为准」被 `03 §3.2 步2:160`（`land` 不传 `seat`）、`03 §8.5:447` 遵守。见 P2-4：`01` 与 `03` 对「是否同座」措辞冲突，但**两者都不主张幻影覆盖真实坐标**，故不构成反模式 5 的违反。 |
| 6 | `show_frame` 未知 component 抛错崩 | **未违反** | `05 §3.2 步2:148` 静默 `return false`；单测 `05 §10.3 #2-#4` 覆盖 `undefined`/非 string/落盘 kind。 |
| 7 | `evidence_burst` 写 `canvas.db` | **未违反** | `05 §5:363-372` 逐条对比 `link` 工具 vs `evidence_burst`，明写无数据、`durationMs` 后全撤；`packages/shared/src/actions/show.ts:64-71` 的 doc-comment + `packages/shared/test/components.test.mjs:245`（`assert.deepEqual(calls,{write:0,event:0,canvas:0})`，实读）锁死。 |
| 8 | 在 `canvas_patched` 里 `fetchLayer` | **未违反** | `04 §6.1` 的 case 内无 `fetchLayer`；`04 §10.2 判据 1'` 用「静态 grep case 体内无 `fetchLayer`」+「Network 面板 0 个 `/api/layer`」双重负向断言。**这是全批对反模式最硬的机械加固**。 |

---

## 4. 独立复核项（实读源码）

### 4.1 契约 §3 裁决 A（`writer_delta` 来源流）—— **确认成立**

逐条实读，与契约 §3.1 的 spike 一致：

1. **叙事正文 = `chalk` 工具参数**：`extensions/instructions.ts:74-79` 逐字「text that lives only in your reply never reaches the player, and the canvas stays empty」；`extensions/toolkit/chalk.ts:41-43` 的 `parameters.content` 是正文入口。✅
2. **两条车道来源必须不同**：`instructions.ts:74-79`（writer 用 chalk）+ `extensions/instructions.ts:168/174`（character「your words ARE the scene」）——已实读 `:168` 附近确认角色直接开口。✅（`01 §3.4` 表正确）
3. **RPC 剥 `partial`**：实读 `vendor/pi-rp/packages/coding-agent/dist/modes/json-event.js` 的 `toJsonEvent`——`const { partial: _partial, ...deltaEvent } = assistantMessageEvent;`，且 `rpc-mode.js:386` 调 `output(toJsonEvent(event))`。✅ **`partial` 确实不可用**。
4. **`toolcall_delta` 只有 `{type, contentIndex, delta}`**：`vendor/pi-rp/packages/ai/dist/types.d.ts:430-435` 的 `toolcall_delta` 定义带 `partial`，但被 3 剥掉。✅
5. **`toolcall_end.toolCall` 携带 `{id,name,arguments}`**：`types.d.ts:245-254` 的 `ToolCall` 接口（`id/name/arguments`）。`toJsonEvent` 只解构 `partial`，`toolCall` 原样保留。✅ 这是可靠的「事后确认工具名」锚点。
6. **时序**：`agent-loop.js:240-251`（`message_end` → 返回）在 `executeToolCalls`（`:269+`）之前 → `toolcall_*` 全部先于 `tool_execution_start`。✅ **契约 §3.1 item 2 成立，且这正是 P0-1 的根因。**
7. **`chalk` 参数以 `{"content":` 开头**：`chalk.ts:41-60` 的 `Type.Object({content, path?, link_to?, append_to?}, {additionalProperties:false})`——typebox 保声明序。✅ `01 §3.1` 拒绝前缀判定的论证（未来任何首参 `content` 的工具会误判）成立。

**推翻/风险**：`01 §3.1` 选延迟确认后，**没有处理延迟带来的时序反转**（P0-1）。这是本批最贵修正的**执行层漏洞**，不是裁决本身的错误。

### 4.2 「不落事件」断言 —— **自洽，成立**

- 实读 `grep -c appendEvent apps/server/src/engine/event-bridge.ts` = 1（`:265` **注释词**，非调用）；`EventBridge` 只调 `getEventsSince`/`getMaxSeq`（`:280`、`:318`）。✅ 演出帧不落账。
- `04 §5` 的机械判据「`packages/shared/src/actions/canvas.ts` 的 `appendEvent` 计数 = 0」——实读 `grep -c` = **0**。✅
- `02 §5` 的「事实已由 `rollDice` 落 `roll_resolved`」与 `03 §5` 的「`generate_image` 不落事件」均有出处。✅
- 各篇的「不落事件」断言（`01 §5`/`02 §5`/`03 §5`/`04 §5`/`05 §5`）**相互一致**，且与「演出帧 vs 世界事件」两通道模型（`docs/tools/00 §5.3`）一致。✅

### 4.3 `writer_idle` vs `writerToolsInFlight` 双真相源（契约 §6b-6）

- 实读 `useWorld.ts:113`（`writerToolsInFlight`）、`:259`（`isBusy: () => writerToolsInFlight.current > 0`）、`:360-369`（加减）。`01 §6.7` 的「单向蕴含」定案（`phase==='idle' ⇒ inFlight===0`）**方向正确**：`agent_settled` 在 finally 里发（`agent-session.js:1500`），必然晚于所有 `tool_end`。
- **但缺口在重连路径**（P1-2）：既有 `onopen` 守卫（`:311-313`）只重置计数，新状态机没有对应守卫 → 双向不变量在重连后**反向破裂**（`phase==='writing'` 而 `inFlight===0` 永久滞留）。
- **判定**：双真相源问题被 `01` 正确识别并给出不重叠职责，**但契约 §6b-6 要求的「不许各说各话」在重连这一条上没兑现**。

### 4.4 `phantom.ts` / `PerformanceLayer` 的临时 DOM 与 React 重渲染

- 契约 §5「数据先落，DOM 才是投影」被 `03 §3.3:177`（`PhantomLayer` 观察 `bg.src` → `evict`）落法实现，且 `03 §6:299` 明确**不进 `setState`**（避免每帧心跳重渲整棵画布树）。实读 `useWorld.ts:127-138` 的 `items` 数组身份变化确实会重渲 `Canvas`——设计规避正确。✅
- `03 §3.2 步7` 的兜底 `LANDED_DWELL_MS`（15s）保证「作家不写 `bg:`」时不永久占座。✅ 不静默。
- `05 §3.6` 的 `show_frame` **不进 React state**、计时器在模块态、`seq` 比对撤场——正确，且 `05 §3.6:243` 自己写明「写成 effect 会被 `items` 重取重置」。✅

### 4.5 `04` 的 `layer` 不匹配「整帧忽略」—— **判定：设计，不是隐藏 bug**

- **论证**：契约 §7 明令整帧忽略；`04 §3.1:133` 给出**具体且真实**的伤害链（跨层 dashed 会夺走 `refreshLinkArchives` 的 `.thread-latest`，致本层虚线被 `.thread-archived` 隐藏 `opacity:0 !important`）。这是**有具体故障模型**的静默忽略，而非「图省事」。
- **残余风险（可接受）**：若 `layerRef.current` 因 `enterLayer` 竞态而短暂陈旧，一条合法帧会被丢弃；但 `04 §11.1` 证明 `canvas.db-wal` 必然触发 `file_changed`（实读 `event-bridge.ts:365-377` 的忽略名单不含 `canvas.db`）→ 下一次 `fetchLayer` 兜底。**双通道互为兜底，是有意保留的特性**（`04 §11.1 第5点`）。✅
- **判定**：**设计**。若说隐藏 bug，只能是「WS 断线期间 `file_changed` 也断」——但那是 WS 通道本身的可用性，不是本帧的静默失败。`04` 已诚实登记（`§12.6` 跨通道竞态）。

### 4.6 `05` 未知 `show_frame component` 静默跳过 —— **判定：设计，不是隐藏 bug**

- **论证**：服务端**结构上**保证只广播 `SHOW_REGISTRY` 内的 id——`show.ts:83-90` 的 `if (!SHOW_REGISTRY[id] ...)` 抛 `unsupported`（实读 `packages/shared/test/components.test.mjs:246-250` 断言 `letter` 被拒），`event-bridge.ts:168` 的 `!event.isError` 门槛让失败帧**根本不发**。故前端收到未知 id 只能是**前后端版本错配**，此时「不演」是唯一不产生二次伤害的选择（`05 §3.2 步2:149`：抛错会让 `useWorld` 的 `catch` 吞掉同批其余帧，`useWorld.ts:387-389` 实读）。
- **对比**：这与 `04` 的 `layer` 忽略同源——**两者都是「正常流量不该 warn、畸形流量必须可见」的一半**。`05` 未给未知 id 加 warn（P3-1），但契约 §6 明确要求静默，故**不判定为隐藏 bug**。
- **判定**：**设计**。契约 §6 的「静默跳过」是纵深防御的正确形态；`docs/tools/10:389` 反对的是**服务端**「未知演出不报错」（那是骗模型），前端语义不同，`05 §7:452` 已把这个区分写死。

---

## 5. 失败路径可见性逐帧判定

| 帧 / 情形 | 判定 | 证据 |
|---|---|---|
| `01` 湿墨失败撒离（`tool_end.isError`） | **可见** | `01 §7:506` 淡出 + 右移 + `.ghost--evicting`；`01 §7:515` 给浏览器判据。但**P0-1/P1-1 会使「成功路径」本身静默失灵**（见 §2）。 |
| `01` `tool_end.isError` 无对应幻影（帧乱序） | **静默（已论证合理）** | `01 §7:507`：记 `evictOrphans`（测试可断言）+ 不抛错。有观测面，不是纯粹吞掉。 |
| `01` `chalk_landed` 无幻影（刷新后重连） | **静默（正路）** | `01 §7:508`：真实卡由 `file_changed` 带入。✅ |
| `01` `arguments.content` 非字符串/空 | **静默（合法叙事）** | `01 §7:509`：空正文是「世界的沉默」。服务端不产帧，前端空壳过户。✅ 判定合理。 |
| `03` 幻影失败淡出（`tool_end.isError`） | **可见**（泛化文案） | `03 §7:315` 淡出 + 可见原因 + `UI_COPY` 玩家语言；`03 §7:323` 三段。**`tool_end` 不带失败原因 → 只能泛化文案**：**可接受**，理由：① `event-bridge.ts:116-122` 实读确认只有 `isError` 布尔；② `doc-11 §7.1` 的 16 条精确文案若进帧需改 `docs/tools/12 §6.2` 冻结载荷（`03 §11 冲突5:574` 已给出二选一）；③ 泛化文案（"这次没能画出来"）在**不区分原因**时仍是**玩家可读且准确**的——它不说谎。**建议**：`03 §11 冲突5` 的选项②（`tool_end` 附 `details`）应作为**下一批**正式候选，因为「没配模型」与「审核拦截」对玩家的可操作含义不同。**本批接受泛化 = 记住这个缺口，不是消灭它**。 |
| `03` `<img>` 404（`asset_unreachable`） | **可见** | `03 §3.2 步5:163` + `§7:317`：`onError` → 可见封条。✅ |
| `03` `asset` 缺失/非 string | **静默（正确的保守）** | `03 §7:318`：不 `land`，保持 phantom，等超时兜底。✅ 不把 `undefined` 塞进 `<img>`。 |
| `03` 玩家生图期间切层 | **静默（正确）** | `03 §7:319`：别层幻影不渲染、注册表不清理。✅ |
| `02` 畸形 `dice_result` | **静默丢弃 + warn（调试用）** | `02 §7.2:307`：整帧丢弃 + `console.warn` 一次。**判定合理**：帧路径结构上无「玩家动作失败」（`event-bridge.ts:147` 的 `!isError` 门槛，实读），故无「失败可见」义务。 |
| `02` 仪式中切层 | **可见**（收场） | `02 §7.2:310`：监听 `currentLayer` → `onDone`。✅ |
| `02` 骰子音效未解锁 | **静默（已论证接受）** | `02 §7.3:314`：autoplay 策略无法在手势外 `unlock()`，接受视觉完整。✅ 诚实登记 `§12.4`。 |
| `04` `layer` 缺失 / 不匹配 | **静默忽略（设计）** | §4.5。 |
| `04` `kind` 缺失/未知 / `links` 非数组 | **可见 warn** | `04 §7:346-347`。✅ |
| `04` 单行 `id`/`path` 非字符串 | **可见 warn + 跳过该行** | `04 §7:348`：「一批里一条坏行不该吞掉其余」。✅ |
| `04` `kind:'cards'` 的 path 不在 `items` | **静默（正确）** | `04 §7:349`：scene README 单独返回、合法摆位。✅ 且给负向断言（判据 7）。 |
| `05` `target` 卡不在 DOM | **静默 + warn（S3）** | `05 §7:437`；见 P2-1（论证强度不足）。 |
| `05` 未知 component（S2） | **静默** | `05 §7:436`；见 §4.6 + P3-1。 |
| `05` `durationMs` 非法（S5） | **静默（可接受）** | `05 §7:439`：服务端已 clamp 到 ≥300，非法值 → `setTimeout` 当 0ms。**判定合理**（与服务端文案一致地短）。 |

**总纪律判定**：`04 §7:356` 与 `05 §7:446-450` 都显式定义了「畸形（可见）vs 正常忽略（静默）」的**分界原则**，这是本批最正确的失败哲学。缺的是 **P0-1/P1-1/P1-2 这三条落在「成功路径」上的静默失灵**——它们不在任何 `§7` 边界表里，因为作者把「成功路径」默认为不会失败。

---

## 6. 不能核验项 / 未通过项

1. **`01 §10.2` 的浏览器判据在本阶段无法核验**（未实现）。但可以静态指出：判据 1（壳出现）与判据 2（文字增长）**独立**，无法覆盖 P0-1 的顺序缺陷。**建议补一条联合断言**。
2. **「幻影座位与真实座位是否真的一致」无法静态核验**：需要跑一次真实 `chalk` 落盘，比对 `getBoundingClientRect()`。P2-4 只是指出 `01`/`03` 措辞矛盾，不断言哪边对。
3. **`01 §3.1` 的「前端从没消费过帧到达时刻」假设**：成立的前提是 `ChalkMark` 的本地计时器**独立于帧到达**。`01 §6.3:377` 声称如此，但我未读 `WriterInkLayer.tsx`（尚未创建），故标 `[未核验]`——若实现时把计时器绑到帧到达事件上，P0-1 的修复方案需重估。
4. **`02` 的 5s 去重窗口 / `03` 的 15s dwell 全是 `[推断]`**：设计自己标了。**是否该在实现前拍板**——**不必**（有合理机制理由且可后续调参），但 `02 §6.2` 的两个常量与 `03 §8.1` 的 `LANDED_DWELL_MS` 应在同一处集中定义以便整体调参。
5. **`05 §12.2`（`evidence_burst` 进世界变换层 vs 屏幕固定层）**：设计自己标为「本篇最需要拍板的一个取舍」。**该在实现前拍板**——因为它决定 `PerformanceLayer` 的挂点（`App.tsx` vs `Canvas.tsx`），而挂点又决定 §3.6 的「不进 React 重渲染子树」纪律是否成立。**不拍板就实现 = 大概率返工。**
6. **`01 §12.1`（`chalk_landed` 缺 `toolCallId` 时的多篇 chalk 定位歧义）**：**该在实现前拍板**。当前启发式「最早未落定 chalk 幻影」在「一个 turn 落多篇 chalk 且 `path` 缺失」时会**把 A 篇的落地过户到 B 篇的幻影上**——这是一条**静默错配**（不崩、无 warn、观感是「卡在错的位置落地然后跳走」）。成本极低的修法：给 `chalk_landed` 也加 `toolCallId`（`event-bridge.ts:134-146` 的 `toolArgsByCallId` 已有该 id 可用），但这会改 `docs/tools/12 §6.2` 载荷（属 `06` 回写范围）。**建议本批就加**，否则留一条已知静默错配。
7. **`05 §12.4`（`fireworks.params.origin` 格式无定义）**：`docs/tools/10:733` 只说「`origin?`」。**该在实现前拍板**——作家猜错格式就演不出来，且服务端不校验格式（只有 zod `z.string()`）。建议冻结为 `"<0..1>,<0..1>"`。

---

## 7. 给主 agent 的最小回写清单（按优先级）

1. **P0**：`01` 补「`writer_delta` 早于 `chalk_writing`」的消费协议（缓冲或改发射点），并把 `§10.2` 判据改成**联合顺序断言**。
2. **P1**：`01 §3.2.1` 兜底改替换语义（`setInk`/`mode:'replace'` 或 `slice(prev.length)` + `startsWith` 守卫），补服务端拼接单测。
3. **P1**：`01 §6.4` 状态机补「WS 重连 → `reset()`」边；`useWorld.ts:311` 的 `onopen` 同步锚。
4. **P1（建议本批）**：`chalk_landed` 加 `toolCallId`（消灭 §6.6 的多篇 chalk 静默错配）。
5. **P2**：`05` 补「与契约 §6 的 `evidence_burst` 画法冲突」到 §11；`01 §5` 的 grep 断言改成与 `04` 同款措辞；`01 §6.6` 的「同一座位」措辞与 `03` 对齐。
6. **拍板**：`05 §12.2`（变换层归属）、`05 §12.4`（`origin` 格式）。
