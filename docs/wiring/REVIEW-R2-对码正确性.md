# REVIEW-R2 — 对码正确性（设计文档 vs 真实源码）

> 审查员：`ReviewR2Correctness`。基准：`docs/wiring/00-共同上下文.md`（冻结契约）。
> 方法：逐篇抽查 `file:line` 断言并**实读源码**复核；独立复算 `pnpm check:ws` 基线（`node tools/check-ws-contract.mjs`，未跑 build/test）。
> 只读审查：未修改任何源码或设计文档，仅新增本报告。

---

## 0. 结论速览

| 检查项 | 结果 |
|---|---|
| 抽查 `file:line` 断言 | **>60 条**（5 篇全覆盖，重点 §2/§3/§8/§9 落点表） |
| 与源码对不上 | **6 条**（F1–F6；F1/F2/F3 建议回写） |
| 01 服务端链可通性 | **可通**，无阻断；`push` 确为唯一"需盖章"收口点 |
| 03 `streamLine` 重写 | **无静默删除关键既有行为** |
| 03 `incoming` 方案 | **成立**（identity 必变；StrictMode 双跑只在 mount） |
| 04 兼容性证明 | **成立**（`{ok:true,...details}` 确含 `result`/`passed`） |
| 04-D2 crit/fumble | **确认是活 bug**（仓库已有 `1d6` 检定，crit 永不出现） |
| 02 `event.id` / `world_event` 形状 | **逐字段一致** |
| 门禁数字 | 02 的 `11/7` ✅、03 的 `14→12` ✅；**"A 档后剩 8 条 DARK" 错，实为 9**（F3） |

**放行判断：可以放行实现（A 档无阻断项）**，但建议先回写 F1、F2、F3——三条都会让实现者按错误前提动手。

---

## 1. 门禁基线（独立复算，非复述设计）

实跑 `node tools/check-ws-contract.mjs`：

```
check-ws-contract: 14 finding(s) (24 emitted, 8 consumed, 24 in contract)
EXIT=1
```

基线 14 = **2 GHOST + 12 DARK**：

- GHOST：`useWorld.ts:270`（`item_moved`）、`useWorld.ts:271`（`god_action`）✅ 与 02 §3.1 一致。
- DARK（12）：`writer_delta`@`event-bridge.ts:58`、`character_delta`@`:58`、`chalk_writing`@`:79`、`image_generation_progress`@`:88`、`chalk_landed`@`:115`、`canvas_patched`@`:128`、`dice_result`@`:143`、`image_landed`@`:169`、`writer_idle`@`:183`、`character_idle`@`:183`、`world_event`@`:280`、`show_frame`@`event-bridge.ts:0`。

用 `compare()`（`tools/check-ws-contract.mjs:180`）独立重算的增量：

| 阶段 | findings | consumed |
|---|---|---|
| 基线 | 14 | 8 |
| 仅 A2（删 2 字面量 + 加 `world_event`） | **11** | **7** |
| A2 + A3（再加 3 个 `character_*` 字面量） | **9** | 10 |

→ 02 §10.1 的「11 / consumed 7」✅ **正确**；03 §10.1 的「14 → 12」✅ **正确**。
→ 02/04 的「A 档全部落地后剩余 **8** 条 dark」**错误**，见 F3。

---

## 2. Findings

### F1 — 03 引用的 `instructions.ts:72` 原文在仓库中不存在

