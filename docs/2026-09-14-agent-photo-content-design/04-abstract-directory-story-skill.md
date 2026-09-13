# 抽象目录剧情 Skill 设计

## 1. 一句话定位

`abstract-directory-story` 是给 Writer（以及需要代写场景骨架的 initializer）看的平台教程：用 `world/**` 下的普通目录表达时间、平行剧情、关键决策与结局，用已有的 README、入口 Chalk、子目录门卡、choice、roll 和普通叙事把它们写成可进入的世界；它不建立分支状态机，也不把一次选择伪装成已经发生的程序化后果。

本文是设计，不落 `SKILL.md`、不改运行时代码、不改共同契约。所有“现状”均带代码或模板证据；带 `[推断]` 的句子是本设计建议。

## 2. 产物、受众与输入/输出

### 2.1 计划产物

唯一的内容产物是：

```text
skills/abstract-directory-story/SKILL.md   # NEW；平台级 Skill
```

Skill 的 frontmatter 应采用平台现有两字段格式（`skills/README.md:14-40`）：

```yaml
---
name: abstract-directory-story
description: "Use when shaping time, parallel plot, a consequential decision, or an ending with ordinary world directories, parent README gates, opening chalk, and one current path; never invent branch state or automatic consequences."
---
```

`name` 和目录名均为 ASCII 小写 kebab-case；description 要说明“什么时候读”，正文再提供判据。平台的 `skills/` 目录会递归发现含 `SKILL.md` 的目录（`vendor/pi-rp/packages/coding-agent/src/core/skills.ts:160-220,223-275`），并把 description 与位置放入 Writer 可见的技能清单（`vendor/pi-rp/packages/coding-agent/src/core/skills.ts:327-360`）。现有启动器已经把仓库级 `skills/` 与世界级 `<worldRoot>/skills/` 一起作为 `--skill` 目录传入（`apps/server/src/engine/presets.ts:95-120`），所以本设计不增加第二个装配入口。

### 2.2 输入

| 输入 | 语义 | 证据/限制 |
|---|---|---|
| Writer 当前回合的 state block | 当前 viewpoint、层、在场、背包、最近事件；是动态事实，不是 branch 状态 | Writer 指令要求把 state block 当索引，并先 `look_at`/`read` 触及的路径（`extensions/instructions.ts:66-72`） |
| 当前层路径 | 这一个回合允许修改的“当前路径”锚点，例如 `world/time-map/tonight/tokiwa-electronics` | 目录派生层的 id 是 `world/` 相对目录（`packages/shared/src/store/layers.ts:26-39,51-95`）；不得只用显示名 |
| 玩家请求或已发生的 `choice_selected` / `roll_resolved` | 叙事触发，不是自动分支命令 | choice 只追加 `choice_selected`（`packages/shared/src/actions/choose.ts:41-46,142-168`）；roll 由引擎回写结果并追加事件（`packages/shared/src/actions/roll-dice.ts:86-109`） |
| 当前层、父层 README 与入口 Chalk | 地点身份、父子关系、入口感知、已声明选项与门槛 | `/api/layer` 读当前层文件和直接子层门牌（`apps/server/src/routes/world.ts:699-728`） |
| 需要写入或移动的现实文件 | 物件、信、线索、角色在场等可验证后果 | Writer 指令要求写入 Chalk，物件用 `move`，角色用 `move_to`（`extensions/instructions.ts:74-85,112-124`） |
角色与玩家目录是本 Skill 的边界：`characters/{id}/` 是独立 nook，`player/` 是玩家背包/私人空间，二者都不是普通 world layer；这里的 `characters/watson/README.md` 仅可作为角色事实或门槛所引用的路径，不能放进四种目录语义的层树。当前共同契约明确排除这两类目录（`docs/2026-09-14-agent-photo-content-design/00-共同上下文.md:26-30`）；本 Skill 不设计 player stronghold，也不把角色配置或 nook 生活内容投影成剧情分支目录。

漏了会怎样：把 `characters/**` 或 `player/**` 当 `world/**` 子层会让路径身份、preset、背包和角色小天地混在一起；把角色 README 当普通 gate 会绕过 nook 专用读取与门禁。


初始化 brief 不应被当作剧情状态：scene-init 只得到初始化需要的 brief，当前实现的一次初始化只 spawn 一个 initializer（`extensions/toolkit/init-command.ts:286-315`）。复杂世界的父场景先设计、再分步生成是教程工作法，不声称现有 `airp-init` 能批量编排分支。

### 2.3 输出

Skill 的输出不是 JSON、不是 `branch_state` 文件，也不是一次“分支切换”调用，而是普通世界产物：

1. 在当前允许的 `world/...` 目录中，通过 `chalk`、`write`、`edit`、`move`、`move_to` 等既有动作落盘；
2. 让 parent README、entry Chalk、子目录 README/可选独立 gate 和正文互相指向真实路径；
3. 由既有 action 记录既有事件；
4. 把控制权还给玩家，或在满足终局条件后停笔。

## 3. 教程正文结构（待落盘的 Skill 骨架）

正文按以下顺序写，避免把世界作者的具体剧情硬编码进平台 Skill：

1. `# Directory stories are ordinary layers`：先给结论——目录是语义，不是新的状态命名空间。
2. `## The anatomy of one layer`：parent README、entry Chalk、直接子层 README/gate、场景内物件和后续 Chalk 的职责。
3. `## Name the paths`：ASCII kebab-case 目录、world-relative POSIX 路径、`NN-slug.md` Chalk 命名、`README.md` 例外。
4. `## Express four story shapes`：时间、平行剧情、关键决策、结局各用普通目录示例。
5. `## Work on one current path`：一回合只读写当前路径及确实触及的文件，不预写兄弟目录。
6. `## Reuse entering, presenting, choice, and roll`：明确点击门、层呈现、选择、骰子均复用既有机制。
7. `## Ending means stop writing`：结局的落盘证据、停笔与回访规则。
8. `## What this skill must never invent`：禁止第二状态、自动后果、世界分支事件、假 rollback。
9. `## Failure boundaries`：路径、stub、门槛、重复写入和不完整交互的诚实处理。

正文可保留一个最小结构例子；例子只是教程语义，不是模板要求：

