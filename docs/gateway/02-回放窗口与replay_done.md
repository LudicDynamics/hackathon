# docs/gateway/02 — 回放窗口与 `replay_done`

> 状态：**设计稿（2026-09-14）**，待评审。属 B6「网关与会话域」（见 `docs/gateway/00-共同上下文.md`，下称 `00`）。
> 边界：`apps/server/src/engine/event-bridge.ts`（环形缓冲 + 窗口 + 回放）、`apps/server/src/index.ts`（连接时触发回放）、`apps/web/src/state/useWorld.ts`（消费 `replay_done`）。**不碰** `lifecycle.ts` 的 warmup（`02 §8`）。
> 依据：`00 §3.2`（新帧）、`docs/development/后端实现计划.md:606`（唯一未达标的收工项）、rivet `session-host.mjs:80-100,792-812`（照抄第 3/4 条，见 `00` 附一）。

---

## 1. 一句话定位

**给每个已广播的演出帧做一段有上界的环形缓冲；浏览器连上时，服务端从缓冲尾部往回找第 6 个轮界，把最近 5 个完整轮次重发一遍，末尾补一帧 `replay_done`——它不改世界、不写事件，只是让「刷新不丢叙事」这句承诺从『靠 `fs.watch` 巧合兜底』变成一条可核验的契约。**

今天的实情：前端一刷新就丢光本轮的湿墨、笔尖、骰子仪式与角色台词；画面重新长出来全靠 `onopen` 的 `fetchLayer`（`useWorld.ts:766`）重取**文件**（`useWorld.ts:492-494`）。**文件能重取，演出不能。** `docs/development/后端实现计划.md:606` 把这条标为未达标，且它是 §13 全表唯一一条「设计与代码不一致」的真缺口（`00 §1.2` 证据 C）。

---

## 2. 签名与参数

### 2.1 `event-bridge.ts` 新增成员（NEW）

```ts
/** Complete turns replayed to a fresh socket. Mirrors `REPLAY_TURNS`. */
const REPLAY_BUFFER_KEEP = 4000;

/**
 * Pure: take the newest `turns` COMPLETE turns out of a serialized-frame
 * buffer. A turn ends at `writer_idle`. The oldest included turn is NEVER
 * truncated — we start after the (turns+1)th `writer_idle` from the tail, so
 * what we return is whole turns or nothing. Non-JSON lines are replayed
 * verbatim but do not count toward the turn budget.
 *
 * Mirrors `~/projects/worldlines-rivet/services/gateway/session-host.mjs:80-100`
 * with one substitution: rivet cuts on `agent_end`, AIRP cuts on the FRAME
 * `writer_idle` (decision C, docs/gateway/00 §7) — `agent_end` never reaches
 * the frame surface.
 */
export function replayWindow(buffer: readonly string[], turns = REPLAY_TURNS): string[];
```

```ts
// inside class EventBridge
/** Serialized frames already broadcast — the replay source. Bounded by
 *  REPLAY_BUFFER_KEEP; never carries `world_event` / `file_changed` (decision D). */
private replayRing: string[] = [];

/** Broadcast, then buffer. The ONLY change to the existing fan-out. */
broadcast(message: Record<string, unknown>): void;   // existing: event-bridge.ts:425

/**
 * Send the last `turns` complete turns to ONE freshly-connected socket, then
 * the boundary frame. Synchronous: registration and snapshot happen in the
 * same tick, so the overlap with live fan-out can only be byte-identical
 * duplicates (which the client already dedupes by `event.id` for world events
 * and by frame content for presentation frames).
 */
replayTo(client: { readyState: number; send(payload: string): void }): void;   // NEW
```

### 2.2 `index.ts` 的接线（NEW，一行）

在 `wss.on('connection')`（`apps/server/src/index.ts:174`）里、`connected` 帧（`:182`）**之后**：

```ts
eventBridge.replayTo(ws);   // NEW — after `connected`, before `ws.on('message')`
```

### 2.3 前端（`useWorld.ts`，NEW）

`onMessage` 的 `switch`（`apps/web/src/state/useWorld.ts:491`）加一个分支：