- **严重度**：P2（设计结论对，论据假）
- **设计原话**：`docs/wiring/03-角色流式.md:191`（§3 步骤 4）——「角色 preset 明确要求**每一句台词开头**都打标（`extensions/instructions.ts:72`：*"At the very start of every line of dialogue, explicitly mark the current emotion tag: [emo: normal] …"*）」
- **真实**：`extensions/instructions.ts:72` = `writing about a place you have only seen named is where continuity dies.`——属于 `[Your role]` 段，与 emo 标签无关。
  真正的 emo 指令在 **`extensions/instructions.ts:182`**（`[How your face is shown]` 段）：
  `The player watches your expression as you speak. Mark the mood your face should wear with a tag at the very start of the line, written exactly like this — square brackets around the whole tag, one space after the colon, all lower case:`
  并且 `:186` 才是"每行"的依据：`Tag your first line, and tag any line whose mood differs from the line before it`。
  全仓 `grep -rn "very start"` 命中的三处（`instructions.ts:182`、`docs/audio/04:91`、`docs/prompts/02:218`）**都不是设计引用的那句英文**——该句子是设计自己造的，不是仓库文本。
- **影响**：实现者去 `:72` 核对，读到的是无关的 continuity 说明，会怀疑"多行 `[emo:]` 折叠"这一整步的必要性（而它确实必要——`:179` 要求一句一行，`:186` 要求逐行打标）。引号内文本被当作合同原文引用，属"文档对现状的断言"失真。
- **修法**：引用改为实际的 `extensions/instructions.ts:182`（附 `:179`/`:186` 两条依据），删掉自造的英文引文。

### F2 — 03 的 ref 同步方案漏了 `phaseRef`

- **严重度**：P2（设计内部不自洽，直击 03 步骤 7 想防的失效）
- **设计原话**：`03` §3 步骤 3 定义 `const phaseRef = useRef<Phase>('idle')`；§3 步骤 6 `handleSend` 写 `phaseBeforeTurnRef.current = phaseRef.current;`；`character_idle` 分支写「只把 `phase` 归还给 `phaseBeforeTurnRef`」；§8.3 落点表**只**规定「`:186` `busy` 定义后同步 `busyRef.current = busy`」——全文**没有任何一处**规定 `phaseRef.current = phase`。
- **真实源码依据**：`CharacterModal.tsx:186` = `const busy = phase === 'thinking' || phase === 'streaming';`——`busy` 与 `phase` 都是**渲染体内的 state 派生值**，ref 不会自动跟随。设计为 `busy` 显式规定了镜像，却把 `phase` 的镜像漏掉。
- **影响**：`phaseRef.current` 恒为初值 `'idle'`（ref 只初始化一次）。于是 `phaseBeforeTurnRef.current` 永远是 `'idle'`，纯工具轮收工时 `phase` 被归还成 `'idle'`；设计所说的"有上一句就是 `done`"永不成立，`done` 分支的 caret 语义失效。
- **修法（二选一）**：
  1. 删掉 `phaseRef`——`handleSend` 是点击处理器，每次 render 重建，直接读 `phase`：`phaseBeforeTurnRef.current = phase;`
  2. 或在 §8.3 的 `:186` 同步 `busyRef.current = busy` 的同一处补 `phaseRef.current = phase`。
- **说明**：这是"设计文档内部缺口"，不是源码 bug；但按真实源码逐行代入会得到错误结果。

### F3 — 02/04 声称「A 档后剩 8 条 DARK」，实为 9 条（漏 `writer_delta`）

- **严重度**：P3（算术失真，实质结论仍成立）
- **设计原话**：`docs/wiring/02-事件消费与去重.md:328`——「A 档全部落地后剩余 8 条 dark：`writer_idle`、`chalk_writing`、`chalk_landed`、`canvas_patched`、`image_generation_progress`、`image_landed`、`show_frame`、`dice_result`」；`docs/wiring/04-骰子与请求体.md` §10.2 同一份 8 条清单。
- **真实**：基线 12 DARK，A2 消 `world_event`、A3 消 `character_delta`/`character_idle`，剩 **9** 条：上述 8 条 **加上 `writer_delta`（`event-bridge.ts:58`）**。独立重算见 §1（A2+A3 → findings=9，0 GHOST + 9 DARK）。
- **影响**：`00 §9` 的完成判据是「findings 从 14 降到只余 `show_frame` + 登记为后续的暗帧」。若把"8"当验收基线，落地后会多出一条没有解释的 DARK，看起来像 A 档没做干净。`writer_delta` 确在 `00 §1` "不做"清单里（湿墨演出），**实质没问题，只是漏点名**。
- **修法**：两份清单各补一行 `writer_delta`（B 档，`event-bridge.ts:58`），数字 8 → 9。

