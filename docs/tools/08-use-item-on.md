# doc-tools/08 `use_item_on` —— 物件作用于目标

> 状态：**设计定稿，待评审拍板（2026-09-12）**。本文是 B1 工具设计文档之一，遵循 `docs/tools/00-共同上下文.md`（冻结契约，下称 `00`）。
> 上位判据：`doc-20` §8（签名与语义）、§2.1（确定性 handler）；`doc-21` §4.3（detail 形状）、§5.5（事件不打断）；`doc-10`（组件注册表）；`doc-19` §3.1（以物解谜强度）；`后端实现计划.md` §11 #4（待拍板）。
> 姊妹文档：`docs/tools/01-动作内核与事件落账.md`（动作层骨架，下称 `01`）、`docs/tools/10-组件注册表与get-component-show.md`（注册表与 handler 契约，下称 `10`）。
> **本文最重要的产出是 §13 的取舍登记**：`use_item_on` 是否用 `followUp` 破例即时打断作家。结论是**不破例**；理由与每种选择的代价逐项写在那一节。

---

## 1. 一句话与定位

**`use_item_on` 表达"物件 A 作用于实体 B"这个二元关系：把一个已有的东西（钥匙、证物、颜料、棋子）施加到一个已有的实体（门锁、箱柜、角色、画布）上。**

`doc-20:287` 原文判据：*"`choose` 是单实体公开的动作，`use_item_on` 表达'物件 A 作用于实体 B'的二元关系，例如钥匙开门、证物出示给角色、颜料涂到画布。引擎记录 `actor / item / target` 并广播，确定性组件 handler 或作家再写出后果。"*

三条定位：

| # | 定位 | 出处 |
|---|---|---|
| 1 | **与 `choose` 不重复。** `choose` = 一个实体自己列出的公开动作（"撬锁 / 踹门"）；`use_item_on` = 用手上的一样东西去碰另一样东西。差别是"谁的动作"与"涉及几个实体"，不是"哪个更高级"。 | `doc-20:287`；`doc-20:90` |
| 2 | **调用本身不消耗、不移动、不改变物件的位置。** 钥匙用过之后还在背包里。要消耗 / 交付 / 掉落，另调 `move` 或编辑实体。 | `doc-20:289` 明文 |
| 3 | **后果有两个来源：目标组件的确定性 handler（机械、即时、零 token），或作家的下一轮叙事（语义、延迟一个 turn）。** 二者并存；handler 只负责目标自己 frontmatter 的那一格状态，叙事后果是作家的事。 | `doc-20:90`；`doc-19:171` |

**调用者**（`doc-20` §1.1 能力表：作家 ✅ / 角色 ✅）：

| 入口 | 谁 | 典型形态 | actor（`00 §3`） |
|---|---|---|---|
| **C（主力）** | 玩家 UI 拖拽 | 背包条目拖到画布上的门 / 箱 / 角色头像上释放（`doc-06:265`、`前端改造计划.md:255-263`） | `player` |
| A | 作家 agent | "把铜钥匙用在锁上"；顺手出示一件证物 | `writer` |
| A | 角色 agent | 角色把某样东西推给另一个角色 | `character:<id>` |
| （不应发生） | 上帝模式 | 上帝动的是文件本身，不是"某人做了什么"（`doc-14`） | — |

**这是 doc-19 的 money shot。** `doc-19:156-175` 把"玩家按住背包里的【铜钥匙】，拖到【锁住的地窖门】上释放"列为整场演示第一个"动手操作乐趣"时刻。因此本文对"即时性"的取舍（§13）不是次要细节，而是决定演示成不成的一处工程决策。

---

## 2. 签名与参数

### 2.1 工具面（`extensions/toolkit/use-item.ts`）

```ts
use_item_on({
  /** World-relative path of the item being applied (a single .md file). */
  item: string,
  /** World-relative path of the entity it is applied to. */
  target: string,
}): ToolResult
```

`doc-20` §8 的签名**逐字落成**（`doc-20:281-285`），字段名 `item` / `target` 是契约（`01 §5.1` 明写："单数路径一律叫 `path`——**`use_item_on` 例外**"）。不加 "force"、"hint"、"intent" 之类的第三个参数：任何"这次想干什么"的语义都属于作家的叙事，不属于工具面。

| 参数 | 类型 | 必需 | 语义 | 示例值 |
|---|---|---|---|---|
| `item` | `string` | **是** | **世界根相对路径**（`00 §2.1`），指向一个单文件 `*.md`。它是"被施加的东西"，**不因本次调用而移动或消耗**。 | `"player/copper-key.md"` |
| `target` | `string` | **是** | **世界根相对路径**，指向被作用的对象。可以是画布实体（组件 / note / letter / chalk）、场景门牌（`world/**/README.md`）、或画布上的角色呈现（`characters/<id>/README.md`）。 | `"world/cellar/cellar-door.md"` |

空串 → `invalid_argument`；绝对路径 / `..` / 保留前缀 → `invalid_path`（逐字复用 `01 §7.2` 的文案）。两者都**不是** `not_found`：空路径是调用错误，非法路径是语义错误，世界并不缺东西（`01 §7.3` 的定案）。

### 2.2 动作层（`packages/shared/src/actions/use-item.ts`）

```ts
export interface UseItemOnInput { item: string; target: string }

export interface UseItemOnDetails {
  item: string;            // 归一化后的 item 路径（稳定 id，回给模型/前端）
  itemName: string;        // 当时的显示名（detail 自足的同一份，doc-21 §3.3）
  target: string;
  targetName: string;
  /** target 的组件 kind（registry key），未注册时 null。前端据此选演出。 */
  targetKind: string | null;
  /** 是否被目标组件的确定性 handler 处理（§3.4、§5）。 */
  handled: boolean;
  /** handler 给的一行英文结果（handled=false 时为 null）。 */
  effect: string | null;
  /** handler 拒绝的原因码（handled=false 时可能有；§7）。 */
  reason: string | null;
  event: WorldEvent;       // use_item_on 那一行（01 §2.2 的 ActionResult.event）
  /** 演出提示：前端拿到后播什么（§6.1/§6.3）。由动作层给，不由前端猜。 */
  presentation: {
    foley: 'unlock' | 'paper-slide' | 'none';
    burst: 'unlock' | 'present' | 'none';
  };
}

export async function useItemOn(
  ctx: ActionContext,
  input: UseItemOnInput
): Promise<ActionResult<UseItemOnDetails>>
```

形状完全落在 `01` 冻结的骨架上（`ActionContext = { store, actor, turn, now?, rng? }`、`ActionResult<T> = { text, details: T & { event? } }`、失败抛 `ActionError`）。**`event` 在这里是必有的**（与 `lookAt` / `getComponent` 那类只读动作不同）：`use_item_on` 每次成功都改变世界至少一件事——它自己留下了记录。

服务方法名 `useItemOn`（`01 §2.6` 的 clist 第 11 项），签名 `createActionService(store, actor).useItemOn(input)`。

### 2.3 返回文本（英文，`00 §6.2`）

> **`00 §6.2` 的纪律**：文本 MUST 说明**实际发生了什么**，并返回后续动作需要的**稳定路径**。以下是精确文案模板，实现时照抄（模型只见这几句，它们是工具的教学面）。

| 情形 | `content[0].text` |
|---|---|
| handler 处理了 | `Used "Copper Key" (player/copper-key.md) on "The Cellar Door" (world/cellar/cellar-door.md). The lock opened.` |
| 无 handler（纯叙事目标） | `Used "Blood-stained Handkerchief" (player/handkerchief.md) on "Watson" (characters/watson/README.md). Watson has not reacted yet — nothing in the world changed.` |
| handler 拒绝 | `Used "Old Boat Ticket" (player/old-boat-ticket.md) on "The Cellar Door" (world/cellar/cellar-door.md). The door did not respond to it.` |

三句都带**双方的名字与路径**：下一轮作家要能精确指向它们（不猜、不重读目录），玩家 UI 要能定位两张卡。**"没有反应"必须是明确的一句话，不是沉默**——它是玩家下一次尝试的判据（"这张票对门没用，那我该找别的"），也是 §13 里"不等作家也能玩"的前提。

---

## 3. 行为契约（逐步）

沿用 `01 §3.1` 的五步骨架（解析 → 读取校验 → 落盘 → 落账 → 返回），`use_item_on` 展开为七步。**顺序不可换**；每步的"漏了会怎样"就是它存在的理由。

### 3.1 逐步

**第 1 步 · 解析两个路径。** 两者都过 `00 §2.1` 的路径纪律（世界根相对、POSIX `/`、无前导 `./`、无绝对路径、无保留前缀）。
*漏了会怎样*：`item: "../../etc/passwd"` 会跳出世界根，工具变成任意文件读取通道（`01 §7.3` 收紧后的 `resolvePath` 会拦，但动作层 MUST 先给出 `invalid_path` 而不是让 store 抛内部错误）。

**第 2 步 · 读 item，校验它存在、是文件、不是 README。**
*漏了会怎样*：不读就落事件，`detail.itemName` 只能猜文件名——而 `detail` 必须自足（`doc-21 §3.3`：世界会继续变，回读会拿到别的东西）。

**第 3 步 · 读 target，校验它存在。** 同步解析 frontmatter、取双方 `name`（`title`/`name` 字段，缺省用文件名 slug）、解析 target 的组件 kind（`10 §3.1` 的 `resolveComponentKind`）。
*漏了会怎样*：target 不存在时若直接落事件，作家下一轮会拿到一个指不到的路径；`doc-21` 准入第 2 问（不可推导）也过不了——"玩家对空气用了钥匙"不是世界变化。

