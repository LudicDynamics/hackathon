# REVIEW-R5 — 诚实性与需求强度（演出通道批次 · 只读评审）

> 编号 R5。视角：**抽掉设计里的「想当然」+ 加强「够不够味」**。
> 对象：`docs/perform/00`（冻结契约）与 `01`–`06`。**未实现**（实读确认：`apps/web/src/lib/phantom.ts` / `writer-state.ts` / `ghost.ts` / `dice-ceremony.ts` / `components/performance/` 全不存在；`git status` 无这批新增）。
> 基线复核（实跑 2026-09-13）：`node tools/check-ws-contract.mjs --json` → `{contract:24, emitted:24, consumed:11, findings:9}`，9 条与契约 §1 表逐条一致（`event-bridge.ts:67/88/97/124/137/152/178/192` + `show_frame` 结构性标记 `:0`）。**基线数字为真**。
> 所有断言带 `file:line` 或章节号；本报告未改任何被审文件。

---

## 1. 结论

**需回写后再放行（不阻断整批，但阻断 `01`/`03`/`05` 三篇的部分实现）。**

- **A（诚实性）**：总体质量高。`03 §11.2`（`reused` 不省 provider 调用）、`04 §11.1`（`canvas.db-wal` 确触发 `file_changed` 的 spike）、`01 §3.1`（自认初稿错并改正）都是**实读/实测级的真发现**。但有三处硬伤：
  1. **`02 §11` 有 5 个子节正文为空**（11.1–11.5 只有标题），违背它自己声明的「逐条给出哪两份、哪一句、为什么、怎么改」；
  2. **契约 §8 的 `phantom.ts` 签名被 `01` 单方面扩了三个字段**（`label`/`elapsedMs`/`layer`），而 `03` 逐字依赖它——**唯一一处「两篇共用冻结面但冻结面不完整」**，须主 agent 回写契约后才可开工；
  3. **`05 §3.5`「同一时刻只允许一场」与 `docs/tools/10:543` 的手测判据「两种演出叠加…互不打断」直接冲突**，`05` 的冲突清单**没登记**。
- **B（需求强度）**：**「能跑」达标，「够味」不达标**。最刺眼的是**声音维度整批缺席**——`doc-19 §2` 把声音定义为「PlayCo 明确点名的第一要素」，`前端改造计划 §5 T2.1` 列为 P0 必做，但 5 篇设计里**只有 `02` 调了 `playFoley`**（grep `playFoley|playStinger|setBGM|setAmbient`：`00/01/03/04/05` 零命中）。`spotlight` 的「BGM 瞬切悬疑」（`docs/tools/10:731`、`doc-19:228`）、`evidence_burst` 的「一声钟鸣」（`docs/tools/10:734`）、`chalk` 的「沙沙刮纸音」（`doc-06 §1`）全无落点。
- **最弱的演出 = `chalk_writing`（笔尖）**：`doc-06 §1` 的作家身体是**红杆铅笔**（悬停呼吸=在想、按压抖动=在写、收笔淡出=退场），`前端改造计划:339-342` 的 T3.4 时间轴是「笔尖落下 420ms → 悬停呼吸 500ms → 湿墨」，而 `01 §6.1` 只给一个 `.ink-tip` 指示 + 空壳，**没有铅笔、没有呼吸、没有入场**。次弱 = `evidence_burst`（Money Shot 的「数十条丝线」在模板里只有个位数链接，且坐标层归属未拍板）。

---

## 2. Part A — 诚实性

### 2.A.1 冲突 / 未知 汇总表（全 6 篇）

类型：`真冲突`=两份上位文档互斥；`过期`=文档写的现状与源码不符；`缺口`=上位文档没定义、实现必须自己定；`待拍板`=设计自己挂起。

