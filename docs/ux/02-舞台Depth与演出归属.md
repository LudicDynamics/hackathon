# A02：舞台 Depth 与演出归属

> Module owner：`UXTheatreDepth02`；本篇只拥有 Theatre Depth 与演出 surface owner，不拥有 Chrome 状态机、layout geometry 或动作结果。
> 状态：**核心已落地 / 部分接线 / 仍有缺口**（2026-09-14）。Depth surface registry、Particle ambient/burst 分面、PerformanceLayer 生命周期与 overlay admission 已有代码和聚焦测试；全量 marker/数字声明迁移、Nook 演出层和浏览器覆盖仍未闭环。
> 适用范围：`background / stage / entity / performance / chrome / dialogue` 的语义 Depth、Canvas 内外的 stacking context、幻影与演出归属、角色对话特写和骰子仪式。  
> 本篇不改 `flowColumns`、footprint、phantom seat 形状，不设计 Chrome 状态机，不实现代码。

### 当前状态

#### 已落地

| 范围 | 当前实现与证据 | 验收证据 |
|---|---|---|
| Depth registry / surface class | `apps/web/src/lib/depth-surface.ts:1-63` 提供受限 surface kind、token、class 与顺序；`apps/web/src/index.css:49-87`、`apps/web/src/scene-shell.css:5-17` 提供注册值与局部别名。 | `apps/web/test/depth-surface.test.mjs:24-70` 覆盖 kind、单调顺序与 CSS registry 消费。 |
| Particle owner 分面 | `apps/web/src/components/canvas/ParticleLayer.tsx:191-197,253-375,377-390` 将 ambient/burst 分开并按 Effects/hidden/reduced 停止 rAF。 | `apps/web/test/depth-performance.test.mjs:8-24` 覆盖两个 surface、单 canvas 与生命周期门禁。 |
| show 生命周期 / admission | `apps/web/src/components/performance/PerformanceLayer.tsx:422-493,520-577` 统一分发、资源接管、清理并接收 hidden/effects/reduced/admission；`apps/web/src/lib/overlay-admission.ts:21-75` 负责冲突拒绝。 | `apps/web/test/depth-performance.test.mjs:26-39`、`apps/web/test/overlay-admission.test.mjs:38-80` 覆盖接缝与幂等释放。 |

#### 已实现，待运行时矩阵收口

| 已实现范围 | 当前实现与下一步运行时证据 |
|---|---|
| 静态 checker 与 depth marker | `tools/ux-contract.json:159-171` 和 `tools/check-ux-contract.mjs` 已扩展为同一 checker 的 visual-literal/depth/projection 规则；当前 `pnpm check:ux` 通过 18 rules。运行时 marker 仍由浏览器矩阵补证，不把静态 clean 当成运行时证明。 |
| App/Canvas marker 覆盖边界 | App layer/Nook 分支互斥，`App.tsx:1208-1212`、`NookView.tsx:491-499` 各自仅在所属 stage 提供 active marker；CharacterModal 按 15 §10.4 为 overlay-only，底层 `aria-hidden/inert`，不新增第三 marker。Chromium 已验证 layer 单 marker/单 Canvas，并完成 layer→Nook→Escape→layer 回放；dialogue marker 仍需专门回放。 |
| Nook PerformanceLayer | `App.tsx:1265-1273` 在 `.prototype-world` 内 stable sibling 挂载唯一 `PerformanceLayer`；`PerformanceLayer.tsx:547-585` 绑定唯一 show listener/liveCtx、projection replacement 与卸载清理，Nook 不复制 WS/演出 owner。 |
| dialogue 内 Escape 归属 | `App.tsx:700-733` 使用统一 document-capture router；Declared/Photo/Gate 通过 FocusSurface lease 接入，Gate 由 App 装配，局部组件不再拥有独立的全局 Escape 真相。 |


## 1. 一句话定位

**Depth 是舞台注意力的语义合同：背景提供空气，stage 承载空间，entity 承载事实，performance 改变注意力，Chrome 承载操作，dialogue 把玩家推近角色；任何数字 z-index 都只能是这个合同在所属 stacking context 内的实现。**

退出一个深度后，玩家必须仍能辨认同一张画布、同一相机和同一事实状态；只有临时演出 DOM 被清理，不能把演出当作世界数据。

## 2. 权威文档与术语边界

本篇按以下顺序裁决：

1. `docs/ux/00-共同上下文.md §2–§4`：本批跨 Module 契约、Depth 六类、动作结果先于演出、一个 active projection、单一公开 Agent frame 消费路径；
2. `docs/layout/00-共同上下文.md §4–§6`：`flowColumns` 只产生 `x/y/w/h`，真实 `cards` 坐标/footprint 与 phantom 过户；
3. `docs/perform/00-共同上下文.md §4–§8`：帧载荷、`phantom.ts`、`PerformanceLayer`、`show_frame`、`writer_delta` 来源和顺序；
4. `docs/nook/00-共同上下文.md`：Nook 是 active projection，不是本篇另造的第七种深度；
5. `docs/doc-06-演出与交互设计.md §1.5、§2、§3` 与 `docs/doc-04-视觉设计风格.md §10`：连续性、追光、纸面和材料语法；
6. 当前源码仅作为现状证据，不能推翻以上冻结合同（`docs/ux/00-共同上下文.md §2`）。

### 2.1 本篇使用的 Module / Interface / Implementation / Depth / Seam / Adapter / Leverage / Locality

| 术语 | A02 口径 |
|---|---|
| Module | 一个拥有渲染或事件归属的单元，如 `Canvas`、`PhantomLayer`、`PerformanceLayer`、`CharacterModal`。 |
| Interface | Module 之间可观察的 DOM、帧或注册表接缝；不在本篇重新定义跨批字段。 |
| Implementation | CSS `position`、`z-index`、transform 和 DOM 顺序；数字不是语义。 |
| Depth | 六类舞台关系，不等于数据库 `cards.z` 或 phantom `seat.z`。 |
| Seam | 事实与投影交接处：`file_changed → fetchLayer`、`chalk_landed`、`image_landed`、`show_frame`、角色关闭。 |
| Adapter | 将世界坐标、相机、实体 DOM 或帧映射到当前舞台；例如 `phantomSeatFor`、`show-geometry`。 |
| Leverage | 复用现有唯一入口，而不是并行监听或并行排版：`useWorld`、`phantom.ts`、`PerformanceLayer`、共享 `useCamera`。 |
| Locality | z-index 只在明确的 stacking context 内有意义；跨 context 必须由父层语义解决，不能靠把子元素数字加大。 |

## 3. 现状盘点：DOM 落点与 stacking context

### 3.1 Canvas 的真实树

`App.tsx:546-584` 在 `.prototype-world` 内挂载 `Canvas`；`Canvas.tsx:517-584` 的根视口同时接收 pointer/wheel/drop，inline `perspective: '1200px'`，并按以下 DOM 顺序渲染：

1. `SceneBackdrop`：根视口的第一个子节点，`SceneBackdrop.tsx:69-101`；
2. `camera.worldRef` 的世界 transform 层：`Canvas.tsx:536-578`，内含 `LinkLayer`、`CanvasGrid`、真实 `CanvasObject`、初始化 ghost 和 `PhantomLayer`；
3. `ParticleLayer`：`Canvas.tsx:580-584`，是根视口的后置兄弟；
4. `PerformanceLayer` 不在 `Canvas` 内，而在 `App.tsx:581-584` 与 `Canvas` 同属 `.prototype-world` 的后置兄弟；
5. `.prototype-vignette` 在 `App.tsx:585`，位于 PerformanceLayer 后面、Chrome 前面。

