# 05 — 角色小天地管理教程 Skill 设计

> 状态：设计稿。本篇只定义 `nook-management` 教程 Skill，不创建 `skills/` 下的实现文件，不修改共享契约，也不把提示词约束冒充为动作层权限。

## 1. 一句话定位

`nook-management` 教 Writer/Character 把 `characters/{id}/` 当作一个角色留下生活痕迹的私人目录：先读清角色配置，再写物品、日记、纪念物、信件等可见内容；用 `move` 交给玩家或放回世界，用 `move_to` 改角色在场位置，并始终把小天地与角色配置、世界 layer 分开。

Skill 的目标是让模型做出正确的路径和动作选择，不是新增状态、秘密存储或安全边界。角色目录使用稳定的 ASCII 小写 kebab-case id；世界根相对路径只写 `world/...`、`player/...`、`characters/...`，不写绝对路径、`.`、`..` 或隐藏段（共同上下文 §2）。

## 2. 输入、输出与教程正文结构

### 2.1 输入与输出

Skill 没有新的工具输入参数；模型获得的是现有 agent 上下文、可用工具列表、角色 id、当前已知事实，以及读目录得到的文件清单。一次管理任务至少要能确定：

- 目标角色的 `characters/{id}/`；角色 agent 默认只把自己的 id 当作“我”，Writer 或其他调用方必须显式指定角色 id。
- 要留下的内容是真实已知的物件、日记片段、纪念物、信件，还是角色位置变化；未知内容不能靠目录名补齐。
- 已存在的根配置文件与生活痕迹，尤其是直接子级 Markdown 和子目录。

输出只有三类：

1. 在角色根目录或子目录新增/编辑生活痕迹文件；
2. 对已有物品执行 `move`，把文件交给 `player/...` 或放进 `world/...`；
3. 对角色执行 `move_to`，把 presence 写到场景，而不是移动 `characters/{id}/` 目录。

每次输出都应报告实际成功的路径、动作返回的错误，以及未执行的计划；不能把“准备写”报告成“已经写入”。

### 2.2 `SKILL.md` 正文结构

实现文件应为 `skills/nook-management/SKILL.md`，frontmatter 只使用既有必填字段：

```yaml
---
name: nook-management
description: Use when a character leaves, edits, sorts, gives away, or places something in their private nook; keep character configuration separate from lived traces, and use move for objects and move_to for presence.
---
```

正文按以下顺序写，短规则放正文，不复制组件字段表：

1. **先读与归类**：读 `characters/{id}/`，将四个根配置文件和生活痕迹分栏。
2. **选择痕迹载体**：物品、日记、纪念物、信件各写什么；需要组件交互时先读 `component-narration` / `get_component`，不凭记忆造 kind。
3. **写入位置**：直接子级用于小天地首页投影；日记簿、纪念盒等可用子目录归档。
4. **把物品交给别人**：`move` 到完整的 `player/...` 或 `world/...` 目标路径。
5. **让角色站到场景里**：`move_to`，目标只能是世界场景目录或其中实体。
6. **记忆事实纪律**：`memory.md` 只记录角色确实看见、听见、被告知、承诺或亲自做过的事实，保留不确定性。
7. **可见性与权限**：把小天地文件视为可能被玩家看到；只操作当前角色自己的小天地，直到运行时门禁真正存在。
8. **回读与报告**：检查目标是否存在、是否落在预期投影，按动作结果报告事件和失败。

Skill 应明确提醒：`characters/{id}/README.md` 是小天地门面，`identity.md`、`personality.md`、`memory.md` 是角色基础配置；四者都永不可移动、永不可删除。这里的“不可删除/移动”不等于禁止在明确的配置维护任务中编辑正文，但生活痕迹任务不应把新事实塞进配置文件。

### 2.3 与 `nook-init` 的目标边界

本轮 `nook-init` 只允许以角色 `characters/{id}/` 为目标；项目级 Skill 会随 `skillArgs()` 传给可能继承它的初始化子代理，因此正文必须先确认目标是合法角色目录，再应用本篇规则。`player/` 仅是可被 `move` 送达的玩家空间，不是本轮初始化目标。

现有 `NOOK_INIT_INSTRUCTION` 仍把目标范围写得过宽（`extensions/instructions.ts:283-288`），这是与本轮上位契约的冲突；后续必须删除非角色目标分支。本篇不设计该分支。

**漏了会怎样：** 初始化器会在错误目录写入角色陈设，或把角色配置规则套到玩家空间；因此在目标约束落地前，不能把 `nook-init` 或本 Skill 装给非角色目标。

## 3. 行为契约（逐步；每步遗漏的后果）

### 3.1 第一步：确认身份，先读目录

1. 角色 agent 先读自己的 `characters/{id}/`；Writer 处理指定角色时使用完整的 `characters/{id}/...` 路径。
2. 读完已有文件后，标出四个配置文件、根级生活痕迹、子目录及其中内容。
3. 如果 brief 没有提供角色过去或某件物品的事实，只写能由 brief、已读文件或当前对话支持的部分，并在报告中说明缺口。

**漏了会怎样：** 只按目录名猜，会把空目录写成履历；只读 README 会漏掉角色的配置和已有痕迹，容易重复写一套陈设；把别的角色目录当作自己的目录会造成越权写入。[推断]

### 3.2 第二步：分离配置与生活痕迹

配置区固定为：

```text
characters/{id}/README.md
characters/{id}/identity.md
characters/{id}/personality.md
characters/{id}/memory.md
```

生活痕迹可以直接放在根目录，也可以放子目录：

```text
characters/{id}/repaired-watch.md
characters/{id}/diary/2026-09-14.md
characters/{id}/keepsakes/letter-from-mara.md
```

