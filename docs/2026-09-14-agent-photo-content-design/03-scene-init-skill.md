# Scene-init Skill 设计

## 1. 一句话定位

这是一个教 Writer 把空的 `world/...` 层做成可进入、可观察、可行动的最小完整场景的**平台教程 Skill**；它指导何时读、写、调用动作和委托 `scene-init`，但不替代 `airp-init`，也不新增一条初始化执行链。

本文是设计文档，不安装 Skill、不改 preset、不改 `airp-init` 实现。

## 2. 范围、读者与非目标

### 2.1 读者完成后应能做什么

Writer 读完 Skill 后，应能：

1. 先读目标层、父层和当前世界 Skill，再决定是自己写首拍，还是委托一个 `scene-init` 子代理。
2. 为一个新层写出下列最小完整定义：
   - 根目录直接包含 `README.md`；
   - 1–3 个物件类组件（每个有短的可见介绍；组件类型先经 `get_component` 确认）；
   - 1–2 篇 opening chalk；
   - 至少一组可执行的互动选项/行动选项；
   - 强烈建议 1–3 个子目录，每个子目录先有自己的 `README.md`，之后可放组件或成为新的 opening 场景。
3. 知道 `choice` 只记录选择、`roll_dice` 才由引擎判定，以及叙事后果仍由 Writer 落地。
4. 对重要复杂场景先完成父场景设计，再并发委托多个**不同 target** 的 `scene-init`；明白这是教程工作法，不是当前 `airp-init` 已有的批量编排能力。

### 2.2 非目标

- 不替代 `airp-init` 的解析、判空、spawn、超时、W2 兜底或初始化事件。
- 不创造 `branch_state`、`active_branch`、场景状态文件、第二套 choice/action schema 或新的 WS。
- 不把 `world/**` 以外的 `player/**`、`characters/**` 当普通场景层。
- 不承诺 photo 专用大图/预览/二层模态已经可用；不定义 `assertImageAsset` 或收窄通用 `/api/asset`。场景的 `bg`、portrait video、audio 等媒体仍遵守各自既有通用资源路径；image-specific validator 只属于 `photo.image`/`create_char.avatar`（`docs/2026-09-14-agent-photo-content-design/00-共同上下文.md:38-45`）。
- 不要求 Writer 为每一个普通叙事段都启动子代理；即时对话、关键揭示和玩家行动后的回应仍由 Writer 亲写。
### 2.3 与 Character/Nook 的硬边界

本 Skill 只设计 `kind: scene` 的 `world/**` 层。它 **MUST NOT** 教 Writer 或 Character 把 `characters/{id}/` 当普通层，也不提供 `player/` stronghold 的 `nook-init` 路径；nook-init 本轮只允许角色 id 对应的 `characters/{id}`。角色根的 `README.md`、`identity.md`、`personality.md`、`memory.md` 是配置文件：可在明确事实基础上编辑，但不可移动或删除；public nook projection 必须过滤它们。上述 `write`/`edit`/`move`/`delete` actor 门禁和 Character Skill 装载前的运行时门禁由 Nook 域落地，本 Skill 只引用共同契约，不重复定义（`docs/2026-09-14-agent-photo-content-design/00-共同上下文.md:67-80`）。

## 3. Skill 的输入、输出与教程正文结构

### 3.1 输入

Skill 不接受新的运行时参数。它消费 Writer 已可获得的事实：

- 当前世界根相对路径；场景目标必须是 `world/...` 层 id（根层用 `map`，其目录是 `world`）。
- 目标层目录的实际文件列表和 `README.md` 内容（若有）。
- 父层的明确路径与 README 内容；不能只根据目录名猜父子关系。
- 世界 Skill 的文风/设定、Writer 的玩家请求；R1 Writer 还可把已读线索显式放入委托 brief。
 - R2 本轮 **MUST NOT** 依赖隐式 `knownClues`：`registerInitCommand` 必须把派生的 `layerId`（根层为 `map`）与物理 `targetPath`（根层为 `world`）连同父层和 `request` 传给 `buildSceneInitBrief`；child 必须知道的事实必须由调用方写进 `request`，缺少就报告，不得猜测。`SceneInitContext.knownClues?` 仅是可供显式 brief 构造的可选字段，不是 R2 自动注入。

### 3.2 输出：教程正文的推荐章节

`skills/scene-init/SKILL.md`（NEW）应按下列顺序教 Writer，章节本身不要复制完整的 `SCENE_INIT_INSTRUCTION`：

1. **先读，再决定归属**：读目标层、父层、相关 Skill 和已有物件；确定新层是父层的哪个空间以及玩家首次看见什么。
2. **最小完整场景清单**：给出文件树、每项的形状、数量和“缺少它会怎样”。
3. **物件组件**：从 `get_component` 取得真实 kind 的字段和最小例子；用 1–3 个物件形成可观察、可携带或可反应的焦点。
4. **opening chalk**：用 1–2 篇短 chalk 写抵达时的第一眼，不替玩家做决定，不提前兑现谜底。
5. **互动与行动**：在实体 frontmatter 声明 `choice`/必要时 `roll_dice`；教 Writer 用 `choose`、`roll_dice`、`use_item_on` 等已有动作，而不是发明 `action:` 字段。
6. **父子目录**：父层先有可读设计和自己的 README，再建议 1–3 个子场景；每个子层独立满足自己的 README 判空条件。
7. **委托与并发**：父场景完成后为每个子层准备独立 brief，再并发发起不同 target 的 `scene-init`；读回每个三行报告后再继续剧情。
8. **验收与失败恢复**：按文件、事件、互动和幂等性逐项检查；partial write、已初始化和子代理失败都要如实报告。
### 3.3 平台注册与 prompt 可见性

这不是“文件放进 `skills/` 就完成”的 Skill。实现时 **MUST** 同时完成 corpus 注册和两条真实 prompt 链路：

