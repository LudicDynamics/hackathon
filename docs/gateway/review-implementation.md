# docs/gateway/review-implementation — 可实施性 / 语义兑现评审（R1 + R2）

> 评审对象：`docs/gateway/02-回放窗口与replay_done.md`、`03-心跳与关闭码.md`（及 `00` 相关裁定）。
> 评审基准：当前 HEAD `e1c9127`（设计写作锚点 `45269cf`，漂移 82 个提交）。
> 评审人：ReviewImpl（只读评审）。落盘：主 agent（评审角色无写权限）。
> 结论：**BLOCK**。

---

## 结论

**BLOCK** — R1/R2 的行为方向正确、大部分可落地，但 `03 §2.2` 的 STT upgrade 片段照字面实现会让语音输入整条死（同篇 `§2.2`/`§3.1`/`§8` 三处自相矛盾，只有 `§8` 对），且 R1 的 `replayWindow` 尾裁剪、前端去重前提、裁定 D 的过滤实现三处各含未验证或已证伪的前提，必须先改文档并补算法再落地。降级本身成立（砍两个纯重构模块的理由成立），但「排除理由过宽」与「心跳动机理由错」两处措辞需修订。

---

## 发现

### 1. [BLOCK] `/ws/stt` 的 upgrade 归属同篇三处自相矛盾，照 `§2.2` 实现 STT 全死

位置：`docs/gateway/03-心跳与关闭码.md:72-88`（§2.2）、`:130-131`（§3.1 第 4 步）、`:218`（§8）

`§2.2` 的 upgrade 钩子（`:74`）写 `if (url.pathname.startsWith(STT_STREAM_PATH)) return; // stt owns its own upgrade`，但 STT 没有任何自己的 upgrade 处理器：全仓只有一个 `new WebSocketServer({ server })`（`apps/server/src/index.ts:53`），`handleSttStream` 仅由 `wss.on('connection')`（`:188`）经 `req.url?.startsWith(STT_STREAM_PATH)`（`:190`）在 `:191` 调用。`return` 不 `handleUpgrade` → `/ws/stt` 永不触发 `connection` → 语音输入整条死。同一篇 `§3.1` 第 4 步（`:130-131`）复述了同一假前提，只有 `§8`（`:218`）「用同一个 wss 做 handleUpgrade」是对的。

**漏了会怎样**：部署后打开任意世界的语音输入，`/ws/stt` 握手后服务端不认领 socket，客户端 `{type:'ready'}` 永不到达，麦克风 UI 永远卡在连接中；`node --test apps/server/test/stt-stream.test.mjs` **仍绿**（该测试直调 `handleSttStream`，不经 upgrade），故障不会被单测拦住。

### 2. [MAJOR] `replayWindow` 只保证起点是轮界，docstring 却声称 whole turns or nothing

位置：`docs/gateway/02-回放窗口与replay_done.md:26-30`（docstring）、`:92`（算法）

docstring 写「we start after the (turns+1)th `writer_idle` from the tail, so what we return is whole turns or nothing」，但算法只约束窗口**起点**，对**尾部**不作任何裁剪。

**实测**（`/tmp/spike-replay-window.mjs`）：5 完整轮 + 尾部半轮（`chalk_writing(6)` 无 idle）→ 输出 16 帧、末帧是 `chalk_writing`，`endsOnBoundary=false`。
**对照**：照抄来源 rivet `session-host.mjs:84-104` 算法相同，但其注释**只声明「最旧一轮不截断」**——docstring 是 AIRP 自己加强的断言。

**漏了会怎样**：写入中途刷新（最常见的刷新时刻）→ 窗口发一个只有 `chalk_writing` 没有 `chalk_landed` 的半轮 → `useWorld.ts:840` 的 `case 'chalk_writing'` 调 `registerPhantom` 注册一个**永不落地的幻影**，骨架永久占位并挤座（`phantom-seat.ts:64` 把非 evicted 幻影当障碍）。`phantom.ts` 无全局清理入口（`reconcileLanded` 全仓只有测试调用），未落地的 chalk 幻影**没有退出路径**。

### 3. [MAJOR] 尾部半轮在作家崩溃路径下永不补完，需裁定去留并补尾裁剪

位置：`docs/gateway/02:92-95`

`§3.3` 第 3 步与 `§12.1` 把尾部半轮视为「缓冲里只有半轮时无法更保守」而接受，隐含前提是「尾部半轮就是当前正在进行的实况轮，实况帧会补完」。该前提**在作家中途死亡路径下不成立**：`lifecycle.ts:378` 的 `handleWriterDeath` 在 `writerRestarts >= MAX_RESTART_ATTEMPTS`（`=5`，`:55`）后 `return`——重启失败/放弃时**不会**广播 `writer_idle`（`writer_idle` 只在 `event-bridge.ts:388` 的 `agent_settled` 分支产生，进程已死则永不产生）。于是环里留一个永不落地的 `chalk_writing`，之后**每次**客户端连上都重放该半轮。

