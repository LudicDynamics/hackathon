# doc-10 组件协议与官方组件清单（待完善）

> 状态：**待设计（2026-09-11 立项）**。doc-05 §11「预设互动组件库 10-20 个叙事补充组件清单」展开为独立专题。
> 关联：doc-05 §6（组件定位）、§7.1（组件 = 叙事补充）、§7.4（渲染路由：万物皆 md）、§9.1（get_component / show 工具）；doc-06 总纲 #2（组件是叙事补充，不是互动主力）。

## 背景与现状（已定案，不重谈）

- **组件 = 叙事细节 + 实体解谜承载者**（2026-09-11 升级，详见 doc-19）：组件不仅铺垫沉默细节，更作为传统 Point-and-Click 冒险玩法的交互实体，支持接受玩家背包道具的拖拽出示（`use_item_on`，如钥匙开地窖锁、证物出示），作为与 choice 并行的剧情推进通道；
- 两组组件：**叙事与交互组件**（信/书/谜题/机关/乐器/棋盘/装置——承载细节与解谜碰撞）+ **演出型组件**（过场/特效，`show` 工具纯展示不落盘）；
- 前端按 component 渲染，协议是 `get_component`（返回 schema/用法/示例）与 `show`（演出型纯展示）；
- 落地形态 = 幻影落地物件卡（doc-06 §2.5 空位排座）。

## 原型证据（2026-09-11 走读，v1-yoshi / v2-niko / 角色-yoshi / holmes-world）

> v2-niko 是视觉基准（doc-04 §10），v1-yoshi 是交互细节基准，证据以两者为准，冲突时 v2 优先。

### E1. 原型里的 type 分层（与 doc-05 §7.4 渲染路由对齐）

| 原型 type | doc-05 映射 | 说明 |
|---|---|---|
| `chalk` | `type: chalk`（浮字，无卡片壳，楷体墨） | 叙事正文；v2 有 `big/size/mine` 变体；本层 chalk 自动 `registerHistory`（年龄递减） |
| `note` | `type: note` md（纸卡，`<b>标题</b>\n正文`，双击=阅读器） | 便签/物件卡；v2 解析首 `<b>` 为 `<h3>` 标题；**铜钥匙在 v1 是 `type:'note'`**（不是独立 letter） |
| `letter` | `type: component, component: letter`（信封纸 + 火漆 seal + 点击弹 `letterFocus` modal：title/body/sign） | v2「六年前的搜救通报」有完整 title/preview/body/sign 四段；v1 只有壳（preview 写死汤） |
| `gate` | 子目录 README（门卡：封面/标题/摘要/编号/图钉） | stub 层显示 "UNWRITTEN · 第一眼才存在" |
| `buddy` | 角色卡 + 在场状态（光标态头像 + name-tag + 说话 bubble 3.2s） | 点击 = 进入遮罩对话（galgame 式：立绘 + 底部对话框；脚本长在 buddy 数据里）；仅画布呈现，**不是组件**（角色呈现，见 E0） |
| `bg` | **场景 README 的 frontmatter 字段**（`bg`/`background`，背景图/底纹声明——README = 场景预览 = 场景 config） | 演出序第一位（先铺底再写字）；**不是 `type: asset`，不是组件**（见 E0；v1 `bg:0`/`FILE_HINT` 是原型取巧） |
| `roads` | **canvas.db 画布状态**（作家用 `link` 工具管理，实线/虚线/箭头/特粗/红线） | 画布状态工具，**不是组件**（见 E0/E13） |
| `compass` | **bg 上的固定样式**（装饰罗盘） | **不是组件**（见 E0） |
| `sprite` | 角色在场演出（presence 共鸣） | 角色呈现，**不是组件**（见 E0） |

**核心结论**：`note` 是原型里真正的"物件卡"（铜钥匙用它），`letter` 是唯一从纸片弹出"第二层阅读"（title→preview→body→sign）的组件。**官方组件清单的 MVP 种子 = 铜钥匙式 `note.md` + 搜救通报式 `letter.md`**（doc-10 标记里早就写了这俩，证据吻合）。`buddy/bg/roads/compass/sprite` 全部不在组件体系里（见 E0），**不占名额**。

### E2. 组件的"三段体"落盘形态（v2 letter 实证）

