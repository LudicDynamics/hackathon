# recon：world command × canvas arranger 交叉判定

> 状态：**复核报告（recon，2026-09-15）**，基线 `9af9c9b`（设计文档定稿点）→ HEAD `50dd228`（88 个提交之后）。
> 触发问题：`docs/command/` 全部 21 份文档对 `arrangeCanvas` / `canvas-arranger` / `functional` **零命中**（本机实测 `grep -rn` 于 `docs/command/*.md` = 0 命中），而 canvas arranger 已是一套真实系统。
> 本文**不是设计文档**，不改任何设计；它只做**交叉判定**并**指认该改哪份文档的哪一节**（由主 agent 分配）。所有结论带 `file:line`；`[推断]` 只用于显式标注的推理链。

---

## 0. 结论（先给答案）

**存在 5 个真实交点，其中 2 个「需契约补充」、2 个「真交叉且已实质冲突」、1 个「真交叉但已由现有设计覆盖，只需登记」。**

一句话：**arranger 不改世界文件、不落 `WORLD_EVENT_TYPES` 里的事件、不经 `on` / 命令执行路径，因此它不侵入命令的*执行*语义；但它同时修改了命令赖以生效的*三处共同契约*——`ActorType`、`ActionErrorCode`、`ACTION_METHODS`——而这三处正是 `00`/`04` 逐字冻结的封闭集合。文档里的「18 值」「26 项」「5 个 actor」现在是**错的**，这才是需要改的东西。**

---

## 1. 交叉点清单

### 交叉点 1 —— `ActorType` 从 5 值变 6 值，新增 `functional`

| 事实 | `file:line` |
|---|---|
| `ActorType` 含 `'functional'` | `packages/shared/src/actions/actor.ts:8` |
| 注释逐字改为「character carries its id; functional carries only canvas-arranger」 | `packages/shared/src/actions/actor.ts:11` |
| 新增两个导出常量 | `packages/shared/src/actions/actor.ts:18-19` |
| `ActorTypeSchema` 同步为 6 值 | `packages/shared/src/schemas/events.ts:30` |
| 事件渲染器有 `functional` 分支（「The canvas arranger」） | `packages/shared/src/render/events.ts:151-152` |
| **查无命中**：命令文档里对 `ActorType` 的唯一列举 | `docs/command/02-触发与绑定.md:215`（写 `'player'\|'god'\|'writer'\|'character'\|'engine'` 五值） |

**判定：真交叉（已实质失效）。**
`02 §2.5` 的 `trigger.actor` 行把 actor 全集写成五值，而现状是六值。命令的 actor 口径本身（`00 §5.1`「actor = 触发者」、`07 §12.2`「只有 writer/initializer 能写命令」）**不受威胁**——`functional` 进程（`apps/server/src/engine/launch.ts:267`）用 `--tools view_canvas,screenshot_canvas,arrange_canvas` 且 `--extension` 只加载 `extensions/canvas-arranger.ts`（`launch.ts:236,262-263`），**拿不到 `write`/`edit`/`bash`**，因此**物理上写不了命令文件、也触发不了任何 `on`**。所以这是**枚举漂移**，不是语义冲突。
→ **该改**：`docs/command/02-触发与绑定.md:215`（`trigger.actor` 行的值集）。
→ 附带：`docs/command/00-共同上下文.md §5.1` 若要列举 actor 全集，同样要补第 6 值。

### 交叉点 2 —— `ActionErrorCode` 从 18 值变 19 值，新增 `conflict`

| 事实 | `file:line` |
|---|---|
| `'conflict' // optimistic canvas/version or snapshot fence failed` | `packages/shared/src/actions/errors.ts:18` |
| `HTTP_STATUS.conflict = 409` | `packages/shared/src/actions/errors.ts:31` |
| 唯一抛 `conflict` 的**动作层**位置 | `packages/shared/src/actions/canvas.ts:460`（`arrangeCanvas` 的 snapshot/version fence） |
| 另两处 `conflict` 在渲染/快照层，非动作层 | `packages/shared/src/render/canvas-snapshot.ts:379,466` |
| `arrangeCards` 的 `applyCanvasPositions` 也抛 `conflict`（版本 fence） | `packages/shared/src/store/local-store.ts:1392-1428`、`:1590-1595` |
| `conflict` 已在 web 的 `CONFLICT_CODES` 里 | `apps/web/src/lib/action-feedback.ts:103` |
| **查无命中**：全部命令文档写「18 值封闭 union、不新增」 | `docs/command/04-效果原语集.md:899-901`、`:917`；`00-共同上下文.md:829,1037` |