配置承担“这个角色是谁、如何说话、被允许当作长期事实的记忆”；痕迹承担“角色留下过什么、反复使用什么、藏过什么、没有收尾什么”。Skill 只能把后者作为普通内容任务处理。对四个配置文件：

- 不调用 `move`；
- 不调用删除动作；
- 不因“顺手整理”而重写配置；
- 在根目录缺少配置时，也不自行发明完整身份、人格或记忆；只报告缺失，除非当前任务明确是配置初始化/维护。

**漏了会怎样：** 把一张旧车票写进 `personality.md`，角色人格与道具历史混在一起；删除 `memory.md` 会切断角色连续性；移动 README 会让 Nook 失去门面，且会破坏目录身份。[推断]

### 3.3 第三步：写一件有来源的生活痕迹

鼓励四类生活痕迹，也鼓励在有来源时维护一条记忆；“记忆”要先区分载体：短暂或未确认的记忆写独立日记/便笺，角色可长期依赖的已知事实才进入根 `memory.md` 的配置维护流程。每类都必须落到一个具体对象或可核验片段：

| 类型 | 写什么 | 不写什么 |
|---|---|---|
| 物品 | 一件被使用、修理、藏起或准备交出的东西；需要被拿走/使用时选择可移动的文件实体 | 用长篇说明代替物件；把道具写成配置判断 |
| 日记 | 某日、某次谈话或某个未完成动作留下的短片段，可写“我不知道” | 全知叙述、完整时间线、替角色下结论 |
| 纪念物 | 磨损、折痕、刻字、摆放位置，以及它为何仍被保留的可观察证据 | 把“珍贵/悲伤/怀旧”等心理结论当事实 |
| 信件/便笺 | 收件人、写下的承诺或未寄出的正文；需要开封时再选 letter 等合适载体 | 没有来源的秘密、玩家从未见过的承诺 |
| 记忆 | 角色确实经历或被明确告知的事实、原话、承诺和未回答的问题；保留来源与不确定性 | Writer 全知信息、心理推断、未经确认的因果 |

生活痕迹写“留下了什么”，不要写角色此刻正在进行的场景；不填满空白，保留矛盾和未解释之处。需要 `type: component` 的文件先调用 `get_component`，再按返回的字段写入；普通只读痕迹使用最小 Markdown，不为每件物品强行添加交互。

**漏了会怎样：** 没有来源的纪念品会变成伪造的角色历史；把“他很念旧”当成日记正文会覆盖 Writer 后续可用的解释空间；写错组件 kind 会退化成普通卡片，计划中的互动不存在。

### 3.4 第四步：选择根级或子目录，并理解首页投影

直接子级是进入 Nook 首页的陈设候选；需要在首页一眼可见的物件、最近日记或核心纪念物应直接放在 `characters/{id}/` 下。可建子目录来表达收纳关系，例如 `diary/`、`keepsakes/`、`letters/`；子目录文件仍属于这个角色，但不会自动成为父 Nook 的 `items`。

现有路由通过递归 `listFiles` 后再调用 `nookCardPaths`，只取 `characters/{id}/` 的直接子级 `.md`，并排除 README（`apps/server/src/routes/world.ts:587-590`；`packages/shared/src/rules/characters.ts:55-69`）。因此：

- `characters/ryo/keepsakes/key.md` 可以归档，但不应声称它会出现在 Nook 根页面的卡片列表；
- `characters/ryo/key.md` 才是直接子级投影候选；
- 非 Markdown 文件和更深层文件不是这条投影的卡片。

**漏了会怎样：** 把所有内容塞进子目录会让首页看起来空；把“递归归属”误当“递归投影”会让模型向玩家承诺一个当前 UI 看不到的卡片；把 README 同时当 scene 和 item 会产生两个位置。

### 3.5 第五步：用 `move` 交付物品，不把“给出”写成叙述

只有已有的单个 Markdown 物品文件才使用 `move`。目标写完整的世界根相对文件路径，例如：

```text
move {
  from: "characters/ryo/keepsakes/brass-key.md",
  to:   "player/brass-key.md"
}

move {
  from: "characters/ryo/letter-to-mara.md",
  to:   "world/baker-street/letter-to-mara.md"
}
```

`player/` 和 `characters/{id}/` 不是 layer；当前 `moveEntity` 对非 `.md` 目标会尝试 `resolveLayer`，所以不要把裸 `player/` 当目录目标，使用不冲突的完整文件目标（`packages/shared/src/actions/move.ts:113-128`）。放进世界时可使用已知场景目录让动作补文件名，或直接提供最终 `.md` 路径；教程示例优先使用最终路径以避免歧义。目标存在时不覆盖，改用新目标名或先让玩家决定。

移动的语义是文件实体换了归属；动作会重写引用、迁移卡片位置并发出 `entity_moved`（`packages/shared/src/actions/move.ts:161-204`）。它不是“角色走过去”，也不会改变角色 presence。

**漏了会怎样：** 只写一句“把钥匙给玩家”不会产生背包文件；传 `to: "player/"` 会因它不是已知 layer 而失败；把对象移动到 `characters/{other}/` 会越过角色边界；直接覆盖目标会丢失原有物件。

### 3.6 第六步：用 `move_to` 改角色位置

角色站到世界中使用 `move_to`，目标是场景目录或场景内实体：

```text
move_to {
  character: "ryo",                 # Writer/非角色调用方必须显式给出
  destination: "world/baker-street"
}
```

角色 agent 移动自己时可省略 `character`，由 `AIRP_AGENT_ROLE=character:<id>` 解析；Writer 和玩家 UI 必须显式指定角色（`packages/shared/src/actions/presence.ts:48-90`）。`move_to` 的 `destination` 不能是 `characters/ryo/`、`characters/ryo/desk.md` 或 `player/...`；角色目录是小天地，不是角色可以站立的场景。目标解析明确排除 `player/**` 与 `characters/<id>/**`（`packages/shared/src/actions/presence.ts:133-165`）。