```text
world/
  README.md
  01-opening.md
  time-map/
    README.md
    01-opening.md
    1994/
      README.md
      01-opening.md
    tonight/
      README.md
      01-opening.md
  parallel-left/
    README.md
    01-opening.md
  parallel-right/
    README.md
    01-opening.md
  endings/
    README.md
    quiet-return/
      README.md
      01-ending.md
```

每一个目录都仍由 `deriveLayers` 从 `world/**` 扫描得到普通 layer；`childLayers` 只取直接子层（`packages/shared/src/store/layers.ts:56-95,121-128`）。`time-map`、`parallel-left`、`quiet-return` 这些词只帮助读者读懂故事，不是引擎识别的类型。

## 4. 教程逐步行为与漏项后果

### Step 1：先确认当前路径与叙事触发

1. 读 state block，确认当前 `world/...` layer；读当前层 README、其父 README、入口 Chalk 和玩家本轮实际触及的文件。
2. 若事件只说玩家刚作出选择或骰子刚结算，先读取对应 source path，再决定后果。
3. 若当前层未知，不根据目录名、上一次聊天或 pi-rp 会话分支猜测；只写能由已读文件支持的中性回应，或请求缺失信息。

漏了会怎样：只看显示标题会把平行目录或不同时间混成一个现场；把会话树分支摘要误当世界分支，会把废弃的模型思路写成世界事实。Writer 本身明确要求先读路径而不是凭索引/目录名叙事（`extensions/instructions.ts:66-72`）；pi-rp 的 branch summary 只总结“这段 conversation branch 的 Goal/Progress/Next Steps”（`vendor/pi-rp/packages/coding-agent/src/core/compaction/branch-summarization.ts:265-301`），不提供世界 branch identity。

### Step 2：先写父层 README，再写它的入口 Chalk

对一个要被进入的 authored layer，按以下顺序准备：

1. `README.md` 是该层的门牌/配置：写 `name`、`title`（如世界已有约定则保留）、一段玩家到达时能看见的摘要；可写既有 `bg` 等声明，但不添加本 Skill 的隐藏字段。
2. 同目录写一个 `01-opening.md`，frontmatter 为 `type: chalk`，正文只写抵达时的感官和一个未完的动作；复杂互动先写 prose，再用第二次 `edit` 添加 `choice` 或 `roll_dice`。现有 Writer 指令要求 opening Chalk 不超过 200 words，且 interactive 字段在第二阶段添加（`extensions/instructions.ts:254-265`、`extensions/instructions.ts:126-144`）。
3. 若该层是其他目录的直接子层，README 就是父层页面上的门牌；当前层自己的 README 不应再作为自身内容卡重复摆放。`cardsOfLayer` 排除自己的 README（`packages/shared/src/store/layers.ts:98-113`），而 `/api/layer` 另把直接子层 README 作为 door item 返回（`apps/server/src/routes/world.ts:704-728`）。

漏了会怎样：没有父 README，父层本身仍是 stub，玩家只能看到空/占位门；没有 entry Chalk，玩家进入后没有第一眼叙事；把 README 当普通正文重复放置，会制造一个与场景配置重叠的“ghost door”。

### Step 3：用子目录 README 与可选独立 gate 形成入口，不用特殊分支对象

1. 需要去往下一时刻、下一条剧情线或结局时，在当前 layer 的父目录下创建一个普通子目录。
2. 为已写的子层创建 `child/README.md`；**所有 layer-root README（包括 child）使用 `type: readme`**，并写稳定 `name/title` 和门牌摘要。README 文件名本身会被父层当作自动门牌，Renderer 把 `filename === 'README.md'` 或独立文件的 `type: gate` 作为 gate（`apps/web/src/components/canvas/CardRenderer.tsx:127-158`）；child README 缺少显式 `target` 时，目标由其 README 路径推导。
3. 若需要一个独立、可命名的入口门，才在父层写 `<child>-door.md`（例如 `time-map-door.md`），frontmatter 使用 `type: gate` 和完整 `target: world/...`；child 的 `README.md` 仍保持 `type: readme`。不要同时把同一 child 的自动 README 门和独立 gate 都当作两个推荐入口。`/api/layer` 明确用 authored gate 替换自动 child sign（`apps/server/src/routes/world.ts:729-732`）。
4. 门槛只使用现有 `requires.items`，且每个要求必须是 `player/*.md` 背包路径；关键决策、时间或“已走过某分支”不能伪装成 `requires.items`。`/api/enter-layer` 只校验目标 README 的 `requires.items`（`apps/server/src/routes/world.ts:1166-1208`）。

漏了会怎样：把 child README 写成 `type: gate` 会违反 layer-root README 契约，并让入口配置和门牌类型漂移；只写 gate 文件而没有目标 layer，点击会得到 not-found；重复门会遮蔽或替换自动门，玩家无法判断哪一张是真入口；把选择或时间写成物件门槛会导致永久锁门或错误地把一个抽象事实当背包物件。

### Step 4：用目录名表达四种剧情形状

Skill 用相同目录机制教四种语义，不为每种语义发明一套字段：

| 叙事语义 | 普通目录例子 | 该目录内应有 | 不应暗示 |
|---|---|---|---|
| 时间 | `world/time-map/1994/`、`world/time-map/tonight/` | 各自 README、opening Chalk、各时间确实可见的物件 | 时间切换会自动重写另一时层 |
| 平行剧情 | `world/parallel-left/`、`world/parallel-right/` | 各自 README/gate 与本线正文 | 存在一个 engine 维护的 active branch |
| 关键决策 | `world/after-decision/accept/`、`world/after-decision/decline/` | 选择发生后由 Writer 写出的、可验证的后果 | 点击 choice 自动进入目标或自动写结果 |
| 结局 | `world/endings/quiet-return/` | 结局 README、ending Chalk、实际收束物件/关系变化 | 目录出现即触发 ending 事件 |

示例中的 `1994`、`accept` 等是目录名，不能成为隐含状态变量。现有 Divergence playtest 已用 `world/time-map/1994`、`tonight`、`thirty-years-later` 的层级写时间（`templates/divergence-playtest/world/time-map/README.md:1-14`、`templates/divergence-playtest/world/time-map/1994/README.md:1-9`、`templates/divergence-playtest/world/time-map/tonight/README.md:1-9`），这是可复用的内容模式，不是引擎增加的时间 API。