```
title（卡面标题） → preview（卡面摘要，画布上可见）
  → body（点开后的全文，modal） → sign（落款/署名）
```

- 这是 `note.md` 与 `letter.md` 的本质区别：**note 无第二层，letter 有第二层**；
- 规程建议：组件 md 落盘字段至少 `title` + `preview/body`；带落款的再加 `sign`；字段走 frontmatter data 还是正文分段，实现时定。

### E3. 落地演出序（v1 performLayer 实证，doc-06 §2.1 的原型来源）

`bg(0) → chalk(1) → note/letter(2) → buddy(3)` —— 背景先行（bg = README 的底，先铺）、叙事次之、物件卡随后、角色最后进门。组件演出=**笔尖飞到座位 → `ghostWrite` 幻影壳（文件名+shimmer）→ 内容落地座位过户**。幻影壳不可交互（点不开、不可拖），`cancelPerformance` 快进收尾（半成品不留画）。

### E4. 点击语义（v1 clickum 实证）

- `gate` 点击 = 进门；`buddy` 点击 = 进遮罩对话；`letter` 点击 = 弹阅读 modal；
- `chalk`/`note` **在原型里没有点击动作**（note 的阅读器见 doc-06 §5.2 背包详情，场景内 note 点击=阅读器是待定）；
- 上帝模式点击一律 = 选中（不进门不开信）；`ghost` 壳点不开。

### E5. 可收藏性（v1 `BAG_TYPES` 实证）

**只有 `note` / `letter` 可进背包**：`gate/buddy/bg/roads/compass` 不可收藏（门/角色/幕布/线不是可拿走的东西）。这就是 doc-10 待设计 #4 的答案：**`move()` 移动语义只适用于 note/letter**（+ 将来立项的可拿组件）。

### E6. 作家感知侧（v2 `memory()` / `thingsSummary()` 实证）

```js
// memory()：当前层 + 去过层的 chalk/note，剥标签压空格，每条 ≤90 字，最近 24 条
// thingsSummary()：当前层全部落盘物件（除 roads；bg 不在组件体系、读 README frontmatter），text/desc/line 压到 ≤300 字
```

- 这是 doc-10 #5 的原型答案：**组件进作家感知的形态 = note/letter 的"标题 + 前 N 字"摘要流**（不是全文），与 doc-12 #1 的"当前场景目录清单"同源；bg/compass 不进感知（bg 是 README config，随 README 一起读，见 E0）。
- 背景建议：正文超限时全文靠 `look_at` 拉；它隐藏原始 YAML，但会格式化组件的 status/choice/dice（doc-20 §3）。

### E7. holmes-world 证据（文件即真相）

- `world/baker-street/evening.md` = chalk + choice + status + roll_dice 四件套同文件——frontmatter 收编的活样例；
- `journal/*.md` 用的是 `type: chalk`（暂代，无独立 scenario type——正好印证 doc-08 定案 2 的"新增 type 留位"还没做）；
- watson `preset.json` 有 `chat-history` slot——角色连续性目前靠会话文件；AIRP 角色记忆系统已暂缓（doc-13）；
- **2026-09-11 修正示范**：各场景 README frontmatter 已加 `bg`（+ 大地图 `compass: true`），落实"README = 场景 config、bg = README 字段、compass = bg 样式"（见 E0）——示例世界不再把 bg 当独立 asset。

### E8. v2 独有机制补遗（上一轮漏掉的 v2 专属证据）

- **记忆风化**（`registerHistory`）：本层 chalk 自动进 history 队列，按"年龄"三档渲染——最新全文 → `collapsed`（折叠）→ `collapsed + aged-faint`（折叠+褪色）。**点击可 toggle**（`bindToggle`：折叠点开展开，褪色点开变折叠）。——这是 doc-08「历史手记折叠」**已经在原型里跑通的前端形态**：不用等后端 fold，前端自己就会"旧板书自动收起来"，与 doc-08 定案 2（`type: scenario`）是前后端两层、互补；
- **temp chalk**（`st.perm===false`）：12 秒后自动 `collapsed + aged-faint`——doc-06 §2.2「擦除（temp）vs 落定（perm）」在组件级的实现锚点；
- **sprite 共鸣**（`presence.echoing`）：作家落笔时在场角色卡 halo 共鸣 + status 切"落笔中…"，写完恢复——角色在场 ≠ 组件，但它的**状态行**是组件可复用的呈现件；
- **连线语义**（`thread-latest / thread-archived`）：新 dashed 线落下时，旧 dashed 线自动归档（`thread-archived` 透明度 0）；hover 高亮整条。——关系线的"最新 vs 存档"就是叙事线的版本语义；
- **空间留言**（`spatialPin`）：点画布空白 → 图钉 → 就地留言（`sendToWriter(t, pinWorld)` 带坐标）——doc-06 §2.4 stub 层"留言条"的原型实现；
- **世界包导入**（`worldsFocus`）：JSON 粘贴/文件导入 → `switchWorld`——doc-15 `.airpworld.zip` 分发的前端雏形。