**漏了会怎样**：作家连续崩溃 5 次后，任何刷新都重演一个挂在天上的骨架，且它挤占的座位导致后续真实卡排位错误。

**两条路**：② 若保留让实况补完，docstring 与 `§12` 必须显式写明该行为与「崩溃路径除外」的残余风险；③ 若裁掉，算法需增加「切片后从尾回退到最后一个 `writer_idle`」的尾裁剪，`REPLAY_TURNS` 语义要重述为「最多 5 个完整轮」。

### 4. [MAJOR] `replayTo` 的「client already dedupes presentation frames」前提为假

位置：`docs/gateway/02:51-54`（§2.1 docstring）、`§3.4` 第 5 步

逐条核 `useWorld.ts` 的 `onMessage` switch，只有 `world_event`（`noteWorldEvent`，`:709`）与 `dice_result`（`App.tsx:568` `shouldPlayFrame` + `:582` `markPlayed`）有去重；**演出帧族零去重**——`chalk_landed`（`:882-884`）调 `playFoley('paper-slide')`、`show_frame`（`:961`）无条件派发 `airp:show-frame` → `PerformanceLayer.tsx:551` 的 `performShowFrame`（`:421` 无 played 检查）、`writer_delta`（`:875-878`）调 `appendInk`（`phantom.ts:142` 纯追加）、`image_landed`（`:919`）调 `playFoley('crit-chime')`。裁定 D（`00 §9-1:216`）明确要把这些帧放进窗口。

**漏了会怎样**：每次刷新页面，最近 5 轮里每个 `chalk_landed` 再放一次纸张音效、每个 `show_frame` 重演一次演出（DOM/timer/相机/音效）——**玩家可感知的错乱**（刷新后连响数声 + 演出倒带），不是「白跑一次 `fetchLayer`」级别的噪音。

### 5. [MAJOR] 裁定 D 的过滤实现是短排除（denylist），环内实际仍收 `turn_aborted`/`error` 等

位置：`docs/gateway/02:90-91`（§3.2 第 2 步）

`§3.2` 第 2 步说「压入前按 `message.type` 过滤：`world_event` 与 `file_changed` 不入环」，但 `§1`（`:11`）与裁定 D 把窗口描述成「只回放演出帧」。两处不符：环仍会收 `turn_aborted`（`lifecycle.ts:341`）、`error`、`tool_start`/`tool_end`、`agent_progress`（`lifecycle.ts:295`）、`world_frozen`/`world_thawed`（`routes/world.ts`）、`card_position`（`world.ts:1178`）、`replay_entry`（`lifecycle.ts:435`）。

**漏了会怎样**：
① 每次刷新重放一次历史 `error`/`turn_aborted` → `useWorld.ts:809-837` 各 `dispatchEvent('airp:notice')` 并复位 `agentCursorStore`，**玩家刷新即弹旧错误提示、光标乱跳**；
② 重放历史 `agent_progress`（`busy:true`）→ `writer-state.ts:150-166` 把 phase 置 `writing`，若非尾随半轮自愈则会**伪锁输入**；
③ `replay_entry`（门禁 `INTENTIONALLY_UNCONSUMED`，`check-ws-contract.mjs:70`）被反复回放。

**建议**：改为 **allowlist**（只放明确利落的轮界内容帧：`chalk_writing`/`chalk_landed`/`card_writing`/`writer_message`/`dice_result`/`show_frame`/`writer_idle`；`_delta` 与元帧一律不入），比「排除两类 + 如实描述」更可核验且不会漏。

### 6. [MAJOR] `isAlive`/pong 连接级初始化无落点，照 `§8` 实现会周期性杀掉全部连接

位置：`docs/gateway/03:209-216`（§8 落点表）、`:162-166`（§4 表）、`:139`（§3.2 第 7 步）

`§3.2` 第 7 步要求「连接建立时置 `ws.isAlive = true`，并监听 `pong` 置回 `true`」，但它自己的「漏了会怎样」已写明后果是「每 30 秒杀掉全部活连接」。然而 `§4` 表与 `§8` 落点表**均未给 `isAlive`/pong 的落点**；且 `§2.1` 的 `startHeartbeat(wss: { clients: Iterable<HeartbeatClient> })` 签名只收 clients 集合，**无法为新建立的连接挂 `on('pong')` 监听**（sweep 时对既有 client 挂为时已晚，且每轮重复挂会泄漏监听器）。

