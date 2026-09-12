# REVIEW-R4 — 验收可机械核验性审查

> 2026-09-13。审查对象：`docs/wiring/{01,02,03,04,05}.md` 的「验收测试」节 + 门禁覆盖范围。
> 方法：读全文门禁源码（`tools/check-ws-contract.mjs`、`tools/check-hooks-docs.mjs`），实跑基线，并用门禁自身的 `compare()` 合成 A 档三种落地态重算。
> 只读审查——本文件是唯一产物。

---

## 0. 实测基线（全部由本次实跑）

```
$ node tools/check-ws-contract.mjs --json
summary = { "contract": 24, "emitted": 24, "consumed": 8, "findings": 14 }   exit=1
findings = 2 GHOST (useWorld.ts:270 item_moved / :271 god_action)
         + 12 DARK  (writer_delta@58, character_delta@58, chalk_writing@79,
                     image_generation_progress@88, chalk_landed@115, canvas_patched@128,
                     dice_result@143, image_landed@169, writer_idle@183,
                     character_idle@183, world_event@280, show_frame@0)

$ node tools/check-hooks-docs.mjs
check-hooks-docs: clean (7 docs, 15 owned symbols, 55 cited paths)            exit=0
```

`consumed` 基线 8 = `file_changed, item_moved, god_action, world_frozen, world_thawed, card_position, tool_start, tool_end`（正则 `/(?:case\s+|msg\.type\s*===\s*)'([a-z][a-z_0-9]*)'/g`，`check-ws-contract.mjs:129`）。

用 `compare()` 合成重算（只读，不改仓）：

| 落地态 | consumed | findings | 剩余 |
|---|---|---|---|
| 基线 | 8 | **14** | +2 ghost |
| 仅 02 | 7 | **11** | 与 02 §10.1 一致 ✅ |
| 仅 A3（02 未落） | 10 | **12** | 与 03 §10.1 一致 ✅ |
| **A 全落（01+02+03）** | 9 | **9** | **9 条全是 DARK** ⚠️ |

A 全落后的 9 条 DARK 精确名单：
`writer_delta, chalk_writing, image_generation_progress, chalk_landed, canvas_patched, dice_result, image_landed, writer_idle, show_frame`。

---

## 1. Findings

### R4-1（P2，高置信）残余 DARK 计数承诺错 1：漏算 `writer_delta`

- **设计原话**：`docs/wiring/02-事件消费与去重.md:330` ——「A 档全部落地后剩余 **8 条** dark：`writer_idle`、`chalk_writing`、`chalk_landed`、`canvas_patched`、`image_generation_progress`、`image_landed`、`show_frame`、`dice_result`」；`docs/wiring/04-骰子与请求体.md:280` 同表同数（「残留的 **8 条** DARK」）。
- **实测**：A 全落后是 **9 条** DARK。12 DARK − (`world_event` + `character_delta` + `character_idle`) = 9。两份清单都**漏了 `writer_delta`**——而它恰恰在 `00 §1` 的「不做」清单里（`00-共同上下文.md:32`「`writer_delta` 的湿墨演出」），02 自己的 `:11` 也点名它归后续批次。
- **为什么核验不了/会误判**：这是一条**可被机械核验的数字承诺**，验收人跑 `pnpm check:ws` 会拿到 9 而非 8，判定验收失败；而实际设计没有错，只是清单漏列一项——验收流程会被一个纯记账错误拖红。
- **替代判据**：把两份清单补上 `writer_delta`，数字改 **9**；或干脆把「期望数字」写成从基线推导的公式：`剩余 = 12 DARK − A 档消掉的 DARK 数`，并由门禁输出直接比对。

### R4-2（P1，高置信）05 的「grep 零命中」判据自身不可满足

