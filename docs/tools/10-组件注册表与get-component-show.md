# doc-tools/10 `get_component` / `show` 与官方组件注册表

> **先读哪几节**：本文的主体不是工具签名，而是**组件注册表**。§13（注册表协议）→ §14（官方组件清单：18 落盘 + 7 演出）→ §15（与 `use_item_on` 的衔接）→ §16（二级阅读协议）是核心；§1–§12 是 00 契约 §7 要求的十二节，围绕 `get_component` / `show` 两个工具本身；附录 A–D 是施工用的表。

> 状态：**设计稿（2026-09-12）**，待评审。属 B1「工具面」文档批次（见 `local://b1-context.md` 与 `docs/tools/00-共同上下文.md`）。
> 一切共享接口、路径、命名、事件口径以 `docs/tools/00-共同上下文.md`（冻结契约）为准；本文只定 `get_component` / `show` 的语义、官方组件注册表协议与组件清单。
> 本文**不写代码**（B1 只产出设计文档）。§8 的"代码落点"是下一阶段的施工单，不是本轮改动。
> 权威层级（00 §0）：00 契约 > doc-21/doc-22 > doc-20（工具语义） > doc-10（组件与演出型） > doc-19（玩法强度） > 本文。
>
> 关联：
> - `docs/protocols/doc-10-组件协议与官方组件清单.md`——上位文档，本文落实其**待设计 #1（组件 schema）/ #2（官方清单）**；#3/#4/#5 只引用不重定；
> - `docs/gameplay/doc-19-多模态与游戏性交互升级.md` §3.1（以物解谜）/ §4.1（追光 · 线索风暴）——玩法强度要求；
> - `docs/protocols/doc-20-agent工具与互动字段协议.md` §1.1 / §2.1（`choice` 是通用互动协议，piano 示例就在那儿）/ §8（`use_item_on`）；
> - `docs/protocols/doc-21-事件表协议.md` §1.1 / §3.3（`detail` 自足）/ §4.1（`entity_created`）；`docs/agents/doc-22-Hook注入协议.md` §3.1；
> - `docs/protocols/doc-09-叙事frontmatter完整schema.md` §6（`look_at` 文本 formatter）；
> - `docs/ui/doc-04-视觉设计风格.md` §10（v2 视觉基准）与 §10.6（材质词汇表降级为题材概念）。

---

## 1. 一句话与定位

**`get_component` 是组件注册表的只读门面：模型不知道有哪些组件、每种组件的 frontmatter 该怎么写时，用它查；`show` 是演出型组件的一次性通道：放一次、不留痕。**

三条定位：

1. **注册表是"世界可渲染实体种类"的唯一真相源。** `packages/shared/src/components/` 里一份代码级注册表定义每种组件的用途、允许的交互、extra 字段、画布尺寸（`CardForm`）、可收藏性、二级阅读形态与（可选）确定性 handler。`get_component` 只是它的查询门面；`CARD_FORMS` 与前端渲染器都从它派生（§8.2、附录 A）。
2. **`get_component` 解决"生成正确"，不是"生成更多"。** doc-10 §背景（`doc-10:10`）把协议定为"返回 schema/用法/示例"，动因写在 `docs/archive/2026-09-10旧编号/doc-07-工具参数规格.md:124`：*"避免把所有组件 schema 塞进上下文撑爆"*。所以它是**懒加载字典**：索引一行一个 kind，点名才给全文（与 doc-22 §7「注入摘要，细节走工具」同一原则）。
3. **`show` 与落盘型组件是两类东西。** doc-10 E0（`doc-10:141`）正名：演出型 = **一次性演出**（放烟花 / 聚焦推屏 / 全屏关灯），**不写文件、不写 DB、不留痕**。落盘型才长在画布上（有 md、可被收藏/折叠/感知）。`show` **不是**"写组件的另一种写法"。

**调用者**（doc-20 §1.1，`doc-20:34`）：作家与角色**都可调用** `get_component` 与 `show`，能力不按身份裁（`doc-20:39`）。玩家 UI 不直接调它们——玩家点组件走 `choose` / `use_item_on`（§15、§16）。

**一句话边界**：`get_component` 是**读**（无副作用、无事件、无文件）；`show` 是**演**（无副作用、无事件、无文件、无画布状态）；**落盘**是第三条路，由 `write` / `chalk` / 组件 handler 完成，落 `entity_created`（§5）。

---

## 2. 签名与参数

### 2.1 `get_component`

```ts
get_component({
  /** Component kind id(s). Omit to list the whole registry as a one-line-per-kind index. */
  component?: string | string[];
}): ToolResult
```

| 参数 | 类型 | 必需 | 语义 | 示例值 |
|---|---|---|---|---|
| `component` | `string \| string[]` | 否 | 组件 kind id（注册表 key），**不是路径、不是文件名**。省略 = **索引模式**；给出 = **详单模式**。 | `"lock"`；`["letter","instrument","board"]` |

**返回形状**（00 §6.2 冻结）：

```ts
{
  content: [{ type: 'text', text: string }],   // 英文，给模型看
  details: {
    mode: 'index' | 'full',
    components: ComponentDoc[],                // 详单时每 kind 一元素；索引时是同一形状的瘦身版
  },
}
```

```ts
interface ComponentDoc {
  kind: string;              // 'lock'
  pack: string;              // 'core' | 'adventure' | 'mystery' | 'chronicle' | 'craft' | 'room'
  label: string;             // 'Lock' —— 英文 UI 标签
  purpose: string;           // 一行英文用途
  click: 'read' | 'continue' | 'visual' | 'look';   // doc-10 E12 的四级点击后果
  channels: { choice?: boolean; status?: boolean; rollDice?: boolean; useItemTarget?: boolean };
  movable: boolean;          // 呈现层是否允许拖入背包（doc-10 E5 BAG_TYPES 的扩展位）
  secondLayer: 'none' | 'read' | 'read+continue' | 'fragments' | 'pairs' | 'pages' | 'board';
  accepts?: Accepts;         // 作为 use_item_on 目标时接受什么（§15）
  form: { label: string; w: number; h: number; chrome: string };  // == CARD_FORMS[kind]
  fields: FieldDoc[];        // 该 kind 的 extra 字段
  example: string;           // 最小可用 frontmatter + 一行正文（英文内容）
  related: string[];         // 相关工具名，如 ['use_item_on','choose','roll_dice']
}

interface FieldDoc { name: string; type: string; required: boolean; desc: string; example?: string }
```

**文本格式（详单模式，一段一份）**——目标：模型照抄就能写出合法 frontmatter。

```text
[component: lock]  pack=adventure
A door, chest or hatch that only opens to the right thing.
Click: visual  ·  Channels: choice, roll_dice, use_item_on-target
Movable: no  ·  Second layer: read  ·  Form: 176x176 slab

frontmatter fields
  component      string   required   kind id, literal "lock"
  title          string   required   card-face title
  preview        string   optional   one-line card-face teaser
  body           string   optional   full text for the second layer (md body also works)
  accepts        object   optional   what it responds to as a use_item_on target
  status.data    object   optional   narrative snapshot; key "locked" is the convention

minimal example
---
type: component
component: lock
title: The Cellar Door
preview: A rusted padlock, newer than the door.
accepts:
  itemKinds: [note]
  itemTags: [key]
status:
  data:
    locked: true
---
The padlock is new. Someone has been keeping this shut.

related: use_item_on, choose, roll_dice, look_at
```

> 注意：这是**字符串**，模型会照着说。注册表里的每个词都是给模型的指令，错一个词就是一次误导——所以 §10 的 T5 要断言**每个 kind 的 `example` 都能被自己的 schema 解析**。

**索引模式（省略 `component`）**：每 kind 一行 + 结尾一句引导。

```text
[components] 18 registered (2 core + 16 pack)
note      core      A sticky sheet or object card; keys, tickets, scraps.
letter    core      A sealed letter; opens into title / body / sign.
lock      adventure A door or hatch that only opens to the right item. [use_item_on target]
board     craft     A board or sandbox game; its second layer renders the grid in place.
Call get_component({ component: "lock" }) for the full frontmatter contract.
```

> 索引文本 MUST 带 `[use_item_on target]` 标记（`channels.useItemTarget`）：这是模型判断"该把这个东西做成可解谜目标"的**唯一线索**。漏了它，模型会把锁写成 `note`，`use_item_on` 就没有确定性 handler（§15）。

### 2.2 `show`

```ts
show({
  /** Performance id from SHOW_REGISTRY (see §14.3). */
  component: ShowKind,
  /** World-relative path this performance focuses on. */
  target?: string,
  /** evidence_burst only: cards that throw threads toward `target`. */
  links?: string[],
  /** Per-performance params, validated by that performance's own schema. */
  params?: Record<string, unknown>,
  /** Override the performance's default duration in ms (clamped 300–12000). */
  duration_ms?: number,
  /** Optional one-line English caption rendered with the performance. */
  caption?: string,
}): ToolResult
```

| 参数 | 类型 | 必需 | 语义 |
|---|---|---|---|
| `component` | `ShowKind` | **是** | 演出 id，取值见 §14.3 表。未知 id → `isError`（§7），**不静默忽略**。 |
| `target` | `string` | 视演出而定 | **世界根相对路径**（00 §2.1），如 `world/baker-street/rusty-key.md`。`spotlight` / `camera_focus` / `ink_burst` / `evidence_burst` 需要；缺 → `isError`。 |
| `links` | `string[]` | 视演出而定 | 仅 `evidence_burst`：从这些卡向 `target` 拉临时丝线（**只演不留**）。 |
| `params` | `Record<string, unknown>` | 否 | 演出自己的参数（天气类型、压暗比例、颜色），由演出的 zod schema 校验；非法 → `isError`。 |
| `duration_ms` | `number` | 否 | 覆盖默认时长，clamp 到 `[300, 12000]`。 |
| `caption` | `string` | 否 | 一行英文文案，随演出淡入淡出。 |

**返回形状**：

```ts
{
  content: [{ type: 'text', text: string }],   // 英文，说明实际演了什么
  details: {
    performance: ShowKind,
    resolved: { target?: string; targetName?: string; links?: string[]; params: Record<string, unknown>; durationMs: number },
    frame: ShowFrame,                          // server 直接广播它（§6）
  },
}
```

```ts
interface ShowFrame {
  type: 'show_frame';
  component: ShowKind;
  target?: string;
  targetName?: string;      // detail 自足（doc-21 §3.3）：前端不因文件后来改名而显示错名字
  links?: string[];
  params: Record<string, unknown>;
  durationMs: number;
  caption?: string;
  actor: { type: 'writer' | 'character' | 'player' | 'god'; id?: string };
  timestamp: string;        // 由 server 映射层补，工具不写
}
```

**演出型不落盘、不落事件、不写画布状态**——`frame` 是**传输负载**，不是世界变化；帧名与事件 `type` 不共用命名空间（00 §5.3、`doc-21:276`）。

---

## 3. 行为契约（逐步）

### 3.1 kind 解析（不是工具步骤，是两侧共同的纯函数）

这条是"组件能被渲染"的前置链；写在这里因为 `get_component` 的返回内容与前端尺寸都由它定。

1. 读 `*.md`，解析 frontmatter（`packages/shared/src/schemas/frontmatter.ts:29` 的 `parseFrontmatter`）。
   +- **漏了会怎样**：不解析就按文件名渲染 → `piano.md` 变成"默认便签"（现状，`forms.ts:54`）。
2. 用注册表 `resolveComponentKind(fm, filename)` 定 kind：按注册顺序跑每个 kind 的 `match` 谓词。`letter` 的谓词是 `fm.type === 'component' && fm.component === 'letter'`；`note` 的谓词是 `fm.type === 'note'`，**并额外兜住历史写法**（doc-10 E1 `doc-10:22` 说 v1 的铜钥匙是 `type: 'note'`；一个无 `type` 的裸 md 仍是 note，与 `forms.ts:54` 现行兜底一致）。
   +- **漏了会怎样**：`type: component` 的卡在 `cardKindOf` 里掉进 `return 'note'`（`forms.ts:54`），尺寸错、无二级阅读、互动字段挂在错的壳里。这正是 00 §10 #6 登记的问题。
3. `cardFormOf` 命中不了的 kind → 回退 `forms.default`（`forms.ts:35`），并 **warn 一次**（不报错：题材包组件缺失不该炸画布）。
4. `look_at` 对组件的文本形态由 09 §6 的 formatter 统一负责；`get_component` **不重复实现**它，只给 schema。

### 3.2 `get_component` 逐步

1. **解析参数。** `component` 缺省 → `mode='index'`；否则归一成数组（`string` → `[string]`），去重、保序。
   +- **漏了会怎样**：不去重会让 `get_component(['lock','lock'])` 输出两遍，模型以为有两个不同组件。
2. **索引未知 kind。** 任一 kind 不在注册表 → **立即 `isError`**（§7），不做"忽略未知、返回已知"的静默降级（00 §6.2、反模式第 4 条）。
   +- **漏了会怎样**：静默忽略会让模型以为 `puzzel-box` 拼对了，然后写出一个前端渲染不了的组件，直到画布上长不出卡才发现。
3. **组装 `ComponentDoc`。** 每个 kind 从注册表条目 + `CARD_FORMS[kind]` 合成；`form` 字段 LIVE 取自 `CARD_FORMS`，而不是注册表自己抄一份尺寸——**这是防止"两张尺寸表"**（`forms.ts:1-16` 注释点名的 bug）**的唯一做法**。
4. **渲染文本。** 索引模式：每 kind 一行 + `[use_item_on target]` 标记 + 结尾引导；详单模式：每 kind 一段（§2.1 模板）。
   +- **漏了会怎样**：文本里漏掉 `status` 的约定键名（如 `lock.locked`），模型会自造键名，handler 与前端对不上（§15）。
