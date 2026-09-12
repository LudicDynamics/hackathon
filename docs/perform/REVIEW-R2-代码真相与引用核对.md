# docs/perform/REVIEW-R2 — 代码真相与引用核对（只读）

> 评审者：`ReviewR2CodeTruth`。日期 2026-09-13。**只读评审**：除本文件外未改动任何文件（spike 脚本在 `/tmp`，未入库）。
> 范围：6 篇设计文档 + 冻结契约 `00` 引用的每一个符号 / 行号 / 载荷是否与仓库实际一致；契约 §3 的 spike 结论**独立实测**。
> 方法：`read`/`grep` 逐条实读；契约 §3 用自建 harness + 确定性 provider 跑参数矩阵（§3）。

---

## 1. 结论

**需回写后再放行（P1 级）。**

- **契约 §3（本批最贵的一条）成立**：`writer_delta` 现状映射 `text_delta` 是错的；叙事正文确实走 `chalk` 的 `content` 参数流。我用 6 组剧本独立复现了三处 spike 的全部关键事实（§3）。
- **本批所有「服务端已存在」的断言逐条实读为真**：`event-bridge.ts` 的 9 个发射点、`dice_result`/`canvas_patched`/`show_frame`/`image_*` 的载荷、`show.ts` 的 clamp、`performances.ts` 的 7 项参数表、`generate-image.ts` 的 `onUpdate` 心跳与 watcher 忽略项、`LinkLayer` 的三缺口 —— 全部与设计一致（§4 对照表）。
- **但有 4 类必须在实现前修掉**：
  1. **P1 跨篇冻结签名不一致**：`PhantomLandPayload` / `register` 合并语义，`01` 与 `03` 各自声称「逐字引用对方」而实际不同（F-1/F-2）。
  2. **P1 悬空符号 5 处**，其中 `nextInkSeat`（`01:242`）、`TUMBLE_ROT`（`02:162`）、`ShowCtx`/`renderActiveShow`+`§10.3` 的 8 个纯函数（`05`）会让实现者写出编译不过的代码（F-3…F-6）。
  3. **P2 `world.ts` 两套行号基线**：`02` 用工作树、`03`/`04` 用 `HEAD`，相差 145 行；且评审期间它又漂了 8 行（F-7）。
  4. **P1 契约级事实错误（F-13）**：契约 §3.1 item 3 / §3.2 item 2 把「`chalk` 参数以 `{"content":` 开头」当作**可依赖的判据**；实测带 `path` 的 `chalk` 以 `{"path":` 开头，与 `write` **逐字不可区分**。`01` 恰好选了安全的「延迟确认」，故**不阻断**；但契约文本必须改——否则下一个 agent 会去实现「乐观流」。

---

## 2. Findings

### F-1 · **P1** · `01 §6.2:299-307` vs `03 §2.5:120`

- **问题**：跨篇冻结类型 `PhantomLandPayload` 两处不一致。
  - `01:300-307`：`{ path?, asset?, mimeType?, width?, height?, reused? }` —— **无 `seat?`**。
  - `03:120`：同上 **多 `seat?: PhantomSeat`**。
  - `03 §2.5:100`「`01` 经 `hub` 回执的冻结签名（本文逐字引用；`01` 篇为准）」；`01 §6.2:252`「本批冻结签名」。两份都自称权威。
- **证据**：实读两处行区间。`03 §3.2 步 2:160`、`§2.5:122` 又要求「不传 `seat`」——故 `seat?` 与两篇的行为约定**自相矛盾**。
- **建议**：以 `01` 为准删掉 `03` 的 `seat?`（`land` 的语义就是「座位不变」，`seat?` 是能被误用的口子）。若 `03` 要保留给将来，`01` 必须同步并写明「本批恒不传」。**必须择一**，否则 `03` 实现者会写出重排路径，直接违反契约 §5。

### F-2 · **P2** · `01 §6.2:341-344` vs `03 §2.5:121`

- **问题**：`register` 幂等合并的**字段集**两处不同。
  - `01:344`：二次 `register` 只更新「`init` 本次给了值的字段（`label` / `elapsedMs` / `layer` / `path`）」。
  - `03:121`：`// 幂等合并：已存在则只更新 label/elapsedMs`。
- **证据**：实读两行。`layer`/`path` 能否被心跳帧（每 10s 一条）二次覆盖，是真实行为差异。
- **建议**：统一为 `01` 的「给了值才更新」（`03` 心跳恒不传 `layer`，行为等价，但契约必须唯一）。另：契约 §8（`00:197`）的 `register(toolCallId, {kind, path?, seat})` **完全没有 `label/elapsedMs/layer`** —— `01 §11.6:613` 已请主 agent 补，**应在实现前拍板并广播**，否则 `GhostCard` 读不到 `label`/`elapsedMs`。

### F-3 · **P1** · `01 §6.1:242`

- **问题**：`seat: nextInkSeat(stateRef.current),` —— **`nextInkSeat` 全仓不存在**，且实参类型（`LayerState | null`）与 `seatSpiral(anchor, occupied: Box[], w, h)` 不兼容。
- **证据**：`grep -rl nextInkSeat apps/web/src apps/server/src packages/shared/src extensions` → 零命中。`apps/web/src/lib/seat.ts` 只导出 `SEAT_ANCHOR:11`/`SEAT_STEP:12`/`SEAT_MAX_CANDIDATES:13`/`seatSpiral:48`。`stateRef.current` 为 `LayerState | null`（`useWorld.ts:103`）。
- **建议**：改写为显式 `seatSpiral(SEAT_ANCHOR, occupied, w, h)`（`01 §6.1:247` 正文已如此描述，仅代码块悬空）。**更建议**把该块收敛到 `03 §8.5` 的 `phantomSeatFor` 同一实现——现在 `01` 自算座、`03` 也算座，正是契约 §5「不得各写一份」的反面。

### F-4 · **P1** · `02 §3.2:162`、`§8:335`、`§11.3:517`

- **问题**：`TUMBLE_ROT` 被列为本篇要从 `DiceRoller.tsx` export 的常量；**源码无此常量**。
- **证据**：`grep -rn TUMBLE_ROT apps/web/src` → 零命中。`DiceRoller.tsx` 模块级常量仅 `CHARGE_MS:16`/`TAP_MS:17`/`AUTO_FILL_MS:18`/`ROLL_MS:19`/`SETTLE_MS:20`/`IDLE_TILT:21`/`FACES:23`。翻滚是 `rollDie` 内联的 `setRotation({x: 1080 + Math.floor(Math.random()*4)*90, …})`（`:167-171`），**未具名**。
- **建议**：从三处删掉 `TUMBLE_ROT`。`§8:344` 的 import 行（`ROLL_MS`/`SETTLE_MS`/`FACES`）**本身是对的**——悬空只在正文描述，但会让「本篇唯一既有文件改动」清单（`§11.3`）失真。

### F-5 · **P2** · `03 §6:256,276-277`

- **问题**：`asNum(...)` 用了 3 次，**从未定义**，`03 §8` 也没给签名。
- **证据**：`grep -rl asNum apps/web/src apps/server/src packages/shared/src` → 零命中；`03 §8.1` 只定义了 `ghostSizeFor`/`stageText`/`ghostVisibleOn` 与常量。
- **建议**：在 `§8.1` 补 `export function asNum(v: unknown): number | undefined`。