`move_to` 写 `canvas.db` 的 presence 行，成功后发出 `character_moved`；它不写角色目录，也不启动角色进程（`packages/shared/src/actions/move-to.ts:1-7,84-128`）。

**漏了会怎样：** 用 `move` 移动角色目录会破坏文件归属；把 `characters/ryo/` 当 destination 会得到 `invalid_argument`/`not_found`，而不是把角色放进家里；只改 README 中的“所在地”不会更新实时 presence。

### 3.7 第七步：遵守 `memory.md` 的事实纪律

`memory.md` 不是日记仓库，也不是 Writer 的全知剧情摘要。写入一条长期记忆前，逐项确认：

1. 角色亲自看见/听见，或玩家/其他角色明确告诉了它；
2. 人名、物品名、承诺和拒绝尽量保留原词；

3. 不把猜测写成事实；不确定时写“我不确定”“据他说”，或暂不写；
4. 不从 Writer 视角补齐角色没有经历的场面；
5. 允许“尚未回答”“关系未定”“两处记录冲突”继续存在。

对刚发生但尚未确认的体验，优先写独立日记/便笺痕迹；只有它成为角色可依赖的已知事实，且任务明确要求维护长期记忆时，才更新 `memory.md`。根配置文件不可移动/删除，但明确的记忆维护任务仍可编辑其内容；本 Skill 不授权跨角色读取或替角色决定记忆。

**漏了会怎样：** 把玩家未说出的幕后真相写进 memory 会污染角色视角；把“她很生气”替代原话会把推断固化成 canon；把所有每轮对白复制进去会让 memory 变成无边界日志，下一次角色无法区分事实与草稿。

### 3.8 第八步：按可见性、权限和动作结果收尾

把所有根级 Markdown 都视为可能被玩家读到：当前 `GET /api/nook` 只将 README 排除，其余直接子级 Markdown（包括 `identity.md`、`personality.md`、`memory.md`）都进入 `items`（`apps/server/src/routes/world.ts:587-590,630-659`；筛选函数 `packages/shared/src/rules/characters.ts:55-69`）。该路由入参只有裸 `character` id，没有 actor/角色权限参数（`apps/server/src/routes/world.ts:562-567`），所以 Skill 在运行时门禁落地前不得承诺“配置只对角色可见”，也不得把秘密或提示词写进配置文件。

权限工作法先按意图约束：角色只写自己的 nook，Writer 只按明确任务维护指定角色，不以“能读到路径”推断“有权修改”；交给玩家/世界的物品必须由调用方明确指定目标。每个动作返回后检查结果；失败时报告失败路径，不重试到另一个未经允许的目标。

**漏了会怎样：** 把当前页面当私密配置面板会泄露身份、人格和记忆；把通用工具存在当作授权会让角色代理修改其他角色；静默吞掉失败会使玩家以为物品已进入背包而实际仍在原目录。

**本设计冻结的公共可见性方案（需上位共同上下文同步）：** `/api/nook` 的 `scene` 仍只返回根 `README.md`；`items` 仍只取角色根的直接子级 Markdown，但必须排除 `README.md`、`identity.md`、`personality.md`、`memory.md`，保留根级生活痕迹；子目录内容继续不进入父页直接投影。角色读取配置依赖 Character preset/context，不依赖公开 Nook `items`。在该过滤实现和契约回写完成前，运行中的 route 仍会暴露配置，故 Skill 绝不把当前页面称作安全私密面板。

**漏了会怎样：** 只改 Skill 不改 route，玩家仍能看见配置；只改 route 不改 Character preset，角色又读不到自身 memory；把子目录递归加入 items 会破坏直接子级投影。

## 4. 文件与副作用

### 4.1 本 Skill 的文件范围

| 文件/目录 | 设计用途 | Skill 行为 |
|---|---|---|
| `skills/nook-management/SKILL.md` | 新增教程本体 | 由实现批次创建；本篇不创建 |
| `characters/{id}/README.md` | Nook 门面/scene，角色基础描述 | 只在明确配置任务中维护；不移动、不删除 |
| `characters/{id}/identity.md` | 身份配置 | 不放生活痕迹；不移动、不删除 |
| `characters/{id}/personality.md` | 人格配置 | 不放生活痕迹；不移动、不删除 |
| `characters/{id}/memory.md` | 长期事实记忆 | 按事实纪律编辑；不移动、不删除 |
| `characters/{id}/<dir>/<trace>.md` | 可归档生活痕迹 | 可创建、编辑；属于角色但不进入根 Nook 直接子级投影（归属判定见 `packages/shared/src/rules/characters.ts:39-53`；投影判定见 `:55-69`） |

创建目录是文件写入的副作用，不是新 layer；`resolveLayer()` 对 `characters/**` 返回 `null`（`packages/shared/src/store/local-store.ts:550-556`）。Skill 不创建 `world.json`、manifest、preset、presence 行或第二份记忆数据库。

### 4.2 动作副作用

- 直接写入/编辑生活痕迹：只改变对应 Markdown；若使用现有 `writeChalk`，其创建/编辑会落 `entity_created`/`entity_edited`（`packages/shared/src/actions/chalk.ts:499-537`）。
- `move`：物理移动单个 `.md`，可能重写引用、迁移卡片座位，并落 `entity_moved`；不会把角色站到新场景。
- `move_to`：只写 presence；不会移动或编辑 `characters/{id}/` 下文件。
- `GET /api/nook`：纯读，不应落世界事件；返回 `LayerState` 形状，但 `layer` 字段是 `characters/{id}` 的 nook id，不改变 layer 体系。

## 5. 落账

本 Skill 不增加状态字段或事件类型。小天地的事实来源仍是角色目录中的 Markdown；角色 presence 仍是 `canvas.db` 的既有行。教程不得引入 `nook_state`、`active_nook`、`branch_state` 等第二真相。