`useCamera.ts:119-145` 每帧直接给 `worldRef` 写 `transform`。`transform` 会建立新的 stacking context，因此 `worldRef` 内的所有 `item.z`、`seat.z` 或 hover 提升都不能越过其兄弟 `ParticleLayer`、`PerformanceLayer`。这是 Locality 的关键：`.object` 的 `z-index:1000` 不等于全屏层的 `z=1000`。

### 3.2 现有关键 z-index 与落点

| 现状落点 | DOM / CSS 证据 | 当前值或形式 | 当前 stacking 事实 | A02 语义归属 |
|---|---|---:|---|---|
| 场景背景 | `Canvas.tsx:530-531`、`index.css:1384-1392` | `.scene-backdrop z-index:0` | Canvas 根内的背景 sibling，`pointer-events:none` | `background` |
| 世界纸面与线 | `Canvas.tsx:536-540`、`LinkLayer`/`CanvasGrid` | auto（在 transformed world 内） | 与卡片同在 `worldRef` context | `stage` |
| 真实实体 | `CanvasObject.tsx:160-170` | `item.z` inline；reading 时 `100` | `worldRef` context；服务端行值/会话 lift 影响顺序 | `entity` |
| 普通 hover | `index.css:123-127` | `30 !important`；`scene-shell.css:44` 又为 `1000 !important` | 只能提升当前 world context 内的实体 | `entity` 的 focus 子态 |
| 拖动实体 | `index.css:135-140`、`scene-shell.css:118-120` | `40 !important`，最终 shell 为 `1001 !important` | 仍不能越过 world context | `entity` 的 drag 子态 |
| 实体内 README 详情 | `index.css:1033-1061` | `.gate__detail z-index:20` | 受实体 shell context 约束 | `entity` 的 inspect 子态 |
| 初始化 ghost | `Canvas.tsx:558-576` | `ghost.z` inline | world context；不进 `itemsByPath` 与 drag | `performance` 的临时 projection（不是实体） |
| phantom / GhostCard / ChalkMark | `PhantomLayer.tsx:74-85` | `p.seat.z` inline | world context；`.object--ghost` 必须 `pointer-events:none` | `performance` 的临时 projection |
| 环境粒子与 fireworks 共用 canvas | `ParticleLayer.tsx:332-336` | `z-10` | Canvas 根的后置 sibling；不是 world context 子节点 | `background`（ambient）+ `performance`（burst）双语义冲突，见 §11 |
| grain | `index.css:197-205` | `body:before z-index:10` | 根级 fixed pseudo；注释声称覆盖 canvas/card、低于 modal/toast | `background` 的材质纹理 |
| PerformanceLayer | `PerformanceLayer.tsx:493-529`、`index.css:2011-2017` | `.show-root z-index:20` | `.prototype-world` 内的后置 overlay，`pointer-events:none` | `performance` |
| show 追光/压暗 | `index.css:2023-2056` | show-root 内 auto | 同一 show context；`show-dim`、`show-beam`、`show-focus-lift` 不可越出 root | `performance` |
| show 证据线 | `index.css:2060-2074`、`PerformanceLayer.tsx:247-280` | show-root 内 auto | 使用世界 transform 的 SVG，不进入 `LinkLayer.registry` | `performance` |
| show caption | `index.css:2076-2092` | show-root 内 auto | 与 veil 同 context | `performance` |
| 世界标题/header | `App.tsx:587-604`、`prototype.css:219-232` | `z-index:31` | `.prototype-world` 层内 Chrome；header 默认静态/隐藏切换 | `chrome` |
| 工具/手牌/dock/角色/背包 | `App.tsx:621-711`、`prototype.css:358-473`、`scene-shell.css:88-113` | `32/33/35/36/38` | 同一 `.prototype-world` Chrome context | `chrome` |
| authoring / edge / profile | `App.tsx:664-718`、`prototype.css:564-610` | `44/46/48` | 同一 Chrome context；profile 只在条件成立时存在 | `chrome` |
| world shelf | `App.tsx:723-726`、`prototype.css:135-149` | `z-index:90`，fixed | 根级 fixed overlay；当前没有 `aria-modal=true`（`WorldShelf.tsx:33` 为 false） | `chrome` 的 blocking dialog |
| carried item reader | `App.tsx:728`、`BagItemDialog.tsx:31`、`prop-card.css:16-17` | fixed `z-index:90`（inline reader 为 absolute） | fixed reader 跨出 entity context；inline reader 留在实体内部 | `chrome` / `entity.inspect` |
| RadialMenu | `App.tsx:730`、`RadialMenu.tsx:116-147` | fixed `z-50` | 根级 pointer-blocking menu；与 CharacterModal/Dice 同数值 | `chrome` 的 action menu |
| CharacterModal | `App.tsx:732-756`、`CharacterModal.tsx:708-798`、`index.css:332-340` | fixed `z-index:50` | 根级 fixed；`backdrop-filter` 作用于其下方已绘制舞台 | `dialogue` |
| modal 内 portrait / speech / close | `index.css:359-367`、`:464-478`、`:655-675` | `1/2/60` | modal 自身 context 内；close 只需盖过 modal 内容 | `dialogue` 的内部层次 |
| DiceRoller / DiceCeremony | `DiceRoller.tsx:341-345`、`DiceCeremony.tsx:91-150` | fixed `z-50`；fumble `.fumble-crack z55` | 根级；与 CharacterModal 同值时按 DOM 后者胜出 | `performance` 的 blocking ceremony，需修订优先级 |
| Nook | `App.tsx:758`、`scene-shell.css:179` | fixed `z-index:800` | 根级独立 projection；不能用本篇数字解释 active projection | 由 Nook 契约拥有；不另造 Depth |
| loading | `App.tsx:723`、`prototype.css:174` | fixed `z-index:1100` | 根级阻断层 | `chrome` 的系统阻断态 |
| agent settings | `TtsSettings.tsx:28-30`、`prototype.css:177` | panel `z-index:1200` | header 内 positioned child；相对根级 overlay 的实际次序需浏览器验收 | `chrome` 的局部 dialog |
| toast / stop | `App.tsx:688-690,765`、`prototype.css:682-700`、`scene-shell.css:185-186` | toast `100`；stop `120` | 根级 fixed，非阻断（stop 可操作） | `chrome` 的回执/行动控制 |

### 3.3 已确认的 context 风险

- `.object` 的超大数字只能在 `worldRef` 内排序；不能解决 show、Chrome、dialogue 的覆盖。这正是 `useCamera.ts:121-145` 的 transform 与 `Canvas.tsx:536` 的单 transform 层共同造成的 Locality。
- `body:before z10` 和 `ParticleLayer z10` 都是根/Canvas 后置层；两者数值相同但父 context 不同。当前 CSS 注释（`index.css:190-195`）把 grain 说成覆盖卡片而低于 modal/toast，却没有可机械验证的父层合同。
- `PerformanceLayer` 的 `z20` 只保证它在 `.prototype-world` sibling 顺序中位于 canvas world 的上方；Chrome 子级 `31+` 目前高于 show，符合“演出不夺取操作 Chrome”，但 `body:before` 是否覆盖 show 不能从数字直接推出。
- fixed modal、fixed dice、fixed radial 处在同一个根 context；同值时 DOM 后出现者胜出，不是语义裁决。当前 App 中 CharacterModal 在 RadialMenu 后、DiceCeremony 在 CharacterModal 后（`App.tsx:730-763`）。
- `backdrop-filter`、`transform`、`perspective` 都会改变绘制边界；不能用一张“全局 z 数字表”替代 context 矩阵。