漏了会怎样：把“时间/平行/结局”当专用类型会逼实现者增加第二套解析和状态真相；把目录名当自动指令会在玩家尚未进入时预写后果，造成不可见剧情和假分支。

### Step 5：一回合只写一个当前路径

每个 Writer 回合实行以下纪律：

1. 以 state block 的当前 layer 作为唯一写作范围；从当前路径向父 README 回读是允许的，从当前路径向兄弟层写入不允许。
2. 选择/骰子只触发当前 entity 的后果。需要进入另一层时，先在当前 Chalk 中写“下一步可见的门/意图”，再由玩家点击 gate 触发 `enter-layer`；不要在处理 choice 的同一回合直接改写未进入的 sibling。
3. 只有玩家明确进入、明确要求预先写骨架，或 world 内容本来就已经预写的路径，才可读/写其他层；即使预写，也不能把它说成当前 active branch。
4. 所有现实后果落到可读文件或既有动作：更新受影响的 README/物件、移动实际物件、移动角色在场；不要只在回复中宣告“已经改变”。
5. 回合结束前重读本回合改动的文件，确认没有把未来路径、未读秘密或另一时间的事实混入当前正文。

漏了会怎样：同时写左右线会让两个未访问分支互相泄漏；只写对话不改文件会让下一轮 state block 仍显示旧世界；从父 README 的门牌摘要推测子层细节，会产生与真实文件矛盾的场景。Writer 指令把 Chalk、文件、`move`/`move_to` 作为世界反应的落点（`extensions/instructions.ts:74-85,112-124`）。

### Step 6：复用现有进入与呈现

1. 父层页面由既有 `/api/layer` 读取本层直接 Markdown 与直接子层 doors；不会递归把孙层内容摊到父层（`apps/server/src/routes/world.ts:699-728`、`packages/shared/src/store/layers.ts:98-128`）。
2. 玩家点击/键盘激活子层 gate 后，既有 `enterLayer` 接收 layer id、计算 `first` 并追加 `layer_entered`（`packages/shared/src/actions/layer.ts:42-87`）；Skill 不增加 `enter_time` 或 `switch_branch`。
3. 无 README 的目标是现有 stub 入口：进入路由不把缺 README 伪装成门槛失败，而是先记录 `layer_entered`，再由既有初始化链路处理（`apps/server/src/routes/world.ts:1210-1223`）。Skill 只教如何给 initializer 一个明确的 target path 和父 README；不在 prose 中声称初始化已经完成。
4. 普通 `chalk`、`note`、`letter`、已注册 component 仍按既有呈现，不增加 timeline/branch/end 专用卡。组件 kind 需要先 `get_component`，否则回退或交互缺失（`skills/component-narration/SKILL.md:13-40`）。

漏了会怎样：把目录当作不可见“传送状态”会绕过 layer_entered；把层级递归呈现会把未进入的剧情事实泄露给玩家；发明 timeline 卡或 branch 卡会形成第二 renderer 和第二份状态。

### Step 7：choice 只记录选择，Writer 写后果

1. 在当前入口 Chalk 或实体上声明一个真正需要玩家决定的 choice；用真实存在的 `choice` 形状，不把 `then` 当自动剧情脚本。`ChoiceOptionSchema.then` 虽可被解析，但注释明确是 post-hackathon slot（`packages/shared/src/schemas/frontmatter.ts:37-50`）。
2. 玩家按下选项后，现有 `chooseOption(ctx, { path, choice })` 重新读取 source，解析可见选项，只追加 `choice_selected`（`packages/shared/src/actions/choose.ts:48-50,89-120,140-168`）。
3. Writer 在下一次上下文中读事件指向的 source path 与相关文件，写一个具体、有限的回应。`computeNextStep` 对 `choice_selected` 的要求是“回答这次选择在本回合导致了什么”，不是让 action 自己推进世界（`packages/shared/src/render/next-step.ts:48-57,71-95,106-133`）。
4. 即使 world 的 `autoWrite` 设置为 `scenes-and-choices`，路由做的也只是 dispatch 一个 Writer prompt；choice action 本身仍不写文件、不删除选项、不决定 consequence（`apps/server/src/routes/world.ts:1146-1155`）。

漏了会怎样：如果把按钮当作分支跳转，玩家会看到“选择已完成”但 source 文件、门和物件都没变；如果把 `then` 或 choice label 当程序化后果，未来实现者会误以为引擎维护了分支状态；如果一次选择同时写两条线，会违反单次当前分支纪律。

### Step 8：roll 只让引擎结算，结果再由 Writer 叙事

1. 在真正不确定的当前实体上声明 `roll_dice.type/desc/expect`，`expect` 使用带引号的字符串；不在目录名或 choice 中写随机结果。
2. 玩家触发 `rollDice(ctx, { path })`；引擎读取声明，生成结果，写回 `result/passed` 并追加 `roll_resolved`。调用方不能传结果，除 god-only 的既有 `forcedResult` 例外（`packages/shared/src/actions/roll-dice.ts:15-23,86-109`）。
3. Writer 读结果并把成功/失败写成当前路径的实际变化；失败应改变代价、路线或信息，不直接关闭所有可行动作。不要根据结果自动选择一个目录，也不要为未进入的目录写结局。
4. 有旧 `result` 的实体不要重复 roll；如确需重开，按既有 edit 规则先处理旧声明/结果，而不是在 Skill 内设计 reroll 状态。

漏了会怎样：预先写 result 会把作者猜测伪装成引擎事实；把骰子结果直接映射为目录切换会假装已有程序化 branching；重复 roll 会产生互相矛盾的记录。

### Step 9：满足实际收束后写结局并停笔

“结局”在本 Skill 中是一次由玩家行动和既有 RP 支撑的普通内容落盘，不是首次进入某目录、首次承诺、一次 choice 或一次 roll 自动触发。

