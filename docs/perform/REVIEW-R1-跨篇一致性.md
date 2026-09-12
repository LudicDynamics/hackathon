# REVIEW-R1 — 跨篇一致性（演出通道批次）

> 2026-09-13。**只读评审**：本文件之外未改任何东西。基线 `findings:9 / consumed:11 / contract:24 / emitted:24`。
> 评审对象：`docs/perform/00`（冻结契约）+ `01`–`06`。方法：逐字段/逐路径把 6 篇互相比对，并实读源码复核（不凭文档自述）。
> 本文只判「同一路径 / 事件 / 字段名 / 模块名在各篇是否一致」，不判作者对错。

---

## 1. 结论

**需回写后再放行**（不构成阻断，但 R1-01/02/03 三条 P1 必须在实现前统一，否则 01/03 两份会写出不兼容的 `PhantomLayer` 与 `phantom.ts`）。

- 契约 §8 的 4 个冻结模块名、门禁消解条数（9=4+1+2+1+1）、`dice_result` / `show_frame` 字段集 —— **逐字/逐条一致，无发现**。
- 跨篇新模块的**签名面**（`PhantomLayer` props、`phantom.ts` 的 `PhantomLandPayload`、座位 helper、`entry.reused`）—— **存在 3 处 P1 不一致**，都集中在 `01 ⇄ 03` 这一对「共写 `phantom.ts`」的接口上。
- 契约 §8 的「名字冻结」被 `04` **过度解读**，与其余四篇的实际做法冲突（R1-06）。

| 编号 | 严重度 | 一句话 |
|---|---|---|
| R1-01 | P1 | `PhantomLayer` 有无 props：01 说不带，03 说必须带 `{currentLayer, bgSrc}` |
| R1-02 | P1 | `entry.reused` 被 03 读取，但 `PhantomEntry`（01/03 两处定义）都没有该字段 |
| R1-03 | P1 | 座位 helper 两个名字两套签名：01 的 `nextInkSeat`（未定义）vs 03 的 `phantomSeatFor` |
| R1-04 | P2 | `PhantomLandPayload` 有无 `seat?`：03 有，01（属主）没有 |
| R1-05 | P2 | 01 §6.1 的 `register(kind:'chalk')` 漏传 `layer`，与 01 §6.2、03 的过滤前提矛盾 |
| R1-06 | P2 | 04 以「新增未登记模块违 §8」为由拒绝建 `lib/canvas-patch.ts`，与 01/02/03/05 大建未登记模块冲突 |
| R1-07 | P2 | `PhantomLayer.tsx` / `GhostCard.tsx` 是跨篇产物却不在契约 §8 的冻结表内 |
| R1-08 | P2 | 同一锚点（Canvas 挂点、App 挂点）各篇引用的行号不一致，且多数已漂移 |
| R1-09 | P3 | `register` 幂等合并的「可更新字段集」01 与 03 措辞不同 |
| R1-10 | P3 | 契约 §6 写 `SHOW_REGISTRY`（`performances.ts:15-100`），实际清单常量是 `SHOWS`/`SHOW_IDS` |
| R1-11 | P3 | 02 §4 列 `TUMBLE_ROT` 为待导出常量，`DiceRoller.tsx` 无此符号 |

---

## 2. Findings

### R1-01 · P1 · `PhantomLayer` 的 props 签名两篇相反

- **位置**：`01 §4:199`、`01 §6.6:448-449`、`01 §6.6:463` ↔ `03 §4:224`、`03 §8.2:366-376`、`03 §8.5:477`。
- **问题**：同一组件（属主 `03`）在两篇给出**不相容**的签名与挂载方式。
  - `01`：`export const PhantomLayer: React.FC = () => {`（**无 props**），挂载写作 `<PhantomLayer />`（`01:199`），判据只要求「`Canvas.tsx` 里出现 1 次」。
  - `03`：`PhantomLayerProps { currentLayer: string; bgSrc: string | null }`、`React.FC<PhantomLayerProps>`，挂载写作 `<PhantomLayer currentLayer={currentLayer} bgSrc={bg.src} />`。