```ts
case 'replay_done':
  // Boundary frame: the server finished re-sending the last N turns. Clears
  // the reconnect-scoped "still catching up" flag so the writer input is not
  // held hostage by a replay that already ended (perf/01 §6.4 same family).
  setReplaying(false);
  break;
```

配合一个本地 state（细节见 §6）。

---

## 3. 行为契约逐步

每步写「漏了会怎样」。

1. **`broadcast` 在 JSON 序列化之后、fan-out 之前，把 payload 压入 `replayRing`；超过 `REPLAY_BUFFER_KEEP` 时从头部 `splice` 掉溢出量。**
   漏了会怎样：① 不缓冲 → 回放源为空，连上后只有 `replay_done`，前端以为「补完了」而实际什么都没补（**比现状更糟：现在至少文件重取还在**）；② 无上界 → 一场长演示后 `replayRing` 持有数十万条字符串，内存随帧数线性增长到 OOM。
2. **压入前按 `message.type` 过滤：`world_event` 与 `file_changed` 不入环。**
   漏了会怎样：`world_event` 在缓冲里被重放 → 前端 `noteWorldEvent`（`useWorld.ts:365-374`）判重后丢弃，**不会出错但白跑**；真正的代价在下一条：`world_event` 与 `file_changed` 的消费动作是 `void fetchLayer(...)`（`:493/:517`），窗口里 5 轮的事件会让前端在连上瞬间**并发发起几十次整层重取**。
3. **`replayWindow(buffer, 5)`：从尾往前数 `writer_idle`，找到第 6 个时 `slice(i + 1)`。不足 6 个则返回整段。**
   漏了会怎样：按「最近 5 条」而不是「最近 5 轮」切 → 窗口里出现**半轮**（有 `chalk_writing` 没有 `chalk_landed`），前端 `registerPhantom`（`useWorld.ts:627` 的 `case 'chalk_writing'` 分支，`:624`）注册一个永不落地的幻影，骨架永久占位。
4. **非法 JSON 行照发、且不计入轮次。**
   漏了会怎样：一行坏数据把轮次计数吃偏一位，窗口要么少一轮要么切在轮中——同上的半轮问题，但更难复现。
5. **`replayTo` 内同步：`for (const line of replayWindow(this.replayRing)) client.send(line);` 紧接着 `client.send(JSON.stringify({ type: 'replay_done', timestamp }))`，全程同一 tick。**
   漏了会怎样：若中间 `await`，实时帧会在回放中途插入 → 前端看到乱序（`chalk_landed` 早于 `chalk_writing`），幻影过户失败，纸片卡在天上。rivet 的注释正是为此（`session-host.mjs:792-795`）。
6. **`replayTo` 只在 `client.readyState === 1` 时 `send`，且对每个 send 单独 try/catch。**
   漏了会怎样：握手期就断开的 socket 让 `send` 抛错，异常冒到 `wss.on('connection')` 外，**整个连接处理器崩掉**（与 `broadcast` 的 per-client try/catch 同因，`event-bridge.ts:425-437`）。
7. **`replay_done` 有 `timestamp` 字段，且是帧名而非事件。**
   漏了会怎样：缺 `timestamp` 让帧与既有帧族不同形（`docs/tools/12 §6.2` 每行都有 `timestamp`）；进 `events.ts` 的闭集则编译期就错（`AGENTS.md:29` 族，见 `00 §3.6` 第 5 条）。
8. **回放不落账、不改游标、不触发 `drainWorldEvents`。**
   漏了会怎样：若回放顺手推 `eventBridge.lastSeq`（`event-bridge.ts:398`），**会把未广播的事件永久跳过**——`drainWorldEvents` 的注释（`:492-495`）专门警告过这个方向。

---

## 4. 文件与副作用