- **设计原话**：`docs/wiring/05-文档回写.md:159` ——「逐条 grep 原断言文本，**零命中**：例如 `grep -rn "sampleReplies" docs/` 应为空、`grep -rn "character_prompt.*空注释" docs/` 应为空」。
- **实测**：`grep -rn "sampleReplies" docs/` **今日就非空且回写后必然仍非空**——
  - `docs/wiring/05-文档回写.md:36,39,159`（05 自己逐字引用原断言）；
  - `docs/前端接线体检.md:165`（只读现状表，原文保留）。
  `character_prompt.*空注释` 同理：05 `:37,67,69,159`、体检 `:165,167`。
- **为什么核验不了/会误判**：判据要求的是「全 `docs/` 零命中」，但**写下这条判据的文件本身**和**只读的体检报告**都合法地保留了该短语。这条断言**永远为假**，是恒红门禁（`check-ws-contract.test.mjs` 明言恒红门禁「比没有更糟」）。回写是否真的完成，靠这条 grep 判不出来。
- **替代判据**：把扫描面收窄到**被回写的、且不应再含原断言的**目标文件与语义位置，例如：
  ```bash
  grep -n "sampleReplies" docs/前端改造计划.md docs/后端实现计划.md   # 应为空
  grep -n "character_prompt.*空注释" docs/前端改造计划.md             # 应为空（T3.1/T3.7 段）
  ```
  明确**排除** `docs/wiring/05-*.md`（引用方）与 `docs/前端接线体检.md`（只读现状）。

### R4-3（P1，高置信）05 §6.1 的 `check:docs` 对本批回写零覆盖

- **设计原话**：`docs/wiring/05-文档回写.md:158` ——「`pnpm check:docs` 通过（文档门禁：symbol ownership / barrel union / file:line 引用）」。
- **实测**：`check-hooks-docs.mjs:28` 硬编码 `HOOKS = path.join(REPO, 'docs/hooks')`，`:32` 只 `readdirSync(HOOKS)`。R2/R3/R4/R5 落在 `docs/前端改造计划.md`、R8 在 `docs/doc-21-事件表协议.md`、R9 在 `docs/后端实现计划.md`——**全部不在扫描面**。唯一被覆盖的 R1 已在 `commit ebacd6a` 完成，`docs/hooks/{00,03,06}` 已带「2026-09-12 核实更正」。
- **为什么核验不了/会误判**：C 档要求「门禁入检查流程」，但本批 C1 的 9 条里 **8 条没有任何门禁**；`check:docs` 覆盖不到 R2–R9，却让 `05 §6` 读起来像「回写有门禁」。R2–R9 若漏写，`check:docs` 依然 clean（今日即 clean）。
- **替代判据（具体可行）**：在 `check-hooks-docs.mjs` 旁加一节**「被推翻短语黑名单」**并让 `DOCH` 扩到 `docs/**`（该文件已具备通用文本扫描骨架）：
  - 常量表 `{ file, phrase }`：如 `{ 'docs/前端改造计划.md', 'sampleReplies' }`、`{ 'docs/后端实现计划.md', '只广播 file_changed' }`、`{ 'docs/doc-21-事件表协议.md', '按准入第 3 问删除' }`；
  - 扫描时**跳过白名单**（05 自身、体检、任何标注为「原断言」的引用块）。
  成本约 25–40 行，复用现有 report/summary 结构；收益是把 R2–R9 从「靠人 grep」变成可失败门禁。

### R4-4（P2，高置信）01 §10.2 的单测在没有先 build 的情况下跑不了