**第 4 步 · 查 handler 并按需执行（§3.4）。** 用 **target 的 kind** 查注册表条目的 `handler`；有则调用；无则跳过（`handled=false`）。

**第 5 步 · 落账一条 `use_item_on`（无条件，成功路径上必落）。** 见 §5。**这里没有"handler 成功才落"的分支**——`doc-21:250` 明写："不论是否破例，事件照落"。

**第 6 步 · 组装 `details`（§6.1）与英文文本（§2.3）。**

**第 7 步 · 返回。** 工具壳（`extensions/toolkit/result.ts`）把它包成 pi-rp 的 `ToolResult`；C 入口（路由）包成 HTTP JSON。

### 3.2 与 `move` 的边界（最重要的一条"不做"）

`doc-20:289` 原文：*"调用本身不默认消耗或移动物件；若剧情需要消耗、交付或掉落，再显式调用 `move` 或编辑相应实体。"*

这条的直接推论：**`use_item_on` 的实现里 MUST NOT 出现 `store.move(...)`**。想实现"把信交给角色"，必须是两次调用：先 `use_item_on(item=letter, target=character)`（出示，作家/角色看见），作家再决定调 `move(letter → characters/<id>/)`（交付）。合并在一个工具里会让"出示"与"交付"再也分不开——而它们在世界里的语义完全不同（出示可以什么也不发生，交付必然改变持有关系）。

### 3.3 item 的合法性判据

**`item` MUST 指向一个存在、可读、单文件的 `*.md`，且文件名不是 `README.md`。**

这就是全部约束。**不额外加"必须是 note/letter"的类型白名单。** 理由：

| 论据 | 出处 |
|---|---|
| 引擎的语义是"文件"，不是"可拿物件"。加白名单会让题材包自造的组件（`10 §14.4` 的 `cipher` / `photo` / `anchor`）永远没法当 item 用。 | `00 §2.4` 的刻意放宽（"引擎的'移动'是文件语义，不能因为它认不出某个题材包组件就拒绝移动"）是同一条纪律，`use_item_on` 照抄 |
| 呈现层的可拖拽白名单是 `doc-10 E5` 的 `BAG_TYPES`（`note`/`letter`），那是**前端**；引擎层加第二份白名单 = 两份真相源 | `10 §13.1`（注册表是唯一真相源）、`00 §2.4` |
| 合伙演示需要"用一张地图当涂抹工具"这类越界玩法，白名单会把它挡在门外 | `doc-19` §3.1 的玩法精神 |

**约束的边界**：`item` 是 `README.md` → `invalid_path`（带一句 `A layer's README is its identity, not an item: "world/inn/README.md"`）。这是路径语义检查，**不是身份门禁**（`doc-20 §1.1` 明文：能力不按身份裁）。

### 3.4 handler 查找与契约

**查找键 = target 的 component kind**，与 item 的 kind 无关（钥匙开锁：锁是 target，查 `lock.handler`）。**查找 helper 是 `componentDefOf(kind)`**（`components/registry.ts:86`）——**不是** `getComponent(...)`：那一个是 `get_component` **工具动作**的名字（给模型看 schema），两者同名会误导。契约与 `10 §15.3` **逐字一致**（已 IRC 对齐），本文照抄并补两条纪律：

```ts
type UseItemOnHandler = (args: {
  item: EntityRef;      // { path, name, frontmatter }
  target: EntityRef;    // { path, name, frontmatter } ← 含已解析的 frontmatter（10 追加）
  actor: Actor;         // 00 §3
  store: WorldStore;    // 00 §4.1
  turn: string;         // 合并锚
}) => Promise<
  | { handled: true; summary?: string; details?: Record<string, any> }
  | { handled: false; reason?: string }
>;

interface EntityRef { path: string; name: string; frontmatter: Record<string, any>; body?: string }
```

> **`body?` 是实现期追加的**（`components/types.ts:42`）：`10 §15.3` 的示例 handler 要**原地重写文件并保留正文**（只改 `status.data.locked`），所以调用方把已读到的 body 一并传入；缺失时 handler 按空正文处理。这是对 `10 §15.3` 冻结形状的一次**加法**，字段名与语义同步写进 `10`。

**六条纪律（前四条与 `10 §15.3` 共同冻结，后两条是本文补的）**：

1. **按 target 的 kind 查找，绝不按 item 的 kind。**
2. **handler 只经 `store` 改世界**（`writeFileAtomic` / `appendEvent`），**绝不** `writer.prompt`、绝不发 WS 帧。理由：`00 §1` 硬约束（扩展不假设自己连着 WS）。
3. **`handled:false` 不是错误、不是静默降级。** 它是合法结果（"这东西对这门没用"）；事件照落，文本明说目标没有反应（§2.3 第二、三行）。
4. **`target.frontmatter` 必须传进去**——`lock`/`instrument`/`mechanism` 的 handler 要读当前 `status.data`（`locked` / `lid` / `position`）才能决定后果；不传就要再读一次盘，多一次 I/O 且可能读到半写文件。
5. **handler MUST NOT 调用其它动作函数，也 MUST NOT 创建 / 移动 / 删除实体。** 它唯一允许的世界改动是**重写 target 自己的 frontmatter**（典型：把 `status.data.locked` 改成 `false`），且 MUST 用 `store.writeFileAtomic`（`10 §4.3` 同款纪律）。
   - *为什么*：`doc-19:171` 原文是"引擎立即播放开锁动效与音效，**作家**接收到事件并触发剧情演化：门开启，生成通往地窖的新场景门卡"——新场景门卡是**作家**的活，不是 handler 的。
   - *还有一条时序理由*：若 handler 内部调 `writeChalk` 造门卡，那条 `entity_created` 会**先于** `use_item_on` 落表（§3.1 第 5 步在其后），作家的事件段就会先读到"门卡落成了"、再读到"玩家用了钥匙"——因果读反了。**handler 保持小，叙事后果保持是作家的。**
6. **handler 对 target 的改写不再额外落 `entity_edited`。** `use_item_on` 那一行就是这次改动的记录（§5.2 讨论 `effect` 字段）。否则一次开锁会产生两条事件，`doc-21 §5.4` 的合并规则会把它们拆开报，注入段出现"锁被打开过两次"的错觉。

**没有 handler 时怎么办**（`doc-20:90` 的另一半）：**只落事件，等作家下一轮回应**。`details.handled=false`、`reason` 为 `no_handler`（§7），文本按 §2.3 第二行。这不是"失败路径"，是**设计的一半**——`doc-20:90` 说后果"可以由作家响应事件后写作，**也可以**由组件扩展的确定性 handler 处理"，两句是并列的。

### 3.5 `accepts` 的定位：早筛与前端高亮，不是准入

`10 §15.2` 冻结了 `accepts`（`itemKinds` / `itemTags` / `any` / `hint`）与纯函数 `useItemTargetOf(targetKind, itemFm)`。本文的用法：

| 用途 | 谁用 | 语义 |
|---|---|---|
| **前端微光与微吸附** | 玩家 UI（`CardRenderer.tsx:122` 的 `puzzle-target-*`、`index.css:1479-1520`） | `candidate === true` → 卡发微光；`hint` 直接作 hover 文案 |
| **（可选）引擎侧不开销的早筛** | 本文可选实现 | 若 `accepts` 存在且明确不命中 → **不报错**，仍走完整流程（落事件、等作家）；只是英文文本多一句 `It has no effect on this.` |

**为什么 `accepts` 不做准入**：`10 §15.2` 明写 *"`candidate` 只是'可能是合法目标'，不是'一定成功'"*。把它当准入会造出一条静默拒绝路径（玩家拖了东西上去，世界毫无反应、事件表也没有），直接违反 `00` 反模式"失败不静默"。**玩家永远可以试，世界永远留下记录**——这是 open-world 玩法的底线，也是"尝试物理组合"（`doc-19:175`）的乐趣来源。

**但前端 MUST 用它做高亮**（`前端改造计划.md:260` 的 T2.4）：没有它，玩家不知道该往哪儿拖；合法目标全靠试是挫败而不是乐趣。`hint` 是"这里能放什么"的唯一提示渠道。

---

## 4. 文件与副作用

### 4.1 概览

| 副作用的来源 | 改什么 | 何时 |
|---|---|---|
| **`use_item_on` 本身** | **只写 `history.db` 的 `events` 表一行**。不建文件、不改文件、不碰 `canvas.db`。 | 每次成功调用 |
| **target 组件的 handler**（可选） | `writeFileAtomic(target)`，只改 target 自己的 frontmatter（典型 `status.data`） | 仅当 kind 有 handler 且判定命中 |
| **前端**（不由本工具驱动） | 微光 / 微吸附 / 开锁抖动（`puzzle-unlock-burst`） | 拖拽悬停与释放 |

**"`use_item_on` 本身不改文件"是刻意的**，它直接来自 §3.2 的 `doc-20:289`：不消耗、不移动。工具的写入面因此只有一行事件——这让它成为**最安全的玩家动作**（拖错一张卡不会有任何破坏性后果）。破坏性后果一律经 `move` / `edit`，那两者各有自己的引用重写与校验。

### 4.2 原子性