| # | 出处 | 摘要 | 类型 | 阻断实现？ |
|---|---|---|---|---|
| A1 | `01 §11.1` | `docs/tools/12:573` 的 `writer_delta` 载荷缺 `toolCallId` | 过期 | 否（`06 R-P2`） |
| A2 | `01 §11.2` | `docs/tools/02:476` 记 `writer_delta ← event-bridge.ts:46-50`（`text_delta` 来源），与裁决 A 矛盾 | 过期 | 否（`06 R-P3`） |
| A3 | `01 §11.3` | `docs/后端实现计划:81/:209` 把 `message_update` 写成两车道同源 | 过期 | 否（`06 R-P4`） |
| A4 | `01 §11.4` | 契约 §3.2 item2（乐观前缀流）vs 原则4（绝不显示未确认）**措辞张力** | 缺口 | 否（`01 §3.1` 已裁决，建议改契约措辞） |
| A5 | `01 §11.5` | `前端改造计划:334` 组件名 `writer/WriterChannel.tsx` vs 契约 §8 `WriterInkLayer.tsx` | 过期 | 否（契约优先） |
| **A6** | **`01 §11.6` + `03 §12.4`** | **契约 §8 的 `phantom.ts` 签名只有 `register(toolCallId,{kind,path?,seat})`，`01` 单方面补了 `label?`/`elapsedMs?`/`layer?`** | **缺口** | **是（P0）** |
| A7 | `01 §12.1` | `chalk_landed` 无 `toolCallId`：同 turn 多篇 chalk 时定位歧义 | 待拍板 | **是（P1）** |
| A8 | `01 §12.2` | 逐字 `~24ms/字` 是 `[推断]`，未对齐原型 `stack/index.html` L836-977 | 待拍板 | 否（P2） |
| A9 | `01 §12.3` | `writer_message` 是否仍有意义 | 待拍板 | 否（P3） |
| **A10** | **`01 §12.4`** | **`doc-06 §2.3` 要求「writing 中切层 → 写了一半的旁白原地擦掉」，本批未接** | **缺口** | **是（P1，属违约）** |
| A11 | `01 §12.5` | `phantom.layer` 由前端补 vs 服务端帧带 | 待拍板 | 否（P2） |
| **A12** | **`02 §11.1–11.5`** | **五个子节正文为空（只有标题）** | **交付缺陷** | **是（P1，评审门）** |
| A13 | `02 §11.6` | 与 `05` 的相机/压暗/`roll_ceremony` 三条边界（已 IRC 冻结） | — | 否 |
| A14 | `02 §12.1` | 逐骰面用「数值面轮播」而非 `doc-19 §3.3` 的「大号 2.5D 骰子旋转碰撞」 | 待拍板 | 否（P1，强度） |
| A15 | `02 §12.2` | 落定后是否给被裁决卡打高亮（`doc-19` 未要求） | 待拍板 | 否（P3） |
| A16 | `02 §12.3` | 角色车道掷骰是否演全屏仪式 | 待拍板 | 否（P2） |
| A17 | `02 §12.4` | 帧到达时音频未解锁 → 静默 | 待拍板 | 否（P2） |
| A18 | `02 §12.5` | `roll_ceremony` + `dice_result` 是否需握手 | 待拍板 | 否（P2） |
| A19 | `02 §12.6` | 去重 5s / 上限 50 是 `[推断]` | 待拍板 | 否（P2） |
| A20 | `03 §11.1` | `docs/tools/12:583` 把 `image_landed` 的前端动作写错 | 过期 | 否（`06`） |
| **A21** | **`03 §11.2` + `§12.3`** | **`doc-11 §3.3` 说 `reused`「不重复生成」；实现里 provider 仍被调用（`generate-image.ts:339` 早于 `:349-359`）** | **真冲突** | **是（P1，`03` 自认「必须一起裁决」）** |
| A22 | `03 §11.3` | `doc-02:168` 幻影可拖 vs `doc-10 E3:45` 不可拖 | 真冲突 | 否（`03` 已判定按 `doc-10`） |
| A23 | `03 §11.4` | `image_landed ≠ 底图已换`，两处文档暗示它是终点 | 缺口 | 否 |
| A24 | `03 §11.5` | `tool_end` 不带失败原因（只有 `isError` 布尔），前端只能泛化文案 | 缺口 | 否（P2，接受泛化） |
| A25 | `03 §11.6` | `doc-11 §6.2` 的 `stage` 四档 vs 工具壳只发两档 | 过期 | 否（`06`） |
| A26 | `03 §12.1` | 「拖幻影指定落点」本批做不做 | 待拍板 | 否（独立特性） |
| A27 | `03 §12.2` | `LANDED_DWELL_MS=15s` / `REUSED_DWELL_MS=5s` 是 `[推断]` | 待拍板 | 否（P2） |
| A28 | `03 §12.4` | 依赖 `01` 的 `phantom.ts` 落地（同 A6） | 缺口 | **是（P0）** |
| A29 | `03 §12.5` | `ghostSizeFor` 盒尺寸 `[推断]`，且不承诺与底图尺寸一致 | 待拍板 | 否（P2） |
| A30 | `03 §12.6` | 心跳 10s 对 3–15s 生图几乎不触发 | 待拍板 | 否（P2） |
| A31 | `04 §11.1` | `canvas.db-wal` 会触发 `file_changed`，本帧被覆盖（已实测，论证接受） | 真冲突（已解） | 否 |
| A32 | `04 §11.2` | 契约 §7 说「与 `card_position` 同一份合并」，现状 `card_position` 无早退/无 `z`/不写 `stateRef` | 已收敛 | 否 |
| A33 | `04 §11.3` | `docs/tools/09 §6.4:513` 的「不转发」论证无法区分 `card_position` | 过期（措辞） | 否（P3） |
| A34 | `04 §11.4` | `docs/tools/09 §9:609-610` 现状描述过期（行号 + 「只带 `source`」） | 过期 | 否（`06`） |
| A35 | `04 §11.5` | `前端改造计划` 的 T3.x 无本帧条目 | 缺口 | 否（`06` 登记） |
| A36 | `04 §12.1` | 纯函数落点 `useWorld.ts` vs `lib/canvas-patch.ts` | 待拍板 | 否（P2） |
| A37 | `04 §12.2` | `layerFetchCount` 是否长期保留 | 待拍板 | 否（P3） |
| A38 | `04 §12.3` | `kind:'links'` 帧触发 `clearAllLifts`（打断拖拽叠放） | 待拍板 | 否（P2） |
| A39 | `04 §12.4` | `LinkLayer` 全量重建 O(n) | 待拍板 | 否（P2） |
| A40 | `04 §12.5` | 帧乱序 last-write-wins | 待拍板 | 否（P2） |
| A41 | `04 §12.6` | 早发的 `fetchLayer` 后 resolve 会盖掉本帧合并 | 待拍板 | 否（P2，架构级） |
| A42 | `04 §12.7` | `directed` 箭头规格未定（`doc-04 §4` 未查） | 待拍板 | 否（P2） |
| **A43** | **`04 §12.8`** | **`/api/layer` 补三列是「本批顺带修」还是「另开一篇」（超出 9 条 DARK 范围）** | **待拍板** | **是（P1，范围）** |
| A44 | `04 §12.9` | `rowToLink` 口径唯一化（两处实现） | 待拍板 | 否（P2） |
| A45 | `05 §11.1` | `docs/tools/12:581` 的 `show_frame` 载荷列漏 4 字段 | 过期 | 否（`06`） |
| A46 | `05 §11.2` | `docs/tools/10 §6.3:349` 的 `spotlight` 漏 `tone` | 过期 | 否（`06`） |
| A47 | `05 §11.3` | `lights_out` 的 `focus` vs 顶层 `target` 无定义 | 缺口 | 否（已按 (b) 冻结） |
| A48 | `05 §11.4` | `evidence_burst` 的 `links` 双来源（顶层 vs `params.links`） | 缺口 | 否（已冻结顶层优先） |
| **A49** | **`05 §11.5`** | **`bursts`/`staggerMs` 的 zod schema 无上界；前端内部封顶 8/400** | **缺口** | **是（P1，schema 不收紧=作家可发暴涨参数）** |
| A50 | `05 §11.6` | `前端改造计划:434-435` 的 P5 落点 `overlay/Spotlight.tsx` vs 契约 §8 | 过期 | 否（`06`） |
| A51 | `05 §11.7` | `docs/tools/10 §10.3` 手测清单 7 种里缺 5 种 | 缺口 | 否 |
| **A52** | **`05 §12.1`** | **`PerformanceLayer` 挂点 `App.tsx` vs `Canvas.tsx`；「`Canvas` viewport `overflow-hidden` 会裁光束」是 `[推断]`（未实测）** | **待拍板** | **是（P1）** |
| **A53** | **`05 §12.2`** | **`evidence_burst` 丝线进世界变换层(A) vs 屏幕固定层(B)；`05` 自认「本篇最需要拍板的一个取舍」** | **待拍板** | **是（P1）** |
| A54 | `05 §12.3` | `roll_ceremony` 骰子尺寸（160px 是否过大） | 待拍板 | 否（P2） |
| **A55** | **`05 §12.4`** | **`fireworks.origin` 格式 MUST 冻结，否则作家猜格式** | **待拍板** | **是（P1）** |
| A56 | `05 §12.5` | 帧里的 `actor` 本批不消费 | 待拍板 | 否（P2） |
| A57 | `05 §12.6` | `show-geometry.ts` 是否单列 | 待拍板 | 否（P2） |
| A58 | `05 §12.7` | `target` 卡不在当前层时「不演 + warn」，玩家无感 | 待拍板 | 否（P2） |

### 2.A.2 真阻断项清单（实现前不拍板会埋雷）

