# docs/gateway/review-honesty — 诚实性 / 未知项 / 冲突登记评审

> 评审对象：`docs/gateway/00-共同上下文.md`、`01`、`02`、`03`、`04` 的 `[推断]`/`待拍板`/冲突登记/验收可核验性。
> 评审基准：当前 HEAD `e1c9127`；对照写作锚点 `45269cf`。
> 评审人：ReviewHonesty（只读评审）。落盘：主 agent（评审角色无写权限）。
> 结论：**PASS-WITH-FIXES**（降级地基不塌；13 条发现需修正，其中 7 MAJOR）。

---

## 结论

**PASS-WITH-FIXES** — 诚实性维度不判 BLOCK：降级地基（证据 A/B/E/F、裁决 A–G）**无一条实质性不成立**，「不做」清单 7 条**无一是该做而被悄悄降级**。但存在 7 MAJOR，其中 2 条是「未知被写成已定」、3 条是「转述/证据链不成立」、2 条是「理由错误/超保」。

---

## 发现

### 1. [MAJOR] `replay_done` 载荷：冻结形状与「未决」声明、契约行三者互斥

位置：`docs/gateway/00-共同上下文.md:114`（§3.2）、`docs/gateway/04-契约回写与验收.md:22`（§2.1）

- `00 §3.2`（`:114`）以**已定语气**写载荷 `{ type, timestamp }`；`02 §3.5` 第 5 步（`:96`）同样只发这两个字段。
- 但 `00 §9-2`（`:217`）、`02 §12.2`、`04 §13-1` 把 `turns` 标为**待拍板**。
- 而 `04 §2.1`（`:22`）把**契约表行**写成 `{ turns, timestamp }`——**已定，且与 §3.2 相反**。

**后果**：实现者照任一份「已定」副本都自洽；门禁的权威面（`contractFrom` 只读 §6.2 第一张表）随后与发射点不一致。若服务端发 `{type,timestamp}` 而表承诺 `{turns,timestamp}`，前端读 `msg.turns === undefined`，设计想要的诊断静默读成 0。
**修法**：定一个具名形状（建议 `{ type, turns?, timestamp }`），并把 §3.2 标「待拍板 §9-2」。

### 2. [MAJOR] `§8-3` 转述为假：`plan:517` 早已写「未实现」

位置：`docs/gateway/00-共同上下文.md:206`（§8-3）、`docs/gateway/01-协议锚模块.md:183`（§11-1）

两处断言 plan:517 列未来 `WS_COMMANDS` 名且「文档未标『未实现』」，据此建议回写。**锚点 `45269cf` 与 HEAD `e1c9127` 上 `sed -n '517p'` 均逐字以 `| \`WS_COMMANDS\`（未实现，T6.1 目标态） |` 开头。** 真实冲突只是**目标名与现状名不同**。
**后果**：照 §8-3 措辞会去编辑一份**已经正确**的上位文档。

### 3. [MAJOR] 证据 B #3 引用了一个**全史不存在**的文件

位置：`docs/gateway/00-共同上下文.md:39`

引 `packages/shared/src/store/local-world-store` 作持久 `seq` 来源，引 `world-store.ts:127-129` 作自增点。`ls packages/shared/src/store/` 只有 cursor/layers/local-store/world-store；`git log --all --diff-filter=A` 搜 `local-world-store` **零命中**。锚点上 `world-store.ts:127-129` 是接口声明（`appendEvent`/`getEventsSince`/`getMaxSeq`），**不是自增**。真正来源是 `packages/shared/src/db/schema.ts:146`。
**结论成立，证据链不成立。**

### 4. [MAJOR] `stt-stream.test.mjs` 无法验证 `noServer` 改造（假非空性）

位置：`docs/gateway/03:218`（§8）、`docs/gateway/04:208`（§11.4）

两处把 `node --test apps/server/test/stt-stream.test.mjs` 列为 `noServer` STT 交接的验收。该测试**自建 server 并直调 `handleSttStream`**（`stt-stream.test.mjs:54-55`），从不加载 `index.ts` 的 `server.on('upgrade')`。所以 §2.2 的 `return`-不-`handleUpgrade` 路径（会让 `/ws/stt` 死）**让这个「验收」保持绿**。
**这是假非空性**：设计把一个**不可能变红**的测试当作其最高风险改动的安全网。

### 5. [MAJOR] `replayTo` docstring 依赖假前提：演出帧已去重

位置：`docs/gateway/02:51-54`

`§2.1` 称重叠「can only be byte-identical duplicates (which the client already dedupes by `event.id` for world events and **by frame content for presentation frames**)」。实测 HEAD：**只有 `world_event` 去重**（`useWorld.ts:709` 经 `noteWorldEvent`）。`writer_delta`→`appendInk`（`:877`，`phantom.ts` 纯追加）、`chalk_landed`→`playFoley('paper-slide')`（`:882-884`）、`show_frame`→`performShowFrame` 无 played 守卫（`:961`）、`image_landed`→`playFoley('crit-chime')`（`:919`）**全部零去重且副作用非幂等**。

因 `§9-1` 把 `chalk_landed`/`show_frame`/`dice_result` 放进窗口，**每次刷新都会重放一次纸张音效并重演一次演出**。
**重复帧不是无害帧；§2.1 的安全性论证作废。**

### 6. [MAJOR] `replayWindow` docstring 声称了算法不提供的保证

位置：`docs/gateway/02:27-29`