- handler 重写 target：`store.writeFileAtomic`（`01 §2.7` / `10 §4.3`），同目录临时文件 + rename，原文件在失败时未被触碰。
- 事件写入：`appendEvent` 内部 `BEGIN IMMEDIATE` + 两步 INSERT/UPDATE（`01 §3.2`），返回的是**已 COMMIT** 的 `seq`。
- **handler 落盘成功、`appendEvent` 抛错** → `ActionError('event_failed')`，**不回滚文件的改动**（`01 §3.6` 定案：不补偿、不写补偿事件）。这里的不一致后果是"锁开了但没记录"，比"锁开了一半"可修。

### 4.3 幂等性 — **没有**

同一对 `(item, target)` 连调两次会产生两条 `use_item_on`。**这是正确的**：

- 玩家"再试一次"是合法行为，世界必须留下两次尝试的记录（作家可能据此写"他又试了一遍，还是打不开"）。
- **幂等性由 handler 自己负责**：`lockHandler` 的第一句就是 `if (fm.status?.data?.locked !== true) return { handled:false, reason:'already_open' }`（`10 §15.3` 的示例）。第二次拖拽得到 `handled=false`，事件照落，文本说"门没有反应"——语义自洽。
- 真正的重复落地风险来自**网络层**（`前端改造计划.md:132` 的 T0.6：`/use-item` 与掷骰都会改状态，旧版本请求重放会"一把钥匙开两次锁"）。**修法在 T0.6（`expectedRevision` + 409），不在本工具**——工具层再加一层幂等键会与 T0.6 重复，且要引入一个"最近调用"内存态，违反 `00` 的"无状态文件"纪律。

---

## 5. 落账

### 5.1 `use_item_on` 事件全字段（冻结字段名取自 `00 §5.2` / `doc-21:178`）

```ts
{
  type: 'use_item_on',
  actor: { type: 'player' | 'writer' | 'character', id?: string },  // 00 §3；god/engine 不出现（§5.3）
  layer: await store.resolveLayer(target),   // 01 §3.9；player/** 与 characters/** → null
  subject: target,                            // 01 §4 表：use_item_on 的 subject 用 target
  turn: ctx.turn,                             // 合并锚（01 §3.7）
  detail: {
    item:       'player/copper-key.md',       // 世界根相对路径
    itemName:   'Copper Key',                 // **当时的名字**（doc-21 §3.3 自足）
    target:     'world/cellar/cellar-door.md',
    targetName: 'The Cellar Door',
    // —— 以下三键是本文对 00 §5.2 的**增量提议**（§11 冲突登记 #1）——
    targetKind: 'lock',                       // 组件 kind；未注册时 null。渲染模板据此选词
    handled:    true,                         // 确定性 handler 是否处理了
    effect:     'The lock opened.',           // handler 的 summary；无则 null。**不是正文**
  },
}
```

**四个字段名是冻结的**（`00 §5.2` / `doc-21:178`）：`item` / `itemName` / `target` / `targetName`。**顺序与命名 MUST 照抄**，因为事件渲染器按 `type` 注册、按这几个键取词（`doc-21 §3.5`：写入时存一句，三个读者里至少两个拿到别人的话）。

**人话模板（作家视角，`doc-21:178` 已有）**：「玩家把铜钥匙用在了地窖门上」。带增量字段后可以更准确：「玩家把「铜钥匙」用在了「地窖门」上——锁开了」。**没有 `effect` 时退回原模板**，所以增量字段是向后兼容的纯加法。

### 5.2 为什么加 `targetKind` / `handled` / `effect`

| 字段 | 不加会怎样 |
|---|---|
| `targetKind` | 渲染器只知道"一个东西被用于另一个东西"，说不清是开锁、投信还是落子。事件段的人话会退化成"玩家用了什么东西"——作家看不出该写什么反应。与 `10 §5.1` 给 `entity_created` 加 `component` 是同一个理由、同一种加法。 |
| `handled` | 作家无法区分"目标自己动了"与"目标没反应，该我写了"。这正是 `doc-12 #6`「下一步」段要的判据：`handled=true` 时作家只需**叙述后果**，`handled=false` 时作家必须**决定后果**。不给这个布尔，模型只能回读文件猜（违反 `doc-21 §3.3` 的自足纪律）。 |
| `effect` | handler 已经知道发生了什么（"锁开了"），不传出来就被丢掉，作家要重新 `look_at` 一次 target 才知道。**它至多一行，不是正文**（`00 §5.2` 的"不存正文"仍然成立）。 |

**这三个字段都是可选增量**：`00 §5.2` 的四个冻结字段一字不改，新增键不破坏任何既有渲染器。登记在 §11。

**`reason` 只进 `details`，不进事件 `detail`**：事件 `detail` 保持上面这四键 + 三个可选增量键（`targetKind` / `handled` / `effect`）；handler 的拒绝原因码（`reason`）只出现在 `details.reason`（§6.1/§7.2），**不写进事件**（§11 冲突登记 #1 的增量不含 `reason`）。

### 5.3 actor 的取值

| 入口 | `actor` | 理由 |
|---|---|---|
| 玩家拖拽（C） | `{ type: 'player' }` | `01 §3.7` 的 C 入口定式 |
| 作家 / 角色（A） | `resolveAgentActor(AIRP_AGENT_ROLE)`（`01 §2.3`） | 不按身份裁能力（`doc-20 §1.1`） |
| 上帝模式 | **不走本工具** | 上帝改的是文件本身，用 `edit` / `god-action` 落 `entity_edited` + `actor_type: god`（`doc-21 §4.6`）。给 `use_item_on` 造 `god` 分支等于给"身份×动作"的叉乘又开一列，`doc-21 §0` 定案 3 明确退役了这种做法。 |

### 5.4 失败时不落账

`doc-21:141` / `00 §5.2`：工具返回 `isError` 时不落事件。`use_item_on` 的失败路径（item 不存在、target 不存在、路径非法、handler 抛错）**一条都不落**。这与"`handled:false` 照落"不矛盾：`handled:false` 是**成功调用**（世界多了一条"某人试过"的事实），不是失败。

---

## 6. WS / 前端

### 6.1 `details` 带什么（稳定契约，`01 §11.2`）

```ts
details: {
  item, itemName, target, targetName, targetKind,
  handled, effect, reason,
  event,                    // WorldEvent（01 §2.2）—— 与 details 同源，前端按 event.id 去重
  /** 演出提示：前端拿到后播什么（§6.3）。由动作层给，不由前端猜。 */
  presentation: {
    foley: 'unlock' | 'paper-slide' | 'none',   // 复用 lib/audio.ts 的 FoleyName
    burst: 'unlock' | 'present' | 'none',
  },
}
```

`presentation` 的两项映射规则：

| `handled` | `targetKind` | `foley` / `burst` | 呈现 |
|---|---|---|---|
| `true` | 任意 | `unlock` / `unlock` | 咔哒音 + 目标卡抖动 + 内容物幻影落地（`前端改造计划.md:261`、`index.css:1504` 的 `puzzle-unlock-burst`） |
| `false` | 角色类（`characters/<id>/README.md` 或画布 sprite） | `paper-slide` / `present` | 出示拟音 + 目标轻微前倾（`doc-19:172-174` 的"出示证据"） |
| `false` | 其它 | `none` / `none` | **不播**（§6.3 的降级纪律） |

### 6.2 两条通道，各自的路

`01 §11.1` 的两条通道在本工具的落点：

```
① 演出帧（瞬时）  details.presentation + details.event
                  → pi-rp rpc-mode 把 `tool_execution_end` 原样写到 stdout（`modes/rpc/rpc-mode.ts:528-530` 的 `session.subscribe` + `toJsonEvent`；`modes/json-event.ts:31-33` 证明非 `message_update` 的事件原样返回，`result.details` 不被剥掉）
                  → server `RpcClient.onEvent`（`engine/lifecycle.ts:77`）→ `event-bridge.mapEngineEvent`（`event-bridge.ts:71-92`，现已在 `tool_execution_end` 分支读 `event.result`）→ WS
② 世界事件（历史）appendEvent 写 history.db
                  → server 尾部读表（00 §5.3）→ WS { type: 'world_event', event }
```

**`use_item_on` 不新造帧名。** 现状 `routes/world.ts:411` 广播 `{ type: 'use_item_on', event }`，与 `01 §13` 冲突 6 / `00 §5.3` 的纪律（帧名与事件 type 不共用一个命名空间）冲突。**定案：删掉这个裸帧，全部走 `world_event`。** 理由：它是"世界变化"的一个 copy，不是演出；演出的部分（音效 + 抖动）由前端在 `world_event` 上驱动，前端已经有 `event.detail.handled` 与 `targetKind` 足以选演出（`useWorld.ts:209` 现在把这帧 `ignored`）。

> 这一条要 `12` 落：`routes/world.ts:411` 的 `eventBridge.broadcast({ type: 'use_item_on', event })` 删除；`event-bridge.ts` 不需要 `use_item_on` 特判（`world_event` 尾部读表会自动带出）。前端 `useWorld.ts` 的 switch 加一支 `world_event` → 按 `event.type === 'use_item_on'` 触发 `airp:item-applied` 自定义事件。

### 6.3 前端拿到后演什么

**链路（现状，`App.tsx:156-178`）**：`RightSidebar.tsx:79-93` 在 `dragstart` 派 `airp:item-drag-start` → `CardRenderer.tsx:97-110` / `CanvasObject.tsx:95-106` 据此给所有目标加 `puzzle-target-ready`（微光）→ 目标的 `dragOver` 加 `puzzle-target-hover`（微吸附 + 抬起 4px，`index.css:1495`）→ `drop` 时 `playFoley('unlock')`（`CardRenderer.tsx:114`）+ `puzzle-unlock-burst` + `POST /api/use-item`（`App.tsx:161`）。

