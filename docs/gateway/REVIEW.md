# docs/gateway/REVIEW — B6 设计评审汇总与裁决

> 评审门（`design-first-feature-workflow` §7）。被评审对象：`docs/gateway/00`–`04`（commit `305bbab`）。
> 评审基准：HEAD `e1c9127`；写作锚点 `45269cf`（漂移 82 个提交）。
> 四份独立评审报告：`review-contract.md`、`review-drift.md`、`review-implementation.md`、`review-honesty.md`（共 440 行、33 条发现）。
> 主 agent 独立复核：6 个 spike + 逐条原文核对。

---

## 0. 一句话裁决

**评审未通过（BLOCK）。** 但**降级本身成立**——四个评审独立复核了 `00 §1.2` 证据 A–F 与「不做」清单，**无一条实质性不成立**。BLOCK 来自**三处必须先改的缺陷**：一处会让语音输入整条死（照字面实现），一处是把已证伪的前提当安全论证，一处是引用指向空处。**设计方向正确，改动是收敛性的，不是重做。**

---

## 1. 评审结论一览

| 报告 | 维度 | 结论 |
|---|---|---|
| `review-contract` | 契约一致性 / 跨端闭环 | BLOCK（6 条：1 BLOCK + 2 MAJOR + 2 MINOR + 1 NIT） |
| `review-drift` | 现状断言 / 行锚漂移 | PASS-WITH-FIXES（**降级地基不塌**；6 条引用面错误，2 MAJOR） |
| `review-implementation` | 可实施性 / 语义兑现 | BLOCK（8 条：1 BLOCK + 5 MAJOR + 2 MINOR） |
| `review-honesty` | 诚实性 / 未知项 / 冲突登记 | PASS-WITH-FIXES（13 条：7 MAJOR + 4 MINOR + 2 NIT） |

**收敛信号**：多个评审**独立**抓到同一点——这是最强证据，优先处理。

| 收敛点 | 独立抓到它的评审 |
|---|---|
| `plan:517`「未标未实现」是假转述 | ReviewContract + ReviewDrift + ReviewHonesty（**三方独立收敛**） |
| `/ws/stt` upgrade 归属三处矛盾（照字面实现 STT 全死） | ReviewContract + ReviewImpl + 主 agent（**三方**） |
| `replayTo` 的「前端已去重演出帧」前提为假 | ReviewContract + ReviewImpl + ReviewHonesty + 主 agent（**四方**） |
| `replayWindow` docstring 超出算法保证 | ReviewImpl + ReviewHonesty + 主 agent（**三方**） |
| `replay_done` 载荷三处互斥 | ReviewContract + ReviewHonesty（**两方**） |
| 心跳动机写成「噪音」实为静默泄漏 | ReviewImpl + ReviewHonesty + 主 agent 实测（**三方**） |

---

## 2. 必须先改的缺陷（BLOCK 级）

### B1 — `/ws/stt` 的 upgrade 归属：同篇三处自相矛盾，照 `§2.2` 实现语音输入整条死

**位置**：`03 §2.2`（`:72-88`）、`§3.1` 第 4 步（`:130-131`）、`§8`（`:218`）

`§2.2` 的 upgrade 钩子写 `if (url.pathname.startsWith(STT_STREAM_PATH)) return; // stt owns its own upgrade`——**前提为假**：全仓只有一个 `new WebSocketServer({ server })`（`index.ts:53`），STT **没有**自己的 upgrade 处理器；`handleSttStream` 由 `wss.on('connection')`（`:188`）经 `req.url?.startsWith(STT_STREAM_PATH)`（`:190`）分派。改成 `noServer` 后，`connection` 只能由 `handleUpgrade` 回调的 `emit` 产生，故 STT 分支 `return` ⇒ `/ws/stt` 永不 upgrade ⇒ **语音输入整条死**。

`§3.1` 第 4 步复述了同一假前提；**只有 `§8` 是对的**（用同一个 wss 做 `handleUpgrade`）。

**漏了会怎样**：部署后麦克风 UI 永远卡在「连接中」；`stt-stream.test.mjs` **仍绿**（该测试直调 `handleSttStream`，不经 upgrade），单测拦不住。
**修法**：统一到 `§8` 的做法。**必须消掉三处的互相矛盾。**

### B2 — `replayTo` 的安全性论证建立在被实测推翻的前提上

**位置**：`02 §2.1`（`:51-54`）、`§3.5`

docstring 称「the client already dedupes … by frame content for **presentation frames**」。**实测该前提不成立**（主 agent 与三个评审独立确认）：