| ID | 阻断项 | 为什么是雷 | 建议 |
|---|---|---|---|
| **B1** | **契约 §8 的 `phantom.ts` 冻结签名不完整**（缺 `label?`/`elapsedMs?`/`layer?`） | `01 §6.2` 已按「补上」写，`03 §2.5` 逐字抄同一签名并声明「若 `01` 最终未落这些字段，`03` 的 §6/§8 需重新对齐」（`03 §12.4`）。**两篇共用一份冻结面，冻结面本身没冻结**——本批唯一的跨篇 P0。 | 主 agent 在契约 §8 补三行（`01 §11.6` 已给原文），或改 §5 记一句「层归属与进度字段由调用方补」；改完广播。 |
| **B2** | **`evidence_burst` 丝线坐标层归属**（`05 §12.2`） | 若同轮 `evidence_burst` + `camera_focus`，选 (B) 屏幕固定层会让丝线**错位**；选 (A) 则推翻 `05 §3.6-2` 自己定的「演出挂点不进会重建的子树」纪律。两条路都改 `PerformanceLayer` 挂点，**改晚了等于重写**。 | 拍板 (A) 或 (B)，同步修 §3.6-2 措辞。`05` 倾向 (B) 但自认 (A) 更不易错。 |
| **B3** | **`PerformanceLayer` 挂点 `App` vs `Canvas`**（`05 §12.1`） | 它是 7 种演出的**唯一挂点**，且「`Canvas` viewport `overflow-hidden` 会裁光束」是 `[推断]`。挂错 = 7 种全废。 | **实测 `Canvas.tsx:466` 的 `overflow-hidden` 与 `App.tsx:562` 的裁剪行为**（10 分钟），再拍板；`05 §10.2 判据 2` 会暴露它。 |
| **B4** | **`fireworks.origin` 格式**（`05 §12.4`） | `params.origin` 是 `z.string().optional()`，上游无单位/格式。作家侧**只能猜**，猜错烟花就打错地方——而它是 `doc-19 §4.1` 的庆祝/结算时刻。 | 冻结为 `"<0..1>,<0..1>"` 屏幕比例（`05` 建议），并回写 `docs/tools/10 §14.3:733`。 |
| **B5** | **`reused` 是否短路 provider 调用**（`03 §11.2`/`§12.3`） | `03` 明说「与本批联动，必须一起裁决」：若短路，`reused` 时**没有进度帧**（`onUpdate` 在动作层无 hook），`03 §3.4`/`§10.3 用例 #4` 全要收缩；不短路，则 UI 说「Already had this image」而用户等 3–15s，**观感在撒谎**。 | 二选一：(a) 接受现状 + 改 `doc-11 §3.3/:644` 措辞（`03` 已建议）；(b) 把 `statKind(asset)` 提到 `provider.generate` 前并短路，同步砍 `03 §3.4`。**必须与 `03` 同回合裁决**。 |
| **B6** | **`chalk_landed` 多篇 chalk 的定位歧义 + 是否加 `toolCallId`**（`01 §12.1`） | 契约 §3.2 item 4 说「只有 `writer_delta` 需要 `toolCallId`」，但 `01` 自己发现多篇 chalk 场景下这句「可能不成立」。判据是「最早未落定 chalk 幻影」——**并发 chalk 时会过户到错误的幻影**，而这是「本批最贵」的那条车道。 | 拍板：给 `chalk_landed` 也加 `toolCallId`（载荷变更，回写 `docs/tools/12 §6.2`），或明确「一个 turn 只允许一篇 chalk」并写成纪律。 |
| **B7** | **跨层切走的撤回**（`01 §12.4`） | `doc-06 §2.3:83` 是**硬要求**：「writing 中切层/进门 → 整条撤回：写了一半的旁白原地擦掉」。`01` 登记「本批未接」。**不接就是明示违约**，而成本它自己说「低」（`enterLayer` 里 `phantom.clearAll()`）。 | 建议本批做（<10 行）。若坚持不做，必须写明「本批已知缺失 vs `doc-06 §2.3`」并给后续归属，不能只写「待拍板」。 |
| **B8** | **（本评审新增）`writer_delta` 与 `chalk_writing` 的到达顺序未冻结，且 `appendInk` 先于 `register` 未定义** | 契约 §3.1 冻结「`toolcall_end` 在 `tool_execution_start` **之前**」，而 `writer_delta` 在 `toolcall_end` 发出（`01 §3.2`）、`chalk_writing` 在 `tool_execution_start` 发出（`event-bridge.ts:87-89`）⇒ **`writer_delta` 常态先于 `chalk_writing`**。`01 §6.1/§6.3` 的示例却是「先 `register` 再 `appendInk`」，且 `phantom.ts` 的 `appendInk` 对未知 id 的行为**全文未定义**（§7 只定义了 `evict`/`land` 的空操作）。 | `01` 补一条：`appendInk` 对未知 `toolCallId` 的行为（缓存待 `register` 回填 / 或忽略），并写明两帧乱序是常态而非异常。这也是 `doc-06 §2.1` 的「笔尖落下」时间轴能否成立的前提（见 §4 强度表）。 |
| **B9** | **（本评审新增）`05 §3.5` 的「同一时刻只允许一场」vs `docs/tools/10:543` 的手测判据** | `docs/tools/10:543` 逐字：「两种演出叠加：先 `spotlight` 再 `ink_burst`，两者互不打断（前端按 `durationMs` 各自独立生命周期）」。`05 §3.5` 冻结的却是**后到者接管**（`cleanup` 上一场）。**上位文档的验收判据与设计相反，而 `05` 冲突清单没登记它**。 | 拍板哪个为准。若按 `05`，则 `docs/tools/10 §10.3` 判据 4 必须改（回写归 `06`）。 |

### 2.A.3 `[推断]` 诚实性审计

**标得对（确实无法确证 / 可接受）**：
- `01:170` 代理对无需合并 `[推断]` —— **复核为真**：`apps/web/src/lib/md.ts:87-96` 的 `MarkdownText` 走 `createTextNode`，`appendInline`（`:63-81`）按正则切片，**不按码点切分**，两个 UTF-16 码元拼回原串无视觉差异。
- `02:315` 背包/小天地实体不让掷骰 `[推断]` —— 与 `local-store.ts:550-556`（`resolveLayer` 对 `player/**` 返回 `null`，注释逐字「Mapping a bag path to 'map' would be a lie」）一致，成立。
- `05:554` `probe-provider.ts` 没有 `show` 剧本 `[推断]` —— **复核为真**：`tools/probe-provider.ts:57-73` 的 `streamScript` 只处理 `text` 与 `toolCall` 两块，无 `show` 剧本。

**该实测却标了推断（应补一次实跑）**：
- **`05:287`**「`Canvas.tsx:466` 的 viewport 是 `overflow-hidden` 的——光束要从画布外射入的话会被裁掉」`[推断]`。这是**整个 7 种演出的挂点依据**（B3）。10 分钟可在 DevTools 里量出。**不该留作推断**。
- **`05:257`**（`prefers-reduced-motion`）：`useCamera` 无「瞬间」入口 `[推断]` —— **复核为真**：`useCamera.ts:143-148` 的 `flyTo` 只 `applyTarget`，`lib/camera.ts` 的 `LERP_K` 固定。但由此推出的「最小改法是 `flyTo` 后把 `sharedCurrent` 也写一次」**没有 `useCamera` 的导出面证据**（`sharedCurrent` 是模块私有），属**实现级猜测**，应改成 `NEW snapTo()` 的签名提案而非「写一次」。

**把未知伪装成已定（陈述句、无证据）**：
- **`05 §3.3` 的 `spotlight` 行**：「微尘 → **复用 `ParticleLayer` 的既有尘埃**」。但 `ParticleLayer.tsx:69-100` 的 48 粒是**挂载时一次性按 `tone` 随机**的**环境尘埃/雨丝**（`isRain` 分支），`doc-19:228` 要的是「周围**扬起**细碎微尘粒子」——**方向性/瞬时性完全不同**。设计把它写成「复用即可」，实际是**把未交付的需求当成已满足**（见 §4）。
- **`05 §3.3` 的 `lights_out` 行**：「环境音切低」被列在「演什么」列里，但**全文（§4/§8）没有任何 `setAmbient`/`playFoley` 落点**。这是一句**没有实现承诺的效果描述**。
- **`05 §4.4`**：`bursts × 12`、上限 96 粒、`origin` 缺省「视口上方中点」——这些数字**不是**上位文档冻结的（`docs/tools/10 §14.3:733` 只给 `bursts` def 5），却写成「写死，可核验」。**可核验 ≠ 有依据**；应标 `[推断]` 并登记进 §12。
- **`01 §5`**：「实读确认：它只调 `getEventsSince`/`getMaxSeq`」——`grep -c appendEvent event-bridge.ts` **实得 1**（`event-bridge.ts:265` 是注释词，非调用）。结论对，但「零命中」措辞与实得数不符（对比 `04 §5` 自己写「仍为 1」——`04` 更诚实）。

### 2.A.4 逐篇「伪造已定」扫描

| 篇 | 结论 |
|---|---|
| `01` | 干净。§3.1 主动推翻自己初稿（「为什么 §3 初稿错了」），是本批诚实性最好的示范。仅 §5 的 grep 措辞不精确（P3）。 |
| `02` | **§11.1–11.5 空正文（P1）**；另 `§2.1` 表格说 `source`「§6.3 只用来选文案语气 `[推断]`」，而 `§6.3` 正文写「**不参与任何分支**」——**同一篇内自相矛盾**（P2）。 |
| `03` | 干净且强。§11.2 主动指出上位文档「不重复生成」是误读并给源码行号，§10.3 用例 #4 反手标「需 key」。§4 把「`grep shimmer` 只命中 `audio.ts:371` 的注释」这种细节都写出。 |
| `04` | 干净。§11.1 的 spike（`canvas.db-wal` → `file_changed`）有实测输出；§10.2 判据 1-B **主动声明「诚实声明：300ms 后计数必然 +1」**，是本批反假绿写得最实的一处。仅行号引用漂移（P3）。 |
| `05` | 有「伪装已定」三处（§2.A.3）；另有 B9 的未登记冲突。其余（§4.4 性能论证、§3.4 的 `elementBox` vs `getBoundingClientRect`）质量很高。 |
| `06` | 改写单本身可核验（§5 给了 grep 判据）。但漏了 `05 §11.7`（手测清单缺 5 种）与 B9（`docs/tools/10:543` 与 `05 §3.5` 相反）——**回写清单不完整**。 |

