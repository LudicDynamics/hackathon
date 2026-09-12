# Audio Asset Plan — AIRP 全量音频需求清单

> 状态：**清单 + 首批产出完成（2026-09-12）**；**接线已启动（批次 A1，见 `docs/audio/`）**。✅ = 已下载到 `assets/audio/`，❌/⚠️ = 待办。
> 依据：`doc-19 §2`（三层声场，权威）、`doc-06 §1/§2`、`doc-04 §10.4`、
> `docs/前端改造计划.md §5 T2.1 / §8 T5 / §12`、`docs/tools/08 §6`、
> `apps/web/src/lib/audio.ts`（当前实现真相）。
> **逐世界部分**不只抄 doc 点名，而是**按各世界实际场景文本 + 视觉 manifest 推导**
> （来源：`templates/**`、`~projects/infini-canvas/worldlines-canvas/stack/worlds/*.json`、
> `assets/worlds/*-demo/manifest.json`）。

## 0. 现状定性（反面教材）

`apps/web/src/lib/audio.ts` 目前**零音频资产**——三层全部是 Web Audio 运行时合成：

| 层 | 当前实现 | 问题 |
|---|---|---|
| L1 Ambient | 白/棕噪声 + 滤波（rain / fireplace / drip 三引擎） | 是"噪声造境"，不是真实环境录音 |
| L2 BGM | 正弦 drone（calm=A1+E2 / tense=55+58.3Hz 拍频 / crisis=心跳脉冲） | **根本不是音乐**，与 doc-19"平缓爵士/悬疑提琴/危机鼓点"完全不符 |
| L3 Foley | 8 个噪声爆裂 + 正弦 thump | 能听出"有反应"，但没有材质感（纸/木/铜） |

两处真实断层（**已解决 / 进行中，批次 A1**）：
1. **`ambient` 字段不存在** → ✅ **已定义**：契约 `docs/audio/00 §3.1` 新增顶层 `ambient`/`bgm`，服务端 `readLayerAudio` 解析（世界级 `assets/audio/` 优先、平台池兜底）；`App.tsx` 的 `tone→ambient` 误用已废。4 模板已按 `docs/audio/05 §9` 逐层声明。
2. **31 条无 URL 可达** → ✅ **已接通**：新增 `/api/audio` 路由（平台级）+ 引擎采样链（采样优先、合成兜底），见 `docs/audio/01`/`02`。
3. **`stinger/` 6 情绪缺素材** → ⚠️ 待办（P1，见 `docs/audio/05 §10.1`）。

---

## 1. L2 动态配乐 BGM

### 1.1 通用三情绪轨（doc-19 §2.2，P0，跨世界共享）

| # | 键 | 文档语义 | 状态 | 落点 |
|---|---|---|---|---|
| 1 | `calm` | 日常 / 平和 | ✅ 已有 | `bgm/calm.mp3`（Piano Song Loop #4, 36.7s） |
| 2 | `tense` | 心理博弈 / 悬疑 | ✅ 已有 | `bgm/tense.mp3`（Dark Atmospheric Drone, 158s） |
| 3 | `crisis` | 危机高潮 | ✅ 已有 | `bgm/crisis.mp3`（Fight Music Synth Tense, 97s） |
| 4 | spotlight 独奏 | doc-19 §4.1「BGM 瞬切为**单簧管悬疑独奏**」 | ⚠️ 无 | `tense` 的独奏变体，供 Spotlight 演出 |

### 1.2 逐世界主题曲（**按世界实况补充，doc 未强制**）

三情绪轨是"情绪层"，但五个世界**气质互不相通**（中世纪雾港 / 维多利亚推理 / 昭和怀旧 /
冬夜恋爱 / 烛火魔法）。同一首 `calm` 铺进雾坞镇和初雪电台，世界会串味。
**建议每个世界一条主题曲**（进世界时铺、离开时淡出，情绪轨叠在其上）：