1. 在 `skills/scene-init/SKILL.md` 使用平台可识别的 frontmatter：`name: scene-init`，非空英文 `description`，正文英文且不超过 `check-skills` 的 120 行门槛。description 至少点名两个具体触发词（建议 `scene-init`、`airp-init`、`README`、`choice`、`roll_dice`），不写泛化的 “helps with”。
2. 在 `tools/check-skills.mjs` 的 `TRIGGERS_BY_SKILL` 登记 `scene-init` 的触发词；`EXPECTED_PLATFORM = Object.keys(TRIGGERS_BY_SKILL)` 会随之要求它出现在平台 corpus。目录名、frontmatter name 和全局 skill name 必须一致且只出现一次；根级 `skills/README.md` 不能成为伪 Skill。
3. Writer 由 `writerLaunch` 的 `skillArgs(repoRoot, worldRoot)` 把 repo `skills/` 作为显式 `--skill` 目录传入；pi-rp 的 `loadSkillsFromDir({ dir, source })` 递归读取 `scene-init/SKILL.md`，`skills` preset slot 才会把它格式化为 `<available_skills>`。`--skill` 只负责加载，模型仍须从 location 读取正文。
4. `scene-init` preset 的 `skills` slot 同样必须可见于 initializer prompt；R1 Writer `subagent` 与 R2 `ctx.spawnAgent(profileId: 'scene-init')` 共享该 process 的技能环境，但 initializer 的 `inheritHistory: 0` 仍成立。验收要抓真实 child prompt，不得只凭 `writerLaunch` 的 prompt 推断。
5. 该 Skill 的教程目标是 Writer 与 scene-init initializer；`skillArgs` 当前也会把 repo platform corpus 传给 Character，因此实现阶段不得声称它“只装给 Writer”。Character prompt 看到它前，必须先满足最新共同契约要求的 Character 前门禁；正文也不得教 Character 启动 scene-init 或把 nook 当 scene target。

Skill 的示例场景树只应作为教程示意，不得写成一个必须存在的固定路径：

```text
world/<parent>/
├── README.md
├── 01-<object-a>.md
├── 02-<object-b>.md
├── 03-<object-c>.md       # 可选
├── 01-opening.md          # 首篇 authored opening，type: chalk
├── 02-opening.md          # 可选第二篇 authored opening，type: chalk
├── <child-a>/
│   └── README.md
└── <child-b>/
    └── README.md
```

文件名（`README.md` 除外）使用 ASCII 小写 kebab-case；新 authored opening **MUST** 使用 `NN-opening.md`，首篇固定 `01-opening.md`、第二篇固定 `02-opening.md`。`opening.md` 仅保留为旧 W2 fallback，`evening.md` 仅是 legacy 文件；新 Skill、initializer instruction、brief 和验收不得使用它们作为新产物，也不自动重命名旧文件。路径始终为世界根相对 POSIX 路径；层树由目录派生，不能把子目录写进 `world.json` 的 `layers` 字段（`docs/2026-09-14-agent-photo-content-design/00-共同上下文.md:20-30`）。

## 4. 最小完整定义

### 4.1 README.md

父层或子层的 `README.md` 是层的门牌与身份，不是普通物件。教程应要求：

- 直接位于该层目录根；
- `type: readme`、稳定的 `name`、brief/世界事实明确给出的 material，以及合理的 `bg`（没有事实时不能编造 material）；
- 一句可感知的空间概括，并写清它和父层的关系；
- 不把 opening、谜底或玩家尚未发生的结果塞进 README。

缺少直接 README 时，层仍是 stub；即使目录里已有组件或子目录，也不能把它当作初始化完成。
#### 4.1.1 README、child gate 与 child README 的类型矩阵

下表是教程和 initializer 必须共同遵守的可执行矩阵。`README.md` 的文件名和 `type: readme` 的类型都不能互换；`gate` 是可选的父层门牌，不是子层 README 的替代初始化产物。

| 文件/位置 | 必须的类型与字段 | 父层页面上的语义 | stub/初始化语义 |
|---|---|---|---|
| `world/README.md`（虚拟 `map` 层根） | `type: readme`、`name`、已知的 `material`/`bg` | 当前根层配置；不作为自己的普通物件卡 | 直接 README 存在即 `map` 非 stub |
| `world/<layer>/README.md`（任一层根） | `type: readme`、`name`、已知的 `material`/`bg` | 该层配置/门牌；`cardsOfLayer` 不把它当自己的内容卡 | 直接、大小写精确的 `README.md` 才使该层离开 stub |
| `world/<parent>/<child>/README.md`（child 根） | 仍是 `type: readme`，不是 `type: gate` | 父页面的 child door；进入后成为 child 自己的层配置 | child 自己必须有该文件；父 README 不能代替它 |
| child 目录存在但无 `README.md` | 没有真实文件；页面可合成 `type: readme`、`stub: true` 的门牌 | 父页面显示“尚未写成”的 child door | 合成门牌不计为 child 产品；进入/初始化仍按 child 直接 README 缺失处理 |
| `world/<parent>/<child>-door.md`（可选 authored gate） | `type: gate`、指向 child 的合法 `target` | 作为显式进门卡；若 target 对应 child，会替换父页自动 child README 门牌 | 它不满足 child 的 `README.md` 判空，也不把 child 内容写入父层 |

因此：层根 README 永远写 `type: readme`；显式 gate 永远写 `type: gate`；不得把 `type: gate` 写进 `README.md`，也不得把 child 的 `README.md` 当普通组件或另一个 gate 重复落盘。当前 child door 的合成、authored gate 覆盖关系见 `apps/server/src/routes/world.ts:703-731`，README/门牌的层语义见 `packages/shared/src/store/layers.ts:9-22,88-104`。

### 4.2 1–3 个物件类组件

组件要让玩家有一个可指向的观察/携带/反应对象，而不是把背景设定拆成三张卡。每个组件至少应说明：

- 文件路径、显示名、物件在空间中的位置或感官细节；
- 真实的组件 kind 和该 kind 所需的 frontmatter；
- 一段短的卡面介绍，使 opening chalk 能自然地介绍它；
- 是否可拿走、是否可作为 `use_item_on` 的 target；一次场景最多让一个物件成为主要可携带物，避免把房间写成背包。