### F-6 · **P2** · `05 §6.3:419`、`§8.1:481`、`§10.3:590-607`

- **问题**：`renderActiveShow(show, camera)` 与 `ShowCtx` **从未定义**；`§10.3` 的单测表还引用了 8 个同样未给签名的纯函数：`resolveShowKind`/`evidenceLinks`/`clampBursts`/`clampStagger`/`spotlightDim`/`lightsOutDim`/`zoomOf`/`inkToneOf`。
- **证据**：`grep -rl "ShowCtx\|renderActiveShow" apps/web/src` → 零命中。`05 §8`（§8.1–§8.5）只给了 4 个模块态导出 + 7 个 `showXxx` 渲染函数 + `SHOW_RENDERERS` + `handDrawnPath`/`cardGeometry`，**没有**这 8 个 helper 的签名。它们只出现在 `§10.3:590-607` 的断言表与 `§4.1:276` 的可选模块讨论。
- **后果**：`§10.3` 的 `node --test` 引用不存在的导出 → 验收清单里的硬条目无法落地；`§8.1` 与 `§10.3` 对不上。
- **建议**：`§8` 补一节「纯 helper 的导出面」（8 个函数签名 + 归属模块），或把 `§10.3` 断言收窄到已定义符号。`01`/`03`/`04` 的 `§8` 都做到了，只有 `05` 漏。

### F-7 · **P2** · `03 §2.4:96`、`04 §2.2:99`、`§8.4:392`、`§11.1:470`

- **问题**：同一批文档对 `apps/server/src/routes/world.ts` 用了**两套行号基线**。
  - `02` 用**工作树**：`/dice` @ `:826`、无帧注释 @ `:825` —— 实读**正确**（WT `:825-826`）。
  - `03` 用 **`git HEAD`**：`/api/asset` @ `:879-893`（WT 实为 `:1024-1037`；HEAD 恰为 `:879-893`）。
  - `04` 用 **`git HEAD`**：links 查询 `:495-504`（WT `:619-629`）、`/layer` `:374-515`（WT `:498-639`）、`seatUnplaced/reseatLayer` `:413-427`（WT `:537-551`）、scene 分支 `:450-467`（WT `:574-591`）、`card_position` broadcast `:611`（WT `:735`）、`/backpack` `:649`（WT `:773`）。
- **证据**：`git show HEAD:apps/server/src/routes/world.ts | wc -l` = **931**；工作树 = **1076**（差 145 行，来自本批外的 nook 改动）。逐条 `sed -n` 比对如上。
- **后果**：不阻断（都有语义锚），但实现者按行号跳转会读到无关代码——`04 §8.4`（「改哪一行 SQL」）最需要精确。
- **复核期再次漂移（评审过程中观测到）**：本报告开写时 WT = **1076** 行、links 查询 `:619-629`、`/asset` `:1024`、`card_position` broadcast `:735`、`/dice` `:826`；**结束时** WT = **1084** 行、links 查询 `:620`、`/asset` `:1032`、`card_position` broadcast `:743`、`/dice` `:834`。**同一会话内 `world.ts` 被并行批次改了两次**（`git status` 显示 `world.ts`/`App.tsx`/`index.css` 都在 M 列表，属 TTS/nook 批次）。这不是本篇的缺陷，但它把 F-7 的结论从「行号选错了基线」升级为**「`world.ts` 的行号在本批并行期间本质不可用」**——`03`/`04` 的实现者必须用 `grep -n` 语义锚定位，`06` 的回写**不应**填入行号。
- **建议**：`06` 回写时按其自立纪律（`06:92`「行号是二手真相」）把 `03`/`04` 的 `world.ts` 行号统一为当前工作树值，或每条附 `grep -n` 定位命令。

### F-8 · **P2** · `05 §3.4:180`、`§3.7:248`、`00 §2.3:62`

- **问题**：三处锚点指错源码位置。
  - `05:180`「卡片 DOM 钩子 `data-path`（`CanvasObject.tsx:125`）」—— 实读 `data-path` 在 **`:203`**（`:125` 在 `PortraitFig` 内）。
  - `05:248`「`motion.ts:28-36` 的 `useStill()`，**`Canvas.tsx:123` 已用它**」—— 实读 `Canvas.tsx` **没有调用 `useStill()`**：它把 `stillPortraits` 当 **prop**（`:21/:82/:123`），唯一调用点是 **`NookView.tsx:135`**。`App.tsx` 同样零命中。
  - `00:62`「卡片外壳：`CanvasObject.tsx:81-177`」—— 组件导出在 `:158`、根 `div` `:200-216`；`:81-177` 是 `PortraitFig`。
- **后果**：`05 §3.7` 的**结论**（`PerformanceLayer` 内用 `useStill()` 决定 `SHOW_RENDERERS` 输入）成立且必要，但它引的「既有先例」在 `App` 层**不存在**——必须在挂点自己 `useStill()`，不能继承 prop。这条必须写清（`§3.7:261` 正文已如此说，仅先例句错）。
- **建议**：改正行号；`§3.7` 落点写成「`PerformanceLayer` 组件内 `const still = useStill()`」。

### F-9 · **P2** · `02 §6.1:200`、`§6.3:269`、`§4:155`、`§8.1:413`

- **问题**：`DiceCeremony` 的挂载父节点行号错。
  - `02:200`「`App` 的根（`:443` 的 `div.flex.flex-col` 下）」—— 根 `div.flex.flex-col w-screen h-screen` 实读在 **`:479`**；`:443` 是 `handleCreateEntityAt` 内的模板字符串行。
  - 「`:626` 旁」/「`:668` 旁」—— 实读 `<RightSidebar` @ `:627`、`<RadialMenu` @ `:667`；`:626`/`:668` 均不存在。
- **后果**：低（语义明确：「App 根内、屏幕固定层」），但 `02 §6.4:285` 的 z-index 约定（仪式 50）与 `05` 的 ≤20 依赖该层级。
- **建议**：改语义锚「`App.tsx` 根 `div`（`flex flex-col w-screen h-screen`）内、`<RadialMenu>` 之后」。

### F-10 · **P3** · 其它行号漂移

| # | 位置 | 引用 | 实际 |
|---|---|---|---|
| a | `00 §2.3:63` | `Canvas.tsx:130-132` 注释 | `Canvas.tsx:138-140` |
| b | `01 §6.6:438`、`06 §3:89` | `Canvas.tsx:464-484`；卡片 `.map :471-483` | worldRef `:475`、`items.map` `:482-495`、收口 `:496`（`03:224` 的 `:475-496`/`:495` 是对的） |
| c | `01 §6.7:491` | `footprint.ts:90 的 gate` | `isBusy()` 判断在 `footprint.ts:118`；声明在 `:35` |
| d | `01 §6.4:416` | `WriterBar.tsx:26 起` | 组件 `:20`；`:26` 是 `const submit` |
| e | `02 §2.2:72`、`§2.3:81` | `rules/dice.ts:241-258`/`:243-250` | `rollOnce` 在 `:238-257`（`:249` push、`:255` crit、`:256` fumble） |
| f | `00 §2.1:50` | 尾部读表 `world_event` `:280` | `:289`（`:280` 在注释内） |
| g | `05 §4.2:285`、`§6.2:398` | `App.tsx:562` 主区 | `:570` |
| h | `06 §R-P7:63` | `前端改造计划.md:548-554`「P1/P2/P3 勾选」含 T3.4/T3.5 | `:548-556` 是 §14「阶段收工检查表」，按 P0..P5 分条，**不含 T3.x 行** |