- 直接写入/编辑生活痕迹：若使用 `writeChalk()`，沿用 `entity_created`/`entity_edited`；动作在文件写入成功但事件落账失败时必须报告 `event_failed`，不能声称“已完成”（`packages/shared/src/actions/chalk.ts:499-543`）。
- `move`：沿用 `entity_moved`，其 details 记录 `from`、`to`、引用重写数和悬挂引用数；文件移动与角色在场是两个动作（`packages/shared/src/actions/move.ts:161-204`）。
- `move_to`：沿用 `character_moved`，只更新 presence；不写角色目录（`packages/shared/src/actions/move-to.ts:84-128`）。
- `GET /api/nook`：纯读，不落事件；返回 `LayerState` 形状，但 `layer` 是 `characters/{id}` 的 nook id，不改变 layer 派生（`apps/server/src/routes/world.ts:630-659`）。

**漏了会怎样：** Skill 自造一个“留下物品”事件会让事件枚举和 UI 分流失去唯一真相；把文件移动和 presence 合成一次动作会让玩家看到文件变了却不知道角色是否走动；忽略 `event_failed` 会把部分成功伪装成完整成功。

## 6. WS 与前端刷新

本教程不新增 WebSocket 帧，也不要求第二条 WS。既有 event bridge 会把事件广播成 `world_event`（`apps/server/src/engine/event-bridge.ts:451-452`）；前端已有判重、转发和 HTTP 重取分支（`apps/web/src/state/useWorld.ts:427-449`）。实现 NookView 时，按前端领域设计把当前角色的 `/api/nook?character=<id>` 重新取回；不要在 Skill 中发明 `nook_updated` 或直接拼一份本地状态。[推断]

`move_to` 的 presence 和 Nook 文件列表分离：角色换场景不应改变 Nook items；物品从角色目录移动到 `player/...` 或 `world/...` 才会改变源/目标目录投影。事件消费失败时保留既有去重和重取语义，不由 Skill 重试另一个路径。[推断]

**漏了会怎样：** 为 Nook 另开 WS 会制造两套事件时序；只更新本地 items 会漏掉后端座位、引用或事件结果；把 `character_moved` 当成文件变化会产生无意义刷新。

## 7. 错误边界

| 情形 | 教程动作 | 预期边界/报告 |
|---|---|---|
| 角色 id 非法、绝对路径、`.`/`..`、反斜杠或隐藏段 | 停止，不尝试改写成“看似合法”的路径 | `invalid_argument` 或 `invalid_path`；只使用 `isValidCharacterId()` 和现有路径校验 |
| 目标目录/文件不存在 | 先读并确认目录；不从目录名猜内容 | `not_found`；报告缺失路径 |
| `move` 目标已存在 | 不覆盖；请求新名字或等待决定 | `already_exists`；源文件保持不变 |
| `move` 的 `from` 是目录、README 或非 Markdown | 不把目录当物品；四个配置文件也停手 | `not_movable`/`invalid_argument`；四配置门禁属于 §8.2 的实现前置，不能由 Skill 绕过 |
| `move` 目标写成裸 `player/` | 改为完整的 `player/<name>.md` | 当前 `moveEntity()` 会因 `player/` 不是 layer 而失败（`packages/shared/src/actions/move.ts:113-123`） |
| `move_to` 目标在 `player/` 或 `characters/<id>/` | 不执行；选择 `world/...` 场景目录或场景实体 | `invalid_argument`/`not_found`；不产生 `character_moved`（`packages/shared/src/actions/presence.ts:155-165`） |
| memory 的事实来源不充分 | 不补全，不用 Writer 全知视角；把缺口写进报告 | 不写 `memory.md`，或只保留有来源的不确定表述 |
| 写入成功但事件失败 | 保留实际文件结果并报告部分成功 | `event_failed` 及路径；禁止重复写导致重复卡片 |
| 跨角色写/移/删 | 当前动作可能没有拒绝；Skill 必须先不执行并报告权限未确认 | 运行时按冻结 actor 矩阵实现：只有 `edit_character_config` 允许配置编辑，generic write/edit/move/delete 不能绕过；未落地前阻断 Character Skill |

教程应优先让错误显形：不以 `console.warn` 作为玩家可见的成功反馈，不把失败吞掉后继续写另一个目录。完整错误码以对应动作现有契约为准；本文不增加错误枚举。

**漏了会怎样：** 路径错误被重试成另一个目标可能造成越权或错误移动；事件失败被隐藏会令目录、画布和事件历史互相矛盾；未决权限被当作成功会把 Skill 规则误当成安全控制。

## 8. 精确代码落点


### 8.1 现有落点（只引用，不在本设计批次修改）

- Skill 发现格式与加载层：`skills/README.md:14-40`；项目级和世界级目录由 `apps/server/src/engine/presets.ts:95-118` 的 `skillArgs()` 传给 pi-rp。
- Writer/Character 都继承两层 Skill：`apps/server/src/engine/launch.ts:146-180`；角色常驻指令目前说明 README/identity/personality，但漏列 `memory.md`（`extensions/instructions.ts:193-198`）。
- Nook 身份与直接子级投影：`packages/shared/src/rules/characters.ts:24-69` 的 `isValidCharacterId()`、`nookIdOf()`、`characterIdOfPath()`、`nookCardPaths()`；不得另写一份角色 id 正则。
- Nook 取数：`apps/server/src/routes/world.ts:562-590` 校验裸 id、检查目录并构造直接子级 items；`630-659` 以 README 为 scene 并返回固定的 `links: []` / `presence: []`。
- 写痕迹与文件移动：`packages/shared/src/actions/chalk.ts:389-537` 的 `writeChalk()`；`packages/shared/src/actions/move.ts:73-129,161-204` 的 `moveEntity()`。
- 角色 presence：`packages/shared/src/actions/move-to.ts:21-128` 的 `MoveCharacterInput` 与 `moveCharacter()`；目标解析和角色 id 权限语义在 `packages/shared/src/actions/presence.ts:53-90,133-165`。
- 删除与编辑：`packages/shared/src/actions/delete.ts:71-145` 的 `removeEntity()` 当前只保护 README；`152-218` 的 `editEntity()` 对已存在文件没有角色配置特殊分支。
- Native builtin 文件工具入口：`extensions/world-context.ts:8-19` 监听 `write`/`edit` 的 `tool_call`，校验 Markdown 根目录并追踪写入；它是 shared Nook 门禁必须接入的写前拦截点。