5. **不落任何东西。** 无文件写入、无 DB、无事件（§4、§5）。
   +- **漏了会怎样**：若这里落了 `entity_created`，每次"查一下怎么写"都会在世界里多一条幽灵事件——事件表准入第一问"它改变了世界吗"直接不过（`doc-21:23`）。

### 3.3 `show` 逐步

1. **校验 `component` 是演出型 id。** 若传的是落盘型 kind（如 `letter`）→ `isError`，文案指向正确工具：`"letter is a docked component; write it with write/chalk, not show. Run get_component({component:'letter'}) for its frontmatter."`
   +- **漏了会怎样**：模型以为 `show` 万能，用它"演"一封信，世界什么都没留下、玩家看不到信——**这正是不留痕被误用的场景**，必须报错把它推回落盘路径。
2. **校验 `target` 存在**（需要 target 的演出）。路径经 `WorldStore` 解析（00 §2.1，已剥 `../`），读不到 → `isError`。
   +- **漏了会怎样**：不校验就广播，前端拿到不存在的路径，聚光灯打在空气上——是"静默失败"的一种。
3. **取 `targetName`。** 从目标 frontmatter 的 `title`/`name`，或文件名退化。**这是 `detail` 自足**（`doc-21:107`）的落实：帧里带当时名字，前端不回读世界目录。
4. **跑该演出的参数 schema**（zod）。非法 → `isError`，附该演出接受的 `params` 形状。
5. **clamp `duration_ms`** 到 `[300,12000]`；缺省用演出自己的默认值（§14.3 表）。
6. **组装 `ShowFrame`，塞进 `details.frame`。** 不广播、不写盘、不落事件（§4、§5）。
   +- **漏了会怎样**：扩展若试图直接发 WS 帧，违反 00 §1 硬约束（扩展不假设自己连着 WS）；帧只能靠 `details` 经 `tool_execution_end`（`agent-session.ts:1133` 把 `event.result` 原样转发）到 server。
7. **返回英文人话：实际演了什么。** 例：`Spotlighting "The Rusty Key" (world/baker-street/rusty-key.md) for 2400ms.`

> **`show` 的"不留痕"是硬语义，不是实现细节。** doc-10 E0（`doc-10:141`）把它写成定义的一部分。因此它不参与 §5 的落账表、不在 00 §4.2 的 A 名单里（该名单只列"自己落账"的动作工具）。已与 01 文档对齐：`showComponent` 是**动作服务里的一个方法**（transport-free、统一形状），但**不写事件**；`details.frame` 由 12 的 WS 映射层消费（§6）。

---

## 4. 文件与副作用

### 4.1 `get_component`

**零副作用。** 不读世界目录（注册表就在代码里）、不写文件、不连 DB、不播帧。唯一 I/O 是读自己的注册表常量。

### 4.2 `show`

**零副作用。** 不写文件、不写 DB、不碰 `canvas.db`、不落事件。仅：

- 读 `target` 指向的文件一次（为取 `targetName` 与校验存在性）；
- 返回 `details.frame`，由 server 映射层广播。

### 4.3 落盘型组件（不是本文的工具，但本文要定它的文件形态）

**文件形态**：`<layerDir>/<name>.md`（或 `player/`、`characters/<id>/` 下的 md），`type: component` + `component: <kind>`。命名沿用 00 §2.3 的 `NN-<slug>.md` 约定（chalk 工具建时）或作家自由命名（`write` 建时）。

**frontmatter 骨架**（小内核 + kind 自带 extra，doc-10 E12 `doc-10:131`）：

```yaml
type: component          # 恒定
component: <kind>        # 注册表 key；唯一必填的 kind 标识
title: <string>          # 卡面标题（必填）
preview: <string>        # 卡面摘要（可选；缺省前端取正文首段）
age: now|recent|past|deep   # 可选；一等属性（doc-10 E9/E12），默认 now
<kind 的 extra 字段>      # 见 §14 每种组件的 fields
# 通用互动字段，任意实体可带（doc-20 §2）：
choice: [...]
status: { data: {...} }
roll_dice: { type, desc, expect }
正文（`.md` body）：二级阅读的全文载体。
```

**写盘原子性**：`get_component` / `show` 都不写盘，无此问题。落盘组件由 `chalk`（走 `writeFileAtomic`，见 01 冻结的 `WorldStore.writeFileAtomic`）或原生 `write`（pi-rp 自带原子写）负责。**组件 handler 若原地改文件（如开锁改 `locked:true`），MUST 用 `writeFileAtomic`**——否则半写文件会被 `fs.watch` 与前端读成坏 frontmatter。


## 5. 落账

| 工具 | 落事件？ | 说明 |
|---|---|---|
| `get_component` | **否** | 只读查询，不改变世界（`doc-21:23` 准入第一问）。 |
| `show` | **否** | 演出型不留痕（doc-10 E0）；帧走 WS 不走事件表。 |
| **落盘组件**（`chalk` / `write`，B 入口） | **是** | `entity_created`，`kind: "component"`。**handler 不产事件**（§15.3 纪律 2；与 08 §3.4 严口径一致）。 |

### 5.1 落盘组件的事件全字段（`entity_created`）

依 00 §5.2 与 `doc-21:155` 的冻结形状：

```ts
{
  type: 'entity_created',
  actor: { type: 'writer' | 'character' | 'player' | 'god', id?: string },  // 00 §3
  layer: '<layer id>',        // = resolveLayer(path)（01 冻结的 store 方法）；player/** 与 characters/** 返回 null
  subject: '<path>',          // 'world/baker-street/cellar-door.md'
  turn: '<turn id>',          // 00 §5 / doc-21 §3.4 的合并锚（来自 ActionContext.turn）
  detail: {
    path: 'world/baker-street/cellar-door.md',
    name: 'The Cellar Door',   // **当时的 title**，detail 自足（doc-21 §3.3）
    kind: 'component',         // 00 §5.2 冻结枚举：chalk | component | note | letter | other
    summary: 'A locked cellar door',  // 至多一行；**不存正文**
    // 以下两键是本文对 00 §5.2 的**增量提议**（§11 冲突登记 #2）：
    component: 'lock',         // 更细的 kind，供渲染模板区分「铁门落成了」/「一封信落成了」
    secondLayer: 'read',       // 供事件渲染器判断"这东西点得开吗"
  },
}
```

**为什么 `detail` 要加 `component`**：不加的话渲染器只知道"一个组件落成了"，说不清是信还是锁，事件段的人话会退化成"世界多了一个东西"。但它**不改变 `kind` 的既有口径**（`kind` 仍是 `'component'`），因此是**纯增量**、不破坏 00 的冻结枚举。

**失败不落**（00 §4.2 / `doc-21:141`）：`chalk` / `write` 失败时不落 `entity_created`；唯一例外是 `layer_init_failed`（与本文无关）。`get_component` / `show` 失败时同样不落——它们本来就不落。

**`show` 不落账的一个推论**：连演 10 次烟花，事件表里一条都没有。这是对的——"放了烟花"不是世界变化，是动画（`doc-21:33` 把这类列为"传输帧"）。若某次演出**确实改变了世界**（如"关灯"应是 `status.data.lights: off` 的改动），那就该用 `edit`/`chalk` 落盘，再补一次 `show` 做视觉——**两者是两件事，不要合并**。

---

## 6. WS / 前端

### 6.1 帧名与事件不共用命名空间（00 §5.3 冻结）

- 世界事件统一包 `{ type: 'world_event', event }`；
- **演出帧保留自己的名字**。本文新增的演出帧只有一条：`show_frame`（§2.2 的 `ShowFrame`）。

### 6.2 `show` 的推屏链路

```
角色/作家 agent 进程                         server 进程                     前端
  showComponent(...)                       (另一进程，不直接通信)
    └─ ActionResult.details.frame
         └─ pi-rp tool_execution_end
              (agent-session.ts:1133 result 原样转发)
                   └──────────────► mapEngineEvent 新增一支：
                                     toolName === 'show'
                                     → broadcast(details.frame)
                                          └──────────►  前端按 frame.component 分发到演出库
                                                        (spotlight / lights_out / fireworks / ...)
```

**为什么走 `details` 而不是落一条事件**：00 §1 硬约束——扩展 MUST NOT 假设自己连着 WS。可用的通道只有两条：返回值 `details`（经 `tool_execution_end.result`，`agent-session.ts:1133-1139`）或落事件（server 尾部读表）。演出是瞬时的、无历史的，**落事件会让"演了 10 次"在历史面板里出现 10 行噪音**（违反 `doc-21:33` 的"传输帧不落库"）。所以走 `details`。

**`mapEngineEvent` 的改动**（归 12 文档，本文只提契约）：

```ts
// 在 tool_execution_end 分支，与现有 chalk/link 分支并列（event-bridge.ts:71-92）
if (event.toolName === 'show' && !event.isError) {
  const frame = (event.result as any)?.details?.frame;
  if (frame) push(frame);
}
```

**兜底**：若 `details.frame` 缺失（理论上不会），server MUST 只跳过广播并 `console.warn`，**不得**伪造一个空演出——宁可什么都不演，也不要演错的。

### 6.3 前端拿到 `show_frame` 演什么（对应 doc-19 §4.1）

| `frame.component` | 前端演出 | 参数 |
|---|---|---|
| `spotlight` | 全画布压暗至 15%，暖金光束打在 `target` 卡上 + 微尘粒子 + BGM 切悬疑（doc-19 §4.1-1） | `params.spread`（束宽）、`params.dim`（压暗比例）、`durationMs` |
| `lights_out` | 全屏关灯（压暗 + 焦点卡微亮 + 环境音切低） | `params.dim`、`durationMs` |
| `fireworks` | 画布上空的粒子爆裂（视差前景层 z:150，doc-19 §1） | `params.color`、`params.bursts`、`durationMs` |
| `evidence_burst` | 线索风暴：以 `target` 为中心，`links` 里每张卡拉出一条**临时**红线，瞬间延展刺向 `target` + 沉重钟鸣（doc-19 §4.1-2） | `links`、`params.staggerMs`、`durationMs` |
| `camera_focus` | 相机平滑飞向 `target`（复用 `useCamera` 的插值），不压暗 | `params.zoom`、`durationMs` |
| `ink_burst` | `target` 卡上的墨迹迸溅/湿墨扩散一次（复用 v2 的 ink-seep，doc-04 §10.2） | `params.tone`、`durationMs` |
| `roll_ceremony` | 大号 2.5D 骰子入场翻滚（doc-19 §3.3）；**只演骰子动画，不带结果**——结果由 `dice_result` 帧另发 | `params.dice`、`durationMs` |

**`evidence_burst` 的线是"临时"的**：它**不写 `canvas.db` 的 `links` 表**，只在演出期间画在 `LinkLayer` 上，`durationMs` 后消失。这与 `link` 工具（`09-*` 文档）是两回事：`link` 建的是持久关系线（画布状态）；`evidence_burst` 演的是"线索风暴"这个**时刻**（doc-19 §4.1-2 的 Money Shot）。

**`roll_ceremony` 的边界**：它**不掷骰**。掷骰永远由 `roll_dice`（`07-*`）完成、落 `roll_resolved` 事件、广播 `dice_result` 帧（00 §5.3 的改名约定）。`show({component:'roll_ceremony'})` 只是把"骰子入场"这一下视觉单独演出来——作家想在不掷骰时造悬念（如"她掏出一枚硬币"）可以用它，**结果由 `roll_dice` 负责**。

### 6.4 `get_component` 的 `details` 谁消费

前端**不消费** `get_component` 的 `details`（它是给模型的字典）。唯一消费者是 `mapEngineEvent` 的通用分支：工具名不在映射表里 → 什么都不广播（现状 `event-bridge.ts:34-100` 的 default 行为）。**不要为它在 WS 层加分支。**

---

## 7. 错误与边界

全部英文文案（00 §6.2 / AGENTS.md §1.1）。**失败必须可见：`isError:true` + 可读原因；无 fallback 的地方明说无 fallback。**

| # | 情景 | 工具 | 返回 | 文案（英文，逐字） |
|---|---|---|---|---|
| E1 | kind 不存在 | `get_component` | `isError` | `Unknown component "puzzel-box". Run get_component with no argument to list the ${n} registered kinds.` |
| E2 | `component` 传了数组含未知项 | `get_component` | `isError`（整次失败，不部分成功） | `Unknown component(s): "a", "b". Run get_component with no argument to list the ${n} registered kinds.` |
| E3 | `component` 传了路径而非 kind | `get_component` | `isError` | `"world/inn/key.md" is a path, not a component kind. Use look_at for an entity, or get_component with a kind like "note".` |
| E4 | `show` 传落盘型 kind | `show` | `isError` | `${kind} is a docked component, not a performance. Write it with write or chalk; run get_component({component:"${kind}"}) for its frontmatter.` |
| E5 | `show` 传未知演出 id | `show` | `isError` | `Unknown performance "${id}". Available: ${list}.` |
| E6 | `show` 该带 `target` 却没带 | `show` | `isError` | `${component} needs a target path (the card to focus). Pass target: "world/<layer>/<file>.md".` |
| E7 | `show` 的 `target` 不存在 | `show` | `isError` | `Target not found: "${path}". Nothing was shown.` |
| E8 | `show` 的 `params` 非法 | `show` | `isError` | `Bad params for ${component}: ${zodMessage}. Expected: ${shape}.` |
| E9 | `duration_ms` 非数 | `show` | `isError` | `duration_ms must be a number of milliseconds.` |
| E10 | `evidence_burst` 的 `links` 含不存在路径 | `show` | **部分降级 + 可见**：跳过坏路径，帧里只带存在的；text 明说跳过了几个。**若全部不存在 → `isError`** | `2 of 3 link paths were not found and were skipped; showing 1 thread.` |
| E11 | 组件 kind 未注册但文件存在（题材包未加载） | （渲染侧，非工具） | 不报错；回退 `forms.default` + warn | 见 §3.1 步 3。前端显示为默认纸卡，模型可通过 `get_component` 索引发现该 kind 不在本世界。 |

