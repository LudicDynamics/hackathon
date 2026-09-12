# docs/perform/REVIEW-R4 — 可实施性评审（只读）

> 2026-09-13。评审人视角：**拿着这六篇文档，另一个人能不能不猜测地写出来？**
> 门禁基线已实跑：`node tools/check-ws-contract.mjs --json` → `{contract:24, emitted:24, consumed:11, findings:9}`，9 条全 `dark`，与文档自述一致。
> 所有源码断言**实读复核**（未采信文档自述）。只评审、不改任何文件。

---

## 1. 结论

**需回写后再放行（局部阻断 `01`/`05`）。**

- **`02`、`04` 可以基本直接开写**：符号闭环、落点精确到行（`04` 的行号实读全部命中）。
- **`03` 可开写，但须先与 `01` 对齐 `PhantomLayer` 的 props 签名**（同一组件两份定义，见 F-1）。
- **`01` 阻断**：用了未定义的 `nextInkSeat`（F-2），且它对 `PhantomLayer` 的自述代码与属主 `03` 冲突（F-1）。
- **`05` 阻断**：单测表引用了 **8 个从未定义**的纯函数（F-3），且这些函数的落点文件 `show-geometry.ts` 被 `§4.1` 标为「默认不建」——自相矛盾。
- **全批一条共性缺陷（P1）**：契约的硬完成判据 `node --test packages/shared/test/ apps/server/test/ tools/check-*.test.mjs` **不包含 `apps/web/test/`**，而 `01/02/03/04/05` 的 5 个新测试里有 4 个落在 `apps/web/test/`——门禁全绿**不证明**这些单测跑过（F-0）。

一句话回答「能否直接开写」：**02/04 能；03 先对齐 PhantomLayer；01/05 必须先补悬空符号。**

---

## 2. Findings