### F4 — 01 引 `launch.ts:143` / `:145`，实际为 `:145` / `:146`

- **严重度**：P3（行号漂移）
- **设计原话**：`01` §2——「与 `launch.ts:143` 的入参…同一命名空间」；`01` §7——「`launch.ts:145` 用路径拼，不解析」。
- **真实**：`launch.ts:141` = `export function characterLaunch(`；形参 `characterId: string` 在 **`:145`**；`path.join(worldRoot, 'characters', characterId, 'preset.json')` 在 **`:146`**。故 `:143` 实为 `worldRoot` 形参。
- **影响**：读者会以为设计把 `worldRoot` 当成了 id 源头。core 结论（id 命名空间一致）不受影响。
- **修法**：`:143` → `:145`；`:145` → `:146`。

### F5 — `00 §4.1` / `02 §2` 把 `WorldEvent` 标成「15 字段」，实为 10 字段

- **严重度**：P3（形状 spec 的计数写错）
- **设计原话**：`docs/wiring/00-共同上下文.md:88`——「形状 `{ type:'world_event', event: {...15 字段...}, timestamp }`」。
- **真实**：`packages/shared/src/schemas/events.ts:112-123` 的 `WorldEventSchema` 是 **10 个字段**：`seq, id, projectId, type, actor, layer, subject, turn, detail, createdAt`。"15"是 `WORLD_EVENT_TYPES`（`events.ts:9-25`）里**事件类型的数量**。02 §2 自己列的 `WorldEventFrame.event` 正好是这 10 个 + 外层 `timestamp`，说明设计知道正确形状，只是把两个 15 混了（`02:30` 的「15 类之一」是对的）。
- **影响**：读 `00 §4.1` 的人会去找不存在的 5 个字段。
- **修法**：改为 `{...10 字段...}`，或删掉计数、直接指向 `docs/tools/12 §6.3`。

### F6 — 01 引 `CharacterModal.tsx:180-186`，假回复调用点在 `:180-183`

- **严重度**：P3
- **设计原话**：`01` §3 步骤 10——「删除假回复库调用点（`:180-186`）」；§8 落点表第 11 行同。
- **真实**：`:180-183` 是调用点（`const bank = ...` / `pick` / `parseEmoTag` / `streamLine`）；`:184` 是 `};`，`:186` 是 `const busy = ...`（与假回复无关，恰恰是 03 §8.3 要**保留并同步**的行）。
- **影响**：无功能影响，仅范围多框 3 行，易误删 `busy`。
- **修法**：`:180-186` → `:180-183`。

---

## 3. 逐项核对结果（确认无误的部分）