**`E10` 的取舍**：这是全文唯一的"部分降级"，且**降级可见**（text 里报数）。理由：线索风暴是本演示的 Money Shot，为一个已删的路径整场不演，代价大于收益；但静默跳过又违反"失败不静默"，所以用 text 报数。**全坏则报错**，不演一场空风暴。

**绝不静默降级的反面清单**（00 §8）：
- ❌ `get_component` 未知 kind → 返回 note 的 schema（模型会以为拼对了）；
- ❌ `show` 未知演出 → 不演但返回成功；
- ❌ `show` 落盘型 kind → 顺手写一个文件（把"演"变成"写"）。

---

## 8. 要实现/修改的代码落点

精确到文件与函数。**B1 不实施**，这是给实现阶段的施工单。

### 8.1 新建：组件注册表（`packages/shared/src/components/`）

```
packages/shared/src/components/
├── types.ts            # ComponentDef / FieldDoc / Accepts / UseItemOnHandler / ShowDef
├── registry.ts         # COMPONENT_REGISTRY / SHOW_REGISTRY + 查询与解析纯函数
├── core.ts             # note · letter
├── performances.ts     # 7 个演出型（§14.3）
├── packs/
│   ├── adventure.ts    # lock · container · trap · mechanism · map
│   ├── mystery.ts      # book · ledger · photo · cipher
│   ├── chronicle.ts    # clock · tape · anchor
│   ├── craft.ts        # instrument · board
│   └── room.ts         # diary · thread
└── index.ts            # 汇总导出（含 componentDocOf / useItemTargetOf / listComponents）
```

| 文件 | 函数/常量 | 签名与职责 |
|---|---|---|
| `types.ts` | `ComponentDef` | §13.1 的注册条目形状。 |
| `types.ts` | `Accepts` | §15.2 的"作为目标接受什么"。 |
| `types.ts` | `UseItemOnHandler` | §15.3 的确定性 handler 契约（与 08 文档逐字一致）。 |
| `registry.ts` | `COMPONENT_REGISTRY: Record<string, ComponentDef>` | 唯一注册表。key = kind id。 |
| `registry.ts` | `SHOW_REGISTRY: Record<string, ShowDef>` | 演出型注册表（不参与 `get_component` 的落盘清单，但参与 `show` 校验与错误文案）。 |
| `registry.ts` | `resolveComponentKind(fm, filename): string` | §3.1 步 2 的纯函数。**`schemas/forms.ts::cardKindOf` 经反向注册的 resolver 委托到它**（§8.2 ③；m-20 断环）。 |
| `registry.ts` | `componentDocOf(kind): ComponentDoc \| null` | §3.2 步 3，合成 `get_component` 的返回项。 |
| `registry.ts` | `listComponents(): ComponentDoc[]` | 索引模式的瘦身版列表。 |
| `registry.ts` | `useItemTargetOf(targetKind, itemFm): { candidate: boolean; hint?: string }` | §15.2。**前端与 `use_item_on` 共用的唯一判定函数**（防两套逻辑漂移）。 |
| `index.ts` | re-export 全部 | `packages/shared/src/index.ts` 追加 `export * from './components/index.js';`。 |

### 8.2 修改：`packages/shared/src/schemas/`

| 文件 | 改动 |
|---|---|
| `components.ts` | 现有 4 个 schema（`NoteComponentSchema` 等，`components.ts:3-35`）保留为**兼容**，新增：`ComponentCoreSchema`（`type/component/title/preview/body/age`）+ 每 kind 一个 `.extend(...)`。导出 `COMPONENT_SCHEMAS: Record<string, ZodType>` 供注册表引用 —— **schema 与注册表的 kind 列表 MUST 由同一个数组派生**（`const KINDS = [...] as const`），否则两边会各加各的。 |
| `forms.ts` | ① `CardChrome` 加 4 值：`'slab' \| 'board' \| 'panel' \| 'scroll'`（§13.4）；② `CARD_FORMS` 为每个新 kind 加一行（**尺寸的唯一来源**）；③ `cardKindOf` 保留 `gate`/`sprite`/`chalk` 的既有分支（它们不是组件），组件分支改为**由 registry 反向注册的 resolver**（`registerComponentKindResolver(fn)`）：`forms.ts` 模块级持有 `let resolveKind`，`cardKindOf` 先查 resolver、未注册则退回既有分支。**`forms.ts` MUST NOT import `components/registry.ts`**——否则与 registry 的 `import { CARD_FORMS }` 成 ESM 环（m-20）。 |
| `frontmatter.ts` | **要改**：`parseFrontmatter`（`frontmatter.ts:45-118`）会**静默丢掉**所有非 `status`/`roll_dice`/`choice` 的嵌套对象（`bgStyle` 现状已丢；`accepts`/`grid`/`lines` 会重蹈）→ 加通用一层嵌套对象解析。见 §11 冲突 #3。 |

### 8.3 新建：动作函数

| 文件 | 函数 | 说明 |
|---|---|---|
| `packages/shared/src/actions/get-component.ts` | `export async function getComponent(ctx: ActionContext, input: GetComponentInput): Promise<ActionResult<GetComponentDetails>>` | 只读。**不调 `store.*` 的任何写方法、不调 `appendEvent`**。 |
| `packages/shared/src/actions/show.ts` | `export async function showComponent(ctx: ActionContext, input: ShowInput): Promise<ActionResult<ShowDetails>>` | 只读 + 返回 `details.frame`。**不写、不落**。 |

两者都符合 01 冻结的形状（`ActionContext = { store, actor, turn, now?, rng? }`；`ActionResult<T> = { text, details: T & { event?: WorldEvent } }`；失败 `throw new ActionError({ code, message, httpStatus })`，`code` 取 01 §2.4 的封闭枚举）。已与 01 对齐：`event` 是**可选**字段，只读动作合法地不带它；`showComponent` **不在** 00 §4.2 的 A 名单（那份名单只列"自己落账"的动作）。

本文的失败码映射（01 §2.4 的枚举）：未知 kind → `not_found`；参数类型错 → `invalid_argument`；落盘型 kind 传给 `show` → `unsupported`（"legal but not built in B1"正是它的语义——`letter` 是合法组件，只是不归 `show` 管）；`show` 的 `target` 不存在 → `not_found`；`params` 校验失败 → `invalid_field_value`。

### 8.4 新建：扩展工具壳（`extensions/toolkit/`）

| 文件 | 内容 |
|---|---|
| `extensions/toolkit/component.ts` | 导出 `getComponentTool: ToolDefinition`（`name: 'get_component'`、`parameters: Type.Object({ component: Type.Optional(Type.Union([Type.String(), Type.Array(Type.String())])) })`、`execute` 里 `new LocalWorldStore(ctx.cwd)` → `createActionService(store, actor).getComponent(params)` → 转成 pi 的 `ToolResult`）。 |
| `extensions/toolkit/show.ts` | 同构，`showComponentTool`。 |

**description / promptSnippet / promptGuidelines 一律英文**（00 §6.2、AGENTS.md §1.1），且按 doc-23 §2 写（给判据、给默认动作、点名工具名）：

```ts
description: 'Look up a canvas component kind: its purpose, its frontmatter fields, and a minimal example. '
  + 'Omitting component lists every registered kind in one line each. Read-only; it writes nothing.',
promptSnippet: 'Look up a component kind\'s frontmatter contract before writing one',
promptGuidelines: [
  'Use get_component before writing or editing any file with frontmatter "type: component" — it returns the exact fields for that kind.',
  'Use show for one-off performances (spotlight, lights_out, fireworks). show writes nothing; to place a letter or a lock on the canvas, use chalk or write instead.',
],
```

### 8.5 修改：注册、WS、前端

| 文件 | 改动 | 归属 |
|---|---|---|
| `extensions/tools.ts` | `pi.registerTool(getComponentTool)` + `pi.registerTool(showComponentTool)` | **12 文档**（本文只提契约，不抢它的活） |
| `apps/server/src/engine/event-bridge.ts:71` (`tool_execution_end` 分支) | 加一支：`if (event.toolName === 'show' && !event.isError) { const f = event.result?.details?.frame; if (f) push(f); }` | **12 文档** |
| `apps/server/src/routes/world.ts` | **无改动**。玩家不调这两个工具；玩家点组件走既有 `/choose` / `/use-item`（12 会改成复用动作服务）。 | 12 |
| `apps/web/src/components/canvas/CardRenderer.tsx:196` | 现在只特判 `component === 'letter'`（`CardRenderer.tsx:196`），其余组件掉进 note 分支（`:261-279`）。改为：`const kind = resolveComponentKind(fm, filename)` → 查 `COMPONENT_REGISTRY[kind]` 的 `secondLayer` / `channels`，壳按 `CARD_FORMS[kind].chrome` 分派。**不新增 `renderer` 字段**（前端组件不能塞进 shared 的注册表，那是循环依赖）——注册表给**语义**（secondLayer/channels），材质壳由前端按 chrome 实现。 | 前端（`docs/ui/前端改造计划.md`） |
| `apps/web/src/lib/components.ts`（新建） | 轻量转发 `useItemTargetOf` / `cardFormOf` / `resolveComponentKind`（前端从 `@airp/shared` 引；勿抄第二份）。 | 前端 |
| `apps/web/src/components/narrative/DetailPanel.tsx`（新建） | §16 的统一二级阅读面板（v3 E9 的 DetailPanel 协议）。 | 前端 |

---

## 9. 与现存实现的差异

### 9.1 逐项对照（现状带 `文件:行`）

| # | 位置 | 现状 | 要改成 | 迁移影响 |
|---|---|---|---|---|
| D1 | `packages/shared/src/components.ts:3-35` | 4 个组件 schema（note/letter/gate/buddy），**没有注册、没有 kind 查询** | 保留为兼容 schema，新增 `packages/shared/src/components/`（注册表）与 `COMPONENT_SCHEMAS`（由 `KINDS` 数组派生） | 现有导入 `NoteComponentSchema` 等的调用点（无；grep 显示仅 `index.ts:3` re-export）无需改。 |
| D2 | `packages/shared/src/schemas/forms.ts:44-55` | `cardKindOf` 硬编码 `if` 链，只认 6 种，`type: component` 一律掉到 `note`（`:54`） | 改为 delegate 到 `resolveComponentKind`；保留 `chalk/gate/sprite` 分支 | `apps/server/src/routes/world.ts:187`、`web/src/index.css:773` 的契约不变（返回仍是 kind 字符串），但 `type: component, component: lock` 的卡从此得到正确 form。**这是 00 §10 #6 的修复。** |
| D3 | `packages/shared/src/schemas/forms.ts:28-36` | `CARD_FORMS` 6 项（5 真 kind + default） | 扩到 18 个组件 kind + 5 个既有 kind（附录 A） | 纯增量；`default` 保留为最后兜底（`:35`）。 |
| D4 | `apps/web/src/components/canvas/CardRenderer.tsx:196` | 只特判 `component === 'letter'`，其余组件走 note 分支（`:261`） | 按注册表 kind/chrome 分派到壳组件 | 前端改造，归 `docs/ui/前端改造计划.md`；本次只定义注册表提供什么。 |
| D5 | `packages/shared/src/schemas/forms.ts:18` | `CardChrome = 'bare' \| 'paper' \| 'cover' \| 'note'` | 加 `'slab' \| 'board' \| 'panel' \| 'scroll'`（§13.4） | 前端 `CardRenderer.tsx` 与 `index.css` 需为 4 个新 chrome 加壳（附录 A.3 给视觉规格）。 |
| D6 | `packages/shared/src/schemas/frontmatter.ts:45-118` | YAML-lite 只特判 `status.data / choice / roll_dice`；**其它嵌套对象被整块静默丢弃**（顶层 `key:` 空值不赋值，缩进行无处可去——`bgStyle` 现状已丢） | 加**通用一层嵌套对象**解析（不引入 YAML 库，保持无依赖） | 现有可解析字段结果不变（纯增量）；顺带修好模板里已在用的 `bgStyle`（`templates/holmes-world/world/baker-street/README.md`）与本文新增的 `accepts`/`grid`/`lines`/`columns`/`rows`/`marks`。见 §11 冲突 #3。 |
| D7 | `apps/server/src/engine/event-bridge.ts:34-100` | `tool_execution_end` 只映射 `chalk`/`write`/`link`/`arrange` | 加 `show` → `show_frame`（§6.2） | 归 12；纯新增分支，不碰既有映射。 |
| D8 | `docs/development/后端实现计划.md:273` | *"MVP：`get_component` 返回 note/letter 两个 schema；`show` 只广播不落盘"* | **升级**：18 个落盘 kind + 7 个演出 + 双模式（索引/详单） | 计划书的 MVP 口径被本文取代；§11 冲突 #1 登记了这处需要同步修订的文档。 |
| D9 | 无（新） | 组件注册表不存在 | `packages/shared/src/components/`（§8.1） | 新目录，无迁移。 |
| D10 | 无（新） | `use_item_on` 的确定性 handler 无处安放 | 注册表条目的可选 `handler`（§15.3） | 与 08 文档的 handler 契约逐字一致（已 IRC 对齐）。 |

### 9.2 刻意的放宽与收紧

| 项 | 决定 | 理由 |
|---|---|---|
| **`move()` 的可动性** | 注册表的 `movable` **只影响前端是否渲染拖拽**，引擎不按 kind 加白名单 | 00 §2.4 已冻结的刻意放宽（`00:93`）：引擎的"移动"是文件语义，不能因为认不出题材包组件就拒绝移动。 |
| **`note` 的历史写法** | 无 `type` 的裸 md **仍是 note** | 与 `forms.ts:54` 现行兜底一致；改变它会让既有模板的便签全变默认卡。 |
| **`gate` / `sprite` / `chalk`** | **不进组件注册表** | `gate` 由 README 派生（00 §2.4）；`sprite` 是角色呈现（doc-10 E0/E1）；`chalk` 是叙事正文。它们在 `CARD_FORMS` 里有行，但不注册为"可生成的组件 kind"——`get_component` 索引里不该出现它们（否则模型会用 `get_component` 查 chalk 的写法，而 chalk 的写法归 `chalk` 工具与 02 文档）。 |