### 8.2 本设计建议的新增落点（后续实现，全部标 NEW）

1. **NEW `skills/nook-management/SKILL.md`**：实现 §2.2 的 frontmatter 和角色小天地教程正文。Skill 只教动作选择与事实纪律，绝不承担安全权限；在运行时门禁落地前不得把它装给 Character。
1a. **Skill corpus 装配门禁：** `tools/check-skills.mjs` 的 `TRIGGERS_BY_SKILL`/`EXPECTED_PLATFORM` 必须登记 `nook-management`，并用 `loadSkillsFromDir`、`skillArgs` 和新 Character session 的 `<available_skills>` 正负探针确认：门禁未完成前不得把该 Skill 装给 Character；只检查文件存在不算装配完成。
2. **NEW `packages/shared/src/rules/characters.ts` 导出：**

   ```ts
   export function characterRootConfigOf(path: string):
     'README.md' | 'identity.md' | 'personality.md' | 'memory.md' | null;
   ```

   该纯函数识别角色根目录四个配置文件；实现时复用 `isValidCharacterId()`/`characterIdOfPath()`，不复制路径正则。
3. **NEW `packages/shared/src/actions/actor.ts` 导出运行时门禁：**

   ```ts
   export type NookMutationOperation = 'write' | 'edit' | 'move' | 'delete';
   export function canMutateCharacterNook(
     actor: Actor,
     agentScope: 'writer-top-level' | 'character' | 'initializer' | 'player',
     characterId: string,
     operation: NookMutationOperation
   ): boolean;
   export function assertNookMutationAllowed(
     actor: Actor,
     agentScope: 'writer-top-level' | 'character' | 'initializer' | 'player',
     path: string,
     operation: NookMutationOperation
   ): void;
   `assertNookMutationAllowed()` 必须在 `writeChalk()`（`chalk.ts:389`）、`moveEntity()`（`move.ts:73`）、`removeEntity()`/`editEntity()`（`delete.ts:82,152`）以及 NEW `create_char` 的最终写入前调用；若模型侧 generic `write`/`edit` 绕过这些动作，也必须经 NEW `writeWorldEntity(ctx: ActionContext, input: WriteChalkInput): Promise<ActionResult<WriteChalkDetails>>` 与 `editWorldEntity(ctx: ActionContext, input: EditEntityInput): Promise<ActionResult<EditEntityDetails>>` wrapper。四个配置可被受信的 `edit_character_config` action 显式编辑，但永远拒绝 `move/delete`；普通 write/edit 一律拒绝配置。漏接任何入口都不能把 Skill 当成保护。

   **NEW `packages/shared/src/actions/edit-character-config.ts` 受信配置编辑 action：**

   ```ts
   export interface EditCharacterConfigInput {
     characterId: string;
     file: 'README.md' | 'identity.md' | 'personality.md' | 'memory.md';
     content: string;
     mode: 'replace' | 'append';
   }
   export async function editCharacterConfig(
     ctx: ActionContext,
     input: EditCharacterConfigInput
   ): Promise<ActionResult>;
   ```

   `editCharacterConfig()` 是唯一配置编辑入口：先用 `nookIdOf(characterId)` 组成根路径，再按共同契约的 actor 矩阵授权；`character:<id>` 只能编辑自身 `memory.md`，Writer 可编辑 `manifest.characters` 中任一已登记角色的四项，engine、nook-init、player、god 与未授权 actor 拒绝。**例外（2026-09-14 明月拍板）：`agentScope === 'initializer'` 的子代理走同一受信 action，但只允许创建尚不存在的配置（create-only；目标已存在则 `unsupported`）**——因为 `doc-11 §4.1` 要求 nook 初始化"若缺则补" `README.md`，而 native `write/edit` 对四配置一律拒绝，没有这条通道 README 永远写不出来，nook 会被判成空态并反复重触发。它只允许 `replace`/`append` 写内容，永远不提供 move/delete；成功沿用 `entity_edited`，不新增事件类型。`ActionService` 新增 `editCharacterConfig(input: EditCharacterConfigInput): Promise<ActionResult>` 方法，并由受信工具入口注册；普通 builtin `write`/`edit` 不得接收配置维护旁路。


`extensions/world-context.ts:10-19` 的 native `tool_call` 回调必须在工具真正执行前读取服务端注入、模型不可修改的 `agentScope`，加载并合并目标 Markdown 的最终 frontmatter；若最终内容是 `component: photo`（包括 body/caption-only edit 继承旧 photo 类型），直接以 `invalid_argument` 阻断并不落盘，因为 native `write/edit` 不是受支持的 photo 写入入口；捕获其他权限拒绝后返回 `{ block: true, reason }`，不得继续只登记 `writes`。`edit_character_config` 同样只接受服务端 `ctx.agentScope`，不得从模型参数取得授权。该回调只拦模型对世界 Markdown 的写入；内部 manifest/asset 继续走 engine 专用 `WorldStore.writeFile()` 路径。
**模型入口是前置门禁，不可只新增 wrapper：** 当前 `presets/character.json:15-43` 仍通过 `tools` slot 暴露默认工具面，未在 deny 清单中收窄 builtin `write`/`edit`。在 Character Skill 装载前，平台 preset 与所有世界角色 preset MUST 禁用裸 builtin `write`/`edit`，或把同名入口包到上述 gate；模型只可调用 guarded `writeWorldEntity()`/`editWorldEntity()`。内部 engine 对 manifest/asset 的 `WorldStore.writeFile()` 仍走独立内部路径，不应被模型 actor gate 拦截。四动作 write/edit/move/delete 的入口测试全部通过后才允许装 Skill。

   **冻结的 actor 矩阵：**

   | actor | 生活痕迹 `write/edit` | 四配置编辑（仅 `edit_character_config`） | 物品 `move` | 四配置 `move/delete` | `move_to` |
   |---|---|---|---|---|---|
   | `character:<id>` | 仅自己的 `characters/<id>/**` | 仅自己 `memory.md`，且必须通过受信 action | 仅自己的生活痕迹，可交给 `player/` 或 `world/` | 永久禁止 | 仅自己，省略 `character` 时解析为自己 |
   | `writer` | `manifest.characters` 中已登记的任一角色 | 任一已登记角色四项，且必须通过受信 action | 指定角色的生活痕迹 | 永久禁止 | 必须显式指定角色 id |
   | `engine` / `nook-init` | 仅按 brief 写入生活痕迹；不得写入 `player/` | **仅可创建缺失的配置**（create-only；已存在则拒绝）；不得用此通道改写既有配置（create_char 的初始字段由 Writer action 自己提交，不走此 actor） | 不作为初始化动作搬运 | 永久禁止 | 不因初始化而移动角色 |
   | `player` | 仅 `/api/nook-note` 的既有玩家便签通路；不接受通用角色路径写入 | 禁止 | 玩家 UI 明确发起的非配置物品转移 | 永久禁止 | 不由 Skill 触发 |
   | `god` | 任意角色生活痕迹 | 拒绝 | 任意非配置物品 | 永久禁止 | 按既有显式角色参数 |

   `nook-note.ts:53-55` 已有 player actor 专用检查，但不能替代上述通用门禁。
4. **迁移既有 `nookCardPaths()`（不得新增第二套 projection helper）：**

   ```ts
   // 既有 packages/shared/src/rules/characters.ts
   export function nookCardPaths(allFiles: readonly string[], nookId: string): string[];
   ```

   修改该既有 helper，使其保留角色根直接子级生活痕迹 Markdown，排除 README、identity、personality、memory；子目录仍不投影。同步更新全部 callers：`GET /api/nook`（`apps/server/src/routes/world.ts:587-590`）、`arrangeCards` nook 分支（`packages/shared/src/actions/canvas.ts:519-524`）和既有 `init-rules` 测试（`packages/shared/test/init-rules.test.mjs:116-126`）。所有 callers 必须继续共享同一直接子级投影判据；不得新增第二套 projection helper。
5. **角色 memory 装载迁移：**

   - **修改 `extensions/instructions.ts` 的 `CHARACTER_INSTRUCTION`**：把角色配置说明从 README/identity/personality 扩为 README/identity/personality/**memory**，并注明 memory 是角色视角的事实记录。
   - **修改 `presets/character.json`**：加入共同上下文冻结的 `profile` file slot：`path: ["README.md","identity.md","personality.md","memory.md"]`、`baseDir: "characters/{id}"`、`stripFrontmatter: true`、`onMissing: "skip"`。
   - **修改所有世界自带 `characters/*/preset.json`**：已有完整 profile 的（例如 `templates/whitechapel/characters/watson/preset.json:53-68`）保留 memory；旧 preset 补同一 slot，不添加第二份。`characterLaunch()` 优先世界 preset、否则平台 preset（`apps/server/src/engine/launch.ts:145-162`）。
   - **旧 session 重启：** preset/instruction/profile 改动后停止并按 `characterLaunch()` 重启角色；复用 `char-<id>.jsonl`（`launch.ts:163-175`），不得删除历史。验证新进程 prompt 同时包含 memory 与 `nook-management`；旧进程不算迁移完成。[推断：pi-rp 恢复 session 的 prompt 重编译时机需实测]
6. **`nook-init` 目标落点：** `NOOK_INIT_INSTRUCTION`（`extensions/instructions.ts:283-311`）和 `presets/nook-init.json:26-37` 的初始化链路本轮只允许 `characters/{id}/`；必须删除现有非角色分支与相关文案。初始化 brief 不得接受 `player/`，角色初始化走本 Skill 的配置保护和 actor 矩阵，不调用 `move_to`。

通用 pi `write`/`edit` 直接落到 `WorldStore.writeFile()` 时，不能把整个 store 当权限边界：它还服务内部文件和二进制写入（`packages/shared/src/store/world-store.ts:108-110,138-140`；`packages/shared/src/store/local-store.ts:166-210`）。门禁必须位于模型可调用入口，不能误伤内部 manifest/asset 写入。
## 9. 与现状差异

| 目标行为 | 当前实现/事实 | 差异与后果 |
|---|---|---|
| 四个根配置永不可移动、删除 | `moveEntity()` 只拒绝 README（`move.ts:95-100`）；`removeEntity()` 的 `movablePathError()` 也只拒绝 README（`delete.ts:71-79,99-105`） | 运行时目标是四文件在 `move`/`delete` 永久拒绝；普通 `write`/`edit` 也拒绝配置，只有显式配置维护按 actor 矩阵放行。当前仍缺门禁，Skill 不能替代它 |
| Nook 首页只展示公开生活痕迹 | 既有 `nookCardPaths()` 当前过滤直接子级 `.md` 且排除 README（`characters.ts:55-69`）；route/canvas/test 都调用它（`world.ts:587-590`；`canvas.ts:519-524`；`init-rules.test.mjs:116-126`） | 迁移同一 helper：MUST 排除 README、identity、personality、memory，只投影根级生活痕迹；不得新增第二套 projection helper |
| 角色只能修改自己的 nook | `resolveTargetCharacter()` 对 manifest 缺失只警告，并明确无 permission gate（`presence.ts:68-79`）；`editEntity()` 只检查目标是文件（`delete.ts:156-168`） | 运行时目标是 actor 矩阵；Skill 仅能先拒绝跨角色动作，不能将工具可用性当权限 |
| `move_to` 是角色位置动作 | 代码只写 presence、目标要求世界 scene（`move-to.ts:1-7`；`presence.ts:155-165`） | 这是现状已成立的边界，Skill 不得把 nook 当 layer 或 destination |
| Nook 有独立读取路径但形状像 layer | `/api/nook` 返回 `LayerState` 字段，`layer` 填 nook id；route 注释明确 `resolveLayer` 不适用（`world.ts:552-560,659`） | Skill 可复用形状的说法，但必须保留“nook 不等于 layer”；不能调用 `enterLayer` 或引入 layer 状态 |
| 角色常驻记忆已加载 | `CHARACTER_INSTRUCTION` 明列 README/identity/personality，未列 memory（`instructions.ts:197-198`）；通用 character preset 的 file slots 也只加载这些文件（`presets/character.json:33-43`） | 必须迁移 instruction、平台 preset、世界 preset，并重启旧 session；迁移前不能声称角色已读 memory |
| `nook-init` 目标只允许角色 | 当前指令仍把非角色空间并列为目标（`instructions.ts:283-288`），preset 只注入一个 `nook-init-instruction`（`presets/nook-init.json:26-37`） | 本轮冻结只支持 `characters/{id}`；非角色目标必须拒绝，不能由本 Skill 扩展 |

## 10. 可执行验收测试
以下是后续实现 `nook-management` 及运行时门禁时的验收脚本/断言；本设计阶段不运行它们。测试必须使用一个没有污染的角色 fixture（不要把已有 canvas 探针角色当首次排座 fixture）。统一用 `node --test`，不依赖不存在的 root `test` script。

### 10.1 Skill 文件与教程行为

新增 `packages/shared/test/nook-management-skill.test.mjs`（NEW）后，执行：

```bash
node --test packages/shared/test/nook-management-skill.test.mjs
```

测试以临时世界和固定提示评测 harness 运行至少这些场景：

1. **配置/痕迹分离**：给角色已有四个配置和一个 `keepsakes/key.md`，教程任务要求“留下钥匙”；输出必须写/编辑 `keepsakes` 或根级痕迹，不能把钥匙正文写进四个配置文件，且不得生成配置移动/删除动作。
2. **事实纪律（非阻断模型实验）：** brief 只给“玩家说钥匙在抽屉里”时，未来可用固定模型 harness 评估 memory 不添加未见事实；本轮 `node --test` 不依赖模型、seed 或该 harness，改由静态 Skill 规则和 action/route 集成测试证明配置与事实边界。
3. **动作选择**：物品交给玩家必须产生 `move({from: "characters/<id>/...", to: "player/..."})`；物品放回世界必须产生 `move(..., "world/...")`；角色到场必须产生 `move_to`，不能用 `move` 移动角色目录。
4. **子目录投影说明**：教程同时写 `characters/<id>/diary/entry.md` 和根级 `keepsake.md` 时，报告必须说明前者归属该角色但不会出现在根 Nook 直接子级卡片列表。

### 10.2 公共投影与后续运行时门禁

在已接通 `/api/nook` 的 fixture 世界上，公共投影验收必须断言：

```text
GET /api/nook?character=ryo
→ 200；layer === "characters/ryo"；items 含直接子级生活痕迹，不含 README、identity.md、personality.md、memory.md，也不含任何子目录文件
```

后续门禁测试（在 `characterRootConfigOf()`、`assertNookMutationAllowed()`、既有 `nookCardPaths()` 迁移与 preset 迁移实现后）：

3. `editCharacterConfig(ctx, {characterId: "ryo", file: "memory.md", content: "玩家把钥匙放在抽屉里。", mode: "append"})` 由 ryo character actor 成功并落一个 `entity_edited`；同一 actor 目标为 `identity.md` 或别的角色时拒绝；Writer 对 `manifest.characters` 中任一已登记角色的四项可成功。
2. 普通 `writeChalk()`/`editEntity()` 对四配置返回配置保护错误；只有受信 `edit_character_config` action 按 actor 矩阵放行配置编辑，且仍不能 `move`/`delete`。
3. `editCharacterConfig(ctx, {characterId: "ryo", file: "memory.md", content: "玩家把钥匙放在抽屉里。", mode: "append"})` 由 ryo character actor 成功并落一个 `entity_edited`；同一 actor 目标为 `identity.md` 或别的角色时拒绝；Writer 对 `manifest.characters` 中任一已登记角色的四项可成功。
4. 非 ryo 的 character actor 对 `characters/ryo/keepsakes/key.md` 的写/移/删返回 `unsupported` 或既有权限错误；ryo 自己的同一动作成功。根配置的 move/delete 固定返回 `not_movable`，不另造未冻结错误码。
5. **模型入口直通负例**：使用 Character preset 当前默认工具表（`presets/character.json:15-43`）尝试调用 builtin `write`/`edit` 直接写 `characters/ryo/memory.md`；`extensions/world-context.ts:10-19` 必须在 tool_call 阶段阻断。测试同时通过内部 engine 路径写 manifest/asset，确认隔离层没有误伤内部写入。四个 write/edit/move/delete 入口均通过后，才允许装载 Character Skill。
6. `moveEntity({from: "characters/ryo/keepsakes/key.md", to: "player/key.md"})` 成功，源文件消失，目标存在，落一个 `entity_moved`；目标冲突时返回 `already_exists`。
7. `moveCharacter({character: "ryo", destination: "world/baker-street"})` 成功并新增/更新 presence；`moveCharacter({character: "ryo", destination: "characters/ryo"})` 返回 `not_found`，且不产生 `character_moved`。
8. `characters/ryo/diary/entry.md` 存在时，目标公共投影的 `items` 不含它；新增 `characters/ryo/root-note.md` 后，items 含它。该测试验证“递归归属、直接子级投影”是两个不同判据。
9. 修改平台/世界 preset 与 `CHARACTER_INSTRUCTION` 后，停止并重启 `characterLaunch()`；重启进程的 prompt 含 `memory.md` 与 `nook-management`，原 `char-ryo.jsonl` 历史仍保留。旧进程不算迁移完成。[推断：需要启动 harness 读取实际编译 prompt]


### 10.3 可执行的静态检查

实现 Skill 后至少执行：
test -f skills/nook-management/SKILL.md
node -e 'const fs=require("node:fs"); const s=fs.readFileSync("skills/nook-management/SKILL.md","utf8"); if(!/^---\nname: nook-management\ndescription: .+\n---\n/m.test(s)) process.exit(1); for (const x of ["memory.md","move_to","player/","world/","README.md","identity.md","personality.md"]) if (!s.includes(x)) process.exit(1)'
```

