# docs/gateway/02 — 回放窗口与 `replay_done`

> 状态：**设计稿（2026-09-14）**，待评审。属 B6「网关与会话域」（见 `docs/gateway/00-共同上下文.md`，下称 `00`）。
> 边界：`apps/server/src/engine/event-bridge.ts`（环形缓冲 + 窗口 + 回放）、`apps/server/src/index.ts`（连接时触发回放）、`apps/web/src/state/useWorld.ts`（消费 `replay_done`）。**不碰** `lifecycle.ts` 的 warmup（`02 §8`）。
> 依据：`00 §3.2`（新帧）、`00 §7`（裁决 C/D/H/I）、`docs/development/后端实现计划.md:606`（唯一未达标的收工项）、rivet `session-host.mjs:80-100,792-812`（照抄第 3/4 条，见 `00` 附一）。
> **行锚口径（修订 1，2026-09-15）**：本文件所有 `file:line` 已在当前工作树 HEAD `4ee0ebe` 逐条实测（写作锚点 `45269cf` 已漂 82+ 提交；`6f4eaa4` 又改了 `useWorld.ts`/`world.ts`，本文件的这两处锚按 `6f4eaa4` 之后的行号）。行号会继续漂，实现前一律按符号定位。

---

## 1. 一句话定位

**给每个已广播的演出帧做一段有上界的环形缓冲；浏览器连上时，服务端从缓冲尾部往回找第 6 个轮界，把最近最多 5 个完整轮次重发一遍——两端都切在轮边界上（尾部半轮一并裁掉）——末尾补一帧 `replay_done`；它不改世界、不写事件，只是让「刷新不丢叙事」这句承诺从『靠 `fs.watch` 巧合兜底』变成一条可核验的契约。**

今天的实情：前端一刷新就丢光本轮的湿墨、笔尖、骰子仪式与角色台词；画面重新长出来全靠 `onopen` 的 `fetchLayer`（`useWorld.ts:984`）重取**文件**（`useWorld.ts:354` 的 `fetchLayer`）。**文件能重取，演出不能。** `docs/development/后端实现计划.md:606` 把这条标为未达标，且它是 §13 全表唯一一条「设计与代码不一致」的真缺口（`00 §1.2` 证据 C）。

---

## 2. 签名与参数

### 2.1 `event-bridge.ts` 新增成员（NEW）

```ts
// 以下常量由**新建**的 `packages/shared/src/protocol/ws.ts`（`01`，`00 §3.1` 冻结值）导出、本文件 import：
/** `REPLAY_TURNS`（= `5`）语义 =「最多 N 个**完整**轮」：窗口两端都切在轮边界上，
 *  尾部半轮不算一轮（裁决 I）。 */
export const REPLAY_TURNS = 5;
/** Ring bound：留给回放的已广播帧条数（顶层常量）。 */
export const REPLAY_BUFFER_KEEP = 4000;
/** 入环 allowlist（裁决 D）：只有这 5 个「内容重建帧」进环；`*_delta`、
 *  仪式帧、元帧一律不入环。 */
export const REPLAY_FRAME_ALLOWLIST = [
  'chalk_writing', 'chalk_landed', 'card_writing', 'writer_message', 'writer_idle',
] as const;
```

以下落 `apps/server/src/engine/event-bridge.ts` 的顶层导出（`02 §8` 落点）：
```ts
/**
 * Pure: take the newest `turns` COMPLETE turns out of a serialized-frame
 * buffer. A turn ends at `writer_idle`.
 *
 * We trim at turn boundaries on BOTH ends, so what we return is only whole
 * turns:
 *  - HEAD trim: the oldest included turn is NEVER truncated — we start after
 *    the (turns+1)th `writer_idle` from the tail.
 *  - TAIL trim: frames after the LAST `writer_idle` (a trailing half-turn,
 *    e.g. the writer is mid-turn, or it died and never emitted `writer_idle`)
 *    are dropped.
 * A buffer with no `writer_idle` at all → `[]`.
 *
 * Non-JSON lines are replayed verbatim but do not count toward the turn budget.
 *
 * Mirrors `~/projects/worldlines-rivet/services/gateway/session-host.mjs:80-100`
 * with two substitutions: rivet cuts on `agent_end` (AIRP cuts on the FRAME
 * `writer_idle` — decision C, docs/gateway/00 §7; `agent_end` never reaches the
 * frame surface), and rivet only declares the HEAD trim (its docstring says
 * "最旧一轮不截断") whereas we also trim the tail (decision I).
 */
export function replayWindow(buffer: readonly string[], turns = REPLAY_TURNS): string[];
```

