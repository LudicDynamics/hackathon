# docs/live-voice/review-closure.md — L2 闭环性与可实施性评审

> 评审人：MagicLoon（评审门第三席）。日期：2026-09-15。
> 范围：**每个动作是否落到具体函数、代码落点是否精确、回指是否有效**。
> 口径：以契约 `10`（含 §9/§9.1/§9.2）为准；只报会被实现成 bug 的问题。
> 所有「实测」= 在**当前工作树**（2026-09-15，`NookView.tsx`/`CharacterModal.tsx` 在途改动已清零，`git diff HEAD` 为空）真跑/真读的输出。

---

## 0. 一句话总判

**符号归宿与 12 号 §8 的 18 处代码落点全部正确；11 号 §9.1 的行号尾部与 10/11 号对 `NookView.tsx` 的行锚系统性过期（+19~+20），另有 2 处「状态变量无赋值点」、1 处「守卫是死代码」、若干回指向已修复的旧文本 —— 均可机械修正，无阻断级设计缺陷。**

---

## 1. 逐条核验表

### 1.1 11 号 §9.1 迁移映射表（**必做 1**）：逐个现有符号 → store 归宿

实测 `apps/web/src/lib/live-call.ts`（**542 行**，非文档所称 543）逐符号核对：

| # | 符号 | 文档行 | 实测行 | 归宿在表内？ | 行号 |
|---|---|---|---|---|---|
| 1 | `useLiveCall(opts)` | `:163-491` | `163-489` | ✅ 删除→4 hook | ⚠️ 尾 |
| 2 | `interface CaptionSegment` | `:32-36` | `32-36` | ✅ 删除 | ✅ |
| 3 | `interface LiveConfig` | `:45-51` | **`47-53`** | ✅ 原样搬 | ❌ |
| 4 | `interface LiveSessionResponse` | `:53-59` | **`55-61`** | ✅ 原样搬 | ❌ |
| 5-7 | 三个超时常量 | `:64`/`:66`/`:68` | `64`/`66`/`68` | ✅ 原样搬 | ✅ |
| 8 | `ERROR_COPY_KEYS` | `:72-80` | `72-80` | ✅ 原样搬 | ✅ |
| 9 | `class LiveClientError` | `:83-90` | `83-90` | ✅ 原样搬 | ✅ |
| 10 | `numOrUndefined` | `:92-94` | `92-94` | ✅ 删除 | ✅ |
| 11 | `readJson<T>` | `:106-120` | `106-122` | ✅ 原样搬 | ⚠️ 尾 |
| 12 | `waitForIceGathering` | `:130-155` | `130-155` | ✅ 原样搬 | ✅ |
| 13 | 就绪 effect | `:215-231` | `215-229` | ✅ `ensureConfig()` | ⚠️ 尾 |
| 14 | `airp:character-frame` effect | `:233-249` | `233-249` | ✅ 模块监听 | ✅ |
| 15 | `frameHandlerRef`+回调 | `:196-197`/`:163-167` | `196`/`166` | ✅ 删除 | ✅ |
| 16 | `setPhase` | `:199-202` | `199-202` | ✅ `commitState` | ✅ |
| 17 | `fail` | `:204-210` | `204-210` | ✅ `fail`+代次守卫 | ✅ |
| 18 | `applyTranscriptDelta` | `:258-272` | `258-270` | ✅ 写 pending | ⚠️ 尾 |
| 19 | `onDataChannelMessage` | `:274-305` | `274-305` | ✅ 原样搬 | ✅ |
| 20 | `teardownLocal` | `:308-327` | `308-328` | ✅ `releaseLocal()` | ⚠️ 尾 |
| 21 | `start` | `:330-416` | `330-420` | ✅ `store.start(opts)` | ⚠️ 尾 |
| 22 | `stop` | `:422-457` | `422-466` | ✅ `store.stop(owner?)` | ⚠️ 尾 |
| 23 | 卸载 effect（自动 close） | `:469-486` | `469-486` | ✅ 删除→调用方 | ✅ |
| 24 | `waitOrTimeout` | `:494-508` | `494-508` | ✅ 原样搬 | ✅ |
| 25 | `waitForSignalOrTimeout` | `:512-525` | `512-526` | ✅ 原样搬 | ⚠️ 尾 |
| 26 | `errorText` | `:528-543` | `528-542` | ✅ 原样搬 | ⚠️ 尾 |
| 27 | 三个 `fetch` | `:219`/`:395`/`:449`/`:478` | **同** | ✅ store 内 | ✅ |
| 28 | `LiveCallState`（4 字段） | `:39-43` | **`39-45`** | ✅ 扩到 6 字段 | ❌ |