---

## 10. 验收与测试

### 10.1 纯函数单测（`packages/shared` 现有测试风格）

测试放在 `packages/shared/src/components/__tests__/`，只测行为契约，不测字符串外观的细节（除"必须包含某判据词"这类功能性断言）：

| # | 测什么 | 断言 |
|---|---|---|
| T1 | `resolveComponentKind` | `{type:'component',component:'lock'}` → `'lock'`；`{component:'letter'}` → `'letter'`；`{type:'note'}` → `'note'`；`{}` + `foo.md` → `'note'`；`README.md` → `'gate'`（不是组件）；`{type:'chalk'}` → `'chalk'`。 |
| T2 | 注册表完整性 | `Object.keys(COMPONENT_REGISTRY).length === 18`；每个 kind 在 `CARD_FORMS` 里有行（**缺行即测试失败**——这是 D3 的守卫）；每个 kind 有 `purpose`/`label`/`fields`/`example`。 |
| T3 | schema 与注册表同源 | `Object.keys(COMPONENT_SCHEMAS).sort()` 等于 `Object.keys(COMPONENT_REGISTRY).sort()`（防两边各加各的）。 |
| T4 | `componentDocOf('lock').form` | 与 `CARD_FORMS['lock']` **深相等**（防抄第二份尺寸）。 |
| T5 | 每个 kind 的 `example` 能被自己的 schema 解析 | `COMPONENT_SCHEMAS[k].safeParse(yaml(example))` 成功；**且** `resolveComponentKind(parsed) === k`（防示例与 kind 不匹配）。 |
| T6 | `listComponents()` 的索引文本 | 对每个 `accepts` 非空的 kind，文本里含 `[use_item_on target]`。 |
| T7 | `useItemTargetOf('lock', {component:'key'})` | `{candidate:true}`；`useItemTargetOf('lock', {component:'note'})` → `{candidate:false}`；`any:true` 的 kind 对任何 item 都 true。 |
| T8 | `SHOW_REGISTRY` 与 `COMPONENT_REGISTRY` 互斥 | 两表 key 交集为空（防一个 kind 既是落盘又是演出）。 |
| T9 | 演出 id 与错误文案 | `listPerformances()` 覆盖 §14.3 表；E5 的文案含全部演出 id。 |
| T10 | `getComponent` 动作函数 | 只读：mock `WorldStore`，断言 `writeFile`/`execCanvas`/`appendEvent` **零调用**；未知 kind → `ActionError`（不是返回值）。 |
| T11 | `showComponent` 动作函数 | 只读：同上三零调用；`details.frame.type === 'show_frame'`；落盘型 kind → `ActionError`；`target` 不存在 → `ActionError`。 |

### 10.2 探针能断言什么（`tools/probe-writer.mjs` 扩展）

| # | 探针场景 | 断言 |
|---|---|---|
| P1 | 作家调 `get_component`（无参数） | `tool_end` 无 error；结果文本含 `18 registered` 与 `[use_item_on target]`；**事件表 seq 不变**（证明不落账）。 |
| P2 | 作家调 `get_component({component:'lock'})` | 文本含 `component: lock`、`accepts`、`status`、`minimal example`；`details.mode === 'full'`。 |
| P3 | 作家按 P2 的示例写一个 `lock.md`（原生 `write`） | 画布上该卡 `kind === 'lock'`、`w==176`（来自 `CARD_FORMS`）；事件表多一条 `entity_created` 且 `detail.component === 'lock'`。 |
| P4 | 玩家把一枚 `key` 拖到该卡（`use_item_on`） | handler 被调用、`status.data.locked` 翻为 `false`、文件被原子改写；事件表多一条 `use_item_on`。 |
| P5 | 作家调 `show({component:'spotlight', target:...})` | WS 收到一条 `show_frame`；**事件表 seq 不变**（证明不留痕）；`details.resolved.targetName` 非空。 |
| P6 | 作家调 `show({component:'letter'})` | `isError`；错误文案含 "docked component"；WS **无** `show_frame`；事件表不变。 |
| P7 | 作家调 `get_component({component:'puzzel-box'})`（拼错） | `isError`；文案含 "Unknown component" 与 kind 数。 |

### 10.3 手测场景（评委路径）

1. **福尔摩斯世界**：作家写一封 `letter`（二级阅读四段齐全）→ 玩家点开 → 关掉回画布；再写一个 `lock` 的地窖门 → 玩家拿到 `note` 的铜钥匙 → 拖到门上 → 门开（`entity_created` 一条新的 `gate` 或 `note` "地窖"）→ 作家下一轮叙事承认（靠事件段）。
2. **追光**：作家 `show({component:'spotlight', target:'world/baker-street/rusty-key.md'})` → 画布压暗、光束打在钥匙上、拟音起。
3. **线索风暴**：作家 `show({component:'evidence_burst', target:'world/baker-street/truth.md', links:[...4 条]})` → 四线齐发、钟鸣。
4. **两种演出叠加**：先 `spotlight` 再 `ink_burst`，两者互不打断（前端按 `durationMs` 各自独立生命周期）。

---

## 11. 发现的冲突 / 需要修订的上位文档

依 00 §0：发现 1–5 之间矛盾时不私改，登记在此。

| # | 哪两份 / 哪一句 | 矛盾 | 建议改法 |
|---|---|---|---|
| 1 | `docs/development/后端实现计划.md:273` 的 *"MVP：`get_component` 返回 note/letter 两个 schema"* vs 本文 §14（18 个 kind） | 计划书把组件库压到 2 个，但 00 §11 评审门第 4 条明写"`get_component` 的组件数量是否够演示"（`00:410`），doc-10 §背景也写"10-20 个"（`doc-10:3`）。**两者对"够演示"的判据不同。** | 把计划书那一行改成：`get_component` 返回**完整注册表**（索引模式 + 详单模式）；`show` 只广播不落盘。实现顺序上仍可以先注册 core 2 个（note/letter）跑通链路，再补 pack——**但设计文档以本文的 18 个为准**。 |
| 2 | 00 §5.2 的 `entity_created.detail` 冻结为 `{ path, name, kind, summary? }`，`kind` 是 `"chalk"\|"component"\|"note"\|"letter"\|"other"` vs 本文 §5.1 想加 `component: 'lock'` 与 `secondLayer` | **不是矛盾，是增量。** 但 00 是冻结契约，加键必须显式报备。 | 建议 00 §5.2 追加一句可选键说明（不改既有键名/枚举）：`detail` MAY 额外带 `component`（更细的 kind）与 `secondLayer`，供渲染器区分「铁门落成了」/「一封信落成了」。若不采纳，本文的组件渲染模板退化为 `kind` 一档，事件段人话会变粗——**可接受但更差**。 |
| 3 | `packages/shared/src/schemas/frontmatter.ts:45-118`（手写 YAML-lite）vs `templates/holmes-world/world/baker-street/README.md` 的 `bgStyle: { tone: warm, grain: parchment }` | **不是"解析畸形"，是整块被静默丢掉。** 逐行读 `parseFrontmatter`：顶层 `bgStyle:` 的 `val` 为空串，因此 `frontmatter.bgStyle` **根本没被赋值**（`frontmatter.ts:64` 的 `else if (val)`）；随后的缩进行（`tone: warm`）走不到任何一个 `if` 分支（不是 `choice`、`currentKey` 不是 `status`/`roll_dice`），**被直接丢弃**。`bgStyle`/`grid`/`lines`/`accepts` 这些嵌套对象全都会这样消失——**且不报错**。组件注册表要引入 `accepts: { itemKinds: [...] }`，同一个坑必踩。 | `frontmatter.ts` 加**通用一层嵌套对象**解析：顶层 `key:` 且 `val === ''` 时先置 `{}`，缩进行按 `k: v` 填入（子行以 `- ` 开头则收成数组）。不引入 YAML 库。**这是实现阶段的前置必做项**——不做，则本文 §14.4 表里所有非 `status` 的嵌套字段（`accepts`/`grid`/`lines`/`columns`/`rows`/`marks`）以及模板里已有的 `bgStyle` 全部失效。**对应 §9.1 的 D6。** |
| 4 | `docs/product/doc-05-AIRP产品构想.md:398` 的组件例子（`letter、chess、puzzle-box、lamp`）vs `docs/protocols/doc-10` E1–E13 | doc-05 把 `chess`/`puzzle-box` 当**独立组件种类**举例；doc-10 E12（`doc-10:129`）建议改成"内核 2 种 + 题材包按需注册"，并指出换题材词汇全变。 | 两者其实一致：本文把 `chess` 落成 `board`、`puzzle-box` **并入 `container`**（§14.2）、`lamp` 落成 `mechanism`。**doc-05 §7.1 的表不用改**（它只是"例子"，不是清单）。 |
| 5 | `docs/protocols/doc-10:177` 的标记：*"演出型 MVP 可做 1-2 个（聚焦推屏/关灯最出效果，烟花次之）"* vs 本文 §14.3（7 个演出） | doc-10 自己标的是 MVP 范围，不是上限；00 §11 的强度要求（`00:410`）点名 doc-19 的"够味"。 | 实现时按 doc-10 的 MVP 顺序做前 2-3 个（`spotlight`/`lights_out`/`fireworks`），其余按本文的表留位。**设计文档不设上限**。 |
| 6 | `docs/gameplay/doc-19 §3.1` 的拖拽协议里 `player_action` 事件的 payload 是 `{type:'player_action', action:'use_item_on', source, target}` | 这是**前端→server 的 HTTP 请求体**示例（`doc-19:166`），不是事件表 `type`。事件表的 `type` 是封闭十五枚举（00 §5.2），没有 `player_action`。 | 无需改 doc-19（它讲的是前端派发）；但 12 文档在做路由改造时 MUST 把 `/use-item` 的入参映射到动作函数，落 `use_item_on` 事件，**不要新增 `player_action` 事件类型**。已在本节登记以免实现时误读。 |

---

## 12. 仍然未知 / 留给评审拍板的

1. **组件注册表住在 `packages/shared` 还是 `extensions/`？** 本文选 shared（理由 §13.2），但代价是：题材包组件要加**必须改 `packages/shared` 并 `pnpm build`**（AGENTS.md §6.5 红线）。若评审认为"题材包该像 skill 一样纯数据、不改代码"，则要改成"注册表 = 内核注册 API + 世界侧一次性注册脚本"，成本更高。**本文倾向 shared**：注册条目里有 TypeScript 函数（handler、`match` 谓词），纯数据表达不了。
2. **`roll_ceremony` 是演出还是 `roll_dice` 的一部分？** 本文把它单列为演出（可单独演悬念），但 `roll_dice` 本身也要播骰子动画。**可能重复**。倾向：`roll_dice` 广播 `dice_result` 帧时**内联**骰子入场动画，`show({component:'roll_ceremony'})` 只服务"不掷骰但要骰子出场"的用法（本章 §6.3 已如此写）。若评审认为多余，砍掉它、只留 6 个演出。
3. **`board`（棋局）的确定性 handler 要不要实现？** 残局判定需要读 `status.data.position` 并跑规则。本文只给 schema + "handler 归题材包"，**没有实现**：通用棋盘 AI 不在 B1 范围。倾向：demo 用 `choice` + 作家裁决（`doc-20 §2.1` 明写"动作造成什么后果可以由作家响应事件后写作"），handler 留位。
4. **18 个 kind 里，哪些是"演示必须有"？** 本文所有 kind 都写了完整契约，但实现排期上不可能全做前端壳。**建议 P0 五个**：`note`（已有）、`letter`（已有）、`lock`（以物解谜的核心）、`container`（holds 语义）、`diary`（二级阅读的代表）；其余 P1。**具体砍到几个，请评审拍板。**
5. **`age` 字段落到组件还是落到层？** doc-10 E9 说 v3 的年龄是**物件一等属性**（`doc-10:132`），而 v2 的记忆风化是**本层 chalk 自动折叠**（`doc-10:76`）。本文把 `age` 放进组件内核字段（§13.1），因此**每个组件文件自带年龄语义**；但"同一层的所有东西一起变老"这种效果需要另一个来源（层的 mtime / 世界时间）。倾向：先只做组件级 `age`，层级的"风化"归 doc-08（`fold_chalk`）与前端，**不引入世界时间线**（那是状态系统，触及 doc-20 §2.3 红线）。
6. **`show` 能不能被玩家 UI 触发？** doc-19 §4.1 的追光/线索风暴是**给玩家看的**，现在只有作家/角色能调 `show`。玩家传奇榜上的"看这次追光"没有入口。倾向：短期不改（演出由作家导演，符合"导演不介入演员的戏"的边界），**但如果评审要求玩家可触发**，需要一条 `/api/show` 路由（复用 `showComponent`），本文未设计。
7. **组件的 `preview` 与正文首段的关系**：现状 `CardRenderer.tsx:216` 用 `frontmatter.preview || plainExcerpt(body)` 兜底；本文在 §13.1 把 `preview` 定为可选。若 `preview` 永远可从正文首段派生，**它就不该进 schema**（少一个"作者可写可不写、结果还不一样"的字段）。倾向保留（作者需要一个与正文不同的卡面摘要），但标注为待评审。
8. **组件卡的材质语汇与 v2"说墨不说纸"的张力**（附录 A.3 末尾）：`slab`（石板）/`scroll`（卷轴）用的是"物的材质"，不是 v2 的"墨"语汇。本文的解释是"画布与叙事用墨、世界里的东西用物的材质"，但**这是本文自创的读法，不是 doc-04 写下的**。若评审认为组件卡必须与画布同材质，`slab/board/panel/scroll` 退化为"同一种奶油纸 + 不同图标"，尺寸与 kind 不变——**视觉降级，语义不受影响**。
9. **`get_component` 的索引要不要按世界题材排序？** §13.2 选了"静态全集 + 按 `world.json` 的 genre/tags 排序"。排序会让**同一个 kind 在不同世界里的索引位置不同**，可能影响模型的选择倾向（排前面的更容易被用）。这是**特性还是偏差**，需要评审判断；本文倾向特性（题材包的存在就是为了让题材相关的组件更顺手）。