### E9. v3「林晚的工作室」（React+TS，角色房间体裁，11 种 kind）

> 路径 `角色-世界v3.html/src/`。注意：这是**角色小天地视角**的原型（doc-05 §4.1），不是作家主画布——词汇差异首先来自体裁差异。

**11 种 kind**：`presence`（在场）/ `chalk-light`（随手一句）/ `chalk-key`（关键一句）/ `artwork`（画作，image+「未完成」戳）/ `diary`（日记）/ `thread`（对话，`extra.lines` 双人气泡）/ `story`（故事，可进入，`extra.fragments`）/ `trace`（无用途的留存物）/ `crossed`（被划掉的草稿 + `extra.rewrite` 改写）/ `photo`（照片）/ `map`（散落在 story 里，v3 未单独用）。

- **年龄四档**（`age: now/recent/past/deep` → 离中心距离 = 时间深度：岸边·此刻 / 浅滩·近日 / 深水·过去 / 海底·很久以前）：deep 物件透明度压到 0.52（`faded`）、minimap 按 kind/age 着色、相机深度环 NOW/RECENT/PAST/DEEP。——这是"风化"的另一套实现：**v2 用折叠+褪色，v3 用距离+透明度**，同一语义两种皮肤；
- **`story` = 折叠叙事的活先例**：「《最后一个夏天》……故事结束了，但东西留了下来」，`extra.fragments`（地图/独白/未寄出的信）+ "偶尔还会回去加一笔"。——**这几乎就是 doc-08 `type: scenario` 的产品形态**：折叠后不是消失，是"折好放在那里、可进入、可续写"；
- **`thread` = 对话组件先例**：`extra.lines[{who,text,time}]` 双人气泡 + 时间戳，`deep` 的 thread（"很久以前的一次谈话"）带 `faded` 褪色——遮罩对话落盘成组件长什么样，照这个抄；
- **`crossed` = 改写组件先例**：原文划掉 + `extra.rewrite`（"白塔应该是个隐喻"→"不，它就是白塔"）——上帝模式改世界/作家改口的视觉语义，doc-14 可用；
- **DetailPanel = 阅读层协议**：卡片点开 → 头部（STORY/DIARY/OBJECT 类型章 + "在空间中看"回跳空间坐标）→ 全文（diary/trace/photo/artwork 走 `body`，thread 走气泡，story 走 fragments）→ 底部"就这件东西，对林晚说点什么…"**续写输入**（`onContinue`）。——**所有组件的第二层统一长这样**：类型章 + 全文 + 回跳 + 续写；
- **RECENT_EVENTS「最近」面板**：5 条最近动态（label + when + 坐标），点一条相机飞过去（`flyTo` + beacon 脉冲）。——作家/玩家"最近发生了什么"的导航件，doc-12 D1/D3 的前端对应物。
### E10. 角色-yoshi 独有（Elias 小天地，单角色房间体裁）

- **marginalia 批注**（`attachEliasMarginalia`）：角色在用户卡片下挂"— Elias"署名批注 + echo-play 回放键——**角色的"顺手写"**（doc-05 §4.1 三分情境①"场景单聊顺手写"）的呈现先例：写在别人的东西下面、带署名、可回放；
- **lyric performance 歌词演出**：`playLyricPerformance`（enter-slam-zoom/rotate/float-up + brush underline + cadence-part 逐段延迟）——演出型组件（`show`）的动效词汇库：入场 slam、笔刷下划线、节奏性分段显现，doc-06 可直接引用；
- **annotated-card**：用户留字（`createAnnotatedNote`）自动进 history（`registerNewHistoryNote`）+ Elias 1.1s 后批注——**"玩家留痕 → 角色实时回应"**（doc-05 §4.1 三分情境③）的完整回路，含 `relaxAllCollisions` 排座；
- **sharedPiece 共同作品**（"Elias added the blue door"）：双署名物件——**小天地内"共同作品"**的类型先例；它是普通世界内容，不需要记忆专用协议；
- **双语字**（英文 thought/status + 中文内容）：角色"想"的语言与"说"的语言可以分开——角色 preset 语气设计的参考（doc-03 AIRP 批注 2"角色自己写"）。

