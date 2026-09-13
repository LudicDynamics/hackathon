# `origin/niko` 合入 `main` —— 只读分析报告

> 生成时间：2026-09-13 · 分析者：秋青子（主 agent）
> **性质：只读分析。** 报告结论基于在临时 worktree（`/tmp/niko-probe`，已删除）里做的一次
> `git merge --no-commit --no-ff origin/main` 试合并，未改动工作树、未产生任何提交。
> 所有 `file:line`/commit 引用均可复核：`git show <ref>:<path>`。

---

## 0. 一句话结论

`origin/niko` 是 **nikoloside 一个人的整条并行世界线**（20 提交 / 542 文件 / +10983 −1249），
把「六世界可玩 demo + 沉浸式 UI + 三语 + 动效素材」做完了。它 **不是简单的领先**——`main`
同时领先 niko 18 条（含我今天的 TTS 三连 + 队友的 perform 通道）。

**试合并冲突只有 9 个文件 / 18 块**，但其中 **3 块是真结构决策**（角色 README frontmatter
形状、`CharacterModal` 分页实现、`i18n` 两套体系），**不能机械合并**。

**合入前必须做的一件事：给 niko 的 21 个角色补 `voice:` 声明**，否则 `check:voices` 全红、
玩家会听到「同世界全员一个嗓子」（详见 §5）。

---

## 1. 分支全景

```
                              ┌─ codex/first-snow-jp          (12) ─┐
                              ├─ codex/first-snow-play-loop   (16) ─┤
3ccff23 (分叉点, 09-13 04:05) ─┼─ codex/six-world-flow-docs    (19) ─┼─▶ niko (20)
                              └─ codex/six-world-playloops    (17) ─┘
main: 98feea3  ← yoshi/fangsunjian 等 18 提交（含 TTS 三连 + perform + flow-gen）
```

| 分支 | 最后提交 | 领先 main | 落后 main | 独有文件 | 作者 |
|---|---|---|---|---|---|
| `origin/niko` | 09-13 05:48 | **20** | 18 | **446** | nikoloside (20) + yoshi (77, 早期) |
| `origin/codex/first-snow-jp` | 09-13 00:12 | 12 | 45 | — | nikoloside |
| `origin/codex/first-snow-play-loop` | 09-13 02:01 | 16 | 31 | — | nikoloside |
| `origin/codex/six-world-flow-docs` | 09-13 04:00 | 19 | 31 | — | nikoloside |
| `origin/codex/six-world-playloops` | 09-13 04:48 | 17 | 31 | — | nikoloside |

**分支关系实测**：`codex/first-snow-jp` 是 `niko` 的祖先（已被吸收）；其余三条 codex 线各有
独立提交，但内容与 niko 高度重叠（niko 的提交信息里能看到 `合并 codex/first-snow-jp 到 niko`）。
**结论：只需处理 `niko` 一条；四条 codex 线可视为中间快照，不必单独 merge。**

---

## 2. `niko` 装了什么

| 类别 | 数量 | 明细 |
|---|---|---|
| `templates/` | **386** (346 A / 40 M) | 新增 4 个世界：`unwritten-door`(未写之门)、`wuwu`(雾坞镇)、`divergence`(时间线)、`first-snow-jp`(初雪日语版)；模板总数 6→10 |
| `apps/` | 50 | 前端 `ui-shell.mjs` / `effects-clock.mjs` / `scene-shell.css` / `prototype.css`、`AgentSettings`(模型设置)、`WorldShelf`(世界存档书架)、`MotionPortrait`、`PropCard`、`EntityInteractions` |
| `docs/` | 39 | **21 篇新 doc**：六世界验收 ×7、`doc-25-未写之门Demo`、`世界日语化迁移`、`Agent前端接线`、`界面多语言`… |
| `tools/` | 37 | `tools/experiences/`(六世界内容源 9 个)、`install-experiences.mjs`、`sync-template-assets.mjs`、`migrate-canvas-worlds.mjs`、22 个 `*.test.mjs` |
| `packages/shared` | 8 | `schemas/agent-settings.ts`(新)、`frontmatter.ts`/`world.ts`/`local-store.ts` 演进 |
| `extensions/` | 2 | `world-context.ts`(新，拦原生 write/edit 落账) |
| 其他 | — | `six-worlds.rule.yml`(新)、`presets/writer.json`、`.gitignore`、`.env.example`、`package.json` |