> 这些都不改变设计结论；各篇给的**语义锚**（函数名 + 章号 + 锚句）都是准确的，按 `06 §3` 纪律可自愈。

### F-11 · **P3** · `02 §2.1:68` / `§2.2:77` 的 `forged` 论证（**核验为真**）

- **证据**：`extensions/toolkit/roll-dice.ts:49-54` 实读 `rollDice({ path: params.path })` —— 确认**无 `forcedResult`**；`roll-dice.ts:105` 的 `forged && ctx.actor.type !== 'god'` 门禁只对 god 生效。
- **裁决**：论证成立；`forged` 不进帧是**有意的拒绝**而非遗漏。

### F-12 · **P3** · 契约 §6:157 把 `SHOW_REGISTRY` 的出处写成 `performances.ts:15-100`

- **问题**：`00 §6:157`「`frame.component` ∈ `SHOW_REGISTRY` 的 7 个 id（`packages/shared/src/components/performances.ts:15-100`）」。
- **证据**：`SHOW_REGISTRY` 实际定义在 **`packages/shared/src/components/registry.ts:27`**（`Object.fromEntries(SHOWS.map(...))`），`performances.ts` 导出的是 `SHOWS:15` / `ShowKind:102` / `SHOW_IDS:105`。7 个 id 的**内容**在 `performances.ts:15-100` 是对的（`05 §2.2:66` 引的正是它），但**符号与文件错配**。
- **建议**：`00` 与 `05` 引用时区分：参数表 → `performances.ts`；注册表查表 → `registry.ts:27`。低风险（同名派生），但 `05 §3.2:148` 的 `SHOW_RENDERERS`/`SHOW_IDS` 是实现者会去核对的符号。


### F-13 · **P1** · 契约 §3.1 item 3 / §3.2 item 2：`{"content":` 前缀判定**不成立**（我的实测推翻）

- **契约原文**（`00 §3.1:106-107`）：「**`chalk` 的参数 JSON 以 `{"content":` 开头**（typebox `Type.Object({ content, path?, link_to?, append_to? })` 保声明序）；**`write` 以 `{"path":` 开头**」；`§3.2 item 2`：「若中间已能凭 `{"content":` 前缀**乐观判定**为 chalk，可在 delta 期间就开始流」。
- **实测推翻**：`chalk` 的 `parameters` 是 `Type.Object({content, path?, link_to?, append_to?})`（`extensions/toolkit/chalk.ts:41-60`，实读确认——`content` 是声明序首参）。但**模型给的实参键序不受 schema 声明序约束**：我的剧本 #4 让 `chalk` 只收到 `{path, content}`，输出的参数 JSON **以 `path` 打头**，首片 `"{\"path\""` —— **与 `write` 的首片逐字相同**。
- **证据**：spike #4 输出 `delta="{\"path\""` 且 `toolCall.name='chalk'`；spike #3（`write`）首片也是 `"{\"path\""`。**两条流在 delta 期间不可区分**——不只是「未来工具可能误判」，**当前工具集内 `chalk` 自己就能产生与 `write` 相同的前缀**。
- **后果**：§3 的**结论方向是对的**（`01 §3.1` 选「延迟确认」、拒绝前缀判定），但**理由写错了**：契约 §3.2 item 2 留的那个口子（「可凭前缀乐观判定」）在 AIRP 现有工具集下**不成立**，不是「未来风险」而是「现在就存在」。`01 §3.1:56-57` 的论证（「未来任何首参为 `content` 的工具都会误判」）同样说轻了。
- **建议**：
  1. 契约 §3.1 item 3 的「`chalk` 以 `{"content":` 开头」改为**「`chalk` 的 schema 首参是 `content`（`chalk.ts:43`），但**模型可任意排序**；实测带 `path` 的 chalk 以 `{"path":` 开头，与 `write` 无法区分」**。
  2. 契约 §3.2 item 2 删掉「乐观判定」这个选项（`01 §11.4:611` 已经请主 agent 这么做，但理由是「读起来像矛盾」；**真正的理由是它实测不可行**）。
  3. `01 §3.1:56` 的论证补上实测出处（本条）。
- **诚实声明**：剧本 #4 的键序是**我的 provider 脚本决定的**，不是真实模型的观测值。故本条证明的是「**前缀判定不构成结构性保证**」——`chalk` 的参数字典序由调用方（模型）决定，schema 声明序既不由 provider 强制、也不由 `toolcall_delta` 暴露校验。**契约 §3.1 item 3 把一个经验观察写成了结构性事实**，这是本条要修的点。（spike #1/#2 也确实产出 `{"content":`，所以原文的观察本身没错——错在把它当作**可依赖的判据**。）
- **这是我在本次评审中发现的**唯一一处**契约级事实错误**；修法与 `01` 已选的方案一致，故**不阻断**（`01` 正好选了安全的那条路），但契约文本必须改，否则下一个 agent 会照 §3.2 item 2 去实现乐观流。

---

## 3. 独立复核：契约 §3 的 spike（**我自己的实测**）

### 3.1 方法

- harness `/tmp/spike-writer.mjs`：仿 `tools/probe-writer.mjs`（同一 `writerLaunch` + `RpcClient` + `templates/holmes-world` tmp 拷贝 + `--extension <provider>` + `PI_OFFLINE=1`），记录 `client.onEvent` 收到的**原始事件**（= `toJsonEvent` 之后、`mapEngineEvent` 之前的形状 = 服务端真实可见面）。
- provider `/tmp/spike-provider.ts`：仿 `tools/probe-provider.ts`，把 **script** 与 **fragment size** 参数化（`SPIKE_SCRIPT` / `SPIKE_FRAG`）。
- 命令：`SPIKE_SCRIPT=<s> SPIKE_FRAG=<n> node /tmp/spike-writer.mjs`。两条 `--no-*` 隔离参数由 `writerLaunch` 提供，未绕过。

### 3.2 参数矩阵与实测结果