**判定：真交叉（已实质失效），且是本次最需要修的一处。**
`04 §6.3` 逐字写「`ActionErrorCode` 是 **18 值**封闭 union（`errors.ts:3-21`）」，`00 §11` 两处断言「是 18 个，不是 17/19」。现状是 **19 值**（`errors.ts:3-22`），且 `HTTP_STATUS` 也加了一行（`:24-45`）。
**关键判定：`conflict` 不打破 `04` 的「不新增错误码」承诺 —— 它是别人（arranger）新增的，命令效果一个都用不到。** 证据：

- 七个效果只映射到 4 个动作方法 + 1 个附属（`docs/command/04-效果原语集.md:1223-1227`）：`give→createEntity`、`move→moveEntity`、`edit/set_status/consume→editEntity`、`enter→enterLayer`、`link→linkCards`。
- 这五个动作方法里**没有任何一个**能抛 `conflict`：`create.ts` / `delete.ts`（`editEntity` 所在）/ `move.ts` / `layer.ts` 实测 `grep conflict` **零命中**；`canvas.ts` 里抛 `conflict` 的是 `arrangeCanvas`（`:460`）与快照读取，`linkCards`（`:210-314`）不抛。
- 命令触发路径的三条入口（`runDeclaredRoll` / `runDeclaredChoice` / `useItemOn`）实测 `grep conflict` **零命中**。

⇒ `04 §6.3` 的**论证仍然成立**（效果失败仍精确映射到既有码），只是**基数写错了**：18 → 19。
→ **该改**：`docs/command/04-效果原语集.md:901`、`:917`（18 → 19，`errors.ts:3-21` → `:3-22`）；`docs/command/00-共同上下文.md:829`、`:1037`（「18 个」→「19 个」）；`docs/command/01-命令文件与schema.md:595`（已写 19，但行段 `:3-21` 要改 `:3-22`）；`docs/command/02-触发与绑定.md:801`（行段 `:3-25` → `:3-26`，已在 drift 清单 #8）。

### 交叉点 3 —— `ACTION_METHODS` 从 26 项变 27 项，新增 `arrangeCanvas`

| 事实 | `file:line` |
|---|---|
| `arrangeCanvas(input)` 在 `ActionService` 接口里 | `packages/shared/src/actions/service.ts:58-59` |
| `ACTION_METHODS` 元组含 `'arrangeCanvas'` | `packages/shared/src/actions/service.ts:97` |
| 测试断言已是 27 | `packages/shared/test/wiring.test.mjs:48` |
| 实现带**专门的 actor/scope 门禁** | `packages/shared/src/actions/canvas.ts:433-435` |
| **查无命中**：`04` 写「26 项」与「不新增方法」 | `docs/command/04-效果原语集.md:16,18,21,588,1095-1103,1184,1191` |

**判定：真交叉（已实质失效），但 `04` 的核心论证不变。**
`04` 的三处数字（`service.ts:80-107` 26 项、`4+1+21=26`、`26 → 26`）在 HEAD 全错：现在是 **27 项**，分类变成 **4+1+22=27**（`arrangeCanvas` 落入「拒绝」组，理由同 `arrangeCards`：不落事件 → 违反硬门 1）。
**`04` 的结论（不为 `consume` 新增方法）依然成立**——`arrangeCanvas` 不是命令新增的，是 arranger 新增的；但 `04 §3.6` 第 6 行的「测试常量断言 26 → 改 27」现在是**误导**：基线已是 27，新加会是 28。
→ **该改**：`docs/command/04-效果原语集.md:16,18,21,588,591,593,1184`（26 → 27，`service.ts:80-107` → `:81-109`，`len===26` → `27`）。

### 交叉点 4 —— 二者共享 `createActionService`，但**不共享**事件与画布写入