```ts
// inside class EventBridge
/** Serialized frames already broadcast — the replay source. Bounded by
 *  REPLAY_BUFFER_KEEP; only names in REPLAY_FRAME_ALLOWLIST ever enter
 *  (decision D, docs/gateway/00 §7). */
private replayRing: string[] = [];

/** Broadcast, then buffer. The ONLY change to the existing fan-out. */
broadcast(message: Record<string, unknown>): void;   // existing: event-bridge.ts:440

/**
 * Send the last `turns` complete turns to ONE freshly-connected socket, then
 * the boundary frame. Synchronous: registration and snapshot happen in the
 * same tick, so a live frame can never interleave into the middle of a replayed
 * turn (no reordering, no interleaving).
 *
 * That same-tick guarantee does NOT make duplicate frames harmless: the
 * presentation frames have NO client-side dedupe and their effects are not
 * idempotent (a replayed `chalk_landed` fires `playFoley('paper-slide')` again,
 * a replayed `show_frame` re-runs the whole performance). So duplicates are
 * kept out at the SOURCE, by the allowlist: any frame with a non-idempotent
 * side effect is never put in the ring in the first place (decision D).
 */
replayTo(client: { readyState: number; send(payload: string): void }): void;   // NEW
```

**为什么不能靠「客户端已去重」兜底（修订 1，评审 B2）**：实测只有两类帧在客户端去重——`world_event`（`useWorld.ts:709` 的 `noteWorldEvent`）与 `dice_result`（`App.tsx:568` 的 `shouldPlayFrame` + `:582` 的 `markPlayed`）。**演出帧零去重**，且副作用非幂等：`chalk_landed` → `playFoley('paper-slide')`（`useWorld.ts:884`）、`show_frame` → `performShowFrame` 无 played 守卫（`useWorld.ts:961` 派发 → `PerformanceLayer.tsx:551` 监听）、`writer_delta` → `appendInk` 纯追加（`useWorld.ts:877` → `phantom.ts:142`）、`image_landed` → `playFoley('crit-chime')`（`useWorld.ts:919`）。所以「重复即无害」是假前提；真实理由是**allowlist 从源头不把这些有副作用的帧放进环**。

### 2.2 `index.ts` 的接线（NEW，一行）

在 `wss.on('connection')`（`apps/server/src/index.ts:188`）里、`connected` 帧（`:196`）**之后**：

```ts
eventBridge.replayTo(ws);   // NEW — after `connected`, before `ws.on('message')`
```

### 2.3 前端（`useWorld.ts`，NEW）

`onMessage` 的 `switch`（`apps/web/src/state/useWorld.ts:698`）加一个分支：

```ts
case 'replay_done':
  // Boundary frame: the server finished re-sending the last N complete turns.
  // Clears the reconnect-scoped "still catching up" flag so the writer input is
  // not held hostage by a replay that already ended (perf/01 §6.4 same family).
  setReplaying(false);
  break;
```

配合一个本地 state（细节见 §6）。

---

## 3. 行为契约逐步

每步写「漏了会怎样」。

1. **`broadcast` 在 JSON 序列化之后、fan-out 之前，把 payload 压入 `replayRing`；超过 `REPLAY_BUFFER_KEEP` 时从头部 `splice` 掉溢出量。**
   漏了会怎样：① 不缓冲 → 回放源为空，连上后只有 `replay_done`，前端以为「补完了」而实际什么都没补（**比现状更糟：现在至少文件重取还在**）；② 无上界 → 一场长演示后 `replayRing` 持有数十万条字符串，内存随帧数线性增长到 OOM。
