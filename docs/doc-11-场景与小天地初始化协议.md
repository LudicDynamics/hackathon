# doc-11 场景与小天地初始化协议（2026-09-11 定案）

> 状态：**已定案（2026-09-11）**。原"待设计清单"五条已全部落定，本文取代 2026-09-11 立项版。
> **2026-09-11 晚复核**：§2.3 的九条 pi-rp 源码级约束中，C1 / C3 / C5 / C7 已被上游修掉，§2.3 / §2.4 / §7.1 / §7.2 随之改写；新增 §2.3.1「vendored dist 的时间差」。
> 展开：doc-05 §3.2（stub 层首次进入实例化）+ §4.1（角色小天地根目录为空触发初始化）。
> 关联：doc-05 §1（懒加载：第一眼才存在）、§4.3（委托协议，profile `scene-init`）、§8.4（world.json 只写世界级事实，层级由目录派生）；doc-06 §2.1（幻影落地）、§4.2（小天地三分情境）；doc-07 §3.5；doc-13 §1（记忆写回）；doc-15（模板骨架）；doc-20 §2.9（关卡骨架 / 生成语法 / 持久事实）。

---

## 0. 一句话

日语世界装配补充：`first-snow-jp` 的人物 preset 仍引用共享 `system-char`；新增 `world-language` 文件槽读取世界根 `language.md`，随后加载角色自身四份日语文档。精确 JSON、文件路径与 Writer skill 的日语规则见《世界日语化迁移》§4；不复制平台提示词正文、不启用新初始化路径。

2026-09-12 未写之门实际接线：首次进入 stub 落事件后串行提交作家亲写（W1），R1/R2 尚未启用。writer preset 增加 `"tools": { "deny": ["bash"] }`，原生 write/edit 经 `world-context.ts` 落账。完整范围见 doc-25；下文 R1/R2 为目标协议，不表示该 Demo 已验证委托。

**初始化 = 一次"外包"，不是一次"扮演"。** 世界只认两种初始化路径——**作家委托**（agent 判断该外包了）和**玩家/引擎直唤**（玩家自己动手要一片新地方）。两者共用**同一套 subagent preset**，差别只在"谁来填那份 brief"。

---

## 1. 分类学：一次初始化是谁干的

明月的分法（2026-09-11 口述）：初始化分**外包**和**自己做**；外包又分**agent 调 subagent** 和**玩家主动触发**。补全为 2×2：

| | **AI 生成（外包）** | **非 AI（自己做）** |
|---|---|---|
| **作家侧发起** | **R1 委托**：作家判断"这是从零→100 的体力活" → `subagent` 工具 | **W1 亲写**：剧情细节/即时体验，作家直接 chalk（不是初始化，是叙事） |
| **玩家/引擎侧发起** | **R2 直唤**：玩家建目录 / 进 stub 层 / 进空小天地，给一句话需求 → 引擎 spawn | **W2 模板**：引擎落占位 README，零 AI（兜底/离线/超时降级） |

### 1.1 R1 委托（作家 → subagent）

doc-05 §4.3 已定案的分工：全新内容的从零→100（新城镇/新区域/大量生成）发散、是体力活 → 委托。**进入一个 stub 层**天然属于这一类。

### 1.2 R2 直唤（玩家/引擎 → subagent）

三种触发点，同一个执行器：

| 触发点 | 玩家动作 | 谁填 brief |
|---|---|---|
| **新建目录** | 上帝模式右键新增一个空目录 | 玩家在弹窗里写一句话（可留空 → 引擎用默认 brief） |
| **进入 stub 层** | 双击 `stub: true` 的场景卡 | 穿越动画里弹一行"这里是……"（可输入，可跳过→默认 brief） |
| **进入空的小天地** | 角色 tab 点头像旁的"小天地"，根目录为空 | 空房间里的一行提示（见 §4） |

### 1.3 为什么角色小天地不归角色自己（关键取舍）

> 明月：*"给角色一个可以调用的 subagent 来 init 自己的小天地，会很奇怪，仿佛这不是角色的私人空间，是别人帮忙打理的。"*

**定案：角色的初始化走 R2（玩家/引擎直唤），角色 agent 永远不"装修自己的家"。**

