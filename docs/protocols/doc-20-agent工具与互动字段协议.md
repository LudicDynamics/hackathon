# doc-20 Agent 工具与互动字段协议

> 状态：**已定案，待实现（2026-09-12）**。
> 关联：`doc-05-AIRP产品构想.md`（产品与 Agent 分工）、`doc-06-演出与交互设计.md`（玩家可见演出）、`doc-09-叙事frontmatter完整schema.md`（互动字段）、`doc-10-组件协议与官方组件清单.md`（组件结构）、`后端实现计划.md`（施工顺序）。

## 0. 一句话

**作家、角色和玩家共同创作同一个世界；工具按能力定义，不按身份削权。** 作家与角色都能读写世界、移动角色、移动物件并触发组件互动。两者的区别是行动时机和叙事视角：作家是常驻的全局导演；角色从具体人物的处境出发，并且现阶段只在玩家与其直聊的会话期间行动。

## 1. 工具模型

Agent 有两层能力：

1. **开放创作层**：`read / bash / edit / write`。它们保证 Agent 能创造尚未被专用协议预见的内容，是共创能力的底座。
2. **AIRP 动作层**：`look_at / move_to / move / choose / roll_dice / use_item_on / set_following`。它们操作画布、presence、互动字段和引用关系，必须经过引擎落账。

专用工具不是原生文件工具的替代品。需要保留引用、画布位置、随机裁决或事件记录的动作走 AIRP 工具；自由创作内容直接用原生工具。

### 1.1 能力分发

| 能力 | 作家 | 角色 | 说明 |
|---|---:|---:|---|
| `read / bash / edit / write` | ✅ | ✅ | 都可读写整个世界；角色并不局限于自己的小天地 |
| `look_at` | ✅ | ✅ | 读取玩家可见语义，包括格式化后的互动字段 |
| `view_canvas` | ✅ | ✅ | 截取画布视觉；与文本语义工具 `look_at` 分工 |
| `chalk` | ✅ | ✅ | 快速写入 chalk；角色也可在世界或小天地落字 |
| `move_to` | ✅ | ✅ | 作家可移动指定角色；角色通常移动自己 |
| `move` | ✅ | ✅ | 统一拿取、放下、摆放、给予，始终经过引擎 |
| `choose` | ✅ | ✅ | 选择任意实体公开的 `choice` |
| `roll_dice` | ✅ | ✅ | 请求引擎按实体声明完成真随机裁决 |
| `use_item_on` | ✅ | ✅ | 将一个物件作用于另一个实体 |
| `set_following` | ✅ | ✅ | 统一邀请同行、开始跟随和离开 |
| `link / arrange` | ✅ | ✅ | 画布关系与布局；角色通常少用，但能力不裁掉 |
| `get_component / show / generate_image` | ✅ | ✅ | 组件创作、一次性演出和生图 |
| `delete` | ✅ | ✅ | 删除世界内容时经过引擎处理引用与事件 |
| `subagent / subagent_profiles` | ✅ | — | 作家的批量内容委托职责；不是角色具身行动 |
| `restructure_preview / confirm_restructure` | ✅ | — | 世界级目录重构职责 |

角色没有工具权限上的“只能写自己目录”。它可以按剧情需要在场景里生成物件、改写组件、移动角色或把一个新东西交给玩家。人格 prompt 只决定它通常会不会这样做，不把这种能力从工具层拿走。

### 1.2 角色行动时机

现阶段角色不会常驻自主活动，也没有角色间主动通信：

- 玩家打开角色直聊遮罩后，角色进程启动并可调用全部角色工具；
- 角色调用工具造成的文件、画布和 presence 变化立即落地；
- 玩家关闭直聊后，角色进程回收，不在后台继续行动；
- 暂不提供 `speak_to`，避免角色绕过“玩家直聊期间才行动”的生命周期；
- 暂不建设记忆系统，也不提供 `remember`、`leave_trace`。需要写信、日记、作品或痕迹时，角色直接使用 `write / edit / chalk`。

## 2. 互动字段属于所有实体

`choice / roll_dice / status` 是通用互动字段，不是 chalk 的专属字段。任何可渲染的 Markdown 实体都可以携带它们，包括 chalk、note、letter、gate 和题材包注册的组件。

```ts
const InteractiveFieldsSchema = z.object({
  choice: ChoiceSchema.optional(),
  roll_dice: RollDiceSchema.optional(),
  status: StatusSchema.optional(),
});

const EntityFrontmatterSchema = BaseEntitySchema
  .and(InteractiveFieldsSchema)
  .passthrough();
```