2. **压入前按 `message.type` 过滤——只有 `REPLAY_FRAME_ALLOWLIST` 里的 5 个帧名入环（裁决 D，allowlist 而非 denylist）：`chalk_writing` / `chalk_landed` / `card_writing` / `writer_message` / `writer_idle`。**
   漏了会怎样：改成 denylist（只排 `world_event`/`file_changed`）会把**元帧**也收进环——`error` / `turn_aborted` 被重放时前端会 `agentCursorStore.idle('writer')` + `dispatchEvent('airp:notice')`（`useWorld.ts:805-838`，`:822/:823/:835/:836`），玩家每次刷新都**重弹一遍旧错误**并复位光标；`agent_progress` 的 `busy:true` 会被 `acceptWriterFrame` 置 `phase: 'writing'`（`writer-state.ts:143-151`，`:149`）→ **伪锁输入**。allowlist 反过来：新帧默认不入环，漏掉一个只会少补内容，不会误演。
   **另：为什么不重放 `world_event` / `file_changed`（机制解释，不是过滤规则本身）**——两者的消费动作是重取语义：`world_event` 在缓冲里被重放 → 前端 `noteWorldEvent`（`useWorld.ts:572`）判重后丢弃，**不会出错但白跑**；真正代价是 `world_event` 与 `file_changed` 的消费动作都是 `void fetchLayer(...)`（`useWorld.ts:700` / `:724`），窗口里 5 轮的事件会让前端在连上瞬间**并发发起几十次整层重取**。allowlist 天然不含这两类，此处只解释为什么它们**不该**被加回 allowlist。
3. **`replayWindow(buffer, 5)`（裁决 I）：先从尾往前数 `writer_idle`，找到第 6 个时 `slice(i + 1)`（HEAD 裁：最旧一轮不截断）；不足 6 个则从缓冲头开始。然后再从尾回退到最后一个 `writer_idle`，把其后的帧全部丢掉（TAIL 裁：尾部半轮不出窗口）。若无 `writer_idle` → 返回 `[]`。**
   漏了会怎样：① 只做 HEAD 裁（原设计）→ 窗口里出现**尾部半轮**（有 `chalk_writing` 没有 `chalk_landed`），前端 `registerPhantom`（`useWorld.ts:840` 的 `case 'chalk_writing'`，`:843`）注册一个永不落地的幻影，骨架永久占位——而且在**写作中刷新**或**作家崩溃后**（见 §12.2）每次刷新都重演；② 按「最近 5 条」而不是「最近 5 轮」切 → 同样切在轮中，同上。
4. **非法 JSON 行照发、且不计入轮次。**
   漏了会怎样：一行坏数据把轮次计数吃偏一位，窗口要么少一轮要么切在轮中——同上的半轮问题，但更难复现。
5. **`replayTo` 内同步：`const lines = replayWindow(this.replayRing); for (const line of lines) client.send(line);` 紧接着 `client.send(JSON.stringify({ type: 'replay_done', turns, timestamp }))`，全程同一 tick。`turns` = 实际回放的完整轮数（裁决 H），从 `replayWindow` 的结果数出来可 < 5。**
   漏了会怎样：① 若中间 `await`，实时帧会在回放中途插入 → 前端看到乱序（`chalk_landed` 早于 `chalk_writing`），幻影过户失败，纸片卡在天上。rivet 的注释正是为此（`session-host.mjs:792-795`）；② 缺 `turns` → 前端与验收都无法分辨「服务端补了 5 轮」与「环里只有 2 轮」，`00 §3.2` 冻结的载荷形同虚设（`00 §7` 裁决 H）。
6. **`replayTo` 只在 `client.readyState === 1` 时 `send`，且对每个 send 单独 try/catch。**
   漏了会怎样：握手期就断开的 socket 让 `send` 抛错，异常冒到 `wss.on('connection')` 外，**整个连接处理器崩掉**（与 `broadcast` 的 per-client try/catch 同因，`event-bridge.ts:440-451`）。