1. 先读取已访问相关层的 README、实际 Chalk、choice/roll 事件、玩家/角色相关文件和真实物件去向；只依据发生过的事实写收束。
2. 由玩家明确的收束行动，或已有世界内容明确规定的最终门，进入一个普通 ending layer；写该层 README、一个 `01-ending.md`（或保留已存在的 ending Chalk）和必要的结局物件/关系变化。
3. Ending Chalk 只说发生过的收束和留下的具体事实，不提前生成另一个结局，不把“以后还能继续”写成已经发生的后日谈。
4. 结局文件与相关事实核对后，Writer 停止自动推进：不再因为回访、静默或系统刷新写新结局，不再自动生成兄弟 ending，不再把普通新输入偷偷并入旧 ending。
5. 回访已完成 ending 时，读取并复用既有结局；只有玩家明确提出继续、重写或另开一次新叙事时，才开始一个新回合。这个“停笔”是 Writer 的内容纪律，不是假称当前引擎有 ending gate。

可选地，世界作者可以在 ending README 自己的现有 `status.data` 里记一个普通扁平值，例如 `closingState: complete`；这只是该文件的叙事快照。`status` 的定义是实体 frontmatter 的快照而非独立状态系统（`packages/shared/src/schemas/frontmatter.ts:13-35`），本 Skill 不要求所有世界采用这个字段，也不把它升级成全局 active branch。

漏了会怎样：结局过早会抹掉玩家尚未经历的线索；每次回访重新抽结局会破坏已落盘事实；只在聊天里宣布结束会让世界没有持久结果；强行写一个“结束事件”会与当前事件契约不一致。

## 5. 路径命名与正文纪律

### 5.1 路径

- 面向 Agent 的文件路径始终是 world-root 相对 POSIX 路径：`world/time-map/tonight/README.md`、`player/clockwork-frog.md`、`characters/watson/README.md`。不使用显示标题替代路径；其中 `player/...` 与 `characters/...` 在本 Skill 中仅是被引用的现实文件路径，绝不能作为普通 layer、剧情目录或 player stronghold 目标。
- 目录名与新 Chalk 文件名使用 ASCII 小写 kebab-case；目录不能使用绝对路径、`.`、`..`、隐藏段。`README.md` 是唯一约定的大写例外。共同契约冻结了 world-relative path 与稳定角色 id（`docs/2026-09-14-agent-photo-content-design/00-共同上下文.md:18-30`）。
- 新 Chalk 走现有 `chalk` 的默认命名：`<layer>/NN-<slug>.md`。`nextOrdinal` 从已有数字前缀递增，不复用空洞；非 ASCII title 不转写（`packages/shared/src/actions/chalk.ts:109-138`）。
- 教程示例使用 `01-opening.md`、`02-investigate.md`、`01-ending.md`；不要把 `opening.md`、`evening.md`、`01-opening.md` 混称为引擎同一保留名。
- `target`、`near`、`link_to` 等参数只写已确认存在的 world-relative 路径；不从显示标题猜路径，不用 bash 直接搬文件。

### 5.2 README / gate / entry 的最小关系

```text
parent layer/README.md              # 父层 type: readme；配置与门牌语境（自身页面的 scene）
parent layer/01-opening.md          # 父层抵达时 Chalk
parent layer/child/README.md       # child type: readme；父层的自动门牌，同时是 child 的层配置
parent layer/<child>-door.md        # 可选 type: gate；只有需要独立入口门时才写，target 指向 child layer
parent layer/child/01-opening.md    # 进入 child 后的第一段 Chalk
```

父 README 的 body 可以列出“可见的下一扇门”与未解问题，但不代替子 README 或子 Chalk；子 README 的摘要可被父层展示，但不声称玩家已经进入子层。README 是否存在决定层是否已 materialize 的现状判据见第 11 节冲突，不由 Skill 私自改写。

### 5.3 普通 YAML 交互

教程只给可执行的既有形状：

```yaml
# entry Chalk 或实体的 frontmatter（示意）
choice:
  - id: inspect-fax
    label: "Read the fax"
  - id: leave-it
    label: "Leave it untouched"
roll_dice:
  type: "1d100"
  desc: "Reach the jammed drawer without breaking the seal"
  expect: ">50"
```

choice 与 roll 不得同时被写成“点击即改变目录”。`choice`/`roll_dice`/`status` 都是实体 frontmatter 上的既有互动字段（`packages/shared/src/schemas/frontmatter.ts:92-100`），不是剧情状态对象。

## 6. 文件与副作用

### 6.1 Skill 本身

| 路径 | 操作 | 副作用 |
|---|---|---|
| `skills/abstract-directory-story/SKILL.md` | NEW | 仅被资源加载器读取；不写 world、不写事件、不增加 WS |
| `skills/README.md` | 本设计不改 | 现有 README 已定义平台/世界 Skill 分层和 frontmatter 形状（`skills/README.md:1-40`） |
| `apps/server/src/engine/presets.ts` | 本设计不改 | 现有 `skillArgs` 会因 `skills/` 已存在而带入整个目录（`apps/server/src/engine/presets.ts:114-120`） |

   - `tools/check-skills.mjs` 的 `TRIGGERS_BY_SKILL`/`EXPECTED_PLATFORM` 必须登记 `abstract-directory-story`，并以 `loadSkillsFromDir`、`skillArgs` 和 Writer/Character 新 session 的 `<available_skills>` 正负探针验收；Skill 对 Character 可见但只提供叙事纪律，不能授权 Writer-only 工具。

### 6.2 Writer 按教程写世界时

- `README.md`、entry Chalk、对象文件落盘后由既有文件扫描/层呈现读取；`writeChalk` 负责默认文件名、`type: chalk` 骨架、写入和 `entity_created`/`entity_edited`（`packages/shared/src/actions/chalk.ts:1-12,389-392,498-537`）。
- `move`/`move_to`/`edit` 等继续产生既有文件和既有事件；不新增“branch file”。
- `chooseOption` 只追加 `choice_selected`，不写 source；`rollDice` 回写 source 并追加 `roll_resolved`；`enterLayer` 追加 `layer_entered`；以上均是既有动作。
- 没有 README 的 stub 进入可能触发 `airp-init`。初始化成功/失败由既有 `layer_initialized`/`layer_init_failed` 记录；教程不把这当 ending 或 branch 事件。`airp-init` 的产品检查和 fallback 在 `extensions/toolkit/init-command.ts:240-352`。
- 不使用 bash `mv`、手写数据库或新 WS 来模拟目录切换；Writer 指令明确要求世界可见改变走既有工具（`extensions/instructions.ts:155-162`）。

## 7. 状态、事件与 WS 边界

### 7.1 唯一真相

