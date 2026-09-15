# docs/gateway/review-contract — 契约一致性 / 跨端闭环评审

> 评审对象：`docs/gateway/00-共同上下文.md`、`01`、`02`、`03`、`04`（commit `305bbab`）。
> 评审基准：当前 HEAD `e1c9127`（设计写作锚点 `45269cf`，漂移 82 个提交）。
> 评审人：ReviewContract（只读评审）。落盘：主 agent（评审角色无写权限）。
> 结论：**BLOCK**（降级本身成立；两处必须先改）。

---

## 结论

**BLOCK** — 降级本身成立：`WS_COMMANDS` 与 `index.ts` 的 `data.type` 分支集合恰好相等（8 项），`check:ws` 基线 `{27,24,27}` 与目标 `{28,28,25}` 算术成立，`replayWindow` / `case 'replay_done'` 的落点均在门禁既有名单内。但 `03 §2.2` 的 `/ws/stt` upgrade 处置（只 `return` 不 `handleUpgrade`）前提为假，与同文档 `§8` 自相矛盾，照字面实现会让 STT 语音输入整条死（BLOCK）；另 `02 §3.5` 的回放安全性论证建立在被实测推翻的「前端已按帧内容去重」前提上，按裁定 D 会交付「刷新即重放音效/重演演出」的版本（MAJOR）。这两处必须先改。

---

## 发现

### F1 — [BLOCK] 统一 `/ws/stt` 的 upgrade 归属，消除 `03` 文档三处自相矛盾

位置：`docs/gateway/03-心跳与关闭码.md:72-83`（§2.2）、`:130-131`（§3.1 第 4 步）、`:218`（§8）

`03 §2.2` 的 upgrade 钩子写 `if (url.pathname.startsWith(STT_STREAM_PATH)) return;` 并注释「stt owns its own upgrade」——**该前提为假**：全仓只有一个 `new WebSocketServer({ server })`（`apps/server/src/index.ts:53`），STT 无独立 upgrade 处理器，`handleSttStream` 由 `wss.on('connection')`（`:188`）经 `req.url?.startsWith(STT_STREAM_PATH)`（`:190`）分派流出。

改成 `noServer` 后，`connection` 只可能由 `handleUpgrade` 回调里的 `emit` 产生，故 STT 分支直接 `return` ⇒ `/ws/stt` 永不 upgrade ⇒ 语音输入整条死。

同一文档三处互斥：

| 位置 | 说法 | 判定 |
|---|---|---|
| §2.2（`:74`） | `return`，不 handleUpgrade | ❌ 假前提 |
| §3.1 第 4 步（`:130-131`） | 「由 STT 自己的处理接管」 | ❌ 同假前提 |
| §8（`:218`） | 「用**同一个** wss 做 `handleUpgrade`」 | ✅ 正确 |

**漏了会怎样**：照 §2.2 字面实现即 STT 全死。
**修法**：§2.2 与 §8 一致（STT 分支也走 `handleUpgrade` 再 `emit connection`），或另建 STT 专用 `noServer` server。

### F2 — [MAJOR] 把 `02 §3.5` 的「前端已去重」前提从已证事实降级

位置：`docs/gateway/02-回放窗口与replay_done.md:50-54`（§2.1 docstring）、`:96-97`（§3.5）

`02 §2.1` 的 `replayTo` docstring 称「the client already dedupes … by frame content for presentation frames」，`§3.5` 据此论证安全。**实测该前提不成立**：

| 帧 | 前端去重 | 非幂等副作用 |
|---|---|---|
| `world_event` | ✅ `noteWorldEvent`（`useWorld.ts:572`） | — |
| `dice_result` | ✅ `markPlayed`（`App.tsx:568,582`） | — |
| `chalk_writing` | ❌ | `playCharge`（`useWorld.ts:849`） |
| `writer_delta` | ❌ | `appendInk` 纯追加（`:877`、`phantom.ts:142`） |
| `chalk_landed` | ❌ | `playFoley('paper-slide')`（`:882-884`） |
| `show_frame` | ❌ | `performShowFrame`（`PerformanceLayer.tsx:550-553`，`:421` 无 played 检查） |
| `image_landed` | ❌ | `playFoley('crit-chime')`（`:915-919`） |

裁定 D（`00:193`）与 `§9-1`（`00:216`）又要把这些帧放进窗口 ⇒ **每次刷新会重放音效/重演演出**。
**漏了会怎样**：实现者信「重复帧无害」而不做前端幂等，交付「刷新即错乱」的版本。
**修法**：回写 §2.1 / §3.5，把该前提标为未验证或补上前端幂等要求。

### F3 — [MAJOR] 统一 `replay_done` 载荷形状：冻结表与契约行互斥

位置：`docs/gateway/00-共同上下文.md:113-115`、`docs/gateway/04-契约回写与验收.md:22`、`docs/gateway/02-回放窗口与replay_done.md:96`

载荷三处不一致：