**结论（闭环）**：**无遗漏符号**——题目点名的 14 个（`useLiveCall`/`teardownLocal`/`start`/`stop`/`onDataChannelMessage`/`applyTranscriptDelta`/`waitForIceGathering`/`waitOrTimeout`/`waitForSignalOrTimeout`/`errorText`/`readJson`/`LiveClientError`/`ERROR_COPY_KEYS`/三个常量）**逐个在表内**，归宿明确（原样搬 / 改名 / 删除 / 新增）。**唯一系统性缺陷是行号尾部漂移**（见 §2-①）。

### 1.2 12 号 §8 的 18 条代码落点（**必做 2**）：逐条核行号

实测 `apps/web/src/components/overlay/CharacterModal.tsx`（**949 行**，文档称 949 ✅）：

| # | 文档声称 | 实测 | 判定 |
|---|---|---|---|
| 1 | 组件体 `:126` 后 | `126` = `useLocale()` | ✅ |
| 2 | ref 块 `:150-173` | `150` `streamTimer` … `173` `queueGapEventRef` | ✅ |
| 3 | `:388` prefetch① | `388` `if (fresh.sealed) void prefetchVoice(fresh, i);` | ✅ |
| 4 | `:400` prefetch② | `400` `void prefetchVoice(prev, i);` | ✅ |
| 5 | `:406` prefetch③ | `406` `if (np.sealed && prev.voiceState === 'idle') void prefetchVoice(prev, i);` | ✅ |
| 6 | `:494-501` `handleClose` | `494` 定义 … `501` `}, [onClose]);` | ✅ |
| 7 | `:542` mock effect | `542` `useEffect(() => {`（seed 块 543-609） | ✅ |
| 8 | `:555` StrictMode prefetch | `555` `void prefetchVoice(pagesRef.current[0], 0);` | ✅ |
| 9 | `:608` mock prefetch | `608` `void prefetchVoice(mockPage, 0);` | ✅ |
| 10 | `:614` `consumeCharacterFrameFromQueue` | `614` 定义 | ✅ |
| 11 | `:766` 附近（卸载 effect） | `766` `useEffect(() => streamTurn, [streamTurn]);` | ✅ |
| 12 | `:779` `handleSend` | `779` 定义（体 779-809） | ✅ |
| 13 | `:811` busyRef 同步点 | `811` `busyRef.current = busy;`（`:812 phaseRef`） | ✅ |
| 14 | `:869-878` identity-status | `869` `<aside className="identity-status">` … `878` `.identity-bio` | ✅ |
| 15 | `:892-943` line-stage + input-row | line-stage `892-917`、advance `919-921`、input-row `923-943` | ✅ |
| 16 | `:880` ActivityRail | `880` `<ActivityRail surface="character-modal" … />` | ✅ |
| 17 | `:275-323` `prefetchVoice` | `275` 定义 … `323` `);` | ✅ |
| 18 | `:272-274` fetch 硬约束 | `272-274` | ✅ |

另核 12 号 §3.3/§3.5 引用的次级锚：`settleIfDrained :210-222` ✅、`pump :225-252` ✅、`enterPage :341-368` ✅、`syncPages :371-416` ✅、`beginStream :421-440` ✅、`advance :443-458` ✅、`presentQueueGap :713` ✅、`drainUntil :761-762` ✅、`speech-input-row :923-943` / `VoiceInputButton :938` ✅、`×` 按钮 `:835` ✅、`requestClose :502-506` ✅。

**结论：12 号 §8 的 18 条落点行号全部正确**，是本次唯一零错的落点表。

### 1.3 契约 §3.1.1 的时序（**必做 3**）：`stopOwnedCall` 是否早于 `onClose()`→`character_stop`

- `App.tsx:1116` `const closeCharacter = () => {`；`:1117` `if (activeCharacter) sendMessage({ type: 'character_stop', characterId: activeCharacter.id });`；`:1131` `setActiveCharacter(null)`；`:1132` `};` → **契约 `App.tsx:1116-1132` 正确**。
- `App.tsx:1520` `<CharacterModal … onClose={closeCharacter}>`（`:519` 行号 `:1519`）→ 确认 `onClose` 就是 `closeCharacter` 本身。
- 契约 §3.1.1 指定的两个候选落点实测存在：`handleClose`（`494-501`）、`requestClose`（`502-506`）。
- `Close` 路径核对：`×` 按钮（`:835`）→ `requestClose`；焦点注册的 `close:`（`:528`）→ `handleCloseRef`；Escape 经 `App.tsx:643` `closeTopmostSurface()` 直接调 `registration.close()`（`focus-coordinator.ts:233`），`App.tsx:658` `character-dialogue` 分支调 `closeCharacterRef`。