实现时不应继续由 `ChalkFrontmatterSchema` 独占这三个字段。解析器先识别实体本身的渲染类型，再统一提取互动字段交给前端和 `look_at` 格式化器。

### 2.1 `choice` 是通用互动协议

组件需要可互动能力时，作者直接在该组件的 frontmatter 写 `choice`，不再额外设计 `interact` 工具。

```markdown
---
type: component
component: piano
title: The Closed Piano
status:
  data:
    lid: closed
    tune: unknown
choice:
  - Open the lid
  - Play the unfinished nocturne
---

Dust has settled between the ivory keys.
```

`choose` 只表达“某个行动者选择了这个公开动作”。动作造成什么后果，可以由作家响应事件后写作，也可以由组件扩展的确定性 handler 处理；`choice` 本身不暗藏一套新的组件命令语言。

### 2.2 `roll_dice` 是实体声明、引擎裁决

任意实体都可以声明骰子：

```yaml
roll_dice:
  type: 1d100
  desc: Pick the rusted lock
  expect: ">50"
```

玩家可在 UI 点击骰子；作家和角色可调用 `roll_dice`。三种入口必须进入同一个引擎裁决函数：读取文件里的 `type / desc / expect`，生成随机结果，回写 `result / passed`，追加 `roll_resolved` 事件，再广播演出。

调用者不能把 `result` 作为参数传入；随机结果永远由引擎产生。这是随机裁决的一致性，不是 Agent 之间的权限隔离。

### 2.3 `status` 是实体的可见状态

`status.data` 可描述叙事阶段，也可描述具体组件：门是否上锁、钢琴盖是否打开、信件是否拆封。**它永远只是"某个组件（含 chalk）的一份快照"，随该实体走**——读它就等于读那个文件，没有独立的"状态系统"，也没有独立的状态载体。

**`status` 不是什么**（定案，非暂缓）：

- **不是独立文件**：没有 `.airpworld/state.json`、没有 `<save>/.pi/state/*.json`、没有状态命名空间。状态就是实体 frontmatter 里的一个键。
- **不是状态机**：引擎不维护内存态、不做字段级推理、不做双向同步。读了就改源文件，改了下次读就是新值。
- **没有 `get_state / set_state / state_update / watch_state`，且永不会有**。Agent 读用 `look_at`（格式化后的可引用文本块）或 `read`（原始文件）；写用 `edit / write`。引擎侧只靠 `fs.watch` 感知文件变化。

**为什么是"绝对不做"而不是"现阶段不做"**：这套东西的存在前提是"状态与内容分离"——世界有一份可脱离文件的、被代码逻辑消费的状态，才需要专门的读写工具与同步机制。AIRP 的前提正相反：**文件即真相，状态只是文件的一个字段**。一旦引入状态工具，就出现了第二个真相源，agent 可以绕过 `edit` 改状态，`fs.watch` 与事件表都看不见——那会同时打穿"文件即真相"和"事件是唯一变更来源"两条地基。这不是排期问题，是架构不相容。

### 2.4 README Gate 的进入条件

Layer 的 README 既是父层的 Gate，也是进入后的场景 Chalk。P0 先实现一个可验证的确定性门槛：

```yaml
requires:
  items:
    - player/brass-cap.md
blocked: Take the ultramarine brass cap. It is the first link in the case.
```

玩家点击 Gate 时，`POST /api/enter-layer` 重新读取目标 README，并确认 `requires.items` 中每个精确路径都存在；缺失则返回 `409 requirements_not_met` 与 README 自己的 `blocked` 人话，不追加 `layer_entered`。通过后才落场景进入事件并导航。

后续条件仍沿同一入口扩展，但必须分别定义真相源，不能把自然语言假装成确定性状态：

| 条件轴 | 预期真相源 | P0 状态 |
|---|---|---|
| 道具 / 钥匙 | `player/*.md` 的真实存在 | **已实现** |
| 同行角色 | `canvas.db presence.following` | 待实现 |
| 已确认事实 / 谜题 | 具体实体的 `status.data` 或已落账事件 | 待定案 |
| RP 综合判断 | Writer 读取本局事件与场景文件后写入明确结果 | 待实现；不能由 HTTP 猜测 |

因此“道具 + 人物 + 谜题齐全才开门”最终仍由 README 声明，但每一项必须能回指文件或事件；RP 只负责把模糊过程收成明确的世界事实。

## 3. `look_at`：读取玩家可见语义

```ts
look_at({
  path?: string | string[];
}): ToolResult
```

`look_at` 取代 `read_canvas` 作为文本画布感知工具。它不是文件读取器，也不是把 frontmatter 整段删除后只返回正文；它返回实体经过 AIRP 渲染规则解释后的文本视图。

### 3.1 格式化管线