- **心智理由**：小天地的可信度来自"这是 ta 多年来留下的痕迹"，不是"ta 接到任务后连夜布置的样板间"。玩家触发时，产物的语义是**初始陈设/默认素材**——玩家（世界的共同作者）说"这里大概该有些什么"，而不是角色说"我来收拾一下"。
- **技术上也不该**：角色是懒灵魂（点开才 spawn），让一个还没活过的进程去装修自己的家，顺序是反的。**先有空间，后有灵魂**——角色第一次 spawn 时 `read` 自己的目录，写在那里的东西就是它的，它天然认领（doc-13 §4）。
- **与"顺手写"不冲突**：初始化只发生一次（根目录为空时）；之后角色在遮罩里"顺手写"的痕迹是**增量**，两者叠加，看不出接缝。

---

## 2. 统一执行内核：一套 preset，两个入口

> 明月：*"由于 subagent 用的也是 preset，只是多了一个 delegatable true 字段，因此我们只需要维护一套 subagent 的提示词，以及到时候玩家需要手动调用的地方，引擎直接复用就行。"*

**定案：一个初始化任务 = 一个 profile（`delegatable: true` 的 preset）；作家委托和引擎直唤走同一个 profile，只是入口不同。**

```
                    ┌─────────────────────────────┐
                    │  .airpworld/prompt-presets/ │
                    │   scene-init.json           │  ← 一套提示词（静态：纪律/输出规范/语气）
                    │   nook-init.json            │
                    └──────────┬──────────────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
   R1 作家委托入口                     R2 引擎直唤入口
   subagent 工具（LLM 主动）            ctx.spawnAgent（代码主动）
   brief 由作家写                       brief 由引擎按模板拼
              │                                 │
              └────────────────┬────────────────┘
                               ▼
                        brief（task 文本，动态）
```

### 2.1 preset 是静态的，brief 是动态的

**这是整个设计的支点。** pi-rp 的 preset 编译发生在 `prepareSubagentConversation`，而**参数化只能走 task 文本**（见 §2.3 约束 C3）。因此：

- **preset 里写不变的**：身份（你是世界初始化器）、纪律（不预设剧情、不写玩家已知的事）、输出规范（文件清单、frontmatter 格式、字数）、语气（沉默细节 > 设定罗列）；
- **brief 里写每次不同的**：目标路径、世界基调、上级层的上下文、玩家的诉求、已知线索、约束、产出清单。

**brief 由同一个模板函数生成**（`buildInitBrief(kind, ctx)`）——作家委托时作家填"诉求"字段，引擎直唤时引擎填，其余字段两边一致。这就是"维护一套提示词"的落地方式。

### 2.2 brief 文本协议（两种初始化共用）

```text
[Task] Instantiate a scene layer
[Target Path] world/baker-street/crime-scene
[World] Fog Over Baker Street (genre: mystery; description: The Disappearance of Lady Adler — an open-ended mystery world held together by clues alone; default material: parchment)
[Parent Layer] Baker Street
[Player Request] 我想看看她最后待的地方。
[Known Clues] a blurred photograph / an anonymous note ("She went to the abandoned orchard")
[Constraints]
- Do not presuppose a final answer or impose a definitive conclusion
- Focus on the scene's atmosphere, object staging, and sensory detail (sight, sound, touch, smell)
- Give only the "first sight", leaving blank space for the player to explore and interact with
[Deliverables]
1. README.md: scene title, furnishing overview, and background material declaration
2. 2–4 object markdown files (props or letters the player can pick up or investigate)
3. 1 opening narration (a md file with type: chalk, <=200 words, including status/choice/roll_dice)
[Report]
Three lines: list of paths / one-sentence scene summary / one sentence on "what is the most striking detail here"
```

**回报格式要短**：subagent 输出经 `truncateTail`（默认 2000 行 / 50KB）截断后返回父会话；作家"摘要过目"和前端"生成完毕"提示都吃这三行。

### 2.2.1 四世界体验对 brief 的新要求（2026-09-12，协议扩展待实现）

上述 brief 已足够生成“第一眼”，但还不足以支撑 doc-20 所述的生成式关卡：新城镇不能只有氛围和两件物品，还必须继承玩家为什么来、已经改变了什么，以及该世界怎样生长。

因此下一版 `SceneInitContext` / `buildSceneInitBrief` 需增加三类动态上下文：

| 字段组 | 内容 | 作用 |
|---|---|---|
| **World Generation Grammar** | 新地点、角色、物件、危险升级和多模态风格的规则 | 防止生成结果只是同一引擎的换皮 |
| **Story / Player State** | 当前篇章目标、玩家身份、持有物、关系、承诺与已发生的世界变化 | 让新地点承接因果，让角色真的认识玩家 |
| **Entry / Continuation Contract** | 玩家为什么到达、入场时立即发生什么、新地点应向哪个未完目标提供下一步 | 生成的是可继续玩的一段，不是孤立设定集 |