**结论：契约 §3.1.1 的时序要求与落点描述可实施**，且 12 号选定 `handleClose`（而非 `requestClose`）的理由（Escape/程序化关闭绕过 `requestClose`）**实测成立**。

### 1.4 契约 §4.3 的守卫放宽（**必做 4**）

- 现状实测：`NookView.tsx:194` `const callInProgress = call.phase === 'connecting' || call.phase === 'live';`；`:197-206` `handleOpenCharacterModal`（`:199 if (callInProgress)` → `:200 setNotice(copy.liveCallModalBlocked)` → `:203 onOpenCharacterModal?.(id)`）。
- 契约 §4.3 引用的代码形状与实测**一致**；提议的改法（`sameCharacterOnCall = callInProgress && call.characterId === id`）**可实施、语义正确**（`call.characterId` 是 store 快照字段，`id` 是入参）。
- **但**：契约 §4.3 与 §4.2 声称的「已有的单向守卫保留」**在当前树不成立**——见 §3-①（守卫是死代码）。放宽一个不运行的守卫 = 零行为。

### 1.5 契约 §6.1.2 的 rail（**必做 5**）

- `CharacterModal.tsx:880` `<ActivityRail surface="character-modal" agentId={\`character:${characterId}\`} />` ✅。
- `NookView.tsx` **零 `ActivityRail` 挂载**（grep 0 命中）✅。
- 契约 §6.1.2 自身引用正确；但 `docs/agent-awareness/00:294` 与 13 号 W16 内的 `CharacterModal.tsx:838` 指向的是 portrait 区（`838` 是空行/注释），**正确值是 `:880`**（见 §2-②）。

### 1.6 13 号回写清单 W1-W23 关键行号（**必做 6**）

| # | 文档声称 | 实测 | 判定 |
|---|---|---|---|
| W12 | `docs/00-文档骨架.md:88` | `88` = `docs/live-voice/` 行 | ✅ |
| W13 | 根 `AGENTS.md:86` | `86` = `实时语音通话（nook 内 GPT-Live）` 行 | ✅ |
| W14 | `docs/ux/06:52`（CharacterModal 行） | `52` ✅ | ✅ |
| W15 | `docs/ux/06:236` | `236` = 互斥条目 ✅ | ✅ |
| W16 | `agent-awareness/00 §8 第 2 条（:294）` | `294` ✅（**内嵌 `838` 错，应为 880**） | ⚠️ |
| W17 | `docs/tools/12:582` | `582` = `character_delta` 行 ✅ | ✅ |
| W18 | `docs/ui/i18n…:14` / T3 `:48-52` | `14` ✅ / `48-52` ✅ | ✅ |
| W19 | `docs/wiring/00:127-128` | `127-128` = 两条 `/api/live/*` ✅ | ✅ |
| W20 | `docs/tts/07 §11（:185-200）` | `185` 标题、`200` 门禁行 ✅ | ✅ |
| W21 | `INTENTIONALLY_UNCONSUMED（:67-75）` | Map 定义 `66`，含 6 条至 `74` | ✅ |
| W4 | `00 §4 L2 表（:250）` + 「登记三个新端点」 | `250` = messages.json 行；该遗留行实为 **`:252`**，且文本**已是**「两个新端点已在册…」 | ❌ 已失效 |
| W23 | `00 §4 L2 表 check-ws-contract 行（:249）` | 该行实为 **`:251`**，且**已写**「增列 **5 个文件**、基准 24→25」 | ❌ 已失效 |
| 13:106 | `read()`（`check-ws-contract.mjs:182`） | 实测 `183` | ❌ |
| 13 §2.1 | `read(rel)` `:245-249` | `245-249` ✅ | ✅ |
| 13 §2.4 | 断言 `L1/L2/L3` 段 `:81/106/167` | `81`/`106`/`167` ✅ | ✅ |

**结论：W4/W23 描述的两条「矛盾/过期」条目在当前 `00 §4` 中已被修复且行号移位**，清单本身已过期（§9.1(c) 的收口产物）。

---

## 2. 错误行号清单（行号错了的 → 正确值）