| 文件 | 改动 | 详细 |
|---|---|---|
| `apps/server/src/engine/event-bridge.ts` | ① 顶层加 `replayWindow` 纯函数（与 `mapEngineEvent`（`:114`）同族的顶层导出惯例）；② 类字段 `replayRing`；③ `broadcast`（`:425`）末尾压环；④ 新方法 `replayTo`；⑤ `close()`（`:608`）清空 `replayRing` | 约 50 行 |
| `apps/server/src/index.ts` | `wss.on('connection')`（`:174`）内、`connected`（`:182`）之后加 `eventBridge.replayTo(ws);` | 1 行 |
| `apps/web/src/state/useWorld.ts` | ① 一个 `replaying` state；② `onopen`（`:763-767`）置 `true`；③ `switch`（`:491`）加 `case 'replay_done'` 置 `false`；④ 必要时在 `sendToWriter`（`:311`）里把 `replaying` 纳入 busy 判定 | 约 15 行 |
| `docs/tools/12-工具注册与路由统一.md` §6.2 | 加 `replay_done` 一行 | 见 `04 §3` |

**副作用边界**：不新增文件、不改 `lifecycle.ts`、不改 `history.db`/`canvas.db`、不改 `writer-state.ts` 的公开状态机（`00 §9-3`）。

---

## 5. 落账

**不落账。** 回放的是**传输帧**，不是事件（`docs/tools/00 §5.3`：演出帧是瞬时传输；世界事件走 `world_event`）。理由：`doc-21 §1.1` 定「传输帧不入事件表」；回放若落账会凭空造出事件，污染 `history.db` 的历史（`docs/rollback`/`B7` 的 append-only 契约会因此失真）。

---

## 6. WS / 前端反应

### 6.1 帧序（新连接，逐帧）

```
← { type: 'connected', timestamp }          index.ts:182（既有，最先）
← <replayRing 的最近 5 个完整轮次，逐帧>     NEW（replayTo）
← { type: 'replay_done', timestamp }         NEW
← …实时帧（broadcast 路径，无变化）
```

**为什么 `connected` 在回放之前**：前端 `onopen`（`useWorld.ts:763-767`）在 socket open 时立刻 `fetchLayer`，与回放并行——回放的是**演出**，重取的是**内容**，两者不冲突。`connected` 先行使前端能立刻判断「服务端接受了我」（`airp-gateway.ts:139-145` 的连接只负责收发）。

### 6.2 前端消费：`replaying` 只影响输入，不影响渲染

- `onopen` → `setReplaying(true)`（**新增**，紧挨 `resetWriter('socket_open')`，`:765`）。
- `replay_done` → `setReplaying(false)`。
- `sendToWriter`（`:311-337`）在 `getWriterState().phase === 'writing'`（`:316`）之外，再加 `|| replaying` → `{ accepted: false, reason: 'busy', message: 'Catching up…' }`。
  **若不接这一步**：玩家在回放中途提交，`writer_prompt` 与回放帧交错到达，湿墨状态机（`writer-state.ts:140` 的 `acceptWriterFrame`）会先 `start()` 再被历史 `writer_idle` 提前收尾 → **输入锁提前打开**，玩家连按两次。
- **超时兜底**：`replayTo` 是同步的，若它因异常没发出 `replay_done`，`replaying` 会永挂。`02 §7` 给前端一个 `REPLAY_DONE_TIMEOUT_MS`（建议 3000ms）的本地兜底——**这是唯一允许的兜底**，因为「服务端同步发帧」这一事实意味着超时只可能是异常路径。`[推断]` 是否值得加，见 §12.3。

### 6.3 与既有 `replay_entry` 的关系（**两件事，别混**）

| | `replay_entry`（既有） | R1 的回放（本批） |
|---|---|---|
| 谁发 | `lifecycle.scheduleWarmup`（`apps/server/src/engine/lifecycle.ts:423-440`），续档 spawn 后 800ms | `eventBridge.replayTo`，**客户端连接时** |
| 内容 | pi 会话的 **custom entry**（choice 等） | **已广播的演出帧** |
| 触发 | 服务端 spawn（进程级） | 浏览器连上（连接级） |
| 前端 | 未消费（门禁 `INTENTIONALLY_UNCONSUMED`，`check-ws-contract.mjs:70`） | 消费 `replay_done` |
| 缺失后果 | choice 组回到作家会话 | **刷新丢一整段演出** |

两者**可以同时发生**（续档 spawn + 玩家随后刷新），顺序无保证；它们不共享状态，故不冲突。

---

## 7. 错误边界（不静默降级）