| 事实 | `file:line` |
|---|---|
| arranger 也走 `createActionService` | `extensions/toolkit/arrange-canvas.ts:71-75`；`extensions/canvas-arranger.ts:34` |
| `createActionService` 的共享契约注释逐字「the single action entry point shared by the server routes and the agent extension tools」 | `packages/shared/src/actions/service.ts:9-13` |
| **命令的效果不落 arranger 的事件**：`arrangeCanvas` 在 canvas 内不调 `appendEvent`（实测该方法体 `canvas.ts:429-481` 无 `appendEvent`） | `packages/shared/src/actions/canvas.ts:429-481` |
| 铺位/落座由 `seatUnplaced` / `seatNear` 惰性完成，**不 bump `position_version`** | `packages/shared/src/store/local-store.ts:981-1051`、`:1016-1045` 无 `UPDATE canvas_meta`；bump 只在 `:1538,1643,1667,1691` |
| arranger 的运行信号**不进世界事件表**，走 `eventSink → emitEngine → WS` | `apps/server/src/engine/canvas-arranger-lifecycle.ts:255`；`apps/server/src/index.ts:73`；`apps/server/src/engine/event-bridge.ts:454-467` |
| 15 个 `WORLD_EVENT_TYPES` **未变** | `packages/shared/src/schemas/events.ts:9-25`（15 项，与 `docs/command/06:1127` 一致） |

**判定：真交叉，但**已被现有设计覆盖，只需登记 —— 且这是「不需要新契约」的正面证据**。
- **事件面**：arranger **不写 `WORLD_EVENT_TYPES` 事件**，它写的是 WS 运行帧（`canvas-arranger-lifecycle.ts:31,39-40` 的 `CanvasArrangerRuntimeSignal`）。因此 `06 §7` 的失败态映射、`05` 的幂等、`10` 的注入**都不受影响**。
- **`detail.command` 键冲突**：**不冲突**。`100`/`08 §11.1` 定 `detail.command = '<id>'` 只出现在命令效果落的事件 detail 上；arranger 不落这类事件，因此没有第二方写这个键。
- **画布并发**：`arrangeCanvas` 的 fence 是 `(expectedCanvasVersion, snapshotId)`（`canvas.ts:456-468`），而命令的 `move` 只经 `seatUnplaced` 插行、**不动 `position_version`**。所以严格说：**一条 `move` 命令在 arranger 读快照与提交之间落座了一张新卡，不会让 `expectedCanvasVersion` 失配，但会让 `snapshotId`/`canvasRevision` 变化**（`canvasRevision` 的输入含 `rows`，`packages/shared/src/render/canvas-snapshot.ts:256-295`；`snapshotId` 含 `canvasRevision`，`:337-355`）。arranger 的应对是**已实现的**：`canvas.ts:456-468` 抛 `conflict`，生命周期再以 `conflict` outcome 收敛（`canvas-arranger-lifecycle.ts:347,360,364,368,388`），前端映射到 `conflict` 相（`apps/web/src/components/chrome/CanvasArrangeControl.tsx:31,52`）。
  ⇒ **不需要新契约**：arranger 已经 fail-closed 且可见。`[推断]` 这只是「两条正交写路径共用一张 SQLite 表」，双方各自有 fence，无共享状态需要协商。

### 交叉点 5 —— Lock / 并发：命令侧**没有**画布级锁，arranger 的世界级串行是它自己的

| 事实 | `file:line` |
|---|---|
| arranger 有**按 world 的在飞互斥**（`inFlightByWorld`，同 world 第二个请求复用或 409） | `apps/server/src/engine/canvas-arranger-lifecycle.ts:121,139-144`；`apps/server/src/routes/canvas-arranger.ts:40,54` |
| 命令的降级锁是 `serialDeclared`（模块级 Map，server engine 层，只盖两条路由） | `apps/server/src/engine/declared-actions.ts:159-162`（`origin/niko`）；`07 §12.2` 已登记它在动作层用不上 |
| 画布写入的串行来自 SQLite 事务与 `withSeatLock` | `packages/shared/src/store/local-store.ts:983`（seat）、`:1390,1587,1662,1684`（`BEGIN IMMEDIATE`） |
| 命令的幂等真相源**尚未落地**（`packages/shared/src/commands/` 不存在） | `05-幂等与复访.md` 的设计；`ls packages/shared/src/commands` → 无此目录 |