**① 11 号 §9.1 表（`docs/live-voice/11-通话归属单例store.md` §9.1）**

| 符号 | 文档 | 正确 |
|---|---|---|
| `LiveCallState` | `:39-43` | **`39-45`** |
| `LiveConfig` | `:45-51` | **`47-53`** |
| `LiveSessionResponse` | `:53-59` | **`55-61`** |
| `readJson` | `:106-120` | **`106-122`** |
| `useLiveCall` | `:163-491` | **`163-489`** |
| 就绪 effect | `:215-231` | **`215-229`** |
| `applyTranscriptDelta` | `:258-272` | **`258-270`** |
| `teardownLocal` | `:308-327` | **`308-328`** |
| `start` | `:330-416` | **`330-420`** |
| `stop` | `:422-457` | **`422-466`** |
| `waitForSignalOrTimeout` | `:512-525` | **`512-526`** |
| `errorText` | `:528-543` | **`528-542`** |
| 全文行数 | 「543 行」（§5/§9.1/§10 三处） | **542 行** |

**② 10 号 §4.2/§4.3 + 11 号 §9.2 对 `NookView.tsx` 的行锚（系统性过期 +19~+20）**

| 位置 | 文档 | 正确（当前树） |
|---|---|---|
| `10:195` 既有守卫 | `NookView.tsx:217-226` | **`194-206`** |
| `10:203` 实测缺口 | `NookView.tsx:213-226` | **`194-206`** |
| `11:456` 守卫放宽 | `:213-225` | **`197-206`** |
| `11:446` `callLines` state + handler | `:195-207` | **`176-188`** |
| `11:447` hook 三元组 | `:208-212` | **`189-193`** |
| `11:448` `startCall()` | `:705` | **`690`** |
| `11:449` `stopCall()` | `:706` | **`691`** |
| `11:444` import | `:11` | **`12`** |
| `13 W15` 既有守卫 | `:217-226` | **`194-206`** |

> **注意**：11 号 §9.2 末尾自注「行锚偏移约 +20」，但实测**偏移不统一**——守卫 +19、callLines +20、`startCall`/`stopCall` **+15**、import +1。照「+20」统一重锚会把 4/5 两条又锚错 5 行。**MUST 逐条按实测值重锚，MUST NOT 套用统一偏移。**

**③ rail 内嵌引用**

| 位置 | 文档 | 正确 |
|---|---|---|
| `agent-awareness/00:294` 与 `13 W16` | `CharacterModal.tsx:838` | **`CharacterModal.tsx:880`** |

**④ 13 号自身与已修复文本的错位**

| 位置 | 文档 | 正确 |
|---|---|---|
| `13:106` | `check-ws-contract.mjs:182`（`read()`） | **`:183`** |
| `13:261`（W4） | `00 §4 L2 表（:250）` | **`:252`**（且该行已修，W4 应标「已改」） |
| `13:281`（W23） | `00 §4 L2 表（:249）` | **`:251`**（且该行已修，W23 应标「已改」） |

---

## 3. 闭环缺口清单

**① ⚠️（P2）契约 §4.2/§4.3 的「既有单向守卫」是死代码——放宽它 = 零行为，且互斥实际不成立**