- **证据**：`01:361` 又说 `PhantomLayer`（`03`）「按 `entry.layer === currentLayer` 过滤」——**过滤本身就需要 `currentLayer`**；`03 §3.3:177-180`、`§8.2:380` 的「投影退场」还需要 `bgSrc`。故 `01` 的无参形态**无法承载 01 自己要求的过滤语义**。两篇的挂载点一致（Canvas `worldRef` 块内、卡片 `.map` 之后，见 R1-08），只有 props 不一致。
- **建议**：以 **`03` 的 `PhantomLayerProps` 为准**（属主 + 语义需要），`01` 的 §6.6 代码块与 §4:199 的挂载示例改成带 `currentLayer`/`bgSrc` 的形态。契约 §11「重叠即联系兄弟」已点名 `01`/`03` 共写，但这条接口未冻结进 §8。

### R1-02 · P1 · `entry.reused` 被消费，但两处 `PhantomEntry` 都没声明

- **位置**：消费方 `03 §8.3:396`（`entry.reused === true`）；定义方 `01 §6.2:263-283`、`03 §2.5:105-118`。
- **问题**：`03` 的 `GhostCard` 读 `entry.reused` 决定是否贴「Already had this image」封条，但 `PhantomEntry` 的字段集（两篇一致）是 `{toolCallId, kind, source, path?, seat, text?, asset?, label?, elapsedMs?, layer?, phase, createdAt}`——**没有 `reused`**。`reused` 只存在于 `PhantomLandPayload`（`01:300-307`、`03:120`）。`land` 若不把它落到 entry，`GhostCard` 读到 `undefined`，封条永不出现。
- **证据**：`01:263-283` 与 `03:105-118` 逐字段比对，无 `reused`；`03:278` 的 `land(..., { reused: msg.reused === true })` 只证明**入参**带它。
- **建议**：在**属主 `01`** 的 `PhantomEntry` 补 `reused?: boolean`（与 `label?`/`elapsedMs?` 同理，`land` 时写入），`03` 的 §2.5 镜像同步。这是一条「跨篇字段缺失」，属 01 的 `phantom.ts` 冻结面必须扩。

### R1-03 · P1 · 座位 helper：01 的 `nextInkSeat` 是未定义符号，03 的 `phantomSeatFor` 是另一套

- **位置**：`01 §6.1:242`（`seat: nextInkSeat(stateRef.current)`）↔ `03 §8.5:418-424`（`function phantomSeatFor(size, layer): { seat; occupied }`）。
- **问题**：两者都在做同一件事（用 `lib/seat.ts:48` 的 `seatSpiral` 对 `items ∪ 已有幻影` 求座位），却**两个名字、两套签名**，且 `01` 的 `nextInkSeat` 在 01 全篇**再无定义**（不是 `NEW` 标了签名的符号，也没有实现片段）——违反契约 §11「示例只引用真实存在的符号，新函数标 `NEW` 并给签名」。
- **证据**：`01:242` 只出现一次（`grep nextInkSeat` 全仓仅此一处）；`03:424/440` 给了 `phantomSeatFor` 的完整签名与实现，且 `03:436-438` 已把 `∪ 同层幻影 seat` 的合并写清。契约 §5:149「`01` 与 `03` **共用同一个幻影注册表**……不得各写一份」——座位算法虽不等同注册表，但同属「幻影排座」的共用面，两篇各造一个名字即为分叉。
- **建议**：**统一到 `03` 的 `phantomSeatFor(size, layer)`**（有签名、有实现、覆盖 `∪ phantom seats`），`01 §6.1` 的示例改为调用它；`nextInkSeat` 从 01 删除。若评审希望命名体现「笔尖座位」，则冻结为一个名字并在两篇逐字引用（`03` 当前是此函数的属主，应少数服从已有实现）。