| 位置 | 形状 |
|---|---|
| `00 §3.2` 冻结表（`:114`） | `{ type, timestamp }`（**无 turns**） |
| `04 §2.1` 契约行（`:22`） | `{ turns, timestamp }`（**有 turns**） |
| `02 §3.5` 实现代码（`:96`） | `{ type: 'replay_done', timestamp }`（无 turns） |

设计虽把 `turns` 标为待拍板（`00:217`、`04:221`），但**冻结表已先定死为不带 turns**，与自己下游契约行互斥。
**漏了会怎样**：实现按冻结表发无 turns 帧，而契约行承诺有 turns，门禁绿而契约说谎，按契约行做诊断计数的前端拿到 `undefined`。

### F4 — [MINOR] 修正 `00`/`04` 对发射点的幻影符号 `subscribe`

位置：`docs/gateway/00-共同上下文.md:114`、`docs/gateway/04-契约回写与验收.md:22`

两处把 `replay_done` 的发射点写成「`event-bridge` 的 `subscribe` 路径 / `subscribe`/`replayTo`」，但 `event-bridge.ts` **没有** `subscribe` 方法（grep 零命中）。真正的连接触发是 `index.ts` 在 `wss.on('connection')` 内调用 `eventBridge.replayTo(ws)`（`02 §2.2` 写对了）。
**建议**：统一改为「`index.ts` 的 `wss.on('connection')` 调 `eventBridge.replayTo(ws)`」。

### F5 — [MINOR] 跨端矩阵补 `base-path` 面，并复核 `pathname !== '/ws'` 的等值判定

位置：`docs/gateway/00-共同上下文.md:154-160`（§4 矩阵）、`docs/gateway/03-心跳与关闭码.md:75`

`00 §4` 矩阵六面**未含** `apps/web/src/lib/base-path.ts`。该文件 `ROOTED`（`:8`，`= /^\/(?:api|ws)(?:[/?#]|$)/`）会把浏览器发出的 `/ws?v=1` 重写为 `<BASE>/ws?v=1`。

今天旧实现接受一切 upgrade，故前缀路径也能连；而 `03 §3.1` 第 3 步的 `url.pathname !== '/ws'` **严格等值**会判 `<BASE>/ws` 为「不 upgrade」。`Dockerfile.vercel:15`（`ARG AIRP_WEB_BASE=/`，注释明写子路径用途）与 `vite.config.ts:7` 证明子路径部署被支持。

是否真回归取决于反向代理是否剥前缀——**未找到剥前缀的配置**（`Dockerfile.vercel` 仅有 env，无 rewrite），故**倾向真回归**，但需 owner/部署方确认。`[推断]`，confidence 0.6。
**建议**：矩阵补 `base-path` 面，或在 §3.1 第 3 步注明前缀对齐要求。

### F6 — [NIT] 登记回放帧选择与门禁 `INTENTIONALLY_UNCONSUMED` 的口径冲突

位置：`docs/gateway/00-共同上下文.md:216`（§9-1）、`tools/check-ws-contract.mjs:66-93`

`00 §9-1`（`:216`）把 `writer_message` 选为回放窗口轮界帧，而 `tools/check-ws-contract.mjs:71` 把 `writer_message` 登记为 `INTENTIONALLY_UNCONSUMED`（理由「retained for a non-streaming client; `_delta` is the live path」）；`chalk_landed`/`show_frame` 同时又列在 `KNOWN_DARK`（`:80-93`）。

两份文档口径直接冲突，而 `00 §8` 冲突清单（7 条）**未登记此项**。
**建议**：在 §8 登记，或把「窗口只回放前端有消费且幂等的帧」写入裁定 D 判据（与 F2 合并处理）。

---

## 已复核成立的断言

1. `check:ws` 当前基线 **实测**：`node tools/check-ws-contract.mjs` → `clean (27 emitted, 24 consumed, 27 in contract)`，与设计 `04 §10.1` 声明的基线一致；目标 `{28,28,25}` 算术成立。
2. `WS_COMMANDS`（8 项）与 `apps/server/src/index.ts` 的 `data.type === '…'` 分支集合**恰好相等**（含 `writer_abort`/`abort` 同分支），R0 核心断言成立。
3. `replay_done` 落 `event-bridge.ts`（已在 `EMITTERS`）、`case 'replay_done'` 落 `useWorld.ts`（已在 `CONSUMERS`）——落点均在门禁既有名单内。
4. `docs/tools/12` §6.2 第一张表是 `contractFrom` 唯一认的表，表尾空行结束（`check-ws-contract.mjs:151-182`）——设计 §3.2 的描述正确。

---

## 无法判定

1. **F5 的真回归与否**：取决于部署反向代理是否剥离 URL 前缀。仓库内未找到 rewrite 配置，需 owner/部署方确认。
2. `03` 的 `KNOWN_DARK` 中 `chalk_landed`/`show_frame` 为何与「前端确有 `case` 分支」并存——门禁的 consumed 判定与实际 `useWorld` switch 分支口径不一致（门禁认特定 `type:` 字面量提取模式，`check-ws-contract.mjs:96-110`），这属于**既有缺陷**、是否在本批顺带修正需 owner 决定。