**01（服务端链）**
- `lifecycle.ts:9` = `export type EventSink = (source: 'writer' | 'character', event: JsonAgentSessionEvent) => void;` ✅ 确为"丢掉 characterId"的唯一签名点。
- `lifecycle.ts:105` = `` this.handleEngineEvent('character', event, `character:${characterId}`, client) `` ✅ 派生点。
- `lifecycle.ts:77` = `client.onEvent((event) => this.handleEngineEvent('writer', event, 'writer', client));` ✅。
- `lifecycle.ts:158` = `this.eventSink?.(source, event);` ✅ 落点行。
- `lifecycle.ts:168` = `this.frameSink?.({ type: 'turn_aborted', ... })`、`:257` = `this.frameSink?.({ type: 'replay_entry', source: 'writer', entry })` ✅ 两处 `frameSink` 绕过 `push`，01 §3.6 已声明本批不动。
- `event-bridge.ts:52` = `const push = (msg) => out.push({ ...msg, timestamp: ... });` ✅ **唯一收口点**。
- `event-bridge.ts:46-50` 签名、`:245` `emitEngine(source, event)` ✅。
- **`push(` 调用点实为 12 处**：`:58, :70, :77, :79, :88, :107, :123, :128, :143, :163, :169, :183` ✅ 与 01 §3 步骤 6 列出的 12 处**逐一对上**。
- **绕过 `push` 的路径**（03 必查项）：`broadcast()` 被两类调用者使用——(a) `emitEngine` 循环 `mapEngineEvent(...)` 的输出（全部经 `push` 盖章）；(b) 尾部读表 `drainWorldEvents` 在 `:280` **直接** `this.broadcast({ type: 'world_event', event, timestamp })`，以及 `lifecycle.ts` 的两处 `frameSink`（`:168`/`:257`，经 `index.ts:42` 桥到 `bridge.broadcast`）。(b) 三类都**不属于**角色演出帧：`world_event` 的身份在 `event.actor`、`turn_aborted`/`replay_entry` 已带 `source:'writer'`。故 01「`push` 是唯一收口点、一次盖章覆盖全部角色帧」**成立**——但注意 `show_frame`（`:163` `push(details.frame)`）是 push 的一支，01 §7 已登记它会多一个 `characterId` 键，与 `:160-161` 注释「broadcast the ShowFrame verbatim」有措辞张力，01 已如实登记不改形状 ✅。
- `index.ts:41` = `eventSink: (source, event) => eventBridge.emitEngine(source, event),` ✅ 正是"最易漏"的那一行。
- `actor.ts:15` = `export const CHARACTER_ROLE_PREFIX = 'character:';`、`packages/shared/src/index.ts:16` = `export * from './actions/actor.js';` ✅。
- `launch.ts:145` 形参 `characterId: string` ✅（行号见 F4）。

**02（事件消费与去重）**
- `useWorld.ts:256-325` 是 `useEffect`（`:256`）；`onmessage` 在 `:265-322`（02 写 `:256-325` 是 effect 的范围，可接受）；`airp:world-event` 转发 `:268-275` ✅；三合一 case `:277-281` ✅；`default: break` `:316-317` ✅；`ws.close()` 在 `:324` ✅；`new WebSocket` 在 `:258`（02 §8.2 引 `:258` ✅，00 §8.2 也写 `:258` ✅）。
- 02 §3.1 要删的 4 行：`:270`（`msg.type === 'item_moved'`）、`:271`（`msg.type === 'god_action'`）、`:278`（`case 'item_moved':`）、`:279`（`case 'god_action':`）✅ **逐行对上**。
- `event.id` 形状：`local-store.ts:416-421`——`const seq = Number(info.lastInsertRowid); UPDATE events SET id = ? WHERE seq = ?` 写入 `` `evt-${seq}` ``，返回 `id: 'evt-<seq>'` ✅ 02 §3.3.1-(a) 正确。
- `WorldEventFrame` 逐字段：`events.ts:112-123`（10 字段）与 02 §2 定义的 10 字段 ✅ 一致；外层 `timestamp` 来自 `event-bridge.ts:280` ✅。
- `world_event` 帧真实形状 = `{ type: 'world_event', event, timestamp: new Date().toISOString() }`（`event-bridge.ts:280`）✅ 与 02 §2 逐字一致；`docs/tools/12 §6.3:606-628` ✅ 逐字段一致。
- 02 §3.5「`consumedFrom` 同时匹配 `case 'x'` 与 `msg.type === 'x'`」：`tools/check-ws-contract.mjs:129` = `/(?:case\s+|msg\.type\s*===\s*)'([a-z][a-z_0-9]*)'/g` ✅ 正确。
- `SEEN_EVENT_LIMIT` 契约来源 `docs/tools/12:634` = 「上限 200、FIFO 淘汰」✅。
- `App.tsx:148-152` = world-event 订阅 effect、`:149` = `const onWorldEvent = () => fetchBackpack();` ✅ 逐行对上（02 写 `:148-152` ✅、`:149` ✅）。
- `moveCard` 在 `useWorld.ts:141-165` ✅（02 §3.8 写 `:141-165` ✅）；陈旧响应守卫 `:93`/`:102`（02 写 `:93,102`——实际 `reqSeqRef` 声明在 `:84`、`seq` 自增在 `:93`、比较在 `:102`，可接受）。
- `fetchLayer` 的网络异常 warn 在 `:116`（02 §7 写 `:116` ✅）、非 2xx warn 在 `:98` ✅（02 §7.1 写 `:98` ✅）、`loading` 复位 `:118` ✅。

