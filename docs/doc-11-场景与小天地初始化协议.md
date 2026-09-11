# doc-11 场景与小天地初始化协议（2026-09-11 定案）

> 状态：**已定案（2026-09-11）**。原"待设计清单"五条已全部落定，本文取代 2026-09-11 立项版。
> 展开：doc-05 §3.2（stub 层首次进入实例化）+ §4.1（角色小天地根目录为空触发初始化）。
> 关联：doc-05 §1（懒加载：第一眼才存在）、§4.3（委托协议，profile `scene-init`）、§8.4（manifest `layers.stub`）；doc-06 §2.1（幻影落地）、§4.2（小天地三分情境）；doc-07 §3.5；doc-13 §1（记忆写回）；doc-15（模板骨架）。

---

## 0. 一句话

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

### 2.3 工程约束（pi-rp 源码级实测，2026-09-11）

以下为 `bun` 直跑 `compileMessages` + 通读 `subagent/{prepare,run,spawn}.ts` 的**实测结论**，不是推测。写代码前必读。

| # | 约束 | 证据 | 对 AIRP 的影响 |
|---|---|---|---|
| **C1** | **默认工具集不含 `write`/`edit`**：`effectiveTools = ["read","grep","find","ls","bash"] + 父会话扩展工具` | `prepare.ts:167` | 初始化要落盘，必须依赖 **AIRP 扩展注册的写工具**被继承，或走 `spawnAgent` 显式传 `tools` |
| **C2** | **`preset.tools.allow` 加不出工具**——`allow` 是过滤器不是白名单扩展器 | `policy.ts:8` + `prepare.ts:171` | 别指望在 preset 里 `allow:["write"]` 解决问题；它只会把工具集过滤成空 |
| **C3** | **slot 的 `options` 不展开宏**，`options.path:"{{x}}.md"` 原样传入 → `file not found` | 实测（见下） | **参数化只能走 task 文本**；preset 若要读世界文件，用固定相对路径或绝对路径 |
| **C4** | **`onMissing:"error"` 是致命的**：prepare 把 error 级诊断当失败，整个 subagent 起不来 | `prepare.ts:244` | 初始化 preset 引用"可能不存在"的角色文件（如 `identity.md`）时必须 `skip`（默认）或 `placeholder` |
| **C5** | **cwd 可能不一致**：prepare 用**父会话 cwd** 解析 file slot，子会话实际 `cwd: process.cwd()` | `prepare.ts:180` vs `run.ts:59` | 引擎必须保证 `process.cwd() === 世界根目录`，否则一律用绝对路径 |
| **C6** | **`spawnAgent` 不校验 `delegatable`**；`subagent` 工具与 `/subagent` 命令才校验 | `spawn.ts` vs `extension.ts:93` | 两个入口都能用同一个 profile；`delegatable: true` 只为了让作家侧看得到 |
| **C7** | **preset 目录不递归**：`loadPromptPresets` 只读 `<configDir>/prompt-presets` **顶层** `*.json` | `loader.ts:38` | **doc-05 §7.4 的 `.airpworld/agent/main` + `agent/subagent` 两个子目录发现不了**，必须改（见 §7.1） |
| **C8** | **子会话无扩展运行时**：扩展工具的定义会继承，但事件 handler 不触发 | `prompt-presets.md:843` | 依赖 `agent_start`/`tool_result` 钩子的逻辑在 subagent 里不会跑；`move()` 的落账要写在工具实现**内部** |
| **C9** | 输出被 `truncateTail` 截断（2000 行 / 50KB） | `run.ts:139` | 回报格式必须短（§2.2 三行） |

**C3 的实测记录**（`bun` 直跑 compiler，runtime.variables 带 `who: WORLDNAME`）：

```
block content  "BLOCK-MACRO=[{{who}}]"   → "BLOCK-MACRO=[WORLDNAME]"   ✅
文件内容里     "BODY-MACRO=[{{who}}]"     → "BODY-MACRO=[WORLDNAME]"    ✅  (slot 输出会走 finalizeItemText)
options.path   "/w/{{who}}.md"            → file not found "/w/{{who}}.md"  ❌
```

即：**宏在渲染后的文本上展开，不在 slot 的入参上展开。** 这一条决定了 §2.1 的"preset 静态 / brief 动态"分工不是风格选择，是硬约束。

### 2.4 工具集对齐表（两个入口要给出相同的工具）

| 入口 | 怎么给工具 | 建议值 |
|---|---|---|
| **R1 作家委托**（`subagent` 工具） | 无法显式传；= 默认集 + 父会话扩展工具 | AIRP 扩展须注册写工具（`write_world_file` 或让 `write`/`edit` 通过 `customTools` 可见） |
| **R2 引擎直唤**（`ctx.spawnAgent`） | 显式 `tools` + `customTools` | `tools: ["read","write","edit","bash","grep","find","ls", ...AIRP扩展工具名]` |