| # | `SCRIPT` | `FRAG` | 剧本参数 | 首片 `delta` | 拼接后 | `toolcall_*` 上的键 |
|---|---|---|---|---|---|---|
| 1 | `chalk` | 6 | `{content:BODY}` | `"{\"cont"` | `{"content":"The fog parts and the gaslight catches the wet cobbles."}` | start `[contentIndex,type]` / delta `[contentIndex,delta,type]` / end `[contentIndex,toolCall,type]` |
| 2 | `chalk` | 7 | 同上 | **`"{\"conte"`** | 同上 | 同上 |
| 3 | `write` | 7 | `{path,content}` | `"{\"path\""` | `{"path":"world/baker-street/spike.md","content":"…"}`，`toolCall.name='write'` | 同上 |
| 4 | `chalk-path-first` | 7 | `{path,content}` | `"{\"path\""` | `{"path":"…","content":"…"}`，`toolCall.name='chalk'` | 同上 |
| 5 | `text` | 7 | 无工具 | —（只有 `text_delta delta="let me think about that"`） | — | — |
| 6 | `chalk-escaped` | 5 | `{content:'He said "stop\nnow" \\ back — 中文'}` | `"{\"con"` | 分片含 `\\\"`、`p\\nno`、`\\ bac`；`toolcall_end.arguments.content` = `He said "stop\nnow" \ back — 中文` | 同上 |

全 6 组的**时序**一律为（以 #2 为例）：

```text
message_update:toolcall_start
message_update:toolcall_delta × 10      ← 只有 {contentIndex,delta}
message_update:toolcall_end             ← toolCall = {type,toolCall,id:'spike_call_1',name:'chalk',arguments:{…}}
message_end
tool_execution_start name=chalk toolCallId=spike_call_1 args={…}   ← 工具名首次出现
tool_execution_end   name=chalk isError=false
```

### 3.3 对契约 §3.1 的逐条裁决

| 契约 §3.1 断言 | 我的实测 | 裁决 |
|---|---|---|
| item 1：RPC 下 `partial` 被剥掉，delta 只有 `{type,contentIndex,delta}` | 6/6 组 delta 键恰为 `contentIndex,delta,type`，无 `partial`；`toolcall_start/end` 同样无 | **确认** |
| item 2：`toolcall_start → delta… → toolcall_end → tool_execution_start`，工具名在 delta 期不可知 | 6/6 组一致 | **确认** |
| item 3：`delta` 逐片拼接 = `JSON.stringify(toolCall.arguments)` | 6/6 组逐字相等（含转义组） | **确认** |
| item 3 附：**「`chalk` 的参数 JSON 以 `{"content":` 开头」** | 剧本 #1/#2 成立；**剧本 #4（带 `path` 的 chalk）以 `{"path":` 开头** | **部分推翻**：见 F-13 |
| item 4：`toolcall_end.toolCall` 携带完整 `{id,name,arguments}`，id 与随后 `tool_execution_start.toolCallId` 一致 | 6/6 组 `toolCall.id === 'spike_call_1' === toolCallId` | **确认** |
| §3 item 1：`mapEngineEvent` 收到的 `message_update` 只含 `{type,contentIndex,delta}`（`partial` 被 `toJsonEvent` 删） | `vendor/pi-rp/packages/coding-agent/dist/modes/json-event.js:12` 实读 `const { partial: _partial, ...deltaEvent } = assistantMessageEvent` | **确认** |

### 3.4 对 `§3.2`「延迟确认」方案的独立评估

- **方案可行**：`toolcall_end.toolCall.arguments.content` 是**已解析的对象属性**（实测 6/6），故「延迟到 `toolcall_end` 再取权威正文」不依赖任何 JSON 解析器。
- **§3.2 的缓冲键 `contentIndex` 成立**：实测一个 turn 内每条 tool call 有独立 `contentIndex`（剧本单工具时为 0）。**但 `contentIndex` 在多个 tool call 间是否可复用（是否按 turn 递增）我没有实测**（剧本只发了一个 tool call）——`01 §3.2` 用 `Map<contentIndex, string[]>` 并在 `message_end`/`agent_settled` 清空，**这个清空点是必须的**，否则同 turn 第二个 tool call 若复用 index 0 会串片。标 `[推断]`：清空点已覆盖该风险，但建议 `01` 的单测补一条「同 turn 两个 chalk（不同 contentIndex）互不串」。

---

## 4. 「引用 vs 实际」对照表（**全部实读复核**）

### 4.1 服务端发射面（`apps/server/src/engine/event-bridge.ts`）

| 设计引用 | 设计声称 | 实读实际 | 判定 |
|---|---|---|---|
| `00 §2.1:49` | `mapEngineEvent` `:46-198` | `:46`（签名）…`:198`（`return out`） | ✅ |
| `00 §2.1:51` | `writer_delta/character_delta` `:67-71` | `:66-72`（`text_delta` 分支）；**`:68` 就是 `writer_delta` 的产点** | ✅（区间差 1 行，语义对） |
| `00 §2.1:51` / `03 §2.1:24` | `image_generation_progress` `:97-105` | `:95-106`（`generate_image` 分支） | ✅ |
| `00 §2.1:51` | `chalk_writing` `:88` | `:87-89`（`if (event.toolName === 'chalk') push(...)`） | ✅ |
| `01 §2.1:28` / `00 §2.1:51` | `chalk_landed` `:123-133` | `:123-133` | ✅ 逐字 |
| `00 §2.1:51` / `04 §2.1:28` | `canvas_patched` `:134-146` | `:134-146` | ✅ 逐字 |
| `02 §2.1:26` | `dice_result` `:147-167` | `:147-167` | ✅ 逐字 |
| `05 §2.1:28` | `show_frame` `:168-176` | `:168-176`；`details.frame` 逐字 push | ✅ 逐字 |
| `03 §2.2:61` | `image_landed` `:177-188` | `:177-188` | ✅ 逐字 |
| `01 §2.1:29` | `writer_idle` `:191-194` | `:191-194` | ✅ 逐字 |
| `00 §2.1:50` | `broadcast` `:240-251` | `broadcast(message)` 起于 **`:240`** | ✅ |
| `04 §5:269` | `grep -c appendEvent event-bridge.ts` = 1（注释词，非调用） | 实跑 `grep -c` = **1**，命中 `:265` 的注释 | ✅ 逐字 |
| `02 §2.1:48` / `04 §2.1:44` | `push` 统一补 `timestamp`（`:56-61`） | `:56-61` | ✅ 逐字 |
| `03 §2.1:53` | `characterId` 仅在非 undefined 时附加 | `:59` `...(characterId === undefined ? {} : { characterId })` | ✅ |
| `00 §6b-3` / `03 §3:137` | watcher 忽略 `.airpworld/assets/`（`:373-377`） | `:373-377`：`assets/` + `sessions/` + `node_modules/` | ✅ 逐字（**注意还有 `sessions/`**，`00` 只点了 assets） |

### 4.2 事件形状 / vendor