**漏了会怎样**：保持 `wss.on('connection')` 现状、只按 `§8` 加 `startHeartbeat(wss)` → 新连接 `isAlive` 为 `undefined`，第 7 步从未执行 → sweep 置 `false` 后无 pong 监听置回 → 第一个 sweep 后 `shouldTerminate({isAlive:false})===true` → `terminate()`，**约每 60 秒杀光所有客户端**，前端陷入 1.2s 重连风暴。

**修法二选一**：把连接级初始化写进 `wss.on('connection')` 并显式给落点（`ws.isAlive=true` + `ws.on('pong', …)`），或把 `startHeartbeat` 签名扩为 `(wss, { onConnection })` 由它统一挂监听。

### 7. [MINOR] 心跳动机写成 CPU/日志噪音增长，实为静默泄漏（理由与机制不符）

位置：`docs/gateway/03:137-138`（§3.2 第 6 步）、`00 §1.3:65`

实测（`/tmp/spike-nat-silence.mjs`）：客户端 RST 时服务端立即收到 close、clients 1→0；**NAT 静默黑洞**下 clients 保持 1、`readyState=1`，连发 5 帧**5 次全部成功、0 次抛错**，服务端事件列表为空。即 `broadcast`（`event-bridge.ts:445-449`）的 per-client try/catch **一次都不会触发**、也不会打 `console.warn`。

**漏了会怎样**：把「静默泄漏」误述为「性能噪音」会让实现/运维按性能问题处置，而真实故障是**零日志、零报错**的成员泄漏——违反 `docs/tools/00` 硬约束 4 的精神。这同时加强 R2 必要性，但理由必须改对。

### 8. [MINOR] 降级排除理由未写明排除了什么、没排除什么

位置：`docs/gateway/00:82-86`（§2 不做项 1/2）

「纯重构，零行为增益，高风险」实际只排除了**不改变现有行为的组织方式搬迁**，并未排除该切分所承载的有行为的事：`§9` T6.2 的「复用+收尸/seq+回放/pending 结算/两套 kill/回合护栏」、T6.3 的「未知命令单发 `{type:'response',success:false}`、不关连接」（今天 `index.ts` 的 `else if` 链**无 else 分支，未知命令静默丢弃**）、T6.1 的 `WS_COMMANDS` 未来名。

**漏了会怎样**：下一批若要补「未知命令回执」或「回放落在 event-bridge 还是 session-host」，会重新陷入「B6 已否决」的误读。

---

## 已复核成立的断言（避免下游重复劳动）

- `pnpm check:ws` 基线实测 `clean (27 emitted, 24 consumed, 27 in contract)`，与设计一致。
- `WS_COMMANDS` 8 项与 `index.ts` 的 `data.type === '…'` 分支集合**逐项相等**（含 `writer_abort`/`abort` 同分支）——R0 断言成立。
- 切轮前提成立：`writer_idle` 确为 AIRP 轮终帧（`event-bridge.ts:388` 由 `agent_settled` 映射）；`agent_end` 只到 event-bridge 内部、不入帧面——裁定 C 成立。
- R2 upgrade 关闭码方案可行：`handleUpgrade` 后 `ws.close(4400)` 能送达 code/reason；HTTP 拒绝带不了 close code——已 spike 证实（`/tmp/spike-upgrade-close.mjs`），非过度设计。
- STT 与主通道共享 wss 后心跳**不会**误杀 STT：协议级 pong 由 ws 库自动回（RFC 6455）——已实测排除。
- `replay_entry`（`lifecycle.ts:435`，续档补 custom entry）与 R1 回放窗口确是两件事——`02 §6.3` 的表成立。
- 全仓零 `ping`/`pong`/`isAlive`/`heartbeat`（`apps/server/src`）——设计断言成立。
- `broadcast` 的 per-client try/catch 形态与 `event-bridge.ts:445-449` 一致——`02 §3.6` 第 6 步引用成立。
- 前端主 WS 唯一连接点 `airp-gateway.ts:156`——设计只点一处无遗漏。

---

## 无法判定

- `replay_done` 是否带 `turns`、`replaying` 是否加本地兜底超时、`REPLAY_ID` 去留——均为设计自己列出的待拍板项，需 owner 决定。
- 回放窗口里 `writer_delta` 的湿墨「双画」在真实浏览器下的可见程度，需端到端手工验收（受「禁跑全量」约束未做）。
- 裁剪后「刷新能看到正在写的那一笔」这条产品预期是否可接受，属产品取舍，非实现缺陷。

---

## 输出

整体不可直接落地：先修 1（BLOCK）+ 2/3/4/5/6（MAJOR）再进实现。