| 世界 | 视觉/文本依据 | 建议主题风格 | 状态 |
|---|---|---|---|
| 雾坞镇（wuwu） | manifest：中世纪雾港 + 齿轮朋克，slate-violet / 灯笼金；剧本文本"钟停在第九天""雾从坞口上来" | 中世纪悬疑、码头酒馆 | ✅ `themes/wuwu.mp3`（Pirate Tavern, 61s） |
| 雾都来信（whitechapel） | manifest：维多利亚绅士 anime，sepia + 煤气灯青；"三起案都在雾最浓的夜里" | 维多利亚推理、悬疑提琴 | ✅ `themes/whitechapel.mp3`（Detective Hawkeye, 43s, CC-BY） |
| 分歧点（divergence） | manifest：昭和怀旧水彩，CRT 琥珀 + 雨蓝；"同一间店，三个时刻" | 昭和怀旧 / 合成器 | ✅ `themes/divergence.mp3`（Retro generative, 120s） |
| 初雪电台（firstsnow） | manifest：现代 anime 冬夜，淡蓝 + 雪白 + 琥珀；"ON AIR 红灯" | 冬夜钢琴 + 弦乐 | ✅ `themes/firstsnow.mp3`（Awesome Emotional Piano, 64s） |
| 烬晶学院（emberglass） | manifest：烛光哥特奇幻，胡桃木 + 黄铜 + 午夜靛 | 奇幻室内乐、竖琴 | ✅ `themes/emberglass.mp3`（Mystical fantasy loop, 55s） |
| Cthulhu（Innsmouth） | 模板"Cthulhu-esque"，"Never stare at Devil Reef" | 恐怖氛围、无调性弦乐 | ⚠️ 待办（非五世界之一） |
| Sakura Academy（school-romance） | 模板"春日樱花"，"cherry trees in full bloom" | 春风青春、木吉他 | ⚠️ 待办（非五世界之一） |

> **优先顺序**：五世界 demo 的主题曲 > 通用三轨补齐 > 其余模板。
> doc-24 §12 明写"试玩成立后才定稿音频"——**主题曲可先起草，定稿等评审**。

---

## 2. L1 环境声场 Ambient

### 2.1 基础三轨（`前端改造计划 §12`，P0，按层切换 1.5s 交叉淡入）

| # | 键 | 状态 | 落点 |
|---|---|---|---|
| 1 | `rain` | ✅ 已有 | `ambient/rain.mp3`（Forest Rainstorm 01 裁 60s） |
| 2 | `fireplace` | ✅ 已有 | `ambient/fireplace.mp3`（裁 60s） |
| 3 | `cellar-drip` | ✅ 已有 | `ambient/cellar-drip.mp3`（裁 60s） |

### 2.2 环境音池（**按世界实况归纳的可复用声场族**）

doc-19 §2.1 点名了"夜风 + 钟楼、钟表滴答、远方雷鸣、低声杂音、幽闭气流"，
但**真实世界的场景比这细**。下表按场景文本逐条推导，归成可复用池：