### R1-04 · P2 · `PhantomLandPayload.seat?` 只在 03 出现

- **位置**：`03 §2.5:120`（`PhantomLandPayload { … reused?: boolean; seat?: PhantomSeat }`）↔ `01 §6.2:299-307`（无 `seat`）。
- **问题**：`03` 的 `land` 声称「不传 `seat` 即保持原座位」（`03:122`），隐含 `seat` 是可选参数；`01`（属主）的 `PhantomLandPayload` **根本没有 `seat`**。`03 §3.2:160` 又写「**不传 `seat`**」——对 `01` 的形状而言这个「可传」从未存在。
- **证据**：`01:300-307` 与 `03:120` 逐字段比对；`03` 的 `seat` 是唯一多出的。
- **建议**：属主 `01` 决定：**要么**在 `PhantomLandPayload` 加 `seat?`（并说明「不传即保持」，与 `03` 对齐），**要么** `03` 删掉 `seat?` 与「不传 `seat`」措辞、改说「`land` 不接受座位」。当前 `03` 的调用不传它，运行时无害，但文档面必须二选一。

### R1-05 · P2 · 01 §6.1 的 chalk `register` 漏传 `layer`

- **位置**：`01 §6.1:240-243`（`phantoms.register(msg.toolCallId, { kind:'chalk', source:'writer', seat: … })`）↔ `01 §6.2:354`（`register(toolCallId, {kind:'chalk', seat, layer: layerRef.current})`）与 `03 §3.1:146`。
- **问题**：`01` 自己的两处不一致——§6.1 的代码块**不含 `layer`**，§6.2 的「谁调谁」表**含 `layer`**；而 `03`（复用方）与 `01 §6.2:348` 都断言「`layer` 缺省 = 不过滤」，一旦 chalk 幻影不带 `layer`，**换层后笔尖幻影会悬在其层**（`01:254` 原话「否则换层后幻影悬空」）。
- **证据**：`01:240-243` vs `01:354`；`03:151` 步 7 的层过滤依赖 `entry.layer`。
- **建议**：`01 §6.1` 的示例补上 `layer: layerRef.current`（与 §6.2 表、与 `03` 一致）。

### R1-06 · P2 · 「新增未登记模块违 §8」被 04 单方面采用，与四篇实际做法冲突

- **位置**：`04 §8.1:373`（「契约 §8 冻结了本批新增共享模块的**全部**名字……新增未登记模块会与『名字冻结』纪律冲突」）↔ `01 §4:196-197`、`02 §4:153-154`、`03 §4:221-223`、`05 §4.1:275`。
- **问题**：`04` 为「不建 `lib/canvas-patch.ts`」给出的理由，是 §8 的「名字冻结」**禁止**新增未登记模块。但 §8（`00:193-202`）只**冻结了 4 个名字**并说「这些名字一旦冻结，跨篇引用 MUST 逐字一致；改名前先广播」——**没有禁止新增**。其余四篇都新增了 §8 之外的模块：`01` 建 `WriterInkLayer.tsx`/`PhantomLayer.tsx`(03)/`GhostCard.tsx`(03)，`03` 建 `ghost.ts`，`02` 建 `dice-ceremony.ts`/`DiceCeremony.tsx`，`05` 建 `show-geometry.ts`。故 `04` 的论证在本批内部**自相矛盾**。
- **证据**：`00:193-202` 原文只列 4 名 + 引用一致性纪律；四篇的新建清单见上。
- **建议**：统一口径——**§8 是新模块的「登记表 + 引用一致性」契约，不是白名单**。要么 `04` 照建 `lib/canvas-patch.ts`（等价改法，`04 §12.1` 已自认），要么在 §8 注明「本表只冻结 4 个跨篇共用模块；篇内私有模块可自定名，但跨篇引用须逐字一致」。`04` 当前措辞会误导实现者以为建新文件违规。