**大资产**：`templates/` 的 386 个改动里 **107 个是媒体文件**（webm/webp/mp4/音频），主要是
`assets/motion/seedance/` 的循环视频（背景 + 透明立绘）。**279 个是内容/代码文件。**

**`main` 独有、niko 完全没有的 48 个文件**（合入后必须在，且不会被冲突覆盖）：
- TTS：`apps/server/src/routes/tts.ts`、`packages/shared/src/rules/voices.ts`、`docs/tts/07`、`docs/tts/08`、`skills/voice-casting/**`、`tools/check-voices.mjs`、`apps/web/test/voice-engine.test.mjs`
- perform：`apps/server/src/engine/chalk-delta.ts`、6 个 `lib/{phantom,ghost,canvas-patch,…}.ts`、3 个 `components/performance/*`、`docs/perform/**`
- 其他：`assets/README.md`、`assets/skills/flow-media/SKILL.md`、`tools/flow-gen.mjs`、`templates/firstsnow/player/request-slip.md`、`templates/cthulhu/characters/old-sailor/README.md`

---

## 3. 试合并结果：9 个冲突文件 / 18 块

```
CONFLICT 总计 9 文件
  .env.example                                        1 块   ← 可机械解（两边都留）
  AGENTS.md                                           3 块   ← 可机械解（目录树各补各的）
  apps/web/src/App.tsx                                6 块   ← 需人判（两套 UI 骨架）
  apps/web/src/components/overlay/CharacterModal.tsx  2 块   ← ★ 结构决策
  apps/web/src/lib/i18n.ts                            1 块   ← ★ 结构决策
  apps/web/src/state/useWorld.ts                      2 块   ← 需人判（WS switch 取并集）
  templates/firstsnow/characters/nanami/README.md     1 块   ← ★ 结构决策
  templates/magic-academy/characters/seraphina/README.md 1 块 ← ★ 结构决策
  templates/whitechapel/characters/watson/README.md   1 块   ← ★ 结构决策
```

**自动合并成功（无冲突）的关键文件**——这是好消息：
- `apps/server/src/routes/world.ts` ✅ 两边改动正交，git 自动合了
- `packages/shared/src/schemas/frontmatter.ts` ✅（`.passthrough()`，未知字段不报错）
- `presets/writer.json` ✅（niko 只加 `"tools":{"deny":["bash"]}`）

**自动合并后的 `world.ts /api/characters` 段已实测**：`voice`（main）与 `avatarVideo`（niko）
**同时存在**，互不覆盖：`git show <merged>:apps/server/src/routes/world.ts` 第 700–740 行。

---

## 4. 逐处冲突清单

### 4.1 可机械解（3 处，9 块）

#### `.env.example`（1 块）
- **niko**：`AIRP_WORLD` / `AIRP_WRITER_MODEL` / `AIRP_IMAGE_*` / `OPENAI_*` / `AIRP_TURN_TIMEOUT_MS`
- **main**：`DASHSCOPE_API_KEY` / `AIRP_TTS_*`（TTS）+ `FLOW_API_*`（flow 生图）
- **★ 裁决：两边全留。** 互不重叠，纯追加。

#### `AGENTS.md`（3 块）
- 块 1：`apps/server` 段——niko 加 `world-shelf.ts`；main 加 `routes/tts.ts` + 入站 WS 分流注释。**两边全留。**
- 块 2：`web/src/lib` 段——niko 描述 `ui-shell.mjs`/`effects-clock.mjs`/`scene-shell.css`；main 描述 `footprint`/`phantom`/`chalk-reveal` 等。**合并成一段（两种描述都要留）。**
- 块 3：`extensions`/`skills` 段——niko 加 `world-context.ts` + `tools/experiences/` + 四世界描述；main 加 `init-command.ts` + `voice-casting` skill + 六世界描述。**两边全留**（注意 main 那句「whitechapel/firstsnow 为首条可玩竖切」需改成 niko 的「六世界」口径）。