- **设计原话**：`docs/wiring/01-角色身份.md:318-326` 把新用例放进 `apps/server/test/map-engine-event.test.mjs`；`:338`（§10.4）「只跑 §10.1 的 `pnpm check:ws` 与 §10.2 的单测文件」。
- **实测**：该测试文件 `apps/server/test/map-engine-event.test.mjs:11` 是 `import { mapEngineEvent, messageText } from '../dist/engine/event-bridge.js'`——**从编译产物 import**。新增的 `characterId` 参数与 `characterIdFromClientKey` 导出只存在于 `src/`；不先 `pnpm --filter @airp/server build`，dist 仍是旧代码，新断言（`characterId === 'nanami'`、`characterIdFromClientKey` 的单测）会**要么断言失败、要么 import 不到符号直接报错**。
- **为什么核验不了/会误判**：§10.4 只说「跑单测文件」，`00 §10` 又说「跳过全量 build」，二者叠加会让验收人直接 `node --test` 而得到假红；更糟的是若 dist 恰好被别的步骤重建过，结果又随环境漂移（非确定性验收）。
- **替代判据**：§10.2/§10.4 明写前置命令 `pnpm --filter @airp/server build`（或 `tsc -b apps/server`），并声明「该单测读 dist，不是 src」；`01 §7` 的「已构建产物」行其实已意识到这点，但验收节没落。

### R4-5（P2，中高置信）04 §10.1 的 S3 用手打 `fetch` 验证「UI 出现可见错误行」，观察不到

- **设计原话**：`docs/wiring/04-骰子与请求体.md:270` ——「S3｜再对同一张卡发请求（刷新前按钮已消失 → 用 `fetch('/api/dice',{...body:{path}})` 打控制台）｜409；**UI 出现可见错误行**」。
- **实测**：`DiceRoller.tsx` 的 `error` 是组件 state，只在 `rollDie()` 的 async IIFE 内 `setError`；控制台手打的 `fetch` **不经过 `rollDie`**，不会写该 state，因此不会有错误行。且 S1 之后 `rolled` 已被 `settleIfReady` 置值（`:117`），卡片渲染结果分支、无「Roll the Dice」按钮（`:260`），UI 上也**无法再触发一次 roll**。此外该 `fetch` 片段本身缺 `method/headers/body`（`{...body:{path}}` 展开的是键 `body`），默认 GET、body 非 JSON → 不可能得到 409。
- **为什么核验不了/会误判**：S3 声称的 UI 观察量与其描述的操作路径不自洽——拿不到 409，也拿不到错误行。409 这条错误码「对玩家可见」是本设计的主要卖点（§9 表第 2 行），却没有一条可执行的手测能证明它。
- **替代判据**：改成可从 UI 复现的路径：先在另一标签页/另一客户端对同一世界掷骰（落 frontmatter `result`），回到本端**刷新页面**→ 卡片以 `rollDice.result/passed` 早退（`:59-63`）→ 手动删掉本地 `rolled` 不可行，故更实际的是：用两个浏览器端口，A 端掷、B 端刷新前点「Roll the Dice」→ 命中 409 → 应见错误行。或直接接受「409 可见」由 U4/后续批次覆盖，删掉 S3 的 UI 部分。

### R4-6（P2，中高置信）03 §10.2 的 V8 依赖不存在的「断网重连」

- **设计原话**：`docs/wiring/03-角色流式.md:477` ——「V8｜**断网重连后**再发一句（`character_message` 单帧路径）｜台词一次落定」。
- **实测**：`useWorld.ts` 只有 `new WebSocket(...)`（`:258`）与 cleanup 的 `ws.close()`，**无 `onclose` 重连**（全仓 grep `重连`/`reconnect` 在 `apps/web` 零命中；`02 §12-4` 也把「WS 断线重连」列为不做）。断网后 WS 不会自愈；若靠刷新页面「重连」，Modal 与 `lineRef` 全部重置，收到的只会是正常 delta 流，而非 V8 要验的「delta 全丢、只有 `character_message`」路径。
- **为什么核验不了/会误判**：V8 声称覆盖「丢帧救援」这条设计卖点（步骤：`character_message` 单帧路径），但其前置条件（重连）在实现里不存在，观察路径也不可控。它作为验收项不可复现。
- **替代判据**：改用可直接注入的路径——在浏览器 console 里对 `window` 手动 `dispatchEvent(new CustomEvent('airp:character-frame', { detail: { type:'character_message', characterId:'nanami', text:'…' } }))`，断言「一次落定、不卡 thinking」。或明确把 V8 标为「不可自动化/需临时改代码注入，不列为放行判据」。