### 4.3 1–2 篇 opening chalk

每一篇 opening chalk：

- 文件 frontmatter 必须是 `type: chalk`；正文必须短（scene-init 现行 instruction 的上限是 200 words，迁移后继续保留，`extensions/instructions.ts:254-265`）。
- 写抵达时看见、听见、闻到、触到的第一拍；
- 至少点出一件组件及其可观察入口；
- 可声明初始 `status`、`choice` 或真实需要的 `roll_dice`，但不要把结果预写进 prose；
- 不用“你要做什么？”等把决定硬塞回正文的句子，选择应由 frontmatter 选项承载。

opening 的数量是 1–2，不等于把一个 opening 拆成许多没有节奏的短卡；第二篇只在确有第二个入口/视角或首拍需要保持短促时使用。

**动作边界必须按入口区分：**

- Writer 亲写（W1）时，使用 `chalk` 动作创建 opening；这会负责 chalk 命名和叙事事件。
- Writer 委托 R1 `subagent`，或 R2 由 `/airp-init` spawn `scene-init` 时，子代理不能依赖 `chalk` 扩展动作。它按自己的 `SCENE_INIT_INSTRUCTION` 使用原生 `write` 落盘一个 `type: chalk` 的 opening 文件；随后 `airp-init` 以产品检查和 `recordLayerInitialized` 负责初始化闭环。这里的“opening chalk”指文件类型和内容职责，不指必须调用 `chalk` 工具。
- 因此教程不得要求 initializer 再调用 `chalk`。initializer 的非 README `write` 仍可按现有 `world-context` 产生 `entity_created`（`extensions/world-context.ts:20-45`）；禁止的是把它误报成一次 `chalk` 动作或再额外追加一条重复初始化事件。

### 4.4 互动选项和行动选项

教程要把“看起来能行动”与“引擎实际拥有行动”分开：

- **互动选项**：在实体 frontmatter 的 `choice` 中声明稳定 `id`、可见 `label`、必要时 `hint`/`when`；选择调用 `choose({ path, choice })`，其中 `choice` 是 1-based 数字或 look-at 打印的精确文本。
- **行动选项**：选项文字必须对应一个 Writer 能继续处理的动作，例如检查、打开、交谈、拿取。`choose` 只产生 `choice_selected`，不改文件、不移除选项、不自动决定后果；Writer 下一轮必须读取事件并亲自写结果或再调用合适动作。
- **不确定行动**：实体声明 `roll_dice: { type, desc, expect }`，`expect` 必须是带引号的字符串（例如 `">50"`）；调用 `roll_dice({ path })`，结果/通过与否只能由引擎写回。
- **物件作用于物件**：需要钥匙、工具等实体互动时，使用已有 `use_item_on` 动作及已注册行为 kind 的 `accepts`/handler；不要在 Markdown 里伪造一个引擎不会读取的 `action` 字段。

`status` 只是该实体 frontmatter 的可见快照，不是新的全局状态系统。choice 的 `then`、`multi` 等 schema 兼容槽位不能在教程中暗示为当前已实现的自动后果或多选执行。

## 5. 逐步行为（每步的遗漏后果）

### 步骤 1：读取目标、父层和相关 Skill

用 `read` 读取明确的 `world/...` 文件/目录；先读已有 README、现有组件、父层 README 和 brief，再读世界文风 Skill 与 `component-narration`/`tool-craft`。不要只读目录名。R1 brief 可包含 Writer 已读的 known clues；R2 只能相信显式写入 `request` 的事实。

- **漏了会怎样**：scene-init 子代理没有 Writer 对话历史、玩家视角或 state 注入；只按目录名写会复述已知线索、破坏父层文风或制造错误事实。R2 若假定存在隐式 knownClues，会把不存在的上下文当 canon；现有 scene-init instruction 已明确其唯一事实来源是 brief（`extensions/instructions.ts:249-252`）。

对重要/复杂空间，先给父层写出空间目的、入口、组件职责和子层边界；父层至少先通过 README 判定。子层路径直接挂在父层目录下，子层自己也是层，不能借用父层 README。

- **漏了会怎样**：子代理同时生成互不相容的入口，且当前执行器没有 parent-ready barrier；父 README 是否已落盘不能由并发 child 的 brief 推断。

### 步骤 3：读取现状并检查幂等条件

在写之前读取目标目录。若目标层已有直接 `README.md`（且不是 stub 占位），停止初始化，不覆盖已有故事。`airp-init` 的顺序是先列文件判空，再以 `kind:target` 做同 target 的 in-flight 去重（`extensions/toolkit/init-command.ts:240-264`）。

- **漏了会怎样**：覆盖玩家已经看到的场景，或在同一目标同时产生两份初始化；后者会让文件、报告和事件难以解释。

### 步骤 4：先写 README.md

使用 `write` 把 README 作为直接子文件落盘，保留安全的世界根相对路径。只有 brief 真实提供的 material 才能写入；没有事实就报告缺失。

- **漏了会怎样**：`isLayerEmpty` 只检查直接子级、大小写敏感的 `README.md`（`packages/shared/src/rules/emptiness.ts:31-39`）；没有它，组件/开场白不会使层脱离 stub，下一次进入仍可能重复初始化。

### 步骤 5：写 1–3 个组件并给出短介绍

先 `get_component`，再用 `write` 写物件类实体；让 opening chalk 以短句介绍它们，必要时通过 chalk `link_to` 连到同层卡片。不要为凑数量增加无用途的道具。

- **漏了会怎样**：不知道 kind 的文件会按 fallback 呈现，预期的行为、卡面或尺寸不存在；没有组件，opening 只能写成抽象布景，玩家没有可观察焦点。

### 步骤 6：按入口落 opening

这一步不是要求所有路径都调用同一个工具：