**03（角色流式 / CharacterModal）**
- 帧源：`event-bridge.ts:59`（`character_delta`，`{type, source, delta}`）、`:70`（`character_message`，`{type, source, text}`）、`:183`（`character_idle`）✅ 逐行对上；`timestamp` 由 `:52` 的 `push` 附加 ✅。
- `FALLBACK_REPLIES:40-47` / `FALLBACK_REPLIES_JA:49-54` ✅；`EMO_TAGS:32` ✅；`parseEmoTag:60-65` ✅（`/^\[em/mnt/o/s*([a-z]+)\]\s*/` 只在 `:61`）。
- `streamLine:106-144` ✅；沉思窗 `:114` = `const thinkMs = 100 + Math.random() * 300;` ✅；韵律 45/300/150 在 `:134-138` ✅；`setPhase('thinking')`/`setEmo('thinking')` 在 `:111-112`、揭幕 `:116-117`、`playStinger(mood)` `:119` ✅（03 §3 步骤 3 引 `:111,116,117` ✅；§3 步骤 4 引 `:118-123` 是 stinger 注释块，可接受）。
- `clearTimers:87-90` ✅；cleanup `:160`（`useEffect(() => clearTimers, [clearTimers])`）✅。
- 开场硬编码台词 `:147-157`（`locale === 'ja' ? '（あなたを見て)…' : '(Watching you)…'`，`setTimeout(..., 420)` 在 `:148-155`）✅。
- `handleSend:174-184` ✅；守卫 `:176` ✅；假回复调用 `:180-183` ✅（03 §8.3 引 `:180-183` ✅，06 引 `:174-184` ✅）。
- `busy:186` ✅；`monogram:188`、aria-label `:194`、portrait-fallback `:211`、placeholder `:246`、`aria-label` `:247`、`disabled={busy}` `:248`、caret `:233` ✅ 全部对上。
- 渲染条件 `:230` = `{(phase === 'streaming' || phase === 'done') && line !== '' && (` ✅ 逐字对上。
- `.line-stage` 的 `min-height: 3.2em` 在 `index.css:503-504` ✅（03 §12-5 的 `[推断]` 说"需要看 `.speech-paper` 的 CSS（本次未查）"——实测 `.line-stage`/`.speech-line`/`.player-echo`/`.thinking-hint` 齐备，仅 `.speech-paper` 本文亦未见独立规则，`[推断]` 仍成立）。
- `main.tsx:7` = `<React.StrictMode>` ✅ 03 §7 引 `main.tsx:7` ✅。
- `audio.ts:851` = `export function playStinger(emo: Emotion): void {` ✅。
- **`incoming` identity 必变**：03 §3 步骤 1 的 `setActiveModalFrame({ ...msg, ... })` 每次构造新对象 ✅（对象展开必产生新引用，即使内容相同）；`App.tsx:120-124` `openCharacterModal` 与 `:125-131` `closeCharacterModal` 形如设计所述（`:122` start、`:123` setState、`:127` stop、`:129` setState(null)）✅ → 步骤 2 的"先清空"落点正确。
- **`closing` 保留**：`CharacterModal.tsx:82` `const [closing, setClosing] = useState(false);`、`:93-97` `handleClose`（220ms）、`:191` class 拼接 ✅ 03 §6.2 的 `if (closing) return;` 有真实 state 可依 ✅。
- **`avatarError` / `playerEcho` 保留**：`:81`/`:172`（reset effect）与 `:79`/`:178`/`:226` ✅ 03 §8.3 明确"保留" ✅（**无静默删除**）。
- **`EMO_TAGS` 保留**：03 §8.3 说 `:32` 保留 ✅ 正确（`parseEmoTag:64` 白名单仍用它）。