---

## 13. 组件注册表协议（doc-10 待设计 #1/#2）

### 13.1 条目形状（小内核 + kind 自带 extra）

doc-10 E12（`doc-10:131`）的定论：三原型共同字段只有 `id/title/body/meta/x/y/rot`（v3 `WorldItem` 即最小超集），`preview/sign/fragments/lines/rewrite/image` 全是可选扩展——**schema = 小内核 + kind 自带 extra，不是大一统全字段**。本节落实它。

```ts
/** One registry entry. Lives in code (packages/shared/src/components/). */
interface ComponentDef {
  kind: string;                 // registry key == frontmatter `component` value
  pack: PackId;                 // 'core' | 'adventure' | 'mystery' | 'chronicle' | 'room'
  label: string;                // English UI label, shown on the card's type tab
  purpose: string;              // ONE English line: what it is for
  /** Frontmatter predicate. First match wins; registry order is the dispatch order. */
  match: (fm: Record<string, any>) => boolean;
  /** The kind's own extra fields, on top of the shared kernel. */
  fields: FieldDoc[];
  /** Which of the four click outcomes this kind can produce (doc-10 E12). */
  click: 'read' | 'continue' | 'visual' | 'look';
  /** Which interactive frontmatter channels the renderer must surface. */
  channels: { choice?: boolean; status?: boolean; rollDice?: boolean; useItemTarget?: boolean };
  /** Presentation-layer draggability (00 §2.4: engine adds no allowlist). */
  movable: boolean;
  /** The unified second-layer shape (doc-10 E9: 类型章 + 全文 + 回跳 + 续写). */
  secondLayer: 'none' | 'read' | 'read+continue' | 'fragments' | 'pairs' | 'pages' | 'board';
  /** What this kind responds to as a `use_item_on` TARGET (§15). */
  accepts?: Accepts;
  /** Optional deterministic outcome handler (§15.3). */
  handler?: UseItemOnHandler;
  /** Smallest valid frontmatter + one body line, English. Echoed by get_component. */
  example: string;
}

/** The shared kernel every docked component has. Kind extras sit on top. */
const ComponentKernel = {
  type: 'component',       // literal; the render router's first key
  component: '<kind>',     // literal; registry key
  title: 'string',         // required — the card face
  preview: 'string?',      // optional — one-line teaser; renderer falls back to body's first line
  body: 'string?',         // optional — the second layer's full text (md body also works)
  age: "'now'|'recent'|'past'|'deep'?",  // doc-10 E9/E12: age is a first-class attribute
};
```

**为什么 `age` 进内核**：doc-10 E12 明写 *"年龄应该是组件的一等属性（`age`），与 doc-08 折叠联动：fold 后的 scenario 年龄直接进 `past`"*（`doc-10:132`）。它是渲染语义（不透明度/距离），不是某个 kind 的私事。默认 `now`。

### 13.2 注册方式：代码级注册表，不是扩展 API，不是题材包数据

**pi-rp 事实**：`ExtensionAPI` 只有 `registerTool` / `registerSlot` / `registerCommand` / `registerProvider` / `registerCustomType`（`vendor/pi-rp/packages/coding-agent/src/core/extensions/types.ts:1384/1459/1655`），**没有 `registerComponent`**。源码级证据：全仓 grep `registerComponent` 零命中。doc-05 §7.2 的表里写的"注册自定义组件"（`doc-05:416`）是**产品愿景**，pi-rp 没有对应 API。

因此 doc-10 待设计 #1/#2 的"注册方式"只剩三条路，本文的选型：

| 方案 | 做法 | 取舍 |
|---|---|---|
| ❌ 扩展注册（原设想） | 扩展调 `pi.registerComponent(...)` | pi-rp 无此 API；要改 vendored 引擎，成本大且无必要（组件是**渲染+数据**的事，不是 agent 运行时能力的事）。 |
| ❌ 题材包纯数据（`world.json` 声明） | 世界包里写 `components: [...]` JSON | 注册条目里有**函数**（`match` 谓词、handler），JSON 表达不了；且会造出第二个真相源（manifest 声明 vs 代码注册表漂移，与 `layers` 曾在 manifest 里漂移同一个坑，`doc-05:574`）。 |
| ✅ **代码级注册表 + pack 分文件** | `packages/shared/src/components/`，core + 4 个题材 pack，`index.ts` 汇总 | 类型安全、可单测、与 `CARD_FORMS` 同仓同 diff（这是"两张尺寸表"bug 的根本解法）。代价：加组件要 `pnpm build`（AGENTS.md §6.5）。 |

**"题材包按需注册"怎么落**：doc-10 E12（`doc-10:129`）说 *"不该是全局封闭清单，而是内核 2 种 + 题材包按需注册"*。落地为：

- **内核（`core.ts`）**：`note` / `letter`——任何世界都有（doc-10 E1 的种子）。
- **题材 pack（`packs/*.ts`）**：按题材分组（`adventure` / `mystery` / `chronicle` / `craft` / `room`）。**全部静态 import 进注册表**，不按世界动态加载。
- **"按需"落在哪**：不是"按世界减配注册表"，而是"**`get_component` 的索引按当前世界的题材排序/标注**"。世界 manifest 的 `genre` 与 `tags`（`schemas/world.ts:34`）决定 pack 的展示顺序——推理世界的索引把 `mystery` pack 排前面。
  - **理由**：动态加载会让"模型查到的组件"随世界变化，而模型的世界知识（skill / preset）是静态的；静态全集 + 排序提示，比动态子集更可预测。**且实现更简单**（无 loader、无失败路径）。
  - **留白**：`world.json` 是否该有 `components: { disable: [...] }` 来真的减配，见 §12 未决项 1。

### 13.3 与 `type: component` md 的关系

**注册表描述 kind，md 文件是 kind 的实例。** 两者关系：

```
packages/shared/src/components/registry.ts      world/inn/cellar-door.md
        (代码，kind 定义)             ───►      (文件，kind 的实例)
  kind: 'lock'                                 ---
  match: fm.component === 'lock'               type: component
  fields: [preview, body, accepts, ...]        component: lock
  form: CARD_FORMS.lock                        title: The Cellar Door
  handler: lockHandler                         ---
                                               正文...
```

- **渲染路由**（doc-05 §7.4，`doc-05:426`）：`frontmatter.type === 'component'` → 取 `frontmatter.component` → 查注册表 → 按条目的 `click`/`secondLayer`/`channels` 渲染。**`type` 只有 `component`，kind 在 `component` 字段里**——不是 `type: lock`。
  - **为什么**：`type` 保持小基数（chalk/component/gate/readme/...），`component` 承担长尾。doc-10 E1 的 `letter` 就是这个形状（`doc-10:23`）。
- **后端不解析 kind 语义**：引擎只做路径/事件/存储（00 §2），组件语义进 `look_at` formatter（09 §6）与前端。
- **`chalk` 的文件**（`type: chalk`）不查注册表；`gate` 由 README 派生（00 §2.4）；`sprite` 是角色呈现（doc-10 E0）。三者不进注册表（§9.2）。

### 13.4 与 `CARD_FORMS` 的联动（00 §10 #6 的修复）

**问题**（00 §10 #6）：`CARD_FORMS` 只有 6 种 kind（`forms.ts:28-36`），组件加进来前端不知道尺寸。

**修法：注册表不存尺寸，`CARD_FORMS` 存；注册表**引用**它。**

```ts
// registry.ts — form is DERIVED, never duplicated
import { CARD_FORMS } from '../schemas/forms.js';
function formOf(kind: string) {
  const f = CARD_FORMS[kind];
  if (!f) throw new Error(`component "${kind}" has no CARD_FORMS entry`);  // fail loud at module load
  return f;
}
```

- `forms.ts:1-16` 的注释把 `CARD_FORMS` 定为"唯一真相源：server 排座与 web 画卡都读它"。注册表 MUST NOT 抄第二份尺寸。
- **模块加载时 `throw`**（不是运行时降级）：kind 注册了却没有 form 行，是**开发期错误**，启动即炸比上线后发现卡叠在一起好。T2 单测守卫这一条。
- **`CardChrome` 扩 4 值**：`'slab'`（石板/铁件）、`'board'`（棋盘/面板）、`'panel'`（仪表/终端）、`'scroll'`（卷轴/长纸）。视觉规格见附录 A。
- **前端渲染**：`CardRenderer.tsx` 按 `chrome` 分派壳组件；**壳的视觉细节归 `docs/ui/前端改造计划.md`**，本文只冻结 `CardChrome` 的枚举与每个 kind 的 `w/h/chrome`。

- **依赖方向单向（m-20 断环）**：`registry.ts → forms.ts`（只读 `CARD_FORMS`）；`forms.ts` 不 import registry，组件分支经 `registerComponentKindResolver` 反向注入。`CARD_FORMS` 是叶子。

### 13.5 与 `get_component` 的联动

`get_component` 是注册表的**唯一对外查询面**（模型侧）。契约：

1. `get_component()` → 索引（全部 kind 一行 + `[use_item_on target]` 标记 + 引导句）。
2. `get_component({component: k})` → 详单（§2.1 模板：用途 / 交互 / form / fields / 最小示例 / related）。
3. **返回的 `form` 与前端实际用的 `CARD_FORMS[k]` 同源**（T4 守卫）：模型据此知道卡多大，可以判断"这东西该放在哪、要不要 `arrange`"。
4. **`example` 是真能用的**（T5 守卫）：模型照抄即合法，不用猜 frontmatter 语法。这是 doc-10 §背景"返回 schema/用法/示例"（`doc-10:10`）的落点，也是 doc-23 §2.3「给判据不给形容词」在工具面上的应用——**给示例，不给"格式大致是……"**。

---

## 14. 官方组件清单（doc-10 待设计 #2）

### 14.1 入选判据

doc-10 的判据是**一句自问自答**：**"点击后世界变不变？"**（`doc-10:130` 的"三级变四级"）。本文的入库规则：

| 判据 | 说明 |
|---|---|
| C1 **它承载一个动作，不是一段描述** | 点它 → `choose`（自身动作）/ `use_item_on`（作为目标）/ 阅读（二级层）/ 演出。纯描述的沉默细节**不是组件，是 `note`**——`note` 就是"有细节没玩法"的合法归宿。 |
| C2 **它能造成世界变化** | 变化可以是：改自己的 `status.data`（开锁）、被别人用（`use_item_on`）、产生新实体（作家响应）、或**只改变玩家的认知**（二级阅读揭示全文——doc-10 E12 的第三级"视觉替应"与第四级"纯看"也算，因为"读了才知道"本身是信息游戏的进度）。 |
| C3 **它不是另一种皮肤的已有组件** | 近义即合并。**`puzzle-box` 不单列**——它是 `container` 的 `status`/`accepts` 组合（见 14.2）。 |
| C4 **每个题材 pack 只放该题材真会用的** | 恋爱世界不放 `cipher`；推理世界不放 `anchor`。pack 的存在就是回答 E12 的"换个题材词汇全变"。 |

### 14.2 doc-10 待设计 #2 的 10-20 个候选，逐个立项

doc-10 正文点名的候选是"信/书/谜题/机关/乐器/棋盘/天气/装置/过场特效应"（`doc-10:165`），原型证据里的具体物是 `piano`（`doc-20:76` 的示例）、`chess`、`puzzle-box`、`lamp`（`doc-05:398`）。逐个落到本文的 kind：

| doc-10 / doc-05 的候选 | 本文落成 | 为什么 |
|---|---|---|
| 信 | `letter`（core） | E2 的三段体（title/preview/body/sign）原样。 |
| 书 / 卷宗 | `book`（mystery）+ `ledger`（mystery） | 书有**分页**（`secondLayer: 'pages'`）；账本有**表格 + 可对账的数字**（`status.data`），两者玩法不同，不合并。 |
| 谜题盒 | **并入 `container`** | 一个"装东西的容器" + `status.data.combo`/`accepts` 就是谜题盒。**单列会造出两个只有皮肤差的 kind**（C3）。 |
| 机关 | `mechanism`（adventure） | 灯/闸/齿轮：开关一类的**二元状态**动作，改自己的 `status`。 |
| 乐器 | `instrument`（craft） | `piano` 的正式名；`status.data.lid/tune` + `choice`（`doc-20:74-88` 的示例就是它）。 |
| 棋盘 | `board`（craft） | `secondLayer: 'board'`（原位格子渲染），不是"一张大图"。 |
| 天气 | ❌ **不收** | 天气是**层 README 的 frontmatter**（`bg`/`bgStyle` 同族）+ `show` 演出，不是一个 md 组件。收进来就有两个真相源（与 `bg` 的 E0 正名同一道理，`doc-10:143`）。 |
| 装置 | `trap`（adventure）+ `map`（adventure） | 装置拆成"会触发的东西"（trap）与"用于找路的东西"（map），各有明确动作。 |
| 过场 / 特效 | ❌ **落盘清单不收**，全部进 `show`（§14.3） | E0 正名的分界（`doc-10:141`）。 |

**净结果：18 个落盘 kind + 7 个演出型。** 满足 doc-10 的"10-20"与 00 §11 的"够演示"（`00:410`），且没有一个是"只有皮肤、答不上判据"的凑数项。

### 14.3 演出型清单（`show`，7 个；不落盘、不留痕）