7. **`replay_done` 有 `timestamp` 与 `turns` 字段，且是帧名而非事件。**
   漏了会怎样：缺 `timestamp` 让帧与既有帧族不同形（`docs/tools/12 §6.2` 每行都有 `timestamp`）；缺 `turns` 见第 5 步；进 `events.ts` 的闭集则编译期就错（`AGENTS.md:29` 族，见 `00 §3.6` 第 5 条）。
8. **回放不落账、不改游标、不触发 `drainWorldEvents`。**
   漏了会怎样：若回放顺手推 `eventBridge.lastSeq`（`event-bridge.ts:413`），**会把未广播的事件永久跳过**——`drainWorldEvents`（`:490`）里的注释（`:513-514`）专门警告过这个方向。

---

## 4. 文件与副作用

| 文件 | 改动 | 详细 |
|---|---|---|
| `apps/server/src/engine/event-bridge.ts` | ① 顶层加 `replayWindow` 纯函数（与 `mapEngineEvent`（`export function`，`:129`）同族的顶层导出惯例）；② 类字段 `replayRing`；③ `broadcast`（`:440`）末尾按 allowlist 压环；④ 新方法 `replayTo`；⑤ `close()`（`:622`）清空 `replayRing` | 约 50 行 |
| `apps/server/src/index.ts` | `wss.on('connection')`（`:188`）内、`connected`（`:196`）之后加 `eventBridge.replayTo(ws);` | 1 行 |
| `apps/web/src/state/useWorld.ts` | ① 一个 `replaying` state；② `onopen`（`:981-985`）置 `true`；③ `switch`（`:698`）加 `case 'replay_done'` 置 `false`；④ 必要时在 `sendToWriter`（`:518`）里把 `replaying` 纳入 busy 判定 | 约 15 行 |
| `docs/tools/12-工具注册与路由统一.md` §6.2 | 加 `replay_done` 一行 | 见 `04 §3` |

**副作用边界**：不新增文件、不改 `lifecycle.ts`、不改 `history.db`/`canvas.db`、不改 `writer-state.ts` 的公开状态机（`00 §9-3`）。

---

## 5. 落账

**不落账。** 回放的是**传输帧**，不是事件（`docs/tools/00 §5.3`：演出帧是瞬时传输；世界事件走 `world_event`）。理由：`doc-21 §1.1` 定「传输帧不入事件表」；回放若落账会凭空造出事件，污染 `history.db` 的历史（`docs/rollback`/`B7` 的 append-only 契约会因此失真）。

---

## 6. WS / 前端反应

### 6.1 帧序（新连接，逐帧）

```
← { type: 'connected', timestamp }          index.ts:196（既有，最先）
← <replayRing 的最近最多 5 个完整轮次，逐帧>  NEW（replayTo）
← { type: 'replay_done', turns, timestamp }  NEW
← …实时帧（broadcast 路径，无变化）
```

**为什么 `connected` 在回放之前**：前端 `onopen`（`useWorld.ts:981-985`）在 socket open 时立刻 `fetchLayer`，与回放并行——回放的是**演出**，重取的是**内容**，两者不冲突。`connected` 先行使前端能立刻判断「服务端接受了我」（`airp-gateway.ts:154-156` 的连接只负责收发）。

### 6.2 前端消费：`replaying` 只影响输入，不影响渲染

- `onopen` → `setReplaying(true)`（**新增**，紧挨 `resetWriter('socket_open')`，`:983`）。
- `replay_done` → `setReplaying(false)`。
- `sendToWriter`（`:518-543`）在 `getWriterState().phase === 'writing'`（`:523`）之外，再加 `|| replaying` → `{ accepted: false, reason: 'busy', message: 'Catching up…' }`。
  **若不接这一步**：玩家在回放中途提交，`writer_prompt` 与回放帧交错到达，湿墨状态机（`writer-state.ts:140` 的 `acceptWriterFrame`）会先 `start()` 再被历史 `writer_idle` 提前收尾 → **输入锁提前打开**，玩家连按两次。