**04（骰子）**
- 请求体错误在 `DiceRoller.tsx:148-156`（`fetch` `:148`、`body: JSON.stringify({ filePath, rollType, expect })` `:151-155`）✅。
- `parseDiceVerdict:46-51` ✅；判据 `:47` = `!'result' in raw || !'passed' in raw` 与 `:49` 类型检查 ✅ **与 04 §2.3.1 引的判定式逐字一致**。
- `closeOverlay:97-109` ✅；失败 catch `:161-165`（`console.error` `:162` + `closeOverlay()` `:164`）✅ 04 引 `:161-165` ✅；`settleIfReady:113-132` ✅ 04 引 `:113-132` ✅。
- crit/fumble 硬编码 `:121-126` = `verdict.passed && verdict.result >= 95` / `!verdict.passed && verdict.result <= 5` ✅ 04 §11-D2 引 `:121-126` ✅。
- `rolled` 初始值 `:59-63` ✅（04 §12-U4 引 `:59-63` ✅）。
- `DiceRollerProps:25-35` ✅ 04 引 `:25-35`/`:27-33` ✅；`onRollComplete` 声明 `:34`、解构 `:56` ✅ 04 §11-D3 引 `:34`/`:56` ✅。
- **`onRollComplete` 确为死 prop**：全仓 `grep -rn onRollComplete` 只有 `DiceRoller.tsx:34,56` + `fm.tsx:130`（传参）——**组件内无调用** ✅ 04-D3 结论正确；`App.tsx:523` = `onDiceRolled={(res, pass) => showToast(...)}` ✅ 确为死线。
- `fm.tsx:124` = `filePath={filePath ?? ''}` ✅ 04 §3 第 2 步引用正确；`fm.tsx:125-129` 展开 `rollDice={{...dice, desc, expect}}` ✅；`fm.tsx:69` = `dice: Record<string, any> | null` ✅（04 §12-U5 的 `[推断]`"删 `type?: string` 无编译影响"**成立**）。
- `ChalkCard.tsx:35` = `filePath: path,` ✅。
- 服务端 `/api/dice` 只读 `body.path`：`routes/world.ts:684` = `const { path: dicePath, forcedResult } = req.body as {...}` ✅ 04 引 `:684` ✅；空/非串 400 `:685-687` ✅；`forcedResult` 400 `:688-690` ✅；actor 选择 `:692` ✅（04 引 `:691-692` ✅）。
- **`reply()` 成功体**：`routes/world.ts:56-73`，`res.json({ ok: true, ...(await run()).details })` 在 `:61`（04 引 `:61` ✅）；错误体 `{ok:false, code, error}` 在 `:69-72`，`ActionError` 走 `err.toHttp()` `:64-66` ✅；`errors.ts:75-78` `{ ok: false, code, error }` ✅ 04 §2.4 引 `:75-80` ✅。
- **04 §2.3.1 兼容性证明逐条复核**：`RollDiceDetails`（`roll-dice.ts:25-50`）**必含** `result: number`（`:37`）、`passed: boolean`（`:39`），且 `:180-193` 无条件写入 ✅；返回 `{ text, details: { ...details, event } }`（`:246`）✅。故 `parseDiceVerdict` 成功路径**永不返回 null** ✅ **结论成立**。
- **两种失败形状都被覆盖**：`res.ok===false` 且 body `{ok:false,code,error}`（`errors.ts:78`）——判 `!res.ok` 命中；`{ error: 'No active world' }`（`world.ts:683`，**无 ok 字段**，status 400）——同样 `!res.ok` 命中；04 §3 第 4 步的 `!res.ok || raw?.ok === false` 对两者都成立 ✅（虽 `raw?.ok===false` 在此冗余，因为 `ok:false` 必伴随非 2xx——`reply` 的 catch 用了 `res.status(...).json(...)`，HTTP 状态与 `ok` 始终一致。**冗余但无害**，不算 bug）。
- 落账：`roll-dice.ts:220-237` `appendEvent({ type: 'roll_resolved', actor: ctx.actor, subject: path, turn: ctx.turn, ...})` ✅；`detail: { path,name,dice,desc,expect,result,passed }`（`:225-233`）✅ 04 §5 逐字对上；`layer` 为 null 时省略键（`:236`）✅。
- `layer` 落 `resolveLayer(path)` `:178` ✅。
- **04-D2 crit/fumble 是真 bug** ✅：引擎定义 `roll-dice.ts:168-169` / `rules/dice.ts:255-256` = `rolls.every(r => r === spec.faces)` / `rolls.every(r => r === 1)`（每颗骰子都是最大面/都是 1）；仓库内确有 `type: 1d6` 检定——`templates/firstsnow/world/intro/relationships/studio/README.md:7` 与 `templates/whitechapel/world/intro/london/third-scene/README.md:7`（均 `expect: ">3"` / `">3"`，见 grep 输出）。`1d6` 最大 6 < 95 → **crit 金光永不出现**；掷出 1 且 failed → 前端 `<=5` 误判 fumble（引擎只有 `r===1` 才 fumble，二者在 1d6 上恰好重合，但在 `2d6`/`1d100` 上不等价）。**结论：活 bug，值得纳入本批或明确 F 档排期**（越权不在我裁决范围，主 agent 待定）。
- `tools/probe-tools.mjs:66` = `roll_dice: ['path'],` ✅ 04 引 `:66` ✅。
- `apps/web/package.json:14` = `"react": "^19.0.0",` ✅ 03 §2.3 引 `:14` ✅；`:5-9` 无 test 脚本 ✅ 03 §10.2 引 `:1-24` ✅。