**实现现状**：当前代码仍只传入 `targetPath` / `manifest` / `parentLayerName` / `userPrompt` / `knownClues`；本节是已确认的体验缺口，不冒充已实现协议。具体字段形状需等 doc-20 的四世界语法经过真实试玩后再定案。

### 2.3 工程约束（pi-rp 源码级实测，2026-09-11）

以下为通读 `subagent/{prepare,run,spawn}.ts` 与 `prompt-preset/{loader,policy,slot-renderers}.ts` 的**实测结论**，不是推测。写代码前必读。

> **2026-09-11 晚复核**：C1 / C3 / C5 / C7 四条**已被 pi-rp 上游修掉**（同一位作者当天提交），本表已按当前源码重写。
> 对应提交：`402ccc59b`（默认工具集补全 write/edit）、`05893618c`（slot options 展开宏）、`ea310c9fc`（子会话用 prepare 的 cwd）、`6c693a7f3`（preset 目录递归），另有 `3ca27f746` 补了覆盖 C1/C2/C3/C5/C7 的 AIRP 式 e2e。
> **踩坑提醒**：vendored 的 `dist/` 是构建产物且被 gitignore，源码修好了 **dist 不会自动跟上**——本仓库的 dist 曾停在 9/8，比源码落后四天（见 §2.3.1）。

| # | 约束 | 状态 | 证据 | 对 AIRP 的影响 |
|---|---|---|---|---|
| **C1** | 默认工具集 = `["read","bash","edit","write","grep","find","ls"]` + 父会话扩展工具 | ✅ **已含写工具**（原"不含 write/edit"已失效） | `prepare.ts:27`（`DEFAULT_SUBAGENT_TOOLS`）+ `prepare.ts:180` | `scene-init` / `nook-init` **开箱就能落盘**，不必为此专门注册写工具。`spawnAgent` 不传 `tools` 时用同一个常量（`spawn.ts:90`），两个入口天然对齐 |
| **C2** | **`preset.tools.allow` 加不出工具**——`allow` 是过滤器不是白名单扩展器 | ⚠️ **仍然成立** | `prompt-preset/policy.ts::applyResourcePolicy` | 别指望在 preset 里 `allow:["write"]` 添能力；它只会把现有工具集过滤成子集（写错了就过滤成空） |
| **C3** | slot 的 `options` 展开宏（字符串叶子走宏展开，非字符串原样） | ✅ **已支持**（原"不展开"已失效） | `slot-renderers.ts`（`05893618c`） | `options.path:"{{who}}.md"` 现在可用。但 §2.1「preset 静态 / brief 动态」的分工**继续保留**——理由从"硬约束"降为"设计选择"：brief 才是每次不同的东西 |
| **C4** | **`onMissing:"error"` 是致命的**：prepare 把 error 级诊断当失败，整个 subagent 起不来 | ⚠️ **仍然成立** | `prepare.ts:236` | 引用"可能不存在"的角色文件（如 `identity.md`）必须 `skip`（默认）或 `placeholder` |
| **C5** | 子会话用 **prepare 记录的 cwd**（不再是 `process.cwd()`） | ✅ **已修**（原"cwd 可能不一致"已失效） | `run.ts:56/59`（`ea310c9fc`） | 相对 file slot 路径与相对写盘解析到同一个 cwd；引擎仍应保证 cwd = 世界根，但不再是踩雷点 |
| **C6** | **`spawnAgent` 不校验 `delegatable`**；`subagent` 工具与 `/subagent` 命令才校验 | ⚠️ **仍然成立（且是有意的）** | `spawn.ts` 的函数注释明写 "not gated on the preset being delegatable" vs `extension.ts:92` | 两个入口都能用同一个 profile，正合我们的 R1/R2 共用设计；`delegatable: true` 只为了让作家侧看得到。**同一段注释还写了 `spawnAgent` 不继承父会话扩展工具**——这一条留着（刻意隔离），但由它派生的那个静默坑（`tools` 预填导致 `customTools` 被滤掉）已在 `dfebadcd3` 修掉，见 §2.4 |
| **C7** | **preset 目录递归**：`collectPresetFiles` 深度优先收集子目录的 `*.json` | ✅ **已递归**（原"只读顶层"已失效） | `loader.ts::collectPresetFiles`（`6c693a7f3`） | 递归范围仍限于 `<configDir>/prompt-presets/` 内部。`characters/<id>/preset.json` **不在这棵树上**，所以引擎侧的"安装到 prompt-presets"动作依然需要（见 §7.1 修订） |
| **C8** | **子会话工具事件与 UI 透传**：工具事件转发，UI 上下文透传；会话级生命周期仍隔离 | ✅ **已升级**（原"完全无扩展运行时"已修） | `run.ts:100`（`5361105c3`） | 子代理现已继承父会话 `uiContext`（`ctx.ui.notify` 直通前端）并转发 5 项工具级事件（`tool_call`/`tool_result`/`tool_execution_*`）；会话级事件（`agent_start`/`session_start`）与 commands 保持隔离不污染。工具落账既可在工具 `execute` 内自闭环，也可被 `tool_result` 监听捕获 |
| **C9** | 输出被 `truncateTail` 截断（2000 行 / 50KB） | ⚠️ **仍然成立** | `run.ts:136` | 回报格式必须短（§2.2 三行） |