**判定：真交叉，但**不构成新的契约缺口**；是 `05` 已登记风险的一个新实例。**
**谁赢**：arranger 与命令**不同时改同一行**——arranger 只改 `cards.x/y`（`local-store.ts:1529`），命令的 `move` 改 `cards.id/layer` 与插新行（`:1805`、`:1029-1043`）。SQLite `BEGIN IMMEDIATE` 让二者串行；**冲突以后提交者的 fence 为准**（arranger 抛 `conflict` 让玩家重试；命令不检查 fence、直接生效）。因此**顺序保证仍成立**：命令不依赖画布快照，arranger 依赖且 fail-closed。
→ **该改**：**不需要改**。建议在 `05-幂等与复访.md` 的「仍未知 / 已登记风险」节**加一行**，说明「画布坐标写入由 arranger 独占语义，命令不经画布 fence」——这是一条**边界登记**，不是新机制。

---

## 2. 逐点判定汇总

| # | 交叉点 | 判定 | 动作 |
|---|---|---|---|
| 1 | `ActorType` 6 值 / `trigger.actor` 五值 | **真交叉**（枚举失效） | 改 `02:215` |
| 2 | `ActionErrorCode` 19 值 / 文档写 18 | **真交叉**（基数失效，论证仍成立） | 改 `04:901,917`、`00:829,1037`、`01:595`、`02:801` |
| 3 | `ACTION_METHODS` 27 项 / 文档写 26 | **真交叉**（基数失效，论证仍成立） | 改 `04:16,18,21,588,591,593,1184` |
| 4 | 共享 `createActionService`、事件与 `detail.command` | **伪交叉**（无冲突，已 fail-closed 覆盖） | 仅登记（本报告即证据） |
| 5 | Lock / 并发胜负与顺序保证 | **伪交叉**（串行 + 各自 fence，顺序不变） | 建议 `05` 加一行边界登记 |

---

## 3. 明确的「不需要新一节」论证（回应任务书的原始问题）

任务书问：**设计文档是否需要新增一节处理 arranger？**

**答：不需要新增一节。** 理由有三条，每条可核：

1. **能力面正交**。命令是「作者声明的、跟随世界的规则」（`docs/command/00 §3.2` 的分界表）；arranger 是「玩家点「整理」时的一次性画布维护」，它**明确被禁止**改世界文件、叙事文本、frontmatter、玩法、presence、Writer 状态与连线（`apps/server/src/engine/canvas-arranger-lifecycle.ts:105` 逐字）。二者的**产品面不重叠**。
2. **写入面不重叠**。arranger 的工具集是白名单三项且**没有 `write`/`edit`/`bash`**（`apps/server/src/engine/launch.ts:260-261`；`presets/canvas-arranger.json` 的 `tools.allow`），扩展面是隔离的单文件（`extensions/canvas-arranger.ts:1-7,52-62`；`apps/server/src/engine/presets.ts:135` 的 `ISOLATED_EXTENSIONS`）。它**写不了命令文件**，因此 `07` 的 T1/T2/T4 三道写入门禁对它**天然无操作**；`07 §12.2` 的身份门禁（writer/initializer 专属）也不覆盖 `functional` scope（`packages/shared/src/actions/actor.ts:19` 的 `functional-canvas-arranger`）——`[推断]` 若将来 arranger 被允许 `write`，`07 §12.2` 的判据「`agentScope ∉ {writer-top-level, initializer}`」会**自动 block 它**（fail-closed，方向正确）。
3. **锚定的是三个封闭集合，不是一节设计**。真正需要改的是 `00`/`04` 里三个**基数**（actor 6 / 错误码 19 / 方法 27），以及 `02:215` 的一行值集。这些是**替换数字**，不是新增章节。

**唯一「值得写下来」的语义增量**（`MAY`，非 `MUST`）：`04 §6.3` 在把 18 改成 19 时，**顺手加一句**说明 `conflict` 的归属——「该码由 canvas arranger（`canvas.ts:460`）拥有，七个命令效果**不会**产生它」。这句话把「基数变了」和「我们的论证没变」两件事分开，避免下一个读者看到 19 就以为 `04` 的冻结承诺被打破。

---

## 4. 越界发现（不在本任务目标内，交给主 agent 分配）

> 本节登记**不属于**本次「07/08 常规引用核实 + arranger 专项」范围、但复核途中实测确认的其它文档问题。按任务书的边界纪律，我只登记、不越界改。