### R1-07 · P2 · `PhantomLayer.tsx` / `GhostCard.tsx` 是跨篇产物，却不在 §8 冻结表

- **位置**：`01 §4:197-198`、`01 §6.6:443-445`、`03 §4:222-223`、`03 §8.2:364`、`03 §8.3:384` ↔ 契约 `§8:195-201`。
- **问题**：这两个模块**事实上是跨篇接口**（`01` 定义挂载规则、`03` 是属主、`01 §6.6:455-456` 的 `PhantomLayer` 直接 import 两者），却未进 §8 的 4 行表。于是「属主/路径/引用一致性」只能靠两篇口头约定（`01` 的 IRC 回执、`03 §2.5:129` 的备注）维系。
- **证据**：`03 §4:228` 与 `01 §6.6:463` 用「`Canvas.tsx` 里 `PhantomLayer`=1、`WriterInkLayer`=0」当判据——这正是**未登记接口**才会需要的临时判据。
- **建议**：把 `apps/web/src/components/canvas/PhantomLayer.tsx`（属主 03）、`apps/web/src/components/narrative/GhostCard.tsx`（属主 03）、`apps/web/src/components/performance/WriterInkLayer.tsx`（属主 01）**补进 §8 表**（与 R1-06 的登记口径一并解决）。好消息：两篇对这三个的**路径与属主已完全一致**（见 §3 复核），只是没登记。

### R1-08 · P2 · 同一锚点各篇引用行号不一致（且多数已漂移）

- **位置**：
  - Canvas 挂点：`01 §4:199`（`worldRef 渲染块（:464-484）`、`.map（:471-483）`）↔ `03 §4:224`（`Canvas.tsx:475-496`、`items.map :482-495`、插入 `:495` 之后）。**实读** `Canvas.tsx`：`worldRef` 块 `:475-496`、`items.map :482-495`、`</div>` 在 `:496`。→ `03` 与实际一致，**`01` 的行号是旧的**。
  - App 挂点：`05 §4.2:285`/`§8.4:512`（`:562` 的 `flex-1`、`<Canvas>` `:575-596`）、`02 §8:333-334`（listener `:152-178`、渲染 `:626` 旁）↔ **实读** `App.tsx`：`flex-1 h-full relative` 在 `:570`、`<Canvas>` 在 `:583-603`、`RadialMenu` 在 `:667`、`airp:character-frame` listener 在 `:167-184`。均对不上。
- **问题**：同一物理锚点，`01` 与 `03` 报不同行号；App 侧各篇行号普遍偏移 5–40 行。这不是「语义不一致」而是**引用不一致**——实现者按 `01` 的 `:471-483` 去挂 `<PhantomLayer />` 会挂错位置。
- **证据**：上列实读行号（`Canvas.tsx`、`App.tsx`）。
- **建议**：按 `06 §3`（`06:83-92`）已立的纪律——**改用「函数名 + 锚句」引用**（如「`Canvas.tsx` 的 `camera.worldRef` 块内、卡片 `.map` 之后」），并在实现后由 `06` 统一回填行号。至少 `01` 与 `03` 的 Canvas 行号应先对齐到 `03` 的现值。

### R1-09 · P3 · `register` 幂等合并的可更新字段集两篇措辞不同

- **位置**：`01 §6.2:344`（「只更新 `label`/`elapsedMs`/`layer`/`path`」）↔ `03 §2.5:121`（「只更新 `label`/`elapsedMs`」）。
- **问题**：`01` 把 `layer`/`path` 也算作可更新；`03` 只提 `label`/`elapsedMs`。`03 §3.1:146` 的心跳帧每次 `register` 都带 `layer`（常量），故运行时无差；但文档面两篇不一致。
- **建议**：以属主 `01` 的列表为准，`03` 的注释括注补齐（或 `01` 收敛为 `label`/`elapsedMs` 并说明 `layer`/`path` 仅首次写）。