- 实测：`NookView.tsx:197` 定义的 `handleOpenCharacterModal`（含 `callInProgress` 拦截）**全文件只被引用 1 次**，即 `:205` 自己的依赖数组；`:626` 传给 `<Canvas>` 的是**原始 prop** `onOpenCharacterModal={onOpenCharacterModal}`，不是包装后的 `handleOpenCharacterModal`。
- 即：nook 通话中点角色头像**不会**被 `liveCallModalBlocked` 挡住——守卫从未接入。
- 历史核对（`git log -S`）：`2c1684b`（L 批）曾在 `:563` 正确接线 `onOpenCharacterModal={handleOpenCharacterModal}`；后续 `95f2b55`（unify projection focus and media gates）把它断开了，**属既有缺陷，非本批引入**。
- **为什么仍必须报**：契约 §4.3 的整节论证（「放宽点」「为什么这不违反 §4.2」「误挡 + 归因错误」）与 §4.2 的「已有的单向守卫保留」都以「守卫在跑」为前提。前提不成立时：① 本批按 §4.3 改 `sameCharacterOnCall` **是可实施但无效果的空改动**；② §4.2 声称的「nook 通话中阻止打开该角色对话框」**不成立**，双向互斥退化为单向（只有 store 的 §2.2 冻结 1 还在兜「两条通话」）。
- **建议**：§4.3 增一条 MUST——「把 `handleOpenCharacterModal` 接到 `<Canvas onOpenCharacterModal>`（`:626`）」，否则放宽无意义；或把该断线登记为 L2 必须一并修的前置。**该缺陷在既有代码里，但它是本设计唯一宣称的 nook 侧强制点。**
- **接线落点的三个坑（实现期）**：① `NookView.tsx:156` 解构出的**原始 prop 也叫 `onOpenCharacterModal`**，与包装函数 `handleOpenCharacterModal` 同名同形易混——`:626` MUST 写成 `onOpenCharacterModal={handleOpenCharacterModal}`；② **不要改 `App.tsx:1196`**——实测它是 `<NookView>`（开于 `:1171`）的 prop，即 App 传给 NookView 的入口，正是包装函数的上游；真正的接线点在 **NookView 内部 `:626` 的 `<Canvas>`**；③ `App.tsx:1245` 是 workspace 的 `<Canvas>`（开于 `:1214`，`{!nookChar && …}` 分支），属另一条路径，**MUST NOT 一并改动**。
- **验收提示**：只断言「判据是 `sameCharacterOnCall`」会让接线缺失白过（这正是本条教训）。MUST 另加一条**极性断言**——源码文本里 `NookView.tsx` 的 `<Canvas` 标签内含 `onOpenCharacterModal={handleOpenCharacterModal}`（即断言它**不是** `onOpenCharacterModal`）。
**② ⚠️（P2）`callAlert` 有 setter、无赋值点——告警永远不显示**

- 12 号 §2.2 定义 `callAlert / setCallAlert`（`useState('')`）；§3.5 的 JSX 渲染 `{callAlert !== '' && <p className="dialogue-call-alert" role="alert">{callAlert}</p>}`；§3.9 说「`call.error` 是它的直接来源」。
- 实测：`docs/live-voice/12-对话框通话界面.md` 全文 **`setCallAlert` 只出现在 §2.2 的定义行（`:36`）**，**没有任何 `useEffect`/赋值语句把 `call.error` 写进 `callAlert`**。
- 后果：按文档实现 → `callAlert` 恒为 `''` → `.dialogue-call-alert` 永不渲染 → 契约 §9.1(a) 的「错误必须留在版面上」**在实现层落空**，A5/A3′ 两条断言必红。
- **建议**：① 直接删掉 `callAlert` state，JSX 改读 `call.error`（更少状态、更少一处真相）；**或** ② 在 §2.2/§8 明确给出 `useEffect(() => setCallAlert(call.error ?? ''), [call.error])` 落点。**二者择一，MUST 在文档里写死。**

**③ ⚠️（P2）`hangUpRef` 被 focus effect 读取，却未挂到 `.call-hangup` 元素上**

- 12 号 §2.2 列 `hangUpRef`（`:35` 行处）；§3.6 写 `useEffect(() => { if (callVisible) hangUpRef.current?.focus(); }, [callVisible])`。
- 实测：§3.5 给出的 `.call-hangup` JSX（`:147`）是 `<button type="button" className="call-hangup" onClick={hangUp}>…`，**没有 `ref={hangUpRef}`**；全文 `hangUpRef` 仅出现在 `:160`/`:395` 两处说明，**无任何挂载点**。
- 后果：焦点 effect 读到 `null`，`?.` 静默短路 → §3.6 声明的「进入通话即聚焦挂断按钮」不成立，键盘玩家失去落点（正是 §3.6 自己列的「漏了会怎样」）。
- **建议**：在 §3.5 的 JSX 给按钮加 `ref={hangUpRef}`（一行）。

**④（P3）12 号 §3.8 内部自相矛盾：新增键数 1 vs 9**

- `:194`「本批用到 11 个键：**9 个 MUST 新增**，2 个复用」；`:196` 表头「① 新增 9 键」；`:224`「实测**必须新增的是 9 个**（上表 ①）…**按实测写 9 新增 + 2 复用**」。
- 但 **`:217`（F6 更正块）仍写「故新增键 = 1（仅 `Could not connect`），总数 9（不是 8 / 10）」**。
- 实测 `messages.json`（426 键）：`Close` 存在（`:613`）✅；`Start a call`/`Text`/`Dialogue mode`/`On a call`/`Listening…`/`Hang up`/`They say`/`You`/`Could not connect` **9 个全部 free**。
- 即**实现侧正确值是 9 新增 + 2 复用**；`:217` 是唯一残留的错误数字，与同节 `:194`/`:224` 直接冲突。实现者若照 `:217` 只写 1 键，`check:i18n` 会当场报 8 条 `has no messages.json entry`。
- **建议**：把 `:217` 的「新增键 = 1」改为「新增键 = 9（`Close` 复用既有条目）」。
- （`§2.4`/`§4`/`§8`/`§10-A11` 已同步为 9+2 ✅，故仅此一处。）