- Writer W1 亲写 opening 时，调用 `chalk`，传 `content`（可选 `path`/`link_to`）；不要用 `write`、bash 或聊天文本伪造 Writer 的叙事 chalk。`chalk` 的实际输入和命名/事件行为见 `extensions/toolkit/chalk.ts:31-80`。
- R1 `subagent` 或 R2 `/airp-init` 的 `scene-init` 子代理落初始化产物时，按 initializer instruction 用原生 `write` 写 opening 文件，文件 frontmatter 必须仍为 `type: chalk`。`airp-init` 随后以 README 产品检查、`recordLayerInitialized` 或失败事件闭合初始化；它不需要、也不应依赖子代理调用 Writer 的 `chalk` 扩展动作。

- **漏了会怎样**：把 delegated initializer 强制绑定 `chalk` 会因其扩展动作隔离而无法实施；反过来把 Writer 的亲写 opening 用 `write` 代替，会绕过 chalk 的命名/叙事事件契约。initializer 的非 README 写入可正常产生 `entity_created`，但重复追加 layer initialization 或假报一次 chalk 动作都会使事件流失真。

### 步骤 7：声明并演示互动/行动

在相关实体 frontmatter 放 `choice`，确有不确定性才放 `roll_dice`；需要执行时分别用 `choose`/`roll_dice`/`use_item_on`。不要把 `choice` 当成自动状态机。

- **漏了会怎样**：没有 choice，玩家只能读不能按；把后果写进 choice 或误以为 choose 自动推进，会导致文件和叙事事件不变，Writer 又等不到引擎会产生的后果。`choose` 的“只记录选择”语义见 `extensions/toolkit/choose.ts:19-44`，骰子“引擎读声明并回写”的语义见 `extensions/toolkit/roll-dice.ts:17-45`。

### 步骤 8：父场景完成后并发委托子场景

确认父层 README 已落盘、父场景设计完成后，为每个子层准备独立 brief，明确 `world/<parent>/<child>` target、父路径、目的和玩家请求；R1 `subagent` 可把已读的 known clues 写入 brief，R2 `/airp-init` 则 **MUST NOT 依赖隐式 knownClues**，凡 child 必须知道的线索都要显式写进 `request`，缺失就让 initializer 报告而非猜测。随后才并发委托不同 target 的 `scene-init`。R1 Writer 侧使用 `subagent`；R2 玩家/引擎侧仍通过 `/airp-init` RPC 触发当前单次内核。每个 child 返回后，逐一读取三行报告并检查文件。

- **漏了会怎样**：当前 `ctx.spawnAgent` 一次只处理一个 `profileId`/task，`inFlight` 只按同 target 去重；没有父先完成的依赖图。并发同一 target 会被取消，不同 target 的并发也不代表父目录已准备好（`extensions/toolkit/init-command.ts:256-315`）。

### 步骤 9：复读、验收并让 Writer 接回剧情

读取父层和子层 README、组件、opening；确认文件树、选项声明、事件报告和缺失项。子代理的三行报告必须在 Writer 继续剧情前读完；当前 instruction 明确报告是路径、摘要和最值得注意的细节（`extensions/instructions.ts:280-281`）。

- **漏了会怎样**：Writer 会引用不存在的路径或把失败/模板兜底误当成完整场景，下一轮世界状态与文件脱节。

## 6. 文件与副作用

| 操作 | 目标 | 允许的副作用 | 禁止/注意 |
|---|---|---|---|
| `write` | README、组件；R1/R2 `scene-init` 的 opening 文件 | 写世界根相对文件；初始化命令负责产品检查/初始化事件 | Writer W1 亲写 opening 不用它；initializer 的 `write` 是可实施的静态产物路径，不要求 chalk 扩展动作 |
| `chalk` | Writer W1 亲写的 opening/后续叙事 | 创建 chalk、必要时同层 link，并写对应世界事件 | 不要求 R1/R2 initializer 调用它；不使用 bash 伪造 Writer 叙事 |
| `choose` | 有 `choice` 的实体 | 追加一条 `choice_selected` 事件 | 不写文件、不自动执行后果 |
| `roll_dice` | 有 `roll_dice` 声明的实体 | 回写 `result`/`passed`，追加 `roll_resolved` | 不传 result/type/expect，不重复掷已有结果 |
| `use_item_on` | 物件 target | 按已有行为 kind 的 handler 处理并记录动作 | 不在 Skill 中新增 handler 或 WS；未处理不是静默成功 |
| `airp-init`/`subagent` | 一个 scene target | spawn、产品检查、`layer_initialized` 或失败时 W2/`layer_init_failed` | 当前不是批量/依赖编排器 |

写入范围仍受共同契约约束：`world/**` 是场景树，`player/**` 是玩家空间，`characters/{id}/` 是角色小天地；任何工具都不能把三者混为一层（`docs/2026-09-14-agent-photo-content-design/00-共同上下文.md:20-30`）。

## 7. 状态、事件与 WS 边界

### 7.1 状态真相

本 Skill 不新增状态真相。可见状态只来自 Markdown frontmatter 的 `status`、目录/文件是否存在以及已有事件；目录名表达叙事层级，不表达隐式 active scene 或 branch 状态。

### 7.2 初始化生命周期

- 进入 stub 时，`enterLayer` 通过 README 是否存在计算 `first`，并追加 `layer_entered`；现有实现读取 `statKind(<dir>/README.md)`（`packages/shared/src/actions/layer.ts:54-79`）。
- 初始化成功时 `recordLayerInitialized({ layer, by, files })` 追加 `layer_initialized`；事件 actor 固定为 `engine`，`by` 只说明触发方（`packages/shared/src/actions/layer.ts:91-129`）。
- 子代理失败、超时、取消或完成却没有产品时，scene 路径写 W2 template，并追加 `layer_init_failed`；现有内核分流见 `extensions/toolkit/init-command.ts:322-345`。

### 7.3 互动事件