| 编号 | 严重度 | 位置 | 问题 | 证据 | 建议 |
|---|---|---|---|---|---|
| **F-0** | **P1** | 契约 `docs/perform/00 §1:42`；`01 §10.3:599`、`02 §10.3:485`、`03 §10.2:497`、`04 §10.3:445`、`05 §10.3:584` | 硬完成判据的命令**不含 `apps/web/test/`**，导致 `01` 的 `phantom.test.mjs`、`03` 的 `ghost.test.mjs`、`02` 的 `dice-ceremony.test.mjs`、`04` 的 `canvas-patch.test.mjs`、`05` 的 `show-frame.test.mjs` 全部**不在验收命令里**；五篇却都把 `node --test` 当硬验收 | 契约原文：`pnpm build && node --test packages/shared/test/ apps/server/test/ tools/check-*.test.mjs`；实读 `apps/web/package.json` **无 `test` 脚本**，根 `package.json` 亦无 `test` 脚本聚合它 | 契约 §1 的命令补 `apps/web/test/`（或各篇把「门禁」与「单测」的归属写清，别把未运行的测试当验收） |
| **F-1** | **P1** | `01 §6.6:449-460` vs `03 §8.2:364-377` | **同一 `PhantomLayer.tsx` 两份互相冲突的定义**。`01` 写 `export const PhantomLayer: React.FC = () => {...}`（无 props、无层过滤）；`03` 写 `PhantomLayerProps { currentLayer: string; bgSrc: string \| null }` 且要求 `filter(ghostVisibleOn(p.layer, currentLayer))` 与 `bgSrc` 退场观察。两处无法同时成立 | `01:449` 无参组件 + `01:453` 直接 `phantoms.map`；`03:367-371` 声明两 prop、`03:379` 过滤+`03:380` 退场；挂点 `01:463` 判据「Canvas 里 PhantomLayer 出现 1 次」与 `03:224` 的 `<PhantomLayer currentLayer={currentLayer} bgSrc={bg.src} />` 传参矛盾 | 以属主 `03` 的 props 版为准，`01` 删掉 §6.6 里的 `PhantomLayer` 代码块（只留「由 03 挂载、我只导出 `ChalkMark`」），并把挂点签名统一为带 `currentLayer`/`bgSrc` |
| **F-2** | **P1** | `01 §6.1:242` | **悬空符号 `nextInkSeat(stateRef.current)`**：在 `case 'chalk_writing'` 代码里被调用，但全篇（全批）**从未给出签名或落点**。`seat` 的生成规则只在旁注说「`lib/seat.ts` 的 `seatSpiral`」，从 `seatSpiral` 到 `nextInkSeat` 这一步没有桥 | grep `nextInkSeat` 全 `docs/perform/` 仅命中 `01:242` 一处；`apps/web/src/lib/seat.ts` 只导出 `seatSpiral`/`SEAT_ANCHOR`/`SEAT_STEP`/`SEAT_MAX_CANDIDATES` | 二选一：删掉 `nextInkSeat`，在 `case` 里直接调 `seatSpiral(SEAT_ANCHOR, occupied, w, h)`；或给出 `nextInkSeat` 的 `NEW` 签名与落点（含 `occupied` 来源——`01` 没像 `03 §8.5` 那样说明如何排除已占座位） |
| **F-3** | **P1** | `05 §10.3:588-607` | 单测表引用 `resolveShowKind`/`evidenceLinks`/`clampBursts`/`clampStagger`/`spotlightDim`/`lightsOutDim`/`zoomOf`/`inkToneOf` **8 个函数**，全文**无一处给签名**，且 `§4.1:276` 说承载它们的 `show-geometry.ts`「**默认不建**」——测试要 import 一个按设计不存在的文件 | `05:590-607` 逐行用例；`05:276`「默认不建（YAGNI）」；`05:586` 又说测试 `jiti.import('../src/lib/show-geometry.ts')` | 把 `show-geometry.ts` 从「默认不建」改成**冻结新建**（`§8` 给出 8 个函数的签名，如 `resolveShowKind(id: unknown): ShowKind \| null`、`evidenceLinks(frame): string[]`、`clampBursts(n?: number): number`），否则删除测试表里对这些符号的依赖 |
| **F-4** | **P2** | `01 §6.2:357` + `03 §6:293-295` | `tool_end` 分支被两篇同时改，**判定条件不一致**：`01` 写「writer + isError」→ `evict`，`03` 给的是**不限 source** 的 `if (msg.isError === true && typeof msg.toolCallId === 'string') evict(...)`。同一行段两份改法，谁落谁赢 | `01:357` 表格「`tool_end`（writer + isError）」；`03:293` 无 source 守卫 | `03` 的宽条件是对的（`generate_image` 本就 writer 车道），在 `03` 注明「此分支取代 `01` 描述的窄条件」；`01` 的表格删掉该行，指向 `03` |
| **F-5** | **P2** | `05 §3.3:161-169` vs `05 §8.1:473-481` | 7 个渲染函数**签名不一致**：§3.3 表用 `(frame, root)` / `(frame)` / `(frame, camera)`；§8.1 统一声明为 `(f: ShowFrame, ctx: ShowCtx) => () => void`。且 `ShowCtx` 类型**从未定义** | `05:473-479` 各函数分别 `(frame, root: HTMLElement)`／`(frame)`／`(frame, camera: CameraApi)`；`05:481` `Record<string, (f: ShowFrame, ctx: ShowCtx) => () => void>`；`ShowCtx` 全文仅此一处出现 | 冻结一种签名（推荐 §8.1 的 `(frame, ctx)` 统一式），并在 `§8.1` 给出 `interface ShowCtx { root: HTMLElement; camera: CameraApi; still: boolean }`（`§3.7:261` 已提到 `ctx` 要加 `still`） |
| **F-6** | **P2** | `02 §4:162` | 列出的待导出常量含 **`TUMBLE_ROT`**，但 `DiceRoller.tsx` **没有这个符号** | 实读 `DiceRoller.tsx:14-21`：`CHARGE_MS/TAP_MS/AUTO_FILL_MS/ROLL_MS/SETTLE_MS/IDLE_TILT`，无 `TUMBLE_ROT`；grep 全仓 `TUMBLE_ROT` 零命中（`02:162` 是唯一出处） | 删掉 `TUMBLE_ROT`（§8:344 的 import 实际只用 `ROLL_MS/SETTLE_MS/FACES`，未受影响） |
| **F-7** | **P2** | `01 §4:192-193` + `§6b-7`（契约） | `mapEngineEvent` 如何拿到新增的 `toolcallBuf` **未写清**。`01:87` 只说「像 `toolArgsByCallId` 一样挂在 `EventBridge` 上，`mapEngineEvent` 通过参数拿到」——但现有签名是 `(source, event, toolArgs, characterId?)`，要加第 5 个参数还是复用一个 Map 里塞？测试 `map-engine-event.test.mjs:13-15` 用 4 参调用该纯函数 | 实读 `event-bridge.ts:46-51` 签名 4 参；`event-bridge.ts:255` 调用点 4 参 | 明确「`mapEngineEvent` 加第 5 个可选参 `toolcallBuf?: Map<number,string[]>`，`emitEngine` 传 `this.toolcallBuf`」，并在 `§10.3` 说明测试如何驱动缓冲（现有测试用 3 处传参，需同步扩） |
| **F-8** | **P2** | `04 §8.3:381-386` + `05 §8.2:487-494` | **`LinkLayer.tsx` 被两篇同改，两篇互不引用对方**。`04` 改 `LINK_STROKES:37-42` 与 `:186-194`（stroke 逻辑）；`05` 加 `export handDrawnPath`（包 `roadPath:70-80`）+ `export cardGeometry`（包 `elForPath/readBox:116-130`）。区域不重叠，但**没有一句「谁先改、如何合并」** | `04:385-386`；`05:283`「只加导出，已与主 agent IRC 冻结」——只说了与主 agent，没提 `04` | 两篇各加一句交叉引用（同一文件两个不相交区域，可并行），或由主 agent 在批次协调里指名 `LinkLayer.tsx` 的编辑顺序 |
| **F-9** | **P2** | `01 §6.6:438`、`00 §2.3:63`、`04 §8.2:377` | **同一 `Canvas.tsx` 的行号漂移且互不一致**。`01` 说挂点 `:464-484`、卡片 `.map` `:471-483`；`03` 说 `:475-496`、插入 `:495`；实读：`worldRef` 在 `475`、`items.map` 在 `482-495`。`00 §2.3` 说「`Canvas.tsx:130-132` 注释」实为 `138-140` | 实读 `Canvas.tsx:475/482-495`；`Canvas.tsx:138-143` 的 `clearAllLifts` 注释 | 以「语义锚」为准（`worldRef` 块内、卡片 `.map` 之后），实现期按 `grep -n "items.map" Canvas.tsx` 定位（`06 §3:89` 已立此纪律）；`01` 的旧行号删掉 |
| **F-10** | **P3** | `04 §10.1:420` | 措辞自相矛盾：单篇断言 `summary.findings === 0`，同时写「本篇消 1」。单篇不可能归零 | `04:420`「`findings === 0`（本批 9→0；本篇消 1）」；对比 `03 §10.1:494` 正确地写「本批不是归零篇」 | 改成「本篇消 1（9→8），全批归零由五篇合并达成」 |
| **F-11** | **P3** | `01 §7:507`、`§12:622` | `evictOrphans`（`01:507`）与 `phantom.clearAll()`（`01:622`）被使用/提议但无定义；前者「供测试断言」却不在 `§10.3` 的断言清单里 | `01:507`；`01:600-602` 单测清单无 `evictOrphans` | `evictOrphans` 要么给出导出签名并进单测，要么删掉；`clearAll` 是 `§12` 待拍板项，标注「若采纳需新增导出」 |