**⑤（P3）13 号 W4/W23 描述的两条冲突已被修复，条目本身过期**

- W4 称 `00 §4 L2 表` 有一行写「`check-request-bodies.mjs`（登记三个新端点）`| 05`」。实测 `00 §4` L2 表该行已改为「两个新端点已在册；⚠️ 两处 `file` MUST 从 `live-call.ts` 改指 `live-call-store.ts`」（`00:252`）。
- W23 称 `00 §4 L2 表` 的 `check-ws-contract` 行写「增列 `live-call-store.ts`」（1 个）。实测已写「增列 **5 个文件**、基准 24→25」（`00:251`）。
- 两条都还在待办栏（`D3`），但工作已完成。**建议**：标「已改」，并修正行号（`:252`/`:251`）。

**⑥（P3）13 号 §6 的 `check:i18n` 基线与实测三项全不符**

- `13:21` / `13:238` / `13:301` 写「`265 used keys … (426 entries)` + **4** 条死键 warn」。
- 实测（2026-09-15 收口期，工作树已推进）：`ok   i18n keys: 274 used keys resolve with full zh-CN/ja translations (435 entries)`，`warn` **161 条**。
- 即 **used 265→274、entries 426→435、warn 4→161 三项全错**。不影响判据（warn 不失败、`N ≥ 265`/`M ≥ 426` 仍成立），但「4」会把 warn 数增长误判成异常，`426` 会让 `12 §3.8` 的键数对账错位。
- **顺带（新树证据）**：`messages.json` 现 **435** 条，`12 §3.8` 的 11 个键**全部 EXISTS**（9 新键已真写入 = 426 + 9），与「新增 9 + 复用 2」完全吻合——**§3-④ 的计数口径已被树证实**，唯一残留仍是 `12:217`。

**⑦（P3）12 号 §3.5 的 rail 用法与 `:880` 重复渲染的说明依赖未实测的性质**

- §3.10 称 `ActivityRail` 在 items 为空时返回 `null`（空闲零 DOM）。实测 `ActivityRail.tsx:30` `if (items.length === 0) return null;` ✅——**该性质成立**，此处无需改动，仅作核验记录。

---

## 4. 核验通过（无缺陷）的项（供收口引用）

- 契约 §5.2 的 5 处 `prefetchVoice` 调用点（`388/400/406/555/608`）**逐个正确**；`fetch('/api/tts'` 仍**恰好 1 次**且与 route 同行（`296`）。
- 契约 §9.1(b) 的「渲染期赋值」落点 `:811`（`busyRef.current = busy` 同处）**正确**。
- 契约 §3.1.1 的 `App.tsx:1116-1132`、`closeNook:386-400`、`handleClose:494-501`、`requestClose:502-506` **全部正确**。
- 契约 §5.3 的 `CONSUMERS` 机制描述与实测一致（`check:ws` 现 `clean (27 emitted, 24 consumed, 27 in contract)`，`live-call.ts` 贡献 0 帧；`read()` 在 `:183` 无 try）。**落地顺序（store 行必须晚于文件创建）正确且必须保留。**
- 契约 §6 的更正（`BODIES.file` 必须改指 store）与实测一致（`check-request-bodies.mjs:251` 只扫 `b.file`；live 两行在 `:101`/`:107`）。
- 12 号 §8 的 18 条落点行号 **零错**。
- 11 号 §9.1 的**符号归宿零遗漏**（14 个点名符号全在表内）。
- 13 号回写清单 W12/W13/W14/W15/W16(外锚)/W17/W18/W19/W20/W21 的行号 **全部正确**。

---

## 5. 一句话总判（复述）

**可实施、可闭环；需修 3 处「有符号无落点」（`callAlert`、`hangUpRef`、NookView 守卫接线）+ 1 处数字自相矛盾（12:217）+ 一批行锚漂移（11 §9.1 尾、10/11 的 `NookView` +19~+20、rail `838→880`、13 W4/W23/W6 与 `:182→:183`）—— 全部机械修正，无阻断级设计缺陷。**