**05（文档回写 C1）**
- `docs/hooks/00:192`、`docs/hooks/03:514`、`docs/hooks/06:287`：R1 声称"已在本批之前完成"——实测三处 `2026-09-12 核实更正` 标记分别在 `docs/hooks/00:193`、`03:517`、`06:294`（正文行 192/514/287 附近）✅ **R1 属实且已完成**。
- R3：`packages/shared/src/actions/service.ts` 确有 `createActionService`（`:129`）✅；`routes/world.ts:578-784` 全走 `serviceFor(...)` ✅。
- R7：`docs/tools/02-chalk.md:455` 引 `useWorld.ts:171-181`、`docs/tools/09-link与arrange.md:497` 引 `useWorld.ts:178-183`/`:208`——实际 WS switch 在 `:256-325`（漂移约 80–110 行）✅ **R7 属实**。
- R8：`docs/doc-21-事件表协议.md:25` 与 `:204` 确有「既无写入点也无消费者，按准入第 3 问删除」✅；而 `routes/world.ts:804-811` 的 `/freeze` **确实广播** `world_frozen`/`world_thawed` ✅、`useWorld.ts:282-287` **确实消费** ✅、`docs/tools/12:588` 列为保留 ✅ **R8 属实**。
- R9：`docs/后端实现计划.md:80` = 「`event-bridge.ts` (56 行) … 只广播 `file_changed`」、`:204` = 「现在只广播 `file_changed`」✅ **R9 属实**；实际 `event-bridge.ts` **404 行**（设计说 405，差 1，无实质影响）。`:284` 的"已实现（2026-09-12）"标注 ✅。
- R6：`extensions/tools.ts:62` 注册 `show` ✅；`packages/shared/src/actions/show.ts:157-161` 产 `frame: ShowFrame` ✅；`docs/prompts/` 为 `?? ` 未跟踪 ✅ **R6 属实**（`git status` 显示 `?? docs/prompts/`）。
- R2/R4/R5：`docs/前端改造计划.md:27`（P3 行、「`character_prompt` 仍为空注释」）、`:271`（`sampleReplies` +「空注释」）、`:361`（T3.7 落点 `apps/server/src/engine/`）、`:549`（P3 收工表「剩余 T3.1 服务端角色流式」）**逐条对上** ✅。注意 R5 写"`:551`"而实际 P3 收工行在 **`:549`**（`:551` 是 P5 行）——属轻微行号漂移，建议顺手改（P3 级，未单列 finding 以控制噪音）。