#### `apps/web/src/state/useWorld.ts`（2 块）
- 块 1（import）：niko 1 行 footprint，main 12 行（footprint 多行 + phantom/ghost/audio/writer-state）。**取 main 的 12 行。**
- 块 2（WS switch，niko 64 行 vs main 184 行）：**这是关键的一块。**
  - niko：自建 `let ws = new WebSocket(...)` + 旧 switch（`file_changed`/`world_event`/`item_moved`/`god_action`/`world_frozen`/`card_position`/`tool_start`/`tool_end`）
  - main：`openAirpSocket()` + 完整 perform 帧 switch（`character_delta`/`chalk_writing`/`writer_delta`/`chalk_landed`/`writer_idle`/`dice_result`/`image_landed`/`canvas_patched`/`show_frame`）
  - **★ 裁决：取 main 的块，再补 niko 独有的帧分支。** niko 版含 `airp:agent-frame` 广播与 `world_event` 的 `id` 去重前置（main 版也有 `noteWorldEvent`），需逐条对照取并集。**这是最容易「合完看着对、跑起来丢帧」的一处。**

  > 实测：`git show origin/niko:apps/web/src/state/useWorld.ts` 里 perform 帧关键词命中 **0 次**——
  > **niko 的 WS 层完全不认 perform 通道**。取错就会丢掉整条演出链路。

### 4.2 需结构决策（3 类，5 块）

#### ★ A. 角色 README frontmatter 形状（3 块，同一问题）

| | `templates/whitechapel/characters/watson/README.md` |
|---|---|
| **niko** | `type: "readme"` / `name: "Dr. John Watson"` / `avatar: "assets/motion/seedance/characters/watson-transparent.webp"` / `avatarVideo: "assets/motion/seedance/characters/watson-transparent.webm"` |
| **main** | `name: Dr. John Watson` / `avatar: /api/asset?path=assets/characters/watson.webp` / `voice: wise-elder` |

- nanami（firstsnow/）：niko `type/name/avatar/avatarVideo` vs main `name: 七海 / avatar: /api/asset?… / voice: gentle-calm` **（注意 niko 把名字改成了日语「七海」，main 是「七海」——中文名？需核对）**
- seraphina（magic-academy/）：niko `avatar: assets/motion/.../seraphina-transparent.*` vs main `avatar: /assets/characters/portraits/lady_2.png / voice: playful-teasing`

**这是三个层面的差异，必须一次决策：**

1. **`avatar` 路径写法**：niko 用**裸相对路径** `assets/motion/…`，main 用 **`/api/asset?path=…`**（经服务端 asset 端点）。
   → 两条路都通，但**必须二选一**，否则同一世界两种写法混用。**推荐 niko 的裸路径 + 确认 `/api/asset` 能解析**，或统一改成 `/api/asset?path=`。需查 `routes/world.ts` 的 `/api/asset` 与前端 `assetUrl()`。
2. **`type: "readme"`**：niko 新增字段。`frontmatter.ts` 是 `.passthrough()`，不报错，但需确认没有 consumer 假设它不存在。
3. **`voice:`（main）**：niko **全部 21 个角色都没有**。合并时必须补回（见 §5）。
4. **`avatarVideo`（niko）**：main 的 `CharacterModal` **不认这个 prop**（见 §4.2 B），合并后要接上。

**★ 裁决建议：以 niko 的形状为底**（它带 `avatarVideo` + 更丰富的人物描述），**逐角色加回 main 的 `voice:` 行**，并统一 `avatar` 的路径写法。

#### ★ B. `CharacterModal.tsx` 两套实现（2 块）

