---
name: character-asset-batch
description: Use when mass-producing or wiring character media for a world — 6-emotion differential portraits, transparent living-portrait micro-motion clips, workshop-to-publish promotion, provenance manifests, and the /api/characters + CharacterModal front-end wiring. Covers the green-screen chromakey recipe, recommended portrait proportions, the free-image / paid-video credit split, and the mirrors-firstsnow-to-first-snow-jp rule.
---

# 角色素材批次：6 情绪差分 + 透明微动立绘

一条从"车间 base 图"到"游戏里能动、能切表情"的完整流水线。三个工具各自解决一段：

| 段 | 工具 | 命令 | 成本 |
|---|---|---|---|
| ① 6 情绪差分（图） | `tools/gen-emotions.mjs` | `pnpm gen:emotions` | **免费**（实测 delta 0） |
| ② 透明微动立绘（视频） | `tools/gen-motion.mjs` | `pnpm gen:motion` | **扣额度** ~10 credits/条 |
| ③ 溯源落账 | `tools/record-emotion-assets.mjs` | `pnpm gen:record` | — |
| ④ 验收门禁 | `tools/verify-emotions.mjs` | `pnpm check:emotions` | — |

**冻结契约在 `docs/assets/00-共同上下文.md`**——本文是操作手册，规格以 `00` 为准（§5 权威顺序：`00` > `docs/nook/00` > …）。产出图 / 视频的前序工序见 `assets/skills/flow-media`（生图生视频）与 `motion-portrait`（抠像循环）。

## 一句话结论

```
base.png --(img2img 绿幕)--> <emo>-green.jpg --(chromakey+despill)--> <emo>.png --(cwebp q82)--> <emo>.webp
base.png --(i2v 绿幕 720p)--> <id>-green.mp4 --(motion-clip 抠像乒乓)--> <id>-transparent.webm + poster
```

**图免费、视频扣钱**——所以 6 情绪用图跑 6 宽，微动视频按需逐条跑、能复用就不重产。

---

## 一、位置：车间 vs 发布位

| 层 | 路径 | 进 git？ |
|---|---|---|
| 车间（原始产出 + variants） | `assets/worlds/<world>-demo/characters/<id>/` | ❌（`assets/**` 整树 gitignore，只白名单 `audio/` `skills/` `README.md`） |
| 发布位（随包分发，运行时读） | `templates/<world>/assets/characters/<id>/<emo>.webp` | ✅ |
| 发布位（微动立绘） | `templates/<world>/assets/motion/seedance/characters/<id>-transparent.webm` | ✅ |

`base.png` 是车间里该角色的正式立绘；`variants/<emo>-green.jpg` 是模型直接产出的绿幕源；`variants/<emo>.png` 是抠像后的透明中间件（发布 webp 的来源）。**图免费，中间件留着无妨**（车间不进 git）。

---

## 二、6 情绪差分（①）

```bash
pnpm gen:emotions --world whitechapel            # 全 cast
pnpm gen:emotions --world firstsnow --id nanami  # 单角色
pnpm gen:emotions --world whitechapel --force    # 重产已存在的
pnpm gen:emotions --list                         # 看有哪些角色/已产出
```

六个表情固定：`normal / smile / shock / sad / angry / thinking`（唯一真源 `packages/shared/src/rules/emotions.ts` 的 `EMOTIONS`）。每张走 **img2img**（`--ref-image base.png` + portrait 比例），**锚定身份与构图**，只换表情——这比纯 prompt 稳得多（见 `flow-media` §2.1）。

抠像链（脚本内置）：`chromakey=0x00FF00:0.18:0.06,despill=type=green:mix=0.6:expand=0.4,format=rgba`，再 `cwebp -q 82` 出 webp。

### 坑 A：绿幕图必须是"纯绿 + 硬边"

模型偶尔产出渐变绿或带阴影的绿幕——`chromakey` 阈值一小就残留绿边、一大就把角色的深色区（黑发、深蓝毛衣）一起吃掉。**逐张抽出来看**，必要时对单角色重跑 `--force`。despill 是 `mix=0.6`（去绿边）与 `expand=0.4` 的平衡点；角色发梢仍绿就加大 mix。

### 坑 B：比例是建议，不是硬契约

情绪图建议接近 **9:16**，微动立绘也建议保持相近比例，以免遮罩在静态图和视频之间切换时产生明显跳变。发布门禁不锁死具体分辨率或长宽比；不同来源的有效尺寸由组件布局适配。

---

## 三、透明微动立绘（②）

```bash
pnpm gen:motion --world whitechapel              # 全 cast
pnpm gen:motion --world whitechapel --id edith   # 单角色
pnpm gen:motion --world firstsnow --id nanami --force
```

流程：`base.png --(i2v 绿幕视频 720p 6s)--> <id>-green.mp4 --(motion-clip --pingpong)--> <id>-transparent.webm + poster.png`。

### 坑 C：视频生成分辨率按上游能力选择

