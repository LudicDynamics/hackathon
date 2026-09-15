# docs/gateway/review-drift — 现状断言 / 行锚漂移核验

> 评审对象：`docs/gateway/00-共同上下文.md`、`01`、`02` 的「现状是 X」断言与 `file:line` 引用。
> 评审基准：当前 HEAD `e1c9127`；同时对照写作锚点 `45269cf`（漂移 82 个提交）。
> 评审人：ReviewDrift（只读评审）。落盘：主 agent（评审角色无写权限）。
> 结论：**PASS-WITH-FIXES**（降级地基不塌；引用面有 2 MAJOR 错误需修正）。

---

## 结论

**PASS-WITH-FIXES** — 降级设计的三根地基（证据 B 的 14 条对照表、证据 E 的跨批次零依赖、证据 F 的时机禁令）在当前 HEAD `e1c9127` 上逐条复核后**没有一条实质性不成立**，故降级本身成立、**不判 BLOCK**。但引用面存在 2 条 MAJOR 错误（其中 `00 §8-3` 登记的上位文档冲突在锚点 `45269cf` 与 HEAD 上**都被证伪**），会误导承接方回写不存在的缺口，需在落地前修正。

---

## 发现

### 1. [MAJOR] `§8-3` 登记的冲突是假的：`plan:517` 早已标「未实现」

位置：`docs/gateway/00-共同上下文.md:206`（§8 第 3 行）、`docs/gateway/01-协议锚模块.md` §11 第 1 行

两处断言 `docs/development/后端实现计划.md:517` 的 `WS_COMMANDS` 未来名「文档未标『未实现』」，据此登记为需回写的冲突。**实测该行逐字已含「（未实现，T6.1 目标态）」**，且在写作锚点 `45269cf` 上 `git show` 得到**同样文字**（非 82 提交漂移所致）。

**后果**：`04 §9` 回写清单第 3 行会指示承接方补一个**已存在**的标记，并掩盖真实冲突（未来名 vs 现状名）。
**证据**：`sed -n '517p' docs/development/后端实现计划.md`。

### 2. [MAJOR] 证据 B #3 引用的路径 `local-world-store` 全史不存在且行锚已漂

位置：`docs/gateway/00-共同上下文.md:39`（§1.2 证据 B #3）

断言 seq 来源为「`packages/shared/src/store/local-world-store` 的 `history.db` 自增，`packages/shared/src/store/world-store.ts:127-129`」。该文件路径**不存在**（`ls packages/shared/src/store/` 只有 cursor/layers/local-store/world-store；`git log --all --diff-filter=A -- '*local-world-store*'` **零命中，全史无此文件**），且 `world-store.ts:125-131` 已漂为 `ArrangeCanvasLayerResult` 字段，与 seq 无关。seq 真正定义在 `packages/shared/src/db/schema.ts:145-146`（`seq INTEGER PRIMARY KEY AUTOINCREMENT`）。

**判定本身成立**（seq 已有持久自增源、无需重做），但证据路径与行锚不可核验。

### 3. [MINOR] 证据 #13「全仓零命中 ping/pong/heartbeat/isAlive」是大小写敏感 grep 假象

位置：`docs/gateway/00-共同上下文.md:44`（§1.2 证据 B #13）、`docs/gateway/03-心跳与关闭码.md` §13 同措辞

字面不成立：`apps/server/src/engine/lifecycle.ts:77 private writerPing`、`:367 scheduleLivenessProbe`、`:370 this.writerPing = setInterval(...)`、`:56 LIVENESS_PROBE_MS = 5000`、`:371 client.getSessionStats()` 均存在，且锚点 `45269cf` 同样存在（`:77/205/367/370/375`）。

该探针是 **agent 进程活体探测**而非 WebSocket 层心跳，故 **R2「WS 层心跳真缺」仍成立、不塌地基**，但「零命中」措辞不实。

### 4. [MINOR] 证据 D 对 `doc-07:222` 的转述逐字不符

位置：`docs/gateway/00-共同上下文.md:204`（§8 第 1 行）

写 `doc-07:222`「写『WS 断线重连**未做**』」，但原文为「**WS 断线重连与世界重载未做**」（两者并列）。语义方向正确、冲突仍成立（`useWorld.ts:972-994` 已实现重连），但按逐字检索会失败。
**证据**：`sed -n '222p' docs/development/doc-07-AIRP黑客松作战计划.md`。

### 5. [MINOR] `tools/12` 行锚 `:587` 指向帧行而非 `agent_settled` 映射行

位置：`docs/gateway/00-共同上下文.md` §7 裁决 C、`docs/gateway/02` §11 第 2 行

引用「`agent_settled` 映成 `*_idle`」时把行锚写作 `docs/tools/12:587`。实测 HEAD `:587` 是输出帧行（已漂），映射行实为 **`:338`**，且在锚点 `45269cf` 上同为 `:338`（该行未漂，是唯一双稳定锚）。
**证据**：`sed -n '338p' docs/tools/12-工具注册与路由统一.md` → `| agent_settled | — | { type: source==='writer' ? 'writer_idle' : 'character_idle', source } |`。

### 6. [NIT] `02 §8`「同族导出惯例」措辞不精确（`cardWritingFrame` 未导出）

位置：`docs/gateway/02-回放窗口与replay_done.md:178`

写 `replayWindow` 落 `event-bridge.ts` 顶层导出「与 `messageText`（`:26`）/`cardWritingFrame`（`:79`）同族」。实测 `messageText` 是 `export function`（HEAD `:41`），而 **`cardWritingFrame` 无 `export`**（HEAD `:94`，锚点 `:79`，**符号存在、仅漂 +15 行**）。「同族**导出**惯例」把非导出函数当作导出先例。
**建议**：改引 `mapEngineEvent`（`export function`，HEAD `:129`）。

---

## 已复核成立的断言

1. **降级地基三根全在**：证据 B 的 14 条对照表（#5 send 不抛错 / #6 pending 结算 / #7 两套 kill / #8 复用+收尸 / #14 启动参数单一来源**全成立**，#13 实质成立）；证据 E 的 grep 结论成立（`docs/**` 除 plan 自身外只有 `AUDIT-doc-22:94` 一条命中 `protocol/`）；证据 F 的 `doc-07:231` 仍写「禁止任何架构改动」。
2. **seq 判定成立**：`packages/shared/src/db/schema.ts:146` `seq INTEGER PRIMARY KEY AUTOINCREMENT`。
3. **当前实测基线（HEAD）**：`check-ws-contract: clean (27 emitted, 24 consumed, 27 in contract)`，与 `00 §5` / `04 §10.1` 的 `{27,27,24}` 一致。
4. **`cardWritingFrame` 在 HEAD 仍存在**（`event-bridge.ts:94`，锚点 `45269cf` 在 `:79`），并非零命中——`02 §8` 引的是真符号，只是漂了 +15 行。
5. **`writer_idle` 切轮前提成立**（详见 `review-implementation.md` 的「已复核成立」）。

---

## 无法判定

- 无（本维度所有断言均可在仓库内机械核验）。