- 目录层级由 `world/**` 扫描得到；`world/` 映射到虚拟根 layer id `map`，不是新的故事状态命名空间（`packages/shared/src/store/layers.ts:26-39,60-95`）。
- 当前写作范围由 state block 的当前 layer + 已读取文件确定，不由目录名推导 active branch。Writer 的常驻规则也要求 state block 是事实、路径全文需先读（`extensions/instructions.ts:66-72`）。
- `status.data` 只能是随实体文件走的扁平快照；本 Skill 不得创建 `world/state.md`、`branch_state`、`active_branch`、`timeline.json` 或同类第二真相。`StatusSchema` 明确它是实体 frontmatter 的 key/value 快照（`packages/shared/src/schemas/frontmatter.ts:13-35`）。

### 7.2 现有事件可复用什么

当前封闭事件类型包含 `choice_selected`、`roll_resolved`、`layer_entered`、`layer_initialized`、`layer_init_failed`，也列有 `world_snapshot`、`world_rolled_back`（`packages/shared/src/schemas/events.ts:9-28`）；其中 choice 和 roll 的 detail 形状见 `packages/shared/src/schemas/events.ts:72-108`。本 Skill 只使用已实现、与正常叙事直接相关的事件：

- `choice_selected`：玩家选了什么；后果由 Writer 处理。
- `roll_resolved`：引擎实际掷了什么；后果由 Writer 处理。
- `layer_entered`：玩家进入哪个 layer、是否首次；不表示 active branch。
- `entity_created`/`entity_edited`、移动和物件使用事件：记录文件/动作的事实。
- `layer_initialized`/`layer_init_failed`：初始化生命周期；不表示结局。

事件 detail 不能被 Skill 重新解释成“timeline identity”或“ending identity”。`computeNextStep` 的 interactive whitelist 只有 `choice_selected`、`use_item_on`、`roll_resolved`（`packages/shared/src/render/next-step.ts:67-75`）；没有自动 ending/branch imperative。

### 7.3 WS

没有新 WS 类型、没有第二条事件通道。现有 EventBridge 从已提交的 `events` 表读取并逐条广播 `world_event`（`apps/server/src/engine/event-bridge.ts:423-453`）；`/api/layer` 和已有前端刷新负责呈现文件。教程不得要求 `branch_switched`、`ending_reached`、`rollback_done` 等未冻结的帧。

### 7.4 必须诚实写出的当前边界

1. **没有世界级 branch identity。** 当前事件 schema 没有 branch identity/active branch 字段；Writer preset 的 branch summary 只是会话树上下文摘要（`presets/writer.json:6-13`），不能拿来表示世界分支。
2. **没有 active branch。** 当前目录名和当前 state layer 只能说明路径，不说明某个“活跃分支”；Skill 只能实行“一次当前路径写作纪律”，不能宣称切换完成。
3. **没有 ending 事件。** 封闭 `WORLD_EVENT_TYPES` 中没有 `ending_reached`/`story_ended`（`packages/shared/src/schemas/events.ts:9-28`）；ending 的落盘只能由普通实体事件和普通文件事实支撑。
4. **没有可用 rollback。** `ActionService` 只冻结了 `snapshotWorld`/`rollbackWorld` 的接口名，并注明实现 post-hackathon（`packages/shared/src/actions/service.ts:68-73`）；cursor helper 也明确当前批次没有 rollback handler，只为未来处理预留（`packages/shared/src/store/cursor.ts:65-72`）。schema 中出现 `world_snapshot`/`world_rolled_back` 不能当作当前可调用能力。
5. **没有自动 choice consequence。** choice action 只记录选择（`packages/shared/src/actions/choose.ts:41-46`）；`autoWrite` 若开启也只是把事件交给 Writer（`apps/server/src/routes/world.ts:1148-1155`）。

## 8. 错误边界与不静默降级

| 情况 | Skill 行为 | 现实边界 |
|---|---|---|
| 当前 layer/path 未知 | 停止 branch-specific 写入，先读可确认路径或请求澄清 | Writer 指令禁止凭未读路径叙事（`extensions/instructions.ts:66-72`） |
| 目录不存在 | 不用 shell 偷建；先由既有合法初始化/写入路径创建，并在报告中保留 target | `writeChalk` 在 layer 不存在时返回 not-found（`packages/shared/src/actions/chalk.ts:431-451,479-482`） |
| child 无 README | 把它当 stub gate；进入后使用已有初始化流程，不把“目录存在”当已写完 | `deriveLayers` 无 README 时标 stub（`packages/shared/src/store/layers.ts:51-95`）；进入路由的 stub 分支见 `apps/server/src/routes/world.ts:1210-1223` |
| README 有 frontmatter 但 YAML 无效 | 不进入并修复/报告 README | `/api/enter-layer` 返回 `invalid_gate`（`apps/server/src/routes/world.ts:1170-1177`） |
| `requires.items` 不是 `player/*.md` 或缺物件 | 不把它当时间/choice 门；显示既有 blocked/missing 反馈 | 路由拒绝非法 item 或返回 `requirements_not_met`（`apps/server/src/routes/world.ts:1179-1207`） |
| target 不存在 / 误用显示名 | 不自动猜测、拼接或归一化；修正稳定 path | gate fallback/target 进入最终需 layer 存在（`apps/web/src/components/canvas/CardRenderer.tsx:155-159`、`apps/server/src/routes/world.ts:1219-1223`） |
| 新 Chalk 路径已存在 | 不覆盖；用 `append_to` 继续同一 Chalk，或用 `edit` 改真实文件 | `writeChalk` 对已存在目标返回 `already_exists`，append 还要求同层（`packages/shared/src/actions/chalk.ts:409-430,443-451`） |
| choice 不可见/过时/格式错误 | 不选择相似项、不推进目录；把可见选项或错误交给 Writer/玩家 | `chooseOption` 对 malformed/non-interactive/不可见选项分别失败（`packages/shared/src/actions/choose.ts:82-120,123-136`） |
| roll 声明无效、已存在 result、调用者伪造结果 | 不生成替代结果、不自动选 ending；按既有 dice error 处理 | `RollDiceSchema` 要求 `desc`/`expect`，结果由引擎写回（`packages/shared/src/schemas/frontmatter.ts:72-90`、`packages/shared/src/actions/roll-dice.ts:86-109`） |
| 结局前事实不完整 | 不命名结局、不预写另一线；补读实际 RP 或报告缺口 | 这是 Writer 纪律，当前没有 ending gate/事件可代替它（`packages/shared/src/schemas/events.ts:9-28`） |
| 已完成 ending 被回访 | 读已有文件并复用；不抽新 ending，不擅自 rollback | 当前无引擎 ending 锁，停笔只能由 Skill 语义约束（`packages/shared/src/actions/service.ts:68-73`） |