### 2.A.5 行号漂移（P3，但影响「实读」可信度）

`01 §4/§6.6` 引 `Canvas.tsx:464-484`（`worldRef`）、`:471-483`（卡片 map）、`:486-493`（`SceneChalk`）；**实读为 `:475`、`:482-495`、`:498-504`**，系统性偏移 ~11 行。`05 §4.4:325` 引 `Canvas.tsx:496 的 <ParticleLayer tone={bg.tone} />`，实际在 **`:508`**。`04 §2.2/§8.4` 引 `/api/layer` links 查询 `:495-504`，**实际在 `routes/world.ts:620-623`**（偏移 ~120 行）。
→ 这些**不是读错**，而是**在其它 agent 并发改动 `Canvas.tsx`/`world.ts` 之前读的**（`git status` 显示两文件均为 `M`）。契约 `06 §3` 已预警「行号是二手真相」。**建议**：实现期一律改语义引用（函数名 + 锚句）；本报告不算作阻断。

---

## 3. Part A — 独立复核项（实读源码后对核心断言的确认 / 推翻）

| # | 设计断言 | 我的复核（实读） | 判定 |
|---|---|---|---|
| **R1（任务书点名：`writer_delta` 的来源流）** | 契约 §3/§01 §3：AIRP 叙事正文**不在助手的文本回复里**，而在 `chalk` 工具的 `content` 参数；故 `writer_delta` 来源须从 `text_delta` 改为 `toolcall_delta`+`toolcall_end(chalk)` | ① `extensions/instructions.ts:74-75` 逐字「text that lives only in your reply **never reaches the player**, and the canvas stays empty」——**确认**。② `extensions/toolkit/chalk.ts:41-46` 的 `parameters: Type.Object({ content: Type.String({description:'The narration body in markdown'}), path?, link_to?, append_to? })`，且 `execute` 调 `writeChalk({ body: params.content })`（`chalk.ts:73-75`）——**正文=工具参数，确认**。③ `event-bridge.ts:64-73` 现状 `message_update`/`text_delta` → `writer_delta`——**确认现状会被误喂**。④ `CharacterModal.tsx` 消费 `airp:character-frame`（`useWorld.ts:370-376`），角色车道确实走 `text_delta`——两车道来源不同**成立**。 | **确认（裁决 A 正确且必要）** |
| **R2（契约 §3.1 spike 1：RPC 下 `partial` 被剥）** | `toJsonEvent` 删 `assistantMessageEvent.partial`，服务端走 RPC | `vendor/pi-rp/packages/coding-agent/dist/modes/json-event.js:1-13` 逐字 `const { partial: _partial, ...deltaEvent } = assistantMessageEvent;`；`modes/rpc/rpc-mode.js:17` import `toJsonEvent`、`:386` `output(toJsonEvent(event))`——**确认**。 | **确认** |
| **R3（契约 §3.1 spike 2：`toolcall_delta` 期间工具名不可知）** | 时序 `toolcall_start → deltas → toolcall_end → tool_execution_start`；唯一带 `toolName` 的 `tool_execution_start` 最后到 | 类型定义 `vendor/pi-rp/packages/ai/dist/types.d.ts:425-437`：`toolcall_delta` 只有 `{contentIndex, delta, partial}`，`toolcall_end` 带 `toolCall`——**无 `name`，确认**。`agent-loop.js` 把 `toolcall_*` 原样 emit 成 `message_update`（`:216-229`）——**确认**。而 `tool_execution_start` 的 airborne 顺序由 harness 保证（`tools/probe-provider.ts:57-73` 剧本也印证）——**确认**。 | **确认**；→ 由此推出 **B8**（`writer_delta` 先于 `chalk_writing`），设计未写。 |
| **R4（契约 §3.1 item 4：`toolcall_end.toolCall.id` 与 `tool_execution_start.toolCallId` 一致）** | 唯一可靠的事后确认锚点 | `toolcall_end` 的 `toolCall` 是完整 `ToolCall`（`types.d.ts:246-254`：`{id,name,arguments}`）——**确认**。但「id 与 `toolCallId` 一致」这一点**设计标为实测**而我在静态源码里**无法确证**（跨 provider 可能在 id 上做前缀处理）——**属于必须在实现时回归验证的假设**，建议 `01 §10.3` 的单测里补一条「`writer_delta.toolCallId === chalk_landed/tool_end.toolCallId`」的端到端断言。 | **部分未核验（需实现期实测）** |
| **R5（契约 §6b-3：生图写盘不触发 `file_changed`）** | watcher 忽略 `.airpworld/assets/` | `event-bridge.ts:364-377` 逐字 `rel.startsWith('.airpworld/assets/') || rel.startsWith('.airpworld/sessions/') || ...`——**确认**。 | **确认** |
| **R6（契约 §6b-4：`generate_image` 的 `onUpdate` 真发）** | `resolving` → `generating`+每 10s 心跳 → `clearInterval` | `extensions/toolkit/generate-image.ts:78-95` 逐字 `onUpdate?.({details:{stage:'resolving',...size}})`，`setInterval(..., HEARTBEAT_MS)` 发 `{stage:'generating', elapsedMs, ...size}`，`heartbeat.unref()`——**确认**；代码注释 `:71-77` 明说 `saving` 发不出来（印证 `03 §11.6`）。 | **确认** |
| **R7（`02 §2.2`：`fumble = rolls.every(r === 1)`）** | `2d6` 掷 `[1,1]` → `fumble=true`；`crit` 与 `passed` 正交 | `packages/shared/src/rules/dice.ts:241-258` 逐字 `crit: rolls.every((r) => r === spec.faces), fumble: rolls.every((r) => r === 1)`——**确认**。`2d6` 掷 `[1,3]`：`fumble=false`，`result=4`；`1d100` 掷 100 且 `expect:'=1'` → `passed=false, crit=true` 是逻辑必然——**确认**。 | **确认** |
| **R8（`04 §2.2`：服务端回填的是完整 `LinkRecord` 行）** | 不是只回 id | `packages/shared/src/actions/canvas.ts:29-43` 的 `LinkDetails.links: LinkRecord[]`；`schemas/canvas.ts:65-75` 的 `LinkRecord` 含 `color/directed/z`——**确认**。但 `04` 说「`/api/layer` 的 links 查询 `:495-504` 只 SELECT 5 列」**实测在 `routes/world.ts:620-623`**：`'SELECT id, from_id, to_id, style, label FROM links WHERE layer = ?'`——**确认该字段缺口为真**（行号漂移，见 §2.A.5）。 | **确认（缺口为真）** |
| **R9（`04 §3.4`：`arrange` 改坐标后线不跟随，是真实缺口）** | `updateAllLinks()` 今天只在拖拽热路径被调用 | `Canvas.tsx:3` import `updateAllLinks`，调用点仅 `:328`（拖拽 move）与 `:376`（落定）——**确认**；`useEffect(..., [items, links])`（`:147-149`）只 `invalidateMeasures()`，不重算线——**确认**。 | **确认（真实缺口，浏览器可验）** |
| **R10（`03 §3.4`：`reused` 不省 provider 调用）** | `provider.generate` 排在 `outputPathFor`/`statKind` 之前 | `packages/shared/src/actions/generate-image.ts:337-359`：`:339` `await provider.generate(...)` → `:349` `outputPathFor` → `:358` `statKind(asset)` → `:359` `reused = existing === 'file'`——**确认**。 | **确认（上位文档 `doc-11 §3.3` 措辞确有误导）** |
| **R11（`05 §2.1`：`durationMs` 已被服务端 clamp 到 [300,12000]）** | 前端 MUST NOT 再 clamp | `packages/shared/src/actions/show.ts:47-48` `MIN_DURATION=300 / MAX_DURATION=12000`，`:155` `Math.min(MAX_DURATION, Math.max(MIN_DURATION, input.duration_ms ?? def.defaultDuration))`——**确认**。 | **确认** |
| **R12（`05 §2.2`：7 种演出的 `params` 字段名逐字）** | `spotlight{dim,spread,tone}` / `lights_out{dim,focus}` / `fireworks{color,bursts,origin}` / `evidence_burst{links,staggerMs,color}` / `camera_focus{zoom}` / `ink_burst{tone,scale}` / `roll_ceremony{dice,anticipation}` | `packages/shared/src/components/performances.ts:15-100` 逐字段比对——**完全一致**。`camera_focus` 确实**只有 `zoom`**（`:70`），`roll_ceremony` 确实**无结果字段**（`:96-99`，注释「this one does NOT roll dice」）——**确认**。 | **确认（§2.2 表可作实现唯一真源）** |
| **R13（`05 §3.4`：`elementBox` 返回世界坐标、`getBoundingClientRect` 返回缩放后屏幕坐标）** | 必须用前者 | `apps/web/src/lib/measure.ts` 注释逐字「offsetWidth/offsetHeight are untransformed layout px … (getBoundingClientRect is zoom-scaled)」——**确认**；`LinkLayer.tsx` 的 `readBox` 与之同源。 | **确认** |
| **R14（`01 §6.7`：`writer-state.phase='idle' ⇒ writerToolsInFlight===0` 的单向蕴含）** | 反向不成立 | `useWorld.ts:113` `writerToolsInFlight`；`:360-369` 仅 `source==='writer'` 加/减；`writer_idle` 来自 `agent_settled`（`event-bridge.ts:191-194`）。设计给的蕴含在源码语义下**成立**——**确认**。但 `01 §6.7` 说 `beginTurn('turn')` 由 `case 'tool_start'` 驱动：一个 turn 内多次 `tool_start/end` 会让 `inFlight` 回到 0 而 `phase` 仍是 `writing`（靠 `writer_idle` 才转 idle）——**这正是设计想要的**，无矛盾。 | **确认** |
| **R15（`02 §6.4`：`DiceRoller` 仪式是 `fixed inset-0 z-50`）** | 骰子仪式层 z-50，`PerformanceLayer` ≤ z-20 | `DiceRoller.tsx:339` 逐字 `fixed inset-0 z-50 bg-[rgba(41,40,32,0.55)] backdrop-blur-sm ...`——**确认**；`index.css:711-714` 的 `.fumble-crack` `z-index:55`——**确认**。 | **确认** |
| **R16（`03 §3.3`：`image_landed` 是前端唯一「图好了」的通道）** | 排座/退场观察靠 `bg.src` 命中 | `Canvas.tsx:508` `<ParticleLayer tone={bg.tone} />`；`SceneBackdrop` 收 `bg` prop（`:471`）——结构成立。但**退场观察**要 `PhantomLayer` 读 `bgSrc`，而 `PhantomLayer` 被 `01/03` 计划挂在 `worldRef` 层**内部**（`01 §6.6`）——它拿到的是 DOM 坐标而非 `bg`；`03 §8.2` 的 `PhantomLayerProps` 里**确实有 `bgSrc`**，但 `Canvas.tsx` 的挂载点必须把 `bg.src` 一路传下去，**`01 §6.6` 的示例写的是 `<PhantomLayer />`（无 prop）**——**两篇的挂载示例不一致**。 | **推翻/需回写**：`01 §6.6` 的 `<PhantomLayer />` 与 `03 §8.2` 的 `<PhantomLayer currentLayer bgSrc />` 冲突（新增 **B10**，P1）。 |
| **R17（`02 §3.3`：帧路径跳过 `charging`，复用 `ROLL_MS=1200`）** | `ROLL_MS`/`SETTLE_MS` 是 `DiceRoller` 模块常量，需 `export` | `DiceRoller.tsx:19-20` 逐字 `const ROLL_MS = 1200; const SETTLE_MS = 1300;`，**均无 `export`**——**确认**（`02 §11.3` 的「唯一既有文件改动」为真，且 `02 §10.2 判据 B-3` 的「diff 只有 `export` 关键字」判据正确）。 | **确认** |
| **R18（`01 §6.6`：`SceneChalk` 在 `worldRef` 块外，是屏幕固定层 `[推断]`）** | 判决挂点 | `Canvas.tsx:496` 关闭 `worldRef` div，`:498-504` `<SceneChalk/>`，`:508` `<ParticleLayer/>`——**结构确认**：`SceneChalk` 确实在 `worldRef` 外。但「屏幕固定层」是**命名推断**：它在 `Canvas.tsx` 根 div（`:466`，`relative w-full h-full`）内，仍是 `Canvas` 的坐标系（未 `fixed`）——**「屏幕固定」措辞不严谨**（P3）。 | **大体确认（措辞需收紧）** |