| 族 | 键（建议） | 声音内容 | 触发场景（世界） | 状态 |
|---|---|---|---|---|
| **天气** | `storm` | 暴雨 + 风 + 远处雷 | 雾坞镇灯塔、Innsmouth、时间线雷雨 | ✅ `pool/storm.mp3` |
| | `snow-wind` | 冬夜寒风 + 稀疏落雪 | 初雪天台、雪线、Sakura 冬 | ✅ `pool/snow-wind.mp3` |
| | `rain-indoor` | 雨打玻璃（室内听） | 221B、奥术图书馆、今夜常盘堂 | ⚠️ 待办（rain 是室外雨） |
| | `fog-calm` | 海雾 / 静默低频（无明确声源） | 雾坞镇港城图、不存在的街 | ❌ |
| **室内** | `tavern-chatter` | 压低人声 + 酒馆底噪 | 野猪头酒馆、临江旅店、221B | ✅ `pool/tavern-chatter.mp3` |
| | `cafe-murmur` | 咖啡馆人声 + 杯碟 | 琥珀咖啡店 | ✅ `pool/cafe-murmur.mp3` |
| | `office-night` | 空调停机后的空旷 | 写字楼加班夜 | ✅ `pool/office-night.mp3` |
| | `hearth-quiet` | 壁炉静燃（无人声） | 独自场景 | ✅ = `ambient/fireplace.mp3` |
| | `tv-wall` | CRT 电视墙嗡鸣 | 1994 常盘堂 | ❌ |
| | `radio-studio` | 调音台底噪 + 隔音间静默 | 电台录音间 | ❌ |
| | `print-room` | 印刷机 + 油墨间机械声 | 舰队街报社 | ❌ |
| **工作声** | `forge` | 风箱 + 炉火 | 铁匠铺（雾坞镇） | ✅ `pool/forge.mp3` |
| | `library` | 图书馆静默 + 偶发翻页 | 奥术图书馆、禁书库 | ✅ `pool/library.mp3` |
| | `scriptorium` | 抄写室：只有笔尖（沙沙） | 圣灰修道院 | ⚠️ 待办（= `foley/pen-scratch`） |
| | `shelf-shift` | 书架移动 / 木料摩擦 | Emberglass 图书馆 | ❌ |
| | `mechanism` | 齿轮 / 黄铜机械 | 雾坞镇灯塔、天文台 | ❌ |
| | `seismograph` | 老式仪器 / 传真机 | 今晚常盘堂 | ❌ |
| **水域/港口** | `harbor-waves` | 浪拍木桩 + 船索吱嘎 | 雾坞镇码头、Innsmouth、白鹭港 | ✅ `pool/harbor-waves.mp3` |
| | `seagulls-far` | 远处海鸥 | 雾坞镇、白鹭港 | ❌ |
| | `brine-eerie` | 死寂海水 + 诡异低频 | Devil Reef 废弃港 | ⚠️（`cave-drip` 可近似） |
| **宗教/仪式** | `bell-church` | 教堂钟声（报时/晚钟） | 雾坞镇（钟停=无声）、学院晚钟 | ✅ `pool/bell-church.mp3`（CC-BY） |
| | `bell-buoy` | 雾中浮标钟 / 沉重钟鸣 | 演出 `evidence_burst` | ⚠️（`bell-church` 可近似） |
| **自然/野外** | `cave-drip` | 洞穴滴水 + 幽闭气流 | 密室、地窖、废墟 | ✅ `pool/cave-drip.mp3` |
| | `orchard-night` | 夜果园：风过枝叶 + 夜虫 | 废弃果园（holmes） | ❌ |
| | `wind-ridge` | 高海拔风 + 经幡猎猎 | 雪线 | ⚠️（`snow-wind` 可近似） |
| | `ruins-wind` | 废墟穿堂风 + 滴水 | 三十年后废墟 | ⚠️（`cave-drip`+`snow-wind`） |
| | `pixel-campfire` | 像素篝火（游戏内） | 《九州》驻地 | ❌ |
| **城市/街道** | `city-night` | 冬夜街道 + 车声稀疏 | 初雪 map、Sakura | ✅ `pool/city-night.mp3`（CC-BY） |
| | `street-victorian` | 煤气灯街区 + 马车远声 | 白教堂区、贝克街 | ❌ |
| | `courtyard-spring` | 春日庭院：鸟鸣 + 微风 | Sakura 庭院 | ❌ |
| | `rooftop-city` | 天台：风 + 城市底噪 | 初雪天台 | ❌ |

> **池化的价值**：五世界 demo + 四模板 + 8 个 canvas 世界共约 **40+ 个场景**，
> 但声场族收敛到 **约 28 条**，且大量复用（`rain-indoor` 服务 3 个世界、
> `harbor-waves` 服务 3 个）。
>
> **优先级建议**：P0 先做 §2.1 三条（已 ✅）；P1 做每世界 demo **首场景各一条**
> （雾坞镇 tavern / whitechapel baker / divergence y1994 / firstsnow studio / emberglass library）；
> P2 补齐池。

---

## 3. L3 实体拟音 Foley（`前端改造计划 §12`，P0）

八条，每条裁到 1–2.2s。**已全部下载真素材**（替换运行时合成）。

| # | 键 | 触发点 | 文档语义 | 状态 |
|---|---|---|---|---|
| 1 | `paper-slide` | 拖拽卡片（`Canvas.tsx:256`） | 厚磅纸在木桌摩擦 | ✅ `foley/paper-slide.mp3` |
| 2 | `bag-pack` | 卡片落定 / 收纳（`Canvas.tsx:310`） | 皮质卡包搭扣"啪嗒" | ✅ `foley/bag-pack.mp3`（Suitcase Latch） |
| 3 | `dice-roll` | 掷骰仪式（`DiceRoller.tsx:142`） | 实木骰子翻滚撞击 | ✅ `foley/dice-roll.mp3` |
| 4 | `unlock` | 开锁 / 用对道具（`doc-08 §6.1`） | 钥匙开锁"咔哒" | ✅ `foley/unlock.mp3` |
| 5 | `pen-scratch` | 作家落墨（`RadialMenu.tsx:105`） | 蘸水笔刮纸 | ✅ `foley/pen-scratch.mp3` |
| 6 | `gate-open` | 门卡穿越（`doc-06 §3.1`） | 开门 | ✅ `foley/gate-open.mp3` |
| 7 | `crit-chime` | 大成功（`DiceRoller.tsx:123`） | 明亮风铃和弦 | ✅ `foley/crit-chime.mp3` |
| 8 | `fumble-break` | 大失败（`DiceRoller.tsx:126`） | 低沉断弦重音 | ✅ `foley/fumble-break.mp3` |