### 3.4 现状差异与剩余认领

| 目标合同 | 当前实现 | 差异与影响 |
|---|---|---|
| 六类 Depth 由 registry 统一映射，跨 context 的父层先于子层裁决 | `depth-surface.ts` 与 root aliases 已落地（§当前状态）；但 `apps/web/src/prototype.css:75-76,165-166`、组件 Tailwind/inline 仍有数字声明 | registry 已成为主要接缝，剩余声明与父 context 需要 checker + 浏览器核对，当前数字仍不可单独当统一语义。 |
| ambient 属 background，fireworks 属 performance，二者可独立验收 | `ParticleLayer.tsx:191-197,253-375,377-390` 已拆 ambient/burst surface，共享一个 Module 与 canvas | 分面与生命周期已落地；Nook 未挂 PerformanceLayer，Nook 演出仍不完整（见当前状态表）。 |
| dialogue 永远高于 blocking performance，overlay admission 明确裁决 | `overlay-admission.ts:21-75` 已提供 dialogue/radial/dice admission；`App.tsx:1149-1179` 的 DOM 顺序仍只是实现事实 | 入口接缝已落地，但组件直接挂载/固定 Tailwind z 仍需浏览器 adversarial 验收。 |
| grain 归 background，且不压正文 | `apps/web/src/index.css:258-267` 仍是根级 `body:before`，Particle 也有 background surface | 父 stacking context 及正文覆盖关系尚未由静态 checker 完整证明，需 computed style + screenshot。 |
| dialogue 进入时底层 Canvas 必须 inert、只保留一个 focus projection | `apps/web/src/App.tsx:884-888` 在 active character 时把 layer wrapper 设 `aria-hidden/inert`；CharacterModal 在 `:784-791` 提供 dialog | 底层可达性已接线；projection marker 的覆盖边界仍需浏览器核验，不能用 inert 代替 active marker。 |
| 玩家与 writer 的骰子必须共享 `DiceCeremonyInput`，且只演一套 ceremony | `DiceRoller.tsx:53-74` 在 HTTP 2xx 后 `ingestPlayerRoll`；`dice-ceremony.ts:203-247` 统一 player/writer input；App `:427-460` 过滤 WS | 输入归一化与 authority gate 已落地，仍需真实浏览器两来源回放证明不重复播放。 |

以上是代码与目标的差异登记，不是对上位契约的改写；未标 `[推断]` 的行均由当前文件/符号直接观察得到。

## 4. 冻结的 Depth 词汇与实现边界

### 4.1 六类语义顺序

在同一舞台 projection 内，语义顺序固定为：

`background < stage < entity < performance < chrome < dialogue`

这不是要求所有元素使用连续数字，而是要求跨 Module 的覆盖关系稳定。实现时使用登记的 Depth token（名称为 `background / stage / entity / performance / chrome / dialogue`）和每类内部的有限子层；禁止直接添加未登记的 literal `z-index`。

建议的实现带（NEW，数值仅用于机械检查，不能让子 context 越级）：

| Depth token | 语义带 | 允许的局部子层 | 覆盖原则 |
|---|---:|---|---|
| `background` | 0–9 | material、scene image、ambient grain/particles | 不拦 pointer，不压过实体文字。 |
| `stage` | 10–19 | canvas paper、grid、relationship lines | 承载相机和空间底座，不拥有动作。 |
| `entity` | 20–29 | base、inspect、focus、drag | 真实实体顺序来自 `item.z`；局部提升不能穿过 performance。 |
| `performance` | 30–39 | phantom、veil、beam、ceremony、caption | 临时、可取消、无事实写入；不拦 pointer 的 show 不得变成 action target。 |
| `chrome` | 40–49 | navigation、action、status、blocking dialog | Chrome 可覆盖 performance，承担用户操作和失败文案。 |
| `dialogue` | 50–59 | dim backdrop、portrait、speech、close | 对话是注意力最高层；退出后回到同一 world projection。 |

`system-blocking`（加载等）不是第七个 Depth：它是 `chrome` 的阻断子层，必须在 chrome token registry 中登记。Nook 的 `z800` 不是本篇的 Depth 语义；它是 `docs/nook/00` 所有的 active projection 接缝，不能通过“比 dialogue 更大”来偷换职责。

骰子仪式是 `performance` 的一个**根级阻断子层**：它 portal 到 `<body>`，所以要登记的是一枚独立语义 token `--depth-performance-ceremony`（在 `apps/web/src/index.css` 的 root registry），而不是就地写数值偏移。它的语义是「盖过 `chrome` 的普通阻断对话框（板书里打开的声明动作对话框落在 `--depth-entity-reading`）但不越到 `dialogue`」——即 §6.2 的目标覆盖关系，数值带因此贴近 `chrome` 上沿而仍低于 `dialogue`。

### 4.2 Depth ownership 矩阵

| 投影者 | Module / Interface | 拥有的 Depth | 不拥有的 Depth | Seam / Adapter |
|---|---|---|---|---|
| `SceneBackdrop` | `SceneBackdrop.tsx:32-101` | `background` 的材质、静态图、背景视频回退 | 不拥有相机、实体、Chrome、dialogue | `bg.src/video/tone/grain`；`subscribeParallax` 只驱动背景。 |
| `Canvas` + `CanvasGrid` + `LinkLayer` | `Canvas.tsx:517-540` | `stage` 的视口、网格、空间线和 camera framing | 不排版、不发演出、不拥有全局 Chrome | `useCamera` 单例；几何由 layout Adapter 消费。 |
| `CanvasObject` / `CardRenderer` | `CanvasObject.tsx:160-290`、`CardRenderer.tsx` | `entity` 的事实卡、阅读和实体互动 | 不拥有 phantom、show、dialogue 全屏层 | `item` 的服务端 row；appearance/footprint 归 components/layout。 |
| `phantom.ts` + `PhantomLayer` | `phantom.ts`、`PhantomLayer.tsx:38-87` | `performance` 的世界坐标临时投影 | 不拥有真实 `cards.z`、不拥有动作成功 | `phantomSeatFor` / `reconcileLanded`；真实重取赢。 |
| `PerformanceLayer` | `PerformanceLayer.tsx:398-529` | `performance` 的 `show_frame` 七类演出 | 不拥有持久事实、Link registry、writer source | `airp:show-frame` 唯一入口；`show-geometry` 只算视觉。 |
| ParticleLayer | `ParticleLayer.tsx:171-338` | 目标：一个 `ParticleLayer` Module 内登记两个独立渲染 surface：`ambient` surface 属 `background`，`burst` surface 属 `performance`；两者共享 resize/parallax Adapter，不共享 Depth | 不拥有动作反馈和世界事实 | ambient 受 Effects/visibility gating；`playBurst` 只写 burst surface；不得把两条 surface 再合并成一个不可分辨的 z。 |
| App Chrome | `App.tsx:587-718` | `chrome` 的导航、行动、状态、回执 | 不拥有 WS 帧归属或 dialogue phase | `useWorld` 提供事实；Chrome 状态机由 `03-Chrome与公开状态.md`。 |
| `CharacterModal` | `CharacterModal.tsx:708-798` | `dialogue` 的角色特写、语音页、玩家输入 | 不消费另一份 WS、不写 world layout | `CameraMemoryStack`（A05 §5）负责嵌套相机；字符帧按角色过滤。 |
| `DiceCeremony` | `DiceCeremony.tsx:34-152` | `performance` 的 blocking dice ceremony | 不拥有 `dialogue`、不改变 world | `RollDiceDetails` 与 `dice_result` 两个 Adapter → `DiceCeremonyInput`（`docs/ux/00 §4.6.2`）；目标卡只作高亮。 |
| Nook root | `App.tsx:758` / `NookView` | active projection 的切换接缝 | 不由 A02 定义新 Depth | 遵守 `docs/nook/00`、A05 的单 projection 和相机记忆。 |