### R1-10 · P3 · 契约 §6 的 `SHOW_REGISTRY` 名与实际常量不符

- **位置**：契约 `§6:157`（「`frame.component` ∈ `SHOW_REGISTRY` 的 7 个 id（`packages/shared/src/components/performances.ts:15-100`）」）↔ **实读** `performances.ts:15-105`（导出 `SHOWS: ShowDef[]` 与 `SHOW_IDS`；`SHOW_REGISTRY` 是 `components/registry.ts` 的另一个东西，`show.ts:6` import 自那里）。
- **问题**：把「7 个演出 id 清单」（`SHOWS`/`SHOW_IDS`）与「组件注册表」（`SHOW_REGISTRY`）混称。`05 §2.2:66`、`§1:17` 引用的是 `performances.ts` 与 `SHOW_IDS`（`05 §10.3:590` 用 `resolveShowKind`），措辞正确。
- **建议**：契约 §6 改称「`SHOW_IDS`（`performances.ts`）的 7 个 id」；`SHOW_REGISTRY` 若要引用则指向 `components/registry.ts`。

### R1-11 · P3 · `TUMBLE_ROT` 是不存在的符号

- **位置**：`02 §4:162`（「`CHARGE_MS`/`ROLL_MS`/`SETTLE_MS`/`TUMBLE_ROT`/`FACES` 的导出化」）↔ `02 §8:335`（只导 `:19 ROLL_MS / :20 SETTLE_MS / :23 FACES`）↔ **实读** `DiceRoller.tsx`：只有 `CHARGE_MS:16` / `ROLL_MS:19` / `SETTLE_MS:20` / `FACES:23`，**无 `TUMBLE_ROT`**。
- **问题**：`02` 内部两处不一致（§4 列 5 个、§8 列 3 个），且 `TUMBLE_ROT` 在源码不存在（违反「只引用真实符号」）。属 02 内部，非跨篇。
- **建议**：删 `TUMBLE_ROT`；§4 与 §8 的导出清单对齐为 `{CHARGE_MS, ROLL_MS, SETTLE_MS, FACES}`（`DiceCeremony.tsx` 实际只 import `{ROLL_MS, SETTLE_MS, FACES}`，见 `02:344`）。

---

## 3. 独立复核项（实读源码后的确认 / 推翻）

1. **`writer_delta` 现状映射 `text_delta`（契约 §3 裁决 A，本批最贵）—— 确认成立。**
   `apps/server/src/engine/event-bridge.ts:64-74`：`case 'message_update'` 只判 `assistantEvent?.type === 'text_delta' && assistantEvent.delta`，对 `source==='writer'` 产 `writer_delta`（`:68`）。叙事正文入口确为 `chalk` 工具参数：`extensions/instructions.ts:74-79` 逐字「text that lives only in your reply never reaches the player, and the canvas stays empty」；`extensions/toolkit/chalk.ts:41-46` 的 `parameters.content` 是唯一正文字段。**契约 §3 的修正方向（改走 `toolcall_end(chalk)` 的 `content` 增量）在语义上正确**，本批推翻的正是 `:66-71` 的现状行为。
   > 注：既有测试 `apps/server/test/map-engine-event.test.mjs:219-221` 逐字断言 `frames('writer', {…text_delta})` → `[{type:'writer_delta', source:'writer', delta:'hi'}]`，与契约 §6b-7 的点名一致；`:225-227` 的角色断言不变。此条跨篇一致。

2. **`PhantomLayer` 属主与路径 —— 两篇实际一致，无矛盾。**
   `01 §4:197`/`§6.6:443` 与 `03 §4:222`/`§8.2:364` **都**写 `apps/web/src/components/canvas/PhantomLayer.tsx`、**都**记属主 `03`（不是 `performance/`）。`ChalkMark` 归 `01`（`performance/WriterInkLayer.tsx`，`01:196`；`03:222` 说「来自 01 的 `performance/WriterInkLayer.tsx`」）、`GhostCard` 归 `03`（`narrative/GhostCard.tsx`，`01:198`、`03:223`）——**一致**。题目里的「可能矛盾」经核实**不成立**；真正的问题只在 props 签名（R1-01）与登记缺失（R1-07）。