| 设计引用 | 声称 | 实际 | 判定 |
|---|---|---|---|
| `00 §3.1:100` / `01 §2.2:36` | `toJsonEvent` 删 `partial`（`json-event.js:12`） | `:12` `const { partial: _partial, ...deltaEvent } = …` | ✅ 逐字 |
| `00 §3 item 3` | 适配器 `openai-completions.js:400`、`anthropic-messages.js:488` 产 `toolcall_delta` | 实读 **`ai/dist/api/openai-completions.js:195` 与 `:400`**、**`ai/dist/api/anthropic-messages.js:488`** —— **路径漏了 `api/` 一段**；`openai-completions` 有两处（`:195` 流式、`:400` 非流式） | ⚠️ 路径错（`ai/dist/api/` 而非 `ai/dist/`）；行号 `400`/`488` 对 |
| `00 §3.1:105` | `agent-loop.js:216-224` 把 `toolcall_*` 包成 `message_update` | `vendor/pi-rp/packages/agent/dist/agent-loop.js:214-229` 的 `case "toolcall_start"…` 组 | ✅ |
| `01 §2.2:38` | `types.d.ts:246-254` 的 `ToolCall` | `ToolCall` 接口在 **`:246-254`**（`id/name/arguments`）| ✅ 逐字 |
| `00 §3.1:105` | `rpc-mode.js:386` 调 `output(toJsonEvent(event))` | 实读 `coding-agent/dist/modes/rpc/rpc-mode.js:386` | ✅ 逐字 |
| `00 §3:71` | `WRITER_INSTRUCTION`（`instructions.ts:74-79`）逐字「never reaches the player」 | 实读 `extensions/instructions.ts:53`（声明）、**`:74-79` 是第 3 条「Write the turn with chalk」**，逐字含 `text that lives only in your reply never reaches the player` | ✅ 逐字 |
| `01 §3.4:178` | `CHARACTER_INSTRUCTION`（`:168`），「your words ARE the scene」（`:174`） | `:168` 声明；**「your words ARE the scene」实读在 `:174`** | ✅ 逐字 |
| `01 §3.4:180` | `CHARACTER_INSTRUCTION:176`「That is not your job」 | `:176` 逐字 | ✅ 逐字 |
| `00 §3.1:107` | `chalk.ts` 的 `parameters.content` 唯一正文入口（`:41-46`） | `extensions/toolkit/chalk.ts:41-46` 是 `Type.Object({content, path?, link_to?, append_to?})` 的开头 | ✅ 逐字 |
| `00 §3:73` | `probe-provider.ts:61`（text_delta）+ `:66`（toolcall_delta） | `tools/probe-provider.ts:61` `text_delta`、`:64` `toolcall_start`、`:66` `toolcall_delta`、`:71` `toolcall_end` | ✅ |
| `00 §3.1:108` | `toolcall_end.toolCall` 携带完整 `{id,name,arguments}` | 实测 6/6 组；类型 `types.d.ts:431-439` 的 `toolcall_end` 带 `toolCall: ToolCall` | ✅ |

### 4.3 `generate-image`（`03` 的核心断言）

| 设计引用 | 声称 | 实际 | 判定 |
|---|---|---|---|
| `03 §2.1:56` / `00 §6b-4:175` | `onUpdate` 心跳 `:79-95`，先 `resolving` 后 `setInterval` 每 10s + `unref()` | 实读：`:79-82` 发 `resolving`；`:83` `startedAt`；`:84-94` `setInterval(…, HEARTBEAT_MS)`；`:95` `heartbeat.unref()`；`:110` `clearInterval` | ✅ **逐条成立** |
| `03 §2.1:56` | `HEARTBEAT_MS = 10_000`（`:26`） | `extensions/toolkit/generate-image.ts:26` | ✅ 逐字 |
| `03 §2.1:49` | `stage` 来源 `:81/92` | `:81` `stage:'resolving'`；`:92` `stage:'generating'` | ✅ 逐字 |
| `03 §2.2:81` | `asset` 永远 `.airpworld/assets/gen/<slug>-<key>.<ext>`（`generate-image.ts:376`，`GENERATED_ASSET_DIR` `:20`） | `packages/shared/src/actions/generate-image.ts:20` `GENERATED_ASSET_DIR`；资产名由 `outputPathFor`（`:134-139`）拼 `${GENERATED_ASSET_DIR}/${slug}-${key}.${ext}`；`:376` 是 `details.asset` | ✅ |
| `03 §2.2:83` | `width/height` 是**请求值**（`details.width/height` `:382-383`） | `:382-383` `width, height`（来自 `validateInput`，即请求值） | ✅ |
| `03 §2.2:84` | `reused = !!details.reused`（`:384`/`:359`） | `:359` `const reused = existing === 'file'`；`:384` `reused,` | ✅ 逐字 |
| `03 §3.4:186` | `provider.generate(...)` 排在 `outputPathFor`/`statKind` **之前**（`:339` vs `:349-359`） | `:339` `provider.generate`；`:349` `outputPathFor`；`:358` `statKind` —— **成立**，故 `reused` 只省写盘不省 provider 调用 | ✅ **这是 `03` 的重要发现，实读证实** |
| `03 §6:299` | `img src` 范式在 `SceneBackdrop.tsx:69` | 实读 `:63` 与 `:69` 两处 `` `/api/asset?path=${encodeURIComponent(src)}` `` | ✅ |

### 4.4 门禁（`tools/check-ws-contract.mjs`）

| 设计引用 | 声称 | 实际 | 判定 |
|---|---|---|---|
| `00 §2.1:52` / `00 §10:221` | `show_frame` 靠 `bridge.includes('details.frame')` 标记（`:243-246`） | `:243-246` | ✅ 逐字 |
| `00 §2.2:58` / 各篇 | `consumedFrom` 认 `case 'x'` 与 `msg.type === 'x'`（`:124-134`） | `consumedFrom` 定义在 `:124`，正则 `/(?:case\s+\|msg\.type\s*===\s*)'([a-z][a-z_0-9]*)'/g` 在 `:128` | ✅ 逐字 |
| `04 §6.0:279` | `KNOWN_DARK` 含 `canvas_patched`（`:76`），是措辞开关非豁免（`:193-194` `continue`） | `KNOWN_DARK` 起于 `:70`，`'canvas_patched'` 在 **`:76`**；`dark` 循环 `if (consumed.has(frame)) continue;` 在 `:193` | ✅ 逐字 |
| `05 §3.1:105` | `CONSUMERS = ['apps/web/src/state/useWorld.ts']`（`:56`） | 实读 **`:48`** | ⚠️ 行号错（`:56` 在注释里），集合内容 ✅ |
| `02 §10.1:455` | 门禁基线 `{contract:24, emitted:24, consumed:11, findings:9}` | **实跑一致**（见下） | ✅ |
| `02 §10.1:455` | `dice_result` 的 dark finding 在 `event-bridge.ts:152` | 实跑为 **`:152`** | ✅ 逐字 |
| `04 §10.1:421` | `canvas_patched` 的 dark finding 在 `:137` | 实跑为 **`:137`** | ✅ 逐字 |
| `05 §10.1:526` | `show_frame` 的 finding 在 `:0` | 实跑 **`:0`** | ✅ 逐字 |

**实跑输出**（`node tools/check-ws-contract.mjs --json`）：

```text
findings (line, message):
 67  broadcasts `writer_delta` but no browser file consumes it
 88  broadcasts `chalk_writing` …
 97  broadcasts `image_generation_progress` …
124  broadcasts `chalk_landed` …
137  broadcasts `canvas_patched` …
152  broadcasts `dice_result` …
178  broadcasts `image_landed` …
192  broadcasts `writer_idle` …
  0  broadcasts `show_frame` …
summary = { contract: 24, emitted: 24, consumed: 11, findings: 9 }
```

### 4.5 前端承载面