1. **`08 §7.1` 表格的 `origin/niko` 行号整体不可核**（`08:658`、`:722-726`）。原引 `declared-actions.ts:167` / `:137` / `:154-155` / `:183,188` / `:198` / `:190` / `:948` / `:950` 对 `origin/niko` 的**任何** tip 都不成立（实测：`origin/niko` tip = `1ca45cb`，`runDeclaredRoll(serviceFor` 在 `:1190`、`await svc.createEntity` 在 `:460`、`2d10 >=11` 在 `:437`、`value.length !== 4` 在 `:400`、`getEventsSince(0)` 在 `:181,453,458`、`resolved-dice` 在 `:468`、`actor:` 三元在 `:1188`）。**这不是本批 88 提交造成的漂移**——`world.ts:950` 只在 `e4a139a`（2026-09-14 01:30）成立，而本文写于 13:23 之后。已在本批就近改为双记法，但**这条误引的根因值得记一笔**：引 `origin/niko` 时应连**分支 tip 的 7 位短 hash** 一起引，否则下次仍然对不上。
2. **`08:846` 的路径是错的，且与本批无关**：`packages/shared/src/inject/render/events.ts` **在任何提交里都不存在**（`9af9c9b` 与 HEAD 都没有；实际文件是 `packages/shared/src/render/events.ts`）。同段的 `:60-71`（`MERGE_EXEMPT`）与 `:346-365`（跨 type 规则）在 `render/events.ts` 语义成立但现在分别位于 `:63-71` 与 `:536-560`。已就地纠正。
3. **`04` 的「26 项」类断言散布在 7 处以上**（`:16,18,21,588,591,593,1184,1195`），且 `:584` 的 `service.ts:80-107` 与 `:591` 的「现状已是 26」是同一事实的两处复述——**同一个数字写七遍**正是 `doc-23 §2.9` 点名的那种第二真相源。建议 `04` 收口时把基数**只留一处定义**，其余处引用它。
4. **`docs/command/*.md` 全 21 份对 `concurrency` 面的画布写入零登记**：`05` 的锁章节只讨论 `serialDeclared` 与命令自身的幂等，未登记「画布坐标是另一条写路径」。这是交叉点 5 建议的登记落点。

---

## 5. 已核实的「不可核」项（如实标注）

| 引用 | 状态 |
|---|---|
| `vendor/pi-rp/**`（`07` 的 `:92/:194/:196/:359/:360/:404/:434/:615/:667/:1027`） | **子模块已 checkout**，可直接读工作树；`vendor/pi-rp` 当前 `7ed965c1f`。逐处实测**全部一致**（`types.ts:1173-1175,1191-1196,959-962`、`agent-loop.ts:617-618,636-646,760-763`、`edit-diff.ts:33-45,206-233,332-334,350-356`、`bash.ts:41-44,90-107`、`edit.ts:105-129,313`、`read.ts:404`、`slot-renderers.ts:114-120`、`agent-session.ts:795`）。**这些不是漂移**——子模块 vendor 由一个独立 pin 固定，不随本仓 88 个提交推进。 |
| `origin/niko:tools/direct-world-actions.test.mjs:128-147` | 未核（本次范围外） |
| `docs/worlds/七世界双语模板与归档.md:33,35` | 未核（本次范围外） |

---

## 6. 复核方法（可复现）

```bash
# 交叉点 1 / 2 / 3 的机械证据
git grep -n "'functional'" HEAD -- packages/shared/src/actions/actor.ts packages/shared/src/schemas/events.ts
git grep -n "'conflict'" HEAD -- packages/shared/src/actions/errors.ts
git grep -n "arrangeCanvas" HEAD -- packages/shared/src/actions/service.ts
sed -n '48p' packages/shared/test/wiring.test.mjs    # assert.equal(ACTION_METHODS.length, 27)

# 交叉点 4：命令效果不会遇到 conflict
git grep -n "conflict" HEAD -- packages/shared/src/actions/create.ts \
  packages/shared/src/actions/delete.ts packages/shared/src/actions/move.ts \
  packages/shared/src/actions/layer.ts packages/shared/src/actions/roll-dice.ts
# → 零命中

# 交叉点 5：命令的 move 不动 position_version
git grep -n "UPDATE canvas_meta SET position_version" HEAD -- packages/shared/src/store/local-store.ts
# → 1538,1643,1667,1691，均不在 seatUnplaced/seatNear 的路径上

# 零命中复核（任务书 #6）
git grep -n "arrangeCanvas\|canvas-arranger\|functional" HEAD -- docs/command/
# → 零命中
```