### 3.1 新增阻断项（本轮独立复核才发现）

| ID | 内容 | 证据 |
|---|---|---|
| **B10** | **`PhantomLayer` 的挂载 prop 在两篇里不一致**：`01 §6.6:449-460` 写 `<PhantomLayer />`（无 prop），`03 §8.2:366-376` 写 `<PhantomLayer currentLayer={...} bgSrc={bg.src} />`。`PhantomLayer` 是 `03` 的属主、`01` 的挂载点——**契约 §8 只冻结了名字，没冻结 props**。`01 §6.6` 的判据「`Canvas.tsx` 里 `PhantomLayer` 出现 1 次」会通过，但**传不传 prop 决定 `03` 的层过滤与退场观察能否工作**。 | `01:449-460` vs `03:366-376`；`Canvas.tsx:475` 的 `worldRef` 块内没有 `bg` 作用域变量（`bg` 是 `Canvas` 的 prop，`:471` 的 `SceneBackdrop` 用它）——挂载示例必须显式传。 |

---

## 4. Part B — 需求强度（「够味」而非「能跑」）

**基准（上位文档的预期效果）**：
- `doc-19 §0.1`：评委红线四条——A4「Entertainment = show ＋ obsession」；`§4.1` 点名 **Money Shot**：追光（BGM 瞬切单簧管）、线索风暴（钟鸣 + 数十条红丝线）。
- `doc-19 §3.3`：骰子「整场游戏最具戏剧张力的时刻」——全屏压暗 40% + 悬念滚奏 + 2.5D 骰子物理惯性旋转碰撞 + 大成功金光 / 大失败猩红裂痕 + **全屏震颤**。
- `doc-06 §1`：作家身体 = **红杆铅笔**（悬停呼吸=在想、按压抖动=在写、收笔淡出=退场）；板书 = 湿墨 → 洇干，**伴随微弱沙沙刮纸音**。
- `doc-03 §3.3` / `:160`：异步慢操作的文案义务——「画面不动是正常的，不是卡住了」→ 生图等待本身要**说话**。
- `前端改造计划 §5 T2.1`：三层声场（ambient/bgm/foley）是 **P0 必做**。

### 4.1 逐帧 × 强度评级

评级口径：**够味**=达到上位文档描述的体验强度；**能跑**=帧接上、不报错、有意义可见，但体验被降级；**不足**=连可见行为都不完整。