| 设计引用 | 声称 | 实际 | 判定 |
|---|---|---|---|
| `00 §2.2:55` | 唯一 WS 消费点 `useWorld.ts:315-390` 的 `onmessage`，`new WebSocket` 在 `:308` | `new WebSocket` `:308`；`ws.onmessage` `:315`；`switch` `:322`；`catch` `:387-389` | ✅ |
| `useWorld` `LayerLink`（`04 §2.2:99`） | `:24-30` `{id,from,to,style,label}` 缺 `color/directed/z` | `useWorld.ts:24-30` 逐字如此 | ✅ **确认缺口属实** |
| `04 §2.2:99` | `/api/layer` 只 `SELECT id, from_id, to_id, style, label`（`world.ts:495-504`） | 工作树 `world.ts:619-629`（`HEAD:495-504`）逐字如此，map 也只回 5 字段 | ✅ **确认缺口属实**（行号见 F-7） |
| `04 §2.2:100` | `LINK_STROKES` 只 3 键（`LinkLayer.tsx:37-42`） | `LinkLayer.tsx:37-42` 逐字 `{solid, dashed, blue}`；`:186` 兜底 `?? 'var(--ink)'` | ✅ **确认缺口属实** |
| `04 §3.4:217-218` | `buildPaths` 挂在 `useEffect(..., [links])`（`:218-230`） | `LinkLayer.tsx:218-230` 的 `useEffect`（deps `[links]`）调 `buildPaths` | ✅ |
| `04 §3.4:218` | `updateAllLinks()` 仅被 `Canvas.tsx:328`/`:376` 调用 | `Canvas.tsx:328`（move）与 `:376`（落定）实读**仅此两处** | ✅ **确认「agent 重排后线脱锚」缺口属实** |
| `00 §2.3:63` | `links` prop 只在 `fetchLayer` 时变（`Canvas.tsx:130-132` 注释） | 注释在 **`:138-140`** | ⚠️ 行号错，内容 ✅ |
| `00 §6b-6:177` | `writerToolsInFlight` `useWorld.ts:113`，喂 `isBusy`（`:259`） | `:113` 声明；`:259` `isBusy: () => writerToolsInFlight.current > 0` | ✅ 逐字 |
| `00 §6b-6:177` | 由 `tool_start`/`tool_end`（仅 writer）加减 | `:360-362` / `:363-369` | ✅ |
| `00 §2.3:64` | `useCamera` 模块级共享，`flyTo(x,y,z)` 插值；`save/restore(name)` | `useCamera.ts:41-42` 模块级 `sharedTarget/sharedCurrent`；`:142-148` `flyTo`（`z===undefined` 时保持当前 z，实读 `:146`）；`:150-157` `save/restore`；`CAM_MEMORY:38` | ✅ 逐字 |
| `05 §6.3:423` | `useCamera().flyTo` 是 `useCallback` 稳定引用 | `:142` `useCallback(…, [])` | ✅ |
| `02 §3.3:130` | `CHARGE_MS=1200 :16`、`ROLL_MS=1200 :19`、`SETTLE_MS=1300 :20` | 逐字（另有 `TAP_MS:17`、`AUTO_FILL_MS:18`、`IDLE_TILT:21`） | ✅ |
| `02 §3.3:130` / `§8:335` | `DiceRoller` 的 `FACES:23` | `:23` 逐字 | ✅ |
| `02 §2.1:62` | `rules/dice.ts:241-258` 的 `rollOnce`、`rolls.push`、`crit/fumble` | `rollOnce` 在 `:238-257`；`:249` push；`:255` crit（`rolls.every(r=>r===spec.faces)`）；`:256` fumble（`===1`） | ⚠️ 行号差 3，内容 ✅ |
| `02 §2.2:72` | `fumble = rolls.every(r => r === 1)` | `rules/dice.ts:256` 逐字 | ✅ |
| `02 §2.3:81` | `rolls.length` = 声明的 `count` | `rules/dice.ts:244` `for (let i = 0; i < spec.count; i++)` | ✅ |
| `05 §3.4:180` | `data-path` 在 `CanvasObject.tsx:125` | 实读 **`:203`**（`:125` 在 `PortraitFig`） | ❌ 行号错 |
| `05 §3.7:248` | `useStill()` `motion.ts:28-36`，`Canvas.tsx:123` 已用它 | `motion.ts:28-36` ✅；**`Canvas.tsx` 无 `useStill()` 调用**（`stillPortraits` 是 prop `:21/:82/:123`）；唯一调用点 `NookView.tsx:135` | ⚠️ 行号/事实错（见 F-8） |
| `05 §3.7:265` | `useStill` 只在 mount 探一次、不订阅 `change` | `motion.ts:25-27` 注释 + `:30-34` 实现（`useEffect(..., [])`） | ✅ |
| `04 §2.2:100` | `LINK_STROKES` 只 3 键（`LinkLayer.tsx:37-42`），DB 六基元中四个落兜底，「`red` 的 `var(--rust)` 永远画不出来」 | 实读 `LINK_STROKES` 的键是 **`solid`/`dashed`/`blue`（`:38-42`）**，即**工具面的 style token**，其中 `dashed → var(--rust)`（`dashed` 就是红的）。工具面的 `red` 经 `STYLE_PRESETS`（`canvas.ts:51-63`：`red: {style:'ink', color:'rust'}`）**落库为 `style='ink'`**。故真实机制是：**DB 六基元里 `ink`/`bold`/`hand`/`thread`/`road` 五个键在 `LINK_STROKES` 里不存在 → 全部走 `?? 'var(--ink)'`（`:186`），只有 `dashed` 命中；而 `color` 列根本没被 SELECT（4.5 行）→ 红色永远拿不回来。** | ⚠️ 总体结论成立、修法（`§8.3`：补六基元 + 用 `color`）正确；仅「`red` 的 `var(--rust)`」这一句的机制表述不准（`red` 落库后是 `ink+rust`，`var(--rust)` 在 `LINK_STROKES` 里绑的是 `dashed`，不是 `red`） |
| `02 §7.3:321` | 三种 foley 都在 `FoleyName`（`audio.ts:24-33`） | `FoleyName` 在 `:24-34`（9 项，含 `dice-roll`/`crit-chime`/`fumble-break`） | ✅ |
| `02 §7.3:323` | `unlock()` 必须在手势里（`audio.ts:905-921`） | `unlock` 定义在 `:905-921` | ✅ 逐字 |
| `02 §7.3:323` | `Canvas.tsx:180` 的 pointerdown 已解锁 | 实读 `Canvas.tsx:191` `void unlock();`（在 `handlePointerDown` 内）；`:180` 是 `getViewport` 的调用行 | ⚠️ 行号差 11 |
| `05 §3.7:248` / `00 §2.3` | `Canvas.tsx:123` 用它压立绘 | 立绘压制在 `:121-125` 的 `playingPortrait` memo（读 `stillPortraits` prop） | ⚠️ 语义对、来源错 |

### 4.6 组件 / CSS / 共享类型

