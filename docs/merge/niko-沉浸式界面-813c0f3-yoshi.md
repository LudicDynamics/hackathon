# origin/niko 合入 main —— 沉浸式界面 + 六世界素材 × TTS 语音 + 演出通道

> 合并 `813c0f3` · 父提交 `de85b0b`（ours=main）与 `1134bfb`（theirs=origin/niko）· 作者 yoshi · 2026-09-13
> 来源分支：`origin/niko`（nikoloside 一人两天做的整条并行世界线）
> **事后补登记**（本纪律立法当天回溯）。原始两份报告见 `docs/merge/archive/niko-分析报告-813c0f3-yoshi.md`（合并前只读分析，300 行）与 `docs/merge/archive/niko-审查报告-813c0f3-yoshi.md`（合并后质量审查）。

## 1. 这次合了什么

分叉点 `3ccff23`。**互为领先**：`origin/niko` 领先 main **20 提交 / 542 文件 / +10983 −1249**，main 同时领先它 **18 提交**。

- **对方（niko）带来的**：六世界可玩 demo（`unwritten-door` / `wuwu` / `divergence` 等 + 386 个模板文件，含 107 个媒体）、沉浸式原型外壳（`prototype.css` / `ui-shell.mjs` / `scene-shell.css`）、三语 i18n（`useLocale` + `messages.json`，`en`/`zh-CN`/`ja`）、`AgentSettings` / `WorldShelf` / `MotionPortrait` / `EntityInteractions`、21 篇新 doc、6 世界内容源（`tools/experiences/`）。
- **我方（main）带来的**：TTS 批次（`routes/tts.ts`、`rules/voices.ts`、`docs/tts/07·08`、`skills/voice-casting`、`check-voices.mjs`）、演出通道（`chalk-delta.ts`、`lib/{phantom,ghost,canvas-patch,…}.ts`、`components/performance/*`、`docs/perform/**`）、I1 初始化内核、小天地（nook）、footprint、音频接线。
- **两侧同时改的**（即 §2）：9 个冲突文件 / 18 块。
- **自动合并成功但危险**：`routes/world.ts`（`voice` 与 `avatarVideo` 并存，实测 700–740 行两者都在）、`frontmatter.ts`（`.passthrough()` 容未知字段）、`presets/writer.json`。

## 2. 冲突处理

**方向：视觉/UI 尽量以 niko 为主；main 的功能行为与冻结契约必须存活。**

### 2.1 可机械解（取并集，9 块）

| 文件 | 两侧各是什么 | 裁决 |
|---|---|---|
| `.env.example` | niko: `AIRP_WORLD`/`AIRP_WRITER_MODEL`/`AIRP_IMAGE_*`/`OPENAI_*`；main: `DASHSCOPE_API_KEY`/`AIRP_TTS_*`/`FLOW_API_*` | 两边全留（纯追加） |
| `AGENTS.md`（3 块） | niko: `world-shelf.ts` / `ui-shell.mjs` / 四世界口径；main: `routes/tts.ts` / `init-command.ts` / `voice-casting` / 六世界口径 | 合并成一段：两种描述都留；「首条可玩竖切」改成 niko 的「六世界」口径 |
| `useWorld.ts`（import 块） | niko 1 行 footprint；main 12 行（footprint + phantom/ghost/audio/writer-state） | 取 main 的 12 行 |

### 2.2 结构决策（3 类，5 块）——**不是解冲突，是把两条演进缝成一个**

| # | 文件 | 两侧的设计意图 | 裁决 | 理由 |
|---|---|---|---|---|
| A | 角色 README frontmatter（`whitechapel/watson`、`firstsnow/nanami`、`magic-academy/seraphina`） | niko: `type: readme` + `avatarVideo:` + 裸相对 `avatar:` 路径；main: `voice:` + `/api/asset?path=` 写法 | **以 niko 形状为底**（带 `avatarVideo`、人物描述更全），**逐角色加回 main 的 `voice:` 行** | 视觉以 niko 为主；`voice:` 是 main 的 TTS 契约，不能丢（见 §2.4） |
| B | `CharacterModal.tsx`（**最重**） | niko 493 行：`MotionPortrait` 微动立绘 + `useLocale`，**完全没有 TTS 分页**；main 752 行：TTS 分页（`parseEmoPages`/`clampPageIndex`）+ `playVoice`/`stopVoice` | **以 main 的 TTS 分页版为底**，把 niko 的 `MotionPortrait` 接进「立绘舞台」层；props 取并集（`displayName`+`avatarVideo`+`effectsEnabled`+`worldId`+`voice`+`language`） | 两个都不能丢：微动立绘是 niko UI 卖点，TTS 分页是用户明确要求的 main 成果。**这是一次人工改写** |
| C | `i18n.ts` | niko 32 行：三语（`en`/`zh-CN`/`ja`）+ `messages.json`；main 102 行：两语 + 内联大表 | **以 niko 三语体系为底**，把 main 的 4 个 perform 键（`ghostFailed`/`ghostReused`/`ghostUnreachable`/`writerWriting`）并入 en/ja | 「界面多语言」是 niko 那条线的成果；main 只有 4 个键要并 |
| 附 | `App.tsx`（6 块，**第二难**） | niko 589 行沉浸式 prototype 外壳；main 730 行组件化外壳（`NookView`/`LayerBadge`/`WriterBar`/`Minimap`/`PerformanceLayer`/`DiceCeremony`） | import/state/effect 取并集；JSX 主体**保留 niko 视觉外壳 + main 的 `PerformanceLayer`/`DiceCeremony` 挂载点**；`CharacterModal` 调用处 props 取并集 | 「两套 UI 骨架重新缝成一个应用」 |