| 帧 | 篇 | 上位文档要的效果 | 设计给的 | 评级 | 差距（要加什么才够味） |
|---|---|---|---|---|---|
| `writer_delta` | `01` | 湿墨**逐字渗出**、洇干落定 | 累积到 `phantom` 的 `text`，`ChalkMark` 本地 ~24ms/字 + `.chalk--ghost{opacity:.62; blur(.6px)}`，`landed` 加 `.ink-spread` | **够味（结构），能跑（纹理）** | 已有「渗」的时间轴（逐字 + blur→0 + opacity .18→1 的 `textInkSpread`，`index.css:260-274`）。缺：**逐字期间的笔压感**（字与字之间无 ink 浓度差）、**刮纸音**（`pen-scratch` 在 `FoleyName` 里现存，`audio.ts:31`，零调用）。**加味**：`ChalkMark` 里按 `shownChars` 触发每 N 字的 `playFoley('pen-scratch', 0.4)`（节奏应与字符间距相关，不是固定 4 拍）。 |
| `chalk_writing` | `01` | **红杆铅笔笔尖飞入 → 悬停呼吸 500ms → 按压抖动**（`doc-06 §1`、`前端改造计划:339-342`） | 一个 `.ink-tip` 指示 + shimmer 空壳（`01 §6.1/§6.6`） | **不足（本批最弱）** | 见 §4.2。 |
| `chalk_landed` | `01` | 湿墨转干、座位过户（不跳位） | `phase='landed'` + `.ink-spread` + `reconcileLanded` 幂等撤幻影 | **够味** | 幂等 + 座位不变 + 失败撤离三件都写实了；观感依赖 `chalk_writing` 的笔尖（上游弱则这条也弱）。 |
| `writer_idle`（+`writer-state`） | `01` | 收笔淡出、输入解禁（诚实，不排队） | `phase` 机 + `WriterBar` placeholder 换文案 | **能跑** | 文案「作家正在写……」够诚实（`doc-06 §2.3`），但**没有「收笔」这一拍的视觉**（`doc-06 §1` 的「收笔淡出=退场」）。**加味**：`writer_idle` 时给 `ChalkMark` 的最后一笔加一次 ~200ms 的收笔淡出（不是瞬撤）。 |
| `dice_result` | `02` | **大号 2.5D 骰子物理惯性旋转碰撞 + 全屏震颤 + 金光/裂痕** | 全屏 40% 压暗 + `rolls` **数值面轮播**（~90ms/面）+ crit `crit-glow` / fumble `fumble-crack` + `dice-shake` | **够味（落定），能跑（翻滚）** | 落定段的金光/裂痕/震颤**全部复用既有已打磨的 CSS**（`index.css:681/711/739`），这是聪明的。缺：**翻滚不是「物理骰子」**——`doc-19 §3.3` 明写「伴随物理惯性急速旋转、碰撞台面反弹」，设计给的是数字轮播（`02 §8:390` 自己承认「不画 pip 骰子」）。**加味（低成本）**：轮播期间给 `FaceTile` 加 `translateY` 弹跳 + 轻微 `rotate` 抖动 + **`playFoley('dice-roll')` 的落桌撞击音在 settle 那一刻补一拍**（现在 `playFoley('dice-roll')` 只在 mount，`:429`），「碰撞台面」就有了。 |
| `image_generation_progress` | `03` | 等待**也是一种叙事**（`doc-03 §3.3`、`doc-11 §6.2`「画面不动是正常的」） | shimmer 骨架 + `stageText` 心跳文案（「Still drawing… 20s」）+ `elapsedMs` 单测 | **够味** | 这是本批**等待体验做得最实**的一条：秒数在动、文案分档、`elapsedMs:0` 的 truthiness 陷阱都点名进单测（`03 §10.2`）。唯一风险是 `03 §12.6` 自认「心跳 10s 对 3–15s 生图几乎不触发」→ **演示里可能一次秒数都不出现**。**加味**：把 `HEARTBEAT_MS`（`generate-image.ts:26`，`10_000`）调到 `3_000`（成本为二次 `onUpdate`，无副作用），让「等待在说话」真的可见。 |
| `image_landed` | `03` | 座位过户：幻影壳换真图、影深变化、座位不变 | `land()` 不传 seat + `GhostCard` 按 phase 换壳 + `img onError` 可见撤离 + `reused` 封条 | **够味** | 失败可见（封条 + 淡出 + 玩家语言，`03 §8.3`）与 `reused` 的「不抢戏」都写实。 |
| `canvas_patched` | `04` | 线/位**即时**跟手，不等重取 | `mergeLinkPatch`/`mergeItemPatch` + `[items]→updateAllLinks` + `layerFetchCount` 可核验 | **能跑（且是本批的诚实样板）** | 它是**基础设施帧**，本身没有「演出强度」要求（`doc-19` 未提），且 `04 §11.1` 主动承认「本帧消灭的是延迟，不是重取」。评级按「能跑」即可。**发现的一个真缺口修得很好**：`arrange` 后线脱锚（R9），修法是 `[items]→updateAllLinks()`——这条**只有浏览器能发现**，`04 §10.2 判据 3` 守住了。 |
| `show_frame` × 7 | `05` | 见 §4.3 | 见 §4.3 | **混合** | 见 §4.3。 |

### 4.2 最弱演出：`chalk_writing`（笔尖）—— 详述与加味建议

**为什么最弱**：
1. **上位文档给了完整的「作家身体」设计，设计只实现了一个 DOM 指示器。** `doc-06 §1` 的意象系统逐字：「**红杆铅笔** | 作家的身体 | 笔尖即作家的精灵（Nodesign 的 agent 有精灵，AIRP 的作家是一支笔，不露脸）；悬停呼吸=在想（liveness），按压抖动=在写，收笔淡出=退场」——**三拍**（呼吸/抖动/淡出）。`01 §6.6:468-471` 只给 `.ink-tip`（笔尖指示）+ `.chalk--ghost` 空壳；**「呼吸」「抖动」都没有**。
2. **时间轴缺失。** `前端改造计划:339-342` 的 T3.4 是「纸条折起飞出 ~400ms → **笔尖落下 420ms** → **悬停呼吸 ~500ms** → chalk 湿墨流式 → 洇干落定 → 收笔淡出」——**6 拍里有 4 拍属于笔尖**。`01 §6.1` 把 `chalk_writing` 压成「register + 半透明壳」，等于**把最长的一段演出砍成一个 DOM 节点**。
3. **它还是 `writer_delta` 的承载体。** 湿墨挂在幻影壳上（`01 §6.3`），笔尖弱 ⇒ 「笔在写字」的因果观感消失，退化成「一块半透明文字自己长出来」。
4. **素材与成本都不是借口**：`01 §8` 已经把落点全部列好（`WriterInkLayer.tsx` 新文件、`index.css` 加类）；铅笔不需要位图，`.ink-tip` + CSS transform 即可（`doc-19 §1` 明确「不碰 Blender」，2.5D 纸雕即可）。

**加味建议（可直接落进 `01 §6.1/§6.6` 与 §10.2 判据）**：
- **入场（420ms）**：`chalk_writing` 到达时，`.ink-tip` 从**屏幕上方**（或卡片上方 120px）沿一条微弧线落到 `seat`——复现 `doc-06 §2.1` 的「笔尖从上空落下」。用 `@keyframes tipDrop`（`translateY(-120px)→0` + `opacity 0→1`），非 React。
- **悬停呼吸（~500ms）**：落定后 `.ink-tip` 做 `scaleY(1→1.06→1)` 的慢循环（1.6s / 次），语义「在想」（`doc-06 §1`）。
- **书写抖动**：`writer_delta` 首次到达时切到 `.ink-tip--writing`——`translate(±0.5px)` 的高频（~90ms）抖动，语义「在写」。**在 `phase==='landed'` 时停**。
- **收笔淡出**：`writer_idle` 时 `.ink-tip` `opacity→0` + 轻微上移（200ms），语义「退场」。
- **音**：笔尖落下的那一刻 `playFoley('pen-scratch', 0.5)`；书写期间按字符节奏复打（见 §4.1）。
- **可核验判据（补进 `01 §10.2`）**：DevTools 断言 `.ink-tip` 的 `transform` 在 `chalk_writing` 后 420ms 内从 `translateY(-120px)` 变到 `translateY(0)`；`writer_idle` 后 250ms 内 `opacity === 0`。

> **注**：这一项**不需要新帧、不需要服务端**，纯前端 + CSS。它与 B8（`writer_delta` 先于 `chalk_writing` 到达）**互相依赖**：笔尖入场没做完，湿墨就先长出来了。**B8 必须先解**。

### 4.3 `05` 的 7 种演出逐一评价（AIRP「评委看得见」的部分）

`doc-19 §4.1` 把 7 种演出归到「Showmanship / Money Shot」。逐条对照上位文档的**效果描述**与 `05` 给的**实现**：