### R4-7（P2，中置信）A4 无机械门禁，且 04 提议的替代判据落点/判据不完整

- **设计原话**：`docs/wiring/04-骰子与请求体.md:283` ——「**本批不新建该脚本**…故 A4 的机械门禁只有 §10.1 的 S2」；提议形态「`tools/check-dice-body.test.mjs`（`node --test`）」或「`probe-tools.mjs` 的 HTTP 侧孪生」。
- **实测**：S2 是纯手测（看 DevTools Request Payload），无自动化。A4 修的是**本批次唯一的 P0 真 bug**（请求体键漂移，`DiceRoller.tsx:148-156` vs `routes/world.ts:684`），却恰是唯一无门禁的一项；而门禁哲学（`check-ws-contract.mjs` 头注）正是「无共享类型的两端靠门禁兜住漂移」。请求体键没有类型，属于同一类漂移。
- **评估与具体方案（成本/收益）**：
  - **方案 A（静态，推荐，低成本）**：新建 `tools/check-http-bodies.mjs`（或并入 `check-ws-contract.mjs` 成第二节）：纯函数提取 `DiceRoller.tsx` 中 `fetch('/api/dice', …)` 的 `JSON.stringify({...})` 键集合，断言 `deepEqual(keys, ['path'])`。成本 ~30 行 + 一条 `pnpm check:bodies`。判据：`DiceRoller.tsx` 的 body 键集合 == `['path']`。脆弱点：对格式重排敏感（可用 AST 或正则容忍空白缓解）。
  - **方案 B（HTTP 集成，中等成本）**：复用现成 `apps/server/test/smoke-routes.mjs`（已 mount 真 `createWorldRouter` 并走 HTTP），补一例：POST `/api/dice` with `{ filePath, rollType, expect }`（旧体）→ 断言 400，with `{ path }` → 断言 200。成本 ~20 行，**但只锁服务端一半**，锁不到前端发什么键。
  - **结论**：值得做，但**不是放行阻塞项**。若要「门禁入检查流程」才算 C 档达标，建议至少做方案 A（唯一能锁前端请求体键的手段），并把 `'dice_result'` 的归属在 `00 §1` 补一行（D1 已提），使验收数字闭合。

### R4-8（P3，中置信）02 §3.5 的「假绿」规避属实，但 §10.1 的判据仍不足以证明 switch 有 case

- **设计原话**：`docs/wiring/02-事件消费与去重.md` §3.5 + `:313-332` §10.1。
- **实测**：`consumedFrom`（`check-ws-contract.mjs:129`）确同时匹配 `case 'x'` 与 `msg.type === 'x'`——故若实现者按 `00 §5` 的**字面单表达式**把 `(msg.type === 'world_event' && …)` 留在 switch 之前，门禁会判 `world_event` 已消费 → 「DARK 消失」成立，但 switch 可能根本没有 `case 'world_event'`。02 §3.5 推荐「转发放进 case 内」确能规避，且 02 §11-3 已登记此弱点——**属已识别的设计选择，非隐藏缺陷**。
- **为什么仍记**：`02 §10.1` 的验收判据（「`world_event` 的 DARK 消失」）因此**不是**「switch 有 case」的充分证据；若实现偏离推荐排版（`00 §5` 原文就是单表达式），验收会假绿。建议判据补一句「并人工确认 `useWorld.ts` 的 `switch` 内有字面量 `case 'world_event'`」，或把 00 §5 的转发式样与 02 §3.5 的推荐式样统一，消除歧义。