### 2.3 静默丢失自查（**这一节才是本纪律的起点**）

按「连接面」整面扫，不按冲突块扫。**结果：以下三处都不是冲突块里的，是自动合并/删除吃掉的。**

| 丢的东西 | 怎么丢的 | 处置 |
|---|---|---|
| **入站 `airp_init` WS 帧** | 两侧都改 `App.tsx`/`useWorld.ts`，**结果里前端发送方消失、服务端 `index.ts:148` handler 还在**——「半条链」是合丢的签名（真弃用会两侧都删） | 补回发送方；并立 `/enter-layer` MUST NOT dispatch 契约（走 I1） |
| **8 个 i18n 键** | `translate()` 缺键**静默回落成 key 本身**（显示英文） | 补键 + **新建 `pnpm check:i18n` 门禁**（反向验证：删一个用到的键 → 红） |
| **21 个角色的 `voice:`** | niko 分叉（04:05）早于音色批次落 main（04:59），它新增的世界**从没有过** `voice:` | 按同名角色在老模板的既有定妆补齐（见合并后批次） |

整面扫描的**全零面**（确认无丢失）：文件删除 0、导出符号 0、`/api` 路由 0、`switch case` 0、事件 `type` 枚举 15 相等、`CARD_FORMS` kind 23 相等、`registerAction` 22 相等、`localStorage` 0。行级 diff 604 行全为改写。

### 2.4 合并后补做的修复（**另一次合并暴露的回归**）

`813c0f3` 合完跑门禁/审查，暴露 13+4 处回归，分两批修：

- **`8f77799`（13 处）**：`frame()` 取景 effect 回写座位（→ 首次拖拽松手整层跳位，**第三处碰撞权威**，违反 `docs/footprint/00 §5.1`）；`airp-gateway.ts` 三条路由请求体键与 `docs/wiring/00 §6` 不符（**静默 400**）；`CanvasObject` chalk 被移出 `0deg` 白名单；`ChalkCard` widgets 搬进 hover 浮层导致场景入口 Chalk 互动全失；`footprint.ts` `isInflated`；`ParticleLayer` 受 `effectsEnabled` 连带卸载；`App.tsx` 作家输入条丢 writing 锁；`scene-shell.css` hover z-index 压过拖拽；`event-bridge.ts` `turn_aborted` 当错误帧；`chalk-anchor.ts` pointermove 读布局；`useWorld.ts` `setAmbient('rain')` 不归还；`world-context.ts`+`init-command.ts` 双落 `layer_initialized`。
- **`c7db908`（4 处收尾）**：`check-request-bodies.mjs` 门禁盲区（只认内联 `fetch`，看不见 gateway 封装形状——**两条 BLOCKER 能进 main 的机械原因**）；`local-store.ts` `moveFile` 排他语义（`docs/tools/04` 要 `already_exists`，**绝不用覆盖语义的裸 rename**）；`model-preferences.ts` 加 schema 校验；删死模块 `effects-clock.mjs`。
- 后续：`0032d58`（Esc 返回上层）、`22675c8`（便携卡「Take」按钮）、`8d6fc83`（修 `check:bodies` 被自身文档注释误报，见 §2.5）。

### 2.5 `check:bodies` 被自己的注释骗（2026-09-13 二次合并时修）

`CharacterModal.tsx:253` 有一行 JSDoc 写着 `` `fetch('/api/tts'` ``，它**先于**真调用（`:265`）命中 route 子串，而扫描器对每个命中行只判一次 `fetch(`/`json(` → 注释行不构成合法 body → 立刻 `return null` → 误报 "call site moved"。**这是门禁自身的假阳性。** 修法：跳过 `//`/`*`/`/*` 开头的行，取第一个真调用；反向验证（把 body 键改成 `voiceId` → 红并印出 265 行 KEY-DRIFT）。

## 3. 验证

```bash
pnpm build                                  # → PASS
pnpm test                                   # → 605/605（少 4 条 = 删掉的 dead-module 测试）
pnpm check:ws check:bodies check:docs check:skills check:voices check:i18n
pnpm probe probe:tools probe:inject probe:prompt probe:init
pnpm typecheck:extensions                   # → 全 PASSED
```

**浏览器冒烟**（真 Chromium + 真 server）：拖拽松手不跳层、chalk 恒 0deg、场景入口 Chalk 带互动组件、便携卡有 Take 按钮、Esc 从子层回 `map`、作家输入条忙时禁用、TTS 分页与微动立绘同时工作、三语切换。

**未决/遗留**（登记但不擅改）：`Minimap`/`HintBar` 未挂载（niko 用 breadcrumb 导航，恢复位置需按其视觉重排）；`EntityInteractions` hover 的强制布局（niko 新交互，改动有布局回归风险）；`/choice` 的作家提示词仍是 niko 的粗版（玩法节奏待与 nikoloside 定）。

> 详细证据见归档的两份报告（`docs/merge/archive/`）。