静态检查只证明教程文件具备触发元数据和关键术语；动作行为仍以 10.2 的临时世界测试为准，不能用字符串命中替代运行时测试。
5. 真实装配门禁：运行 `pnpm check:skills`，再运行 `pnpm probe:prompt` 与 Character prompt harness，断言 `loadSkillsFromDir`/`skillArgs` 结果中的 `<available_skills>` 恰有一个 `nook-management`，且未落地四动作门禁时 Character Skill 不装载；不能以静态文本命中替代真实 prompt 正负断言。

## 11. 发现的冲突与需要回写的上位文档

3. **角色权限缺口（方案已冻结，门禁待实现）：** `resolveTargetCharacter()` 明确无 permission gate（`presence.ts:68-79`），`editEntity()` 只检查目标是文件（`delete.ts:156-168`）。本篇 §8.2 的 actor 矩阵是冻结契约：只有 `edit_character_config({ characterId, file, content, mode })` 可编辑根配置；Character 仅自身 `memory.md`，Writer 可编辑 `manifest.characters` 中任一已登记角色的四项，engine/nook-init/player/god 及其他 actor 拒绝；generic native write/edit 默认拒绝，四动作 move/delete 永久拒绝。门禁全部落地后才可装载 Character Skill。
2. **公共配置可见性冲突（方案已冻结，需实现）：** 当前 `nookCardPaths()` 由“直接子级 Markdown 减 README”得到（`world.ts:587-590`；`characters.ts:55-69`），所以三个配置会被展示。本设计冻结目标是迁移同一 `nookCardPaths()` 以排除 README、identity、personality、memory，只投影根级生活痕迹；角色上下文从 profile slot 读取配置。实现必须保持共同上下文、route、canvas、测试四处同步，不能新增第二个 helper。
3. **角色权限缺口（方案已冻结，门禁待实现）：** `resolveTargetCharacter()` 明确无 permission gate（`presence.ts:68-79`），`editEntity()` 只检查目标是文件（`delete.ts:156-168`）。本篇 §8.2 的 actor 矩阵是冻结契约：只有 `edit_character_config({ characterId, file, content, mode })` 可编辑根配置；Character 仅自身 `memory.md`，Writer 可编辑 `manifest.characters` 中任一已登记角色的四项，engine/nook-init/player/god 及其他 actor 拒绝；generic native write/edit 默认拒绝，四动作 move/delete 永久拒绝。门禁全部落地后才可装载 Character Skill。
4. **memory 装载迁移：** `CHARACTER_INSTRUCTION` 漏列 memory（`instructions.ts:197-198`），平台 preset 只列基础 slots（`presets/character.json:33-43`），但世界 preset 可能已经有完整 profile（`templates/whitechapel/characters/watson/preset.json:53-68`）。必须同步 instruction、平台 preset、所有世界 preset，并按 §8.2 的旧 session 规则停止/重启 `characterLaunch()`；`char-<id>.jsonl` 历史保留，不以删 session 冒充迁移。
5. **Nook 与 layer 的术语边界：** `/api/nook` 复用 `LayerState` 形状，但 `resolveLayer()` 对 `characters/**` 返回 null，`move_to` 拒绝角色目录作为 scene（`world.ts:552-560`；`presence.ts:155-165`）。不得为满足 Skill 把角色目录塞进 layer 派生、presence 或第二状态。
6. **事件刷新边界：** event bridge 只广播既有 `world_event`（`event-bridge.ts:451-452`），前端当前事件分支默认 `fetchLayer(layerRef.current)`（`useWorld.ts:427-449`）。Nook 独立重取应由 NookView 设计接线；本 Skill 不新增帧名。
## 12. 本轮明确不冻结的后续能力

以下能力不是本轮小天地 Skill 的输入/输出契约，也不阻挡本轮实现；在独立治理设计冻结前，必须保持当前安全默认：

- 公共投影继续隐藏四配置，不提供配置检查端点；未来端点的审计/响应形状另立 RFC。
- `memory.md` 的合并、长度上限、冲突保留和 compaction 更新格式未定义；本篇只冻结“角色视角事实”与 profile slot 路径。
- 子目录生活痕迹的玩家浏览入口未定义；本篇只冻结归属与直接子级投影，不伪造递归 UI。
- 模型评测 harness、权限错误码扩展和 prompt 快照工具不是本轮验收依赖；动作/投影集成测试是生产启用前置，模型评测另行冻结。