**要改的三处（归前端，本文只定契约）**：

1. **微光必须只给合法目标**，不能像现在这样给所有卡（`CardRenderer.tsx:97-110` 现在对每张卡都加 `puzzle-target-ready`）。判据 = `10 §15.2` 的 `useItemTargetOf(targetKind, draggedItemFm)`；`hint` 作 `title`。
2. **`playFoley('unlock')` 移出 `drop` 同步路径**：现在无论成败都播开锁音（`CardRenderer.tsx:113-119`；sprite 分支 `CanvasObject.tsx:108-117` 只播抖动音不播拟音，同样无条件），结果是"用错东西也有咔哒声"，等于对玩家撒谎。改为 **drop 时先不播**，拿到响应后按 `details.presentation` 播（§6.1）。
3. **失败也要有反馈**：`App.tsx:170-174` 现在只在 `data.ok` 时 `showToast`。失败时应显示 §2.3 的文本（它是给人话的，`doc-03` 的"人话"哲学）。

**离线降级（`00` 反模式"不许静默"的镜像）**：若 `details.presentation` 缺失（旧 server / 旧扩展），前端退回"只播默认解锁音"并保持可见的成功／失败提示，**不装作什么都没发生**。

---
## 7. 错误与边界

### 7.1 失败模式与精确文案（英文，`01 §7.2` 的风格：每条带具体路径/参数值）

| 情形 | `ActionErrorCode` | HTTP（`01 §7.1`） | 文案 |
|---|---|---|---|
| `item` 空串 | `invalid_argument` | 400 | `"item" must be a world-relative path, got an empty string` |
| `target` 空串 | `invalid_argument` | 400 | `"target" must be a world-relative path, got an empty string` |
| 路径绝对 / `..` / 保留前缀 | `invalid_path` | 400 | （`01 §7.2` 的既有文案，逐字复用） |
| `item` 是目录 | `invalid_path` | 400 | `use_item_on takes a single .md file as "item", got a directory: "player"` |
| `item` 是 `README.md` | `invalid_path` | 400 | `A layer's README is its identity, not an item: "world/inn/README.md"` |
| `target` 是目录 | `invalid_path` | 400 | `use_item_on takes a single .md file as "target", got a directory: "world/inn"` |
| `item` 不存在 | `not_found` | 404 | `Item not found: "player/copper-key.md"` |
| `target` 不存在 | `not_found` | 404 | `Target not found: "world/cellar/cellar-door.md"` |
| `item` 无 frontmatter（裸 md） | **不报错** | — | 裸 md 是合法的 `note`（`forms.ts:54` 的兜底，`10 §3.1` 同口径）；`itemName` 用文件名 slug |
| target 无 frontmatter | **不报错** | — | 同上；`targetKind` 用 `resolveComponentKind` 的兜底（`note` 或 `null`） |
| `handled:false`（无 handler） | **不报错** | 200 | 正常返回，`details.handled=false` / `reason='no_handler'` |
| `target` 声明了 `type: component` 但缺 `component` 字段 | **不报错** | — | `targetKind = null`。这确实是 `malformed_entity` 的候选，但 `use_item_on` 的职责是"记录一次施加"，不是校验目标结构（归 `look_at` / `edit`）。**登记为 §12 待确认项** |
| handler 抛异常 | `internal` | 500 | `The target's handler for "world/cellar/cellar-door.md" failed: <msg>`，**不落事件** |
| 落盘失败（handler 写 target） | `write_failed` | 500 | `Failed to write "world/cellar/cellar-door.md": <msg>`，**不落事件** |
| 落盘成功、`appendEvent` 抛错 | `event_failed` | 500 | `File was written but the world event could not be recorded`（`01 §3.6` 原文） |

### 7.2 `reason` 的封闭枚举（`details.reason`）

```ts
type UseItemOnReason =
  | 'no_handler'      // target 的 kind 没有注册 handler（纯叙事目标）
  | 'wrong_item'      // handler 判定"这东西对它没用"
  | 'already_open'    // handler 判定"已经做过了"
  | 'not_ready'       // handler 判定"时机/前置条件不满足"
  | string;           // handler 自造的原因码（开放，但 SHOULD 用前四个）
```

前四个是**引擎/REC 注册表层面的通用原因**，渲染器可以给它们固定的人话（"门锁纹丝不动" / "门已经开了"）。自造码渲染器退化为"没有反应"。**登记为 §11 的增量提议**（是否需要封闭，请评审拍板）。

### 7.3 边界情形

| 情形 | 结果 | 理由 |
|---|---|---|
| `item === target` | **允许**，不特殊处理 | "把钥匙用在钥匙上"是玩家自由；handler 自然返回 `wrong_item`。加 `item === target` 检查是多余的规则 |
| `item` 与 `target` 都在背包（`player/`） | 允许；`layer = null`（`01 §3.9`） | 背包内互动不发生在任何层；角色侧窗口看不到（`doc-22 §3.2`：角色不注入 bag） |
| `item` 在背包、`target` 在层里 | 允许；`layer = resolveLayer(target)` | **主力场景**（钥匙在背包、门在场景） |
| `item` 在层里、`target` 在另一层 | 允许；`layer = resolveLayer(target)` | 跨层使用不禁止；`doc-20 §1.1` 能力不按身份/位置裁 |
| `target` 是角色呈现 | 允许 | L2 的"出示证据"（`doc-19:172-174`）；`doc-06:265` 明写 NPC 头像是合法落点 |
| `target` 是门牌 `README.md` | 允许 | `doc-06:265` 的"门"；取决于 `10 §13.3` 是否给 `gate` 配 handler（§11 冲突 #3） |
| `target` 是 `chalk` | 允许 | 玩家拿颜料涂黑板这类玩法；无 handler → 作家回应 |
| 世界冻结（`worldFrozen`） | **仍然允许，照落事件** | 冻结是上帝模式的"别写"，挡的是 agent 的写入，不是玩家的尝试。`doc-21` 没有冻结语义 |
| 并发：同一对 `(item,target)` 两个请求 | 两条事件，后写者赢（handler 层） | `01 §7.3` 的定案：不加锁；网络层去重归 T0.6 |

---
## 8. 要实现/修改的代码落点

### 8.1 新建：动作函数（`packages/shared/src/actions/use-item.ts`）

```ts
export interface UseItemOnInput { item: string; target: string }
export interface UseItemOnDetails { /* 见 §2.2 */ }

export async function useItemOn(
  ctx: ActionContext,
  input: UseItemOnInput
): Promise<ActionResult<UseItemOnDetails>>;
```

内部结构（精确到函数）：

```ts
// 1. 校验与读取
assertEntityPath(input.item,   'item');     // → invalid_path / invalid_argument
assertEntityPath(input.target, 'target');
const itemRaw   = await ctx.store.readFile(input.item);      // 抛 → not_found
const targetRaw = await ctx.store.readFile(input.target);
const itemFm    = parseFrontmatter(itemRaw);
const targetFm  = parseFrontmatter(targetRaw);

// 2. 解析名字与 kind（纯函数，可单测）
const itemRef   = toEntityRef(input.item,   itemFm);
const targetRef = toEntityRef(input.target, targetFm);
const targetKind = resolveComponentKind(targetFm.frontmatter, basename(input.target));

// 3. 查 handler —— 按 target 的 kind（§3.4 纪律 1）
const handler = getComponent(targetKind)?.handler ?? null;
let outcome: HandlerOutcome = { handled: false, reason: 'no_handler' };
if (handler) {
  try { outcome = await handler({ item: itemRef, target: targetRef,
                                 actor: ctx.actor, store: ctx.store, turn: ctx.turn }); }
  catch (err) { throw new ActionError({ code: 'internal', message: `The target's handler for "${input.target}" failed: ${msg(err)}` }); }
}

// 4. 落账（无条件，§3.1 第 5 步）
const event = await ctx.store.appendEvent({
  type: 'use_item_on',
  actor: ctx.actor,
  layer: await ctx.store.resolveLayer(input.target),
  subject: input.target,
  turn: ctx.turn,
  detail: { item: input.item, itemName: itemRef.name,
            target: input.target, targetName: targetRef.name,
            targetKind, handled: outcome.handled,
            effect: outcome.handled ? outcome.summary ?? null : null },
});

// 5. 返回
return { text: renderText(itemRef, targetRef, outcome, targetKind),
         details: { item: input.item, itemName: itemRef.name, target: input.target,
                    targetName: targetRef.name, targetKind,
                    handled: outcome.handled,
                    effect: outcome.handled ? (outcome.summary ?? null) : null,
                    reason: outcome.reason ?? null,
                    presentation: pickPresentation(outcome, targetKind), event } };