- **音效闸门（裁决 D 附带项）**：`chalk_writing` → `playCharge`（`useWorld.ts:849`）、`chalk_landed` → `playFoley('paper-slide')`（`:884`）随**内容帧**而来，而这两个帧在 allowlist 里、**会**被回放；前端 MUST 在 `replaying` 期间把这两个音效调用闸掉，否则「刷新会响两声」。共享同一个 `replaying` 布尔，不新增状态。
- **超时兜底（本批已落地）**：`replayTo` 是同步的，若它因异常没发出 `replay_done`，`replaying` 会永挂。前端在 `onopen` 用 `window.setTimeout(…, REPLAY_DONE_TIMEOUT_MS)` 布防（`REPLAY_DONE_TIMEOUT_MS = 3000`，单一真相源 `packages/shared/src/protocol/ws.ts`），`replay_done` / `onclose` / effect cleanup 三处撤防；超时后强制 `replaying = false` 并 `window.dispatchEvent(new CustomEvent('airp:notice', …))`——**这是唯一允许的兜底**，因为「服务端同步发帧」这一事实意味着超时只可能是异常路径。

### 6.3 与既有 `replay_entry` 的关系（**两件事，别混**）

| | `replay_entry`（既有） | R1 的回放（本批） |
|---|---|---|
| 谁发 | `lifecycle.scheduleWarmup`（`apps/server/src/engine/lifecycle.ts:423-440`，`:435` 发射），续档 spawn 后 800ms | `eventBridge.replayTo`，**客户端连接时** |
| 内容 | pi 会话的 **custom entry**（choice 等） | **已广播的演出帧**（allowlist 内） |
| 触发 | 服务端 spawn（进程级） | 浏览器连上（连接级） |
| 前端 | 未消费（门禁 `INTENTIONALLY_UNCONSUMED`，`check-ws-contract.mjs:86`） | 消费 `replay_done` |
| 缺失后果 | choice 组回到作家会话 | **刷新丢一整段演出** |

两者**可以同时发生**（续档 spawn + 玩家随后刷新），顺序无保证；它们不共享状态，故不冲突。

---

## 7. 错误边界（不静默降级）

| 情形 | 行为 | 判据 |
|---|---|---|
| `replayRing` 为空（服务端刚起、还没广播过） | `replayWindow` 返回 `[]`，只发 `replay_done`（`turns: 0`） | 前端 `replaying` 立刻归位；**不得**因为「没东西可回放」而不发边界帧 |
| 环里全是 `writer_idle` 之前的前半轮（不足一轮） | 完整轮次 0 → `replayWindow` 找不到 `writer_idle` → 返回 `[]`，**半轮被裁掉**（裁决 I） | 前端只收到 `replay_done`（`turns: 0`）；不注册永不落地的幻影。**已裁定**，见 §12.2 |
| 环里尾部挂着半轮（作家正在写、或作家死亡路径，见 §12.2） | TAIL 裁：从尾回退到最后一个 `writer_idle`，其后的帧全部丢弃 | 回放**末帧恒为 `writer_idle`**；验收测试 §10-1 断言此条 |
| 某个 socket 已 `CLOSING`/`CLOSED` | `replayTo` 跳过 `send`（`readyState !== 1`） | 不抛错 |
| `client.send` 抛错（半死连接） | per-send try/catch + `console.warn` 带 socket 维度信息，**继续**发后续帧 | 与 `broadcast` 的 per-client 纪律一致（`:440-451` 的注释解释了「一个半死 socket 不能饿死其余」） |
| 前端没收到 `replay_done`（异常路径） | **不静默**：`REPLAY_DONE_TIMEOUT_MS`（3000，`protocol/ws.ts`）后强制 `replaying=false` 并 `window.dispatchEvent(new CustomEvent('airp:notice', …))` | `docs/tools/00` 硬约束 4：失败必须可见。**已落地**（`useWorld.ts` 的 `onopen` 布防 / `replay_done`+`onclose`+cleanup 撤防） |
| allowlist 外的帧被误压入环（回归） | **测试红**：`04 §10.2` 的源码扫描断言环内只含 allowlist 帧名（`world_event` 与 `error`/`turn_aborted`/`agent_progress` 均不得出现） | — |

---

## 8. 代码落点