---

## 3. 独立复核项（实读源码，对设计核心断言的确认 / 推翻）

### 3.1 `writer_delta` 来源流修正（本批最贵断言）—— **确认成立**

- `extensions/instructions.ts:74-79` 逐字：`chalk lands a real markdown file on the canvas and records the world event; text that lives only in your reply never reaches the player, and the canvas stays empty.` → **确认**正文不在 `text_delta`。契约 §3 的论断属实。
- `extensions/toolkit/chalk.ts:41-46`：`parameters` 首字段为 `content`（`Type.Object({ content, path?, link_to?, append_to? })`，typebox 保声明序）→ **确认**「chalk 参数 JSON 以 `{"content":` 开头」的结构依据。
- RPC 剥 `partial`：`vendor/pi-rp/packages/coding-agent/dist/modes/json-event.js:12` 逐字 `const { partial: _partial, ...deltaEvent } = assistantMessageEvent;` → **确认** `toolcall_delta` 到 `mapEngineEvent` 时只有 `{type, contentIndex, delta}`。
- 事件形状：`vendor/pi-rp/packages/ai/dist/types.d.ts:430-439` 的 `toolcall_end` 带 `toolCall: ToolCall`；`ToolCall`（`:246-254`）= `{ type, id, name, arguments, ... }` → **确认** `toolcall_end.toolCall.name` 是唯一可靠的「事后工具名」锚点。
- `agent-loop.js:210-224` 把 `toolcall_start/delta/end` 原样包成 `message_update` → **确认**服务端确实会在 `message_update` 分支收到它们。
- 结论：**契约 §3 的三处 spike 与设计 `01 §3` 的判定路径（延迟确认 + `chalk-delta.ts` 提取器）可机械核验、可实施**。