### E11. 三原型样式对照总表（同一语义，三套皮肤）

> 结论先行：**三原型在"组件长什么样"上分歧很大，但在"组件是什么关系"上高度一致**——分歧的是皮肤（材质/字体/动效），一致的是结构（标题-正文-落款/摘要-全文-回跳/续写、折叠-点开、新-旧-褪色）。doc-10 的协议应该**只定结构关系，不管皮肤**（皮肤归题材包/doc-04）。

| 语义 | v1-yoshi | v2-niko（视觉基准） | v3 林晚（角色房间） |
|---|---|---|---|
| 叙事正文 | chalk 浮字（墨） | chalk 浮字 + big/size/mine 变体 | chalk-light（一句）/ chalk-key（重要一句） |
| 物件卡 | note 纸卡（铜钥匙） | note 纸卡（首 `<b>` 作标题） | trace（无用途留存）/ photo / map |
| 信件 | letter 壳（preview 写死） | **letter 完整四段**（title/preview/body/sign + 火漆） | diary（日记体） |
| 第二层阅读 | letterOverlay 全屏 | letterFocus modal | **DetailPanel（类型章+全文+回跳+续写输入）** |
| 新旧/风化 | 无 | **记忆风化三档**（全文→折叠→折叠+褪色，可 toggle） | 年龄四档 now/recent/past/deep（距离+透明度 0.52） |
| 折叠叙事 | 无 | temp chalk 12s 自动折叠 | **story（折好放着、可进入、可续写）= scenario 活先例** |
| 对话 | buddy line（单句） | sprite line + say 动作 | **thread（双人气泡+时间戳+faded）** |
| 在场 | buddy 头像+bubble 3.2s | presence halo+status+echoing 共鸣 | presence（呼吸光+此刻状态+打字指示） |
| 关系线 | roads（静态 SVG） | **thread-latest/archived（新线落下旧线归档）** | minimap 点 + 关系浮层（"和那句话离得很近"） |
| 改写 | 无 | 无 | **crossed（划掉原文+rewrite）** |
| 共同作品 | 无 | 无 | sharedPiece 双署名（角色-yoshi） |
| 角色批注 | 无 | 无 | marginalia 署名批注 + echo-play（角色-yoshi） |
| 空间留言 | penAsk（执笔指物问） | **spatialPin（点空白插图钉留言）** | 点空白 pin + 留言输入 |
| 最近动态 | 无 | 无（作家感知在后端） | **RECENT_EVENTS 面板（5 条+飞过去+beacon）** |
| 世界切换 | CAMS 每层记相机 | worldsFocus 导入 JSON 包 | 单房间（无） |
| 视觉语言 | 手账纸（纸纹/图钉/胶带感） | **墨画布**（rust-sage-blue/圆角+软影/墨动画） | 暖纸工作室（paper-sea/grain/ink-press 纸感） |
| 技术栈 | 单文件 vanilla JS | 单文件 vanilla JS + `/api/*` 后端桩 | **React+TS+Vite+framer-motion+lucide** |

### E12. 对 doc-10 待设计项的修正输入（三原型看完之后）