3. **契约 §8 的 4 个冻结模块名跨篇逐字一致 —— 确认。**
   `lib/phantom.ts`（`00:197`/`01:5,194`/`03:98,220`）、`lib/writer-state.ts`（`00:198`/`01:5,195`）、`components/performance/PerformanceLayer.tsx`（`00:199`/`05:5,275`）、`engine/chalk-delta.ts`（`00:200`/`01:5,190`）——路径字面量逐字相同。

4. **门禁消解条数 = 9 —— 确认。**
   契约 `§10:221`：`01`=4（`01 §10.1:560`）、`02`=1（`02 §10.1:457`）、`03`=2（`03 §10.1:493`）、`04`=1（`04 §10.1:420`）、`05`=1（`05 §9:524`）。4+1+2+1+1=9，与基线 `findings:9` 相符。各篇自报的中间基线（`03` 说 9→7、`02`/`04` 说 11→12、`05` 说 9→8）是各自的独立投影，互不冲突。

5. **`dice_result` 全字段 —— 确认。**
   `event-bridge.ts:152-166` 与 `02 §2.1:26-46`、契约 `§4:133` 三方逐字段一致：`{type, source, path, name, dice, desc, expect, result, passed, rolls, crit, fumble, layer}` + `push` 补 `timestamp`（`characterId` 仅角色车道，`event-bridge.ts:56-61`）。`02:68` 明说「帧里没有 `forged`」，与 `:152-166` 一致。

6. **`show_frame` 的 `ShowFrame` —— 确认。**
   `packages/shared/src/actions/show.ts:21-33` 与 `05 §2.1:32-46` 逐字段一致（`type/component/target?/targetName?/links?/params/durationMs/caption?/actor/timestamp?`）；`event-bridge.ts:168-176` 逐字广播 `details.frame`（结构性标记 `bridge.includes('details.frame')`，门禁认它）。

7. **`LinkLayer.tsx` 导出面（04 与 05 都碰）—— 签名相容，无冲突。**
   `04 §8.3:381-386` 只改**内部** `LINK_STROKES`（`LinkLayer.tsx:37-42`，非导出）与 `:186-194` 的 stroke 赋值；`05 §8.2:487-493` **新增** `export handDrawnPath(...)`、`export cardGeometry(path)`。两者无同名导出、无签名交叠，且 `05:283` 明说「只加导出，不改 `registry`/`buildPaths`/`updateAllLinks`/`refreshLinkArchives`/`highlightLinks`」。**兼容**。
   > 另：`04 §8.2:379` 要求新增 `export function cardGeometry`（`05` 提供）与 `05 §3.4:194` 的 `cardEl` 选择器「与 `LinkLayer.tsx:116-123` 的 `elForPath` 逐字同构」——实读 `elForPath` 用 `document.querySelector('.object[data-path="${CSS.escape(path)}"]')` + `try/catch`，`05:184-191` 的 `cardEl` 逐字相同。**一致**。

8. **新建文件撞车 —— 无。** 各篇的新建清单互不重叠（`PhantomLayer.tsx`/`GhostCard.tsx` 两篇都写，但**都归 03**，是同一份而非两份）。

---

## 4. 未通过项 / 不能核验项

**不能核验（需实现后才能验，且属跨篇契约的机械核验点）**：