- `choose` 追加 `choice_selected`，不改变 choice 文件。
- `roll_dice` 由引擎解析 `type/desc/expect`，回写 `result/passed`，追加 `roll_resolved`。
- 选项后果由 Writer 根据事件继续调用 `chalk`、`write`、`move`、`move_to`、`use_item_on` 等已有能力；choice 不自动生成子层、移动卡片或切分剧情。

### 7.4 WS

Skill 不发送 WS，也不要求新增 WS。扩展侧不得假设自己连接 server；可见演出通过动作返回的 `details` 或已落账事件由现有桥接广播（`docs/tools/00-共同上下文.md:24-44`）。文件变化继续走现有文件监视，事件继续走唯一历史事件通道。新增一个“scene-init-batch” WS 会制造第二份状态，明确不做。

## 8. 幂等性、父子目录和并发编排

### 8.1 幂等性规则

1. **顺序重复**：直接 `README.md` 存在即不再次初始化；已有非 stub 内容不得覆盖。
2. **同目标并发**：`airp-init` 的 `inFlight` key 是 `${kind}:${target}`，第二个同 target 请求报告 in-flight/cancelled，不再 spawn。
3. **不同目标并发**：可同时处理，但只在父 README 和设计先完成后使用；不同 target 不构成依赖保证。
4. **失败重试**：scene 失败时 W2 template 落 README，后续按现有实现会被视为已初始化；Skill 必须要求 Writer 读取 `layer_init_failed`/命令报告，不能把 template 当成内容质量验收通过。
5. **部分成功**：若 README 已落盘而组件或 opening 缺失，现有判空可能将它视为非空；Skill 只能报告缺件并由 Writer 修复，不能期待空判定自动重跑。

### 8.2 父子目录规则

- 父层和每个子层均需自己的直接 `README.md`。
- 父 README 的存在不填充子层；子层组件或孙目录也不满足子层判空。
- 子层的 opening 与组件应使用自己的 target path，不能因“同一个场景”写到父目录。
- 推荐 1–3 个子目录是创作建议，不是 `airp-init` 的隐藏必需输入；子目录可以仅作为可继续探索的门牌，也可以包含组件和一个新的 opening。

### 8.3 编排决策

“父场景先设计，再并发 scene-init 子代理”**仅是 Skill 教授的工作法**。当前代码没有父先 barrier、计划图、批量 spawn、跨 target 事务或失败重试编排：服务端只 fire-and-forget 转发 `/airp-init`，一次命令最终只调用一个 `ctx.spawnAgent`（`apps/server/src/index.ts:152-177`；`extensions/toolkit/init-command.ts:297-315`）。

本设计不新增 `airp-init-batch`、`scene_plan` 或 `scene_init_children` 工具。若未来要把并发工作法变成平台能力，必须另写上位契约，定义依赖、部分失败、事件顺序、取消、跨进程锁和 WS；不能把 Writer 手工并发的教程文字伪装成当前能力。

## 9. 错误边界与报告要求

| 情形 | Skill 教 Writer 的处理 | 忽略的后果 |
|---|---|---|
| brief 缺 target/基调/父关系/关键事实 | 不猜；写能诚实写的部分并在三行报告指出缺失 | 子代理按猜测制造 canon，Writer 无法分辨猜测 |
| 目标已有真实 README | 立即停止，不覆盖；报告 already initialized | 破坏玩家已见内容；重复事件 |
| 只写组件/子目录、没有直接 README | 视为 stub，补 README 或按失败处理 | 下次进入重复初始化；已有子内容可能与新一轮冲突 |
| README 已有但组件/opening 不全 | 不依赖空判定重跑；逐件补齐并报告 partial | 层被判非空，却不满足本 Skill 的最小完整定义 |
| 路径绝对、含 `.`/`..`、隐藏段或越出世界根 | 在动作层拒绝；修正为 `world/...` POSIX 路径 | 可能越过世界根或写到错误层 |
| `write` 失败 | 列出成功/失败文件；不声称场景完成 | 留下无法解释的半场景 |
| opening 文件名非法或入口不清（Writer 亲写 vs initializer 委托） | 新 authored opening **MUST** 是 `01-opening.md`（可选第二篇 `02-opening.md`）；Writer W1 用 `chalk`；R1/R2 initializer 用原生 `write` 写 `type: chalk` 文件，并由 `airp-init` 记录初始化结果 | 新产物使用 `opening.md` 或 legacy `evening.md` 会混淆 W2/legacy 与 authored 场景；强制 initializer 调 `chalk` 又会在扩展动作隔离下不可实施 |
| kind 未先 `get_component` 或不存在 | 停止使用该 kind，查询 registry 或改用真实 kind | fallback note，预期机制静默消失 |
| choice 不存在/选项文本不精确 | 让 `choose` 失败并重新读取实体 | 记录了不存在的选项，Writer 会写错后果 |
| `choice.then`/`multi` 被当自动执行 | 按单纯记录选择处理；由 Writer 写后果 | 把未实现的自动状态推进当成事实 |
| `expect` 未加引号、骰子已有结果 | 修复声明或先按重开规则编辑结果；不得伪造结果 | YAML 可能读成空条件，或玩家可反复刷新骰子 |
| 同 target 并发 | 接受一个执行，读取另一个的 in-flight 报告 | 误以为两个子代理都完成，路径/事件重复 |
| 子代理 completed 但无产品/超时 | 依据命令结果接受 W2/失败事件；不得声称内容达标 | README 可能来自 template，质量验收被跳过 |

子代理仍遵守现有三行回报：文件路径；一句话摘要；最值得注意的细节。详细错误不能藏在“done”中；Writer 要把缺失事实和 partial product 反馈给玩家可见的后续流程。

## 10. 精确代码落点

### 10.1 现有函数/常量（必须复用或更新）