### 4.3 `z-index` 机械登记规则

- `tools/ux-contract.json` 的 `depth` registry 是唯一登记源：每个根层只登记一个 Depth token：`SceneBackdrop`、Canvas root/world、ParticleLayer 的 `ambient`/`burst` surfaces、`PerformanceLayer`、App Chrome、dialogue overlay；
- 局部子层只能使用所属 token 的有限偏移，且必须写出 owner 和用途；
- 真实 `item.z`、phantom `seat.z`、session lift 是数据/临时排序值，不登记为全局 Depth；
- `tools/check-ux-contract.mjs` 扫描 `apps/web/src/**/*.{tsx,css}` 与 `apps/web/tailwind.config.js` 的 `z-index:`、Tailwind `z-*`、inline `zIndex`，每一处映射到 token 或明确的数据排序例外；
- 未登记项必须使统一检查失败，不能以“数值很大”“当前看起来没盖住”通过；
- 检查必须区分不同父 stacking context，不能把 context 内部 `z=1001` 与根级 `z=20` 直接比较；非空 fixture 至少包含 grain、ghost、dialogue+dice 和 Money Shot。
- 骰子仪式用登记 token `--depth-performance-ceremony`（owner：`DiceCeremony`），而不是 `calc(var(--depth-ui) + N)` 这类未登记表达式；该 token 的覆盖语义见 §6.2，契约扫描必须把它当作已登记项。

## 5. 行为顺序：进入、退出与相机连续性

### 5.1 普通世界进入（Canvas stage）

1. `useWorld` 成功得到当前层数据，`App.tsx:367-370` 派生 `canvasItems`；
2. `Canvas` 挂载背景、world transform、实体、phantom 和粒子；相机由 `useCamera` 的单例驱动；
3. `PerformanceLayer` 只消费同层 `show_frame`，不改变 `items`；
4. Chrome 在同一 `.prototype-world` 提供导航与动作入口。

**漏接后果：** 如果把演出 DOM 当实体插入 `items`，重新进层会出现 encore 或把临时内容写成事实；如果在 Canvas framing effect 里调用排版，会把视觉 Depth 与 layout 的 `x/y/w/h` 混为一谈。

### 5.2 角色对话进入 / 退出

1. Canvas 上的角色头像由 `CanvasObject` 的 `onOpenCharacterModal` 触发（`CanvasObject.tsx:261-262`）；角色头像单击即进入对话，门的双击进入保持分离（`docs/doc-06-演出与交互设计.md §3.1、§3.5`）。
2. `App.tsx:488-492` 先记录 encounter，再由 App-owned `CameraMemoryStack`（A05 `docs/ux/05-Nook投影与相机连续性.md §5`）为当前底层 projection push `dialogue:<characterId>:<callerSlot>`；清空旧 frame，再设置 `activeCharacter`。不得再调用固定的 `camera.save('dialogue')`，也不得先显示旧台词再换角色。
3. `App.tsx:732-756` 渲染 `CharacterModal`；modal 的 backdrop 只压暗/虚化已有画布，不卸载 Canvas，不重建 WS，不复制相机。A05 的 active marker 将底层 Canvas 标为 inert，dialogue 宿主获得 focus。
4. `CharacterModal.tsx:719-748` 渲染立绘，`:750-797` 渲染 speech paper；对话内 page 逐字、翻页和输入阶段均留在 dialogue projection。
5. 关闭时 `CharacterModal` 完成退出动画后调用 `onClose`；`App.tsx:513-517` 发送 `character_stop`、清掉 active character，再由 `CameraMemoryStack` pop 当前 dialogue frame、恢复其 `returnTo` 槽位。不得再调用固定的 `camera.restore('dialogue')`。

**漏接后果：** 进入前不 save 会导致退出回到错误视点；退出时先 restore 再清 modal 会短暂看到两个投影叠加；卸载 Canvas 会破坏“角色特写仍在同一舞台”的连续性；未清旧 frame 会把上一角色台词投进当前角色。

### 5.3 Nook / active projection 接缝

A02 不决定 Nook 的入口、取数、相机栈或拖卡通路。`NookView` 复用 `Canvas`（`NookView.tsx:379-452`），但同一时刻必须只有一个 projection 拥有 pointer focus，遵守 `docs/ux/00 §4.5`、`docs/nook/00` 与 A05 `docs/ux/05-Nook投影与相机连续性.md §4/§7` 的 active marker 口径。进入/退出时只允许 active projection Adapter 接管 Canvas；dialogue 进入后底层 Canvas 必须 inert，Nook 不另造 Canvas/WS；不得把 `z800` 解释成“永远盖过 dialogue 的优先级”。

**漏接后果：** Nook 和 layer 同时可点击会产生双重拖拽、双重相机或两个 footprint 回写；把 projection 切换伪装成 Depth 提升会使 Escape 与相机恢复不对称。

## 6. 演出覆盖规则

### 6.1 spotlight / lights_out

`show_frame` 只由 `PerformanceLayer` 的 `airp:show-frame` listener 消费（`PerformanceLayer.tsx:513-523`）。

行为顺序：

1. 帧先经过 `performShowFrame` 的 shape/type/component 防御（`PerformanceLayer.tsx:407-435`）；未知 component 静默跳过，不崩 WS。
2. `target` 据 `[data-path]` 找当前层实体；`spotlight` / `lights_out` 找不到 target 时不构造假的中心（`PerformanceLayer.tsx:150-220`）。
3. `show-geometry` 给出 dim/beam/focus 的纯计算；veil、beam、caption 都挂在 `.show-root`，不写 `canvas.db`。
4. 同资源 key 的 show 由新意图接管，不同资源并行（`PerformanceLayer.tsx:427-461`）；时长到期由 module store 清理（`:464-473`）。
5. layer 改变或 world freeze 时取消全部 active show（`PerformanceLayer.tsx:525-526`）。

Depth 规则：veil 和 beam 属于 `performance`，盖过 entity 但低于 chrome/dialogue；追光不能让 target 改写 `item.z`，只能改变视觉对比。`evidence_burst` 线只在 PerformanceLayer 自己的 SVG 演出，绝不进入 `LinkLayer.registry`，与 `docs/perform/00 §6` 一致。

**漏接后果：** 目标缺失仍强行居中会把玩家带到错误物件；show 成功后写 DB 会造成重进层重复；layer/freeze 不取消会把旧场景的追光留在新场景；veil 盖过 Stop writing 或 Escape 会造成“看得到但操作不到”。
### 6.1.1 Money Shot 固定 fixture（doc-19 §4.1）

这是 A02 的端到端强制 fixture，不是新的 `show_frame` 类型，也不改变 `ShowFrame` 字段。测试 fixture（NEW，测试数据名）由一个真实 target、至少一条持久 Chalk、**至少 4 条存在于当前 items/links 的有效有向证据线**、目标去向（既有 gate/enter 结果）以及两帧演出组成：`spotlight(target)` + `evidence_burst(target, links)`。`links` 不能为空，任何 endpoint 不存在都使 fixture 失败；不能让 renderer 因 optional links 静默跳过全部证据线。

**权威顺序：**