### R4-9（P3，中置信）03 §10.1 声称的「独立核验」不可由主 agent 复跑

- **设计原话**：`docs/wiring/03-角色流式.md:449-453` ——「已独立核验（直接 import `compare()`…给 `consumed` 集加三个 `case` 后重算）：`after03: 剩余的 character_* findings: 0`」。
- **实测**：该合成脚本**未入库**（`tools/` 下无此脚本），只有一句粘贴的输出。本次审查用同样的合成法复现，结论与其一致（character_* 清零 ✅），但这是**一次性 ad-hoc 命令**，主 agent 在验收阶段无法一键复跑。
- **替代判据**：把该合成断言落成 `tools/check-ws-contract.test.mjs` 的一条用例（该文件已 import `compare()`，加一个「A3 后 `character_*` 清零」case 即可），使 03 §10.1 的判据可复跑。

---

## 2. 必查清单逐项回答

1. **计数能否同时成立**：**不能**。02 §10.1（仅 02=11）与 03 §10.1（仅 A3=12）各自自洽；但 02 §10.1 的跨篇备注（`02:330`）与 04 §10.2（`04:280`）承诺「A 全落剩 8 条 DARK」→ 实测 **9 条**（漏 `writer_delta`）。见 R4-1。
   - 「加 `case 'x'` 即算 consumed」的确切匹配：`/(?:case\s+|msg\.type\s*===\s*)'([a-z][a-z_0-9]*)'/g`（`check-ws-contract.mjs:129`）。03 §2.2「必须字面量」**核实属实**：`const F='x'; case F:` 不匹配（实测 `[]`），注释里的 `case 'item_moved'` 会误匹配（实测命中）——故删除死监听时**不能只注释掉**，必须删字符串。
   - 02 §3.5「转发放进 case 内可规避假绿」：**属实**（`consumedFrom` 同时匹配 `msg.type === 'x'`；解耦后不再有 switch 外的 `msg.type === 'world_event'`）。但验收判据仍不充分，见 R4-8。
   - `world_event` 是**帧名**（`{type:'world_event', event}`，`event-bridge.ts:280`），不是事件类型名（事件类型在 `event.type`，15 类）。门禁把 `:280` 报 DARK **合理**（前端无消费）；加 `case 'world_event'` 能消掉（实测：02 落地后 14→11，该条消失）。✅
2. **A4 无机械门禁**：见 R4-7（含落点、判据、成本/收益）。
3. **03 消费面在 check:ws 不可见**：属实且 03 §11-3 已承认。V1–V8 的覆盖评估：
   - 可手测确证：V1/V2/V3/V4/V5/V6（均可在 dev 动线上直接观察）。
   - **不可确证**：**V8**（依赖不存在的重连，见 R4-6）；V7 可行但需真实等 95s（且其「无可见报错」是当前设计的已知缺口，非「通过」）。
   - 且这 8 条**都不覆盖 `error` 帧 seam**（冲突 1 选择不实现），也不覆盖「App 订阅事件名拼错」这一门禁盲区（03 §11-3 自认）。故 V1–V8 **不足以**证明「端到端可通」；它只证明「帧到 App/Modal 后视觉正确」，不证明「订阅接线正确」。
4. **手测前置可复现性**：**已核对，均存在且如描述**——
   - `templates/holmes-world/world/baker-street/evening.md:3-6`：`roll_dice: {type: 1d100, desc: Deduction check, expect: ">50"}` ✅（04 §10.1 前置 + S2 的 `path` 期望值 `world/baker-street/evening.md` 与 `local-store.ts:232` 的 `path.relative(worldRoot,…)` 一致 ✅）。
   - `templates/firstsnow/world/intro/relationships/studio/README.md:7`：`roll_dice: {type: 1d6, expect: ">3"}` ✅（S4 + D2 引用行号吻合）。
   - `templates/firstsnow/characters/`：`nanami`、`sumi` 两个角色目录 ✅。
