# docs/assets/03 — firstsnow 双世界素材统一

> 母文档：`docs/assets/00-共同上下文.md`（冻结契约，下称 **00**）。本文只补充 00 §6 的**可执行细节**，不改写 00 的任何冻结形状。
> 子文档分工：`01`（六情绪差分生产+接线）/ `02`（微动立绘）/ **`03`（本文：两模板素材统一）** / `04`（回写与机检）。
> 冻结日期：2026-09-13。全部「实测」均在本机工作树跑出，命令逐条列在正文里，可复现。

---

## ① 一句话定位

**`templates/firstsnow`（英文入口）与 `templates/first-snow-jp`（日文入口）是同一批图形字节的两份自包含副本：新增的 6 情绪图与微动视频 MUST 两模板同名同字节各存一份，模板之间 MUST NOT 出现跨模板相对路径引用。**

一句话口径：**文本各自演化，图形字节必须锁死。** 两模板的 `.md` / `preset.json` / `world.json` 是**故意不同**的（语言、id 前缀、语言槽位），而 `assets/**` 下同名文件的 SHA-256 必须**逐字节相同**。

```mermaid
graph LR
  W["assets/worlds/firstsnow-demo (车间, gitignored)"] -->|gen-emotions| A["firstsnow/assets/characters/ID/emo.webp"]
  W -->|motion-clip| B["firstsnow/assets/motion/seedance/characters/ID-transparent.webm"]
  A -->|"MUST: 同名同字节复制"| C["first-snow-jp/assets/characters/ID/emo.webp"]
  B -->|"MUST: 同名同字节复制"| D["first-snow-jp/assets/motion/seedance/characters/ID-transparent.webm"]
  E["store 复制模板"] -->|"fs.cp(templates/first-snow-jp) → worlds/ID"| F["一份可独立运行的存档"]

---

## ② 签名 / 参数

本文不是一个模块，没有运行时 API；它的「签名」是**文件路径契约 + 三条 NEW 的机检/复制函数**。

### 2.1 路径契约（冻结，逐字）

| 项 | firstsnow（英文） | first-snow-jp（日文） |
|---|---|---|
| 世界根 | `templates/firstsnow/` | `templates/first-snow-jp/` |
| 6 情绪图 | `assets/characters/<id>/<emo>.webp` | 同名同路径 |
| 微动视频 | `assets/motion/seedance/characters/<id>-transparent.webm` | 同名同路径 |
| `<id>` | `nanami` / `sumi-yukimura` | `nanami` / `sumi-yukimura` |
| `<emo>` | `normal/smile/shock/sad/angry/thinking`（`tools/gen-emotions.mjs:30`） | 同 |

### 2.2 NEW 符号（本文要求新增，签名如下）

```js
// tools/firstsnow-parity.mjs —— NEW 文件
/** 参与两模板逐字节比对的目录（世界根相对）。 */
export const PARITY_ROOTS = ['assets/characters', 'assets/scenes', 'assets/motion/seedance'];

/**
 * 枚举需要比对的文件对：取 first-snow-jp 下 PARITY_ROOTS 里**存在**的文件，
 * 逐个配到 firstsnow 的同名路径。缺对侧文件 → 该对被判为 FAIL，不是跳过。
 * NEW: parityPairs(repoRoot: string): Array<{ rel: string; a: string; b: string }>
 */
export function parityPairs(repoRoot) { /* … */ }

/**
 * 逐对比 SHA-256。返回每对的 { rel, ok, aSha, bSha }，以及缺文件时的 aSha/bSha=null。
 * NEW: verifyParity(pairs): Array<{ rel: string; ok: boolean; aSha: string|null; bSha: string|null }>
 */