| id | 用途 | 允许的参数 | 默认时长 | 呈现（v2 语汇） | 出处 |
|---|---|---|---|---|---|
| `spotlight` | 戏剧追光：全画布压暗，光束打在 `target` 卡上 | `dim`(0-1, def .15)、`spread`(px)、`tone` | 2400ms | 其余卡 opacity→dim + 暖金径向光 + 浮尘 + BGM 切悬疑 | doc-19 §4.1-1 |
| `lights_out` | 全屏关灯（场景入夜 / 玩家闭眼） | `dim`(def .08)、`focus?`（留一处微亮的路径） | 1800ms | 画布压暗 + `focus` 卡微亮 + 环境音切低 | doc-10 E0（"全屏关灯"是它点名的第一个例子，`doc-10:141`） |
| `fireworks` | 放烟花（庆祝 / 结算） | `color?`、`bursts`(def 5)、`origin?` | 3000ms | 前景层（z:150）粒子爆裂 + 余烬下落 | doc-10 E0 / doc-19 §1 粒子系统 |
| `evidence_burst` | 线索风暴：`links` 里每张卡向 `target` 拉临时红线 | `links`(必需)、`staggerMs`(def 90)、`color`(def rust) | 3600ms | 数十条 rust 丝线瞬间延展刺向真相卡 + 一声钟鸣 | doc-19 §4.1-2（Money Shot） |
| `camera_focus` | 相机飞向 `target`（不压暗） | `zoom`(def 1.35) | 1600ms | 复用 `useCamera` 的 `cubic-bezier(.16,1,.3,1)` 慢平移 | doc-04 §10.2 动画表 / doc-06 §3.1 运动语言 |
| `ink_burst` | 墨迹迸溅一次（"这一笔落下"） | `tone`(ink/rust/blue/sage)、`scale` | 1200ms | v2 的 ink-seep（blur 3.2px→0）+ 一次扩散 | doc-04 §10.2 |
| `roll_ceremony` | 骰子入场翻滚（**不带结果**，结果归 `roll_dice`） | `dice`(def "1d100")、`anticipation`(ms) | 2200ms | 大号 2.5D 骰子入场 + 落木拟音 | doc-19 §3.3（本演出只做前半段，见 §6.3） |

**`show` 的 id 是封闭枚举**（`ShowKind`），与落盘 kind 的注册表**互斥**（T8 守卫）。演出的视觉实现归 `docs/ui/前端改造计划.md`；本文冻结的是 id、参数、默认时长与语义。

### 14.4 落盘组件全表（18 个）

列含义：**点击** = doc-10 E12 的四级（`read` 开阅读 / `continue` 续写说一句 / `visual` 视觉替应 / `look` 纯看）；**通道** = 该 kind 的渲染器必须呈现哪些通用互动字段；**收藏** = 呈现层可拖入背包（doc-10 E5 `BAG_TYPES` 的扩展位）；**二级** = §16 的阅读形态；**材质** = 卡面材质词汇（doc-04 §10.6 降级为题材概念，具体视觉由前端定）；**use_item** = 是否 `use_item_on` 的合法目标（§15）。

#### core —— 内核两种，任何世界都有

| kind | 点击 | 通道 | 收藏 | 二级 | 材质 | use_item | 用途 / 允许的交互 | extra 字段 | age |
|---|---|---|---|---|---|---|---|---|---|
| `note` | `read` | status, choice, dice | **是** | `read` | `paper`（便签） | 否 | 便签/物件卡：钥匙、车票、字条。**没有专属玩法**，它的价值是"有细节、可收藏、可被出示"。允许：被 `move`（拿走/放下）、被 `use_item_on` 作为 **item** 出示给别的目标、读全文。 | `tags?`、`icon?` | ✅ |
| `letter` | `read` | status, choice, dice | **是** | `read` | `paper`（信封 + 火漆） | **是**（可作目标：投递/出示） | 信：doc-10 E2 的四段体（title/preview/body/sign）。允许：读全文、被投递（`use_item_on` 到信箱/角色）、被收藏。 | `sign?`、`seal?`（火漆样式）、`addressed_to?` | ✅ |

#### adventure pack —— 雾坞镇 / 地牢 / 探险题材

| kind | 点击 | 通道 | 收藏 | 二级 | 材质 | use_item | 用途 / 允许的交互 | extra 字段 | age |
|---|---|---|---|---|---|---|---|---|---|
| `lock` | `visual` | status, choice, dice | 否 | `read` | `slab`（铁/石） | **是**（核心用途） | 门/箱/地窖口的锁。允许：`use_item_on` 用钥匙/撬棍开（确定性 handler 改 `status.data.locked`）、`roll_dice` 撬锁、`choice` 踹门。**开锁后作家据此生成新场景或新物件。** | `accepts`、`status.data.locked`、`status.data.opened_by` | ✅ |
| `container` | `visual` | status, choice, dice | 否 | `read` | `slab` | **是** | 箱/柜/抽屉/谜题盒。**谜题盒并入此处**（§14.2）。允许：`use_item_on` 放入/取出（**确定性 handler 翻 `status.data.opened`**，§15.3；doc-19 §7 的"钥匙开铁箱"money shot 靠它即时反馈）、`choice` 翻找、`status.data.combo` 表达密码。 | `accepts`、`status.data.opened`、`status.data.combo`、`holds?`（路径数组） | ✅ |
| `trap` | `visual` | status, dice | 否 | `read` | `slab` | **是**（解除它） | 会触发的东西：绊索、毒针、塌方。允许：`roll_dice` 闪避、`use_item_on` 解除、`choice` 硬闯。**触发后改 `status.data.sprung`，作家写后果。** | `status.data.armed`、`status.data.sprung`、`accepts` | ✅ |
| `mechanism` | `visual` | status, choice, dice | 否 | `read` | `slab`（黄铜） | **是**（作动它） | 灯/闸/齿轮/拉杆：**二元或少量档位的开关**。允许：`choice` 扳动、`use_item_on` 用工具拧、`status.data.position` 表档位。**这是"改变场景状态"的通用件**（开灯、放桥、放水）。 | `status.data.position`、`states?`（档位枚举）、`accepts` | ✅ |
| `map` | `read` | status, choice | **是** | `read` | `scroll`（牛皮卷） | 否 | 地图/图纸/罗盘图。允许：读全文（二级层画路线）、被收藏、`choice` 选择目的地。**它是"给玩家指路"的组件**，不自己造成世界变化。 | `marks?`（`{label,x,y}[]`）、`region?` | ✅ |

#### mystery pack —— 福尔摩斯 / 推理题材

| kind | 点击 | 通道 | 收藏 | 二级 | 材质 | use_item | 用途 / 允许的交互 | extra 字段 | age |
|---|---|---|---|---|---|---|---|---|---|
| `book` | `read` | status, choice, dice | **是** | `pages`（分页） | `paper`（精装） | 否 | 书/卷宗/档案：**有页**。允许：翻页（二级层分页）、`choice` 选区、`status.data.page` 记进度。 | `pages?`（字符串数组）、`author?` | ✅ |
| `ledger` | `read` | status, choice, dice | **是** | `read`（表格） | `paper`（账本） | 否 | 账本/清单/名册：**有可对账的数字**。允许：`choice` 核对某行、`roll_dice` 查账、`status.data` 存行号/金额。**推理世界的"数字证据"载体。** | `columns?`、`rows?`（`string[][]`） | ✅ |
| `photo` | `visual` | status, choice | **是** | `read`（图 + 图注） | `paper`（相纸） | **是**（出示它） | 照片/画像/速写：`image` 字段（`.airpworld/assets/` 或 `generate_image` 产物）。允许：读图注、被出示给角色（`use_item_on`）、`choice` 追问。 | `image?`、`caption?` | ✅ |
| `cipher` | `visual` | status, choice, dice | **是** | `read`（密文 + 明文） | `paper`（描图纸） | **是** | 密文/暗号/密码表。允许：`roll_dice` 破译、`choice` 试解、`use_item_on` 用密钥/对照表。**`status.data.decoded` 翻真时二级层揭示 `cleartext`。** | `cleartext?`（解密后的全文）、`status.data.decoded`、`accepts` | ✅ |

#### chronicle pack —— 时间线科幻题材

| kind | 点击 | 通道 | 收藏 | 二级 | 材质 | use_item | 用途 / 允许的交互 | extra 字段 | age |
|---|---|---|---|---|---|---|---|---|---|
| `clock` | `visual` | status, choice, dice | 否 | `read` | `panel`（仪表） | **是**（校准它） | 钟/表/计时器：**世界时间的可见载体**（doc-19 §3.2 的"时间印章"在场景里的实体形态）。允许：`choice` 调整、`use_item_on` 上发条、`status.data` 报时。 | `status.data.time`、`status.data.running` | ✅ |
| `tape` | `read` | status, choice | **是** | `read`（可回放） | `panel`（磁带） | 否 | 录音带/日记账/记录仪。允许：`choice` 播放/倒带、`status.data.position` 记位置。**"回放过去"的动作载体**——回放是读，不是时间旅行。 | `duration?`、`status.data.position` | ✅ |
| `anchor` | `visual` | status, choice | **是** | `read` | `slab`（金属） | **是**（用它） | 时间锚：**跨时间线保留的物件**（doc-24 §5 的“主玩法动词：改写 / 对照 / 选择”）。允许：被携带（`move`）、被 `use_item_on` 到终局门、`status.data.linked_to` 记它锚定的时间层。 | `status.data.linked_to`、`accepts` | ✅ |

#### craft pack —— 手作 / 学院 / 休闲题材

| kind | 点击 | 通道 | 收藏 | 二级 | 材质 | use_item | 用途 / 允许的交互 | extra 字段 | age |
|---|---|---|---|---|---|---|---|---|---|
| `instrument` | `visual` | status, choice, dice | 否 | `read` | `board`（木质面板） | **是** | 乐器（`piano` 的正式名）。doc-20 §2.1 的示例就是它（`doc-20:74-88`）。允许：`choice` 弹一曲、`roll_dice` 演奏检定、`use_item_on` 上油/调律、`status.data.lid/tune` 表状态。 | `status.data.lid`、`status.data.tune`、`accepts` | ✅ |
| `board` | `visual` | status, choice, dice | 否 | `board`（原位格子） | `board` | **是**（落子） | 棋盘/沙盘/布局台。允许：`choice` 走子、`status.data.position` 存局面、`use_item_on` 摆一枚棋子。**结构性玩法（残局）的载体**；通用棋规 handler 见 §12 未决项 3。 | `status.data.position`、`grid?`（`{cols,rows}`） | ✅ |

#### room pack —— 角色小天地 / 私人空间题材（v3 林晚工作室的证据落点）

| kind | 点击 | 通道 | 收藏 | 二级 | 材质 | use_item | 用途 / 允许的交互 | extra 字段 | age |
|---|---|---|---|---|---|---|---|---|---|
| `diary` | `read` | status, choice, dice | **是** | `read+continue`（可续写） | `paper`（日记本） | 否 | 日记/随笔：**有日期的私人文字**（doc-10 E9 的 `diary` 先例）。允许：读全文、**续写一句**（doc-10 E12 的第三级点击后果：`continue` = 不改变世界、只对人说话，走 `onContinue`）。 | `date?`、`mood?` | ✅ |
| `thread` | `read` | status, choice | **是** | `pairs`（双人气泡） | `paper`（对话记录） | 否 | 一段对话的落盘形态（doc-10 E9 的 `thread` 先例：`extra.lines[{who,text,time}]`）。允许：读、`choice` 接一句。**遮罩对话结束后，作家可以把这一场对话落成 `thread`。** | `lines`（`{who,text,time}[]`） | ✅ |

> **为什么 `thread` 与 `diary` 在 `room` pack 而不是通用**：它们的语义是"私人空间里的痕迹"（doc-06 §4.3），放在公共场景层会与 `book` 抢戏。但**注册表是全集、题材靠排序**（§13.2），所以推理世界要写一段录音对话也可以用 `thread`——不禁止，只是索引里不排前面。

### 14.5 三个组件的完整 frontmatter 示例

选 `lock`（以物解谜的代表）、`letter`（二级阅读的代表）、`board`（结构性玩法的代表）。

#### 示例 A：`lock` —— 以物解谜的完整闭环

文件 `world/holmes-world/baker-street/cellar-door.md`：

```markdown
---
type: component
component: lock
title: The Cellar Door
preview: A padlock newer than the door it guards.
age: now
accepts:
  itemKinds: [note]
  itemTags: [key, key-like]
  any: false
  hint: Use a key here
status:
  data:
    locked: true
    opened_by: null
    material: iron
choice:
  - "Force the padlock"
  - "Look for another way in"
roll_dice:
  type: 1d100
  desc: Force the rusted padlock
  expect: ">70"
---
The padlock is bright, oiled, and only a few days old. The door beneath it
has not been opened in years — you can see the dust still packed along the frame.

Someone has been keeping this shut.
```

**这条链路怎么走完**（探针 P3/P4 的场景）：
1. 作家用 `get_component({component:'lock'})` 拿到上面的 schema（或直接照抄）；
2. `write` 落盘 → 前端按 `CARD_FORMS.lock`（`176×176`, `slab`）渲染；
3. 玩家背包里的 `note` 铜钥匙悬停到这张卡 → `useItemTargetOf('lock', keyFm)` → `{candidate:true, hint:'Use a key here'}` → 卡加 `puzzle-target-hover` 微光（`CardRenderer.tsx:122` 已有 CSS 钩子）；
4. 释放 → `/use-item` → `useItemOn(item, target)` → 查 `lockHandler` → 改 `status.data.locked = false`、`opened_by = 'player/copper-key.md'`（`writeFileAtomic`）→ 落 `use_item_on` 事件；
5. 作家下一轮收到事件段「玩家把铜钥匙用在了地窖门上」→ 写一段 chalk，并 `write` 一个新的 `gate`/`note`（地窖内部）。