### 2.3.1 vendored dist 的时间差（复核时发现，务必记住）

`vendor/pi-rp/packages/*/dist/` 被 pi-rp 的 `.gitignore` 排除——**它是每台机器本地构建的产物，不随 submodule 指针走**。2026-09-11 复核时实测：源码里 `DEFAULT_SUBAGENT_TOOLS` 已含 `write`/`edit`，而 `dist/core/subagent/prepare.js` 仍是 9/8 构建的旧版 `["read","grep","find","ls","bash"]`。我们的服务端与探针跑的是 `dist/cli.js`，**所以运行时行为一直是旧的**。

> **纪律**：`git submodule update` 之后、或发现引擎行为与源码不符时，先重建：
> ```bash
> pnpm pi status   # 会直接报 dist 是 STALE 还是 up to date
> pnpm pi build    # 重建（内含 hydrate:model-data，要联网）
> ```
> 子模块的拉取 / 提交 / 指针同步一律走 `pnpm pi`（`tools/pi-rp.mjs`），别手搓 submodule 命令——细节见 AGENTS.md §7.2。

**C3 的旧实测记录**（`bun` 直跑 compiler，runtime.variables 带 `who: WORLDNAME`）——**保留作为历史，结论已被 `05893618c` 推翻**：

```
block content  "BLOCK-MACRO=[{{who}}]"   → "BLOCK-MACRO=[WORLDNAME]"   ✅
文件内容里     "BODY-MACRO=[{{who}}]"     → "BODY-MACRO=[WORLDNAME]"    ✅  (slot 输出会走 finalizeItemText)
options.path   "/w/{{who}}.md"            → file not found "/w/{{who}}.md"  ❌
```

当时的结论是"宏只在渲染后的文本上展开，不在 slot 的入参上展开"。**现在 slot options 的字符串叶子也会走宏展开**，上表第三行 ❌ 已变成 ✅。因此 §2.1 的"preset 静态 / brief 动态"分工**不再是硬约束，而是设计选择**——仍然照办，因为 brief 本来就是每次不同的那一半。

### 2.4 工具集对齐表（两个入口要给出相同的工具）

> **2026-09-12 复核（本节已因一次上游修复重写）**：C1 修好之后**内建工具**两边默认对齐（`spawnAgent` 不传 `tools` 时落到同一个 `DEFAULT_SUBAGENT_TOOLS`）。扩展工具原本**不**对齐——`spawnAgent` 把 `tools` 预填成"只有内建集"，于是显式传进去的 `customTools` 因为名字不在白名单里被 `AgentSession._refreshToolRegistry` 静默滤掉。这违背了 pi 自己的工具语义（`tools` 是**收窄用的白名单**，省略即"全开"），已在 pi-rp `dfebadcd3` 修掉。

| 入口 | 内建工具 | **扩展工具**（`chalk` / `look_at` / `link` …） |
|---|---|---|
| **R1 作家委托**（`subagent` 工具） | 默认集，什么都不用做 | **自动继承**：`inheritExtensionTools` 默认 true，父会话注册的工具并进 `effectiveTools`（`prepare.ts:180`） |
| **R2 引擎直唤**（`ctx.spawnAgent`） | 不传 `tools` 即同一默认集 | **传 `customTools` 即可用**（`dfebadcd3` 起）：省略 `tools` 时默认集自动并上 `customTools` 的名字。仍**不继承**父会话里别的扩展工具——那是 `inheritExtensionTools: false` 的刻意设计 |

> **`INIT_TOOLS` 因此可以不要了**。R2 只需把 AIRP 的工具定义交出去：
>
> ```ts
> // R2：spawnAgent({ profileId, task: brief, customTools: airpToolDefs })
> //   省略 tools => DEFAULT_SUBAGENT_TOOLS + airpToolDefs 的名字，与 R1 等价。
> //   只有在要**收窄**时才写 tools，此时它是纯白名单，扩展工具名必须一并列出。
> ```
>
> 需要收窄的场景（例如初始化子代理不该有 `bash`）仍然照 pi 的语义写：
>
> ```ts
> tools: ['read', 'write', 'edit', 'grep', 'find', 'ls', 'chalk', 'look_at', 'link', 'arrange']
> ```