| 帧 | 去重 | 非幂等副作用 |
|---|---|---|
| `world_event` | ✅ `noteWorldEvent`（`useWorld.ts:709`） | — |
| `dice_result` | ✅ `markPlayed`（`App.tsx:568,582`） | — |
| `writer_delta` | ❌ | `appendInk` 纯追加（`:877`） |
| `chalk_landed` | ❌ | `playFoley('paper-slide')`（`:882-884`） |
| `show_frame` | ❌ | `performShowFrame` 无 played 守卫（`:961`） |
| `image_landed` | ❌ | `playFoley('crit-chime')`（`:919`） |

因 `§9-1` 把这些帧放进窗口 ⇒ **每次刷新重放音效、重演演出**。
**漏了会怎样**：交付「刷新即错乱」的版本（玩家可感知）。
**修法**：二选一——(a) 裁定窗口只含**内容重建必需**的帧（见 B3 的 allowlist），(b) 前端补幂等（扩大本批范围）。无论哪个，`§2.1`/`§3.5` 必须回写。

### B3 — 裁定 D 的过滤实现是 denylist，与「只回放演出帧」的描述不符

**位置**：`02 §3.2` 第 2 步（`:90-91`）

实现只排除 `world_event`/`file_changed`，环里**实际仍收** `turn_aborted`/`error`/`tool_start`/`tool_end`/`agent_progress`/`world_frozen`/`card_position`/`replay_entry`（主 agent 已逐一确认这些帧都走 `broadcast`）。
**漏了会怎样**：① 每次刷新重放历史 `error`/`turn_aborted` → 弹旧错误 notice + 复位 agent cursor；② 重放 `agent_progress(busy:true)` → 可能伪锁输入。
**修法（主 agent 采纳 ReviewImpl 建议）**：改为 **allowlist**——只放 `chalk_writing`/`chalk_landed`/`card_writing`/`writer_message`/`dice_result`/`show_frame`/`writer_idle`，**`_delta` 与元帧一律不入环**。比「排除两类 + 如实描述」更可核验、更不会漏。

---

## 3. 应改的缺陷（MAJOR 级）

| # | 缺陷 | 位置 | 后果 |
|---|---|---|---|
| M1 | `replayWindow` docstring 称「whole turns or nothing」，算法只保证**起点**是轮界；**照抄来源 rivet 只声明「最旧一轮不截断」** | `02:27-29` | 尾部半轮（写作中刷新、或作家崩溃后残留）被整段发出 → 幻影永不落地、每次刷新重演 |
| M2 | `isAlive`/pong 连接级初始化**无落点**；`startHeartbeat(wss)` 签名只收 `{clients}`，装不了连接级监听 | `03:209-216`、`:162-166` | 照 `§8` 实现 → 新连接 `isAlive=undefined` → 每轮 sweep 后 `terminate()` → **约每 60s 杀光所有客户端** |
| M3 | `replay_done` 载荷三处互斥：`00 §3.2`=`{type,timestamp}`（已定）、`04 §2.1` 契约行=`{turns,timestamp}`（已定）、`00 §9-2` 说 `turns` **待拍板** | `00:114`、`04:22` | 门禁绿而契约说谎，前端读 `turns===undefined` |
| M4 | `plan:517` 转述为假——逐字**已含**「（未实现，T6.1 目标态）」（锚点与 HEAD 双证） | `00:206`、`01:183` | 会去编辑一份**已正确**的上位文档；掩盖真实冲突（名不同） |
| M5 | 证据 B #3 引 `store/local-world-store`——**全史不存在的文件**；`world-store.ts:127-129` 非自增点 | `00:39` | 证据链不可核验（结论仍成立；真来源 `db/schema.ts:146`） |
| M6 | `stt-stream.test.mjs` 被当作 `noServer` 连带面的**验收**，但该测试不经 `index.ts` 的 upgrade 钩子 | `03:218`、`04:208` | **假非空性**：不可能变红的测试当了最高风险改动的安全网 |
| M7 | 心跳动机写成「CPU/日志噪音」，实测**静默不抛错、无 warn** | `00:65` | 严重度被**低估**；该理由是 R2 主依据，必须改写 |

---

## 4. 小改（MINOR / NIT）