- **niko 版（493 行）**：`MotionPortrait` 微动立绘 + `useLocale` + `playStinger`。props：`displayName`/`avatarVideo`/`effectsEnabled`/`avatar`/`bio`/`locale`。
  - 实测：**grep `dialogue-pages|playVoice|pageIndex|GREETING` → 0 命中，niko 的遮罩完全没有 TTS 分页。**
- **main 版（752 行）**：TTS 分页（`dialogue-pages.js` 的 `parseEmoPages`/`clampPageIndex`/`charDelay`/`GREETING_LINE`）+ `playVoice`/`stopVoice`/`unlock`。props 多出 `worldId`/`voice`/`language`。

**★ 这是全批最大的一块（752 行 vs 493 行，同一文件两种演进）。** 两个都不能丢：
- niko 的 `MotionPortrait`（微动立绘）是它 UI 的核心卖点；
- main 的 TTS 分页是我今天刚落地、且用户明确要求的（「一句话一页，点击切换，每次自动配音」）。

**裁决建议：以 main 的 TTS 分页版为底，把 niko 的 `MotionPortrait` 接进「立绘舞台」层**（main 版注释里已写明有「bottom-pinned split portrait stage」）。props 取并集：`displayName` + `avatarVideo` + `effectsEnabled` + `worldId` + `voice` + `language`。
**这需要一次真正的人工改写，不是解冲突。**

#### ★ C. `i18n.ts` 两套体系（1 块）

- **niko 版（32 行）**：`useLocale()` hook + `translate()` + `messages.json`（键值表）+ 从 `legacy-ui-copy.ts` **re-export** `UI_COPY`。Locale = `'en' | 'zh-CN' | 'ja'`（**三语**）。
- **main 版（102 行）**：`UI_COPY` 内联大表 + `Locale = 'en' | 'ja'`（**两语**）。

**★★ 发现一个 niko 侧的真实缺陷：`git show origin/niko:apps/web/src/lib/i18n.ts` 第 3 行
`export { UI_COPY, type UiCopy } from './legacy-ui-copy.js';`，但 niko 树里只有 `legacy-ui-copy.ts`
（`git ls-tree origin/niko -- apps/web/src/lib/` 确认），不存在 `.js`。**
→ niko 分支**当前是编译不过的**（vite/tsc 找不到 `./legacy-ui-copy.js`）。这是 niko 未完成的一处，合入时顺手修掉即可（改 import 为 `.ts`/无扩展名）。

**键集对比实测**：main 有而 niko 无 4 个键 `ghostFailed` / `ghostReused` / `ghostUnreachable` / `writerWriting`（perform 通道用）；niko 有而 main 无 **0 个**。→ **取 niko 版后 main 的 perform 代码会缺 4 个 copy 键。**

**★ 裁决建议**：以 **niko 的三语体系为底**（`useLocale` + `messages.json`，这是「界面多语言」那条线的成果），把 main 的 4 个 perform 键并入 `UI_COPY` 的 en/ja 表，并把 `legacy-ui-copy.ts` 的 import 修回 `.ts`。

#### 附：`App.tsx`（6 块）——两套 UI 骨架

niko 版（589 行）是**沉浸式 prototype 外壳**（`prototype-chrome`/`prototype-hand-orb`/`prototype-belongings`/`prototype-world-meta`，整块 HTML）
main 版（730 行）是**组件化外壳**（`NookView`/`LayerBadge`/`HintBar`/`WriterBar`/`Minimap`/`PerformanceLayer`/`DiceCeremony`）。