- **`phantomSeatFor` / `nextInkSeat` 真正落地后的命名**（R1-03）：设计期只是两份文档的口径，无法在源码核验（`phantom.ts` 尚不存在，`glob` 零命中，`03 §12.4:589` 自认依赖 `01` 先落地）。
- **`PhantomLayer` 的 props 在实现后的实际形状**（R1-01）：同因，组件未建。
- **`entry.reused` 的传递链**（R1-02）：需 `land` 把 `reused` 写进 entry 后才能单测断言（`03 §10.2` 的单测表里**没有** `reused` 的纯函数用例，只有用例 #4 的浏览器判据）。
- **行号锚点的最终值**（R1-08）：`06 §3:81-92` 已把「实现后复核回填」列为纪律，本评审只能指出当前偏差，不能替实现回填。

**未通过的门禁条件**：无（本评审不跑 `pnpm check:ws`；基线数字取自契约与各篇实跑记录，主 agent 验收阶段统一跑）。

**`[推断]` / 「待拍板」项的跨篇处置**：

- `01 §11.6:613` / `§12.5:623` 要求契约 §8 **补 `phantom.ts` 的 `label?`/`elapsedMs?`/`layer?`**；`03 §12.4:589` 依赖同一冻结面。**两篇一致，且 R1-02 证明还需再补 `reused?`**。**应在实现前拍板**：这是 `01`/`03` 的共同前提，`03` 的代码直接 `register({… layer, label, elapsedMs})`——不补则 `03` 的调用序列无冻结依据。
- `03 §11 冲突 7:151`（`layer` 不入帧、由调用方补）与 `01 §12.5:623` 同题同结论，**两篇一致**；本批不做服务端改载荷，登记一致。
- `02 §12.5:545`（`roll_ceremony` + `dice_result` 无需显式握手）与 `05 附:709`（`roll_ceremony` 只演入场）**一致**；相机/压暗的归属在 `02 §11.6:528-532` 与 `05 附:703-709` 双向互认，**无冲突**。
- `03 §12.3:588`（`reused` 是否短路 provider 调用）**与本批联动**，`03` 已标「必须一起裁决」——应实现前拍板（否则 `03 §3.4` 的「进度帧照常流」可能被推翻）。
- `01 §12.4:622`（写作中切层是否本批做幻影撤回）与 `03 §3.1 步 7:151`/`03:319`（切层不清理注册表、切回来还在）**口径不同但对象不同**：`01` 说的是「写了一半的旁白原地擦掉」（`doc-06 §2.3:83`），`03` 说的是「生图还在跑，注册表不清理」。**建议**：在契约 §5 或 `01` 把两者分开写明（撤回 = 未落定的 chalk 幻影；image 幻影不撤），否则实现者可能对两条车道做同一种处理。
- `02 §12.1:537`、`05 §12.1-12.7:677-695`、`04 §12:518-526` 的待拍板项均为**篇内**取舍，无跨篇冲突，但 `05 §12.6:693`（`show-geometry.ts` 是否单列）与 `04 §12.1:518`（纯函数落点）是同一种「新增私有模块」问题——**与 R1-06 的登记口径一并裁决即可**。

**核验方法（供复跑）**：
1. 模块名逐字：`grep -n "phantom.ts\|writer-state.ts\|PerformanceLayer.tsx\|chalk-delta.ts\|PhantomLayer.tsx\|GhostCard.tsx\|WriterInkLayer.tsx\|ghost.ts\|show-geometry.ts" docs/perform/0*.md`。
2. 帧字段：`grep -n "writer_delta\|dice_result\|show_frame\|image_landed" docs/perform/0*.md` 与 `event-bridge.ts:64-195`、`docs/tools/12:565-591` 三方对读。
3. 门禁条数：`grep -n "findings\|消.*条\|DARK" docs/perform/0*.md`（01=4/02=1/03=2/04=1/05=1）。
4. 行号锚点：实读 `apps/web/src/components/canvas/Canvas.tsx:475-496`、`apps/web/src/App.tsx:167-184,570,583-603,667`。
5. 源码签名：`packages/shared/src/components/performances.ts:15-105`、`packages/shared/src/actions/show.ts:21-33`、`apps/web/src/components/narrative/DiceRoller.tsx:16-23`、`apps/web/src/lib/seat.ts:11-65`。