| 情形 | 行为 | 判据 |
|---|---|---|
| `replayRing` 为空（服务端刚起、还没广播过） | `replayWindow` 返回 `[]`，只发 `replay_done` | 前端 `replaying` 立刻归位；**不得**因为「没东西可回放」而不发边界帧 |
| 环里全是 `writer_idle` 之前的前半轮（不足一轮） | 完整轮次 < 1 → `replayWindow` 按 `found === turns+1` 找不到 → 返回**整段**（含半轮） | **本批接受**（与 rivet 同：缓冲里只有半轮时无法更保守）；登记 §12.1 |
| 某个 socket 已 `CLOSING`/`CLOSED` | `replayTo` 跳过 `send`（`readyState !== 1`） | 不抛错 |
| `client.send` 抛错（半死连接） | per-send try/catch + `console.warn` 带 socket 维度信息，**继续**发后续帧 | 与 `broadcast` 的 per-client 纪律一致（`:425-437` 的注释解释了「一个半死 socket 不能饿死其余」） |
| 前端没收到 `replay_done`（异常路径） | **不静默**：`REPLAY_DONE_TIMEOUT_MS` 后强制 `replaying=false` 并 `window.dispatchEvent(new CustomEvent('airp:notice', …))` | `docs/tools/00` 硬约束 4：失败必须可见 |
| `world_event` 被误压入环（回归） | **测试红**：`04 §5.4` 断言环内不含 `"type":"world_event"` | — |

---

## 8. 代码落点

| 符号 | 文件 | 位置 |
|---|---|---|
| `replayWindow(buffer, turns)` | `apps/server/src/engine/event-bridge.ts` | 顶层导出，与 `messageText`（`:26`）/`cardWritingFrame`（`:79`）同族 |
| `REPLAY_BUFFER_KEEP` | 同上 | 顶层常量，与 `TAIL_POLL_MS`（`:16`）/`WATCH_DEBOUNCE_MS`（`:18`）同族 |
| `EventBridge.replayRing` | 同上 | 类字段，紧邻 `toolArgsByCallId`（`:391`） |
| `EventBridge.broadcast` | 同上 | `:425`（既有函数末尾加压环） |
| `EventBridge.replayTo` | 同上 | 新方法，紧邻 `broadcast` |
| `EventBridge.close` | 同上 | `:608`（加 `this.replayRing = []`） |
| `eventBridge.replayTo(ws)` | `apps/server/src/index.ts` | `wss.on('connection')`（`:174`）内、`:182` 之后 |
| `case 'replay_done'` | `apps/web/src/state/useWorld.ts` | `switch`（`:491`）内，建议紧邻 `case 'turn_aborted'`（`:612`）之前 |
| `replaying` state | 同上 | 与 `initializingLayer`（`:158`）同族 |

---

## 9. 与现状差异

| 今天 | 变成 |
|---|---|
| 刷新后演出帧全丢，画面靠 `onopen` 的 `fetchLayer`（`useWorld.ts:766`）重取文件 | 连上时重发最近 5 轮演出帧，`replay_done` 收尾 |
| 无回放缓冲；`broadcast`（`event-bridge.ts:425`）纯扇出 | `broadcast` 顺手压环（有上界） |
| `replay_entry` 是唯一的「回放」，且前端不消费（`check-ws-contract.mjs:70`） | 新增连接级回放；`replay_entry` 语义不变（§6.3） |
| 前端无「补历史中」概念 | 本地 `replaying` 布尔，只影响输入 |
| `docs/development/后端实现计划.md:606` 未勾 | 可勾（验收见 `04 §11`） |

---

## 10. 验收测试（可机械核验）

`apps/server/test/gateway-replay.test.mjs`：