> 另一处两入口不同、但对 AIRP 无影响的点：`spawnAgent` 把 `strict: true` 写死（无 schema 的命名空间写入会被拒）。AIRP 不用 pi-rp 的 state，碰不到。

---

## 3. 场景（stub 层）初始化

### 3.1 判定：什么时候该初始化

| 条件 | 动作 |
|---|---|
| 目录存在（是一个层），**但目录里没有 README.md** | stub 层——进入时初始化 |
| 目录里已有 README.md（哪怕写过一次） | **不初始化**——已经存在了，叙事由作家现编 |

> 层的存在与 stub 与否**只由目录决定**（`world/**/` 每个目录是一个层，README 在不在 = 写没写），`world.json` 里**没有** `layers` 声明。判据是"目录有没有 README.md"，不是"有没有进过"——路径即 id，文件即真相，不额外记"已初始化"标志。派生逻辑 `packages/shared/src/store/layers.ts`。

### 3.2 两条路径

**R1（作家委托）**：玩家在**父层**说出意图（"我要去 Abandoned Orchard 看看"）→ 作家判断这是从零→100 → 委托 `scene-init` → subagent 写盘 → 作家摘要过目 → 玩家再进门时东西已经在那儿。

**R2（玩家直唤）**：玩家**直接双击** stub 卡 → 穿越动画里给一行输入机会（"这里是……"，可跳过）→ 引擎拼 brief → spawn → 玩家**已经在场**，看着它长出来。

**两条路径都合法，且经常同时发生**（明月 2026-09-11）：世界的场景同时需要"作家主动外包"和"玩家自己进来时给需求"。它们不冲突——判据是"目录有没有 README.md"，谁先到谁写，后来的那个看到目录非空就自动跳过。

### 3.3 产出规范

```
world/baker-street/crime-scene/
├── README.md          # type: readme，material: scene，含 name + bg/bgStyle
├── evening.md         # type: chalk —— 开场 chalk（≤200 字，可带 status / initial choice）
└── rusted-key.md      # 物件（chalk / component，2~4 个）
```

| 产出 | 要求 |
|---|---|
| **README.md** | `type: readme` + `material: scene` + `bg`（底图）+ 标题 + 一句话摘要。**覆盖掉 stub 占位**（原 stub README 里 `material: stub`） |
| **开场 chalk（可选，强烈建议）** | 这一层"被玩家看见"的那一下，**缺了它入戏效果会差很多**（2026-09-11 明月修正：早先写成"绝对不写"是错的）。一段环境叙事，≤200 字（doc-07 纪律）；**可以带 `status` 快照，也可以给一组 `initial choice`** 作为玩家起步的抓手。**它就是开场白本体**——不是 agent 的 chat history 播种（那套已废弃，见 doc-05 §7.4） |
| **物件 2~4 个** | 沉默细节优先（桌上的杯子、椅子的摆法、纸上的字），不是"线索大礼包"。可含 1 个可拿走的（给背包用） |

> **"开场 chalk 可选"与"不预设剧情"不冲突**（两者是不同维度）：
> - **允许**：写"你站在这里看到什么"、给起步选项、给状态快照——这些是**入口的手感**；
> - **禁止**：下剧情结论、揭示真相、预定结局、替作家把这段戏写完——那些是**叙事主体（作家）的活**。
>
> 换句话说：初始化可以**开门**，不可以**演戏**。
>
> **术语边界（2026-09-12）**："开场 chalk" 是**世界里的文件**，玩家直接看到；pi-rp 的 "opening 播种器" 是往 **agent 会话**里灌 chat history——AIRP 不用后者。两者都译作"开场白"极易混淆，本文一律写"开场 chalk"。

### 3.4 时机与呈现（幻影先行）

doc-05 §10 已把 Nodesign 的"幻影物件"映射到 AIRP：**"场景初始化器正在这里生成"的占位**。落地：

1. **进入瞬间**：stub 卡按 `material: stub` 渲染（holmes 已用：虚线边框 + "第一眼才存在"），穿越大概率还没生成完；
2. **生成中**：画布上落**幻影占位**（半透明草稿态，与 doc-06 §2.1 的 chalk 湿墨同族），玩家可以在里面走动、说话——**stub 层也能被玩家的行为改变**（doc-06 §2.4 的留言条）；
3. **生成完**：**座位过户**（doc-06 §2.5）——幻影的座位直接给成品，不重排；占位卡淡出、成品落定；
4. **失败/超时**：保留 stub 占位 + 落一条 W2 模板兜底（§5），并在事件表记 `layer_init_failed`（§6）。