| id | 上位文档的效果要求 | `05` 的实现 | 评级 | 加味建议 |
|---|---|---|---|---|
| `spotlight` | `doc-19:227-228` + `docs/tools/10:731`：全画布压暗至 15%、暖金光束垂直打下、**周围扬起细碎微尘粒子**、**BGM 瞬切单簧管悬疑独奏** | `.show-dim`（`--show-dim`）+ `.show-beam` + 「复用既有尘埃」+ 无音频 | **能跑** | ①**BGM 瞬切**：`05` 全文零音频（`playStinger`/`setBGM` 在 `audio.ts:851/701` 现存）。这是 `doc-19 §4.1-1` 的**逐字要求**且是**评委的耳朵最先注意的**。落点：`showSpotlight` 开演时 `playStinger('shock')` 或 `setBGM('tense')` + 收场恢复。②「微尘**扬起**」≠ 既有 48 粒环境尘埃：需一次性播一组从光束中心向外的短命粒子（可复用 `ParticleLayer` 的 sprite 路径，不必新 canvas）。③光束的 `--show-beam-x/y` 应取 `elementBox`（`05 §3.4` 已定），但**光束在卡被拖走后不跟随**是接受的代价（`05 §3.6-3`）——可接受。 |
| `lights_out` | `docs/tools/10:732`：「全屏关灯 + 焦点卡微亮 + 环境音切低」 | 遮罩 + `.show-focus-lift` + **无音频** | **能跑** | 「环境音切低」是效果列的明文，却无落点。**加味**：`setAmbient` 到该层的静音变体（或 `setBGM(null)` + 恢复），成本 ~3 行。 |
| `fireworks` | `docs/tools/10:733` + `doc-19 §1.3`：前景层（z:150）粒子爆裂 + **余烬下落** | 复用 `ParticleLayer` 的第二粒子组，`bursts×12` 上限 96 粒 | **能跑** | 结构决策（不新开全屏 canvas）**论证扎实**（`05 §4.4`，引 `AGENTS.md §7.6-1` 的实测 57→34fps）。缺**余烬下落**（`docs/tools/10:733` 逐字）：爆裂后粒子直接消亡。**加味**：burst 粒子加 `vy` 重力 + 长 `decay`，落 0.8s 再灭——这才是「烟花」不是「爆炸」。另 `playFoley` 无对应音效（`FoleyName` 无 firework 类）→ 可用 `crit-chime` 的轻量变体或留白（**登记**）。 |
| `evidence_burst` | `doc-19:230`：「伴随一声**沉重钟鸣**，数十条红色丝线从各个卡片瞬间延展串联、刺向真相卡片」 | 顶层 `links` 优先 + `.show-thread` + `staggerMs` 封顶 400 | **不足** | ①**钟鸣**无落点（`playFoley` 现存 9 音里无 bell/gong，`audio.ts:24-33`）→ 需要新增一个 foley 或复用 `unlock` 的低频变体（**登记**）。②**「数十条」在模板里不成立**：`docs/tools/09:800` 实测模板 `links` 表 0 行、单层数条；`staggerMs` 默认 90ms × 4 条 = 360ms 内演完，**没有「风暴」感**。③坐标层归属未拍板（B2）。**加味**：把 `staggerMs` 缺省降到 ~45ms 并允许**同一卡发多条**（视觉叠加），或让 `target` 卡本身的 `data-path` 高亮脉冲，把「刺向」的方向感做出来。 |
| `camera_focus` | `docs/tools/10:353`：「相机飞向 `target`，**不压暗**」 | `useCamera().flyTo` + `zoom` 唯一字段 | **够味** | 设计**正确地**拒绝了把 `durationMs` 映射成 `LERP_K`（`05 §3.3`，会污染全局相机手感）——这是本批最好的「克制」判例。唯一缺：`prefers-reduced-motion` 下「立即到位」需要 `NEW snapTo()`（`05 §3.7` 的 `[推断]` 措辞应改成签名提案）。 |
| `ink_burst` | `docs/tools/10:757`（§14.3 表外）+ `05 §4.3`：`target` 卡上墨迹**一次迸溅** | `.show-ink` 复用 `textInkSpread` 关键帧 + `--show-ms`/`--show-scale` | **能跑** | `05 §4.3:303` 明确说 `.ink-spread` 是「文字洇干」而 `.show-ink` 是「一次迸溅」，**语义区分是对的**。但复用同一 `@keyframes`（`index.css:260-274`，从 blur 3.2px→0）表达「迸溅」可能偏柔。**加味**：迸溅应是**中心溅开**（`clip-path` 或 radial 遮罩 + 快速 `scale(0.6→1.15)`），与「洇干」的模糊收敛区分开——否则两个演出在同一张卡上看起来一样。 |
| `roll_ceremony` | `doc-19 §3.3` + `docs/tools/10:737`：「**大号 2.5D 骰子**入场翻滚」 | 复用 `.dice-cube-ceremony`（160px，`index.css:616-621`）+ 只演入场 | **能跑** | 与 `02` 的边界（只演入场、不渲染点数、不播 `crit-chime`/`fumble-break`）**冻结得清楚**（`02 §11.6` / `05` 附）。缺：**尺寸与姿态未拍板**（`05 §12.3`）——160px 在卡片旁可能过大；且 `roll_ceremony` 是**画布演出**（不是全屏遮罩），2.5D 透视在非全屏语境下的观感未验。**加味**：给 `roll_ceremony` 一个 120px 的尺寸变体 + 入场时**从画面上方落下**（与 `player/character` 的 `roll_dice` 触发语义呼应），并在 `show` 的返回文案里说明骰面规格（`params.dice`）。 |

### 4.4 B 部分的总结建议（按性价比排序）

1. **给 `show` 与 `chalk` 补音频**（P0，~1h）：`spotlight`→`playStinger`/`setBGM`，`lights_out`→`setAmbient`，`evidence_burst`→新增 gong，`chalk`→`pen-scratch`。**这是「够味」的最低成本最高回报项**，且 `audio.ts` 的 API 已全部存在（`playFoley:830` / `playStinger:851` / `setBGM:701` / `setAmbient:696`）。
2. **`chalk_writing` 的笔尖三拍**（P0，见 §4.2，纯 CSS + ~40 行）。
3. **`image_generation_progress` 的心跳降到 3s**（P2，1 行）——否则「等待也是一种叙事」在演示里看不到。
4. **`fireworks` 的余烬下落 / `ink_burst` 的溅开 / `evidence_burst` 的钟鸣**（P2，各 ~20 行）。
5. **`02` 的翻滚加弹跳+撞击音**（P1，见 §4.1）——把「数值轮播」撑到接近 `doc-19 §3.3` 的「物理骰子」。

---

## 5. 未通过项 / 不能核验项