| 符号 | 文件 | 位置 |
|---|---|---|
| `replayWindow(buffer, turns)` | `apps/server/src/engine/event-bridge.ts` | 顶层导出，与 `messageText`（`:41`）/ `mapEngineEvent`（`:129`）同族（**均为 `export function`**） |
| `REPLAY_BUFFER_KEEP` | 同上 | 顶层常量，与 `TAIL_POLL_MS`（`:16`）/ `WATCH_DEBOUNCE_MS`（`:18`）同族 |
| `REPLAY_FRAME_ALLOWLIST` | **新建**的 `packages/shared/src/protocol/ws.ts`（`01`，`00 §3.1` 冻结值） | `event-bridge.ts` 的 `broadcast` 入环判定处 import 使用 |
| `EventBridge.replayRing` | `event-bridge.ts` | 类字段，紧邻 `toolArgsByCallId`（`:406`） |
| `EventBridge.broadcast` | 同上 | `:440`（既有函数末尾按 allowlist 加压环） |
| `EventBridge.replayTo` | 同上 | 新方法，紧邻 `broadcast` |
| `EventBridge.close` | 同上 | `:622`（加 `this.replayRing = []`） |
| `eventBridge.replayTo(ws)` | `apps/server/src/index.ts` | `wss.on('connection')`（`:188`）内、`:196` 之后 |
| `case 'replay_done'` | `apps/web/src/state/useWorld.ts` | `switch`（`:698`）内，建议紧邻 `case 'turn_aborted'`（`:826`）之前 |
| `replaying` state | 同上 | 与 `initializingLayer`（`:295`）同族 |

---

## 9. 与现状差异

| 今天 | 变成 |
|---|---|
| 刷新后演出帧全丢，画面靠 `onopen` 的 `fetchLayer`（`useWorld.ts:984`）重取文件 | 连上时重发最近最多 5 个**完整**轮演出帧（尾部半轮裁掉），`replay_done` 收尾 |
| 无回放缓冲；`broadcast`（`event-bridge.ts:440`）纯扇出 | `broadcast` 顺手压环（allowlist 过滤 + 上界） |
| `replay_entry` 是唯一的「回放」，且前端不消费（`check-ws-contract.mjs:86`） | 新增连接级回放；`replay_entry` 语义不变（§6.3） |
| 前端无「补历史中」概念 | 本地 `replaying` 布尔，只影响输入与音效闸门 |
| `docs/development/后端实现计划.md:606` 未勾 | 可勾（验收见 `04 §11`） |

---

## 10. 验收测试（可机械核验）

**新建**的 `apps/server/test/gateway-replay.test.mjs`：

1. **切轮 + 尾裁**：构造 `[<轮1 若干帧>, writer_idle, <轮2>, writer_idle, …, <轮5>, writer_idle, <尾部半轮：chalk_writing 无 writer_idle>]` —— 即 **5 个完整轮 + 尾部半轮** —— → `replayWindow(buf, 5)` 返回最近 5 个完整轮（首帧是轮 1 的**首帧**），且**返回值的末帧是 `writer_idle`**（尾部半轮被裁掉，未出现在返回里）。另补一组「6 完整轮 + 尾部半轮」→ 返回以「第 2 个 `writer_idle` 之后」开头，末帧仍是 `writer_idle`。
2. **最旧一轮不截断**：断言返回值的第一帧是该轮的**首帧**（不是轮中某帧）。
3. **不足 5 轮**：仅 2 个 `writer_idle` 且尾部无残留 → 返回整段（两轮）。
4. **无 `writer_idle`**：整段只有半轮 → 返回 `[]`（不是整段）。
5. **非法 JSON 行**：插入 `'not json'` → 照发、且不改变切轮结果。
6. **上界**：压入 `REPLAY_BUFFER_KEEP + 10` 条 → `replayRing.length === REPLAY_BUFFER_KEEP`，且**最旧的 10 条被裁**。
7. **allowlist 过滤**：`broadcast({type:'world_event',…})`、`broadcast({type:'file_changed',…})`、`broadcast({type:'error',…})`、`broadcast({type:'turn_aborted',…})`、`broadcast({type:'agent_progress',…})`、`broadcast({type:'writer_delta',…})`、`broadcast({type:'dice_result',…})`、`broadcast({type:'show_frame',…})`、`broadcast({type:'image_landed',…})` 后环内**不含**这些 type；`broadcast({type:'chalk_writing',…})` / `'chalk_landed'` / `'card_writing'` / `'writer_message'` / `'writer_idle'` 后环内**含**。
8. **`replay_done` 收尾**：用假 `{readyState:1, send: spy}` 调 `replayTo` → 最后一条是 `{"type":"replay_done",…}`，且**恰好一条**，且其 `turns` 是数字、等于回放的完整轮数（构造 3 轮 → `turns === 3`）。
9. **死 socket**：`readyState: 3` → `send` 零调用、不抛错。
10. **抛错 sink**：`send` 第 2 次抛错 → 后续帧仍发出（per-send try/catch）。