| 文件与行 | 符号 | Skill 设计的落点 |
|---|---|---|
| `extensions/instructions.ts:164-174` | Writer `[Delegate the first pass, not the story]` | 在现有委托指路处引用 `scene-init` Skill：明确 brief、父先设计和回报复读；不把 Skill 正文复制到系统 instruction。 |
| `extensions/instructions.ts:247-281` | `SCENE_INIT_INSTRUCTION` | **MUST 迁移**数量为 1–3 个组件、1–2 篇 opening；新 authored opening **MUST** 命名 `NN-opening.md`（首篇 `01-opening.md`），`opening.md` 仅 W2 fallback、`evening.md` 仅 legacy；明确 initializer 用 `write` 落 `type: chalk` 文件，不依赖 Writer 的 `chalk` 动作；保留 brief-only、README 判空、不可覆盖、三行报告纪律。 |
| `presets/scene-init.json:26-36` | `skills` slot | 保留 `skills` slot 且要求 `read` 可用，使 `scene-init` initializer prompt 能看到 `<available_skills>`；Skill 正文由模型按 location 读取，不复制进 instruction。 |
| `packages/shared/src/render/brief.ts:16-65` | `SceneInitContext` / `buildSceneInitBrief(ctx)` | brief 仍是唯一动态上下文；**MUST** 同步 1–3/1–2 与 `NN-opening.md` 命名，不要求 delegated initializer 调 `chalk`；R2 不依赖隐式 knownClues。 |
| `tools/check-skills.mjs:45-52,97-114,120-181,211-215` | `TRIGGERS_BY_SKILL` / `EXPECTED_PLATFORM` 与 corpus checks | **MUST** 登记 `scene-init` 及至少两个具体触发词；保持目录名/name/description/body、英文、120 行、全局唯一和无 README pseudo-skill 的机械门禁。 |
| `vendor/pi-rp/packages/coding-agent/src/core/skills.ts:160-218,335-360` | `loadSkillsFromDir(options)` / `formatSkillsForPrompt(skills)` | 验证递归读取 platform `skills/scene-init/SKILL.md` 并恰好渲染一个 `<skill>`，含 name/description/location；缺 description 或重复结果必须失败。 |
| `apps/server/src/engine/presets.ts:96-120` | `skillArgs(repoRoot, worldRoot)` | 验证 repo `skills/` 和 world `skills/` 作为显式 `--skill` 目录传入且不重复；不依赖全局发现。 |
| `apps/server/src/engine/launch.ts:118-129,146-187` | `writerLaunch` / `characterLaunch` | Writer 的 launch args 必须含 repo `skills/`；Character 共享 corpus 但只有通过 Character 前门禁才启动，本 Skill 的运行目标仍是 Writer/scene-init。 |
| `extensions/toolkit/init-command.ts:43-79` | `INIT_COMMAND` / `InitArgs` / `parseInitArgs(raw)` | 保持 `kind: scene`、world-relative layer target、`request`、`by` 和可选 template；不把子目录列表偷偷扩为未冻结的参数。 |
| `extensions/toolkit/init-command.ts:124-135` | `parentLayerOf(manifest, layer)` | 继续从 manifest 派生父名/父目录，Skill 的 brief 必须传明确父路径；不自行创造 parent mapping。 |
| `extensions/toolkit/init-command.ts:173-355` | `registerInitCommand(pi)` | 保持判空→同目标去重→template/spawn→产品检查→初始化/失败事件顺序；Skill 并发仅由 Writer 分发多个独立调用。 |
| `packages/shared/src/rules/emptiness.ts:19-72` | `directChildrenOf` / `isLayerEmpty` / `hasInitProduct` | 作为 stub/产品验收的事实依据；本设计不把子目录或任意组件改成“已初始化”判据。 |
| `packages/shared/src/actions/layer.ts:54-179` | `enterLayer` / `recordLayerInitialized` / `recordLayerInitFailed` | 复用现有 layer 事件和 `engine` actor；不新造 scene-plan 事件。 |
| `extensions/toolkit/chalk.ts:31-85` | `chalkTool` | 仅用于 Writer W1 亲写 opening/后续叙事；R1/R2 `scene-init` 不调用它，子代理的 `write` opening 由初始化内核的产品检查与初始化事件闭环。 |
| `extensions/toolkit/choose.ts:19-55` | `chooseTool` | 教程中的 choice 行动入口；不扩为自动后果引擎。 |
| `extensions/toolkit/roll-dice.ts:17-55` | `rollDiceTool` | 教程中的不确定行动入口；引擎拥有结果。 |
| `apps/server/src/index.ts:152-177` | `/airp-init` RPC 转发 | 仅说明 R2 入口；不在 server 侧伪造 `spawnAgent` 或批量编排。 |

### 10.2 NEW 文件和函数签名

- `skills/scene-init/SKILL.md`：**NEW 文件**，唯一确定的本设计产物；应作为 Writer 可按需读取的平台教程。
- 本设计**不新增运行时工具、不新增 WS、不新增函数**。现有 `buildSceneInitBrief(ctx: SceneInitContext): string`、`parseInitArgs(raw: string): InitArgs`、`registerInitCommand(pi: ExtensionAPI): void` 和动作函数继续作为唯一执行接缝。
- 若后续实现阶段认为必须机械校验教程数量，可另行提出以下纯函数；当前不冻结、不实现，也不应被 Skill 文本伪称已存在：

```ts
// PROPOSAL ONLY — not part of this design's implementation
export interface SceneInitProductReport {
  readme: boolean;
  componentPaths: string[];
  openingPaths: string[];
  missing: string[];
}
export function inspectSceneInitProduct(
  files: readonly string[],
  dir: string,
): SceneInitProductReport;
```

该提案若被采纳，应放在 `packages/shared/src/rules/`，并明确它是质量验收而非替代 `isLayerEmpty`；否则保持教程级 checklist，避免把数量建议硬编码进初始化幂等门禁。

## 11. 与现状差异