| # | 项 | 状态 | 为什么不能核验 / 未通过 |
|---|---|---|---|
| U1 | **`02 §11.1–11.5` 的内容** | **未通过（交付缺陷）** | 五节标题存在、正文为空（`02:511-524`，实读确认）。评审无法判断 `forged` 缺位、`docs/tools/07 §6.2` 不符、`DiceRoller` 常量导出、失败可见性归属、`doc-09` 待设计 #4 这五条**是否成立**。**必须在门禁放行前补齐**。 |
| U2 | **契约 §3.1 spike 1–3 的原始输出** | **不能核验（信任声明）** | 契约 §3.1 声明「三处 spike 实测，2026-09-12」，但 spike 脚本 `tools/probe-writer.mjs` 的**输出未落盘**（仓库内无 artifact）。我**独立复核了 spike 的每一个静态前提**（R2/R3，全部成立：`json-event.js:1-13` 剥 `partial`、`types.d.ts:425-437` 的 delta 无 name、`agent-loop.js:216-229` 原样转发），故**结论可信**；但「实测输出」本身不可复现。建议实现时把 spike 输出写进 `apps/server/test/chalk-delta.test.mjs` 的夹具。 |
| U3 | **`toolcall_end.toolCall.id` 与 `tool_execution_start.toolCallId` 一致** | **不能核验（需实现期实测）** | 见 R4。类型上两者都是 `string`，但「同一值」是跨层的运行时属性；`01 §3.2` 的 `writer_delta.toolCallId` 归属与 `chalk_landed` 的过户**全靠它**。建议进门禁：一条端到端用例断言 `writer_delta.toolCallId === tool_end.toolCallId`（同一 turn）。 |
| U4 | **`05 §10.2` 判据 (c) 的「DevTools 动态 import `/src/...tsx` 注入帧」** | **不能核验** | `05:555` 给了一条绕过 WS 的注入法（Vite dev 的动态 import）。它**依赖 Vite 的 dev 转译**，我无法在不启动前端的情况下验证；且它**绕过了 `useWorld` 的 `case`**，所以**不能用它证明「接线」**（只能证明渲染）。建议：把它标为「渲染验收」，并把「接线验收」留给真 WS 帧。 |
| U5 | **`02 §10.2 判据 A` 的 crit 复现概率** | **不能核验（概率事件）** | 它建议「掷 `[100]`（约 1%）可多试或用 `2d6` 观察 `[6,6]` 的 ~2.8%」。但工具路径**不接受 `forcedResult`**（`extensions/toolkit/roll-dice.ts:47-53` 只发 `{path}`，`roll-dice.ts:104-105` 的 `forged` 要求 actor `god`）⇒ **演示时无法强制 crit**。这是 `02` 的验收判据与引擎能力的**事实落差**，建议列入 `02 §12`。 |
| U6 | **`05 §3.4` 的 `cardEl` 能定位到「不在当前层的卡」吗** | **部分不能核验** | `05 §3.4` 的表把「`target` 卡不在当前层 DOM」定为「不演 + warn」。但**当前层的卡也不一定在 DOM 里**：`items.map` 全量渲染（`Canvas.tsx:482-495`），故当前层的卡都在；`scene` README 不在 `items`（`routes/world.ts` 的 scene 单独返回）→ `cardEl` 对 scene 返回 `null`。设计没区分「不在当前层」与「是 scene」。**登记**（P2）。 |
| U7 | **`04 §10.2` 判据 1'（静态核验 `case 'canvas_patched'` 内无 `fetchLayer`）** | **通过，但脆弱** | `04 §10.2:432` 用 `grep -A 25 "case 'canvas_patched'"` 做静态核验——`case` 块一旦超过 25 行就漏检。建议改成「`useWorld.ts` 的 `case 'canvas_patched'` 块内 `grep fetchLayer` 零命中」（用块边界而非固定行数）。 |
| U8 | **整批对「声音」的覆盖** | **未通过（见 §4.4）** | `doc-19 §2` 定为第一要素、`前端改造计划 T2.1` 定为 P0；本批 `00/01/03/04/05` 零音频落点。这不是「不能核验」，是**需求强度未达标**，单列于此以示其在门禁中的权重。 |
| U9 | **`docs/perform/06` 的回写清单完整性** | **未通过（部分）** | `06` 漏了：`05 §11.7`（`docs/tools/10 §10.3` 手测缺 5 种）、`B9`（`docs/tools/10:543` 与 `05 §3.5` 相反）、`U5`（强制 crit 不可行）。 |

---

## 6. 放行条件（给主 agent 的最小 checklist）

**必须先做（阻断）**
1. 契约 §8 补 `phantom.ts` 的 `label?`/`elapsedMs?`/`layer?`，并冻结 `PhantomLayer` 的 **props**（B1 + B10）；广播给 `01`/`03`。
2. `02 §11.1–11.5` 补齐正文（U1）。
3. `05` 拍板 B2（丝线坐标层）、B3（挂点）、B4（`origin` 格式）；`03`+`01` 同回合裁决 B5（`reused` 短路）。
4. B6（`chalk_landed` 的 `toolCallId`）、B7（跨层撤回）、B8（`appendInk` 先于 `register` 的行为）、B9（`show_frame` 重叠语义）各给一句冻结裁决。

**建议本批做（否则「够味」不达标）**
5. `chalk_writing` 的笔尖三拍（§4.2）。
6. `show`/`chalk` 的音频落点（§4.4 第 1 条）。
7. `image_generation_progress` 的心跳 10s→3s。

**可延后（登记即可）**
8. A8/A27/A29/A30/A36/A38–A44 的 `[推断]` 常量与落点选择；U3/U4/U5/U6/U7 的验收判据细化。

**给 `06` 的追加回写项**
9. `docs/tools/10 §10.3` 判据 4（与 `05 §3.5` 相反，B9）；`docs/tools/10 §10.3` 手测清单补 5 种（`05 §11.7`）；`docs/tools/10 §14.3:733` 补 `origin` 格式（B4）；`docs/tools/11 §3.3`/`:644` 的 `reused` 措辞（B5）；`docs/tools/11 §6.2` 的 `stage` 两档（`03 §11.6`）；`docs/tools/12 §6.2` 的 `show_frame` 行补 4 字段（`05 §11.1`）；`docs/tools/09 §6.3` 补「`card_position` 收敛到 `mergeItemPatch`」（`04 §11.2`）。

---

## 附：本报告的证据来源（实读清单）

- 源码：`apps/server/src/engine/event-bridge.ts`（全文）、`apps/web/src/state/useWorld.ts:100-403`、`apps/web/src/components/canvas/Canvas.tsx`（结构 + `:135-155/:466-509`）、`apps/web/src/components/canvas/ParticleLayer.tsx:60-105`、`apps/web/src/components/canvas/LinkLayer.tsx:30-50`、`apps/web/src/components/narrative/DiceRoller.tsx:10-30/339`、`apps/web/src/lib/md.ts`（全文）、`apps/web/src/lib/seat.ts:1-65`、`apps/web/src/lib/audio.ts:20-40/696-707/830-851`、`apps/web/src/state/useCamera.ts:120-160`、`apps/web/src/components/chrome/WriterBar.tsx:1-60`、`apps/web/src/index.css`（`:234-274/:681-745/:800-830`）、`apps/web/src/main.tsx`、`packages/shared/src/components/performances.ts:1-110`、`packages/shared/src/actions/show.ts:47-48/95-97/155`、`packages/shared/src/actions/canvas.ts:25-50`、`packages/shared/src/schemas/canvas.ts:50-75`、`packages/shared/src/rules/dice.ts:238-258`、`packages/shared/src/actions/generate-image.ts:330-367`、`packages/shared/src/store/local-store.ts:540-575/1009/1057-1069`、`apps/server/src/routes/world.ts:495-505/610-640`、`apps/server/test/map-engine-event.test.mjs:208-230`、`extensions/instructions.ts:74-79/168-176`、`extensions/toolkit/chalk.ts:35-80`、`extensions/toolkit/generate-image.ts:70-100`、`extensions/toolkit/roll-dice.ts`、`extensions/toolkit/link.ts:20-90`。
- vendor：`vendor/pi-rp/packages/coding-agent/dist/modes/json-event.js:1-13`、`modes/rpc/rpc-mode.js:17/386`、`packages/ai/dist/types.d.ts:246-254/425-448`、`packages/agent/dist/agent-loop.js:205-235`。
- 工具：`tools/check-ws-contract.mjs`（`:30-140/:185-250` 实跑 `--json`）、`tools/probe-provider.ts:50-75`。
- 文档：`docs/perform/00`–`06`（全文）、`docs/doc-19`（全文）、`docs/前端改造计划.md:201-380/426-460`、`docs/doc-06-演出与交互设计.md:1-120`、`docs/doc-03-文案语言.md:69/160`、`docs/tools/09-link与arrange.md:513/598-615/800`、`docs/tools/10-组件注册表与get-component-show.md:150-160/225/347-360/538-546/727-735`、`docs/tools/12-工具注册与路由统一.md:320-330/565-610`、`docs/后端实现计划.md:205-215`、`docs/wiring/00-共同上下文.md:28-36`。