### 3.2 门禁行为（各篇 `case` 落点是否真能让门禁归零）—— **逐篇确认**

- `tools/check-ws-contract.mjs:48` `CONSUMERS = ['apps/web/src/state/useWorld.ts']`；`:124-134` `consumedFrom` 只扫该文件里的 `case 'x'` / `msg.type === 'x'`。五篇**全部**把新 `case` 放在 `useWorld.ts`（`01 §6.0:230`、`02 §6.1:191`、`03 §6:250`、`04 §6.0:277`、`05 §6.0:380`）→ **确认门禁能变绿**，无一篇把消费点放在别的文件。
- `show_frame` 的 emitted 靠 `:243-246` 的 `bridge.includes('details.frame')` 结构性标记（`05 §10.1:544` 断言正确）→ **确认**。
- `KNOWN_DARK`/`CONSUMERS` 均**不需改**（`04 §6.0:279`、`03 §9:480` 的说法正确）：`:193-194` 里 `consumed` 命中即 `continue` → **确认**。

### 3.3 `appendEvent` 零命中判据 —— **确认**

`grep -c appendEvent apps/server/src/engine/event-bridge.ts` = **1**，且该唯一命中在 `:265` 的**注释**里（`01 §5:220`、`04 §5:269` 的「零调用」断言成立）。`event-bridge.ts` 只调 `getEventsSince`/`getMaxSeq`（`:280`/`:288`）→ **确认**「演出帧不落账」的机械判据可核验。

### 3.4 既有测试的假绿风险 —— **确认**

`apps/server/test/map-engine-event.test.mjs:219-221` 确实断言 `frames('writer', {text_delta})` → `writer_delta`（正是本批推翻的行为）；`:211-213`/`:225-227` 的角色断言走 `text_delta` 不变 → **确认**契约 §6b-7 的改写要求准确。grep 全仓 `writer_delta` 测试断言仅此一处（`tools/check-ws-contract.mjs:72/158` 是门禁自身）→ **无遗漏的旧断言**。

### 3.5 前端测试载入法可行性 —— **确认**

实跑 `jiti.import('./apps/web/src/state/useWorld.ts')` → `OK keys ['useWorld']`（React 依赖可被 jiti 解析）。→ `04 §10.3:445` 声称的「jiti 可导入，纯函数必须具名 export」**成立**；`01` 的 `phantom.test.mjs`（import `phantom.ts`）、`02` 的 `dice-ceremony.test.mjs`、`03` 的 `ghost.test.mjs` 同法可行。唯 `05` 需要 jiti 处理 `.tsx`（JSX），`05 §12.6:693` 已自认 `[推断]`——但见 F-3，它的测试目标文件本身不存在。

### 3.6 `DiceRoller` 常量 —— **部分推翻**

`ROLL_MS`/`SETTLE_MS`/`CHARGE_MS`/`FACES` 实存（`DiceRoller.tsx:16/19/20/23`）；`TUMBLE_ROT` **不存在**（见 F-6）。`02 §8:344` 的 import 清单实际正确（未含 `TUMBLE_ROT`），故该错误是 §4 散文里的噪音，非阻断。

### 3.7 `02` 的 `App.tsx` 锚点 —— **行号漂移**

`02 §4:155`/`§8.1:413` 说 `:626` 旁、`:668`；实读 `App.tsx` 的 `RadialMenu` 在 `:667`、`WriterBar` 在 `:612`、`flex-1 h-full relative` 在 `:570`。语义锚（RadialMenu 之后、App 根 div 内）清楚，行号需实现期回填。`02 §6.3:268` 的 `App.tsx:70`（`world.layer`）实为 `:68`（`currentLayer` 解构于 `:69`）——轻微漂移，不影响可实施性。

---

## 4. 交付表：第 N 篇 → 新增/修改符号 → 是否已定义 → 落点精确度

图例：✅ 已定义且有落点 ｜ ⚠️ 已定义但落点弱/仅散文 ｜ ❌ 悬空（引用了但未定义）