> **对齐要求**：R2 传的 `tools` 必须与 R1 的 `effectiveTools` **逐项一致**，否则同一份 brief 在两个入口下产出能力不同（作家能生成、玩家触发不能）。引擎侧抽出 `INIT_TOOLS` 常量，`subagent` 工具路径的扩展工具清单从同一常量导出。

---

## 3. 场景（stub 层）初始化

### 3.1 判定：什么时候该初始化

| 条件 | 动作 |
|---|---|
| 层 key 在 `world.json.layers` 里 `stub: true`，**且目录里没有 README.md** | 进入时初始化 |
| 目录里已有 README.md（哪怕写过一次） | **不初始化**——已经存在了，叙事由作家现编 |
| 非 stub 层 | 不初始化（模板预写，doc-15） |

**判据是"目录有没有 README.md"，不是"有没有进过"** —— 路径即 id，文件即真相，不额外记"已初始化"标志。

### 3.2 两条路径

**R1（作家委托）**：玩家在**父层**说出意图（"我要去 Abandoned Orchard 看看"）→ 作家判断这是从零→100 → 委托 `scene-init` → subagent 写盘 → 作家摘要过目 → 玩家再进门时东西已经在那儿。

**R2（玩家直唤）**：玩家**直接双击** stub 卡 → 穿越动画里给一行输入机会（"这里是……"，可跳过）→ 引擎拼 brief → spawn → 玩家**已经在场**，看着它长出来。

**两条路径都合法，且经常同时发生**（明月 2026-09-11）：世界的场景同时需要"作家主动外包"和"玩家自己进来时给需求"。它们不冲突——判据是"目录有没有 README.md"，谁先到谁写，后来的那个看到目录非空就自动跳过。

### 3.3 产出规范

```
world/baker-street/crime-scene/
├── README.md          # type: readme，material: scene，含 name + bg/bgStyle
├── evening.md         # type: chalk —— 开场白（≤200 字，可带 status / initial choice）
└── rusted-key.md      # 物件（chalk / component，2~4 个）
```

| 产出 | 要求 |
|---|---|
| **README.md** | `type: readme` + `material: scene` + `bg`（底图）+ 标题 + 一句话摘要。**覆盖掉 stub 占位**（原 stub README 里 `material: stub`） |
| **开场白 chalk（可选，强烈建议）** | 这一层"被玩家看见"的那一下，**缺了它入戏效果会差很多**（2026-09-11 明月修正：早先写成"绝对不写"是错的）。一段环境叙事，≤200 字（doc-07 纪律）；**可以带 `status` 快照，也可以给一组 `initial choice`** 作为玩家起步的抓手 |
| **物件 2~4 个** | 沉默细节优先（桌上的杯子、椅子的摆法、纸上的字），不是"线索大礼包"。可含 1 个可拿走的（给背包用） |

> **"开场白可选"与"不预设剧情"不冲突**（两者是不同维度）：
> - **允许**：写"你站在这里看到什么"、给起步选项、给状态快照——这些是**入口的手感**；
> - **禁止**：下剧情结论、揭示真相、预定结局、替作家把这段戏写完——那些是**叙事主体（作家）的活**。
>
> 换句话说：初始化可以**开门**，不可以**演戏**。

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
- 角色第一次被点开 spawn 时，`read` 自己的目录 → 这些陈设成为它的记忆底座，**它天然认领**（doc-13 §4）；
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

### 7.1 preset 目录：改为 `PI_PROJECT_CONFIG_DIR` + 平铺（C7）

doc-05 §7.4 现在的 `.airpworld/agent/main/` + `.airpworld/agent/subagent/` **发现不了**（`loadPromptPresets` 只读顶层）。改为：

```
.airpworld/
└── prompt-presets/          # ← 引擎 spawn 时设 PI_PROJECT_CONFIG_DIR=.airpworld
    ├── writer.json          # 作家（autoActivate: true）
    ├── character.json       # 角色（被角色目录 preset.json 继承/引用）
    ├── scene-init.json      # delegatable: true —— 场景初始化
    └── nook-init.json       # delegatable: true —— 小天地初始化
```

- `CONFIG_DIR_NAME` 来自 `package.json` 的 `piConfig.configDir`（现为 `.pi`），可用 env `PI_PROJECT_CONFIG_DIR` 覆盖 → 引擎 spawn 作家/角色进程时设一次即可；
- **平铺不分层**：作家/角色/子代理 profile 用 `id` 区分，目录不分子目录；
- 角色目录里的 `preset.json`（doc-05 §4.1 的 `characters/<名>/preset.json`）**不在发现路径上**——它是角色自己的配置，由引擎读取后作为角色进程的 `--preset` 或经 `customTools`/`initialMessages` 注入。**这一条需要 doc-13/doc-07 §3.5 确认接法**（见 §8 遗留）。