对每个目标依次执行：

1. 解析 Markdown 与 frontmatter；
2. 隐藏原始 YAML 和纯渲染/控制字段，如 `type / component / material / bg`；
3. 输出玩家能看到的标题、摘要和正文；
4. 把 `status / choice / roll_dice` 格式化为稳定、可引用的文本块；
5. 保留实体路径，供后续 `choose / roll_dice / move / use_item_on` 精确指向；
6. 目录目标按当前层页面规则展开：本层文件 + 直接子层门牌，不递归泄漏子层内部。

未来增加新的特殊互动字段时，为 `look_at` 注册同名 formatter；不要恢复“返回全部 frontmatter”或“全部剥离”的两个极端。

### 3.2 输出示例

```text
[world/manor/music-room/piano.md]
The Closed Piano

Dust has settled between the ivory keys.

[Status]
lid: closed
tune: unknown

[Choices]
1. Open the lid
2. Play the unfinished nocturne

[Dice]
Pick the rusted lock · 1d100 · success >50 · not rolled
```

目录输出还应带人话方位关系；坐标只供引擎排座，不直接灌给 Agent。

### 3.3 `look_at` 与其他读取工具

| 工具 | 看到什么 | 用途 |
|---|---|---|
| `look_at` | 玩家可见正文 + 格式化互动字段 + 空间关系 | 理解当前画布并决定动作 |
| `view_canvas` | 玩家画布的视觉截图 | 判断构图、材质和视觉位置 |
| `read` | 原始文件，包括完整 frontmatter | 精确编辑和创作 |

不提供 `inspect`：深入查看仍然是对具体路径调用 `look_at` 或 `read`。

## 4. `move_to`：移动角色 presence

```ts
move_to({
  character?: string;
  destination: string;
  near?: string;
}): ToolResult
```

`move_to` 是作家与角色共享的角色调度工具：

- 角色省略 `character` 时默认移动自己；
- 作家填写 `character` 可移动任意角色；
- `destination` 为场景目录时，角色进入该层并落在一个不碰撞的空位；
- `destination` 为当前层组件路径时，角色移动并吸附到组件附近；
- `destination` 为其他层组件路径时，引擎先推导所属层，再完成跨层移动和附近排座；
- `near` 用于显式表达“进入该层并靠近某物”，必须属于目标层。

示例：

```json
{
  "character": "watson",
  "destination": "world/baker-street",
  "near": "world/baker-street/fireplace.md"
}
```

引擎只更新 `canvas.db` 的 presence，不移动 `characters/<id>/` 目录。成功后追加角色移动事件并广播新的在场位置。

## 5. `move`：移动物件文件

```ts
move({
  from: string;
  to: string;
  near?: string;
}): ToolResult
```

`move` 统一表达拿取、放下、摆放和给予。这些词只是剧情语义，底层都是一个物件从一个目录移动到另一个目录。

| 剧情动作 | `from` | `to` | `near` |
|---|---|---|---|
| 玩家拿起钥匙 | `world/inn/key.md` | `player/key.md` | — |
| 角色拿起钥匙 | `world/inn/key.md` | `characters/watson/key.md` | — |
| 角色把信交给玩家 | `characters/watson/letter.md` | `player/letter.md` | — |
| 把钥匙放回柜台 | `player/key.md` | `world/inn/key.md` | `world/inn/counter.md` |

所有移动必须经过引擎，不能用 `bash mv` 或原生 `write` 模拟。引擎在一个动作中完成：

1. 校验来源、目标与文件名冲突；
2. 移动文件；
3. 扫描并重写受影响引用；
4. 报告无法重写的 dangling 引用；
5. 把 canvas.db 的卡片记录迁移到新路径；
6. 目标是画布层时按 `near` 排座，否则寻找空位；
7. 追加 `item_moved` 事件并广播。

`move` 移动物件文件；`move_to` 移动角色 presence。两者不能合并。

## 6. `choose`：选择实体动作

当前沉浸式前端采用“点击填入、发送执行”：按钮点击不调用本工具，只在作家输入框准备选项并显示描述反馈；点击发送后作为一轮玩家输入处理。其他显式 API / Agent 的 choose 语义仍保持下文协议，世界自动续写设置不使前端草稿提前执行。

```ts
choose({
  path: string;
  choice: string | number;
}): ToolResult
```

- `path` 指向带 `choice` 的实体；
- `choice` 可传 `look_at` 输出中的序号或完整文本；
- 引擎重新读取源文件并确认选项仍然存在；
- 成功后追加包含 `actor / path / choice` 的事件并广播；
- 选择不会自动删除其他选项，也不会假定后果。作家或组件扩展根据事件继续演化世界。