当前 `omni-1.1-flash` 账号档位对 360p 生成档返回 `INVALID_ARGUMENT`，生产时建议使用可用的 720p 档位。这里是生成服务的可用性建议，不是发布 webm 的尺寸契约。

### 坑 D：不要重产已有溯源链的片子

`watson` / `nanami` 的微动片是 **niko 批 Seedance 管线的正式追踪资产**（`motion/seedance/manifest.json` + `tools/seedance-assets.test.mjs`）。**核实过同角色同美术后原样保留**，重产会破坏溯源链。工具默认 idle-skip（已存在就跳过），只有 `--force` 才重产——**按需 force，别无脑全 force**。

### 坑 E：抠像 / 循环的细节在 motion-portrait

`-c:v libvpx-vp9` 解码、`yuva420p`、乒乓封口都在 `assets/skills/motion-portrait/SKILL.md`。**"这个 webm 到底透不透明"的验收必须走 `pnpm check:emotions`（内含 libvpx-vp9 解码）**——内置 vp9 解码器会静默丢 alpha。

---

## 四、发布位接线（③④ 之外）

### 4.1 小天地 portrait 卡

每个有微动片的角色，`templates/<world>/characters/<id>/portrait.md` 挂一张 `portrait` kind 卡：

```yaml
type: portrait
component: portrait
video: assets/motion/seedance/characters/<id>-transparent.webm
poster: assets/motion/seedance/characters/<id>/poster.png
```

路径相对世界根。**6 条微动片没有 portrait 卡 = 零 runtime 引用的死资产**（踩过一次）。加了卡之后 `/api/nook?character=<id>` 才返回 `kind=portrait`。设计依据：`docs/nook/03`（遮罩用静态图、小天地用视频）。

### 4.2 遮罩切表情（前端）

- 服务端 `apps/server/src/routes/world.ts` 的 `/characters`：**6 张 webp 全在才回传 `emotions`**（`store.statKind` 探测），缺一张则整体不回传 → 前端回退静态。
- 前端 `CharacterModal`：`emotions?.[emo]` 有值就 `<img class="portrait-still">`，否则回退 `MotionPortrait`。
- `Emotion` 枚举唯一下沉在 `@airp/shared`（server 不能 import web）。
- **删掉旧的 `.emo-*` CSS filter 规则**——真图替换后滤镜是双重伪装。

### 4.3 firstsnow ↔ first-snow-jp 逐字节镜像

`first-snow-jp` 是 `firstsnow` 的日文入口，**新增素材两边必须字节一致**（`firstsnow` 常多带遗留 `sumi.webp`/`director.webp`，门禁断言的是**子集同一性**，不是数量相等）。

---

## 五、溯源落账（③）

```bash
pnpm gen:record            # 重写 templates/<world>/assets/character-media.json
pnpm gen:record -- --check # 核验（对不上 exit 1）
```

**账本名是 `character-media.json`，不是 `source-manifest.json`**——后者与 `motion/seedance/manifest.json` 的测试**断言精确行数**，绑死各自的 sync 工具（`tools/sync-template-assets.mjs` / seedance），**往里追加行会红**。所以走批次自有的独立账本。

---

## 六、验收（④）与收工自检

```bash
pnpm check:emotions          # 6/6（已存在的情绪集）+ 真透明 + 溯源账 + 全模板引用
pnpm check:emotions --all --json
```

门禁检查资产存在性、真实 alpha、manifest 摘要和双模板字节一致性。尺寸与长宽比只输出 advisory，不会导致门禁失败。

门禁六条（`docs/assets/00 §7`）：

| 查 | 断言 |
|---|---|
| A | 6/6 webp 齐备 |
| B | webp **真透明**（`dwebp` 解 → alpha 占比 > 0） |
| C | webp 尺寸与比例（**advisory，仅供生产参考**） |
| D | webm 真 alpha（`-c:v libvpx-vp9` 解） |
| E | 账本双向 SHA-256 对得上 |
| F | firstsnow ↔ first-snow-jp 字节一致 |

**为什么要 `dwebp` 而不是 ffmpeg 查 webp**：本机 ffmpeg 的 webp 解码器**间歇报 `Invalid data found`**（对某些合法文件），而 `dwebp`（libwebp，浏览器同源）稳定。**webp 走 dwebp、webm 走 libvpx-vp9**——两条解码路径都别偷懒。

**非空性**：改动门禁后必须证明它能红——移走 1 张图（A+E 红）、植入不透明图（B+E 红）。

收工跑全链：`pnpm build && pnpm test && pnpm check:docs && pnpm check:emotions`。

---

## 七、命令速查

```bash
# ① 6 情绪（免费）
pnpm gen:emotions --world <w> [--id <char>] [--force]
# ② 透明微动（扣额度 ~10/条）
pnpm gen:motion   --world <w> [--id <char>] [--force]
# ③ 溯源
pnpm gen:record [-- --check]
# ④ 验收
pnpm check:emotions [--all] [--json]
```

导出 `FLOW_API_KEY`，代理跑在 `127.0.0.1:8317`；依赖 `ffmpeg` / `cwebp` / `dwebp`（`apt-get install -y webp`）。