```

三处纯函数抽出来单测（§10.1）：`assertEntityPath`（路径纪律）、`toEntityRef`（名字解析）、`pickPresentation`（`handled` × `targetKind` → 呈现）。

### 8.2 新建：扩展工具壳（`extensions/toolkit/use-item.ts`）

```ts
export const useItemOnTool: ToolDefinition = {
  name: 'use_item_on',
  label: 'Use Item On',
  description: 'Apply one item to another entity: a key to a lock, evidence to a character, a '
    + 'brush to a canvas. Records the attempt as a world event; the item is NOT consumed or moved '
    + '(call move for that). The target reacts only if its component kind defines a handler; '
    + 'otherwise the writer narrates the outcome on the next turn.',
  parameters: Type.Object({
    item:   Type.String({ description: 'World-relative path of the item, e.g. "player/copper-key.md"' }),
    target: Type.String({ description: 'World-relative path of the target entity, e.g. "world/cellar/cellar-door.md"' }),
  }),
  promptSnippet: 'Apply an item to a target entity (key to lock, evidence to a character)',
  promptGuidelines: [
    'Use use_item_on when one thing in the world is applied to another; use choose when a single entity offers its own public actions.',
    'use_item_on never consumes or moves the item — call move separately if the story needs the item handed over.',
  ],
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    const store = openWorldStore(ctx.cwd);                       // extensions/toolkit/store.ts
    const actor = agentActor();                                  // extensions/toolkit/actor.ts
    const turn  = currentTurnAnchor(ctx);                        // 01 §3.7
    try {
      const result = await createActionService(store, actor, { turn }).useItemOn(params);
      return ok(result);                                         // extensions/toolkit/result.ts
    } catch (err) { return fail(err); }
  },
};
```

英文、按 `doc-23 §2` 写（给判据、点名工具名、写清"何时别用"）。**注册归 `12`**（`extensions/tools.ts` 里 `pi.registerTool(useItemOnTool)`）。

### 8.3 修改：路由（`apps/server/src/routes/world.ts`）

**`/use-item`（现状 `:399-418`）改为复用动作服务**（`plan §4` 的"先在 `packages/shared`/server 抽出一套调用者无关的动作服务"、`00` 反模式"在 Express 路由里另写一套规则"）：

```ts
router.post('/use-item', async (req, res) => {
  const store = getActiveStore();
  if (!store) return res.status(400).json({ error: 'No active world' });
  const turn = `req:${randomUUID()}`;                       // 01 §3.7 的 C 入口锚
  try {
    const { item, target } = req.body;                      // 字段名改了：旧的是 itemPath/targetPath/targetType
    const svc = createActionService(store, { type: 'player' }, { turn });
    const result = await svc.useItemOn({ item, target });
    res.json({ ok: true, ...result.details });              // 形状兼容旧前端：ok + effect
  } catch (err) {
    if (err instanceof ActionError) return res.status(err.httpStatus).json(err.toHttp().body);
    res.status(500).json({ error: String(err) });
  }
});
```

**删掉**：`:405` 的裸 `appendWorldEvent('use_item_on', {...})`（旧五列 API，`01 §2.5` 已整体重写）、`:411` 的 `eventBridge.broadcast({ type: 'use_item_on', event })`（§6.2）。

### 8.4 修改：注册表（`packages/shared/src/components/`，归 `10`）

`10 §13.1` 的 `ComponentDef` 已有 `accepts?` 与 `handler?`。本文对 `10` 的**唯一请求**是：`lock` / `container` / `trap` / `mechanism` / `cipher` / `instrument` / `board` / `clock` / `anchor` / `photo` / `letter` 这 11 个 kind（`10 §14.4` 标 `use_item = 是` 的行）MUST 至少声明 `accepts`（前端高亮需要它）；其中 `lock` MUST 有 handler（doc-19 的核心演示）。**不新增字段、不改 `ComponentDef` 形状。**

### 8.5 修改：前端（归 `前端改造计划.md` T2.4）

| 文件 | 改动 |
|---|---|
| `apps/web/src/components/canvas/CardRenderer.tsx:97-118` | 微光改用 `useItemTargetOf`（§6.3-1）；`playFoley('unlock')` 移出 drop（§6.3-2） |
| `apps/web/src/components/canvas/CanvasObject.tsx:95-117` | 同上（sprite 分支：微光 + `handleSpriteDrop` 的无条件抖动） |
| `apps/web/src/App.tsx:156-178` | body 字段名改 `item`/`target`；失败也显示文本（§6.3-3）；按 `details.presentation` 播 |
| `apps/web/src/state/useWorld.ts:167-209` | switch 加 `world_event` → `use_item_on` 分支（§6.2） |

---
## 9. 与现存实现的差异

### 9.1 逐项对照（现状带 `文件:行`）

| 位置 | 现状 | 要改成 |
|---|---|---|
| `packages/shared/src/actions/` | **不存在**（目录尚未创建，`ls` 零命中） | 新建 `use-item.ts`（§8.1）；骨架归 `01` |
| `extensions/` | 只有 `instructions.ts`（4 个 slot），**没有任何 `registerTool`** | 新建 `toolkit/use-item.ts` + `tools.ts` 注册（`12`） |
| `apps/server/src/routes/world.ts:399-418` | `/use-item` 只 `appendWorldEvent('use_item_on', { itemPath, targetPath, targetType })`，**无存在性校验、无 handler、字段名带 `Path` 后缀** | 复用 `useItemOn`（§8.3）；字段名归一为 `item`/`target` |
| `routes/world.ts:411` | 广播裸帧 `{ type: 'use_item_on', event }` | 删除，走 `world_event`（§6.2） |
| `packages/shared/src/schemas/events.ts:5` | `WorldEventType` 含 `use_item_on`（9 个旧类型之一） | 整体重写为 15 个（`01 §2.5`）；`use_item_on` 保留（`00 §5.2`） |
| `apps/web/src/App.tsx:161-169` | 发 `{ itemPath, targetPath, targetType: 'card' }` | 发 `{ item, target }`（§8.5） |
| `apps/web/src/components/canvas/CardRenderer.tsx:97-118` | 拖起时**所有**卡都加 `puzzle-target-ready`；drop 即播开锁音 | 只给合法目标高亮；音效/抖动由响应驱动（§6.3） |
| `apps/web/src/state/useWorld.ts:209` | `use_item_on` 帧被 `ignored`（`break` 注释明写） | 消费 `world_event`（§6.2） |
| `docs/doc-06-演出与交互设计.md:265` | 派发名写作 `player_used_item_on_target` | 统一为事件 type `use_item_on`（`doc-21 §4.6` 已退役这类身份×动作名） |
| `docs/doc-19:165-169` | 派发名写作 `{ type: "player_action", action: "use_item_on" }` | 同上；前端 → 路由 → 动作函数 → 事件表，只有最后一个名字进世界 |

### 9.2 迁移影响（旧调用点）

| 调用点 | 影响 |
|---|---|
| `apps/web/src/App.tsx`（唯一前端调用点） | 字段名改 `item`/`target`；**同一 commit 里改**，否则工具报 `invalid_argument` |
| `apps/server/src/routes/world.ts` | 见 §8.3 |
| `apps/web/dist/**`（构建产物） | 无关（`pnpm build` 重生成） |
| 任何文档提到 `player_action` / `targetType` | 按 §9.1 统一；**不保留别名**（`00` 反模式：不留 shim/alias/deprecated path） |

---
## 10. 验收与测试

### 10.1 纯函数单测（无 I/O，`packages/shared` 现有测试风格）

| 目标 | 判据 |
|---|---|
| `assertEntityPath` | 空串 → `invalid_argument`；`/etc/passwd` → `invalid_path`；`a/../b` → `invalid_path`；`.airpworld/x.md` → `invalid_path`；`player/key.md` → 通过 |
| `toEntityRef` | `title` 优先；无 title 用 `name`；都无则文件名 slug（`copper-key`） |
| `pickPresentation` | `handled:true` → `unlock`/`unlock`；`handled:false` + 角色 target → `paper-slide`/`present`；`handled:false` + 普通 target → `none`/`none` |
| `renderText` | 三分支各一条：带 `effect` / 无 effect / handler 拒绝；**每条都含双方路径**（`00 §6.2`） |
| handler 查找 | **按 target kind 命中**：`item` 是 `lock`、`target` 是 `note` → 不命中 `lockHandler` |
| `detail` 组装 | 四个冻结字段存在；`handled:false` 时 `effect === null` |

### 10.2 store 单测（临时目录 + 真 SQLite）

| 场景 | 判据 |
|---|---|
| 无 handler 的 target | `details.handled === false` 且 `history.db` **多一条** `use_item_on`，`detail.itemName`/`targetName` 非空 |
| 有 handler 且命中（`lock`） | target 文件的 `status.data.locked` 变 `false`；`use_item_on.detail.handled === true`；**事件表只多这一条**（不多 `entity_edited`，§3.4 纪律 6） |
| handler 返回 `handled:false` | 事件照落、target 文件**字节不变** |
| handler 抛异常 | 抛 `ActionError('internal')`；事件表**不变**；target 文件**不变** |
| `item` 不存在 | 抛 `not_found`；事件表不变 |
| `layer` 取值 | `player/key.md` + `world/inn/lock.md` → `layer === 'world/inn'`；双方都在 `player/` → `layer === null` |
| `item` 不被移动 | 调用前后 `player/copper-key.md` 仍存在且内容一致（`doc-20:289` 的断言） |

### 10.3 探针 / 手测（端到端）

1. **`tools/probe-writer.mjs` 扩展**：作家调 `use_item_on({item:'player/old-boat-ticket.md', target:'world/baker-street/README.md'})` → 断言 `history.db` 里一条 `use_item_on`，`actor_type='writer'`，`turn` 形如 `turn:<session>:<n>`，`detail` 四个字段齐。
2. **HTTP**：`POST /api/use-item {item:'nope.md', target:'x.md'}` → **404** `not_found`，且 `history.db` 行数不变（失败不落）。
3. **HTTP 成功**：`POST /api/use-item {item:'player/old-boat-ticket.md', target:'world/baker-street/evening.md'}` → 200，响应含 `handled`；WS 收到 `{type:'world_event', event:{type:'use_item_on'}}`，**且没有第二个 `use_item_on` 裸帧**（§6.2 的断言）。
4. **money shot 手测**：造一个 `lock` 组件的门（`templates/holmes-world/world/**/cellar-door.md`，`status.data.locked: true`），把 `player/copper-key.md`（`type: note`、`tags: [key]`）拖上去 → 咔哒音 + 卡片抖动 + `locked` 变 `false` + 事件表一条 `handled:true`。**这一条通过 = doc-19 §3.1 的核心玩法成立。**
5. **反例手测**：把同一把钥匙拖到 `evening.md`（`chalk`，无 handler）→ 无音效、无抖动、世界不变、事件表一条 `handled:false`；作家下一轮应能读到这条并回应。
6. **不打断手测**（§13）：作家正在 writing 时拖钥匙上锁 → **作家当前轮不被打断**（`writer_delta` 不中断、不重开），锁的 handler 结果即时可见；随后玩家发一句话 → 作家下一轮的注入段里应包含这条 `use_item_on`（`doc-12:32` 的「未回应」判据），且文案与 `handled` 一致。

### 10.4 评审可读性判据

`01 §5` 的方法表第 11 行（`useItemOn` / `use-item.ts` / `{item,target}` / `use_item_on`）与本文 §2.2/§8.1 **逐字对齐**。`10 §15` 与本文 §3.4/§3.5 **逐字对齐**。三处任何一处漂移 = 闭环性不过。

---
## 11. 发现的冲突 / 需要修订的上位文档

> 按 `00 §0`：不在本文私改上位文档，只登记，评审统一裁决。

### 11.1 冲突表

| # | 哪两份 | 哪一句 / 哪里 | 为什么矛盾 | 建议怎么改 |
|---|---|---|---|---|
| 1 | `00 §5.2` / `doc-21:178` vs 本文 §5.1 | 冻结的 `use_item_on.detail` 只有 `{ item, itemName, target, targetName }` | 缺 `handled` 时作家无法区分"目标自己动了"与"该我写"（`doc-12 #6` 的「下一步」段要这个判据）；缺 `targetKind` 时人话渲染说不清是锁还是信 | **纯增量**：`00 §5.2` 该行补 `targetKind?` / `handled?` / `effect?`，并给一条带增量的渲染模板。不影响既有渲染器 |
| 2 | `doc-21 §3.6` / `01 §3.6` vs handler 的写盘 | "工具返回 `isError` 时不落事件" | handler 抛异常时**事务边界在哪**没说清：handler 可能已经改了 target 的一半 | **不需改上位文档**：本文 §3.4 纪律 5 把 handler 限制为"一次 `writeFileAtomic`"，原子写保证要么全成要么全不成；抛错时事件不落，符合 `doc-21`。登记为**已收口**，供评审确认 |
| 3 | `doc-06:265` / `前端改造计划.md:260` vs `10 §13.3` | doc-06 把"门"列为合法目标；`10 §13.3` 定"`gate` 由 README 派生、不进注册表" | 注册表没有 `gate` 条目 → 没有 `accepts`、没有 `handler` → 钥匙开地窖门只能走作家（`handled:false`），而 `doc-19` 的 money shot 期望"引擎立即播放开锁动效"（`doc-19:171`） | 两条路任选：**(a)** `10` 允许 `gate` 带一个 `accepts`+handler（把 lock 语义挂在门牌上）；**(b)** 承认"能开的门是 `lock` 组件卡，门牌只是走去下一层的路"，并在 `doc-19:161` 的示例里把【锁住的地窖门】明确写成 `lock` 组件。**本文推荐 (b)**：README 是层的身份（`00 §2.4` 不可移动），给它挂玩法会同时违反"门的点击语义"（`doc-10 E4`：gate 点击 = 进门） |
| 4 | `doc-06:265` vs `doc-19:165-169` | doc-06 派发名 `player_used_item_on_target`；doc-19 派发 `{ type:"player_action", action:"use_item_on" }` | 同一个动作两个名字，且都是"帧名"而非事件 type | 统一到 `doc-21 §4.3` 的 `use_item_on`（`doc-21 §4.6` 已退役 `agent_speech`/`god_action` 这类命名）。建议两份文档各补一句指回 `doc-21` |
| 5 | `routes/world.ts:405` vs `00 §4.2` | 路由用旧 API `appendWorldEvent('use_item_on', {...})`，payload 键是 `itemPath`/`targetPath`/`targetType` | 旧五列 API 已被 `01 §2.5` 整体替换；键名与 `doc-21:178` 的冻结字段名不符（差 `Name` 后缀与 `Path` 后缀） | 本文 §8.3 已给改法；归 `12` 执行（`00` 反模式：路由 MUST 复用动作服务） |
| 6 | `00 §5.2` 的 `kind` 枚举 vs `targetKind` | `entity_created.detail.kind` 是 `"chalk"\|"component"\|"note"\|"letter"\|"other"` | 本文的 `targetKind` 是注册表 key（`lock`/`letter`/`note`…），与那五个值**不是同一个枚举** | **不是冲突**：`targetKind` 是新增字段、名字也不同（`targetKind` vs `kind`），不复用那个枚举。`10 §5.1` 给 `entity_created` 加 `component` 时用的是同一种"新字段"手法 |
| 7 | `doc-20 §10` vs `doc-21 §3` | doc-20 §10 说事件带 `{ actor, action, target?, createdAt }` | `doc-21 §0` 定案 3 退役了 `action`（按"发生了什么"分类）；`target` 即 `subject` | 与 `01 §13` 冲突 2 同源，**不重复登记**；本文的环境是 `doc-20 §8` 的签名（那一条是对的），§10 的字段名归 `01` 的登记 |