**作家侧**：在 stub 层里发任何话，作家看到的是"这个目录下有什么"（Hook 注入），生成到一半也能正常叙事。

---

## 4. 角色小天地初始化

### 4.1 触发：玩家进了一个空的小天地

**角色根目录为空 = 只含 `preset.json`**（preset 是配置不是内容，不算"有东西"）。判定：除 `preset.json` / `.json` 外无任何 md/文件 → 空。

**呈现**（不是弹窗，是"走进一个空房间"）：

```
┌──────────────────────────────────────────┐
│                                          │
│         （一间还什么都没有的屋子）          │
│                                          │
│   这里还留着搬进来的痕迹，没有别的。        │
│                                          │
│   ┌──────────────────────────────────┐   │
│   │  他/她这里，大概该有些什么？  ⏎   │   │
│   └──────────────────────────────────┘   │
│         留空 = 按他的来历，该有什么就有什么  │
└──────────────────────────────────────────┘
```

- **输入一条**（复用画布的输入条意象：纸条通道）；
- **留空/跳过** = 引擎用**默认 brief**：从 `characters/<名>/README.md`（角色简介）+ `world.json` 的角色条目（`home` / `role`）推导出"这个人的来历"，生成符合来历的陈设。**这就是明月的"默认/初始素材"**——不是角色在布置，是"他本来就该有这些"。

### 4.2 为什么这样对角色心智更好

| 方案 | 玩家读到的是 |
|---|---|
| ❌ 角色调 subagent 装修 | "他接到通知，连夜收拾了一下屋子给我看" |
| ✅ 玩家/引擎直唤 | "他这些年就住在这儿，东西本来就在" |

差别不在技术，在**叙事时态**：一个是完成时（本来就有），一个是过去某刻的动作（刚布置的）。玩家逛小天地是为了看"ta 存在过的证据"（doc-06 §4.1），后者直接破坏这个幻觉。

### 4.3 产出规范

```
characters/旅店老板/
├── preset.json         # （已有，不是初始化产物）
├── README.md           # 若缺则补：type: readme，角色简介（小天地门面）
├── identity.md         # 若缺则补：身份与背景（preset 会引用它 → 见 C4）
├── appearance.md       # 若缺则补：外貌（遮罩立绘描述）
├── personality.md      # 若缺则补：性格
├── 作品.md              # 小天地内容：作品/便签/生活痕迹
└── 一张旧照片.md        # 沉默细节（1~3 个）
```

**"若缺则补"很关键**：holmes-world 的 `characters/watson/` 至今只有 `README.md` + `preset.json`，而 preset 引用了 `identity.md` / `personality.md`（**两个文件都不存在**）。按 C4，只要 slot 用默认的 `onMissing: skip`，这不会报错——但角色 spawn 时就少了履历。**初始化顺带补齐 preset 引用的缺失文件**，正好打通 doc-13 §5 与 doc-05 §4.1 的遗留问题。

**内容纪律**：写"痕迹"不写"设定"。

| 要 | 不要 |
|---|---|
| 一张没写完的账目、一把修过三次的椅子、半瓶酒 | "他是一个善良的人，喜欢喝酒"（那是 identity.md 的活） |
| 留白、矛盾、没解释的细节 | 完整履历、时间线、人物小传 |

### 4.4 初始化后

- 目录不再为空 → **不会二次初始化**（判据同 §3.1）；
- 角色第一次被点开 spawn 时可 `look_at` / `read` 自己的目录，这些陈设成为它理解自身生活的现场材料；现阶段不把它们收编进角色记忆系统；
- 之后角色"顺手写"的增量（doc-05 §4.1 情境一）叠加在上面，看不出接缝。

---

## 5. W2 模板兜底（零 AI）

不是可选项，是**失败降级**与**离线可用**的保底。

| 场景 | 行为 |
|---|---|
| subagent 超时 / 失败 / 模型不可用 | 落模板占位：README 用 stub 文案 + 一个空 chalk，画布提示"这里还没长出来" |
| 离线 / 无模型 | 同上；玩家仍可在里面说话（留言条，doc-06 §2.4） |
| **上帝模式新建空目录**（玩家没写诉求） | 直接落最小模板，不惊动 AI |

模板内容（纯常量，纯函数可单测）：