1. 现有 scene-init instruction 仍要求 README、**2–4** object files、**1** opening chalk（`extensions/instructions.ts:253-265`）；这是迁移前口径，本轮 **MUST** 将其改为 1–3 个组件、1–2 个 opening，并同步动作边界：initializer 用 `write` 写 `type: chalk` 文件，不调用 Writer 的 `chalk`。
2. 现有 `buildSceneInitBrief` 仍输出 2–4 对象、1 opening（`packages/shared/src/render/brief.ts:52-62`）；这是迁移前口径，本轮 **MUST** 同步改为 1–3/1–2，且不得把 delegated initializer 的 opening 写成必须调用 `chalk` 动作。
3. 现有 `isLayerEmpty`/`hasInitProduct` 只看层目录**直接** `README.md`，不看组件数、opening 数或子目录（`packages/shared/src/rules/emptiness.ts:31-39,53-72`）。因此“最小完整”目前是教程质量条件，不是运行时成功门槛。[推断]
4. 现有 `airp-init` 对同 target 有进程内 Set 去重，但一个命令只 spawn 一个 child；没有 parent-ready barrier 或 batch plan（`extensions/toolkit/init-command.ts:256-315`）。
5. 现有 R2 server 入口只转发 `/airp-init`，没有父场景设计步骤（`apps/server/src/index.ts:152-177`）。
6. 现有 Writer 指令已经建议委托空层给 `scene-init`，但未覆盖本 Skill 的五项交付、父先并发工作法和“choose 不自动后果”教学（`extensions/instructions.ts:164-188`）。[推断]
7. 现有组件 Skill 要求行为 kind 先 `get_component`，而互动字段明确转由 `tool-craft` 负责（`skills/component-narration/SKILL.md:26-30,62-65`）；本 Skill 应引用两者，不复制注册表和字段真相。
8. 当前平台 corpus 只由 `tools/check-skills.mjs:45-52` 的 `TRIGGERS_BY_SKILL` 推导，`EXPECTED_PLATFORM` 会拒绝未登记的新 Skill；本轮新增 `scene-init` 前，文件、触发词登记和 name 全局唯一性尚未形成闭环。[推断]
9. 当前 Writer launch 已把 repo/world `skills/` 作为显式 `--skill` 目录传入，`loadSkillsFromDir` 与 `formatSkillsForPrompt` 才会把可见 Skill 组织为 `<available_skills>`（`apps/server/src/engine/presets.ts:96-120`；`vendor/pi-rp/packages/coding-agent/src/core/skills.ts:160-218,335-360`）。现有 `scene-init` preset 虽有 `skills` slot（`presets/scene-init.json:26-36`），仍需真实 child prompt 验收，不能只看 Writer prompt。[推断]
10. 当前 `tools/probe-prompt.mjs:81-145` 已验证 Writer 的 `<available_skills>`，但没有 scene-init child prompt 的同等断言；本轮必须新增 initializer 捕获场景并检查唯一 `scene-init` 条目，避免只测静态文件造成假绿。[推断]

## 12. 可执行验收测试

这些是实现 Skill/对齐 instruction 与 brief 后可直接执行的验收；测试必须验证“没有这项设计会失败”的边界，不能只检查文件存在。

### 12.1 Skill 内容静态验收

1. 读取 `skills/scene-init/SKILL.md`，断言同一教程明确出现：README、1–3 组件、1–2 opening chalk、互动/行动选项、1–3 可选子目录、父先再并发、read/write/action 用法、幂等性和直接 README 判空。
2. 断言教程明确写出 `airp-init` 不是替代物、并发是工作法而非当前新工具；若删除这两句，验收失败。
3. 断言教程没有 `branch_state`/`active_branch`/HTML/iframe/new WS 等越界协议，也没有把 `action:` 伪造为现有 frontmatter 字段。
4. 断言所有代码事实引用包含 `file:line`，建议性提案标 `[推断]` 或明显的 proposal-only 标记。
5. 断言教程明确：R2 `/airp-init` 不存在隐式 `knownClues`，所需事实必须进入 `request`；一个只在 Writer 状态里存在、未写入 request 的线索不得成为 child 骨架的验收前提。

### 12.2 最小场景 fixture 验收

给测试世界创建 `world/test-scene/`，执行教程规定的真实动作，断言：

1. 直接 `README.md` 的 `type/name/material/bg` 存在；缺 README 时，`isLayerEmpty(files, 'world/test-scene') === true`，即便存在 `01-prop.md`、`01-opening.md` 和 `child/README.md` 也仍为 true。这个反例证明不能把“任意文件非空”当修复。
2. 对 `world/README.md`、`world/test-scene/README.md` 和 `world/test-scene/child/README.md` 断言文件类型均为 `type: readme`；child 缺 README 时父页合成的 stub door 也为 `type: readme, stub: true`，但 child 仍为空。对显式 `world/test-scene/child-door.md` 断言为 `type: gate` 且不改变 child 的 `isLayerEmpty`；若 gate target 对应 child，父页不重复显示自动 child door。
3. 恰有 1 个组件、1 个 opening 时，质量 checklist 通过；增加至 3 个组件、2 个 opening 仍通过；第 4 个组件或第 3 个 opening 被报告为超出教程目标，而不是静默吞掉。
4. 每个组件路径被至少一个短 opening chalk 点到或通过同层 `link_to` 可达；删除其中一项介绍时验收失败。
5. W1 亲写 opening 经 `chalk` 产生 `type: chalk` 文件及叙事事件；R1/R2 delegated initializer 用原生 `write` 产生同样 `type: chalk` 文件，非 README 写入可产生 `entity_created`，并由 `layer_initialized` 闭环；测试不得把 delegated `write` 判为失败，也不得要求其调用 `chalk` 或重复追加初始化事件。
6. 命名回归：新 authored opening 只接受 `01-opening.md`/`02-opening.md` 这类 `NN-opening.md`；`opening.md` 只在 W2 fallback fixture 中接受，`evening.md` 只在 legacy fixture 中接受，二者都不得成为新初始化产物，也不得自动重命名。

### 12.3 互动行为验收