### 3.1 可补充的互动拟音（**按世界实况补充**）

代码里 `use_item_on` 只分辨 `unlock`/`paper-slide` 两种（`use-item.ts:114-118`），
但世界的互动实际更丰富：

| # | 键 | 来源场景 | 状态 |
|---|---|---|---|
| 9 | `page-turn` | 读书 / 翻案卷 / 抄写室 | ✅ `foley/page-turn.mp3` |
| 10 | `glass-clink` | 咖啡店可可杯 / 酒馆酒杯 | ❌ |
| 11 | `typewriter` | 报社 / 记者 | ❌ |
| 12 | `chalk-write` | 黑板书写（粉笔 vs 钢笔 `pen-scratch`） | ❌ |

---

## 4. 演出专用音效（doc-19 §4，P1）

| # | 键 | 演出 | 文档语义 | 状态 |
|---|---|---|---|---|
| 1 | 悬念滚奏 | 骰子仪式蓄力 | doc-19 §3.3「全屏压暗 40% + **悬念滚奏**」 | ❌（`playCharge` 合成） |
| 2 | 沉重钟鸣 | `evidence_burst` 线索风暴 | doc-19 §4.1-2「伴随一声**沉重钟鸣**」 | ⚠️ 无 |
| 3 | 华丽和弦 | 大成功结算 | doc-19 §3.3 | ❌ = `crit-chime` |
| 4 | 断弦 / 破碎 | 大失败结算 | doc-19 §3.3 | ❌ = `fumble-break` |
| 5 | 墨洇展开 | `ink_burst` / chalk 落定 | doc-19 §2.1 L3「墨洇展开」 | ⚠️ 无 |
| 6 | 出示证据 | `use_item_on` 角色目标 | `doc-08 §6.1` `paper-slide`/`present` | ❌ 复用 `paper-slide` |
| 7 | 追光起势 | `spotlight` 演出 | doc-19 §4.1「微尘扬起 + BGM 瞬切」 | ⚠️ 无 |

---

## 5. 界面 / 系统音（低优先）

| # | 键 | 用途 | 状态 |
|---|---|---|---|
| 1 | 纸条折起飞出 | doc-06 §2.1 玩家输入 | ⚠️ 无 |
| 2 | 门铃 / UI 提示 | doc-24 雾坞镇"门铃还在摆" | ⚠️ 无 |
| 3 | 静音开关反馈 | 顶栏 MuteButton | ⚠️ 可不需要 |

---

## 6. 非音频但同属多模态（doc-19 §1.2，顺带登记）

| # | 键 | 用途 | 状态 |
|---|---|---|---|
| 1 | `baker-street-rain.webm` | 动态背景（3~5s 循环，1~2MB） | ❌ |
| 2 | `fireplace.webm` | 动态背景 | ❌ |

---

## 7. 优先级汇总

| 优先级 | 内容 | 状态 |
|---|---|---|
| **P0 必做** | L2 BGM ×3 + L1 ambient 基础 ×3 + L3 Foley ×8 | ✅ **全部完成** |
| P1 高优 | 世界主题曲 ×5 + 环境音池基础 ×11；演出音效；动态背景 ×2 | 主题曲 ✅ / 池 ✅ / 演出音效 ❌ |
| P2 | 环境音池补齐（§2.2 剩余约 13 族）；互动拟音 ×3；2 个模板世界主题曲 | ❌ |
| 待定 | 结局曲（doc-24 §12：试玩成立后再定） | ⏸ |

## 8. 建议的下一步

1. **接线（P0）** → ✅ **进行中（批次 A1）**：`/api/audio` 路由 + `lib/audio.ts` 采样链（合成器降为离线兜底）+ `ambient`/`bgm` frontmatter 贯通（设计见 `docs/audio/00`–`06`）。
2. **`stinger/` 6 条情绪瞬时音**（P1 缺口）：`normal`/`smile`/`shock`/`sad`/`angry`/`thinking`，<1.5s，供角色 `[emo: tag]` 触发（`playStinger` 已接线，缺素材时静默 no-op）。
3. **演出音效**（钟鸣 / 墨洇 / 悬念滚奏）—— P1，可复用 `pool/bell-church` 与 `foley/*`；
4. **`gate-open` / `page-turn` 接线**（有素材无调用点）：`gate-open` 留 T4.3 门卡过场，`page-turn` 留 book/pages 二级层；
5. 剩余环境音族与 2 个模板主题曲（school / cthulhu），**等 doc-24 五世界选项定案**。