---

## 4. 关于 04-D2 / D3 / error 帧 / dice_result 的审查意见（待拍板项）

- **(c) `04-D2` crit/fumble 硬编码**：**建议纳入本批**。它不是"理论瑕疵"：`1d6` 检定已在 `templates/` 的两处真实卡上（firstsnow studio、whitechapel third-scene），crit 分支永不触发是**可观测的演出缺失**，且修法很小（读服务端已返回的 `crit`/`fumble` 字段——`roll-dice.ts:43-45`、HTTP 响应里已有）。纯前端 2 行。
- **(d) `04-D3` `onRollComplete` 死 prop**：**建议同批修**（在 `settleIfReady` 落定处调一次）。否则 `App.tsx:523` 的 toast 继续是"看起来在工作"的死线，与 02 要删的 `useWorld.ts:270-271` 同类缺陷；成本 1 行。
- **(a) `error` 帧是否接入同一 seam**：**建议接**。`index.ts:145` 的 `{type:'error', source:'character', characterId, message}` 是角色不存在时**唯一**信号；不接则玩家对着 `thinking` 遮罩空等 95s watchdog，正是 `00 §8.3` 要禁止的静默失败。加 `case 'error'` 不产 finding（`check-ws-contract.mjs:57` 已在 `INTENTIONALLY_UNCONSUMED`）。
- **(b) `dice_result` 归 B 档**：**同意**。`docs/tools/12 §6.2:580` 明确它是演出帧，且 `00 §1` "不做"清单含"骰子仪式"。但须按 F3 把 DARK 计数从 8 改成 9（含 `writer_delta`）。
- **(e) A4 是否需要机械门禁**：**建议加一条极简的**（纯文本断言：`DiceRoller.tsx` 不再出现请求体键 `rollType`/`filePath:`，且出现 `path: filePath`）。`check:ws` 对 A4 **前后逐字节相同**（04 §10.2 此结论 ✅ 正确——`DiceRoller.tsx` 不在 EMITTERS/CONSUMERS/contract 任一集合），所以今天 A4 的"P0 修复"**没有任何机械证据**，只有 S2 手测。

---

## 5. 放行判断

**放行实现（A 档无阻断项）。**

- 01 的服务端链逐点可通，`push` 盖章切口正确，无绕过风险（`world_event`/`frameSink` 的绕过已论证）。
- 02 的 `world_event` 形状、`event.id` 生成、去重键选择与契约逐字一致。
- 03 无静默删除既有行为（`closing`/`avatarError`/`playerEcho`/aria/`.line-stage` 全保留且落点行号正确）；`incoming` identity 与 StrictMode 论证成立。
- 04 的兼容性证明（`parseDiceVerdict` 不用改）经逐行代入**确认成立**，两种失败形状都被 `!res.ok` 覆盖。

**放行前建议先做 3 处回写**（都不改契约、不扩范围）：

1. **F1**：`03:191` 的 `instructions.ts:72` → `:182`，删掉自造英文引文。
2. **F2**：`03` §8.3 补 `phaseRef.current = phase`（或在 `handleSend` 直接读 `phase`）。
3. **F3**：`02:328` 与 `04` §10.2 的 8 条 DARK 清单补 `writer_delta`，数字改 9。

F4/F5/F6 为行号/措辞级，可在实现同 commit 顺手修。