## 9. 精确代码落点

### 9.1 现有函数/模块（只复用，不新增运行时 API）

| 目的 | 现有落点与签名 | Skill 依赖的语义 |
|---|---|---|
| 从目录构建层树 | `packages/shared/src/store/layers.ts:56-59` — `deriveLayers(dirs: string[], readFm: (dir: string) => Record<string, any> \| null): Record<string, LayerConfig>` | 所有时间/分支/结局目录都是普通 layer |
| 直接子层门牌 | `packages/shared/src/store/layers.ts:121-128` — `childLayers(layerId: string, layers: Record<string, LayerConfig>): string[]` | 父页面只展示直接子层 |
| 当前层文件 | `packages/shared/src/store/layers.ts:106-113` — `cardsOfLayer(layerId: string, allFiles: string[]): string[]` | 自己 README 不作为自身正文卡 |
| 层进入 | `packages/shared/src/actions/layer.ts:54-57` — `enterLayer(ctx: ActionContext, input: EnterLayerInput): Promise<ActionResult<EnterLayerDetails>>` | 复用 gate/enter 与 `layer_entered` |
| 写入口 Chalk | `packages/shared/src/actions/chalk.ts:389-392` — `writeChalk(ctx: ActionContext, input: WriteChalkInput): Promise<ActionResult<WriteChalkDetails>>` | 复用命名、落盘、entity event |
| 记录 choice | `packages/shared/src/actions/choose.ts:48-51` — `chooseOption(ctx: ActionContext, input: ChooseOptionInput): Promise<ActionResult<ChooseOptionDetails>>` | 只记录 `choice_selected` |
| 结算 roll | `packages/shared/src/actions/roll-dice.ts:94-97` — `rollDice(ctx: ActionContext, input: RollDiceInput): Promise<ActionResult<RollDiceDetails>>` | 结果由引擎回写 |
| 读 frontmatter | `packages/shared/src/schemas/frontmatter.ts:180-193` — `parseFrontmatter(rawContent: string): ParsedFrontmatter` | choice/roll/status 仍是实体字段 |
| 下一步提醒 | `packages/shared/src/render/next-step.ts:106-133` — `computeNextStep(facts: NextStepFacts): string` | 事件后的回应是 Writer 任务，不是分支引擎 |
| Skill 装配 | `apps/server/src/engine/presets.ts:114-120` — `skillArgs(repoRoot: string, worldRoot: string): string[]` | 新 Skill 随现有仓库目录进入 Writer |
| stub 产物判断 | `packages/shared/src/rules/emptiness.ts:37-39` — `isLayerEmpty(files: readonly string[], dir: string): boolean`；`:63-72` — `hasInitProduct(files: readonly string[], dir: string, kind: 'scene' \| 'nook'): boolean` | 仅用于诚实描述初始化边界，不改为 branch 判据 |
| 初始化 fallback | `packages/shared/src/rules/init-fallback.ts:29-34` — `w2SceneTemplate(dirName: string): W2SceneFiles` | 只引用其真实模板路径，不在 Skill 伪造另一模板 |

### 9.2 本设计明确不新增的运行时函数

不新增 `getBranchState`、`setActiveBranch`、`switchBranch`、`markEnding`、`rollbackStory`、`emitEnding` 或任何同义函数；这些会把教程语义变成第二状态或未实现的程序化分支。

### 9.3 只为验收而新增的测试文件与函数

如果实现阶段需要静态验收，唯一新测试文件建议为 `tools/abstract-directory-story-contract.test.mjs`（NEW，测试 Skill 语义，不调用 server、model、WS 或数据库），可定义：

```js
function readSkillDocument(filePath) {
  // 返回 { frontmatter, body }；只解析目标 SKILL.md
}

function assertAbstractDirectoryStoryTutorial(document) {
  // 断言 frontmatter、必需标题、路径/门牌/choice/roll/停笔/禁用第二状态语义
}

function assertDirectoryFixtureSemantics(fixture) {
  // 只检查教程示例的路径和结构，不执行 deriveLayers 或真正进入世界
}
```

这三个函数是 test-only NEW，不是平台运行时契约；若实现者发现需要改 `layers.ts`、events 或 route，应另开实现/契约回写，不得把改动偷偷塞进本 Skill。

## 10. 与现状差异

| 维度 | 当前可观察行为 | 本设计新增的教程语义 |
|---|---|---|
| 技能 | `skills/` 已有 component/tool craft，且 Writer 指令把剧情/世界文风留给 Skill（`skills/tool-craft/SKILL.md:75-92`、`extensions/instructions.ts:182-189`） | 新增一个平台级目录叙事教程，统一教四种目录语义和单路径纪律 |
| 层 | `world/**` 目录扫描为普通 layer；README 和直接子层门牌分别处理（`packages/shared/src/store/layers.ts:51-128`） | 明确告诉作者不要把“时间/分支/结局”升级成 layer 类型 |
| Choice | action 只记 `choice_selected`，autoWrite 另 dispatch Writer（`packages/shared/src/actions/choose.ts:41-46`、`apps/server/src/routes/world.ts:1148-1155`） | 教程把后果写回当前路径，禁止 choice 自动跳转或自动删选项 |
| Roll | 引擎读声明、写结果和事件（`packages/shared/src/actions/roll-dice.ts:86-109`） | 教程要求结果先落事实，再由 Writer 正常叙事，不映射为隐藏分支机 |
| Ending | 当前没有 ending 事件、active branch 或可调用 rollback（`packages/shared/src/schemas/events.ts:9-28`、`packages/shared/src/actions/service.ts:68-73`） | 提供“实际收束后停笔、回访复用”的 Writer 纪律，并公开其未由引擎强制的性质 |
| 模板 | 已有世界 Skill 对具体时间线/因果有自己的世界知识（`templates/divergence-playtest/skills/divergence-playtest-play/SKILL.md:6-36`） | 平台 Skill 只教结构和边界，不复述 Divergence 的剧情事实 |