### 11.2 对 `10` 的四条确认（已 IRC 对齐，供评审留档）

1. handler 参数形状逐字一致：`{ item, target, actor, store, turn }`，`EntityRef = { path, name, frontmatter }`。
2. 顺序一致：resolve → validate → **handler** → append event（`use_item_on` 永远在 handler 之后、只落一次）。
3. `accepts` 与 `handler` 的解耦一致：只有 `accepts` 没有 `handler` 是合法配置（纯叙事目标），`details.handled === false`。
4. **handler 的写入面以本文 §3.4 纪律 5 为严**（唯一允许的世界改动是重写 target 自己的 frontmatter，用 `store.writeFileAtomic`）；`10 §15.3` 已改为与本条一致。

**本文不向 `10` 索要任何新字段。** 唯一请求见 §8.4（哪些 kind 至少要声明 `accepts`）。

---
## 12. 仍然未知 / 留给评审拍板的

| # | 未知 | 影响 | 本文倾向 |
|---|---|---|---|
| 1 | **§13 的 `followUp` 是否破例**（`plan §11 #4` 的待拍板项） | 决定 doc-19 money shot 的即时性；影响 `no_handler` 场景的体验 | **不破例**，但**用"writer busy 时的可见性设计"补足**——完整论证见 §13。**这是本文最需要拍板的一条。** |
| 2 | `reason` 是否要封闭枚举（§7.2 的前四码） | 影响渲染器能否给固定人话 | 倾向**封闭前四码 + 允许自造**（现在已是这个形状）；若评审要完全封闭，handler 作者就得改注册表才能加原因 |
| 3 | `effect` 的一行长度上限？ | 事件段 token 预算 | 建议 **≤120 字符**（与 `doc-10 E6` 的"每条 ≤90 字"、`doc-21 §3.3` 的"至多一行摘要"同量级）；实现时 `slice`，不报错 |
| 4 | 是否给 `chalk` 作 target 也配 handler？ | "颜料涂到画布"（`doc-20:287` 的三个例子之一）现在只能走作家 | 倾向**不配**：chalk 的语义是叙事正文，机械改写正文 = 第二个作者。让作家写 |
| 5 | 前端"合法目标"是按 `accepts` 还是按"有 handler"？ | 前者包含纯叙事目标（会亮但不会动），后者范围更窄 | **按 `accepts`**（§3.5）：玩家"能试"比"注定成功"更符合 `doc-19:175` 的玩法精神；`hint` 文案负责管理期望 |
| 6 | 角色 agent 调 `use_item_on` 时要不要通知目标角色进程？ | "把证物推给 Watson"是否该让 Watson 的 agent 立刻反应 | **不在 B1**：角色只在玩家直聊会话中行动（`doc-20 §1.2`、`plan §11 #7` 明确不抄递话筒）。落事件即可，Watson 下次被点开时会读到（`doc-21 §5.2`） |
| 7 | `targetKind` 对未注册 target（裸 md / 裸 `type: component` 但无 kind）取什么值 | 影响 `pickPresentation` 的分支 | 倾向 **`null`**（不是 `'note'`）：`null` = "引擎不认识它"，与"它就是一种 note"是两件事；前端对 `null` 退回不播 |
| 8 | 玩家一次拖拽被拆成多个 `use_item_on`（多选拖）时怎么合并 | 事件段会出多条 | `doc-21 §5.4` 规则 1（同 `turn` + 同 `type` + 同 `actor` 合并计数）已覆盖 → "玩家试了 3 次"；**不需要新机制**，登记为已答 |
| 9 | `target` 声明 `type: component` 却缺 `component` 字段时，该报 `malformed_entity` 还是静默 `targetKind=null`？ | 影响"坏组件"是否被早发现 | 倾向**静默**（§7.1）：本工具的职责是记录施加，不是校验结构；早发现应归 `look_at` / `edit`。若评审要求 fail-loud，改 `malformed_entity` 即可，代价是"对一张坏卡用钥匙"会报错而不是留下事件 |