```json
{ "readme": "type: readme\nname: <目录名>\nmaterial: scene\n---\n\n# <目录名>\n\n（这里还没长出来。）",
  "chalk":  "type: chalk\n---\n\n（你站在这里。还看不清什么。）" }
```

---

## 6. 事件、中断、失败

### 6.1 事件表（doc-05 §5.1 扩展）

新增两类 `type`，进 `.airpworld/history.db`：

| type | detail | 谁消费 |
|---|---|---|
| `layer_initialized` | `{ path, by: "writer"\|"player"\|"engine", files: [...] }` | 作家下一轮感知（"Abandoned Orchard 已经在那儿了"） |
| `layer_init_failed` | `{ path, by, reason, fallback: "template"\|"none" }` | 前端降级提示 + 作家（可重试/现编） |

**作家感知示例**：

```
[世界动态]
- 「Abandoned Orchard」第一次被走出来了（玩家进的，他想要"她最后待的地方"）。
```

### 6.2 中断语义（生成一半玩家切走）

**定案：不中断，让它写完。** 理由：subagent 是 in-process、无独立进程可杀，且写盘是原子的逐文件写；半途放弃会留下"半个场景"（比没有更糟——它已经不为空了，永远不会再初始化）。

| 情况 | 行为 |
|---|---|
| 生成中玩家切层 / Esc | **继续跑完**，写完照常落定；玩家回来时东西已经在那 |
| 生成中玩家在该层说话 | 作家正常叙事（Hook 读到部分文件），不冲突 |
| 引擎进程退出 | subagent 随会话 dispose（`registerSideRequest` 保证 die with session）；未写完的文件**不留残留**（逐文件写，写完才算数） |
| 超时 | `timeoutMs` 到了 → `timed-out` → 落 W2 兜底 + `layer_init_failed` |

**建议超时**：场景初始化 60s；小天地初始化 45s（产出更少）。超时值是配置不是常量。

---

## 7. 落地需要的两处修正

### 7.1 preset 目录：`PI_PROJECT_CONFIG_DIR` + 平铺

> **2026-09-11 复核**：C7 已修（`collectPresetFiles` 递归子目录），所以"必须平铺"从**硬约束降为约定**——`.airpworld/prompt-presets/` 下现在分不分子目录都能被发现。我们**继续平铺**，理由变成了"id 已经足够区分，目录分层只是多一层心智"。递归范围仍限于 `<configDir>/prompt-presets/` 这棵树，树外的文件照样发现不了（见下第三条）。

doc-05 §7.4 早先的 `.airpworld/agent/main/` + `.airpworld/agent/subagent/` 两层写法已废弃，统一为：

```
.airpworld/
└── prompt-presets/          # ← 引擎 spawn 时设 PI_PROJECT_CONFIG_DIR=.airpworld
    ├── writer.json          # 作家（autoActivate: true）
    ├── character.json       # 角色（被角色目录 preset.json 继承/引用）
    ├── scene-init.json      # delegatable: true —— 场景初始化
    └── nook-init.json       # delegatable: true —— 小天地初始化
```

- `CONFIG_DIR_NAME` 来自 `package.json` 的 `piConfig.configDir`（现为 `.pi`），可用 env `PI_PROJECT_CONFIG_DIR` 覆盖 → 引擎 spawn 作家/角色进程时设一次即可；
- **平铺不分层**：作家/角色/子代理 profile 用 `id` 区分（约定，非硬约束，见上）；
- 角色目录里的 `preset.json`（doc-05 §4.1 的 `characters/<名>/preset.json`）**仍然不在发现路径上**——它在 `characters/<名>/` 下，不在 `<configDir>/prompt-presets/` 这棵树里，C7 修好也够不着。所以引擎侧"把它安装进 `prompt-presets/` 再按 id 启动"的动作**依然必需**（落地实现见 `apps/server/src/engine/presets.ts::installPreset`）。

### 7.2 ~~AIRP 扩展须暴露写工具~~（已随 C1 修复作废，2026-09-11）

原文要求 AIRP 扩展注册一个 `write_world_file` 之类的写工具，理由是子代理的默认工具集不含 `write`/`edit`。**这个前提已经不成立**（C1，`402ccc59b`）：初始化器开箱就有 `write`/`edit`。

- 落地时**不要**再造 `write_world_file`——多一层同义工具只会让模型犹豫用哪个；
- AIRP 扩展该注册的是**引擎独有能力**（`chalk` / `look_at` / `move_to` / `move` / `choose` / `roll_dice` / `link` / `arrange`），不是内建工具的替身；
- 这些扩展工具经 `inheritExtensionTools`（默认 true）进 R1；R2 经 `customTools` 交出定义即可，只在显式收窄 `tools` 时才要把名字一并带上（§2.4）。