- 块 1/2（import）：**取并集**。
- 块 3（state）：main 加 `activeModalFrame` + `ceremony`；niko 有自己的 state。**取并集。**
- 块 4（useEffect）：niko 的键盘快捷键 vs main 的 dice 帧监听。**两边都留**（不同 effect）。
- 块 5（JSX 主体，niko 85 行 vs main 64 行）：**★ 这是 UI 骨架之争**——niko 的沉浸式 chrome 与 main 的组件化 chrome 是同一个位置的两种渲染。**需人判**（大概率保留 niko 的视觉外壳 + main 的 `PerformanceLayer`/`DiceCeremony` 挂载点）。
- 块 6（`CharacterModal` 调用处）：**取并集**——main 的 `voice`/`language`/`worldId`/`incoming` + niko 的 `displayName`/`avatarVideo`/`effectsEnabled`/`onOpenNook`。

**★ `App.tsx` 是第二难的一处**：它不是「解冲突」，是**把两条 UI 演进重新缝成一个应用**。

---

## 5. ⚠️ 合入前必须处理：niko 的 21 个角色全部缺 `voice:`

**实测**：`origin/niko` 树里全部 21 个角色 README（分属 divergence/first-snow-jp/firstsnow/holmes-world/magic-academy/school-romance/whitechapel/wuwu），**没有一个声明 `voice:`**。

**后果**：合入 main 后立刻触发两件事——
1. `pnpm check:voices` **全红**（V3/V4）。
2. 更严重：**每个角色都回落服务端默认 `Cherry`**。白教堂 6 个角色、雾坞 3 个角色**全员一个嗓子**，玩家会听到「同一个声音在自问自答」。

**这不是 niko 的错**：它 09-13 04:05 分叉，我的音色批次 **04:59** 才落 main——niko 从没机会知道有这回事。

**需要补 `voice:` 的角色清单（21 个）**：

```
templates/divergence/characters/ryo-child/README.md
templates/divergence/characters/shopkeeper/README.md
templates/first-snow-jp/characters/nanami/README.md
templates/first-snow-jp/characters/sumi-yukimura/README.md
templates/firstsnow/characters/nanami/README.md
templates/firstsnow/characters/sumi-yukimura/README.md
templates/firstsnow/characters/sumi/README.md
templates/holmes-world/characters/constable/README.md
templates/holmes-world/characters/watson/README.md
templates/magic-academy/characters/archivist/README.md
templates/magic-academy/characters/seraphina/README.md
templates/school-romance/characters/nanami/README.md
templates/whitechapel/characters/blackburn/README.md
templates/whitechapel/characters/edith/README.md
templates/whitechapel/characters/porter/README.md
templates/whitechapel/characters/tom/README.md
templates/whitechapel/characters/watson/README.md
templates/whitechapel/characters/wayne/README.md
templates/wuwu/characters/old-mo/README.md
templates/wuwu/characters/silver-kite/README.md
templates/wuwu/characters/vera/README.md
```

**补法**：照 `skills/voice-casting/SKILL.md` 选角（按「这个人听起来应该是什么效果」挑别名，
**不写厂商商品名**），同世界不撞声，收工跑 `pnpm check:voices`。

> 注意：`templates/firstsnow/characters/nanami/README.md` 与
> `templates/firstsnow/characters/sumi-yukimura/README.md` 在 main 上**已有 `voice:`**
> （nanami → `gentle-calm`，sumi → 见 README），合并冲突处直接保留 main 的行即可，
> 不必重新选角。真正从零补的是 niko 新增世界（divergence/wuwu/first-snow-jp）+ 其余角色。

---

## 6. 其他需要在合并时一并处理的事