### 7.2 AIRP 扩展须暴露写工具（C1/C2）

`scene-init` / `nook-init` 要落盘，最干净的做法是让 AIRP 扩展注册写工具（如 `write_world_file`），这样：

- R1 路径：扩展工具自动并进 `effectiveTools`（`inheritExtensionTools` 默认 true）→ 作家委托可用；
- R2 路径：`spawnAgent({ tools: INIT_TOOLS, customTools: [...扩展工具定义] })` 显式带上 → 玩家触发也可用；
- 两处工具名来自同一个 `INIT_TOOLS`（§2.4 对齐）。

> 若引擎侧直接暴露内置 `write`/`edit`：R1 路径拿不到（不在默认集、allow 加不进去，**C1+C2**），仍然必须走扩展工具或 R2 显式传。二选一，但**不能两个入口各用一套**。

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
      "kind": "block",
      "id": "role",
      "role": "system",
      "content": "You are the AIRP Scene Init. You take a brief from the Writer or the engine, and your job is to create this layer's \"first look\" inside the given scene directory.\n\nWhen the player first walks into a place, there is nothing here yet—you are the one who makes it exist at first sight."
    },
    {
      "kind": "block",
      "id": "output",
      "role": "system",
      "content": "[Deliverables]\n1. README.md — the scene cover: title, mood, and material skin declaration (consistent with the parent layer and genre tone given in the brief)\n2. 2–4 object markdown files (props / clues / observation points, of which at most 1 is takeable)\n3. 1 opening passage chalk.md (<=200 words)"
    },
    {
      "kind": "block",
      "id": "opening",
      "role": "system",
      "content": "[Opening (Optional, but Strongly Recommended)]\nThe opening is the moment this layer is \"seen by the player\"; without it, the immersion suffers a great deal. It may carry a status snapshot, or give a set of initial choices as a foothold for the player to start from.\nBut it is responsible only for \"what you see, standing here right now\"—do not presuppose plot conclusions, do not spoil, do not reveal the truth."
    },
    {
      "kind": "block",
      "id": "discipline",
      "role": "system",
      "content": "[Discipline]\n1. Strictly follow the genre tone, parent-layer relationships, and constraints given in the brief.\n2. Preserve omission and suspense; never impose absolute conclusions or pre-ordain spoilers.\n3. Silent detail over listed worldbuilding: an unwashed cup is more useful than a paragraph of background.\n4. Do not repeat what the brief's \"known clues\" have already covered.\n5. Write files with the engine's write tool, using the target path given in the brief."
    },
    {
      "kind": "block",
      "id": "report",
      "role": "system",
      "content": "When done, return a short three-line report: list of paths / one-sentence summary / the single detail most worth noticing."
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
      "kind": "block",
      "id": "role",
      "role": "system",
      "content": "You are the AIRP private nook initializer. This is a character's intimate space or the player's personal stronghold.\nYour job is to generate letters, diary fragments, and personal item cards that stand for their traces of living and their past experiences, based on the character's profile or the player's identity.\nThese items should carry historical and emotional weight, letting one glimpse their personality and past secrets at a glance."
    },
    {
      "kind": "block",
      "id": "discipline",
      "role": "system",
      "content": "[Discipline]\n1. Write traces, not verdicts: \"a chair repaired three times\", not \"he is nostalgic\"—do not write what kind of person he is (that is the identity files' job), only the things that show how he lives.\n2. These things were not just bought; they are worn from his years of use.\n3. Leave blanks: there can be unexplained things, contradictions, empty space. No complete résumé.\n4. Do not write what the character is doing right now—only the furnishings of the space.\n5. If the brief notes that identity files referenced by the preset are missing (identity / appearance / personality), fill them in along the way; fill in facts, not judgments.\n6. 2–4 content files, placed in the character's root directory.\n7. Report in three lines: list of paths / one-sentence summary / the single detail most worth noticing."
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

- 初始化**不预设剧情结论**——不下真相、不预定结局、不替作家把戏写完（开放性原则）；但**开场白是可选的正经产出**，"不预设剧情"不等于"不许写开场白"，见 §3.3；
- 角色小天地初始化 ≠ 角色 spawn（点开聊天才 spawn），两者独立（doc-06 §5.4）；
- **角色 agent 永远不参与初始化**（§1.3）——先有空间，后有灵魂；
- **初始化 profile 只有一个**：`scene-init`（场景）/ `nook-init`（小天地）；旧的 `world-subagent` 已并入 `scene-init` 删除（2026-09-11）。