`§2.1` 说「what we return is whole turns or nothing」，但 `§3.3` 第 3 步（`:92`）只从尾找第 6 个 `writer_idle` 并切片——**只裁最旧一轮**。**最新端的半轮**（`chalk_writing` 已发、`chalk_landed` 未发）会被整段发出。**照抄来源 rivet 只声明「最旧一轮不截断」**；AIRP 把断言加强到算法（与原实现）都不支持的程度。若尾部半轮来自作家死亡（`handleWriterDeath` 放弃时不补 `writer_idle`），幻影永不落地且每次刷新重演。

### 7. [MAJOR] 心跳动机写错：这是**静默泄漏**，不是 CPU/日志噪音

位置：`docs/gateway/00:65`（§1.3）

`00 §1.3` 说死 socket 让每帧 fan-out 跑一次 `send` **并捕获一次异常**，故「CPU 与日志噪音随重连次数线性增长」。**NAT 黑洞实测**（主 agent 的对照 spike）：黑洞 socket 上 `send` **不抛错**（OS 缓冲写入）——`broadcast` 的 per-client catch **永不触发**、**不打 `console.warn`**。即**描述的机制根本不存在**；真实故障是**完全静默、运维不可见**的成员泄漏，**低估了严重度**，且与 `docs/tools/00` 硬约束 4 的精神相悖。该理由是 R2 的主要依据，**必须改写**为「只有主动 ping + 超时 terminate 才能发现这种 socket」。

### 8. [MINOR] `§8-1` 误引 `doc-07:222`，漏掉并列的「与世界重载」

位置：`docs/gateway/00:204`

引作「WS 断线重连**未做**」，原文逐字是「…；**WS 断线重连与世界重载未做**」——转述漏了「与世界重载」。结论（重连已落地）正确，引文不准。

### 9. [MINOR] 8 处交叉引用指向**不存在的 `04 §5.x`**

位置：`docs/gateway/01:97,134,135,136,169,174`、`docs/gateway/02:170`、`docs/gateway/03:255`

均指向 `04 §5.1`/`§5.2`/`§5.3`/`§5.4` 索取扫描测试与非空性断言。**`04 §5` 实际是「落账」**（`:72`）；真正的断言在 **`04 §10.2`（源码扫描）与 `04 §10.3`（非空性）**。读者照引用找不到任何内容——**正是「可机械核验」判据所禁止的**。

### 10. [MINOR] 证据 B #13「零命中」是 grep 假象

位置：`docs/gateway/00:44`

`lifecycle.ts:77` 有 `private writerPing`、`:367` `scheduleLivenessProbe`、`:370` `this.writerPing = setInterval(...)`（5s agent 层活体探针）。大小写敏感的 `ping` grep 会漏 `writerPing`。**结论（WS 层心跳真缺）仍成立**，但措辞不实。

### 11. [MINOR] `04` 自称「7 处回写 / 10 行」而 §9 表实为 **11 行**

位置：`docs/gateway/04:11`、`:64`、`:215`

`§1`/`§4` 说「7 处回写」，`§12` 说「7 条 + §9 表（10 行落点）」，但 §9 表实为 **11 行**（`:110-120`）。计数互相冲突且与内容不符，使回写清单本身难以机械核验。

### 12. [NIT] 「同族导出惯例」的例子 `cardWritingFrame` 并未导出

位置：`docs/gateway/02:178`

`messageText` 是 `export function`（HEAD `:41`），而 `cardWritingFrame` 是**非导出**内部函数（HEAD `:94`；锚点 `:79`）。**符号存在**（已漂移），故属「措辞不精确」而非死引用。

### 13. [NIT] `04 §10.2` 自称「三条读源码断言」却列了五条

位置：`docs/gateway/04:138`

开场写「三条读源码的断言」，随后编号 5 项（`:142-146`），其中第 5 项（回放环过滤）驱动 `broadcast`，是**行为断言**而非读源码。自述与清单不符。

---

## 已复核成立的断言

- **降级地基不塌**：证据 A/B/E/F、裁决 A–G 无一条实质性不成立。
- **「不做」清单 7 条**无一是该做而被悄悄降级（逐条判过）。
- 其余与 `review-contract.md` / `review-implementation.md` / `review-drift.md` 一致（`check:ws` 基线、`WS_COMMANDS` 8 项、`writer_idle` 切轮前提、upgrade 关闭码方案可行、STT 心跳误杀已排除）。

---

## 无法判定

- 所有 `待拍板` 项（`replay_done` 带 `turns`、输入锁归属、心跳 env、`REPLAY_ID` 去留、`04 §13` 五项）均为设计自列的未决项，需 owner 拍板，**不属诚实性缺陷**。

---

## 评审自述

共 13 条发现（7 MAJOR + 4 MINOR + 2 NIT），全部在 HEAD 亲测并加锚点复核；未改任何源码或被评审文档。

> **主 agent 更正**：初稿曾判 `cardWritingFrame`「HEAD 已不存在、grep 零命中」与 `worldFrozen` 行锚「是错的、`:577` 实为别的语句」两条。经主 agent 用 `git show 45269cf` 复核，两条均**不成立**：
> - `cardWritingFrame` **存在**（`event-bridge.ts:94`；锚点 `:79`），设计引的是真符号，仅漂 +15 行——已改为 NIT #12。
> - `worldFrozen` 的行锚由设计自己在 `45269cf` 上给出（`let` 在 `:535`、重置在 `:577`），**在锚点上均正确**；HEAD 的 `:556`/`:610` 是漂移结果。该条已从报告中移除。