| 设计引用 | 声称 | 实际 | 判定 |
|---|---|---|---|
| `00 §2.3:62` | `CardRenderer.tsx`（`chalk`→`ChalkCard`） | `CardRenderer.tsx:82` 导出；`narrative/ChalkCard.tsx:40` `['chalk','chalk--bare']` | ✅ |
| `05 §3.4:180` | `.object[data-path]` 选择器与 `LinkLayer.elForPath` 同构 | `LinkLayer.tsx:116-123` 逐字 `` document.querySelector(`.object[data-path="${CSS.escape(path)}"]`) `` | ✅ |
| `00 §2.3:65` | `FoleyName` 枚举在 `audio.ts:24-33` | `:24-34`（9 项） | ✅ |
| `05 §4.3:288` | `.ink-spread` 在 `index.css:237-239`（`textInkSpread 1.35s`） | `:237-239` 逐字；`@keyframes textInkSpread` `:260` | ✅ |
| `05 §2.1:18` | `.dice-cube-ceremony` `index.css:616-650` | `:616` `.dice-cube-ceremony`、`:624` `.dice-scene-ceremony`、`:629-650` 六个 `.face-N` | ✅ |
| `05 §4.3:297` | `.show-` 零命中 | 实跑零命中 | ✅ |
| `04 §6.1:295` | `stateRef.current` 在 `fetchLayer` 写（`useWorld.ts:137`） | `:137` `stateRef.current = next` | ✅ |
| `04 §6.1:295` | footprint 读它（`:240`）、`moveCard` 回滚（`:166`/`:187`） | `:240`（widths）、`:166` `const prev = stateRef.current` | ✅ |
| `02 §6.1:200` | `worldTransform` 是 `translate(...) scale(cam.z) …`（`lib/camera.ts:72-74`） | `camera.ts:73-75` 的 `worldTransform` 逐字如此 | ✅ |
| `01 §6.2:257` | `phantom.ts` 形状镜像 `lib/parallax.ts` | `parallax.ts:37-44` 的 `subscribeParallax`（订阅即回调一次）；`01 §6.2:339` 明确「**不做**订阅即回调」——**镜像形状但不同语义，已写明** | ✅ |
| `05 §2.2:70-78` | `performances.ts:15-100` 的 7 项 + 各 `defaultDuration`/`requiresTarget` | 实读：`SHOWS` `:15`；`spotlight :17-28`（2400/true）、`lights_out :30-40`（1800/false）、`fireworks :42-53`（3000/false）、`evidence_burst :55-66`（3600/true）、`camera_focus :68-73`（1600/true）、`ink_burst :75-85`（1200/true）、`roll_ceremony :89-99`（2200/false）；`SHOW_IDS :105` | ✅ **参数表逐字成立**（`camera_focus` 确为 `z.object({zoom})` 唯一字段 `:70`；`lights_out.focus` 是 `z.string()` `:35`） |
| `00 §6:157` | `SHOW_REGISTRY` 的 7 个 id | 实读 `SHOW_REGISTRY` 是 `packages/shared/src/components/registry.ts:27` 由 `SHOWS` 派生（不是 `performances.ts:15-100` 本身）。`00 §6:157` 把 `SHOW_REGISTRY` 的出处写成 `performances.ts:15-100` | ⚠️ 名字/文件错配（7 个 id **内容**对） |
| `05 §2.1:30` | `ShowFrame` 在 `show.ts:21-33` | `packages/shared/src/actions/show.ts:21-33` 逐字 | ✅ |
| `05 §2.1:56` | `durationMs` clamp 到 `[300,12000]`（`show.ts:47-48` 的 `MIN/MAX`，`:155`） | `:47-48` `MIN_DURATION=300`/`MAX_DURATION=12000`；`:155` `Math.min(MAX, Math.max(MIN, input.duration_ms ?? def.defaultDuration))` | ✅ **逐字** |
| `05 §2.1:55` | `params` 经 zod `safeParse`（`show.ts:146-153`） | `:146` `def.params.safeParse(input.params ?? {})`；`:148-151` `fail('invalid_field_value', …)` | ✅ |
| `05 §2.2:65` | 7 条 schema 全带 `.passthrough()` | 实读 7/7 带 | ✅ |
| `05 §2.1:54` | `links` 的坏路径被剔除并计数（`show.ts:124-143`） | `:124-143`：`store.readFile(link)` 成功才 `kept.push`，失败 `droppedLinks += 1`；全坏则 `fail('not_found')` | ✅ |
| `05 §2.1:53` | `targetName` 来自 `entityName(fm, target) \|\| basename`（`show.ts:119`） | `:119` 逐字 | ✅ |
| `05 §3.2:17` | `ShowKind` 封闭枚举 `Type.Union(SHOW_IDS.map(Type.Literal))`（`extensions/toolkit/show.ts:19-22`） | `show.ts:19-22` 逐字 | ✅ |
| `05 §5:352` | `show` 零副作用断言（`components.test.mjs:245`） | `:245` `assert.deepEqual(calls, {write:0, event:0, canvas:0}, 'show writes nothing')` | ✅ 逐字 |
| `04 §2.1:57` | `LinkDetails`/`ArrangeDetails` 在 `canvas.ts:29-43` | `:30-36` `LinkDetails`、`:38-44` `ArrangeDetails` | ✅ |
| `04 §2.1:77` | `LinkRecord` 在 `schemas/canvas.ts:65-75` | `:65-75` 逐字（`id/layer/from/to/style/color/directed/z/label`） | ✅ **逐字** |
| `04 §2.1:77` | 六基元 `ink/dashed/bold/hand/thread/road`（`schemas/canvas.ts:54-61`） | `LINK_PRIMITIVE_STYLES` 在 `:54-61` 逐字 | ✅ |
| `04 §2.1:93` | 服务端回填**完整行**（`canvas.ts:249-252`/`:282-287`/`:303-306`/`:470-478`/`:558-566`） | 实读 `:252`/`:287`/`:306` 各回 `links:[row]`（完整 `LinkRecord`）；**`:470-478`/`:558-566` 是 `arrange` 分支的旧行号**，WT 对应 `:486`（`cards:[{path,x,y,z}]`）与 `:580` | ⚠️ link 三处 ✅ 逐字；card 两处行号漂（内容对：`cards` 回 `{path,x,y,z}`） |
| `04 §2.2:100` | DB 基元与 `LINK_STROKES` 3 键错配，`red` 的 `var(--rust)` 画不出 | 实读 `LINK_STROKES` 里 `dashed→var(--rust)`（**不是 `red`**）；工具面 `red` 被规范化成 `(ink, rust)`（`schemas/canvas.ts` 注释）。故「红色画不出」的机制是**`ink` 走兜底墨色、`color='rust'` 根本没 SELECT** | ⚠️ 结论对、归因表述不精确（`04 §2.2` 与 `§8.3` 的修法——补六基元 + 用 `color`——**仍正确**） |
| `04 §2.3:112` | 两侧同一 id 空间（`layers.ts:27-39` 的 `layerOfDir`/`MAP_LAYER`） | `MAP_LAYER:27`、`WORLD_DIR:29`、`dirOfLayer:32`、`layerOfDir:37` | ✅ |
| `04 §5:266` | `grep -c appendEvent actions/canvas.ts` = 0 | 实跑 = **0** | ✅ 逐字 |
| `04 §8.1:368` | `mergeLinkPatch(links, rows, action)` 签名 | 设计自定义（NEW），无源可核 | n/a |
| `03 §2.5:104` | `PhantomSeat {x,y,w,h,z}` | 设计自定义；`PHANTOM` 全仓零命中 | n/a（NEW）|
| `00 §8:197` | `phantom.ts`/`writer-state.ts`/`PerformanceLayer.tsx`/`chalk-delta.ts` | 四者全仓**均不存在**（`grep -rl` 零命中） | ✅ 确认为新建 |