- **#2 官方清单**：v3 证明"一个房间体裁"就能长出 11 种 kind——10-20 个名额**不该是全局封闭清单**，而是"内核 2 种（note/letter）+ 题材包按需注册"。清单制的反面教材就是 v3：换个题材（推理→角色房间）词汇全变，封闭清单跟不上。建议 #2 改为"**注册协议 + 每个题材的首批 3-5 个示例**"，而不是 10-20 个全局立项；
- **#3 交互边界**：v3 DetailPanel 证明"第二层"可以统一协议（类型章+全文+回跳+续写），判定句不变（"点击后世界变不变"），但**"续写"输入是第三种点击后果**（不改变世界、只对角色说话）——三级变四级：开阅读 / 续写说话 / 视觉替应 / 纯看；
- **#1 schema**：三原型共同字段只有 `id/title/body/meta/x/y/rot`（v3 `WorldItem` 即最小超集），`preview/sign/fragments/lines/rewrite/image` 全是可选扩展——schema 应该是"**小内核 + kind 自带 extra**"，而不是大一统全字段；
- **#4 落地协议**：v3 `faded`（deep 透明度 0.52）+ minimap 着色证明"年龄"应该是组件的一等属性（`age`），与 doc-08 折叠联动：**fold 后的 scenario 年龄直接进 `past`**；
- **#5 作家感知**：v3 RECENT_EVENTS（最近 5 条 label+when+坐标）就是 D1/D3 的前端件——注入侧（doc-12）与呈现侧（本节）用同一份"最近动态"数据。

### E0. 术语正名（2026-09-11 修正：之前文档+原型实现都有误读）

> 背景：早期文档把"演出型组件"写得含糊，原型又为了省事把一堆东西都塞进 `type` 字段（roads/compass/bg 全当"组件"渲染），holmes-world 的 README 也没示范 `bg` 字段。三处一叠，误读成型。本节是正名后的唯一口径。

| 术语 | 正解 | 之前错在哪 |
|---|---|---|
| **演出型组件** | **一次性演出**：放烟花 / 把某组件聚焦推到屏幕中央 / 全屏关灯——纯 `show` 通道，**不写文件、不写 DB、不留痕**，演完即消失 | 误读成"画线/罗盘/背景也是演出型"。roads/线条 ≠ 演出型（它是画布状态，见线条小节）；compass = 下一条的固定样式；bg = 再下一条的 README 字段 |
| **线条 roads/link** | **不是从 md 派生的装饰**，而是 **canvas.db 里的画布状态数据**（实线/虚线/箭头/特粗线/红线/road 等，样式很多），由作家用**专用 link 工具**统一管理 | 误读成"叙事里 md link 自动派生连线"（doc-05 §3.2 旧表述），低估了线条复杂度——样式多样、需统一管理，属于画布状态层而非 md 派生（见下方"线条统一管理"） |
| **bg** | **不是 `type: asset`，是场景 README 的 frontmatter 字段**（`bg`/`background`：背景图/底纹声明）。README = 该场景的预览 = 该场景的 config | 误读成独立 asset 类型（v1 `FILE_HINT`/演出序里的 `bg:0`、archive 旧 doc 的 `type: asset` 都是原型取巧+旧文档残留） |
| **compass** | **不是组件，是 bg 上的一个固定样式**（装饰罗盘钉在背景上） | 误读成可注册/可落地的组件类型 |
| **落盘型组件** | 只有它才有 md 落盘：`note.md`（物件卡）/ `letter.md`（信封）/ 将来注册的书·谜题·机关·乐器·棋盘·天气·装置 | 与演出型混为一谈 |

**一句话口径**：组件分两类——**落盘型**（有 md 文件，长在画布上，可被收藏/折叠/感知）与**演出型**（无文件，`show` 一次性演出，不留痕）。bg/compass/roads 不在组件体系里：bg 是 README 的 config 字段，compass 是 bg 的样式，roads/线条是 **canvas.db 画布状态**（见 E13）。

### E13. 线条统一管理（推翻"md 派生"假说，2026-09-11）

> 之前文档写"叙事里的 md link 自动连线"（doc-05 §3.2 旧表述）——**这个假说被推翻**：它低估了线条的复杂度。

- **线条很多、样式很多**：实线 / 虚线 / 箭头（有向）/ 特粗线（road 那种粗线条）/ 红线（强调）/ 手绘线 / 丝线（doc-04 材质词汇）。"从 md 一两条 link 派生"管不了这么多样式。
- **线条属于 canvas.db 画布状态数据**（同组件的 xy/wh/rot——画布层布局状态），**不落 md**；文件即真相、画布即投影的纪律在这个域上不成立——线条没有"文件本体"，只活在画布状态层。
- **作家用专用 `link` 工具统一管理**画布上的线条：建线/改样式（实线、虚线、箭头、粗细、颜色、rot）/删线/连线两个端点；不靠引擎自动派生，也不靠作家手改 md。
- **同类增量**：**画布布局工具**——组件在画布上的 xy/wh（及 rot）状态的读取/移动/整理，作家也用一个专门工具（如 `arrange`/`layout`）来挪位置，而不是全靠引擎隐式排座。两者合称"**画布状态工具**"（link 管线、layout 管摆位），归 doc-05 工具面补全，不占用组件名额。