**非空性**（每条断言必须能证明自己会红）：

- 把 `replayWindow` 的 `found === turns + 1` 改成 `found === turns` → 测试 1 必须红（会多切一轮）。
- 删掉 TAIL 裁（`slice(0, lastWriterIdle + 1)` 那一步）→ 测试 1 必须红（末帧变成 `chalk_writing`）。
- 把入环过滤从 allowlist 改回「排除 `world_event`/`file_changed`」→ 测试 7 必须红（`error`/`agent_progress` 会进环）。
- `replay_done` 载荷去掉 `turns` → 测试 8 必须红。

**前端超时兜底**（`useWorld.ts`，非本测试文件覆盖；手工验收）：把 `REPLAY_DONE_TIMEOUT_MS` 调到 100ms 且用假 server 不发 `replay_done` → `onopen` 后约 100ms 必须出现一次 `airp:notice`、且 `replaying` 归位（`sendToWriter` 不再返回 `Catching up…`）。若不出现 → 兜底没接上。

---

## 11. 发现的冲突 / 需要修订的上位文档

| # | 位置 | 冲突 | 处置 |
|---|---|---|---|
| 1 | `docs/development/后端实现计划.md:606` | 行锚写 `lifecycle.ts:417,435` | 实际 `scheduleWarmup` 在 `:423-440`；`replay_entry` 发射在 `:435`。见 `00 §8-7` |
| 2 | `docs/development/后端实现计划.md:126`（§2.1 #3） | 说「回放按 `agent_end` 切轮次」 | AIRP 的帧面没有 `agent_end`（`lifecycle` 只在 `eventSink` 里见它，`event-bridge` 的映射表 `docs/tools/12:338` 把 `agent_settled` 映成 `*_idle`）。本批裁决 C 改切 `writer_idle`，**需回写**该行。（修订 1，评审 m7：原引 `:587` 是帧行，映射行实为 `:338`） |
| 3 | `docs/development/后端实现计划.md:504-505` | 「`session-host.ts`：seq 盖章 / 回放缓冲 / …」 | seq 已有持久源（`history.db`），见 `00 §1.2` 证据 B |
| 4 | `tools/check-ws-contract.mjs:86` | `replay_entry` 被登记为 `INTENTIONALLY_UNCONSUMED`，理由「frontend plan has no task for it」 | 本批**不动**它（§12.5）；新增的 `replay_done` **不属于**该豁免表 |
| 5 | `02 §2.1`（本文件，修订前） | docstring 称「客户端已按帧内容去重演出帧」 | **假前提**，已删改；真实理由是 allowlist 从源头排除有副作用的帧。见 `REVIEW.md` B2 |
| 6 | `02 §3.2` 第 2 步（本文件，修订前） | 过滤实现是 denylist（只排 `world_event`/`file_changed`），却宣称只回放演出帧 | **改为 allowlist**（裁决 D）；漏收的代价是 `error`/`turn_aborted` 重弹 notice + `agent_progress` 伪锁输入。见 `REVIEW.md` B3 |
| 7 | `02 §2.1`/`§3.2`/`§7`（本文件，修订前） | `replayWindow` 只保证**起点**在轮界，docstring 却写「whole turns or nothing」 | **补尾部裁剪**（裁决 I）：从尾回退到最后一个 `writer_idle`；尾部半轮不再整段发出。见 `REVIEW.md` M1 |
| 8 | `02 §3.2` 第 5 步、`§12.2`（本文件，修订前） | `replay_done` 载荷无 `turns`，与 `00 §3.2`/`04 §2.1` 互斥 | **统一为 `{ type, turns, timestamp }`**（裁决 H）。见 `REVIEW.md` M3 |
| 9 | `02 §8`（本文件，修订前） | 引 `cardWritingFrame`（内部函数、无 `export`）作「同族导出」先例 | 改引 `mapEngineEvent`（`event-bridge.ts:129` 的 `export function`）。见 `REVIEW.md` n1 |