## 11. 发现的冲突 / 需要回写的上位文档

### 11.1 `stub` 判据与 legacy fixture 迁移（语义已冻结）

- 层派生在无 README 时生成 `stub: true`，但对有 README 的层也原样保留 frontmatter 的 `stub: true`（`packages/shared/src/store/layers.ts:51-95`）。
- 初始化空判定却是“直接子级没有精确大小写 `README.md` 才是空层”（`packages/shared/src/rules/emptiness.ts:31-39`），进入动作的 `first` 也只看 README 是否存在（`packages/shared/src/actions/layer.ts:63-69`）。
- 现有内容确实有带 README 且 `stub: true` 的结局候选，例如 `templates/divergence/world/tokiwa-electrics/convergence/README.md:1-16`；这类卡会被前端以虚线 stub 呈现（`apps/web/src/components/canvas/CardRenderer.tsx:130-166`），但不一定走 `first` 初始化。
- 这些现有 child README 还常写 `type: gate`（例如 `templates/divergence/world/tokiwa-electrics/convergence/README.md:1-5`）；这与本轮冻结的“所有 layer-root README 使用 `type: readme`、独立 `<child>-door.md` 才使用 `type: gate`”不一致，属于模板迁移风险，不由本 Skill 静默兼容。

**本轮冻结处理：**`stub: true` 仅是显示标记；初始化判据仍是直接子级缺少 `README.md`。所有 layer-root README（包括 child）统一 `type: readme`；需要独立入口时，在父层新增 `<child>-door.md`，使用 `type: gate` + 完整 `target`。本 Skill 已按此口径写 Step 3 和验收 C。

**需要回写的上位内容：**把现有带 `stub: true` 的 legacy fixture 迁移为“显示标记但不触发初始化”的明确内容；把 child README 的旧 `type: gate` 迁移为 `type: readme`，需要门牌时新增独立 child-door。需同步 `deriveLayers` 的注释、初始化/前端相关说明、模板与测试；这是迁移工作，不再是本 Skill 的待拍板语义。

### 11.2 W2 fallback 与 authored opening 的文件名漂移

- 当前 W2 helper 的返回键和内容是 `'README.md'` 与 `'opening.md'`（`packages/shared/src/rules/init-fallback.ts:29-34`）；初始化契约也明确禁止把它写成 `evening.md`（`docs/init/00-共同上下文.md:153-168`）。
- authored 模板普遍使用 `01-opening.md`，例如 Divergence 两种模板的世界入口（`templates/divergence/world/01-opening.md:1-12`、`templates/divergence-playtest/world/01-opening.md:1-10`）；代码还把 `evening.md` 当不计 ordinal 的 legacy unnumbered 文件（`packages/shared/src/actions/chalk.ts:124-138`）。
- 因而“教程第一段叫 opening”不能直接等同于某一个文件名：W2 的 `opening.md`、作者的 `01-opening.md`、历史内容的 `evening.md` 当前并存。

**本轮冻结处理：**新 authored opening 统一使用 `NN-opening.md`，首篇固定为 `01-opening.md`；`opening.md` 仅保留为旧 W2 fallback，`evening.md` 仅保留为 legacy。旧文件不自动重命名。本 Skill 已按此口径写路径规则和验收，不把三者混用。

**需要回写的上位内容：**把初始化/Writer instruction/brief/验收中的新 authored opening 示例统一为 `NN-opening.md`（首篇 `01-opening.md`），并明确旧 W2/legacy 文件不自动重命名；这是文档与 fixture 迁移，不再是命名语义待拍板。

### 11.3 世界级 Skill 路径/命名漂移

- 世界级剧情骨架文档要求 `<world-dir>-plot/SKILL.md`，并以 `holmes-world-plot`/`firstsnow-plot` 为例（`docs/prompts/04-skill体系.md:482-523`）。
- Divergence playtest 的剧情 Skill 实际路径是 `templates/divergence-playtest/skills/divergence-playtest-play/SKILL.md`（`templates/divergence-playtest/skills/divergence-playtest-play/SKILL.md:1-8`），正式 divergence 的连续性 Skill 则是 `templates/divergence/skills/divergence-continuity/SKILL.md`（`templates/divergence/skills/divergence-continuity/SKILL.md:1-19`）。

**对本 Skill 的处理：**它只放在仓库级 `skills/abstract-directory-story/`，只引用 world-relative 路径和机制；不把任何一个 divergence 路径称为 platform canonical，也不复制世界事实。

**需要上位文档拍板：**明确 playtest 与正式 world 的 Skill 是否同名、是否都需要 `<world-dir>-plot`，并让 `docs/prompts/04-skill体系.md`、模板目录和 scaffold 分发规则拥有同一张清单。

### 11.4 “建目录直接写 README”与 stub 入口冲突

当前前端 God mode 新建 gate 会直接写 `<base>/<slug>/README.md`（`apps/web/src/App.tsx:563-567`），而初始化契约指出“写 README 就不再是无 README stub”，并要求零 AI 模板路径另行处理（`docs/init/00-共同上下文.md:95-105`）。

**对本 Skill 的处理：**教程不把 God mode 新建流程当作剧情分支入口，不教作者手写一个临时 README 来“伪造 stub”；只描述已有 layer/gate 的内容语义。该冲突应由初始化/前端设计回写，不能在本平台 Skill 中偷偷补行为。

## 12. 本轮明确不冻结的后续能力

以下是未来 branch/ending 产品 RFC 的范围，不是本 Skill 的输入/输出契约，也不阻挡本轮教程实现；在独立契约冻结前，Skill 必须保持普通 layer 语义：

1. `status.data.closingState` 不固化为跨世界 ending 状态；本轮只允许它作为普通实体快照。
2. 不定义 branch identity、active branch、ending 事件或 rollback；不得预设字段名、DB/WS 状态或兼容方案。
3. `requires.items` 之外不扩展事实、关系、承诺等 gate 轴；当前路由只实现玩家背包路径门槛。
4. 允许预写多个平行目录，但不宣称有 active-branch/访问状态；Writer 必须按当前单路径纪律写作。
5. 结局后的继续方式不由本 Skill 决定；当前只能继续写同一 layer 的普通 Chalk 或新 child layer，不能伪造新存档/回滚能力。
## 13. 只验证教程语义的可执行验收