1. **切轮**：构造 `[<轮1 若干帧>, writer_idle, <轮2>, writer_idle, …, <轮6>, writer_idle, <轮7 半轮>]` 共 7 个 `writer_idle` → `replayWindow(buf, 5)` 返回以「第 3 个 `writer_idle` 之后」开头（即最近 5 个完整轮）。
2. **最旧一轮不截断**：断言返回值的第一帧是该轮的**首帧**（不是轮中某帧）。
3. **不足 5 轮**：仅 2 个 `writer_idle` → 返回整段。
4. **非法 JSON 行**：插入 `'not json'` → 照发、且不改变切轮结果。
5. **上界**：压入 `REPLAY_BUFFER_KEEP + 10` 条 → `replayRing.length === REPLAY_BUFFER_KEEP`，且**最旧的 10 条被裁**。
6. **过滤**：`broadcast({type:'world_event',…})` 与 `broadcast({type:'file_changed',…})` 后环内**不含**这两种 type；`broadcast({type:'chalk_writing',…})` 后含。
7. **`replay_done` 收尾**：用假 `{readyState:1, send: spy}` 调 `replayTo` → 最后一条是 `{"type":"replay_done",…}`，且**恰好一条**。
8. **死 socket**：`readyState: 3` → `send` 零调用、不抛错。
9. **抛错 sink**：`send` 第 2 次抛错 → 后续帧仍发出（per-send try/catch）。

**非空性**：把 `replayWindow` 的 `found === turns + 1` 改成 `found === turns` → 测试 1 必须红（会多切一轮）。

---

## 11. 发现的冲突 / 需要修订的上位文档

| # | 位置 | 冲突 | 处置 |
|---|---|---|---|
| 1 | `docs/development/后端实现计划.md:606` | 行锚写 `lifecycle.ts:417,435` | 实际 `scheduleWarmup` 在 `:423-440`；`replay_entry` 发射在 `:435`。见 `00 §8-7` |
| 2 | `docs/development/后端实现计划.md:126`（§2.1 #3） | 说「回放按 `agent_end` 切轮次」 | AIRP 的帧面没有 `agent_end`（`lifecycle` 只在 `eventSink` 里见它，`event-bridge` 的映射表 `docs/tools/12:587` 把 `agent_settled` 映成 `*_idle`）。本批裁决 C 改切 `writer_idle`，**需回写**该行 |
| 3 | `docs/development/后端实现计划.md:504-505` | 「`session-host.ts`：seq 盖章 / 回放缓冲 / …」 | seq 已有持久源（`history.db`），见 `00 §1.2` 证据 B |
| 4 | `tools/check-ws-contract.mjs:70` | `replay_entry` 被登记为 `INTENTIONALLY_UNCONSUMED`，理由「frontend plan has no task for it」 | 本批**不动**它（§12.4）；新增的 `replay_done` **不属于**该豁免表 |

---

## 12. 仍未知待拍板

1. **窗口要不要包含 `writer_delta`（湿墨）？**（`00 §9-1`）
   倾向：**不含**。窗口里的 `_delta` 是已落盘那一轮的墨，重放会让前端先画一遍湿墨、随后被 `fetchLayer` 的真实卡覆盖（**双画**，且覆盖顺序不保证）。若评审要求「刷新后还能看到正在写的那一笔」，正确做法是给**进行中的那一轮**单独留一条非窗口通道，而不是把 `_delta` 塞进窗口。**待拍板。**
2. **`replay_done` 是否带 `turns`？**（`00 §9-2`）倾向带（可核验、低风险）。**待拍板。**
3. **前端 `REPLAY_DONE_TIMEOUT_MS` 兜底是否必要？**（`00 §9-3`）倾向需要（不静默），但它是**唯一**允许的兜底；若评审认为「同步发帧不可能丢」则删。**待拍板。**
4. **`replay_entry` 是否本批一并消费？**（`00 §9-7`）倾向不做（属 `perform` 批次）。
5. **`replaying` 期间是否也拦 `character_prompt`/`airp_init`？** 倾向**只拦作家输入**：角色的遮罩是自己的会话（`character_start` 自带 high-water 语义，`index.ts:244-264`），回放的是作家演出。**待拍板。**
6. **窗口是否跨世界清空？** 倾向**要**：`/api/worlds/load`（`routes/world.ts:557`）切世界时 `eventBridge` 不会自动知道——但 `startTailReader`（`:601`）会 bump epoch。**登记**：`replayTo` 应带 `worldRoot` 校验，或切世界时显式 `eventBridge.clearReplay()`；本批倾向**在 `broadcast` 压环处不做世界标记，改为切世界时清环**（`00 §8-2` 的既有接线点）。**待拍板。**