#### 示例 B：`letter` —— 二级阅读的四段体（doc-10 E2）

文件 `characters/watson/letter-to-holmes.md`：

```markdown
---
type: component
component: letter
title: A Letter from Watson
preview: The envelope is damp; the ink has run at one corner.
sign: J.W.
seal: wax-red
addressed_to: holmes
age: now
choice:
  - "Accept the case"
  - "Ask Watson why now"
status:
  data:
    read: false
    case: "The Disappearance of Lady Adler"
---
Holmes —

I would not trouble you if I could see another way. Lady Adler has been
gone three days. The constable has closed the file; I have not.

There is one thing in her rooms I cannot explain, and I do not trust myself
to look at it twice alone.

Come to Baker Street. Tonight.
```

**二级阅读形态**（§16）：卡面 = `title` + `preview` + `sign`（三段可见，`CardRenderer.tsx:209-220` 现在就是这么渲染的）；点开 = 全文（`body` 字段优先，缺省取 md 正文）+ 落款 + 「就这件事，对 Watson 说点什么…」续写输入。

#### 示例 C：`board` —— 结构性玩法的 frontmatter

文件 `world/tea-room/go-board.md`：

```markdown
---
type: component
component: board
title: The Unfinished Game
preview: Black has not moved in a very long time.
age: deep
grid:
  cols: 19
  rows: 19
status:
  data:
    position: "b-d4,b-q16,w-d16,w-q4,b-k10"
    turn: black
    resigned: false
accepts:
  itemKinds: []
  itemTags: [stone]
  any: false
  hint: Place a stone
choice:
  - "Study the position"
  - "Play the white stone in your pocket"
roll_dice:
  type: 1d100
  desc: Find the move black was afraid of
  expect: ">65"
---
Two bowls, one nearly empty. Black stopped playing mid-game — the last stone
is set down slightly off the line, as if the hand had been taken away.
```

**说明**：
- `status.data.position` 用**紧凑可读串**（`b-d4`）而不是嵌套数组——它要能被人直接读、被 `look_at` 格式化（09 §6），也要能被 handler 解析；
- `grid` 决定二级层画多大；`secondLayer: 'board'` 意味着不走"全文"，而是**原位渲染格子**；
- 残局判定（黑棋为何认输）**没有通用 handler**（§12 未决项 3）——`roll_dice` + 作家裁决是本案的解法，这符合 doc-20 §2.1 的"作家响应事件后写作"。

---

## 15. 组件与 `use_item_on` 的衔接

交叉引用 `docs/tools/08-use-item-on.md`（08 文档拥有 `use_item_on` 的语义；本文只定**注册表这一侧**的契约）。已与 08 的负责人 IRC 对齐，以下三条是双方共同冻结的。

### 15.1 分工

doc-20 §8（`doc-20:287`）：*"`choose` 是单实体公开的动作，`use_item_on` 表达'物件 A 作用于实体 B'的二元关系……确定性组件 handler 或作家再写出后果。"* 因此：

| 谁 | 负责 |
|---|---|
| `use_item_on`（08） | 解析 item/target、校验存在、按 **target 的 component kind** 查 handler、调 handler、**落 `use_item_on` 事件**、返回结果 |
| 注册表（本文） | 提供 `accepts`（前端高亮 + 可选的早期拒绝）与 `handler`（确定性后果） |
| 作家 | 没有 handler 或 handler 返回 `handled:false` 时，下一轮读事件段并写出后果 |
| 前端 | 用 `useItemTargetOf` 决定"悬停是否微光 + 显示什么 hint"（`CardRenderer.tsx:122` 的 `puzzle-target-*` 类） |

### 15.2 `accepts`：前端高亮与早筛的单一真相源

```ts
interface Accepts {
  /** Item component kinds that this target responds to. */
  itemKinds?: string[];
  /** Item frontmatter `tags` that this target responds to. */
  itemTags?: string[];
  /** Responds to anything (rare; e.g. a bottomless pit). */
  any?: boolean;
  /** English microcopy for the hover glow ("Use a key here"). */
  hint?: string;
}

/**
 * The ONE function the frontend and use_item_on both call.
 * Never a second switch elsewhere — that is how the two drift apart.
 */
function useItemTargetOf(
  targetKind: string,
  itemFm: Record<string, any> | null | undefined
): { candidate: boolean; hint?: string }
```

**匹配规则**（唯一口径）：`any === true` → 命中；否则 item 的 `component`/`type` ∈ `itemKinds` → 命中；否则 item 的 `frontmatter.tags` ∩ `itemTags` ≠ ∅ → 命中；否则不命中。**`candidate` 只是"可能是合法目标"，不是"一定成功"**——钥匙可能开不了这把锁（handler 返回 `handled:false`）。前端靠它做微光，不做成败承诺。

> **这是对 08 提案的一处明确回答**（08 问"registry 是否暴露 accepts"）：**是**，字段名就是 `accepts`，判定函数就是 `useItemTargetOf`，前端与引擎共用这一份。08 的 `puzzle-target-ready` / `puzzle-target-hover`（`CardRenderer.tsx:122`）接它；`hint` 直接作为 hover 文案。

### 15.3 `handler`：确定性后果

与 08 逐字一致的契约（本文的注册表条目的可选字段）：

```ts
type UseItemOnHandler = (args: {
  item: EntityRef;          // { path, name, frontmatter }
  target: EntityRef;        // { path, name, frontmatter }  ← 含已解析的 frontmatter（本文追加）
  actor: Actor;             // 00 §3
  store: WorldStore;        // 00 §4.1
  turn: string;             // 合并锚
}) => Promise<
  | { handled: true; summary?: string; details?: Record<string, any> }
  | { handled: false; reason?: string }
>;

interface EntityRef { path: string; name: string; frontmatter: Record<string, any>; body?: string }

> **`body?` 是实现期追加的**（`components/types.ts:42`）：handler 要**原地重写文件并保留正文**（只改 `status.data.locked`），所以调用方把已读到的 body 一并传入；缺失时按空正文处理。`08 §3.4` 同款。
```

**四条纪律**：

1. **按 target 的 kind 查找，绝不按 item 的 kind。** 钥匙开锁：锁是 target，查 `lock.handler`。**查找 helper 是 `componentDefOf(kind)`**（`components/registry.ts:86`）——不是 `getComponent(...)`（那是 `get_component` **工具动作**的名字）。匹配 item 的 helper 是 `useItemTargetOf(targetKind, itemFm)`（`registry.ts:156`）。
2. **handler 只允许重写 target 自己的 frontmatter**（`store.writeFileAtomic`）；**MUST NOT** 创建 / 移动 / 删除实体，**MUST NOT** 调其它动作函数；**绝不** `writer.prompt`、绝不发 WS 帧、绝不直接 `fs.writeFileSync`。理由：00 §1 硬约束（扩展不假设连着 WS）+ 01 的 `ActionContext` 形状 + 08 §3.4 的严口径。
3. **`handled:false` 不是错误、不是静默降级。** 它是合法结果（"这东西对这门没用"）；`use_item_on` 照落事件，文本明说目标没有反应，作家下一轮可以写"钥匙插不进去"。
4. **`target.frontmatter` 必须传进去**（本文对 08 提案的追加）。理由：`lock`/`instrument`/`mechanism` 的 handler 要读当前 `status.data`（`locked`/`lid`/`position`）才能决定后果；不传就得 handler 自己再读一次盘，多一次 I/O 且可能读到半写文件。

**示例 handler（`lock`，示意实现，不是本文要写的代码）**：

```ts
const lockHandler: UseItemOnHandler = async ({ item, target, store, actor, turn }) => {
  const fm = target.frontmatter;
  if (fm.status?.data?.locked !== true) return { handled: false, reason: 'already_open' };
  const tags = [...(item.frontmatter.tags ?? []), item.frontmatter.component ?? item.frontmatter.type ?? ''];
  if (!tags.some((t) => ['key', 'key-like', 'crowbar'].includes(t))) {
    return { handled: false, reason: 'wrong_item' };
  }
  fm.status.data.locked = false;
  fm.status.data.opened_by = item.path;
  // 中性 writer（`schemas/frontmatter.ts::stringifyFrontmatter(fm, body)`，实现期由 peer 请求新增）：
  // 整个文件一次原子写回。02 的 `stringifyEntityFrontmatter`/`stringifyChalkFile` 是 chalk 专用
  // 整形器（管冻结键序），handler 只需原样保留 target 的 frontmatter 与正文，故用中性那个。
  await store.writeFileAtomic(target.path, stringifyFrontmatter(fm, target.body ?? ''));
  return { handled: true, summary: `${item.name} opens ${target.name}.`, details: { unlocked: true } };
};
```

**示例 handler（`container`，M-6 补齐的确定性契约）**：与 `lock` 同构——读 `target.frontmatter.status.data.opened`；已为 `true` → `{ handled: false, reason: 'already_open' }`；命中 item 后把 `opened` 翻为 `true`（`opened_by` 记 item 路径），用 `store.writeFileAtomic` 重写 target 自己的 frontmatter。**不落额外事件**：`use_item_on` 那一行就是这次改动的记录（纪律 2；08 §3.4 纪律 6 明文"handler 对 target 的改写不再额外落 `entity_edited`"）。doc-19 §7 的 0:30–1:30 节拍（铜钥匙丢在铁箱上期待爆出怀表与便签）由此不再依赖作家下一轮。

**`accepts` 与 `handler` 的关系**：`accepts` 是**广撒网**（可能是目标），`handler` 是**精确判定**（真的行不行）。一个 kind 可以只有 `accepts` 没有 `handler`（纯叙事目标：任何东西用上去，作家来写反应）——**这是合法的**，`details.handled === false`。

---

## 16. 二级阅读协议（DetailPanel）

### 16.1 统一形态（doc-10 E9 = v3 的 DetailPanel）

doc-10 E9（`doc-10:93`）把三原型的"第二层"统一成一句话：

> **所有组件的第二层统一长这样：类型章 + 全文 + 回跳 + 续写。**

落成协议（`secondLayer` 字段的值决定渲染哪几段）：

```
┌─ DetailPanel ─────────────────────────────────────────────┐
│ [LETTER]  A Letter from Watson          ×                 │  ← 类型章（kind → 英文大写）+ title
├───────────────────────────────────────────────────────────┤
│                                    ← 在空间中看            │  ← 回跳：关panel + camera_focus 到卡片
│  Holmes —                                                 │
│                                                           │
│  I would not trouble you if I could see another way...    │  ← 全文（body 字段优先，缺省 md 正文）
│                                                           │
│                                                    J.W.   │  ← 落款（letter 的 sign；其他 kind 可无）
│                                                           │
│  [status 折叠表]  [choice 选项组]  [roll_dice 骰子卡]      │  ← 通用互动字段（doc-20 §2，全 kind 通用）
├───────────────────────────────────────────────────────────┤
│  就这件事，对 Watson 说点什么…                     ⏎      │  ← 续写输入（仅 secondLayer 含 'continue' 时）
└───────────────────────────────────────────────────────────┘
```

### 16.2 `secondLayer` 七种形态

| 值 | 渲染什么 | 哪些 kind | 对应原型证据 |
|---|---|---|---|
| `none` | 不点开（纯卡面） | **无**（18 个 kind 全有点开态；`none` 保留给将来的纯装饰 kind） | — |
| `read` | 类型章 + 全文 + 回跳 | `note`(退化: 单段) · `letter` · `lock` · `container` · `trap` · `mechanism` · `map` · `ledger` · `photo` · `cipher` · `clock` · `tape` · `anchor` · `instrument` | v2 `letterFocus` modal（`doc-10:23`） |
| `read+continue` | `read` + 底部续写输入 | `diary` | v3 DetailPanel 的 `onContinue`（`doc-10:93`） |
| `fragments` | 类型章 + **碎片列表**（每片可单独展开）+ 回跳 | （留位；`story`/`scenario` 若组件化则用它） | v3 `story.extra.fragments`（`doc-10:90`） |
| `pairs` | 类型章 + **双人气泡**（`lines[{who,text,time}]`）+ 回跳 | `thread` | v3 `thread`（`doc-10:91`） |
| `pages` | 类型章 + **分页器**（`pages[]`，左右翻）+ 回跳 | `book` | 新（书要有页是常识判据，无原型直接证据） |
| `board` | 类型章 + **原位格子渲染**（`grid` + `status.data.position`）+ 不做全文翻页 + 回跳 | `board` | 新（棋盘不能当文章读） |

### 16.3 kind 需要提供的字段

| 字段 | 谁用 | 说明 |
|---|---|---|
| `title` | 类型章右侧 | 必填（内核）。 |
| `body?` | `read` / `read+continue` | 二级层全文。**缺省时取 md 正文**——所以"用 frontmatter 的 body 还是 md 正文"作者二选一即可（doc-10 E2 把这条列为"实现时定"，现定：**两者皆可，`body` 优先**）。 |
| `sign?` | `read`（落款行） | 主要是 `letter`；其他 kind 可用来放署名。 |
| `lines` | `pairs` | `thread` 专属：`{ who, text, time }[]`。 |
| `pages` | `pages` | `book` 专属：`string[]`。 |
| `fragments` | `fragments` | 留位字段：`{ label, body }[]`。 |
| `grid` | `board` | `board` 专属：`{ cols, rows }`。 |
| `status` / `choice` / `roll_dice` | **全部** | 通用互动字段（doc-20 §2），渲染在全文与续写框之间（`fm.tsx:23-64` 的 `renderFrontmatterWidgets` 直接复用）。 |

### 16.4 `letter` 的 `letterFocus` 与回跳

**`letterFocus`**（doc-10 E1/E2 的原型名）就是 `secondLayer: 'read'` 的一个实例，**不是 letter 专属的模态**。现状 `CardRenderer.tsx:223-257` 给 letter 手写了一个 modal——按本文，它应替换为通用的 `DetailPanel`，`letter` 只是"有 sign、有 seal"的 `read` 形态特例。