验收只针对 `SKILL.md` 文本和一个临时目录 fixture；不启动 server，不调用模型，不读/写 `history.db`，不跑全量 build/lint/test。命令（实现阶段新增测试后）：

```bash
node --test tools/abstract-directory-story-contract.test.mjs
```

### A. Skill 装载与 frontmatter

1. 读取 `skills/abstract-directory-story/SKILL.md`，断言 frontmatter `name === 'abstract-directory-story'`，description 非空且包含 directory/time/parallel/decision/ending 的触发语义。
2. 断言正文包含并且顺序合理的标题：ordinary layers、anatomy、path naming、current path、choice/roll、ending stop、failure boundaries（可接受中英文标题的固定映射）。
3. 断言正文没有要求新增运行时 tool、WS frame 或状态文件；它必须明确“复用现有进入/呈现/choice/roll”。
4. 真实装配门禁：运行 `pnpm check:skills`，再运行 `pnpm probe:prompt` 与对应 initializer prompt harness，断言 `loadSkillsFromDir`/`skillArgs` 结果中 `<available_skills>` 恰有一个 `abstract-directory-story`，Writer/Character 的正负前门禁结果符合本设计；不能只以静态文件通过。

没有该断言时，Skill 可能文件存在却未被 Writer 命中，或者只写抽象口号而不覆盖本任务的四种语义。

### B. 四种语义必须落到普通目录

用临时 fixture 仅检查路径集合和 README/Chalk 结构：

```text
world/README.md
world/01-opening.md
world/time-map/1994/README.md
world/time-map/1994/01-opening.md
world/parallel-left/README.md
world/parallel-left/01-opening.md
world/after-decision/accept/README.md
world/after-decision/accept/01-opening.md
world/endings/quiet-return/README.md
world/endings/quiet-return/01-ending.md
```

断言：

- 四类目录都处于 `world/` 下；目录名满足 `^[a-z0-9][a-z0-9-]*$`，README/Chalk 路径无绝对路径、`.`、`..`、隐藏段。
- 每个 authored layer 有直接的 `README.md` 和至少一个同目录 Chalk；父层与 child 的 README 路径不被写成第二个 `branch_state` 文件。
- 新 authored layer 的首篇入口文件为 `01-opening.md`，后续为 `NN-opening.md`；fixture 不新增 `opening.md` 或 `evening.md`，并将二者只当旧 W2/legacy 文件，不自动重命名。
- Skill 的示例没有 `timeline.json`、`active-branch.json` 或 `world/branch_state.md`。

没有该断言时，教程可能把目录结构写成散文示例，却无法执行或悄悄引入第二状态。

### C. 父 README、入口 Chalk、子 gate 语义

对 fixture 做静态断言，不调用 `/api/layer`：

1. 父目录 README 存在、子目录 README 存在；两者均为 layer-root `type: readme`；Skill 说明 child README 是 parent page 的自动门牌，而 child 内的 `01-opening.md` 才是进入后的正文。
2. Skill 文本明确 `README.md` 不重复作为当前层正文卡，且直接子层不递归泄露。
3. 若 fixture 添加一个显式 `<child>-door.md`，测试要求它是 `type: gate`、具有完整 `target: world/...`，并拒绝把 child README 写成 `type: gate` 或与同一 child 同时作为两个推荐 canonical gate。
4. 若 legacy fixture 带 `stub: true`，测试只把它视为显示标记；layer-root README 仍必须迁移为 `type: readme`，不能断言它会触发初始化。
5. Skill 文字明确 `requires.items` 只能是 `player/*.md`，不能用 choice/time/branch 名称替代。

没有该断言时，作者会把 layer 配置 README 与 gate 类型混用，同时写自动 child door 和重复 gate，或把父门牌摘要误当 child 内事实。


### D. choice/roll 复用且不自动分支

只检查 Skill 文本和 frontmatter 示例：

- choice 示例必须说明 `choice_selected` 只记录选择、后果由 Writer 落盘；文本不得把 `then` 写成当前自动执行能力。
- roll 示例必须有 `type`、`desc`、带引号的 `expect`，并说明引擎写 `result/passed`；不得传入作者决定的结果。
- 文本必须明确 choice/roll 不自动进入目录、不自动生成 ending、不自动删除其他选项。
- 文本应引用 `chooseOption`/`rollDice` 或等价的现有动作名，避免用未存在的 `branch()`/`resolveEnding()`。

没有该断言时，教程看似覆盖交互，实际会教出不可执行的程序化分支。

### E. 单次当前路径与结局停笔

静态断言要求正文同时出现这些可判定语义：

1. “当前 layer/path 是本回合唯一写入范围”；兄弟/未来目录不能因选择自动被写。
2. 必须先读当前 README、父 README、入口 Chalk 和事件指向的 source path。
3. 结局需由实际玩家行动/RP 支撑；首次进入、一次选择或一次 roll 不能自动结局。
4. 结局落普通 README/ending Chalk/具体事实后停笔；回访复用既有内容，不重抽、不自动生成兄弟结局。
5. 必须公开没有 branch identity、active branch、ending event、可用 rollback。

为防止假绿，测试还要把一份删除“只写当前路径”“结局停笔”句子的临时 Skill 文本送入同一断言并确认失败；不能只测一个永远通过的标题存在性。

### F. 负向禁令

对正文中所有代码块和路径示例做静态扫描：

- 出现 `branch_state`、`active_branch`、`ending_reached`、`story_ended`、`switchBranch()`、`rollbackStory()` 时，必须位于“禁止/未实现/待后续契约”的明确上下文，不能出现在可执行示例或“请创建/调用”句中。
- 禁止 `world/state.*`、`world/branch*`、`world/active-*` 作为教程产物示例。
- 不把 `presets/writer.json` 的 conversation branch summary 当世界 branch；不把 `world_rolled_back` schema 名称写成当前可调用动作。

这一组负向测试专门防止教程为了讲“不要做 X”而又在示例里半实现 X；不检查代码库全局，不会把既有 schema 中的保留名误报成 Skill 错误。

验收通过的含义仅是“教程能教出上述目录、入口、门、交互和停笔语义”；它不证明当前运行时已经获得 branch identity、ending event、rollback 或跨目录自动编排。