---

## 8. profile 骨架（可直接转 pi-rp preset JSON）

> **注意**：pi-rp 的 preset 编译器是精确的 JSON，**带注释必炸**（doc-07 A2）。以下去掉注释后使用。

### 8.1 `scene-init.json`

> **2026-09-11 合并**：早先的 `world-subagent.json` 与本 profile 职责重叠，已删除，其语义（brief 委托 / 产出规约 / 三行回报）并入此处。**这是初始化唯一的 profile**——作家委托（R1）与引擎直唤（R2）共用它。

```json
{
  "schemaVersion": 1,
  "id": "scene-init",
  "name": "Scene Initializer",
  "description": "Generates the scene skeleton, object cards, and opening for a blank or stub layer of the world; shared by writer delegation and direct engine invocation",
  "delegatable": true,
  "inheritHistory": 0,
  "items": [
    {
      "kind": "slot",
      "id": "scene-init-instruction",
      "slot": "scene-init-instruction"
    },
    {
      "kind": "slot",
      "id": "skills",
      "slot": "skills"
    }
  ]
}
```

> 与 `hackathon/presets/scene-init.json` **逐字一致**（两处同源，改动要同步）。

### 8.2 `nook-init.json`

```json
{
  "schemaVersion": 1,
  "id": "nook-init",
  "name": "Nook Initializer",
  "description": "Generates the initial furnishings, bearing traces of a life, for a character's or the player's private nook",
  "delegatable": true,
  "inheritHistory": 0,
  "items": [
    {
      "kind": "slot",
      "id": "nook-init-instruction",
      "slot": "nook-init-instruction"
    },
    {
      "kind": "slot",
      "id": "skills",
      "slot": "skills"
    }
  ]
}
```

> §8.1 / §8.2 两份都与 `hackathon/presets/{scene-init,nook-init}.json` **逐字一致**（同源，改动要同步）。
> 没有给初始化器加 `tools.deny: ["subagent"]`：子代理的默认工具集本就不含 `subagent`（见 §2.3 C1），写了也是空转。

---

## 9. 落地清单

### 9.1 赛时最小集

| # | 项 | 类型 | 说明 |
|---|---|---|---|
| 1 | `buildInitBrief(kind, ctx)` | 纯函数 | §2.2 模板，两个入口共用。**可单测** |
| 2 | `scene-init.json` / `nook-init.json` | 纯 JSON 资产 | §8，去掉注释直接用 |
| 3 | `isLayerEmpty(path)` / `isNookEmpty(path)` | 纯函数 | §3.1 / §4.1 判据（有没有非 json 内容）。**可单测** |
| 4 | `INIT_TOOLS` 常量 | 常量 | §2.4 两个入口的工具对齐来源 |
| 5 | W2 模板常量 | 纯常量 | §5 兜底文案 |
| 6 | 幻影占位 + 座位过户 | 前端 | §3.4（复用 doc-06 §2.1/§2.5 的底座） |

### 9.2 赛后

- `layer_initialized` / `layer_init_failed` 进事件表可视化（doc-16 历史面板）；
- 初始化失败可重试（手动"再长一次"）；
- 模板世界可预置"已初始化"的层（doc-15 决定是否预生成）。

---

## 10. 遗留（不在本文定案）

| # | 项 | 归属 |
|---|---|---|
| 1 | 角色目录 `preset.json` 与 pi-rp preset 发现机制的接法（§7.1） | doc-13 / doc-07 §3.5 |
| 2 | 玩家在 stub 层里的"留言条"是否落成真物件 | doc-06 §7 待定 #3 |
| 3 | 小天地初始化后，玩家留痕与角色回应的实时通道 | doc-13 #1 |
| 4 | 上帝模式新建目录的诉求输入 UI | doc-14 |

---

## 边界（2026-09-11 修订）

- 初始化**不预设剧情结论**——不下真相、不预定结局、不替作家把戏写完（开放性原则）；但**开场 chalk 是可选的正经产出**，"不预设剧情"不等于"不许写开场"，见 §3.3；
- 角色小天地初始化 ≠ 角色 spawn（点开聊天才 spawn），两者独立（doc-06 §5.4）；
- **角色 agent 永远不参与初始化**（§1.3）——先有空间，后有灵魂；
- **初始化 profile 只有一个**：`scene-init`（场景）/ `nook-init`（小天地）；旧的 `world-subagent` 已并入 `scene-init` 删除（2026-09-11）。