**回跳（"在空间中看"）**：`DetailPanel` 的头部按钮 = 关面板 + `show({component:'camera_focus', target: <path>})`。**这是 `show` 的第二个合法调用者**（第一个是作家直接调用）：前端可以本地演（不发工具），也可以走 `/api/show`——**本文倾向本地演**（前端有相机状态，绕一圈 HTTP 没有收益），`camera_focus` 于是成为**唯一一个前端可自行触发**的演出。若评审要求统一走服务端，需要 `/api/show`（§12 未决项 6）。

**续写（`continue`）的落点**：`diary` 的"就这件东西，对 X 说点什么…"提交后 → **不是** `choose`、**不是** `use_item_on`、**不是** 新工具，而是**作为玩家下一轮输入送出**（与纸条通道同一条路，doc-06 §1 的"纸条"意象）。doc-10 E12（`doc-10:130`）把它定性为"第三种点击后果：不改变世界、只对角色说话"——**因此它不落任何事件**（世界没变），它只进 `entries`（会话逐字，doc-21 §1.1）。

> **这就是"点击四级"的落定**（doc-10 E12 的三级变四级）：`read` 开阅读 / `continue` 续写说话 / `visual` 视觉替应（改 `status` 或演一次）/ `look` 纯看。**判据句不变**（"点击后世界变不变"）：`read`/`look` 不变世界、`continue` 只说一句话也不是世界变化、`visual` 才可能变（看它走不走 handler / 作家写不写）。`get_component` 的索引与详单都带 `click` 值，模型据此知道"这东西点下去会发生什么"。

---

## 附录 A：`CARD_FORMS` 扩展表（18 + 5 既有 = 全文）

**这是尺寸的唯一真相源**（`forms.ts:1-16` 的注释把它定为契约）。*实现时**逐行照抄**本表，不要另算。*

### A.1 既有 5 项（不改）

```ts
chalk:   { label: 'Narration', w: 460, h: 190, chrome: 'bare'  },
gate:    { label: 'Scene',     w: 288, h: 240, chrome: 'cover' },
sprite:  { label: 'Presence',  w: 176, h: 196, chrome: 'bare'  },
default: { label: 'File',      w: 240, h: 168, chrome: 'paper' },  // 兜底，永不匹配
```

> `letter` / `note` 从既有表**移到组件表**（尺寸不变），因为它们的 kind 从此由注册表解析。

### A.2 新增 18 项（组件注册表的 kind）

| kind | label | w | h | chrome | 座位语义 |
|---|---|---|---|---|---|
| `note` | Note | 200 | 168 | `note` | 便签：小、密、成组出现 |
| `letter` | Letter | 224 | 176 | `paper` | 信：略宽，卡面三段 |
| `lock` | Lock | 176 | 176 | `slab` | 近方：门/箱的锁，等宽高便于"吸附在门边" |
| `container` | Container | 200 | 200 | `slab` | 方：箱柜 |
| `trap` | Trap | 168 | 168 | `slab` | 小方：不起眼（陷阱本就该低存在感） |
| `mechanism` | Mechanism | 192 | 160 | `slab` | 横长：拉杆/闸盘 |
| `map` | Map | 300 | 200 | `scroll` | 宽幅：纸质地图 |
| `book` | Book | 208 | 264 | `paper` | 竖高：书脊朝外的书 |
| `ledger` | Ledger | 260 | 176 | `paper` | 宽扁：摊开的账本 |
| `photo` | Photograph | 224 | 240 | `paper` | 竖高：相纸（含图区 + 图注） |
| `cipher` | Cipher | 220 | 168 | `paper` | 中等：密文纸 |
| `clock` | Clock | 160 | 160 | `panel` | 近方小：表盘 |
| `tape` | Recording | 240 | 148 | `panel` | 横扁：磁带/记录仪 |
| `anchor` | Anchor | 168 | 168 | `slab` | 方形：金属重物（比 lock 略小，显"随身"） |
| `instrument` | Instrument | 320 | 200 | `board` | 大横：乐器面板（piano 需要宽度） |
| `board` | Board | 288 | 288 | `board` | 大正方：棋盘/沙盘 |
| `diary` | Diary | 208 | 240 | `paper` | 竖高：日记本 |
| `thread` | Conversation | 300 | 200 | `paper` | 宽幅：双人气泡需要宽度 |

**尺寸理由（不是拍脑袋）**：

- **宽高比编码"这类东西怎么用"**：锁/容器/锚是**方形**（一个点，等宽高 → 微光高亮时是正的圆角方块，视觉上就是"靶子"）；书/日记/照片是**竖高**（可翻的纸）；账本/对话/乐器是**宽幅**（横向的内容）；棋盘是**大正方**（格子要方）。
- **相邻 kind 的尺寸必须可分辨**（200×168 vs 224×176）：排座时两张卡挨在一起，尺寸差 24px 才能看出是两种东西。
- **`h` 只服务排座**（AGENTS.md §3 前端纪律第 2 条）：**渲染高度由内容撑开**，`h` 不是 CSS 高度。这一点与 `docs/ui/前端改造计划.md` 一致，本文不重复。
- **`instrument` 320 宽**：`doc-20:76` 的 piano 示例要显示 `lid/tune` 状态与两个 choice，窄卡放不下。

### A.3 新增 4 个 `CardChrome` 的视觉规格（v2 语汇，doc-04 §10.2）

| chrome | 视觉 | 用在 | token 引用（§10.2） |
|---|---|---|---|
| `slab` | **石板/铁件**：`--paper` 底 + 2px `rgba(41,40,32,.15)` 描边 + **内凹阴影**（`inset 0 2px 6px rgba(41,40,32,.12)`）+ 无圆角外的飘浮 | lock / container / trap / mechanism / anchor | 阴影：§10.2 "暖色漫射软影"的**反向**（凹陷而非漂浮——金属件是"嵌在场景里"的）。 |
| `board` | **面板**：较深的奶油底（`#eee8dc`）+ **格纹**（80px 网格，`rgba(41,40,32,.035)`）+ 20px 圆角 | instrument / board | 网格：§10.2 画布底色同款，说明"这是一块台面"。 |
| `panel` | **仪表**：`--ink` 浅底（`rgba(41,40,32,.06)`）+ 等宽字体（DM Mono）+ 细边框 | clock / tape | 字体：§10.2 "DM Mono（元信息 9~12px）"。**唯一用机器字的卡面**——它记录的是数字，不是人的话（doc-04 §3 的字体即人格）。 |
| `scroll` | **卷轴**：`--paper` 底 + **上下 2px 深色卷边**（`border-top/bottom: 3px double`）+ 无圆角（纸卷是直的） | map | 与 v2 的"全圆角"冲突——**这是刻意的例外**（§10.5-3 的"说墨不说纸"在这里让位给"这是一卷纸"的题材语义），在实现时若评审要求统一圆角，改成 24px 即可，尺寸不变。 |

> **doc-04 §10.5-3 的纪律**（"说墨不说纸"）与 `slab/scroll` 的命名有张力：`slab`（石板）在"墨"的语汇里没有对应物。**解决的读法**：v2 的"墨"是**画布与叙事**的语汇；组件卡是**世界里的东西**，它可以**是**铁、是纸、是表盘——于是组件的材质恰恰应该是"物的材质"，叙事才是"墨"。**这条解释需要评审确认**（§12 未决项 8，见下）。

---

## 附录 B：注册表条目骨架（实现时照此写）

```ts
// packages/shared/src/components/packs/adventure.ts
import { Type } from 'typebox';   // 若 shared 不用 typebox，用 zod（现有 schemas 都是 zod）
import type { ComponentDef } from '../types.js';

export const ADVENTURE_PACK: ComponentDef[] = [
  {
    kind: 'lock',
    pack: 'adventure',
    label: 'Lock',
    purpose: 'A door, chest or hatch that only opens to the right thing.',
    match: (fm) => fm.component === 'lock',
    fields: [
      { name: 'preview', type: 'string', required: false, desc: 'One-line card-face teaser.' },
      { name: 'accepts', type: 'object', required: false, desc: 'What this lock responds to.', example: 'itemKinds: [note]' },
      { name: 'status.data.locked', type: 'boolean', required: false, desc: 'The convention handlers read.', example: 'true' },
    ],
    click: 'visual',
    channels: { choice: true, status: true, rollDice: true, useItemTarget: true },
    movable: false,
    secondLayer: 'read',
    accepts: { itemKinds: ['note'], itemTags: ['key', 'key-like', 'crowbar'], hint: 'Use a key here' },
    handler: lockHandler,          // 见 §15.3
    example: `---\ntype: component\ncomponent: lock\ntitle: The Cellar Door\npreview: A padlock newer than the door it guards.\naccepts:\n  itemKinds: [note]\n  itemTags: [key]\nstatus:\n  data:\n    locked: true\n---\nThe padlock is bright and oiled. Someone has been keeping this shut.`,
  },
  // container / trap / mechanism / map ...
];
```

```ts
// packages/shared/src/components/registry.ts
import { CORE_PACK } from './core.js';
import { ADVENTURE_PACK } from './packs/adventure.js';
import { MYSTERY_PACK } from './packs/mystery.js';
import { CHRONICLE_PACK } from './packs/chronicle.js';
import { CRAFT_PACK } from './packs/craft.js';
import { ROOM_PACK } from './packs/room.js';
import { SHOWS } from './performances.js';
import { CARD_FORMS } from '../schemas/forms.js';

/** Registry order IS dispatch order for `match`. core first, always. */
const ALL: ComponentDef[] = [
  ...CORE_PACK, ...ADVENTURE_PACK, ...MYSTERY_PACK, ...CHRONICLE_PACK, ...CRAFT_PACK, ...ROOM_PACK,
];

export const COMPONENT_REGISTRY: Record<string, ComponentDef> = Object.fromEntries(
  ALL.map((d) => [d.kind, d]),
);

export const SHOW_REGISTRY: Record<string, ShowDef> = Object.fromEntries(SHOWS.map((s) => [s.id, s]));

// m-20: forms.ts stays a leaf (CARD_FORMS only). Push the resolver INTO it instead of
// importing it back — no `forms.ts → registry.ts` edge, therefore no ESM cycle.
registerComponentKindResolver(resolveComponentKind);

// Fail loud at module load: a registered kind without a CARD_FORMS row is a dev error.
for (const d of ALL) {
  if (!CARD_FORMS[d.kind]) throw new Error(`component "${d.kind}" has no CARD_FORMS entry`);
  if (SHOW_REGISTRY[d.kind]) throw new Error(`"${d.kind}" is both a docked component and a performance`);
}
```

**四条实现纪律**（都对应一个单测）：

1. `match` 无副作用、纯函数（T1）；
2. 注册顺序 = 解析顺序，`core` 在前，且 `match` 之间**不允许重叠**（`letter` 与 `note` 的谓词天然不交；若以后要放开，得先定义优先级）；
3. **模块加载时校验** `CARD_FORMS` 与 `SHOW_REGISTRY` 互斥（T2/T8）；
4. `example` 必须是**字符串常量**，不是模板函数——它要被 `get_component` 原样回显，也要被 T5 当输入解析。

---

## 附录 C：与其它文档的接口索引

| 本文的东西 | 谁消费 | 在哪 |
|---|---|---|
| `COMPONENT_REGISTRY` / `resolveComponentKind` | 前端 `CardRenderer`、server `routes/world.ts:184-187` | §8.2、§8.5 |
| `CARD_FORMS[kind]` | server 排座（`routes/world.ts:31`）、web 画卡（`index.css:773`） | 附录 A |
| `useItemTargetOf` | 前端拖拽高亮；`useItemOn` 早筛 | §15.2；`08-*` |
| `handler` | `useItemOn` 动作函数 | §15.3；`08-*` |
| `details.frame` | `mapEngineEvent` → `show_frame` 广播 | §6.2；`12-*` |
| `entity_created.detail.component` | 事件渲染器（人话模板） | §5.1；`01-*`（见 §11 冲突 #2） |
| `click` / `secondLayer` | 前端 DetailPanel、`look_at` formatter | §16；`09-*` |
| `getComponent` / `showComponent` | `extensions/toolkit/*`、`extensions/tools.ts` | §8.3、§8.4；`12-*` |

---

## 附录 D：本页对 doc-10 待设计清单的收口

doc-10 的"待设计清单"5 项（`doc-10:160-168`），本文的答复：

| # | 项 | 本文的答复 |
|---|---|---|
| 1 | 组件的总结 schema | **§13.1**：小内核（`type/component/title/preview/body/age`）+ kind 自带 extra，注册表在 `packages/shared/src/components/`，**代码级注册，不是扩展 API**（§13.2，pi-rp 无 `registerComponent`）。 |
| 2 | 官方组件清单 | **§14**：18 个落盘 kind（core 2 + adventure 5 + mystery 4 + chronicle 3 + craft 2 + room 2）+ 7 个演出型；入选靠 C1–C4 判据；全文表格 + 3 个完整 frontmatter 示例。 |
| 3 | 组件的交互边界 | **§15/§16**：`choice` 走 `choose`、物件作用于目标走 `use_item_on`（`accepts` + `handler`）、阅读走 DetailPanel、续写走"下一轮输入"。**不为任何 kind 造 `interact` 工具。** 点击四级落定（§16.4）。 |
| 4 | 落地与渲染协议 | **§13.4 + 附录 A**：注册表不存尺寸，`CARD_FORMS` 存；chalk/`write` 落盘走 `entity_created`（§5.1）；`movable` 只管前端拖拽（§9.2）；`age` 是内核字段。 |
| 5 | 组件 vs `look_at` | **不变**（doc-10 已定方向）：`look_at` 返回标题/正文摘要 + 格式化互动字段，`.md` 正文与原始 YAML 用 `look_at` / `read` 拉。`get_component` 只管 **schema**，不管读取。 |