| # | 问题 | 位置 |
|---|---|---|
| m1 | 8 处交叉引用指向**不存在的 `04 §5.x`**（`04 §5` 实为「落账」；真目标 `§10.2`/`§10.3`） | `01:97,134,135,136,169,174`、`02:170`、`03:255` |
| m2 | `04` 自称「7 处回写 / 10 行」，§9 表实为 **11 行** | `04:11`、`:64`、`:215` |
| m3 | 证据 D 转述 `doc-07:222` 漏「与世界重载」 | `00:204` |
| m4 | 「全仓零 ping/pong」是 grep 假象（`lifecycle.ts:77 writerPing` 等是 agent 层探针） | `00:44` |
| m5 | 幻影符号 `subscribe`（event-bridge 无此方法；真落点 `index.ts` 调 `eventBridge.replayTo(ws)`） | `00:114`、`04:22` |
| m6 | 跨端矩阵缺 `base-path.ts` 面（`<BASE>/ws` 与 `pathname !== '/ws'` 严格等值可能冲突；`[推断]` 待部署方确认） | `00:154-160`、`03:75` |
| m7 | `tools/12:587` 行锚指向帧行，`agent_settled` 映射行实为 **`:338`** | `00` §7 裁决 C、`02` §11 |
| n1 | 「同族**导出**惯例」引了非导出的 `cardWritingFrame`（建议改引 `mapEngineEvent`） | `02:178` |
| n2 | `04 §10.2` 自称「三条读源码断言」却列五条 | `04:138` |
| n3 | `§8-6` 的 `AUDIT-doc-22:94`「protocol/ 是空目录」在 R0 落地后自然失效（已声明不回改，可留） | `00:209` |

---

## 5. 已复核成立的断言（下游不必重复劳动）

四个评审 + 主 agent 独立确认：

1. **降级地基不塌**：证据 A–F、裁决 A–G、不做项 7 条，无一条实质性不成立。
2. **`check:ws` 基线**：`clean (27 emitted, 24 consumed, 27 in contract)`；目标 `{28,25,28}` 算术成立。
3. **`WS_COMMANDS` 8 项**与 `index.ts` 的 `data.type === '…'` 分支集合**逐项相等**（含 `writer_abort`/`abort` 同分支）。
4. **`writer_idle` 确是轮终帧**（`event-bridge.ts:388` 由 `agent_settled` 映射）；`agent_end` 不入帧面 —— 裁决 C 成立。
5. **R2 的 upgrade 关闭码方案可行**（主 agent spike 双组对照：HTTP 拒绝只给 `ERR 400` 无 code；`handleUpgrade` 后 `ws.close(4400)` 完整送达 code+reason）—— 非过度设计。
6. **`noServer` 形状安全**（主 agent spike：`wss.clients` 照常填充、`connection` 监听照常触发、`?v=1` 正确透传）。
7. **STT 与主通道共享 wss 后心跳不会误杀 STT**（主 agent spike：协议级 pong 由 RFC 6455 自动回）。
8. **`replay_entry` 与 R1 回放窗口是两件事** —— `02 §6.3` 的表成立。
9. **前端主 WS 唯一连接点** `airp-gateway.ts:156` —— 设计只点一处无遗漏。

---

## 6. 待拍板（设计自列的未决项，需 owner 决定）

1. `replay_done` 是否带 `turns`（与 M3 同源 —— **必须先拍，否则 M3 无法修**）
2. 回放窗口最终帧集（allowlist 内容 —— 与 B2/B3 同源）
3. 尾部半轮去留（裁掉 or 保留让实况补完 —— 与 M1 同源）
4. `replaying` 本地兜底超时是否加
5. `REPLAY_ID` 去留 / `WS_CLOSE.UNAUTHORIZED` 占位去留
6. `04 §13` 其余各项

---

## 7. 落地前置条件

**必须先做**（否则不进实现）：

- [ ] **B1**：`03` 三处统一到 `§8` 的 STT upgrade 做法
- [ ] **B2**：`02 §2.1`/`§3.5` 回写去重前提；按 §6-2 拍板确定窗口帧集
- [ ] **B3**：`02 §3.2` 过滤实现改为 allowlist
- [ ] **M1**：`02` docstring 改口径 + 按 §6-3 拍板补尾裁剪
- [ ] **M2**：`03` 补 `isAlive`/pong 连接级落点（或扩 `startHeartbeat` 签名）
- [ ] **M3**：`replay_done` 载荷统一（先拍 §6-1）
- [ ] **M4/M5**：`00 §8-3`/证据 B #3 修正（这两处会让承接方改错文档）
- [ ] **M6**：`03 §8`/`04 §11.4` 的 STT 验收改成**真能红**的用例（如经 `index.ts` 的 upgrade 钩子跑一次）
- [ ] **M7**：`00 §1.3` 心跳动机改写为「静默泄漏」

**可同批顺带**：m1–m7、n1–n3。

**评审纪律提醒**：评审只读、不改被评审文档；本批修订由文档 owner（或主 agent 指派）执行，修订后 **`docs/gateway/` 应纳入 `tools/check-hooks-docs.mjs` 的 `CITE_DIRS`**（`04 §13-5` 已登记），否则 M4/M5/m1/m7 这类引用错误无法机械拦截。