1. 先完成玩家/Agent 动作的权威结果，持久 Chalk 与目标去向先经文件/事件链落地；不能用 show 先宣称破案。
2. `show_frame` 到达唯一 `PerformanceLayer` dispatcher 后，`spotlight` 将非 target 画面压至 **15% 亮度**，target 中心显示暖金 beam；不得改 `item.z`、坐标或相机事实。
3. `evidence_burst` 使用 fixture 明确提供的有效 `links`，从真实卡片向 target 延展临时证据线；线只存在 PerformanceLayer 自有 SVG，`durationMs` 到期移除，不写 `canvas.db`/`LinkLayer.registry`。验收断言渲染线数等于有效 links 数，且至少为 4。
4. 同一 fixture 的音频 Adapter 必须在演出阶段发出**钟鸣**并切入已登记的 **Money Shot BGM（单簧管悬疑独奏）**，退出时按音频 owner 恢复原层主轨；不能由局部 click 猜测时机，也不能让音频脱离 `show_frame`。
5. fixture 结束后，只保留持久 Chalk、真实目标和可继续的既有去向；临时 veil/beam/lines、一次性钟鸣和 Money Shot BGM override 必须清理。
**状态验收：** 触发后 `activeShow()`（`PerformanceLayer.tsx:80-83`）必须同时可观察 `spotlight` 与 `evidence_burst` 的 active entries；`show-root` 中存在对应 veil/beam/**至少 4 条 thread**，且到 `durationMs` 后 active entries 与临时 DOM 均为空。与此同时，当前 `items` 仍含持久 Chalk，目标的既有 `onEnterGate`/去向不被 show 改写；截图须与 `audioDebugState` 的钟鸣/BGM 记录同一回放时间线。

**漏接后果：** 先演后落账会让“破案”在失败时仍出现；dim 不是 15% 或 beam 非暖金会使关键演示失去注意力锚点；证据线写入 registry 会污染真实关系；缺钟鸣/BGM 会变成只有视觉的假 Money Shot；清理不完整会让下一层继承旧灯光、音轨或线索。


### 6.2 Dice ceremony

玩家 HTTP 的 `RollDiceDetails` 与 writer 的 `dice_result` 是两个输入 Adapter，先按 `docs/ux/00-共同上下文.md §4.6.2` 归一化为同一个 `DiceCeremonyInput`（NEW，内部投影形状，非 HTTP/WS payload），再交给 `DiceCeremony`。不能让玩家 HTTP 路径伪造 WS，也不能为两种来源各播一套仪式。

行为顺序：

1. **玩家路径：** `DiceRoller` 收到 `/api/dice` 的 `RollDiceDetails` 后，只在 `result/passed/rolls/crit/fumble` 等权威字段完成边界检查并生成 `DiceCeremonyInput`；HTTP 响应本身就是结果，不等待 `dice_result`（`DiceRoller.tsx:28-36、51-67、341-397`）。
2. **writer 路径：** `useWorld` 的唯一 WS 入口转发 `dice_result`；`parseDiceFrame`/`shouldPlayFrame` 做 source、layer、字段和去重过滤后生成同一 `DiceCeremonyInput`。异层帧丢弃，不排队到下一层。
3. 两条 Adapter 的结果都必须先于 ceremony；`DiceCeremony` 只渲染归一化 verdict（`DiceCeremony.tsx:24-34`），不再次请求、掷骰或重算 expect。
4. `rolling` 播放低层的骰子过程和 `dice-roll` 音效（`DiceCeremony.tsx:45-55`）；Reduced motion 只缩短滚动，不删除结果信息。
5. `settled` 播放 `crit/fumble` 对应 stinger、对目标 `.object[data-path]` 做短暂高亮（`:57-75`）；HTTP 路径不因缺少 writer frame 而失去高亮或结算。
6. ceremony 定时关闭；不能因目标卡尚未重取而阻塞，也不能把缺失目标当成失败（`:63-70`）。关闭后由既有实体/回执展示结果，不能将 `chalk_landed`、`image_landed` 或 `seat.z` 当成骰子成功。

目标覆盖关系：dice 属于 `performance` 的阻断子层，视觉上可盖 entity 和普通 Chrome，但必须低于 `dialogue`；fumble crack 只盖 ceremony 自己的画面，不盖全局错误和停止入口。

**漏接后果：** 只接 `dice_result` 会让玩家真实 HTTP roll 没有统一 ceremony；只接 HTTP 会让 writer 演出缺席；两条路径各自播会重复音效/高亮；在权威结果之前播放通过语气会宣称未发生的事实；把 dice overlay 做成 entity child 会被相机 transform 过度缩放；目标缺失时等待会卡住整条动作回执。

### 6.3 Phantom 与 `show_frame` 的共存

- phantom 是 performance 的世界空间 projection；`PhantomLayer.tsx:19-21` 明确其 `left/top` 与 `.object` 同为 world pixels，`.object--ghost` 永远 `pointer-events:none`。
- phantom 的座位由 `phantomSeatFor` 这个 Adapter 消费共享 `flowColumns`；该函数现状仍给临时排序生成 `seat.z`（`phantom-seat.ts:42-72`），但此值只服务当前临时 DOM，不能解释为真实 card z。
- `writer_delta` 先于 `chalk_writing` 到达（`docs/perform/00 §5、§6b`）；`phantom.ts:128-138` 对未知 toolCallId 必须 pending，注册时灌入湿墨。不能因“phantom 还没挂载”丢字符。
- `chalk_landed` / `image_landed` 只做 seat handover；真实 `/layer` 重取赢，`reconcileLanded` 清理 phantom（`PhantomLayer.tsx:41-69`、`docs/layout/00 §6`）。
- show 的追光可照到 phantom，但不得把 phantom 的 `seat.z` 回写成实体 z，也不得让 show target 依赖一个已被 evict 的 phantom。

**漏接后果：** 给 ghost 加 pointer 会把临时 DOM 当成真实动作目标；落地重新排座会出现跳位；用 `chalk_landed` 当成功会在失败/取消时播放错误音效；只清 DOM 不清 registry 会在重进层复活 ghost。

### 6.4 writer delta 与公开回执

A02 只定义归属与覆盖，不重新定义帧形状：

1. 服务端 `writer_delta` 只能来自确认过的 chalk toolcall content，不能来自 writer `text_delta`（`docs/perform/00 §3、§3.2`）。
2. `useWorld` 是唯一 WS 消费点（`docs/perform/00 §2.2`）；writer delta 交给 `phantom.ts.appendInk(toolCallId, delta)`，不另开 CharacterModal/PerformanceLayer listener。
3. 湿墨渲染在 `PhantomLayer` 承载的 world-space shell 内，属于 performance，半透明但不拦 pointer；在 `chalk_writing` 前已到达的片段必须留在 pending。
4. `chalk_landed` 后等真实文件/row 接管；玩家可见的最终正文属于 entity，而非 performance。
5. `writer_idle` 后的公开 `WriterResult` 位于 `prototype-world-meta`（`App.tsx:613-619`，`scene-shell.css:182-184`），它是 chrome 回执，不能把过程 delta 再投影一次。

**漏接后果：** 从 `text_delta` 演湿墨会把作家过程语言当剧情；按 path 查找尚不存在的卡会静默漏字；把 writer result 置于 Canvas 中央会与正式 Chalk 重复；多个 listener 会让同一片 delta 重复写入。

## 7. Dialogue 覆盖与 modal 内部规则

### 7.1 覆盖顺序

目标合同是：

`background/stage/entity → performance → chrome → dialogue(backdrop → portrait → speech → close)`

CharacterModal 不能变成黑底新页面；其 `.character-modal-layer` 是对已有画布的压暗虚化（`index.css:329-340`）。portrait stage 与 speech paper 的内部 `z1/z2` 只在 modal context 内有效；`.modal-close` 的 `z60` 只需高于 speech/portrait，不能作为全局 Depth。

对话期间允许后方 world 继续演出（`docs/doc-06-演出与交互设计.md §3.4`）：PerformanceLayer、phantom 和真实重取可以发生，但 modal 遮罩让它们成为背景；退出后玩家主动观察其持久结果。

### 7.2 输入与退场

- `CharacterModal` 的 pointerdown 只负责音频解锁（`CharacterModal.tsx:455-463`），不把 modal 事件交给 Canvas drag dispatcher。
- `line-stage` 的点击/键盘推进只改变当前对话页；未出完快进，已出完翻页；所有页耗尽且演出终结前，speech input 不可用（`CharacterModal.tsx:705-706`、`:756-763`）。
- Escape/关闭按钮进入关闭动画；直到 `onClose` 后才恢复 camera 和停止角色。不能通过把 modal `display:none` 立即收掉来跳过终结或语音清理。

**漏接后果：** modal pointer 泄漏到 Canvas 会拖动背景；输入提前启用会把角色未说完的页截断；关闭先恢复相机会在动画期间产生跳屏；dialogue 的“退出”变成第二个页面返回会破坏 doc-06 的特写连续性。

### 7.3 Modal、Dice、Radial 的冲突优先级

目标语义优先级为：`dialogue > blocking dice performance > action menu > ordinary chrome`。实现不能靠同值 z 和 DOM 偶然顺序表达；必须在 overlay admission seam 处拒绝或排队不兼容的 blocking projection，并让玩家看到取消/等待文案。A02 不定义 Chrome 状态机，但要求 `03-Chrome与公开状态.md` 认领该接缝。

- 已打开 dialogue 时，底层新的 dice/radial 请求由 A03 `OverlayAdmission` 拒绝并显示 notice；本批不在 dialogue 内排队或转换，关闭 dialogue 后玩家重新发起动作。
- RadialMenu 只能在无 dialogue、无 blocking ceremony 的场景打开；它本身是 action chrome，不可盖住角色台词或骰子结果。
- `toast`、Stop writing 和错误文案不得被 veil、fumble 或 radial backdrop 物理遮挡；它们的可见性由 chrome owner 保证。

## 8. Geometry 与 Depth 的分离

这是 A02 与 layout 的硬边界：

- `flowColumns` 的 `AutoLayoutBox` / `AutoLayoutRect` / `FlowLayoutResult` 只含 `id、w、h、order` 与 `x/y/w/h`（`packages/shared/src/layout/flow-columns.ts:1-29、152-171`）；它不产生视觉 Depth、相机、Chrome 排布或演出语义。
- 服务端 `cards.z` 是真实卡片的持久渲染顺序；`CanvasObject` 读取 `item.z`（`CanvasObject.tsx:160-170`）。A02 不能修改这个字段、`footprint` 或 `flowColumns`。
- `phantomSeatFor` 的 `seat.z` 仅是当前 phantom projection 的临时 DOM 顺序（`phantom-seat.ts:68-72`）；它不代表真实 card z，不得写回数据库，不得被 `show_frame` 当 target priority。
- 几何接缝只传 `x/y/w/h` 与已有 seat Adapter；Depth 接缝只传语义 owner/context。两者可以在 PhantomLayer 汇合渲染，但不能互相扩字段。
- 相机只由 App-owned `CameraMemoryStack`（UX05）编排 `useCamera` 的 module-level driver；`PerformanceLayer` 的 `camera_focus` 可以调用 `flyTo`，但不能另建 camera 或以 z-index 模拟飞行；CharacterModal 通过 caller-scoped stack transaction 进入/退出。
- 视觉验收应分别证明：几何无重叠/落地不跳位（layout tests）与 Depth 覆盖正确（browser screenshots/replay）。不能用“截图看起来没重叠”替代 layout 断言。

**漏接后果：** 把 z 写入 flow result 会产生第三套排版真相；用 footprint h 计算视觉 Depth 会让长 Chalk 被遮住；用 z-index 代替 camera focus 会破坏 pointer→world 映射；把 phantom 当真实卡会在刷新后留下幽灵排序。

## 9. 代码落点与副作用边界

| 目标 | 精确落点 | 设计职责 | 不允许的副作用 |
|---|---|---|---|
| Depth token/registry | `tools/ux-contract.json` 的 `depth`、`apps/web/src/index.css`、`prototype.css`、`scene-shell.css` | 把六类 token、根 context 与 surface owner 登记起来 | 不在实体 Module 里散落新的 literal z；不改 appearance ID |
| Canvas root/context | `apps/web/src/components/canvas/Canvas.tsx:517-584` | 明确 Canvas、world transform、Particle 的父层关系 | 不在 framing/pointermove 里排版或写 DB。 |
| World transform | `apps/web/src/state/useCamera.ts:119-145`、`apps/web/src/lib/camera.ts:78-81` | 保持单 transform 与 camera 连续性 | 不开第二个相机、不把 z 当相机。 |
| Entity focus | `CanvasObject.tsx:160-170、204-216、249-290`；`index.css`/`scene-shell.css` entity 规则 | focus/drag/inspect 只在 entity context 升层 | 不让 `.object` 穿越 performance/chrome/dialogue。 |
| Phantom | `apps/web/src/lib/phantom.ts`、`phantom-seat.ts:42-72`、`PhantomLayer.tsx:38-87` | 唯一临时投影与 seat handover | 不接 pointer、不写真实 z、不另开 registry。 |
| Show | `PerformanceLayer.tsx:398-529`、`show-geometry.ts`、`index.css:2004-2138` | `show_frame` 分发、资源覆盖、清理、追光 | 不写事实、不写 Link registry、不新增 WS。 |
| Dialogue | `App.tsx:488-516、732-756`、`CharacterModal.tsx:708-798`、`index.css:329-681` | 同一画布上的特写、回相机、页和输入 | 不卸 Canvas、不新建 WS、不自判 character frame phase。 |
| Dice | `useWorld` 的既有 `dice_result` case、`DiceCeremony.tsx:34-152`、`index.css:683-817` | 结果后的临时仪式与目标高亮 | 不把 landing/seat transfer 当成功，不盖 dialogue。 |
| Chrome seam | `App.tsx:587-718、723-730、765`、`03-Chrome与公开状态.md` | navigation/action/status/错误可见性 | A02 不重写 attention/writer busy 状态机。 |
### 9.1 文件、落账与 WS 消费边界

A02 不新增数据文件、事件 `type`、WS 帧名或持久字段。文件真相、动作写入和事件落账继续由现有动作层负责；本篇只规定这些事实如何被投影到 Depth：

- `PerformanceLayer` 的 `show_frame` 是瞬时 DOM，不能写 `canvas.db`、`cards` 或 `LinkLayer.registry`；时长结束必须清理（`PerformanceLayer.tsx:398-475`）。
- `phantom.ts` 是模块态临时注册表，不是世界真相；`chalk_landed` / `image_landed` 后由 `file_changed → fetchLayer` 的真实数据接管，phantom 被 reconcile/evict（`docs/perform/00 §5–§6b`）。
- `writer_delta`、`chalk_writing`、`dice_result`、`show_frame`、角色帧只经 `useWorld` 的唯一 WS 消费路径分发；A02 不允许 CharacterModal、Chrome 或 PerformanceLayer 各自创建 WS 或直接猜 phase。
- `CharacterModal` 的 `character_stop` 是现有关闭接缝（`App.tsx:513-517`），不因 Depth 设计新增“关闭成功”事件；对话文本和语音页仍是既有角色投影。
- Depth registry/checker 是实现期开发工具输出，不写入世界文件、`cards.metadata` 或玩家可见正文；失败应阻断实现验收并给出 file/symbol/context。

**漏接后果：** 把演出写入持久层会在重进时复活临时内容；新增第二个 WS 会重复消费帧；把 registry 诊断写进世界文件会污染文件即真相源；把关闭动作误报成成功事件会让动作/演出顺序倒置。


## 10. 错误边界与失败可见性

1. **未知 show component：** `performShowFrame` 静默跳过坏帧；非空未知值可开发者告警，但不能让 WS handler 崩（`PerformanceLayer.tsx:407-421`）。
2. **show target 缺失：** 不猜中心、不移动相机、不宣称成功；PerformanceLayer 返回 no-op，必要的玩家可见错误由 Chrome/动作 owner 提供。
3. **tool_end 失败：** 共用 `phantom.ts.evict`，清除所有关联 phantom/source，显示玩家可见失败文案；`console.warn` 不能代替文案（`docs/ux/00 §4.2.1`、`docs/perform/00 §9`）。
4. **座位过户失败：** `chalk_landed` / `image_landed` 不是成功事件；真实重取失败必须保留重试路径，不能播放 success-only 音效。
5. **Character frame 身份不匹配：** 必须在单一公开消费路径丢弃并记录可见错误，不能把别的 `characterId` 的帧送进当前 modal（`docs/ux/00 §4.6`）。
6. **modal/dice/radial 同时请求：** overlay admission 必须按 §7.3 拒绝不兼容投影并反馈，禁止依赖 DOM 后序的偶然覆盖。
7. **Reduced motion / Effects off / hidden：** 采用 `docs/ux/00 §4.7` 的更保守者；不改变事实结果，只移除装饰循环和不必要位移。`ParticleLayer` 已在 `ParticleLayer.tsx:230-247` 跳过 hidden/ambient off；dialogue、dice 的关键结果仍可低动量呈现。
8. **CSS context 不可解释：** 未登记 z、同 token 跨父 context、`transform`/`filter` 引起的隐式 context 都使 Depth 检查失败，不能以截图“恰好正确”豁免。

## 11. 发现的冲突 / 需要修订的上位文档

### C1（已部分落地）：ParticleLayer 拆分 ambient / burst surface

原先一张 full-screen canvas 同时画 ambient dust 与 fireworks；当前 `apps/web/src/components/canvas/ParticleLayer.tsx:377-390` 已拆为 ambient/burst 两个可识别 surface，`apps/web/test/depth-performance.test.mjs:8-24` 已覆盖单 Module、单 canvas 与生命周期门禁。上位 `docs/perform/00 §4.4`、`docs/perform/05 §4.4` 仍需确认“同一 Module 内允许两个可验证 surface”的文字回写；测试通过不等于整批音画验收完成。

### C2：CharacterModal 与 DiceCeremony 的覆盖需由 admission 而非 DOM 偶然顺序裁决

`apps/web/src/lib/overlay-admission.ts:41-59` 已拒绝 dialogue 期间的 dice/radial，`apps/web/test/overlay-admission.test.mjs:38-80` 已覆盖拒绝与幂等释放；但 `apps/web/src/App.tsx:1149-1179` 的组件挂载顺序仍是实现事实，固定 Tailwind `z-50` 的组件也仍存在。必须继续用浏览器回放证明不兼容请求不会覆盖 dialogue；不能把 admission 单测当作跨 stacking context 证据。

### C3：Depth token 尚未成为所有 CSS/JSX marker 的唯一可机械来源

当前 root registry 与 surface class 已落地（见当前状态表），但 `tools/ux-contract.json:159-171` 仍只有一个泛化 `depth.registration` 规则，`apps/web/src/prototype.css:75-76,165-166` 仍存在数字 z-index，组件内还有 Tailwind/inline 例外。统一 checker 虽可 clean，尚未覆盖所有 depth marker 与父 stacking context；必须扩展非空检查后再宣称全量登记。

### C4：grain `body:before` 与 root layer 的 context 未冻结

`apps/web/src/index.css:258-267` 仍是根级 fixed grain，Particle 的 background surface 则在 `ParticleLayer.tsx:379-384`；实际绘制次序不能只按数字推导。A01 已登记 grain 的 token 接缝，但仍需 computed style + screenshot 证明正文、modal、toast 的可读性。

### C5：Nook projection 不应被误读成 Depth

`apps/web/src/scene-shell.css:179` 当前是固定 stage surface（不再是旧 dark-purple literal），而 `App.tsx:857-888` / `NookView.tsx:423-432` 以 projection marker/inert 表达切换。`z-index` 仍不是 active projection 语义；marker 覆盖边界与 dialogue/Nook 过渡必须以浏览器不变量继续验收。

### C6：现状文档关于 modal 底色的来源分裂

`docs/doc-04` 开头写“文档只在画布原位放大，不使用全屏遮罩或背景模糊”，但 `docs/doc-06 §3.4`、`CharacterModal.tsx` 和 `index.css:329-340` 已冻结角色特写为压暗+虚化的注意力光学。两者描述的是阅读 reader 与角色 dialogue 两种不同行为，却没有清楚标注边界。

**建议上位修订：** 在 `docs/doc-04` 明确该句仅适用于 entity inspect/reader，不适用于 CharacterModal dialogue；否则视觉验收会把正确的 dialogue backdrop 判成违规。
### C7：Money Shot 的视听 fixture 高于当前演出音频落点

`docs/doc-19-多模态与游戏性交互升级.md:222-231` 要求 Money Shot 同时具备 15% dim、暖金 beam、证据线、钟鸣和 BGM；但 `docs/perform/05 §4.5` 当前把 `spotlight`、`evidence_burst` 的声音列为不落，且 `lib/audio.ts:24-35` 的现有 `FoleyName/BGMood` 没有专用钟鸣或单簧管轨道。

**A02 裁决：** §6.1.1 与 §12 的 Money Shot fixture 是固定验收标准；实现必须通过音频 owner 的已登记音频 Adapter 提供钟鸣与 BGM，不能在 A02 里私造字符串或由 click 推断。`docs/perform/05 §4.5`、`docs/ux/07-声画偏好与性能接缝.md` 必须回写对应 owner、资源登记、进入/退出恢复和无资源时的可见降级；缺音频不能使视觉/持久事实消失，但该 fixture 不得以“仅视觉”通过。


## 12. 测试与浏览器截图矩阵（已落地证据 + 剩余验收）

### 12.1 机械检查（已有聚焦覆盖，仍缺全量 marker）

| 检查 | 断言 | 修复前非空性 |
|---|---|---|
| Depth registry scan（NEW） | 所有 CSS/JSX z、Tailwind z、inline z 都映射到 Depth token、局部 token 或明确数据排序例外；同值跨 context 不当作同层 | 当前扫描会发现 literal/tailwind/inline 混杂，至少 C3 的未登记集合非空。 |
| Context order（NEW） | SceneBackdrop < worldRef entity < PerformanceLayer < Chrome；dialogue 在 performance 之上；同父 context 的 computed order 与表一致 | 当前 CharacterModal/Dice 同为 50 且 DOM 后序会使 Dice 胜出；断言应失败。 |
| Particle surfaces（NEW） | ambient surface 只属于 background；burst surface 只属于 performance；两者共享 Module 的 resize/parallax 但 DOM/computed stacking 可区分 | 当前单 `z-10` canvas 无法区分两种语义，C1 裁决后该断言在修复前失败。 |
| Phantom pointer guard | `.object--ghost` computed `pointer-events:none`，即使 God Hand 开启也不变；ghost 不进入 drag dispatcher | `PhantomLayer.tsx:79-81` 是当前基线。 |
| Phantom handover | land 前后 seat 的 x/y/w/h 不变；真实 fetch 后 registry 为空，真实 item 保留服务器坐标 | 不能只断 `phase=landed`，否则会漏掉跳位/encore。 |
| Show resource takeover | 同资源只保留最新 show；不同资源并行；duration 到期清理 caption/veil/thread | `PerformanceLayer.tsx:427-473` 已有实现，测试需证明可见行为而不是只查 active array。 |
| Writer pending | `writer_delta` 在 `chalk_writing` 前到达仍显示完整湿墨，注册后文本不丢 | `docs/perform/00 §5` 已记录真实先后，缺 pending 会静默失败。 |
| Dice adapters（NEW） | 玩家 `RollDiceDetails` 与 writer `dice_result` 各自只归一化一次为 `DiceCeremonyInput`，均得到同一 rolling/settled DOM、音效和结果高亮，不等待另一来源 | 现状 `App.tsx:266-278` 只接 `airp:dice-frame` writer lane；玩家 HTTP 路径需补非空断言。 |
| Dice/dialogue admission | 对话打开时请求 dice 不会以 DOM 后序覆盖 speech；有可见拒绝/等待路径 | 现状同为 z50 且 Dice 后渲染，必须先失败后修复。 |
| Reduced motion | hidden / Effects off / reduced-motion 停止 ambient、视频与非必要循环；关键 dice/result/dialogue 文本仍可读 | 不能只断 `prefers-reduced-motion` CSS 存在。 |

### 12.2 浏览器截图矩阵

截图必须保存 viewport、locale、world/layer、Effects、reduced-motion 和 active projection；每格至少一张稳定态和一张转场态。

| 场景 | 视口 | 前置 | 必看证据 |
|---|---:|---|---|
| 基础世界 | 1440×960 | world 已加载、无 overlay | 背景、grid、实体、ambient、PerformanceLayer 空态；Chrome 不盖正文。 |
| spotlight / Money Shot | 1440×960 | fixture 固定 `spotlight(target)` + `evidence_burst(target)`；target 与持久 Chalk 均真实存在 | 全画布除 target 保持 15% 亮度；target 有暖金 beam；burst 有证据线；钟鸣与 Money Shot BGM 按音频注册项进入/退出；持久 Chalk 与目标去向仍可见，show 结束不写演出临时线。 |
| 幻影并行 | 1440×960 | 同时两个 chalk/image phantom | phantom 在 performance，座位不重叠，不可 pointer/drag；真实落地无跳位。 |
| 窄桌面 | 1024×768 | header、writer dock、背包打开 | Chrome 带宽不遮 target；show caption/错误文案有可见位置。 |
| 移动场景 | 390×844 | no header 或窄 header | modal close、Stop、dialogue paper、dice caption 不被 safe-area/底部 dock 截断。 |
| Dialogue enter | 1440×960 | 单击真实角色头像 | 原 Canvas 仍隐约可见；portrait/speech 从 dialogue context 盖过 performance；相机推近连续。 |
| Dialogue exit | 1440×960 | 完成一页/按 Esc | speech 降下、背景回亮、原相机恢复，后方已落地内容可见；不出现第二 Canvas。 |
| Dice ceremony | 1440×960 | 玩家 `RollDiceDetails` 与 writer `dice_result` 各跑 pass/crit/fumble | 两个输入均经 `DiceCeremonyInput` 得到同一 roll → settled DOM、音效、目标高亮；不等待另一来源、不重复播放。 |
| Modal+dice adversarial | 1440×960 | 先打开角色，再注入 dice frame | 按 §7.3 不互相盖；若拒绝/串行，玩家有可见状态。 |
| Effects off / reduced | 1440×960、390×844 | Effects off、系统 reduce 各一次 | 无 ambient loop/视频/呼吸/不必要位移；dialogue/dice 仍有低动量信息反馈。 |
| Hidden tab | 任意 | 切到后台再回前台 | 粒子/视频暂停；回来不生成重复 show/phantom。 |

### 12.3 交互回放脚本

回放不是只看截图，必须在浏览器逐步记录事件、DOM snapshot 与截图：

1. `open world → wait layer → screenshot`：确认六类 Depth 的稳定初始树。
2. hover/focus entity → open inspect → screenshot → close：确认 entity 局部提升不越级，reader 不撑大 shell。
3. trigger `writer_delta → chalk_writing → chalk_landed → file_changed`：确认 pending 湿墨、phantom 不可点、真实卡接管且 registry 最终为空。
4. trigger Money Shot fixture：先让权威动作落下持久 Chalk 与目标去向，再触发 `show_frame spotlight(target)` + `evidence_burst(target)`；截图与 `audioDebugState` 同时证明 15% dim、暖金 beam、证据线、钟鸣/BGM、show 临时线结束后仍只剩持久事实。
5. trigger `show_frame spotlight(target)` → layer switch：确认 show 取消、旧 target 不残留。
6. trigger player `RollDiceDetails` and writer `dice_result`（pass/crit/fumble）：确认两种 Adapter 只产生一个 `DiceCeremonyInput`，共享滚动/落定/高亮和正确错误边界。
7. click character → receive matching/non-matching character frame → advance page → Esc：确认只显示匹配角色、输入在页耗尽前 disabled、CameraMemoryStack 恢复 caller slot。
8. while dialogue open attempt dice/radial：确认 admission 规则而非 DOM 后序抢层。
9. Effects off / `prefers-reduced-motion` / document hidden 三次回放：确认装饰停止、关键事实仍可见。

每一步的失败记录必须包含：事件/帧、当前 layer、active projection、target path、父 stacking context、computed z/token、玩家可见文案；不能只记 console 输出。

## 13. 仍未知待拍板

1. `body:before` grain 是否保留根级覆盖，还是移入 Canvas/background context；视觉 owner 需用 1440×960 与移动截图校准。
2. world picker、BagItemDialog、TTS settings、RadialMenu 是否统一归 `chrome` blocking 子层，及其相互 admission 规则；A02 只规定都不得盖 dialogue/错误/Stop，具体 Chrome 状态归 `03`。
3. PerformanceLayer target 缺失的玩家可见文案由 `04-动作语义与事实反馈` 还是 `03-Chrome与公开状态` 提供；A02 不新增文案 key。
4. 实现阶段是否把 `.prototype-world`、Canvas root、worldRef、show-root、dialogue root 明确标注 `data-depth`，以便浏览器 snapshot 机械核验；目前源码没有该属性。
5. `docs/doc-04` 与 `docs/doc-06` 的 reader/dialogue 术语边界需在上位文档回写后，才能作为截图验收的唯一视觉判据。

## 14. 交付边界

- `PerformanceLayer` / phantom / writer 的字段与时序仍以 `docs/perform/00` 为准；
- `flowColumns`、footprint、真实 `cards.z`、phantom seat 仍以 `docs/layout/00` 为准；
- Nook projection 与相机仍以 `docs/nook/00` 和 `docs/ux/05` 为准；
- Chrome admission、writer busy、Stop、错误可见性由 `docs/ux/03` 认领；
- 动作成功/失败顺序由 `docs/ux/04` 认领；
- 声音、Reduced motion、页面 visibility 细节由 `docs/ux/07` 认领。

在这些冲突完成回写、Depth registry 可机械扫描、浏览器截图与回放矩阵通过前，不得把当前数字 z-index 宣称为统一舞台 Depth。