> 影响面：doc-05 §3.2 关系线表格、§9.1 工具面；doc-18 映射表的"关系线"一行。待设计 #2 只列落盘型组件，线条/布局是画布状态工具，不在组件清单内。

## 待设计清单

| # | 项 | 说明 |
|---|---|---|
| 1 | **组件的总结 schema** | manifest frontmatter 字段（type / data / position / material…）、"万物皆 md"下组件如何表达（md 文件 + frontmatter？嵌入 chalk？）、组件与物件卡的关系。**原型建议**：三原型共同字段只有 `id/title/body/meta/x/y/rot`（v3 `WorldItem` 即最小超集），`preview/sign/fragments/lines/rewrite/image` 全是可选扩展——schema = **小内核 + kind 自带 extra**，不是大一统全字段（见 E2/E12） |
| 2 | **官方组件清单** | 10-20 个候选逐个立项：信/书/谜题/机关/乐器/棋盘/天气/装置/过场特效应——每个的**用途、允许的交互、呈现示例、材质词汇**。**原型建议**：v3 一个房间就长出 11 种 kind——不该是全局封闭清单，而是"**内核 2 种（note/letter）+ 题材包按需注册 + 每个题材首批 3-5 个示例**"（见 E12） |
| 3 | **组件的交互边界** | **方向已定**：所有落盘组件都可携带通用 `choice/status/roll_dice`；单实体动作由 `choose` 触发，物件作用于目标由 `use_item_on` 触发。待设计的是不同组件如何呈现这些通用字段，不再为每种组件造 `interact` 工具 |
| 4 | **落地与渲染协议** | 幻影落地 → 物件卡 → 组件渲染的链路；组件能否被玩家拖进背包（移动语义 move() 是否适用）。**原型已答**：`BAG_TYPES = ['note','letter']`——**只有 note/letter 走 `move()`**（见 E5）；落地演出序 `bg→chalk→note/letter→buddy` + ghostWrite 座位过户（见 E3）；v3 补：**年龄 `age` 是一等属性**（deep 透明度 0.52），fold 后的 scenario 年龄直接进 `past`（见 E9/E12） |
| 5 | **组件 vs look_at** | **方向已定**：`look_at` 返回标题/正文摘要，并把 status/choice/dice 格式化成文本块；原始 frontmatter 隐藏，全文和原始 YAML 可再用 `look_at` / `read` 拉取（doc-20 §3） |

## 边界

- 组件可以承载玩法入口：自身动作写 `choice`，二元物件互动走 `use_item_on`，随机检定写 `roll_dice`。组件仍不自造另一套通用交互协议；
- 不设组件市场专用 schema 之外的下文定义（市场见 doc-17）。

> **标记：方向已收敛（2026-09-11 修正：演出型 = 一次性演出；bg = README frontmatter；compass = bg 样式；线条 = canvas.db 画布状态不归 md 派生）**。
> - 演出型 ≠ 落盘型：放烟花/聚焦推屏/关灯——**纯 `show` 通道，一次性、不写文件不写 DB、不留痕**。原型里的画线（roads/thread）、罗盘（compass）、背景（bg）**都不是演出型**：roads/线条 = canvas.db 画布状态（作家用 `link` 工具管理，E13）；compass = bg 上的固定样式；bg = 场景 README 的 frontmatter 字段（`bg`/`background`，见 holmes-world 修正任务）。
> - MVP 落盘型只做 `note.md` + `letter.md`（铜钥匙/纸条/搜救通报式）；演出型 MVP 可做 1-2 个（聚焦推屏/关灯最出效果，烟花次之）；线条管理 MVP 做 `link` 工具（建/改/删线），布局 MVP 做 `arrange` 工具（挪 xy/wh）——均归 doc-05 工具面补全。2026-09-11 补：原型走读已给出 #3（点击四级判定）#4（`move()` 仅 note/letter + 落地演出序）#5（标题+N 字摘要流）的建议答案，#1 #2 待立项（种子 = 铜钥匙式 `note.md` + 搜救通报式 `letter.md`）。