export function verifyParity(pairs) { /* … */ }
```

**复用而不是重写**：`tools/sync-seedance.mjs:39-44` 已经有一个只在新旧摘要不同时才落盘的 `copy(input, output): Promise<{bytes, sha256}>`。两模板同步 MUST 走同一实现——把该函数**新增 `export` 关键字**（函数体已存在，不新写），供 `gen-emotions`/`motion` 侧复制时调用，避免出现第二份「复制并核对」的手艺。

---

## ③ 行为契约逐步

> 每步都写「漏了会怎样」——这些不是假想，是本批 MUST 防守的真实失败模式。

1. **生产只在一侧发生。** `tools/gen-emotions.mjs:170` 的 `pubDir` 恒为 `templates/<worldName>/assets/characters/<id>`，而 `CHARACTERS` 只登记 `whitechapel` / `firstsnow`（`tools/gen-emotions.mjs:47-89`）——**永远不会有 `first-snow-jp` 目录**。
   *漏了会怎样*：只在 `firstsnow` 落图，`first-snow-jp` 永远拿不到 6 情绪图；日文世界的 `/api/characters` 因「6 张全缺」不回传 `emotions`，遮罩永远停在 `MotionPortrait` 回退。
2. **落图后逐字节镜像到另一模板。** 复制 MUST 是**字节复制**（`copyFile` 等价），MUST NOT 重新编码（再跑一次 `cwebp` 会产生不同字节，variance 来自编码器版本/时间戳）。
   *漏了会怎样*：两模板「看起来都有一张图」但字节不同，本文 §⑩ 的 parity 机检失败；更糟的是日文玩家看到的角色与英文玩家不是同一张脸。
3. **同名同字节，不是同目录同内容。** firstsnow 的 `assets/characters/nanami/` 里除了 6 张情绪图还有 `nanami.webm` 与 `nanami-poster.png`（小天地立绘，`templates/firstsnow/characters/nanami/portrait.md:6-7`）。first-snow-jp **没有** `portrait.md`，因此也不需要有这两个文件。
   *漏了会怎样*：写成「整个目录必须完全一致」→ 机检把 firstsnow 的多出来的立绘判为差异，规则立刻失效。
4. **不跨模板引用。** 模板是自包含发布单元：世界被复制成存档后（`tools/play-first-snow.mjs:24-26` 的 `fs.cp(templates/first-snow-jp, worlds/<id>)`）是一个独立目录树，而 `/api/asset` 解析时**拒绝逃出世界根**（`apps/server/src/routes/world.ts:1099-1102`：`path.resolve` + `startsWith(worldRoot + sep)`，否则 403）。
   *漏了会怎样*：若用 `../firstsnow/assets/...` 省一份副本，英文模板一关档案就 403/404，玩家看到空背景。
5. **新增媒体必须落账。** 00 §4.4 要求每条新媒体的源路径 + target + 双方 SHA-256 记入 `templates/<world>/assets/source-manifest.json`。
   *漏了会怎样*：`tools/template-assets.test.mjs:12` 断言 `inventory.assets.length === jobsFor(config).length`——firstsnow 侧少登记就会红；而 jp 侧**今天根本没有 `source-manifest.json`**（见 §⑪-C3）。
6. **旧 id 目录必须清除，且清除前确认零引用。** 见 §⑨ 与 §⑪。
7. **不复制运行时。** 会话、数据库、生成结果、`.airpworld/` 运行时状态 MUST NOT 进入任何一个模板的提交面（详见 §④ 边界表）。

---

## ④ 文件与副作用

### 4.1 新增（本批）

| 文件 | 动作 | 来源 |
|---|---|---|
| `templates/firstsnow/assets/characters/nanami/<emo>.webp` ×6 | 新建 | `gen-emotions.mjs:170-218` |
| `templates/firstsnow/assets/characters/sumi-yukimura/<emo>.webp` ×6 | 新建 | 同上 |
| `templates/first-snow-jp/assets/characters/nanami/<emo>.webp` ×6 | **镜像复制** | 上文 firstsnow 同名文件 |
| `templates/first-snow-jp/assets/characters/sumi-yukimura/<emo>.webp` ×6 | **镜像复制** | 同上 |
| `templates/<both>/assets/motion/seedance/characters/<id>-transparent.webm` | 见 `02`（微动批） | 同上节奏 |
| `templates/<both>/assets/source-manifest.json` | 追加条目（jp 侧是否新建见 §⑪-C3） | — |

### 4.2 删除（本批）

| 文件 | 理由 |
|---|---|
| `templates/firstsnow/characters/sumi/`（整目录：`README.md` + `preset.json`） | 旧 id 遗留（§⑪-C1）；`preset.json` 还是 `apps/server/test/preset-slots.test.mjs:123` 的硬编码锚点，删除**同时**要改测试 |
| `templates/firstsnow/assets/characters/sumi.webp` | 旧 id 孤儿图（`docs/assets/01-六情绪差分.md:654` 明确「清理归 `03`」） |
| `templates/firstsnow/assets/characters/director.webp` | 同上（旧玩家 id `director` → canonical `radio-director`） |

**不改**：`firstsnow/world/intro/relationships/cafe/sumi.md` 的 `id: sumi` 是**世界内卡片 id**，不是角色目录 id（见 §⑪-C4，建议改但不属删除范围）；`templates/firstsnow/world/**` 叙事文本本批不动。

### 4.3 边界（00 §6.4，MUST NOT 复制）

| 目录/文件 | 状态 | 证据 |
|---|---|---|
| `.airpworld/sessions/` | 运行时，gitignored | `.gitignore:45` |
| `.airpworld/*.db*`（`canvas.db` / `history.db`） | 运行时，gitignored | `.gitignore:6` |
| `.airpworld/tts-cache/` | 运行时产物，gitignored | `.gitignore:37` |
| `.airpworld/prompt-presets/` | 每机状态，gitignored | `.gitignore:28` |
| `.pi/*.db*`（`memory.db`） | agent 记忆，gitignored | `.gitignore:58-59` |
| `.airpworld/openings/firstsnow.json` | **tracked**、世界专属开场种子，**不镜像给 jp** | `git ls-files templates/firstsnow/.airpworld` 仅此一条 |

**实测**：`templates/firstsnow/` 工作树里同时存在 `.airpworld/`（含 `canvas.db` / `tts-cache/` / `sessions/`）与 `.pi/memory.db`；`templates/first-snow-jp/` 里**一个都不存在**。jp 的机检把这条写死了：`tools/first-snow-jp.test.mjs:80` 断言 jp 树内任何路径段都不得含 `.pi` / `.airpworld`。

---

## ⑤ 落账

- firstsnow：`templates/firstsnow/assets/source-manifest.json`（既有，9 条），本批追加 12 条 6 情绪图 + 微动条目的 `{source, target, sourceSha256, targetSha256}`。
  *实测现有 9 条 target 清单*：`assets/scenes/{intro,winter-schedule,radio-studio,amber-cafe,campus-rooftop,first-snow}.webp` + `assets/characters/{nanami,sumi-yukimura,radio-director}.webp`，`sourceRepository: "worldlines-assets"`、`encoding: "webp-q82"`。
- first-snow-jp：**没有** `assets/source-manifest.json`（`ls templates/first-snow-jp/assets/` = `README.md characters motion scenes`）。00 §4.4 的落账要求在此模板**无处落地**——见 §⑪-C3 的三种兑现方式与待拍板项。
- 车间侧不落账：`assets/worlds/firstsnow-demo/**` 整树 gitignore（`.gitignore:20-22` 只放行 `assets/audio/**`、`assets/skills/**`、`assets/README.md`）。
- **镜像的账目口径**：jp 条目的 `sourceSha256` MUST 写 firstsnow 同名文件的 SHA-256（即「jp 的源是 firstsnow 的发布位」），`targetSha256` 写 jp 自己那份——两条相等即为同步成立。这正是「两模板字节相同」在账上唯一可机检的写法。


## ⑥ WS / 前端

本模块**不新增任何 WS 帧**。它的消费者全部通过既有 HTTP 路径读到结果：

- `/api/characters`（`apps/server/src/routes/world.ts:703-743`）：今天只回 `avatar` / `avatarVideo` / `bio` / `voice`；**尚未**有 `emotions`（00 §5.1 的探测字段是 `01` 的实现项）。服务端按**当前激活世界根**探测，因此 jp 必须有自己的 6 张图才会回 `emotions`。
- `App.tsx:506-509`：`characters.find(item => item.id === id)` —— 前端按**角色 id** 从 `/api/characters` 的列表里取人。这条把「世界内卡片 id」与「角色目录 id」绑定在一起（§⑪-C4）。
- `CharacterModal`：有 `emotions` → 按 `emo` 切图；无 → `MotionPortrait(video=avatarVideo, poster=avatar)`（`00 §5.2`）。
- `parseEmoPages` / `parseEmoTag`（`apps/web/src/components/overlay/dialogue-pages.ts`）两模板共用同一状态机，语言无关。

**结论**：双世界统一在**数据面**完成，前端零改动；jp 只在缺图时静默走回退。

---

## ⑦ 错误边界

| 场景 | 应有行为 | 现状依据 |
|---|---|---|
| jp 只有 5/6 张情绪图 | `/api/characters` **整体不回传** `emotions`（00 §5.1「6 个全在才回传」）→ jp 玩家走回退 | 00 §5.1；`01` 的 E-01 |
| jp `sumi-yukimura` 无 `avatarVideo` | 回退到 `poster = avatar`（静态 webp），**不是**黑屏 | `templates/first-snow-jp/world.json` 的 `sumi-yukimura` 只有 `avatar` |
| jp `nanami` 有 `avatarVideo` | 回退到 `MotionPortrait(video)`（`templates/first-snow-jp/characters/nanami/README.md:5-6`） | 同上 |
| 镜像复制中途失败 | MUST 报错退出，**禁止**留下「半套」文件（半套会让第 1 行的规则把该世界整体降级，静默失败） | 本文 §③ 步 2 |
| 两模板出现字节漂移 | parity 机检 MUST 红，并打印两侧 SHA-256 与路径 | 本文 §⑩ |
| 有人把 `.airpworld/` 复制进 jp | `tools/first-snow-jp.test.mjs:80` 直接失败 | 已存在 |

---

## ⑧ 代码落点

精确到文件与函数：

1. **`tools/gen-emotions.mjs`**
   - `runCharacter()`（`:162-222`）在 `toWebp(png, path.join(pubDir, \`${emo}.webp\`))`（`:217`）之后，新增一次镜像复制：对 `worldName === 'firstsnow'`，把 `pubDir/<emo>.webp` 复制到 `templates/first-snow-jp/assets/characters/<id>/<emo>.webp`。
   - 复制走 `tools/sync-seedance.mjs` 新导出的 `copy()`（§② 2.2），复制后 MUST 复算摘要并断言相等。
   - `MIRROR` 表建议就地声明：`const MIRROR = { firstsnow: ['first-snow-jp'] };`（NEW）。
2. **`tools/first-snow-jp.test.mjs`**
   - `:78-92` 的 `nine original graphics…` 用例：`:82` 的 `assert.equal(images.length, 9)` MUST 改成「与 firstsnow 的 `assets/characters/**` 逐目录逐文件配对」或把常量改为 `9 + 12`——**不能不改**（§⑪-C2）。
   - `:85-87` 已覆盖 `assets/motion/seedance/**` 的逐字节比对，微动批无需改。
3. **`apps/server/test/preset-slots.test.mjs:123`**：删除 `templates/firstsnow/characters/sumi/preset.json` 锚点后 MUST 换成 `templates/firstsnow/characters/sumi-yukimura/preset.json`（或另一个真实存在的模板 preset）。
4. **`templates/firstsnow/world/intro/relationships/cafe/sumi.md:3`**：`id: sumi` 建议改为 `characterId: sumi-yukimura`（`type: sprite` 的 id 语义由 `apps/web/src/components/canvas/CanvasObject.tsx:261` 读取：`fm.characterId || fm.id || 文件名`）。
5. **`tools/firstsnow-parity.mjs`**（NEW）：§② 的两个函数 + 一个 CLI 入口，供 §⑩ 的机检与 `04` 调用。
6. **不落 `/api/*`**：本模块无服务端代码；`emotions` 探测归 `01`。

---

## ⑨ 与现状差异

### 9.1 已成立的既有统一（实测，可继续依赖）

- **微动视频的统一是机械的**：`tools/sync-seedance.mjs:19` 逐字 `mediaWorlds['first-snow-jp'] = mediaWorlds.firstsnow;`——同一个 config 对象被两个模板共用，`copy()`（`:39-44`）保证字节一致。**新增微动视频沿用这条链路即可，无需新写同步器。**
- **9 张静态图的统一是人工的 + 测试兜底的**：`tools/sync-template-assets.mjs:30-35` 的 `mappings` **只有 `firstsnow`**，没有 `first-snow-jp`；jp 的 9 张图是手工放进去、由 `tools/first-snow-jp.test.mjs:83-84` 逐字节校验的。
  → **本批新增 12 张情绪图必须补上这条人工侧的机检**（§⑩）。
- **文本层故意不同**（实测 `diff`）：`first-snow-jp/characters/nanami/preset.json` 的 `id` 是 `first-snow-jp-nanami`、多一个 `world-language` 文件槽（`baseDir: cwd, path: language.md`）；`firstsnow` 的 `id` 是 `nanami`、没有该槽。**这不是漂移，是设计。**

### 9.2 本批要建立的新差异

- 12 张 jp 情绪图（今天 0 张）。
- jp 侧落账文件（今天不存在）。
- `director.webp` / `sumi.webp` / `characters/sumi/` 三个旧 id 遗留的删除。

### 9.2b 复核当日的工作树实况（重要：`01` 已在落盘）

复核时 `templates/firstsnow/assets/characters/{nanami,sumi-yukimura}/` 已各有 6 张情绪 webp（mtime 2026-09-13 11:10–11:12），尺寸实测「with alpha, 767+1x1375+1」= 9:16（00 §3.1 冻结口径）；`assets/worlds/firstsnow-demo/characters/{nanami,sumi}/variants/` 已有 6 组 `<emo>-green.jpg` + `<emo>.png`。**first-snow-jp 侧仍是 0 张**——镜像尚未跑。这批新图在 `git status` 里是未跟踪（`??`），即**尚未入库**。

由此：本文 §③ 的「镜像」不是重跑生产，是**把已存在的 firstsnow 产物复制过去**；`sumi-yukimura-poster.png` 与 `sumi-yukimura-transparent.webm` 也已出现在 firstsnow 侧，属 `02` 的范围，镜像时一并处理。

### 9.3 与 `01` 的交界

`01` 负责生产与接线（`gen-emotions.mjs` / `/api/characters` / `CharacterModal` / `index.css`）；本文负责**产出物在第二个模板里的存在性与字节一致性**。两边都不许改 `00`。

---

## ⑩ 验收测试

### 10.1 逐字节证据（本次实测，命令可复现）

```bash
cd templates && for f in assets/characters/nanami.webp assets/characters/radio-director.webp \
  assets/characters/sumi-yukimura.webp assets/scenes/{amber-cafe,campus-rooftop,first-snow,intro,radio-studio,winter-schedule}.webp \
  assets/motion/seedance/characters/nanami-transparent.webm; do
  a=$(sha256sum "firstsnow/$f" | cut -d' ' -f1); b=$(sha256sum "first-snow-jp/$f" | cut -d' ' -f1)
  [ "$a" = "$b" ] && echo "SAME $a $f" || echo "DIFF $f"; done
```

**9 张图 + 1 条 webm 实测结果（全部 SAME）**：

| 文件（`<world>/` 后同路径） | SHA-256 | 结果 |
|---|---|---|
| `assets/characters/nanami.webp` | `2cde03a9503a537bbd4dab6a58a473f5c64da6d0ed44709cf9a5134dee05b6b6` | SAME |
| `assets/characters/radio-director.webp` | `c9404d072cd641796cf1890488c3b91a8c7bf575702bdbd5a638a7e5e16efa8a` | SAME |
| `assets/characters/sumi-yukimura.webp` | `d37dd186e7eb1cd11227dbf6c83703b3b72f5dd3269892991c9b3352431c4ebd` | SAME |
| `assets/scenes/intro.webp` | `787c1fa3cce9fb1d7ae172f693046ba7dc4052b46e38b4ab581299e8107a2b57` | SAME |
| `assets/scenes/winter-schedule.webp` | `e90b462eb947e52ffae37b4c5cd87d8f6f4bc7e5c3599bd0d7c1ee3d3179b8c5` | SAME |
| `assets/scenes/radio-studio.webp` | `b39378c9f623a4cc292f53ac7cfccecaad1839964ecf29651033119f43369e82` | SAME |
| `assets/scenes/amber-cafe.webp` | `fb61fb02d06c9453efb6502cc154a96eaa05e11432e655e0bc62fd20f9a6c593` | SAME |
| `assets/scenes/campus-rooftop.webp` | `950f63b9524b82bd36f24f6560d65bb1a98c926b45108f0c382c53a184958faf` | SAME |
| `assets/scenes/first-snow.webp` | `27717b50e1effd18c4a0cc7b3a0036f189448e0a4739344c3e12f91535046a0a` | SAME |
| `assets/motion/seedance/characters/nanami-transparent.webm` | `0cce4fdc12aba40f819ba39f5e5ebc69857c77c8530c4655115057eb4f5536ca` | SAME |

**顺带实测的全树口径**：`firstsnow/assets` 与 `first-snow-jp/assets` 共 23 个同名文件，**22 个 SHA-256 相同**，唯一不同是 `README.md`（英文 vs 日文清单，**故意不同**）。**本批复核这一刻**另有 27 个路径只在 firstsnow 侧存在——其中 13 个是既有遗留（`assets/backgrounds/*` 8 个、`assets/characters/{director,sumi}.webp`、`assets/characters/nanami/{nanami.webm,nanami-poster.png}`、`assets/source-manifest.json`），其余 14 个是**本批正在生成、尚未镜像**的产物（`nanami/` 6 张情绪 webp、`sumi-yukimura/` 6 张情绪 webp + `sumi-yukimura-poster.png`、`motion/seedance/characters/sumi-yukimura-transparent.webm`）——它们正是 §③ 步 2 要镜像过去的对象，镜像完成后应为 0。

### 10.2 新增机检（测试用例，逐条可失败）

| 编号 | 断言 | 若非实现则失败的样子 |
|---|---|---|
| **FP-01** | 对 `nanami` / `sumi-yukimura` ×6 情绪：`firstsnow` 与 `first-snow-jp` 的同名文件都存在且 SHA-256 相等 | 只在 firstsnow 落图 → jp 侧缺文件 → 红 |
| **FP-02（非空性）** | 把 jp 的一张图内容改一个字节 → FP-01 MUST 红 | 若写成「只查存在性」，改字节仍绿 → FP-02 必须独立断言摘要相等 |
| **FP-03** | jp 树内无 `.pi` / `.airpworld` 任何路径段 | 复用 `tools/first-snow-jp.test.mjs:80` 的既有断言 |
| **FP-04** | firstsnow 的 `characters/sumi/`（目录）、`assets/characters/sumi.webp`、`assets/characters/director.webp` 均不存在 | 删除未完成 → 红 |
| **FP-05** | 全仓 `grep -rn "characters/sumi\b" --include=*.md --include=*.json templates apps packages tools` 除 `first-snow-jp` 的 `sumi-yukimura` 路径外零命中 | 漏了一处引用 → 红 |
| **FP-06** | `tools/first-snow-jp.test.mjs` 的图片计数断言与实际文件数一致 | 加图后不改 `:82` 的 `9` → 红 |

### 10.3 逐字节镜像的「半套」断言

镜像复制函数 MUST 在复制后复算 `targetSha256` 并 `assert.equal(sourceSha256, targetSha256)`。测试用一个截断的临时源文件（写 8 字节）验证：复制函数**抛错**而不是留下半截文件。

---

## ⑪ 发现的冲突

### C1 — 00 §6.3 / §9 的「`sumi.webp` 不存在、实测 404」与工作树不符

00 §6.3（`:167`）与 §9（`:223`）逐字写：`avatar` 指向**不存在的** `assets/characters/sumi.webp`，**实测 404**。

**实测反证**：

```bash
$ ls -l templates/firstsnow/assets/characters/sumi.webp
-rw-r--r-- 1 yoshix7ti yoshix7ti 244774 Sep 12 20:13 templates/firstsnow/assets/characters/sumi.webp
$ git cat-file -s HEAD:templates/firstsnow/assets/characters/sumi.webp
244774
$ git log --oneline -1 -- templates/firstsnow/assets/characters/sumi.webp
44534c3 feat: 接通双语双世界可玩体验      # 2026-09-12 21:06:10 +0900
```

即：文件**在 firstsnow 世界根里存在且已入库**（`/api/asset` 解析 `templates/firstsnow` 为根，`world.ts:1099-1103`，不会 404）。真正 404 的只有把它放回 **`first-snow-jp` 根**去请求时——而 jp 里根本没有 `characters/sumi/` 目录，没人会请求它。
**结论**：404 的**后果**（旧 id 目录是死代码）成立，404 的**证据**不成立。删除计划不受影响，但 00 的这条证据若被 `01`/`04` 引用会传播错误事实。**不改 00**，在此登记，请主 agent 裁决是否修订。

### C2 — `tools/first-snow-jp.test.mjs:82` 的 `assert.equal(images.length, 9)` 与新规则直接互斥

该用例枚举 jp 树内所有非 motion 的 `.webp` 并硬编码 `=== 9`。本批要求 jp 增加 12 张情绪 webp（`assets/characters/{nanami,sumi-yukimura}/<emo>.webp`），漏改则该文件立刻变红；而「不改测试」不可能实现本批目标。**这是 MUST 同步修改的测试锚点，不是可选清理。**

### C3 — jp 没有 `assets/source-manifest.json`，00 §4.4 的落账要求在 jp 无处落地
`ls templates/first-snow-jp/assets/` = `README.md characters motion scenes`。而 `tools/template-assets.test.mjs:7` 只遍历 `mappings`（wuwu/whitechapel/divergence/firstsnow），**jp 不在其中**，所以 jp 有无 manifest 都不被任何测试约束。

三种兑现方式（待拍板，本文不替你选）：
(a) jp 新建 `assets/source-manifest.json`，并把 jp 加进 `mappings`——会立刻改变 `template-assets.test.mjs` 的覆盖范围与 `world.json` 的 `player`/`avatarVideo` 断言（`:19-26`）；
(b) 只写 firstsnow 的 manifest，jp 侧靠 `firstsnow-parity` 机检保证，manifest 里**显式登记 jp 为镜像目标**；
(c) 把 jp 的 `assets/README.md` 散文清单升级为带 SHA 的清单（改动最小，但破了「唯一 manifest 格式」的一致性）。

### C4 — 旧 id 的世界内卡片：`world/intro/relationships/cafe/sumi.md:3` 的 `id: sumi`

该文件是 `type: sprite`，`id: sumi`，标题却是 `Sumi Yukimura`。点击路径：`CanvasObject.tsx:261` 取 `fm.characterId || fm.id || 文件名` → `'sumi'` → `App.tsx:506-509` 在 `/api/characters` 列表里 `find(id === 'sumi')`。而 `firstsnow/world.json` 的 `characters[]` 只有 `nanami` / `sumi-yukimura`——**找不到人，点击静默无反应**。
这不是「素材」，是「旧 id 的 id 引用」；建议随本批改为 `characterId: sumi-yukimura`。归入 §④ 的清理范围请主 agent 确认。

### C5 — `firstsnow/assets/characters/` 同时承载「情绪图目录」与「小天地立绘目录」

`00 §3.1` 冻结 `assets/characters/<id>/<emo>.webp`；而 `docs/nook/00 §5.4` 与 `templates/firstsnow/characters/nanami/portrait.md:6-7` 把 `assets/characters/nanami/nanami.webm` + `nanami-poster.png` 放在**同一个目录**。
后果：目录级一致性断言不可用（firstsnow 的 `nanami/` 比 jp 多两个文件），parity 必须**按文件**比对（本文 §③ 步 3 已固化）。同时，`nanami.webm`（`f6628d9b…`）与发布位 `assets/motion/seedance/characters/nanami-transparent.webm`（`0cce4fdc…`）**是两条不同的字节**，`docs/nook/03:646` 声明前者是 divergence 演示占位素材——**两处 nanami 立绘不得互相顶替**。

---

## ⑫ 仍未知待拍板

| # | 问题 | 影响 | 需要谁定 |
|---|---|---|---|
| U1 | jp 是否也要小天地立绘（`portrait.md` + `assets/characters/<id>/<id>.webm`）？今天 jp 零 `portrait.md`、零 `.webm` | 决定 jp 的 `nanami/` 是否也要镜像 `nanami.webm`/`nanami-poster.png` | `02` + 主 agent |
| U2 | `nanami` 的微动源是 divergence 占位（`docs/nook/03:646`）；本批是否为 firstsnow 重产正式立绘？ | 若重产，`assets/motion/seedance/characters/nanami-transparent.webm` 的 SHA 会变，两模板**必须同时**更新（现由 `sync-seedance.mjs:19` 保证） | 主 agent |
| U3 | C3 的三种落账方式选哪个 | 决定 jp manifest 是否存在、`template-assets.test.mjs` 是否扩容 | 主 agent（`04` 执行） |
| U4 | `first-snow-jp` 的 `world.json` 有 `locale: "ja"`，`firstsnow` **无** `locale` 字段；而 `docs/nook/03:643` 逐字称「`firstsnow` 是日文世界（`world.json` 的 `locale: ja`）」 | 文档事实错误，可能误导后续用 locale 判断素材归属的人 | 主 agent（可能同属 C1 的勘误批） |
| U5 | `assets/characters/sumi.webp` 删除前，是否有历史存档（`worlds/**`）还引用它？ | 删图可能让旧存档 404 | 主 agent（本文只在 `templates/` 面取证） |
| U6 | 旧 id 目录清理是否也要扫 `worlds/**`（存档副本）与 `templates/*-playtest/`？ | 未扫描，`worlds/` 被 `.gitignore:12` 忽略，不在提交面 | 主 agent |