| 项 | 说明 | 出处 |
|---|---|---|
| **niko 编译不过** | `i18n.ts` import `./legacy-ui-copy.js`（不存在，只有 `.ts`） | §4.2 C |
| **`.js` 孪生文件** | niko 树里有 `ui-shell.mjs` + `ui-shell.d.mts`、`effects-clock.mjs` + `.d.mts`——这是合法的（不在 `extensions/`），但需确认没有手搓 `.js` 落在 `extensions/` | `git ls-tree origin/niko -- extensions/` |
| **`avatarVideo` 消费链** | niko 的 `world.ts /api/characters` 返回 `avatarVideo`，但 main 的 `CharacterModal` 不接该 prop——合 `CharacterModal` 时必须接 | §4.2 B |
| **`package.json` scripts** | niko 独有 `probe:image`；main 独有 `check:voices`/`gen`/`gen:image`/`gen:video`/`test`。**取并集** | 实测 |
| **`.gitignore`** | 两边都加了自己的条目（niko：`templates/*-playtest/`、`**/.pi/*.db*`；main：`.airpworld/sessions/`）。**取并集** | 实测 |
| **`presets/writer.json`** | niko 加 `"tools":{"deny":["bash"]}`——需确认与 main 的 writer preset 不冲突（实测自动合并成功） | 实测 |
| **`docs/00-文档骨架.md`** | 两边都改；niko 有 21 篇新 doc 要登记，main 有 tts/perform 批次目录。**取并集 + 跑 `pnpm check:docs`** | 实测 |
| **`six-worlds.rule.yml`** | niko 新增的六世界内容规则（`tools/experiences/**` 适用）——合入后评估是否保留 | 实测 |

---

## 7. 合并执行建议（给执行者）

1. **先决策 §4.2 的三处结构问题**（README 形状 / `CharacterModal` / `i18n`）——这三处定了，其余都能机械解。
2. **在一个专门分支上合**（如 `merge/niko`），**不要直接动 `main`**；合完跑全量验收再进 main。
3. **补 21 个角色的 `voice:`**（§5），跑 `pnpm check:voices`。
4. **验收**：
   ```bash
   pnpm --filter @airp/shared build && pnpm build && pnpm test
   pnpm check:ws && pnpm check:bodies && pnpm check:docs && pnpm check:skills && pnpm check:voices
   pnpm probe:prompt && pnpm probe:inject && pnpm probe:init
   ```
   特别盯 **`pnpm check:ws`**——niko 的 `useWorld.ts` 完全不认 perform 帧（§4.1），
   解 `useWorld.ts` 块 2 时取错边，WS 帧契约门禁会红。
5. **浏览器冒烟**：六世界各开一次 + 角色直聊（验证 TTS 分页 + 微动立绘同时工作）+ 三语切换。

---

## 8. 风险评级

| 项 | 风险 | 理由 |
|---|---|---|
| `CharacterModal.tsx` 缝两份实现 | **高** | 752 vs 493 行，两个都是「不能丢」的演进 |
| `App.tsx` 两套 UI 骨架 | **高** | 沉浸式 chrome vs 组件化 chrome，同一位置两种渲染 |
| `i18n.ts` 三语 vs 两语 | **中** | niko 版当前编译不过；main 有 4 个 perform 键要并入 |
| `useWorld.ts` WS switch | **中** | 取错边丢整条 perform 链路，但门禁能抓 |
| 21 个角色缺 `voice:` | **中** | 不补则门禁红 + 全员一个嗓子，但补法机械 |
| 角色 README frontmatter | **低-中** | 结构简单，逐角色能过；但 `avatar` 路径写法要统一 |
| `.env.example` / `AGENTS.md` / `.gitignore` / `package.json` | **低** | 纯追加，取并集 |

---

## 9. 附：复核命令

```bash
# 分支全景
git branch -avv && git fetch --all --prune
git rev-list --left-right --count origin/main...origin/niko

# 单文件两侧对照
git show origin/niko:<path>     # niko 版
git show origin/main:<path>     # main 版

# niko 缺 voice 的角色
git ls-tree -r --name-only origin/niko -- templates/ | grep -E 'characters/[^/]+/README\.md$' | while read f; do
  git show origin/niko:"$f" | grep -q '^voice:' || echo "缺: $f"
done

# 重跑试合并（只读，不碰工作树）
git worktree add -f /tmp/niko-probe --detach origin/niko
cd /tmp/niko-probe && git merge --no-commit --no-ff origin/main
# …检查… 然后：
cd - && git worktree remove --force /tmp/niko-probe && git worktree prune
```

---

*本报告不改动任何分支/工作树。试合并产生的临时 worktree 已删除（`git worktree list` 只剩主树）。*