| 篇 | 新增 / 修改符号 | 是否已定义 | 落点精确度 |
|---|---|---|---|
| **01** | `chalk-delta.ts::extractContentPrefix` | ✅ `§3.3:129` 全签名 | 文件+函数 ✅ |
| | `replayFragments` | ⚠️ `§4:193` 仅示意签名 | 模块级私有，文件 ✅ |
| | `EventBridge.toolcallBuf` | ✅ `§4:192` 给出声明 | `:209` 旁 ✅ |
| | `phantom.ts` 8 个导出 + 2 个 interface | ✅ `§6.2:256-327` 全签名 | 新文件 ✅ |
| | `writer-state.ts` 5 个导出 + 2 个 interface | ✅ `§6.4:386-404` | 新文件 ✅ |
| | `WriterInkLayer.tsx::ChalkMark` | ⚠️ `§6.6:465-472` 只有形状描述、无 TS 签名 | 文件 ✅、props 未定类型 |
| | `nextInkSeat` | ❌ **悬空**（F-2） | 无 |
| | `evictOrphans` | ❌ 悬空（F-11） | 无 |
| | `.chalk--ghost`/`.ink-tip`/`.ghost--evicting` | ⚠️ 只给 `.chalk--ghost` 属性，另两个无色值 | `index.css:234-274` 后 ✅ |
| | `PhantomLayer.tsx`（自述代码） | ⚠️ 与 `03` 冲突（F-1） | Canvas 挂点行号漂（F-9） |
| | `useWorld` 4 个 case | ⚠️ 无插入位置锚点 | switch 内 ✅（弱） |
| **02** | `dice-ceremony.ts` 7 个导出 + `DiceFrameVerdict` | ✅ `§6.2:215-248` 全签名 | 新文件 ✅ |
| | `DiceCeremony.tsx::DiceCeremony` | ✅ `§8:342-358` | 新文件 ✅ |
| | `App.tsx` listener + ceremony state + 渲染 | ✅ `§8.1:397-421` 给代码 | `:626`/`:668` 旁（行漂） |
| | `DiceRoller` 的 export 化 | ✅ `§11.3`（含 `TUMBLE_ROT` ❌，F-6） | `:19/:20/:23` ✅ |
| | `useWorld` `case 'dice_result'` | ✅ | `character_*` 之后、`default` 之前 ✅ |
| | `.dice-stage`/`.dice-face-tile`/`.dice-ceremony--ambient` | ✅ 命名 | `index.css:652` 后 ✅ |
| **03** | `ghost.ts` 3 函数 + 5 常量 | ✅ `§8.1:329-353` 全签名 | 新文件 ✅ |
| | `PhantomLayer.tsx` + props | ✅ `§8.2:364-377`（与 `01` 冲突，F-1） | `Canvas.tsx:495` 后 ✅ |
| | `GhostCard.tsx::GhostCard` | ✅ `§8.3:384-391` | 新文件 ✅ |
| | `phantomSeatFor` | ✅ `§8.5:418-443` 含实现 | `useWorld` 内私有 ✅ |
| | `asNum` | ✅ `§8.6:451-455` | ✅ |
| | `UI_COPY` 3 键 | ✅ `§8.6:458-464`（en/ja 齐） | `lib/i18n.ts:3` ✅ |
| | `.ghost-card*` / `@keyframes ghostShimmer` | ⚠️ 骨架体省略（结构级） | 文件尾 ✅ |
| | `useWorld` 2 个 case + `tool_end` 分支 | ✅ | `:322-386`/`:363-369`（行准确）✅ |
| **04** | `mergeItemPatch` | ✅ `§3.3:173-188` 含实现 | `useWorld.ts` 内 ✅ |
| | `mergeLinkPatch` | ⚠️ `§8.1:368` 有签名、无实现体（步骤在 §3.2） | `useWorld.ts` 内 ✅ |
| | `layerFetchCount` | ✅ `§8.1:369` | `fetchLayer:116-144` 内 ✅ |
| | `LayerLink` 扩 3 字段 | ✅ `§8.1:366` | `:24-30` ✅（实读命中） |
| | `LINK_STROKES` 六基元 + `directed` marker | ✅ `§8.3:385-386`（marker 规格 `[推断]` `§12.7`） | `:37-42`/`:186-194` ✅（实读命中） |
| | `route /api/layer` 加 3 列 | ✅ `§8.4:392` | `routes/world.ts:495-504` ✅ |
| | `Canvas.tsx [items]→updateAllLinks` | ✅ `§8.2:379` 给代码 | `:149` 后 ✅（实读命中） |
| | `useWorld` `case 'canvas_patched'` | ✅ `§6.1:284-312` 给代码 | `:359` 之后 ✅ |
| **05** | `PerformanceLayer.tsx` 模块态 4 导出 + `SHOW_RENDERERS` | ✅ `§8.1:467-481` | 新文件 ✅ |
| | 7 个 `showXxx` 函数 | ⚠️ 签名两处不一致（F-5） | 文件内 ✅ |
| | `ShowCtx` | ❌ **悬空**（F-5） | 无 |
| | `handDrawnPath`/`cardGeometry` | ✅ `§8.2:491-493` 全签名 | `LinkLayer.tsx:70-80`/`:116-130` ✅ |
| | `playBurst`/`BurstSpec` | ✅ `§4.4:330-339` | `ParticleLayer.tsx` 追加 ✅ |
| | `cardEl` | ✅ `§3.4:184-191` 给实现 | 模块内私有 ✅ |
| | `resolveShowKind` 等 **8 个** | ❌ **全悬空**（F-3） | `show-geometry.ts`「默认不建」❌ |
| | `useWorld` `case 'show_frame'` | ✅ `§8.3:503-506` | `default` 之前 ✅ |
| | `App.tsx` 挂 `<PerformanceLayer />` | ✅ `§8.4:512` | `:562` 主区（实为 `:570`，行漂） |
| | `motion.ts::useStill` 复用 | ✅ 既有 | — |