5. **05 的 grep 判据**：见 R4-2（不可满足）与 R4-3（`check:docs` 零覆盖）。同一短语在 05 自身与只读体检中合法出现 → 脆性直接表现为恒红。
6. **验收总清单**：见 §3。

---

## 3. 验收总清单（主 agent 验收阶段实跑）

| # | 命令 | 通过判据 | 期望数字 |
|---|---|---|---|
| G0 | `node tools/check-ws-contract.mjs --json` **（基线，改前存证）** | 与本文 §0 逐字一致 | `{contract:24, emitted:24, consumed:8, findings:14}`，exit 1 |
| G1 | `node tools/check-ws-contract.mjs` **（A 档落地后）** | **无** `item_moved`/`god_action` 两条 GHOST；**无** `world_event`/`character_delta`/`character_idle` 三条 DARK | **findings = 9**，全部为 DARK；`consumed = 9`；exit 1（A 档不要求归零） |
| G1b | 剩余 9 条 DARK 名单 | 逐字等于 `writer_delta, chalk_writing, image_generation_progress, chalk_landed, canvas_patched, dice_result, image_landed, writer_idle, show_frame` | **9 条**（**不是 8**，见 R4-1） |
| G2 | `node tools/check-hooks-docs.mjs` | `clean` | exit 0（本批落 `docs/wiring/**`，不在扫描面） |
| G3 | `pnpm --filter @airp/server build && node --test apps/server/test/map-engine-event.test.mjs` | 全部 pass；**必须先 build**（测试 import dist） | exit 0（见 R4-4） |
| G4 | `node --test tools/check-ws-contract.test.mjs` | 全部 pass（门禁非空性证明） | exit 0 |
| G5 | `grep -n "sampleReplies" docs/前端改造计划.md docs/后端实现计划.md` | **零命中**（**排除** `docs/wiring/05-*.md`、`docs/前端接线体检.md`） | 0 行（见 R4-2） |
| G6 | `grep -n "character_prompt.*空注释" docs/前端改造计划.md` | 零命中 | 0 行 |
| G7 | `grep -rn "world/baker-street/evening.md" templates/holmes-world/...` 存在性（前置核对） | 文件含 `roll_dice` | 已核 ✅ |
| G8 | 手测 S1/S2/S4/S5/S6（04）、V1–V7（03）、01 §10.3 | 见各表；**S3 与 V8 需按 R4-5/R4-6 修正后才能计为判据** | — |

**放行门槛建议**：G1 的剩余名单与数量（9）必须先与 §R4-1 更正后的文档一致，否则「验收失败」会是记账错误而非实现错误。

---

## 4. 是否放行实现

**判断：可放行实现，但须先做 3 处文档回写（不阻塞编码，只阻塞「验收本身可信」）。**

理由：本批的**核心机械门禁判据（G1）成立且可复跑**——02/03 的 `check:ws` 承诺（GHOST×2 + 三条 DARK 消失）经 `compare()` 合成复算验证为真；01/03 的接缝与帧名清单一致；04 的兼容性证明逐条代入无误。挡路的不是设计正确性，而是**验收判据自身的可核验性**，且集中在文档记账层：

1. **R4-1**（P2）：02/04 的残余 DARK 计数 8 → **9**，补 `writer_delta`（否则验收必假红）。
2. **R4-2 + R4-3**（P1）：05 的「零命中」grep 收窄扫描面并排除引用方/只读文件；`check:docs` 对本批零覆盖须显式声明，建议补「被推翻短语黑名单」门禁。
3. **R4-4**（P2）：01 §10.2/§10.4 补「先 build server」前置。

R4-5/R4-6 让两条手测（S3、V8）当前不可复现，应改写或降级为非判据；R4-7/R4-9 是「补门禁」建议，可随实现批收口。R4-8 属已登记的设计选择，仅需在判据里补一句人工确认。