玩家点击 UI、作家调用和角色调用共用同一动作函数。

## 7. `roll_dice`：触发实体骰子

```ts
roll_dice({
  path: string;
}): ToolResult
```

工具只接收实体路径。引擎以该实体当前的 `roll_dice` 为真相，不接受调用者重复提交 `type / expect`，避免 UI、Agent 参数与文件内容漂移。

成功结果至少返回：

```json
{
  "path": "world/manor/cellar-door.md",
  "type": "1d100",
  "desc": "Pick the rusted lock",
  "expect": ">50",
  "result": 62,
  "passed": true
}
```

重复掷骰的规则由字段协议决定；MVP 对已有 `result` 的骰子拒绝再次投掷，作者需要重开时先编辑掉旧结果。

## 8. `use_item_on`：物件作用于目标

```ts
use_item_on({
  item: string;
  target: string;
}): ToolResult
```

它与 `choose` 不重复：`choose` 是单实体公开的动作，`use_item_on` 表达“物件 A 作用于实体 B”的二元关系，例如钥匙开门、证物出示给角色、颜料涂到画布。引擎记录 `actor / item / target` 并广播，确定性组件 handler 或作家再写出后果。

调用本身不默认消耗或移动物件；若剧情需要消耗、交付或掉落，再显式调用 `move` 或编辑相应实体。

## 9. `set_following`：统一同行状态

```ts
set_following({
  character?: string;
  following: boolean;
}): ToolResult
```

- 角色省略 `character` 时默认自己；
- 作家可指定任意角色；
- `following: true` 覆盖邀请同行、答应跟随；
- `following: false` 覆盖离开队伍、停止跟随；
- MVP 的跟随目标固定为玩家，因此不增加 `target` 参数。

工具更新 presence 的 `following`，追加事件并广播。它不移动角色目录，也不启动角色进程。

## 10. 工具返回与事件

所有 AIRP 工具遵循 pi-rp 工具返回格式：

```ts
{
  content: [{ type: "text", text: string }],
  isError?: boolean
}
```

文本必须说明实际发生了什么，并返回后续动作需要的稳定路径。错误不得静默降级成成功。

动作事件至少携带：

```ts
{
  actor: { type: "writer" | "character" | "player", id?: string },
  action: string,
  target?: string,
  createdAt: string
}
```

事件用于下一轮上下文和前端演出，不应在动作路由里直接 `prompt()` 强行启动作家新一轮。

## 11. 明确不做
- **不提供 `get_state / set_state / state_update / watch_state`，也不引入任何状态文件或状态命名空间**（绝对不做，非暂缓）：状态只是实体 frontmatter 的一个键（§2.3）。读 `look_at` / `read`，写 `edit` / `write`。

- 不提供 `inspect`：`look_at` + `read` 已覆盖。
- 不提供通用 `interact`：组件互动统一写成 `choice`，调用 `choose`。
- 不拆 `take / drop / place / give`：统一为经过引擎的 `move`。
- 不拆 `invite / follow / leave`：统一为 `set_following`。
- 不提供 `speak_to`：角色现阶段只在玩家直聊期间行动。
- 不提供 `remember / leave_trace`，不建设角色记忆系统：写内容直接使用原生文件工具。
- 不用权限白名单限制角色只能写自己的目录；角色是共同作者，只是通常从自身处境行动。

## 12. 实现落点

| 模块 | 改动 |
|---|---|
| `packages/shared/src/schemas/frontmatter.ts` | 把互动字段从 chalk schema 抽成实体通用 schema；解析器对所有实体识别互动字段 |
| `packages/shared/src/schemas/events.ts` | 补齐角色移动、选择、骰子、用物、跟随等动作事件 |
| `packages/shared/src/store/world-store.ts` | 提供引用安全的 `move`、presence 移动/跟随和统一动作接口 |
| `apps/server/src/engine/` | 注册工具并注入调用者身份；作家与角色复用同一实现 |
| `extensions/tools.ts` | 暴露 `look_at / move_to / move / choose / roll_dice / use_item_on / set_following` 等工具定义 |
| `apps/server/src/routes/world.ts` | 玩家 UI 路由改为复用同一动作服务，不另写一套规则 |
| `apps/web/src/` | 所有实体渲染通用互动字段，玩家点击与 Agent 工具进入同一后端动作 |
| `presets/*.json`、`extensions/instructions.ts` | 作家和角色都能看见共享工具；角色 prompt 约束行动时机而非写入范围 |

实现顺序：先抽互动字段与动作服务，再注册 Agent 工具，最后让现有 HTTP 路由复用动作服务。这样 UI 与 Agent 不会形成两套骰子、移动和 choice 语义。