1. 对带两个选项的组件调用 `choose({ path, choice: 1 })`：断言恰有一条 `choice_selected`，文件正文、选项和 status 未被自动改写；若实现让 choose 自动推进后果，测试失败。
2. 对带 `roll_dice` 声明但无结果的实体调用 `roll_dice({ path })`：断言引擎写回 `result/passed` 并追加 `roll_resolved`；调用方传入 result 或对已有结果重掷必须失败。
3. 对缺失/错拼选项调用 choose：断言无 `choice_selected`，返回明确错误；不能落账一个不存在的 label。
4. 对未知组件 kind：`get_component`/组件质量验收明确报错或要求更换真实 kind；不得接受“看起来像目标但实际 fallback note”的假绿。

### 12.4 幂等与父子并发验收

1. 已有真实父 README 时重复 `/airp-init`：断言 no action，文件字节内容和初始化事件数量不增加。
2. 同 target 同时发起两次初始化：断言最多一个 spawn，另一次返回 in-flight/cancelled；不能产生两套 opening。
3. 父 README 未落盘就并发 child：测试应证明平台**不会**替教程建立 barrier；Skill 验收要求文档把该顺序风险写清，而不是声称当前工具保证父先。
4. 父 README 完成后并发两个不同 child target：各 child 只写各自目录，两个目录均有直接 README；任何跨目录写入视为失败。
5. child 目录只有组件没有 README：下一次 `isLayerEmpty` 仍为 true；补 README 后才进入质量验收。
6. scene-init 返回 `completed` 但没有产品：断言沿现有内核走 W2/`layer_init_failed`；不能只凭 spawn 状态宣称完成。

### 12.5 状态与 WS 验收

1. 初始化成功只产生既有 `layer_initialized`，详情含 layer、by、files，actor 为 engine；不产生 scene-plan 或 batch 事件。
2. 选择、骰子和初始化事件通过现有唯一事件/文件通道可被 server 消费；没有第二条 WS 连接或自定义状态文件。
3. Writer 读到 child 三行报告后，若文件缺失/partial，能在后续输出中指出具体路径和原因；不能以“done”掩盖失败。

## 13. 发现的冲突 / 需要回写的上位文档

1. **`extensions/instructions.ts:253-265` 与本需求的数量冲突（MUST 迁移）**：现状写“2–4 object files、1 opening”，本轮规范是“1–3 个物件组件、1–2 opening”。实现阶段 **MUST** 将 instruction 改成 1–3/1–2；不保留“交集 2–3/1”的临时口径。[推断]
2. **`packages/shared/src/render/brief.ts:57-62` 与本需求的数量冲突（MUST 迁移）**：动态 brief 现状仍输出 2–4/1，实现阶段 **MUST** 同步改成 1–3/1–2，否则 R2 会收到旧清单。[推断]
3. **opening 的动作边界曾被混写**：`SCENE_INIT_INSTRUCTION` 明确要求初始化器以 `write` 写文件（`extensions/instructions.ts:272-278`），而 Writer W1 的叙事 opening 才应调用 `chalk`（`extensions/toolkit/chalk.ts:31-80`）。本设计已收口为两条入口：Skill **MUST** 分开教，不能让 delegated initializer 依赖 `chalk`，也不能让 Writer 把 `write` 当 chalk 动作。[推断]
4. **R2 knownClues 缺口的本轮裁决**：当前 `registerInitCommand` 构造 brief 只传 target、父层和 request（`extensions/toolkit/init-command.ts:286-295`），所以本轮教程 **MUST 禁止依赖隐式 `knownClues`**；R2 所需事实由调用方显式写入 `InitArgs.request`。`SceneInitContext.knownClues?` 仅供显式 brief 构造（`packages/shared/src/render/brief.ts:16-28`），本轮不改 `InitArgs`。[推断]
5. **stub 判空与“最小完整”不对称**：`isLayerEmpty` 和 `hasInitProduct` 只认直接 README（`packages/shared/src/rules/emptiness.ts:31-72`），而教程新增组件/opening/子目录要求不会被运行时强制。上位文档 **MUST** 明确 README 是幂等身份门禁、数量是质量验收；不得为了教程数量改动空判定。[推断]
6. **父先并发与现有单次执行冲突**：`docs/doc-11-场景与小天地初始化协议.md:21-40` 以及 `extensions/toolkit/init-command.ts:297-315` 描述单次 R1/R2 委托，没有 parent-ready/batch 协议。并发仍只在 Skill 中作为 Writer 工作法；自动化另立批量初始化设计。[推断]
7. **互动字段归属**：`skills/component-narration/SKILL.md:62-65` 把 `status/choice/roll_dice` 教学交给 `tool-craft`；本 Skill 不能新增第二套“行动字段”，只引用已有教程。[推断]
8. **组件引用文件缺失风险**：现有 component Skill 引用 `references/component-kinds.md`（`skills/component-narration/SKILL.md:65`），scout 已发现该路径当前不存在。由组件域另行修复；本设计不复制注册表，也不把缺失引用伪装为本 Skill 已解决。[推断]

## 14. 本轮已冻结的实现前置与非目标

1. 数量口径固定为 1–3 个物件组件、1–2 篇 opening；实现阶段必须同步 instruction/brief 并补测试，不保留旧 2–4/1 兼容说法。
2. 每个物件组件至少有一段短 chalk 介绍；它可以在 opening chalk 中完成，但必须能通过路径或 `link_to` 指向该物件，不能只在报告中罗列。
3. 子目录是可选但强烈建议；复杂场景由 Writer 先完成父场景设计，再并发发出不同 child 的 scene-init 请求。
4. 质量 checklist 是否实现为独立 `inspectSceneInitProduct` 不是本 Skill 的运行时契约；实现者可用测试/报告 helper，但不得改变 `isLayerEmpty` 幂等门禁。
5. 多个 R1 `subagent` 调用由 Writer 按教程自行并发发出；`airp-init` 当前不支持批量，未来自动化另立契约。
6. R2 所需事实必须显式进入 `InitArgs.request`；未来结构化 knownClues 来源另立契约。
7. `by` 仍只使用现有 `player|engine`；未来若需区分 Writer 设计与 engine spawn，另行扩展事件 detail。