**悬空符号汇总**：`nextInkSeat`(01)、`evictOrphans`(01)、`ShowCtx`(05)、`resolveShowKind`/`evidenceLinks`/`clampBursts`/`clampStagger`/`spotlightDim`/`lightsOutDim`/`zoomOf`/`inkToneOf`(05)、`phantom.clearAll()`(01，待拍板项)、`TUMBLE_ROT`(02，源码中不存在)。

**落点冲突汇总**：
- `01 ↔ 03`：`PhantomLayer` props（F-1，**阻断**）、`tool_end` 分支条件（F-4）。
- `04 ↔ 05`：`LinkLayer.tsx` 两处不相交改动但无协调声明（F-8）。
- `01` 自述编辑 `PhantomLayer.tsx` 而属主是 `03`（F-1 根因）。

**新增测试撞车检查**：`chalk-delta.test.mjs`(server) / `phantom.test.mjs` / `ghost.test.mjs` / `dice-ceremony.test.mjs` / `canvas-patch.test.mjs` / `show-frame.test.mjs` —— **文件名两两不同，无撞车**；`01/03` 的 `phantom.test.mjs` 与 `ghost.test.mjs` 是**两个不同文件**，任务书担心的重复不成立。真正的缺口是 F-0（这些 `apps/web/test/` 测试不在硬验收命令内）。

---

## 5. 未通过项 / 不能核验项

| 项 | 为什么不能核验 |
|---|---|
| `05 §3.4:199` 「`elementBox` 返回世界坐标、`getBoundingClientRect` 是缩放后坐标」的**行为差异** | 只做静态阅读，未在浏览器实测两种读法；`measure.ts` 注释支持该说法，但未跑。标为**未核验（信文档+源码注释）** |
| `05 §12.1:677` 「`Canvas` viewport `overflow-hidden` 会把画布外光束裁掉」 | `05` 自己标 `[推断]`；需浏览器实测（`§10.2 判据 2` 会暴露），本轮未跑 |
| `04 §11.1` 的 `canvas.db-wal → file_changed` 实测 | 文档自述为 spike 实测；本轮未重复跑 fs.watch spike。**逻辑自洽**（`event-bridge.ts:365-377` 忽略名单确实不含 `canvas.db*`），按设计「两条通道互为兜底」接受 |
| `EXTRACTOR` 处理 `\uXXXX` 代理对（`01 §3.3:170`） | 纯算法阅读，未跑测试；`01 §10.3` 已列 13 例覆盖未闭合转义/非首字段，可核验性足够，留给实现期单测 |
| 门禁最终 `findings===0` | 设计**未实现**，无法端到端验证；本轮只验证了「落点在设计上会让 gate 变绿」（§3.2） |

---

## 6. 放行建议（一句话）

**`02`/`04` 直接开写；`03` 先与 `01` 冻结 `PhantomLayer` props；`01` 补 `nextInkSeat` 定义、`05` 补 8 个纯函数签名并把 `show-geometry.ts` 从「默认不建」改为「冻结新建」；同时修契约 §1 的验收命令补 `apps/web/test/`。** 上述 5 项（F-0/F-1/F-2/F-3 + F-4）落定后，全批可无猜测实施。