---

## 12. 待拍板（第 1–4 条已裁定；第 5 条留后续；第 6–7 条仍待拍板）

1. **（已裁定）窗口是否包含 `writer_delta`（湿墨）？** —— **不含**（裁决 D 的 allowlist 明确排除 `*_delta`）。窗口里的 `_delta` 是已落盘那一轮的墨，重放会让前端先画一遍湿墨、随后被 `fetchLayer` 的真实卡覆盖（**双画**，且覆盖顺序不保证），且 `appendInk` 是纯追加、无去重（`useWorld.ts:877`）。若评审要求「刷新后还能看到正在写的那一笔」，正确做法是给**进行中的那一轮**单独留一条非窗口通道，而不是把 `_delta` 塞进窗口。
2. **（已裁定）尾部半轮的去留** —— **裁掉**（裁决 I）。理由：裁剪本身由 `replayWindow` 的 TAIL 步骤保证（§3 第 3 步），不需要额外机制。**为什么必须裁**——作家死亡路径会在环里留下**永不落地**的 `chalk_writing`：`lifecycle.handleWriterDeath`（`apps/server/src/engine/lifecycle.ts:378`）达 `MAX_RESTART_ATTEMPTS`（`:55`，5 次）后 `console.error` 并 `return`（`:391-395`），**不补** `writer_idle`；此时环尾是一段没有终帧的半轮。若照原设计只做 HEAD 裁、把这段半轮整段发出，前端 `registerPhantom` 会注册一个永不落地的幻影，骨架永久占位，且**每次刷新重演**。
3. **（已裁定）`replay_done` 带 `turns`** —— **带**（裁决 H，载荷 `{ type, turns, timestamp }`）。`turns` = 实际回放的**完整轮数**，可 < 5：环里不足 5 轮（服务端刚起、或窗口内 `writer_idle` 少于 6 个），或尾部半轮被裁后只剩 2 轮。`00 §3.2`、`04 §2.1` 与本节已同批统一。
4. **（已裁定）前端 `REPLAY_DONE_TIMEOUT_MS` 兜底** —— **要**（不静默）。`replayTo` 同步发帧，故超时只可能是异常路径；无声永锁比一次可见 notice 更糟。**本批已落地**（`REPLAY_DONE_TIMEOUT_MS = 3000` 在 `packages/shared/src/protocol/ws.ts`；`useWorld.ts` 三处撤防）。原条目引用的「`00 §9-3`」是**引用错位**——`00 §9-3` 实为「输入锁由谁持有」；超时兜底在 `00 §9` 中无对应条目，已在 `00 §9` 补登。
5. **`replay_entry` 是否本批一并消费？**（`00 §9-7`）倾向不做（属 `perform` 批次）。
6. **`replaying` 期间是否也拦 `character_prompt`/`airp_init`？** 倾向**只拦作家输入**：角色的遮罩是自己的会话（`character_start` 自带 high-water 语义，`index.ts:258-277`），回放的是作家演出。**待拍板。**
7. **窗口是否跨世界清空？** 倾向**要**：`/api/worlds/load`（`routes/world.ts:589`）切世界时 `eventBridge` 不会自动知道——但 `startTailReader`（`:640`）会 bump epoch。**登记**：`replayTo` 应带 `worldRoot` 校验，或切世界时显式 `eventBridge.clearReplay()`；本批倾向**在 `broadcast` 压环处不做世界标记，改为切世界时清环**（`00 §8-2` 的既有接线点）。**待拍板。**