---

## 13. 取舍登记：`use_item_on` 是否用 `followUp` 即时打断作家（`plan §11 #4`）

> **这是本文最重要的产出。** `plan §11` #4 原文：
> *"`use_item_on` 是否即时打断作家 —— **待拍板**。它是 doc-19 的 money shot（拖钥匙开锁要立刻有回应），"不打断"的定案在这里可能需要一个明写的例外。倾向：`use_item_on` 走 `followUp`（等作家当前轮结束再接），既不打断也不用等玩家再打一次字。"*

### 13.1 先厘清"打断"到底指什么

这个题里混着三件不同的事，必须拆开（拆不开就会得出"要么打断要么卡"的假两难）：

| 层 | 谁在做 | 延迟 | 是否需要破例 |
|---|---|---|---|
| **① 即时反应** | **前端 + handler**（音效、抖动、`status.data.locked` 变化、卡片幻影落地） | **<100ms，同步** | **不需要。** 这条链完全不经作家 |
| **② 落账与广播** | 动作函数 → `history.db` → server 尾部读表 → `world_event` | ~150ms–1s（debounce + 轮询） | **不需要。** `doc-21:250` 明写"不论是否破例，事件照落" |
| **③ 叙事后果**（"门后是一段向下延伸的石阶……"） | 作家 agent 的一轮 | **一个 turn**（当前轮剩余 + 下一轮排队） | **这才是"即时 vs 不打断"真正在争的东西** |

`plan §11 #4` 说的"拖钥匙开锁要立刻有回应"，**在①已经满足**。争的是③：作家该不该为了这次开锁立刻起一轮。

> **注意措辞**：本节此后称这三件事为**①/②/③**；三个**方案**才是"选项 A/B/C"（§13.3）；而"A 入口 / C 入口"是第三套字母，指 `01 §4.2` / `doc-21 §2` 的**三个落账入口**（动作层工具 / `tool_result` hook / 玩家 UI 路由）。三套不要混读。

### 13.2 定案前的机械事实（源码级，决定选项的可行域）

`followUp` 不是"温和版打断"，它有精确语义：

| 事实 | 证据 |
|---|---|
| `followUp` = 排进 follow-up 队列，**只在 agent 本来要停下时才被取出**（"After the agent would otherwise stop"） | `vendor/pi-rp/packages/agent/src/agent-loop.ts:262-268`：`agent_end` 前才 `getFollowUpMessages()`；`vendor/pi-rp/packages/agent/src/agent.ts:288-290` |
| 队列在每轮结束前被 `_handlePostAgentRun` 检查，`hasQueuedMessages() === true` 会 `continue()` 再跑一轮 | `core/agent-session.ts:1953-1954`、`:1962-1964` |
| **它是 agent 进程内的 API**，不是 server 侧能"发一条消息就算"的东西。RPC 上有 `{ type: 'follow_up' }` | `modes/rpc/rpc-mode.ts:601-603`、`rpc-client.ts:287`；`apps/server/src/index.ts:93-94` 已在用 |
| **但工具的 `execute` 里拿不到 writer 自己的 RpcClient**：扩展跑在 agent 进程内，`ExtensionContext`（`extensions/types.ts:315-355`）没有 RpcClient 字段；它有的是 `pi.sendMessage(..., { deliverAs: 'followUp' })` / `pi.sendUserMessage(..., { deliverAs })`（同文件 `:1478-1494`），签名 `void`（fire-and-forget） | `extensions/types.ts:1478-1494` |
| **A 入口（agent 调工具）根本没有"打断"的对象**：agent 正在执行自己的工具调用，它这一轮本来就要继续；自己给自己排一条 followUp = 无意义（该轮结束后队列立刻被取，等于原地多一轮） | `agent-loop.ts:259-268`（steering 优先于 followUp） |
| **C 入口（玩家 UI）不在 agent 进程里**：`routes/world.ts` 的 Express handler 距离 writer 进程有一条 RPC；它能做的只有 `writer.followUp(...)`（= 队列）或 `writer.prompt(..., {streamingBehavior:'steer'})`（= **真打断**） | `rpc-client.ts:273-288`、`rpc-mode.ts:568-580` |

**结论：`followUp` 与 `steer` 是"排队"与"掐断"的差别，没有中间态。** 不存在"不打断但立刻让对方处理"的第三种投递方式——`followUp` 的本质就是"等对方这一轮收笔"。所以选项只有三个：

### 13.3 三个选项与各自的代价

#### 选项 A：`steer` —— 立刻打断（写入 agent 的 steering 队列，本轮工具调用后立刻插入）
**语义（源码级）**：`steer` 排进 steering 队列（`agent.ts:281-283`），agent loop 在**每个 turn 的 `turn_end` 之后**取空它并当作 `pendingMessages` 注入，下一条 assistant 回复立刻看到（`agent-loop.ts:259` → `:180-189`）。它只在 loop 真正要停时才轮到 follow-up（`:262-268`）。

**它确实"即时"：** 若作家正处于 multi-turn 工具循环中，这条输入在**下一个 turn 边界**就进上下文（秒级）；文档、事件、响应也都在 1–2 秒内。

**代价（逐条，都是 `doc-05`/`doc-06` 已经踩过的坑）：**

1. **违反两条已定案纪律。** `doc-05 §5.1`（`doc-05:344-353`）："**不打断、不自动起 turn**"；`00` 反模式第 5 条把"动作路由里直接 `writer.prompt(...)`"写成 MUST NOT。`doc-21:250` 又把它重述了一遍。选 A = 让这条纪律作废，而不只是开一个例外。
2. **它撕碎正在写的叙事。** `doc-06 §2.3`（`doc-06:76-83`）的打断语义：写作中被掐断 ="**整条撤回：写了一半的旁白原地擦掉**（'没写完的戏不算数'）"。玩家拖钥匙时作家十有八九正在写场景（**玩家就是在看着画面做决定的**）——**A 会把最关键的演示时刻变成"叙事反复清零"**。
   > `doc-06:80` 有一条容易被误读的旁注："层演出中发纸条 → 玩家打断 Agent 是天然权利"。它说的是**层演出（canned 表演）**，不是作家写作；同一张表里"writing 中再按 Enter"的行为是**输入无效**（`doc-06:79`）。本文按后者：**玩家表达意图的渠道是"下一次输入"，不是"打断当前轮"**。
3. **它给玩家一个能滥用叙事节奏的按钮。** 连拖三件东西 = 三次掐断；作家永远写不完一段。`doc-06:79` 的原型定案是"笔正忙着（诚实，不排队不打断）"——**连输入框都不让重复提交**，A 与它相反。
4. **它把"玩家动作"与"玩家输入"的优先级搞反了。** 玩家的意图表达（打字）在当前轮里被尊重，玩家的**一次拖拽**却能插队。而拖拽本就是一个"试试看"的低成本动作，不该有打断成本。

**唯一站得住的场景**：演示脚本**确定**作家此刻 idle（拖之前先等 `writer_idle`）。但那就不需要打断——idle 时随便怎么发都会立刻起轮。

#### 选项 B：`followUp` —— 排队等本轮收笔（`plan §11 #4` 的倾向）

**比 A 好得多**：不撕碎叙事、不滥用、且"不用等玩家再打一次字"。

**代价（必须诚实列出）：**

1. **延迟可能很长，且不可预期。** 作家一轮可能 10–60 秒（演示里写一段场景）。玩家拖钥匙 → **锁在 100ms 内开了，但叙事后果要等几十秒**。`doc-19:171` 期望的"作家接收到事件并触发剧情演化：门开启，生成通往地窖的新场景门卡"会被推到这个不确定性之后。
2. **它需要一个额外的跨进程通路。** server 有 RpcClient（`index.ts:93` 已有 `followUp` 分支），**但工具在扩展里没有**（§13.2 表）。要走 B，工具得让 server 知道"请给 writer 排一条"——而 `00 §1` 的硬约束是"扩展与 server 不直接通信，唯一通道是文件系统 + 两个 SQLite"。**B 要么给扩展一条 RPC 通道（推翻 `00 §1`），要么绕道往世界目录写一个请求文件（造第二种"事件"，违反 `doc-21 §2.1`）。两条路的代价都高于它买到的东西。**
3. **它对本轮已经结束的情况是空操作。** 玩家在作家 idle 时拖钥匙，`followUp` 队列会被立刻取出 → 起一轮，效果与 `prompt` 相同；玩家在作家 writing 时拖，则排队。**行为随不可观察的状态分叉**，但我们其实不希望它在 idle 时起一轮（那违反"不自动起 turn"）。
4. **合并时机不对。** 玩家的动作可能发生在作家一轮的**中段**；排队意味着它要等到轮末才被看见，而这一轮的后半段可能已经写完了"门打不开"的叙事——**顺序倒错**。

#### 选项 C：**不破例 —— 一切都走"事件 + 下一轮注入"**（本文推荐）

**做法：** 三件事各归其位——

| 事 | 通道 | 时延 |
|---|---|---|
| 即时视听反馈 + handler 的机械后果 | 前端 + action service（同进程 HTTP 响应） | <100ms |
| 世界记录 | `appendEvent` → `world_event` 帧 | ~150ms–1s |
| 叙事后果 | **作家下一轮**（玩家下一次输入 / 作家自然续写的下一轮）的注入段 | 一个 turn |