### 4.7 设计引用但**全仓不存在**的符号（悬空清单）

实跑 `grep -rl <sym> apps/web/src apps/server/src packages/shared/src extensions`（全部零命中）：

`nextInkSeat`(F-3) · `evictOrphans`(`01 §7:507`，说"供测试断言"却不在 `§10.3` 清单) · `clearAll`(`01 §12:622`，标为待拍板) · `TUMBLE_ROT`(F-4) · `asNum`(F-5) · `ShowCtx`/`renderActiveShow`/`resolveShowKind`/`evidenceLinks`/`clampBursts`/`clampStagger`/`spotlightDim`/`lightsOutDim`/`zoomOf`/`inkToneOf`(F-6) · `LANDED_DWELL_MS`/`REUSED_DWELL_MS`/`GHOST_W`/`GHOST_H_MIN`/`GHOST_H_MAX`/`ghostSizeFor`/`stageText`/`ghostVisibleOn`/`phantomSeatFor`(`03` 已给签名，属正常 NEW) · `mergeItemPatch`/`mergeLinkPatch`/`layerFetchCount`(`04` 已给签名，正常 NEW) · `handDrawnPath`/`cardGeometry`/`performShowFrame`/`subscribeActiveShow`/`cancelShow`/`activeShow`(`05` 已给签名，正常 NEW) · `extractContentPrefix`/`replayFragments`(`01` 已给签名，正常 NEW)。

**只有前 12 个是真悬空**（无签名、无归属模块）；其余是合法的 NEW 符号。

---

## 5. 未通过项 / 不能核验项

### 5.1 不能核验（需实现后或需运行时）

1. **`05 §4.2:287` 的裁剪判定**（`App.tsx` 主区 vs `Canvas.tsx:466` 的 `overflow-hidden`）：`05` 自标 `[推断]`，我未实测。**建议保留为待验证项**——它只影响 `spotlight` 光束是否被裁，不影响接线正确性。
2. **`05 §3.7:257` 的 `snapTo`**：`useCamera` 无「瞬间到位」入口（实读 `useCamera.ts` 只有 `flyTo/save/restore/getCam/getTarget`），`05` 已标 `[推断]` 并给了两个替代。**需在实现时择一**。
3. **同 turn 多个 `contentIndex` 是否复用**（§3.4）：我的剧本单工具，未覆盖。已列 `[推断]` 并建议补单测。
4. **`02 §11.2:514` 所说 `docs/tools/07 §6.2` 的 A 入口代码块与实读不符**：`02` 未展开，我也未逐字核 `docs/tools/07 §6.2` 的代码块（超出本次「引用核对」范围，且 `02` 已登记）。标未核验。
5. **`04 §12.8:525` 的「`/api/layer` 三列属不属于本批」**：范围判定，非事实核验，归主 agent 拍板。
6. **`02 §12` / `05 §12` / `01 §12` 的 `[推断]` 常量**（去重窗口 5s/上限 50、逐字 24ms、`LANDED_DWELL_MS=15s`、`REUSED_DWELL_MS=5s`、`clampBursts` 上限 8）：都是观感/性能经验值，**无源可核**，评审只能判断「是否该在实现前拍板」。我的判断：**都属可后调参数，不阻断**；但 `05 §4.4` 的 `Math.min(bursts, 8)` 是**防御性封顶**（schema `bursts` 无上限，实读 `performances.ts:47` 只有 `.int().positive()`），**建议保留并写进注释**。

### 5.2 未通过（必须回写后才放行）

阻断级只有 **P1 三条**（F-1、F-3、F-4）+ 契约事实修正 F-13。它们的共同形态是**「设计文档之间/文档与源码之间的符号级不一致」**——不是设计思路错，而是实现者会照着不存在的符号写代码。

放行条件（建议）：

1. `01`/`03` 就 `PhantomLandPayload` 与 `register` 合并语义**择一并逐字统一**（F-1/F-2），并补契约 §8 的 `label?/elapsedMs?/layer?`。
2. 删/定义 `nextInkSeat`、`TUMBLE_ROT`、`asNum`、`ShowCtx`/`renderActiveShow` 与 `05 §10.3` 的 8 个 helper（F-3…F-6）。
3. 契约 §3.1 item 3 / §3.2 item 2 按 F-13 修正（去掉「前缀乐观判定」这个选项）。
4. `03`/`04` 的 `world.ts` 行号统一到当前工作树（F-7）；P3 行号表（F-10）顺手改。

### 5.3 明确「不构成问题」的项（已核验为真，避免重复劳动）

- 契约 §3 的 spike 三条核心事实（`partial` 被剥、工具名在 delta 期不可知、`delta` 是 `JSON.stringify(arguments)` 分片）+ `toolcall_end.toolCall` 是唯一事后锚点：**6 组实测全确认**。


- `generate_image` 的 `onUpdate` 心跳（`:79-95`、10s、`unref`）与 watcher 忽略 `.airpworld/assets/`（`:373-377`）：**实读逐字成立**。
- `04` 的三个前端缺口（`LayerLink` 缺 3 字段、`/api/layer` 只 SELECT 5 列、`LINK_STROKES` 只 3 键）：**实读全部属实**，且 `updateAllLinks` 确只在拖拽热路径调用（`Canvas.tsx:328`/`:376`）→ 「agent 重排后线脱锚」是真缺口。
- `05` 引用的 `performances.ts:15-100` 七项参数表、`show.ts` 的 clamp、`lib/motion.ts:28` 的 `useStill`：**内容逐字成立**（仅 `data-path:125` 与 `Canvas.tsx:123` 两处行号错）。
- 门禁基线 `9/11/24/24` 与 9 条 finding 的行号：**实跑逐字一致**。
- `show` 的零副作用（`components.test.mjs:245`）、`canvas` 动作的零 `appendEvent`：**实跑/实读成立**。

### 5.4 复核时点（行号时效声明）

本报告 §4 的行号取值时点：`world.ts` = **1076 行**（开写时）；收尾复查发现它已涨到 **1084 行**（F-7 末条）。**其余被核文件在收尾复查时未变**：`event-bridge.ts` 的 `case 'message_update'` 仍 `:64`、`chalk` `:87`、`generate_image` update `:95`、`roll_dice` `:147`、`show` `:168`、`image_landed` `:177`；`useWorld.ts` 的 `card_position` `:342`/`tool_start` `:360`/`tool_end` `:363`/`error` `:377`/`default` `:383`；`LinkLayer.tsx` 的 `LINK_STROKES` `:38`；`check:ws` 基线仍 `9/11/24/24`。**故本报告对 `world.ts` 之外的所有行号在评审期内稳定可信。**