**为什么这是对的（三条正向论据）：**

1. **①与③之间没有信息缺口。** 玩家拖钥匙的**全部可感后果**（咔哒声、门卡从"锁着"变"开着"、`locked:false` 在卡片上可见、`puzzle-unlock-burst` 抖动）**在 100ms 内已经发生**。作家这一轮在写的是**别的段落**；门的变化已经**摆在世界里**（文件即真相，`doc-05 §8.5`），作家下一轮 `look_at` 就能看见。
2. **它守住的是"叙事不被工具调用驱动"这条架构线。** `doc-05:12`（2026-09-10 转向）明说"**独立角色打断叙事反而累赘**"；`doc-21:248-250` 把"事件不打断"提升为"硬纪律"。而 AIRP 的**唯一** agent 是作家——**如果连玩家的一次拖拽都能起一轮，那就没有东西在保护叙事节奏了**。「不打断」不是保守，是这套系统里**唯一**的叙事保护机制。
3. **它让"没有 handler 的目标"的语义自洽。** 没有 handler 时（`handled:false`），唯一会改变世界的就是作家。若此时走 `followUp`，就等于"**任何一次拖拽都强制起一轮作家**"——包括拖错东西。玩家会把画布当成一台**每拖一下就要等一段生成**的机器，而 `doc-19:175` 要的是"**通过尝试物理组合来驱动剧情**"的探索感。

**代价（诚实列出，并给出补偿设计）：**

1. **延迟不可控：** 玩家拖了钥匙，要等作家下一轮才看到叙事。**补偿（§13.4）**：让①的即时反馈足够强，并让"下一次输入"这个动作变得必要且自然。
2. **`no_handler` 时可能"什么都没发生"：** 拖错东西的世界后果为零。**补偿**：文本明说"没有反应"（§2.3），前端给一次轻提示（不做假成功）。
3. **评审会问"那和掷骰有什么区别？"** 掷骰（`doc-20 §7`）是"引擎裁决"，本工具是"关系记录"；两者都不打断，这正是它们一致的地方（`00 §4.2` 的 A 名单把它们并列）。**这不是缺陷，是同一纪律的两次应用。**

### 13.4 选 C 之后，怎么把 money shot 做足（**这是本文真正的补救设计**）

光说"不打断"会把演示做塌。四条具体补偿，让"不打断"在观感上依然是个精彩瞬间：

1. **把即时性全部堆在①（<100ms）。** 这是演示的**主要视觉动因**，不是"等作家前的空档"：
   - 咔哒拟音（`lib/audio.ts:512` 的 `unlock`，已有）+ `puzzle-unlock-burst` 抖动（`index.css:1504`，已有）；
   - **门卡内容当场变化**：`locked:false` 让卡片立即可见地换态（`status.data` 是实体的一部分，读它就是读文件，`doc-20 §2.3`）——**"锁开了"这件事不需要作家的一个字就已经成立**；
   - 内容物幻影落地（`前端改造计划.md:261` 的"内容物幻影落地"）：handler 可以在 `status.data` 里挂一句"里面有什么"，前端演一次落物动画。
   - **判据**：这段演出结束时，评委会认为"我开了一把锁"。**这是 doc-19 §3.1 真正的验收点。**
2. **校准"下一次输入"是什么 —— 这里有一处诚实的限制。** 当前代码里 `enterLayer`（`useWorld.ts:107-119`）**只重新取层，不发 writer prompt**；能真正起一轮的只有 `WriterBar` 的输入（`App.tsx:354-356`）与 `choose` 的选项点击（`App.tsx:149-154` 发 `writer_prompt`）。所以**不能声称"进门这个动作本身就是下一轮输入"**——按 `doc-21 §5.5`，进门（`layer_entered`）与拖拽一样"永远不触发一轮"。
   - **因此这条补偿的正确形式是：** 在演示动线上，紧接开锁的下一步是**玩家的一次发言或一次选择**（"我推门进去" / 点门卡上的选项）——那是**玩家本来就会做的动作**，也是 C 方案里注入段真正会到达作家的时刻。
   - **代价必须明说：** 若玩家开锁后**什么输入也不做**，作家不会主动开口（这正是 `doc-21 §5.5` 要的）。**这不是 bug，是"不打断"的另一面。**
   - **可选的进一步加强（不改架构）**：`layer_entered` 的 C 入口（`enterLayer`）在**首次**进入某层时可以顺带发一条 `writer_prompt`——但那是**玩家显式动作触发的注入**，属于 B2 的注入时机问题（`doc-21:250`），**不在本文范围**，也不该由 `use_item_on` 提议。
3. **让注入段的「下一步」句点名它。** `doc-12 #6`（`doc-12:32`）已经写了这条判据：*"有未回应的玩家动作（事件段里最新那条是 `choice_selected` / `use_item_on` / `roll_resolved`）→ '玩家选了 B / 掷出 14，**这一结果还没有被叙事回应**'"*。`handled:true` 时措辞是"**锁已经开了，门后是**……"（叙述后果）；`handled:false` 时是"**玩家试图用 X 作用于 Y，它没有反应**"（决定后果）。**新增的 `handled` 字段正是为了让这句能精确措辞**（§5.2）。
4. **给"紧急后果"一条正当的破例出口（可选的、受限的）。** 如果评审坚持某个瞬间必须"作家立刻说一句话"，**不要改成 `steer`**，而是：**由 handler 通过 `status.data` 写一句作者预留的、已经写好的旁白**（例如 `lock` 组件的 `unlock_line: "锁舌啪地弹开了。"`），前端在①把它作为 target 卡上的一次 temp chalk 呈现（`doc-10 E8` 的 `st.perm===false`：12 秒后自动折叠淡出，不进历史）。**这样"作家口吻的一句话"是作家事先写的文案，不是引擎现编的叙事**——即时性与"叙事只属于作家"两全。**代价**：需要注册表多一个可选字段（归 `10`，本文不索取）。

### 13.5 推荐与拍板请求

> **推荐：选项 C —— 不破例。`use_item_on` 与其它所有动作走完全相同的"事件 + 下一轮注入"通道，任何入口都 MUST NOT 调 `writer.prompt` / `writer.followUp` / `steer`。**

**一句话理由：** `plan §11 #4` 担心的"拖钥匙开锁要立刻有回应"，**在 100ms 内已经由前端与 handler 完整满足了**——`followUp` 唯一多买到的"立刻让作家写一段"，代价是把叙事决定权交给一次拖拽；而"不打断"是本架构里唯一的叙事保护机制，且它在演示动线上基本不需要（开锁之后玩家本来就要发言或选择才继续玩）。

**必须一起接受的代价（§13.4-2 的诚实版）：** 玩家开锁后如果**不做任何输入**，作家不会主动开口。这就是"不打断"的字面含义。演示动线上它不成问题，但**这是本方案最真实的一处让步，评审必须看到它**。

**升级协议（写死触发条件与改法，避免实现期各写各的）**：触发条件 = 彩排时判定 §13.4-2 的"开锁后必须再输入一次才有叙事"是**不可接受的反馈延迟**（这是唯一的升级理由，不由实现者自行解释）；升级方向**只到 `followUp`、绝不 `steer`**（§13.3 选项 A 已否决）。具体改法一行：在 `apps/server/src/routes/world.ts` 的 `/use-item` 处理里、`svc.useItemOn(...)` 成功返回之后插入 `lifecycle.getWriter()?.followUp(...)`（`apps/server/src/index.ts:93` 已有 `followUp` 分支）。**前提**：先解决 §13.3 选项 B 的跨进程通路问题（扩展进程内拿不到 writer 的 `RpcClient`），否则这一行只能写在路由侧、覆盖不到 A 入口的工具调用。

**如果评审仍要即时叙事**，请按优先级依次考虑（都不动 `steer`）：1) §13.4-1 加强①的演出；2) §13.4-4 的 `unlock_line` 预留文案；3) **最后**才是重新讨论 `followUp`——且那时必须先解决 §13.3 选项 B 的跨进程通路问题（要么改 `00 §1`，要么造请求文件）。

**一句话总结**：选 C，玩家在开锁的**当下**就看到了锁开了（①），叙事的后续在他做下一个动作时到达——**延迟是真实的，但它落在玩家本来就要做下一个动作的位置上**。

---
## 14. 结构对照（`00 §7` 的 12 节 → 本文）

| `00 §7` | 本文 |
|---|---|
| 1 一句话与定位 | §1 |
| 2 签名与参数 | §2 |
| 3 行为契约（逐步） | §3 |
| 4 文件与副作用 | §4 |
| 5 落账 | §5 |
| 6 WS / 前端 | §6 |
| 7 错误与边界 | §7 |
| 8 代码落点 | §8 |
| 9 与现存实现的差异 | §9 |
| 10 验收与测试 | §10 |
| 11 发现的冲突 | §11 |
| 12 仍然未知 | §12 |

**额外两节**（`00 §7` 之外的本文专有产出）：

| 节 | 为什么单列 |
|---|---|
| **§13 取舍登记** | 任务点名要求的"本文最重要的产出"；`plan §11 #4` 的待拍板项，篇幅与论证深度都超过一节表格能装下的量 |
| **§14 结构对照** | 与 `01 §15` 同形，供评审快速核对 `00 §7` 的 12 节是否齐 |
